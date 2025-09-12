const express = require('express');
const socketIo = require('socket.io');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const server = http.createServer(app);

// Настройки CORS для Socket.io
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'static')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Только изображения разрешены'));
        }
    }
});

// Блокировка запросов от Kaspersky
app.use((req, res, next) => {
    const referer = req.headers.referer || '';
    const userAgent = req.headers['user-agent'] || '';
    
    if (referer.includes('kaspersky') || userAgent.includes('Kaspersky')) {
        console.log('Blocked request from Kaspersky:', { referer, userAgent });
        return res.status(403).json({ error: 'Requests from security software are blocked' });
    }
    next();
});

// Serve static files
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

app.get('/webrtc.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'webrtc.js'));
});

app.get('/file-manager.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'file-manager.js'));
});

app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

// Favicon handler
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No Content
});

// Setup view engine
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

// Data storage
let users = [];
let messages = [];
const userSockets = new Map();
let activeCalls = new Map();
let callOffers = new Map();
let screenSharingSessions = new Map();

// Data management functions
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

// Load initial data
loadUsers();
loadMessages();

// Authentication middleware
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
    const token = jwt.sign({ username: req.user.username }, JWT_SECRET);
    res.render('chat', { 
        username: req.user.username,
        token: token
    });
});

// API Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        users.push({ 
            username, 
            password: hashedPassword
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

app.get('/api/messages/global', authenticateToken, (req, res) => {
    try {
        const globalMessages = messages.filter(msg => msg.type === 'global');
        res.json(globalMessages);
    } catch (error) {
        console.error('Global messages error:', error);
        res.status(500).json({ error: 'Failed to load global messages' });
    }
});

app.get('/api/conversations', authenticateToken, (req, res) => {
    try {
        const currentUser = req.user.username;
        const conversationPartners = new Set();
        
        messages.forEach(msg => {
            if (msg.type === 'private') {
                if (msg.sender === currentUser) conversationPartners.add(msg.receiver);
                else if (msg.receiver === currentUser) conversationPartners.add(msg.sender);
            }
        });
        
        const conversations = Array.from(conversationPartners).map(partner => {
            const lastMessage = messages
                .filter(msg => msg.type === 'private' && 
                    ((msg.sender === currentUser && msg.receiver === partner) ||
                     (msg.sender === partner && msg.receiver === currentUser)))
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            
            return {
                username: partner,
                lastMessage: lastMessage ? {
                    text: lastMessage.message,
                    timestamp: lastMessage.timestamp,
                    isOwn: lastMessage.sender === currentUser,
                    type: lastMessage.type || 'text'
                } : null
            };
        });
        
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

app.get('/api/users/search', authenticateToken, (req, res) => {
    try {
        const { query } = req.query;
        const currentUser = req.user.username;
        
        if (!query || query.trim().length < 2) {
            return res.json([]);
        }
        
        const searchTerm = query.toLowerCase().trim();
        
        const results = users
            .filter(user => 
                user.username && 
                user.username.toLowerCase().includes(searchTerm) &&
                user.username !== currentUser
            )
            .map(({ password, ...user }) => user);
        
        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

app.get('/api/messages/private/:username', authenticateToken, (req, res) => {
    try {
        const otherUser = req.params.username;
        const currentUser = req.user.username;
        
        const privateMessages = messages.filter(msg => 
            msg.type === 'private' &&
            ((msg.sender === currentUser && msg.receiver === otherUser) ||
             (msg.sender === otherUser && msg.receiver === currentUser))
        );
        
        res.json(privateMessages);
    } catch (error) {
        console.error('Messages error:', error);
        res.status(500).json({ error: 'Failed to load messages' });
    }
});

// File upload endpoint
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        // Создаем миниатюру для изображений
        let thumbnailPath = null;
        if (req.file.mimetype.startsWith('image/')) {
            const thumbName = `thumb-${req.file.filename}`;
            thumbnailPath = path.join(__dirname, 'uploads', thumbName);
            
            await sharp(req.file.path)
                .resize(200, 200, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 80 })
                .toFile(thumbnailPath);
        }

        res.json({
            success: true,
            file: {
                originalName: req.file.originalname,
                filename: req.file.filename,
                path: `/uploads/${req.file.filename}`,
                thumbnail: thumbnailPath ? `/uploads/thumb-${req.file.filename}` : null,
                size: req.file.size,
                mimetype: req.file.mimetype,
                uploadDate: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Ошибка загрузки файла' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });

    socket.on('disconnect', (reason) => {
        console.log('User disconnected:', socket.id, 'Reason:', reason);
        if (socket.username) {
            userSockets.delete(socket.username);
        }
    });

    socket.on('user authenticated', (username) => {
        console.log('User authenticated:', username, 'Socket ID:', socket.id);
        userSockets.set(username, socket.id);
        socket.username = username;
    });

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
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    socket.on('private message', (data) => {
        try {
            const messageData = {
                sender: data.sender,
                receiver: data.receiver,
                message: data.message,
                timestamp: new Date().toLocaleTimeString(),
                type: 'private',
                date: new Date().toISOString(),
                messageType: data.messageType || 'text',
                fileData: data.fileData || null
            };
            
            messages.push(messageData);
            saveMessages();
            
            const receiverSocketId = userSockets.get(data.receiver);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('private message', messageData);
            }
            
            socket.emit('private message', messageData);
            io.emit('conversations updated');
        } catch (error) {
            console.error('Private message error:', error);
            socket.emit('error', { message: 'Failed to send private message' });
        }
    });

    // WebRTC signaling events
    socket.on('call-offer', (data) => {
        try {
            const receiverSocketId = userSockets.get(data.to);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('incoming-call', {
                    from: socket.username,
                    offer: data.offer,
                    isVideoCall: data.isVideoCall,
                    callId: data.callId
                });
            }
        } catch (error) {
            console.error('Error handling call offer:', error);
        }
    });

    socket.on('call-answer', (data) => {
        try {
            const receiverSocketId = userSockets.get(data.to);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('call-answered', {
                    answer: data.answer,
                    callId: data.callId
                });
            }
        } catch (error) {
            console.error('Error handling call answer:', error);
        }
    });

    socket.on('ice-candidate', (data) => {
        try {
            const receiverSocketId = userSockets.get(data.to);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('ice-candidate', {
                    candidate: data.candidate,
                    callId: data.callId
                });
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    });

    socket.on('end-call', (data) => {
        try {
            const receiverSocketId = userSockets.get(data.to);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('call-ended', {
                    callId: data.callId
                });
            }
        } catch (error) {
            console.error('Error handling end call:', error);
        }
    });

    // Screen sharing events
    socket.on('screen-share-start', (data) => {
        try {
            const receiverSocketId = userSockets.get(data.to);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('screen-share-started', {
                    callId: data.callId
                });
            }
        } catch (error) {
            console.error('Error handling screen share start:', error);
        }
    });

    socket.on('screen-share-end', (data) => {
        try {
            const receiverSocketId = userSockets.get(data.to);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('screen-share-ended', {
                    callId: data.callId
                });
            }
        } catch (error) {
            console.error('Error handling screen share end:', error);
        }
    });

    // Ping-pong для поддержания соединения
    socket.on('ping', (cb) => {
        if (typeof cb === 'function') {
            cb('pong');
        }
    });
});

// Обработка ошибок сервера
server.on('error', (error) => {
    console.error('Server error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
});