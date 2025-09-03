const express = require('express');
const socketIo = require('socket.io');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'static')));

// Явно указываем пути для основных файлов
app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'style.css'));
});

app.get('/auth.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'auth.js'));
});

app.get('/chat.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'chat.js'));
});

app.get('/private-chat.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'private-chat.js'));
});

app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

// Настройка шаблонов
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

// Хранилище данных
let users = [];
let messages = [];
let activeSockets = {}; // Для отслеживания активных пользователей

async function loadUsers() {
    try {
        const data = await fs.readFile('users.json', 'utf8');
        users = JSON.parse(data);
    } catch (error) {
        users = [];
        await saveUsers();
    }
}

async function loadMessages() {
    try {
        const data = await fs.readFile('messages.json', 'utf8');
        messages = JSON.parse(data);
    } catch (error) {
        messages = [];
        await saveMessages();
    }
}

async function saveUsers() {
    try {
        await fs.writeFile('users.json', JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error saving users:', error);
    }
}

async function saveMessages() {
    try {
        await fs.writeFile('messages.json', JSON.stringify(messages, null, 2));
    } catch (error) {
        console.error('Error saving messages:', error);
    }
}

// Загружаем данные при запуске
loadUsers();
loadMessages();

// Проверка JWT токена
function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/chat', authenticateToken, (req, res) => {
    res.render('chat', { username: req.user.username });
});

// API Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, tags } = req.body;
        
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const tag = '#' + Math.floor(1000 + Math.random() * 9000);
        
        users.push({ 
            username, 
            password: hashedPassword, 
            tag,
            tags: tags ? tags.split(',').map(t => t.trim()) : []
        });
        
        await saveUsers();
        
        const token = jwt.sign({ username }, JWT_SECRET);
        res.cookie('token', token, { httpOnly: true });
        res.json({ success: true });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = users.find(u => u.username === username);
        
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ username }, JWT_SECRET);
        res.cookie('token', token, { httpOnly: true });
        res.json({ success: true });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// Получение списка диалогов
app.get('/api/conversations', authenticateToken, (req, res) => {
    try {
        const currentUser = req.user.username;
        
        // Находим всех пользователей, с которыми есть переписка
        const conversationPartners = new Set();
        
        messages.forEach(msg => {
            if (msg.type === 'private') {
                if (msg.sender === currentUser) {
                    conversationPartners.add(msg.receiver);
                } else if (msg.receiver === currentUser) {
                    conversationPartners.add(msg.sender);
                }
            }
        });
        
        // Получаем информацию о пользователях
        const conversations = Array.from(conversationPartners).map(partner => {
            const user = users.find(u => u.username === partner);
            const lastMessage = messages
                .filter(msg => msg.type === 'private' && 
                    ((msg.sender === currentUser && msg.receiver === partner) ||
                     (msg.sender === partner && msg.receiver === currentUser)))
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            
            const unreadCount = messages.filter(msg => 
                msg.type === 'private' &&
                msg.sender === partner &&
                msg.receiver === currentUser &&
                !msg.read
            ).length;
            
            return {
                username: partner,
                tag: user ? user.tag : '#0000',
                lastMessage: lastMessage ? {
                    text: lastMessage.message,
                    timestamp: lastMessage.timestamp,
                    isOwn: lastMessage.sender === currentUser
                } : null,
                unreadCount,
                isOnline: !!activeSockets[partner]
            };
        });
        
        // Сортируем по времени последнего сообщения
        conversations.sort((a, b) => {
            if (!a.lastMessage) return 1;
            if (!b.lastMessage) return -1;
            return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp);
        });
        
        res.json(conversations);
    } catch (error) {
        console.error('Conversations error:', error);
        res.status(500).json({ error: 'Failed to load conversations' });
    }
});

// Поиск пользователей
app.get('/api/users/search', authenticateToken, (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query || query.length < 2) {
            return res.json([]);
        }
        
        const results = users.filter(user => 
            user.username.toLowerCase().includes(query.toLowerCase()) ||
            user.tag.toLowerCase().includes(query.toLowerCase()) ||
            user.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        );
        
        const filteredResults = results
            .filter(user => user.username !== req.user.username)
            .map(({ password, ...user }) => user);
        
        res.json(filteredResults);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// История личных сообщений
app.get('/api/messages/private/:username', authenticateToken, (req, res) => {
    try {
        const otherUser = req.params.username;
        const currentUser = req.user.username;
        
        const privateMessages = messages.filter(msg => 
            msg.type === 'private' &&
            ((msg.sender === currentUser && msg.receiver === otherUser) ||
             (msg.sender === otherUser && msg.receiver === currentUser))
        );
        
        // Помечаем сообщения как прочитанные
        messages.forEach(msg => {
            if (msg.type === 'private' && 
                msg.sender === otherUser && 
                msg.receiver === currentUser &&
                !msg.read) {
                msg.read = true;
            }
        });
        
        saveMessages();
        
        res.json(privateMessages);
    } catch (error) {
        console.error('Messages error:', error);
        res.status(500).json({ error: 'Failed to load messages' });
    }
});

// Socket.io
io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('user connected', (username) => {
        activeSockets[username] = socket.id;
        console.log(`User ${username} connected with socket ${socket.id}`);
    });

    // Глобальные сообщения
    socket.on('chat message', (data) => {
        try {
            const messageData = {
                username: data.username,
                message: data.message,
                timestamp: new Date().toLocaleTimeString(),
                type: 'global',
                date: new Date().toISOString()
            };
            
            messages.push(messageData);
            saveMessages();
            
            io.emit('chat message', messageData);
        } catch (error) {
            console.error('Global message error:', error);
        }
    });

    // Личные сообщения
    socket.on('private message', (data) => {
        try {
            const messageData = {
                sender: data.sender,
                receiver: data.receiver,
                message: data.message,
                timestamp: new Date().toLocaleTimeString(),
                type: 'private',
                date: new Date().toISOString(),
                read: false
            };
            
            messages.push(messageData);
            saveMessages();
            
            // Отправляем отправителю
            socket.emit('private message', messageData);
            
            // Отправляем получателю, если он онлайн
            const receiverSocketId = activeSockets[data.receiver];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('private message', messageData);
            }
            
            // Обновляем список диалогов для обоих пользователей
            io.emit('conversations updated');
            
        } catch (error) {
            console.error('Private message error:', error);
        }
    });

    socket.on('disconnect', () => {
        // Удаляем пользователя из активных
        for (const [username, socketId] of Object.entries(activeSockets)) {
            if (socketId === socket.id) {
                delete activeSockets[username];
                console.log(`User ${username} disconnected`);
                break;
            }
        }
    });
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});