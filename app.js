const express = require('express');
const socketIo = require('socket.io');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const server = http.createServer(app);

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

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(__dirname, 'uploads', 'avatars');

// Инициализация хранилищ
let users = [];
let messages = [];
let systemNotifications = [];
let groups = [];
const userSockets = new Map();
const onlineUsers = new Set();
const activeCalls = new Map();
const screenShares = new Map();
let giftsData = {};

// Хранилище для валюты
let currencyData = {};

async function ensureDirectories() {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.mkdir(uploadsDir, { recursive: true });
        await fs.mkdir(avatarsDir, { recursive: true });
        
        const staticDir = path.join(__dirname, 'static');
        await fs.mkdir(staticDir, { recursive: true });
        
        console.log('✅ Directories ensured');
    } catch (error) {
        console.error('❌ Error creating directories:', error);
    }
}

// Функция для очистки старых аватаров пользователя
async function cleanupUserAvatars(username) {
    try {
        const files = await fs.readdir(avatarsDir);
        const userAvatarPattern = new RegExp(`^avatar_${username}_`);
        
        for (const file of files) {
            if (file.match(userAvatarPattern) || 
                file.includes(`_${username}_`) || 
                file.startsWith(`avatar_`) && file.includes(username)) {
                
                const filePath = path.join(avatarsDir, file);
                await fs.unlink(filePath);
                console.log(`🗑️ Deleted old avatar: ${file}`);
            }
        }
    } catch (error) {
        console.error('❌ Error cleaning up user avatars:', error);
    }
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'static')));
app.use('/uploads', express.static(uploadsDir));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await ensureDirectories();
            cb(null, uploadsDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml',
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv',
        'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 
        'application/x-tar', 'application/gzip',
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/x-m4a', 'audio/x-wav',
        'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime',
        'application/json', 'application/xml'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        const allowedExtensions = /\.(jpeg|jpg|png|gif|bmp|webp|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z|tar|gz|mp3|wav|ogg|m4a|mp4|aac|webm|mov|avi|mkv|json|xml)$/i;
        if (allowedExtensions.test(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый тип файла: ' + file.mimetype));
        }
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024,
    },
    fileFilter: fileFilter
});

const voiceUpload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Разрешены только аудио файлы для голосовых сообщений'));
        }
    }
});

// Настройка multer для загрузки аватаров
const avatarStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, avatarsDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = `avatar_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Разрешены только изображения'), false);
        }
    }
});

// Загрузка данных
async function loadUsers() {
    try {
        const data = await fs.readFile(path.join(dataDir, 'users.json'), 'utf8');
        users = JSON.parse(data);
        console.log('✅ Users loaded:', users.length);
    } catch (error) {
        users = [];
        await saveUsers();
    }
}

async function loadMessages() {
    try {
        const data = await fs.readFile(path.join(dataDir, 'messages.json'), 'utf8');
        messages = JSON.parse(data);
        console.log('✅ Messages loaded:', messages.length);
    } catch (error) {
        messages = [];
        await saveMessages();
    }
}

async function loadGroups() {
    try {
        const data = await fs.readFile(path.join(dataDir, 'groups.json'), 'utf8');
        groups = JSON.parse(data);
        console.log('✅ Groups loaded:', groups.length);
    } catch (error) {
        groups = [];
        await saveGroups();
    }
}

// Загрузка данных валюты
async function loadCurrencyData() {
    try {
        const data = await fs.readFile(path.join(dataDir, 'currency.json'), 'utf8');
        currencyData = JSON.parse(data);
        console.log('✅ Currency data loaded');
    } catch (error) {
        currencyData = {};
        await saveCurrencyData();
    }
}

async function saveUsers() {
    try {
        await fs.writeFile(path.join(dataDir, 'users.json'), JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('❌ Error saving users:', error);
    }
}

async function saveMessages() {
    try {
        await fs.writeFile(path.join(dataDir, 'messages.json'), JSON.stringify(messages, null, 2));
    } catch (error) {
        console.error('❌ Error saving messages:', error);
    }
}

async function saveGroups() {
    try {
        await fs.writeFile(path.join(dataDir, 'groups.json'), JSON.stringify(groups, null, 2));
    } catch (error) {
        console.error('❌ Error saving groups:', error);
    }
}

// Сохранение данных валюты
async function saveCurrencyData() {
    try {
        await fs.writeFile(path.join(dataDir, 'currency.json'), JSON.stringify(currencyData, null, 2));
    } catch (error) {
        console.error('❌ Error saving currency data:', error);
    }
}

// Инициализация данных валюты для пользователя
function initUserCurrency(username) {
    if (!currencyData[username]) {
        currencyData[username] = {
            balance: 100,
            dailyStreak: 0,
            lastDailyReward: null,
            transactionHistory: []
        };
    }
    return currencyData[username];
}

// Аутентификация
function authenticateToken(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Создаем необходимые статические файлы если их нет
async function ensureStaticFiles() {
    try {
        const staticDir = path.join(__dirname, 'static');
        
        const cssPath = path.join(staticDir, 'style.css');
        try {
            await fs.access(cssPath);
        } catch {
            const defaultCSS = `
body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
.container { max-width: 800px; margin: 0 auto; }
.form-group { margin-bottom: 15px; }
input, button { padding: 10px; margin: 5px 0; width: 100%; box-sizing: border-box; }
`;
            await fs.writeFile(cssPath, defaultCSS);
            console.log('✅ Created default style.css');
        }

        const avatarPath = path.join(staticDir, 'default-avatar.png');
        try {
            await fs.access(avatarPath);
        } catch {
            await fs.writeFile(avatarPath, '');
            console.log('✅ Created placeholder default-avatar.png');
        }
    } catch (error) {
        console.error('❌ Error creating static files:', error);
    }
}

// Статические файлы и рендеринг
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

// Создаем директорию templates если её нет
async function ensureTemplates() {
    try {
        const templatesDir = path.join(__dirname, 'templates');
        await fs.mkdir(templatesDir, { recursive: true });
        
        const templates = ['index', 'register', 'login', 'chat'];
        
        for (const template of templates) {
            const templatePath = path.join(templatesDir, `${template}.html`);
            try {
                await fs.access(templatePath);
            } catch {
                let content = '';
                switch(template) {
                    case 'index':
                        content = `<!DOCTYPE html><html><head><title>Chat App</title><link rel="stylesheet" href="/style.css"></head><body><div class="container"><h1>Welcome to Chat App</h1><a href="/login">Login</a> | <a href="/register">Register</a></div></body></html>`;
                        break;
                    case 'register':
                        content = `<!DOCTYPE html><html><head><title>Register</title><link rel="stylesheet" href="/style.css"></head><body><div class="container"><h1>Register</h1><form id="registerForm"><input type="text" name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button type="submit">Register</button></form><a href="/login">Login</a></div><script src="/auth.js"></script></body></html>`;
                        break;
                    case 'login':
                        content = `<!DOCTYPE html><html><head><title>Login</title><link rel="stylesheet" href="/style.css"></head><body><div class="container"><h1>Login</h1><form id="loginForm"><input type="text" name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button type="submit">Login</button></form><a href="/register">Register</a></div><script src="/auth.js"></script></body></html>`;
                        break;
                    case 'chat':
                        content = `<!DOCTYPE html><html><head><title>Chat</title><link rel="stylesheet" href="/style.css"></head><body><div class="container"><h1>Chat</h1><div id="chatContainer"></div></div><script>const token = "<%= token %>"; const username = "<%= username %>";</script><script src="/socket.io/socket.io.js"></script><script src="/chat.js"></script></body></html>`;
                        break;
                }
                await fs.writeFile(templatePath, content);
                console.log(`✅ Created ${template}.html`);
            }
        }
    } catch (error) {
        console.error('❌ Error creating templates:', error);
    }
}

app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

// Роуты
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

// API Роуты

app.post('/api/register', avatarUpload.single('avatar'), async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        let avatarPath = '/default-avatar.png';
        if (req.file) {
            await cleanupUserAvatars(username);
            
            const uniqueName = `avatar_${username}_${Date.now()}${path.extname(req.file.originalname)}`;
            const newAvatarPath = path.join(avatarsDir, uniqueName);
            
            await fs.rename(req.file.path, newAvatarPath);
            
            avatarPath = `/uploads/avatars/${uniqueName}`;
        }
        
        const newUser = { 
            username, 
            password: hashedPassword,
            avatar: avatarPath,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        await saveUsers();
        
        // Инициализируем валюту для нового пользователя
        initUserCurrency(username);
        await saveCurrencyData();

        const token = jwt.sign({ username }, JWT_SECRET);
        res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        res.json({ 
            success: true, 
            token,
            user: {
                username: newUser.username,
                avatar: newUser.avatar
            }
        });
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const user = users.find(u => u.username === username);
        
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ username }, JWT_SECRET);
        res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        res.json({ 
            success: true, 
            token,
            user: {
                username: user.username,
                avatar: user.avatar || '/default-avatar.png'
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// Пользовательские данные
app.get('/api/user/:username', authenticateToken, (req, res) => {
    try {
        const { username } = req.params;
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const publicUserInfo = {
            username: user.username,
            avatar: user.avatar || '/default-avatar.png',
            createdAt: user.createdAt
        };
        
        res.json(publicUserInfo);
    } catch (error) {
        console.error('❌ User info error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

app.post('/api/user/avatar', authenticateToken, avatarUpload.single('avatar'), async (req, res) => {
    try {
        const username = req.user.username;
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No avatar file provided' });
        }
        
        await cleanupUserAvatars(username);
        
        const uniqueName = `avatar_${username}_${Date.now()}${path.extname(req.file.originalname)}`;
        const newAvatarPath = path.join(avatarsDir, uniqueName);
        
        await fs.rename(req.file.path, newAvatarPath);
        
        user.avatar = `/uploads/avatars/${uniqueName}`;
        await saveUsers();
        
        io.emit('user_avatar_updated', {
            username: username,
            avatar: user.avatar
        });
        
        res.json({ 
            success: true, 
            avatar: user.avatar,
            message: 'Avatar updated successfully'
        });
    } catch (error) {
        console.error('❌ Avatar update error:', error);
        res.status(500).json({ error: 'Failed to update avatar' });
    }
});

// Системные уведомления
app.get('/api/notifications', authenticateToken, (req, res) => {
    try {
        const recentNotifications = systemNotifications
            .slice(-50)
            .reverse();
        res.json(recentNotifications);
    } catch (error) {
        console.error('❌ Notifications error:', error);
        res.status(500).json({ error: 'Failed to load notifications' });
    }
});

// Чаты и сообщения
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
                    type: lastMessage.messageType || 'text'
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
        console.error('❌ Conversations error:', error);
        res.status(500).json({ error: 'Failed to load conversations' });
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
        console.error('❌ Messages error:', error);
        res.status(500).json({ error: 'Failed to load messages' });
    }
});

// Пользователи
app.get('/api/users/search', authenticateToken, (req, res) => {
    try {
        const { query } = req.query;
        const currentUser = req.user.username;
        
        if (!query || query.trim().length < 2) {
            return res.json([]);
        }
        
        const searchTerm = query.toLowerCase().trim();
        
        const results = users
            .filter(user => {
                if (!user.username || user.username === currentUser) {
                    return false;
                }
                
                const username = user.username.toLowerCase();
                return username.includes(searchTerm);
            })
            .map(({ password, ...user }) => {
                return {
                    ...user,
                    isOnline: onlineUsers.has(user.username)
                };
            });
        
        res.json(results);
        
    } catch (error) {
        console.error('❌ Search error:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

app.get('/api/users/all', authenticateToken, (req, res) => {
    try {
        const currentUser = req.user.username;
        const usersWithoutPasswords = users
            .filter(user => user.username !== currentUser)
            .map(({ password, ...user }) => {
                return {
                    ...user,
                    isOnline: onlineUsers.has(user.username)
                };
            });
        
        res.json(usersWithoutPasswords);
    } catch (error) {
        console.error('❌ Error getting all users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Загрузка файлов
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        let thumbnailPath = null;
        
        if (req.file.mimetype.startsWith('image/')) {
            try {
                const thumbName = `thumb-${req.file.filename}`;
                const thumbFullPath = path.join(uploadsDir, thumbName);
                
                await sharp(req.file.path)
                    .resize(200, 200, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 80 })
                    .toFile(thumbFullPath);
                
                thumbnailPath = `/uploads/${thumbName}`;
                
            } catch (sharpError) {
                console.error('❌ Thumbnail creation error:', sharpError);
                thumbnailPath = `/uploads/${req.file.filename}`;
            }
        }

        const fileResponse = {
            success: true,
            file: {
                originalName: req.file.originalname,
                filename: req.file.filename,
                path: `/uploads/${req.file.filename}`,
                thumbnail: thumbnailPath,
                size: req.file.size,
                mimetype: req.file.mimetype,
                uploadDate: new Date().toISOString()
            }
        };

        res.json(fileResponse);

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ error: 'Ошибка загрузки файла: ' + error.message });
    }
});
// API для получения подарков пользователя
app.get('/api/user/:username/gifts', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        
        if (req.user.username !== username && req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const userGifts = getUserGifts(username);
        res.json(userGifts);
        
    } catch (error) {
        console.error('❌ User gifts error:', error);
        res.status(500).json({ error: 'Ошибка загрузки подарков' });
    }
});

// API для отправки подарка
app.post('/api/gifts/send', authenticateToken, async (req, res) => {
    try {
        const { sender, receiver, giftId, giftName, giftPrice, giftImage } = req.body;
        
        if (req.user.username !== sender) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        // Проверяем существование пользователя
        const receiverUser = users.find(u => u.username === receiver);
        if (!receiverUser) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // Проверяем баланс отправителя
        const senderCurrency = initUserCurrency(sender);
        if (senderCurrency.balance < giftPrice) {
            return res.status(400).json({
                success: false,
                error: 'Недостаточно монет для покупки подарка'
            });
        }

        // Инициализируем подарки для обоих пользователей
        const senderGifts = initUserGifts(sender);
        const receiverGifts = initUserGifts(receiver);

        // Создаем объект подарка
        const gift = {
            id: `gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            giftId: giftId,
            name: giftName,
            price: giftPrice,
            image: giftImage,
            sender: sender,
            receiver: receiver,
            sentAt: new Date().toISOString(),
            isRead: false
        };

        // Добавляем подарок получателю
        receiverGifts.received.unshift(gift);
        
        // Добавляем запись отправителю
        senderGifts.sent.unshift({
            ...gift,
            received: true
        });

        // Списание средств у отправителя
        senderCurrency.balance -= giftPrice;

        // Добавляем записи в историю транзакций
        senderCurrency.transactionHistory.unshift({
            type: 'gift_sent',
            amount: -giftPrice,
            description: `Подарок для ${receiver}: ${giftName}`,
            timestamp: new Date().toISOString()
        });

        // Начисляем бонус получателю (например, 10% от стоимости)
        const receiverBonus = Math.floor(giftPrice * 0.1);
        const receiverCurrency = initUserCurrency(receiver);
        receiverCurrency.balance += receiverBonus;

        receiverCurrency.transactionHistory.unshift({
            type: 'gift_received',
            amount: receiverBonus,
            description: `Бонус за подарок от ${sender}: ${giftName}`,
            timestamp: new Date().toISOString()
        });

        // Сохраняем все данные
        await saveGiftsData();
        await saveCurrencyData();

        // Отправляем уведомление получателю через WebSocket
        const receiverSocketId = userSockets.get(receiver);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('gift_received', {
                gift: gift,
                bonus: receiverBonus,
                newBalance: receiverCurrency.balance
            });
        }

        // Отправляем подтверждение отправителю
        const senderSocketId = userSockets.get(sender);
        if (senderSocketId) {
            io.to(senderSocketId).emit('gift_sent_success', {
                gift: gift,
                newBalance: senderCurrency.balance
            });
        }

        console.log(`🎁 Gift sent: ${sender} -> ${receiver} (${giftName})`);

        res.json({
            success: true,
            message: `Подарок "${giftName}" успешно отправлен пользователю ${receiver}!`,
            gift: gift,
            senderNewBalance: senderCurrency.balance,
            receiverBonus: receiverBonus
        });

    } catch (error) {
        console.error('❌ Gift send error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка отправки подарка'
        });
    }
});

// API для отметки подарка как прочитанного
app.post('/api/gifts/mark-read', authenticateToken, async (req, res) => {
    try {
        const { username, giftId } = req.body;
        
        if (req.user.username !== username) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const userGifts = getUserGifts(username);
        const gift = userGifts.received.find(g => g.id === giftId);
        
        if (gift) {
            gift.isRead = true;
            await saveGiftsData();
        }

        res.json({ success: true });
        
    } catch (error) {
        console.error('❌ Mark gift read error:', error);
        res.status(500).json({ error: 'Ошибка обновления статуса подарка' });
    }
});
// Загрузка голосовых сообщений
app.post('/api/upload-voice', authenticateToken, voiceUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        const fileResponse = {
            success: true,
            file: {
                originalName: req.file.originalname,
                filename: req.file.filename,
                path: `/uploads/${req.file.filename}`,
                size: req.file.size,
                mimetype: req.file.mimetype,
                uploadDate: new Date().toISOString(),
                type: 'voice'
            }
        };

        console.log('✅ Voice message uploaded:', fileResponse.file.originalName);
        res.json(fileResponse);

    } catch (error) {
        console.error('❌ Voice upload error:', error);
        
        if (req.file) {
            await fs.unlink(req.file.path).catch(console.error);
        }
        
        res.status(500).json({ error: 'Ошибка загрузки голосового сообщения: ' + error.message });
    }
});

// Группы
app.get('/api/user/groups', authenticateToken, async (req, res) => {
    try {
        const currentUser = req.user.username;
        
        console.log('🔄 Fetching groups for user:', currentUser);
        
        const userGroups = groups
            .filter(group => {
                const isMember = group.members && group.members.includes(currentUser);
                return isMember;
            })
            .map(group => {
                const groupMessages = messages.filter(msg => 
                    msg.type === 'group' && msg.groupId === group.id
                );
                
                const lastMessage = groupMessages.length > 0 
                    ? groupMessages[groupMessages.length - 1]
                    : null;
                
                return {
                    id: group.id,
                    name: group.name,
                    members: group.members || [],
                    createdBy: group.createdBy,
                    createdAt: group.createdAt,
                    memberCount: group.members ? group.members.length : 0,
                    isGroup: true,
                    lastMessage: lastMessage ? {
                        text: lastMessage.message,
                        timestamp: lastMessage.timestamp,
                        sender: lastMessage.sender,
                        type: lastMessage.messageType || 'text',
                        isOwn: lastMessage.sender === currentUser
                    } : null
                };
            });
        
        console.log(`✅ Found ${userGroups.length} groups for user ${currentUser}`);
        
        res.json(userGroups);
        
    } catch (error) {
        console.error('❌ User groups error:', error);
        res.status(500).json({ error: 'Failed to load user groups: ' + error.message });
    }
});

app.get('/api/groups/user', authenticateToken, async (req, res) => {
    try {
        const currentUser = req.user.username;
        const userGroups = groups.filter(group => 
            group.members && group.members.includes(currentUser)
        ).map(group => ({
            id: group.id,
            name: group.name,
            members: group.members,
            createdBy: group.createdBy,
            createdAt: group.createdAt,
            isGroup: true
        }));
        
        res.json(userGroups);
    } catch (error) {
        console.error('❌ User groups error:', error);
        res.status(500).json({ error: 'Failed to load user groups' });
    }
});

app.post('/api/groups/create', authenticateToken, async (req, res) => {
    try {
        const { name, members, createdBy } = req.body;
        
        if (!name || !members || !createdBy) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }

        const group = {
            id: 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: name,
            members: members,
            createdBy: createdBy,
            createdAt: new Date().toISOString(),
            messages: [],
            memberCount: members.length
        };

        groups.push(group);
        await saveGroups();

        members.forEach(member => {
            const memberSocketId = userSockets.get(member);
            if (memberSocketId) {
                io.to(memberSocketId).emit('group_created', {
                    group: group
                });
            }
        });

        console.log(`✅ Group created: ${group.name} with ${members.length} members`);
        
        res.json({
            success: true,
            group: group
        });
        
    } catch (error) {
        console.error('❌ Group creation error:', error);
        res.status(500).json({ error: 'Ошибка создания группы' });
    }
});

app.get('/api/groups', authenticateToken, (req, res) => {
    try {
        const currentUser = req.user.username;
        const userGroups = groups.filter(group => 
            group.members && group.members.includes(currentUser)
        );
        res.json(userGroups);
    } catch (error) {
        console.error('❌ Groups error:', error);
        res.status(500).json({ error: 'Failed to load groups' });
    }
});

// Групповые сообщения
app.get('/api/groups/:groupId/messages', authenticateToken, (req, res) => {
    try {
        const { groupId } = req.params;
        const currentUser = req.user.username;
        
        const group = groups.find(g => g.id === groupId);
        if (!group || !group.members.includes(currentUser)) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        const groupMessages = messages.filter(msg => 
            msg.type === 'group' && msg.groupId === groupId
        );
        
        console.log(`✅ Loaded ${groupMessages.length} messages for group ${groupId}`);
        res.json(groupMessages);
    } catch (error) {
        console.error('❌ Group messages error:', error);
        res.status(500).json({ error: 'Failed to load group messages' });
    }
});

// Отправка сообщений в группу
app.post('/api/groups/:groupId/messages', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { message, messageType = 'text', fileData = null } = req.body;
        const sender = req.user.username;

        if (!message && !fileData) {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }

        const group = groups.find(g => g.id === groupId);
        if (!group || !group.members.includes(sender)) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const messageData = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            sender: sender,
            groupId: groupId,
            message: message,
            timestamp: new Date().toLocaleTimeString(),
            type: 'group',
            date: new Date().toISOString(),
            messageType: messageType,
            fileData: fileData
        };
        
        messages.push(messageData);
        await saveMessages();

        group.members.forEach(member => {
            const memberSocketId = userSockets.get(member);
            if (memberSocketId) {
                io.to(memberSocketId).emit('group_message', messageData);
            }
        });

        console.log(`✅ Group message sent to ${group.members.length} members in group ${group.name}`);
        
        res.json({ success: true, message: messageData });
        
    } catch (error) {
        console.error('❌ Group message error:', error);
        res.status(500).json({ error: 'Ошибка отправки сообщения' });
    }
});

// Получение информации о группе
app.get('/api/groups/:groupId', authenticateToken, (req, res) => {
    try {
        const { groupId } = req.params;
        const currentUser = req.user.username;
        
        const group = groups.find(g => g.id === groupId);
        
        if (!group) {
            return res.status(404).json({ error: 'Группа не найдена' });
        }
        
        if (!group.members.includes(currentUser)) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        const groupInfo = {
            id: group.id,
            name: group.name,
            members: group.members,
            createdBy: group.createdBy,
            createdAt: group.createdAt,
            memberCount: group.members ? group.members.length : 0
        };
        
        res.json(groupInfo);
    } catch (error) {
        console.error('❌ Group info error:', error);
        res.status(500).json({ error: 'Failed to load group info' });
    }
});

// API для валюты
app.get('/api/user/:username/currency', authenticateToken, (req, res) => {
    try {
        const { username } = req.params;
        
        if (req.user.username !== username && req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const userCurrency = initUserCurrency(username);
        
        res.json(userCurrency);
        
    } catch (error) {
        console.error('❌ Currency data error:', error);
        res.status(500).json({ error: 'Ошибка загрузки данных валюты' });
    }
});

app.post('/api/currency/daily-reward', authenticateToken, async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Имя пользователя обязательно'
            });
        }

        if (req.user.username !== username) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const userCurrency = initUserCurrency(username);
        const now = new Date();
        
        // Проверяем, можно ли получить награду
        if (userCurrency.lastDailyReward) {
            const lastReward = new Date(userCurrency.lastDailyReward);
            const hoursSinceLastReward = (now - lastReward) / (1000 * 60 * 60);
            
            if (hoursSinceLastReward < 23) {
                return res.status(400).json({
                    success: false,
                    error: 'Вы уже получали награду сегодня'
                });
            }
            
            // Проверяем серию (если прошло меньше 48 часов, увеличиваем серию)
            if (hoursSinceLastReward < 48) {
                userCurrency.dailyStreak += 1;
            } else {
                userCurrency.dailyStreak = 1; // Сбрасываем серию
            }
        } else {
            userCurrency.dailyStreak = 1; // Первая награда
        }

        // Расчет награды
        const baseReward = 50;
        const streakBonus = Math.min(userCurrency.dailyStreak * 5, 100); // Максимум 100 бонусных монет
        const totalReward = baseReward + streakBonus;
        
        // Обновляем баланс
        userCurrency.balance += totalReward;
        userCurrency.lastDailyReward = now.toISOString();
        
        // Добавляем в историю
        userCurrency.transactionHistory.unshift({
            type: 'daily_reward',
            amount: totalReward,
            description: `Ежедневная награда (серия: ${userCurrency.dailyStreak} дней)`,
            timestamp: now.toISOString()
        });
        
        // Сохраняем только последние 50 транзакций
        if (userCurrency.transactionHistory.length > 50) {
            userCurrency.transactionHistory = userCurrency.transactionHistory.slice(0, 50);
        }
        
        await saveCurrencyData();

        res.json({
            success: true,
            newBalance: userCurrency.balance,
            rewardAmount: totalReward,
            streak: userCurrency.dailyStreak,
            message: `Получено ${totalReward} монет! Серия: ${userCurrency.dailyStreak} дней`
        });
        
    } catch (error) {
        console.error('❌ Daily reward error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения награды'
        });
    }
});
app.get('/api/user/:username', authenticateToken, (req, res) => {
    try {
        const { username } = req.params;
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const publicUserInfo = {
            username: user.username,
            avatar: user.avatar || '/default-avatar.png',
            createdAt: user.createdAt,
            isOnline: onlineUsers.has(username)
        };
        
        res.json(publicUserInfo);
    } catch (error) {
        console.error('❌ User info error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// Альтернативный endpoint для информации о пользователе
app.get('/api/users/:username', authenticateToken, (req, res) => {
    try {
        const { username } = req.params;
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const publicUserInfo = {
            username: user.username,
            avatar: user.avatar || '/default-avatar.png',
            registrationDate: user.createdAt,
            status: onlineUsers.has(username) ? 'online' : 'offline'
        };
        
        res.json(publicUserInfo);
    } catch (error) {
        console.error('❌ User info error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// Endpoint для проверки аватара
app.get('/api/user/:username/avatar', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const avatarPath = user.avatar || '/default-avatar.png';
        
        // Если это путь к файлу, отдаем файл
        if (avatarPath.startsWith('/uploads/avatars/')) {
            const fullPath = path.join(__dirname, avatarPath);
            try {
                await fs.access(fullPath);
                return res.sendFile(fullPath);
            } catch (error) {
                console.log(`Avatar file not found: ${fullPath}, using default`);
                return res.redirect('/default-avatar.png');
            }
        }
        
        // Если это URL, делаем редирект
        res.redirect(avatarPath);
        
    } catch (error) {
        console.error('❌ Avatar error:', error);
        res.redirect('/default-avatar.png');
    }
});
app.post('/api/currency/save', authenticateToken, async (req, res) => {
    try {
        const { username, balance, dailyStreak, lastDailyReward, transactionHistory } = req.body;
        
        console.log('💾 Saving currency data for:', username);
        
        if (req.user.username !== username && req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        if (!currencyData[username]) {
            currencyData[username] = {};
        }

        // Обновляем данные
        currencyData[username].balance = balance !== undefined ? balance : 0;
        currencyData[username].dailyStreak = dailyStreak !== undefined ? dailyStreak : 0;
        currencyData[username].lastDailyReward = lastDailyReward;
        currencyData[username].transactionHistory = transactionHistory || [];

        await saveCurrencyData();

        console.log('✅ Currency data saved for:', username, 'Balance:', currencyData[username].balance);
        
        res.json({ 
            success: true, 
            message: 'Данные валюты сохранены',
            balance: currencyData[username].balance
        });
        
    } catch (error) {
        console.error('❌ Currency save error:', error);
        res.status(500).json({ error: 'Ошибка сохранения данных валюты' });
    }
});
app.post('/api/currency/user/save', authenticateToken, async (req, res) => {
    try {
        const { username, balance, dailyStreak, lastDailyReward, transactionHistory } = req.body;
        
        console.log('💾 Saving currency data via user/save for:', username);
        
        if (req.user.username !== username && req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        if (!currencyData[username]) {
            currencyData[username] = {};
        }

        currencyData[username].balance = balance !== undefined ? balance : 0;
        currencyData[username].dailyStreak = dailyStreak !== undefined ? dailyStreak : 0;
        currencyData[username].lastDailyReward = lastDailyReward;
        currencyData[username].transactionHistory = transactionHistory || [];

        await saveCurrencyData();

        console.log('✅ Currency data saved via user/save for:', username);
        
        res.json({ 
            success: true, 
            message: 'Данные валюты сохранены',
            balance: currencyData[username].balance
        });
        
    } catch (error) {
        console.error('❌ Currency save error:', error);
        res.status(500).json({ error: 'Ошибка сохранения данных валюты' });
    }
});

app.post('/api/user/currency/save', authenticateToken, async (req, res) => {
    try {
        const { username, balance, dailyStreak, lastDailyReward, transactionHistory } = req.body;
        
        console.log('💾 Saving currency data via user/currency/save for:', username);
        
        if (req.user.username !== username && req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        if (!currencyData[username]) {
            currencyData[username] = {};
        }

        currencyData[username].balance = balance !== undefined ? balance : 0;
        currencyData[username].dailyStreak = dailyStreak !== undefined ? dailyStreak : 0;
        currencyData[username].lastDailyReward = lastDailyReward;
        currencyData[username].transactionHistory = transactionHistory || [];

        await saveCurrencyData();

        console.log('✅ Currency data saved via user/currency/save for:', username);
        
        res.json({ 
            success: true, 
            message: 'Данные валюты сохранены',
            balance: currencyData[username].balance
        });
        
    } catch (error) {
        console.error('❌ Currency save error:', error);
        res.status(500).json({ error: 'Ошибка сохранения данных валюты' });
    }
});

app.post('/api/user/currency/save', authenticateToken, async (req, res) => {
    try {
        const { username, balance, dailyStreak, lastDailyReward, transactionHistory } = req.body;
        
        if (req.user.username !== username && req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        if (!currencyData[username]) {
            currencyData[username] = {};
        }

        currencyData[username].balance = balance || 0;
        currencyData[username].dailyStreak = dailyStreak || 0;
        currencyData[username].lastDailyReward = lastDailyReward;
        currencyData[username].transactionHistory = transactionHistory || [];

        await saveCurrencyData();

        res.json({ success: true, message: 'Данные валюты сохранены' });
        
    } catch (error) {
        console.error('❌ Currency save error:', error);
        res.status(500).json({ error: 'Ошибка сохранения данных валюты' });
    }
});
app.post('/api/currency/reward/daily', authenticateToken, async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Имя пользователя обязательно'
            });
        }

        if (req.user.username !== username) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const userCurrency = initUserCurrency(username);
        const now = new Date();
        
        // Проверяем, можно ли получить награду
        if (userCurrency.lastDailyReward) {
            const lastReward = new Date(userCurrency.lastDailyReward);
            const hoursSinceLastReward = (now - lastReward) / (1000 * 60 * 60);
            
            if (hoursSinceLastReward < 23) {
                return res.status(400).json({
                    success: false,
                    error: 'Вы уже получали награду сегодня'
                });
            }
            
            // Проверяем серию (если прошло меньше 48 часов, увеличиваем серию)
            if (hoursSinceLastReward < 48) {
                userCurrency.dailyStreak += 1;
            } else {
                userCurrency.dailyStreak = 1; // Сбрасываем серию
            }
        } else {
            userCurrency.dailyStreak = 1; // Первая награда
        }

        // Расчет награды
        const baseReward = 50;
        const streakBonus = Math.min(userCurrency.dailyStreak * 5, 100);
        const totalReward = baseReward + streakBonus;
        
        // Обновляем баланс
        userCurrency.balance += totalReward;
        userCurrency.lastDailyReward = now.toISOString();
        
        // Добавляем в историю
        userCurrency.transactionHistory.unshift({
            type: 'daily_reward',
            amount: totalReward,
            description: `Ежедневная награда (серия: ${userCurrency.dailyStreak} дней)`,
            timestamp: now.toISOString()
        });
        
        if (userCurrency.transactionHistory.length > 50) {
            userCurrency.transactionHistory = userCurrency.transactionHistory.slice(0, 50);
        }
        
        await saveCurrencyData();

        res.json({
            success: true,
            newBalance: userCurrency.balance,
            rewardAmount: totalReward,
            streak: userCurrency.dailyStreak,
            message: `Получено ${totalReward} монет! Серия: ${userCurrency.dailyStreak} дней`
        });
        
    } catch (error) {
        console.error('❌ Daily reward error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения награды'
        });
    }
});
// В server.js, в API endpoints для валюты
app.post('/api/currency/add', authenticateToken, async (req, res) => {
    try {
        const { targetUser, amount, reason, admin } = req.body;
        
        if (req.user.username !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Недостаточно прав'
            });
        }
        
        if (!targetUser || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Пользователь и сумма обязательны'
            });
        }

        const userCurrency = initUserCurrency(targetUser);
        userCurrency.balance += amount;
        
        userCurrency.transactionHistory.unshift({
            type: 'admin_add',
            amount: amount,
            description: reason || 'Административное начисление',
            timestamp: new Date().toISOString(),
            admin: admin
        });
        
        await saveCurrencyData();

        // ОТПРАВЛЯЕМ СОБЫТИЕ ОБНОВЛЕНИЯ БАЛАНСА
        const targetSocketId = userSockets.get(targetUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('currency_balance_updated', {
                username: targetUser,
                balance: userCurrency.balance
            });
        }

        console.log(`Admin ${admin} added ${amount} currency to ${targetUser}. Reason: ${reason}`);
        
        res.json({
            success: true,
            message: `Добавлено ${amount} монет пользователю ${targetUser}`,
            targetUser: targetUser,
            amount: amount,
            reason: reason,
            newBalance: userCurrency.balance
        });
        
    } catch (error) {
        console.error('❌ Add currency error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка добавления валюты'
        });
    }
});
app.post('/api/currency/remove', authenticateToken, async (req, res) => {
    try {
        const { targetUser, amount, reason, admin } = req.body;
        
        if (req.user.username !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Недостаточно прав'
            });
        }
        
        if (!targetUser || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Пользователь и сумма обязательны'
            });
        }
        
        const userCurrency = initUserCurrency(targetUser);
        
        if (userCurrency.balance < amount) {
            return res.status(400).json({
                success: false,
                error: 'Недостаточно средств у пользователя'
            });
        }
        
        userCurrency.balance -= amount;
        
        // Добавляем в историю
        userCurrency.transactionHistory.unshift({
            type: 'admin_remove',
            amount: -amount,
            description: reason || 'Административное списание',
            timestamp: new Date().toISOString(),
            admin: admin
        });
        
        await saveCurrencyData();

        console.log(`Admin ${admin} removed ${amount} currency from ${targetUser}. Reason: ${reason}`);
        
        res.json({
            success: true,
            message: `Списано ${amount} монет у пользователя ${targetUser}`,
            targetUser: targetUser,
            amount: amount,
            reason: reason,
            newBalance: userCurrency.balance
        });
        
    } catch (error) {
        console.error('❌ Remove currency error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка списания валюты'
        });
    }
});

// Админ панель
app.get('/api/users/online', authenticateToken, (req, res) => {
    try {
        if (req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }
        
        const onlineUsersList = Array.from(onlineUsers).map(username => ({
            username: username,
            isOnline: true
        }));
        
        res.json(onlineUsersList);
    } catch (error) {
        console.error('❌ Error loading online users:', error);
        res.status(500).json({ error: 'Failed to load online users' });
    }
});

app.post('/api/admin/send-notification', authenticateToken, async (req, res) => {
    try {
        if (req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }

        const { title, message, type, targetUser, messageType, sender } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Сообщение обязательно' });
        }

        const notificationData = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: title || 'Системное уведомление',
            message: message,
            type: messageType || 'info',
            sender: sender || 'Администратор',
            target: type || 'all',
            targetUser: targetUser || null,
            timestamp: new Date().toLocaleTimeString(),
            date: new Date().toISOString(),
            isSystem: true
        };

        systemNotifications.push(notificationData);
        
        if (systemNotifications.length > 1000) {
            systemNotifications = systemNotifications.slice(-500);
        }

        if (notificationData.target === 'all') {
            io.emit('system_notification', notificationData);
        } else if (notificationData.target === 'user' && notificationData.targetUser) {
            const targetSocketId = userSockets.get(notificationData.targetUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('system_notification', notificationData);
            }
        }

        io.emit('notifications_updated');

        console.log(`✅ Admin notification sent: ${notificationData.title}`);
        
        res.json({ 
            success: true,
            message: 'Уведомление отправлено'
        });
        
    } catch (error) {
        console.error('❌ Admin notification error:', error);
        res.status(500).json({ error: 'Ошибка отправки уведомления: ' + error.message });
    }
});
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        users: users.length,
        messages: messages.length,
        groups: groups.length,
        onlineUsers: onlineUsers.size,
        notifications: systemNotifications.length,
        currencyUsers: Object.keys(currencyData).length,
        giftsUsers: Object.keys(giftsData).length // ← Добавьте эту строку
    });
});

// Базовый маршрут для групп
app.get('/api/groups', authenticateToken, (req, res) => {
    try {
        const currentUser = req.user.username;
        const userGroups = groups.filter(group => 
            group.members && group.members.includes(currentUser)
        );
        res.json(userGroups);
    } catch (error) {
        console.error('❌ Groups error:', error);
        res.status(500).json({ error: 'Failed to load groups' });
    }
});

// Обработка default-avatar.png
app.get('/default-avatar.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'default-avatar.png'));
});

// Fallback для всех остальных маршрутов
app.use((req, res, next) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Route not found' });
});

// Обработчик ошибок
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});
// В server.js добавляем новые API endpoints

// API для подарков
app.get('/api/user/gifts', authenticateToken, async (req, res) => {
    try {
        // Загрузка данных о подарках пользователей
        const giftsData = await loadGiftsData();
        res.json(giftsData);
    } catch (error) {
        console.error('❌ Gifts data error:', error);
        res.status(500).json({ error: 'Ошибка загрузки данных подарков' });
    }
});

app.post('/api/gifts/buy', authenticateToken, async (req, res) => {
    try {
        const { username, giftId, giftName, price } = req.body;
        
        if (req.user.username !== username) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        // Проверяем баланс
        const userCurrency = initUserCurrency(username);
        if (userCurrency.balance < price) {
            return res.status(400).json({
                success: false,
                error: 'Недостаточно монет'
            });
        }

        // Проверяем, есть ли уже такой подарок
        const userGifts = await getUserGifts(username);
        const alreadyOwned = userGifts.some(gift => gift.id === giftId);
        
        if (alreadyOwned) {
            return res.status(400).json({
                success: false,
                error: 'У вас уже есть этот подарок'
            });
        }

        // Списание средств
        userCurrency.balance -= price;
        
        // Добавляем запись в историю
        userCurrency.transactionHistory.unshift({
            type: 'gift_purchase',
            amount: -price,
            description: `Покупка подарка: ${giftName}`,
            timestamp: new Date().toISOString()
        });

        // Сохраняем подарок
        userGifts.push({
            id: giftId,
            name: giftName,
            purchaseDate: new Date().toISOString(),
            price: price
        });

        await saveUserGifts(username, userGifts);
        await saveCurrencyData();

        res.json({
            success: true,
            message: `Подарок "${giftName}" успешно куплен!`,
            newBalance: userCurrency.balance,
            gift: userGifts[userGifts.length - 1]
        });

    } catch (error) {
        console.error('❌ Gift purchase error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка покупки подарка'
        });
    }
});

// API для профилей
app.get('/api/user/profiles', authenticateToken, async (req, res) => {
    try {
        const profilesData = await loadProfilesData();
        res.json(profilesData);
    } catch (error) {
        console.error('❌ Profiles data error:', error);
        res.status(500).json({ error: 'Ошибка загрузки данных профилей' });
    }
});

app.get('/api/user/:username/profile', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        const profile = await getUserProfile(username);
        
        if (!profile) {
            // Создаем базовый профиль
            const user = users.find(u => u.username === username);
            if (!user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            
            const newProfile = {
                username: username,
                avatar: user.avatar || '/default-avatar.png',
                registrationDate: user.createdAt || new Date().toISOString(),
                gifts: [],
                stats: {
                    messagesSent: messages.filter(m => m.sender === username).length,
                    groupsCreated: groups.filter(g => g.createdBy === username).length,
                    daysActive: 1
                },
                bio: '',
                status: 'online'
            };
            
            await saveUserProfile(username, newProfile);
            res.json(newProfile);
        } else {
            res.json(profile);
        }
        
    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({ error: 'Ошибка загрузки профиля' });
    }
});

app.post('/api/user/profile/bio', authenticateToken, async (req, res) => {
    try {
        const { username, bio } = req.body;
        
        if (req.user.username !== username) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const profile = await getUserProfile(username);
        if (!profile) {
            return res.status(404).json({ error: 'Профиль не найден' });
        }

        profile.bio = bio;
        await saveUserProfile(username, profile);

        res.json({ success: true, message: 'Информация обновлена' });
        
    } catch (error) {
        console.error('❌ Bio update error:', error);
        res.status(500).json({ error: 'Ошибка обновления информации' });
    }
});
// API для подарков
app.get('/api/user/gifts', authenticateToken, async (req, res) => {
    try {
        // Здесь должна быть логика загрузки подарков пользователя
        res.json([]);
    } catch (error) {
        console.error('❌ Gifts data error:', error);
        res.status(500).json({ error: 'Ошибка загрузки данных подарков' });
    }
});

app.post('/api/gifts/buy', authenticateToken, async (req, res) => {
    try {
        const { username, giftId, giftName, price } = req.body;
        
        if (req.user.username !== username) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        // Здесь должна быть логика покупки подарка
        res.json({
            success: true,
            message: `Подарок "${giftName}" успешно куплен!`
        });

    } catch (error) {
        console.error('❌ Gift purchase error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка покупки подарка'
        });
    }
});

// API для профилей
app.get('/api/user/profiles', authenticateToken, async (req, res) => {
    try {
        // Здесь должна быть логика загрузки профилей
        res.json([]);
    } catch (error) {
        console.error('❌ Profiles data error:', error);
        res.status(500).json({ error: 'Ошибка загрузки данных профилей' });
    }
});

app.get('/api/user/:username/profile', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Здесь должна быть логика загрузки профиля
        const profile = {
            username: username,
            avatar: '/default-avatar.png',
            registrationDate: new Date().toISOString(),
            gifts: [],
            stats: {
                messagesSent: 0,
                groupsCreated: 0,
                daysActive: 1
            },
            bio: '',
            status: 'online'
        };
        
        res.json(profile);
        
    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({ error: 'Ошибка загрузки профиля' });
    }
});

app.post('/api/user/profile/bio', authenticateToken, async (req, res) => {
    try {
        const { username, bio } = req.body;
        
        if (req.user.username !== username) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        // Здесь должна быть логика обновления био
        res.json({ success: true, message: 'Информация обновлена' });
        
    } catch (error) {
        console.error('❌ Bio update error:', error);
        res.status(500).json({ error: 'Ошибка обновления информации' });
    }
});
app.get('/api/user/:username/gifts', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        
        if (req.user.username !== username && req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        // Здесь должна быть логика загрузки подарков пользователя из базы данных
        const userGifts = []; // Заглушка - в реальном приложении загружаем из БД
        
        res.json(userGifts);
        
    } catch (error) {
        console.error('❌ User gifts error:', error);
        res.status(500).json({ error: 'Ошибка загрузки подарков' });
    }
});
// Socket.io логика
io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
    });

    socket.on('disconnect', (reason) => {
        console.log('⚠️ User disconnected:', socket.id, 'Reason:', reason);
        if (socket.username) {
            userSockets.delete(socket.username);
            onlineUsers.delete(socket.username);
            
            if (activeCalls.has(socket.username)) {
                const callData = activeCalls.get(socket.username);
                activeCalls.delete(socket.username);
                
                if (callData.participants) {
                    callData.participants.forEach(participant => {
                        const participantSocket = userSockets.get(participant);
                        if (participantSocket) {
                            io.to(participantSocket).emit('call_ended', {
                                callId: callData.callId,
                                reason: 'Участник покинул чат',
                                endedBy: socket.username
                            });
                        }
                    });
                }
            }
            
            if (screenShares.has(socket.username)) {
                screenShares.delete(socket.username);
            }
            
            io.emit('user-status-changed', {
                username: socket.username,
                isOnline: false
            });
            
            console.log(`👋 User ${socket.username} disconnected`);
        }
    });
 socket.on('gift_sent', (data) => {
    const receiverSocketId = userSockets.get(data.receiver);
    if (receiverSocketId) {
        io.to(receiverSocketId).emit('gift_received', {
            sender: data.sender,
            gift: data.gift,
            timestamp: data.timestamp
        });
    }
    
    // Отправляем уведомление отправителю
    socket.emit('gift_sent_success', {
        receiver: data.receiver,
        gift: data.gift,
        timestamp: data.timestamp
    });
    
    console.log(`🎁 Gift sent: ${data.sender} -> ${data.receiver} (${data.gift.name})`);
});
    socket.on('user authenticated', (username) => {
        console.log('🔐 User authenticated:', username, 'Socket ID:', socket.id);
        userSockets.set(username, socket.id);
        onlineUsers.add(username);
        socket.username = username;
        
        io.emit('user-status-changed', {
            username: username,
            isOnline: true
        });
        
        socket.emit('online_users', {
            users: Array.from(onlineUsers)
        });
    });

    socket.on('private message', (data) => {
        try {
            const isDuplicate = messages.some(msg => 
                msg.type === 'private' &&
                msg.sender === data.sender &&
                msg.receiver === data.receiver &&
                msg.message === data.message &&
                new Date() - new Date(msg.date) < 1000
            );

            if (isDuplicate) {
                console.log('⚠️ Duplicate message detected, skipping');
                return;
            }

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
            
            console.log(`📨 Private message from ${data.sender} to ${data.receiver}`);
        } catch (error) {
            console.error('❌ Private message error:', error);
            socket.emit('error', { message: 'Failed to send private message' });
        }
    });

    // Обработчики групповых сообщений
    socket.on('group_message', (data) => {
        try {
            const group = groups.find(g => g.id === data.groupId);
            if (!group || !group.members.includes(data.sender)) {
                socket.emit('error', { message: 'Доступ запрещен' });
                return;
            }

            const messageData = {
                id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                sender: data.sender,
                groupId: data.groupId,
                message: data.message,
                timestamp: new Date().toLocaleTimeString(),
                type: 'group',
                date: new Date().toISOString(),
                messageType: data.messageType || 'text',
                fileData: data.fileData || null
            };
            
            messages.push(messageData);
            saveMessages();

            group.members.forEach(member => {
                const memberSocketId = userSockets.get(member);
                if (memberSocketId) {
                    io.to(memberSocketId).emit('group_message', messageData);
                }
            });

            io.emit('conversations updated');
            
            console.log(`📨 Group message in ${group.name} from ${data.sender} to ${group.members.length} members`);
            
        } catch (error) {
            console.error('❌ Group message error:', error);
            socket.emit('error', { message: 'Failed to send group message' });
        }
    });

    // Обработчики обновлений групп
    socket.on('group_created', (data) => {
        console.log(`👥 Group created event: ${data.group.name}`);
        data.group.members.forEach(member => {
            const memberSocketId = userSockets.get(member);
            if (memberSocketId) {
                io.to(memberSocketId).emit('group_created', data);
            }
        });
    });

    // Обработчики звонков
    socket.on('initiate_call', (data) => {
        const targetSocketId = userSockets.get(data.targetUser);
        if (targetSocketId) {
            activeCalls.set(data.caller, {
                callId: data.callId,
                participants: [data.caller, data.targetUser],
                type: data.callType,
                startTime: new Date().toISOString()
            });
            
            io.to(targetSocketId).emit('incoming_call', {
                callId: data.callId,
                caller: data.caller,
                callType: data.callType,
                timestamp: new Date().toISOString()
            });
            
            console.log(`📞 Call initiated: ${data.caller} -> ${data.targetUser} (${data.callType})`);
        } else {
            socket.emit('call_rejected', {
                callId: data.callId,
                reason: 'Пользователь не в сети'
            });
        }
    });

    socket.on('accept_call', (data) => {
        const callerSocketId = userSockets.get(data.caller);
        if (callerSocketId) {
            const callData = activeCalls.get(data.caller);
            if (callData) {
                callData.participants.push(data.acceptor);
                activeCalls.set(data.caller, callData);
            }
            
            io.to(callerSocketId).emit('call_accepted', {
                callId: data.callId,
                acceptor: socket.username
            });
            
            console.log(`✅ Call accepted: ${data.acceptor} accepted call from ${data.caller}`);
        }
    });

    socket.on('reject_call', (data) => {
        const callerSocketId = userSockets.get(data.caller);
        if (callerSocketId) {
            activeCalls.delete(data.caller);
            
            io.to(callerSocketId).emit('call_rejected', {
                callId: data.callId,
                reason: data.reason
            });
            
            console.log(`❌ Call rejected: ${socket.username} rejected call from ${data.caller}`);
        }
    });

    socket.on('end_call', (data) => {
        activeCalls.delete(socket.username);
        
        io.emit('call_ended', {
            callId: data.callId,
            reason: data.reason,
            endedBy: socket.username
        });
        
        console.log(`📞 Call ended: ${socket.username} ended call ${data.callId}`);
    });
socket.on('send_gift', async (data) => {
    try {
        const { sender, receiver, gift, messageId } = data;
        
        // Сохраняем в базе данных
        await saveGiftTransaction({
            sender,
            receiver, 
            giftId: gift.id,
            giftName: gift.name,
            giftType: gift.type,
            messageId,
            timestamp: new Date()
        });
        
        // Отправляем уведомление получателю
        socket.to(receiver).emit('gift_received', {
            sender,
            gift,
            messageId,
            timestamp: new Date()
        });
        
        // Подтверждаем отправителю
        socket.emit('gift_sent', {
            receiver,
            gift,
            messageId,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Error processing gift:', error);
        socket.emit('gift_error', {
            error: 'Ошибка отправки подарка'
        });
    }
});
    // WebRTC сигналы
    socket.on('webrtc_offer', (data) => {
        const targetSocketId = userSockets.get(data.targetUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc_offer', {
                callId: data.callId,
                offer: data.offer,
                caller: socket.username
            });
        }
    });

    socket.on('webrtc_answer', (data) => {
        const targetSocketId = userSockets.get(data.targetUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc_answer', {
                callId: data.callId,
                answer: data.answer,
                answerer: socket.username
            });
        }
    });

    socket.on('webrtc_ice_candidate', (data) => {
        const targetSocketId = userSockets.get(data.targetUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc_ice_candidate', {
                callId: data.callId,
                candidate: data.candidate,
                sender: socket.username
            });
        }
    });

    // Трансляция экрана
    socket.on('screen_share_started', (data) => {
        const targetSocketId = userSockets.get(data.targetUser);
        if (targetSocketId) {
            screenShares.set(socket.username, {
                targetUser: data.targetUser,
                callId: data.callId,
                startTime: new Date().toISOString()
            });
            
            io.to(targetSocketId).emit('screen_share_started', {
                callId: data.callId,
                sharer: socket.username
            });
            
            console.log(`🖥️ Screen share started: ${socket.username} -> ${data.targetUser}`);
        }
    });

    socket.on('screen_share_ended', (data) => {
        const targetSocketId = userSockets.get(data.targetUser);
        if (targetSocketId) {
            screenShares.delete(socket.username);
            
            io.to(targetSocketId).emit('screen_share_ended', {
                callId: data.callId,
                sharer: socket.username
            });
            
            console.log(`🖥️ Screen share ended: ${socket.username} -> ${data.targetUser}`);
        }
    });

    // Системные уведомления
    socket.on('system_notification', (data) => {
        const notificationData = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: data.title || 'Системное уведомление',
            message: data.message,
            type: data.type || 'info',
            sender: data.sender || 'Система',
            timestamp: new Date().toLocaleTimeString(),
            date: new Date().toISOString(),
            isSystem: true
        };

        systemNotifications.push(notificationData);
        
        if (systemNotifications.length > 1000) {
            systemNotifications = systemNotifications.slice(-500);
        }

        io.emit('system_notification', notificationData);
        
        console.log(`📢 System notification: ${notificationData.title}`);
    });

    // Обновление аватара
    socket.on('user_avatar_updated', (data) => {
        io.emit('user_avatar_updated', data);
    });

    // Ping для проверки соединения
    socket.on('ping', (cb) => {
        if (typeof cb === 'function') {
            cb('pong');
        }
    });

    // Запрос списка онлайн пользователей
    socket.on('get_online_users', (cb) => {
        if (typeof cb === 'function') {
            cb(Array.from(onlineUsers));
        }
    });
});
// Загрузка данных подарков
async function loadGiftsData() {
    try {
        const data = await fs.readFile(path.join(dataDir, 'gifts.json'), 'utf8');
        giftsData = JSON.parse(data);
        console.log('✅ Gifts data loaded:', Object.keys(giftsData).length);
    } catch (error) {
        giftsData = {};
        await saveGiftsData();
    }
}

// Сохранение данных подарков
async function saveGiftsData() {
    try {
        await fs.writeFile(path.join(dataDir, 'gifts.json'), JSON.stringify(giftsData, null, 2));
    } catch (error) {
        console.error('❌ Error saving gifts data:', error);
    }
}

// Инициализация подарков пользователя
function initUserGifts(username) {
    if (!giftsData[username]) {
        giftsData[username] = {
            received: [],
            sent: []
        };
    }
    return giftsData[username];
}

// Получение подарков пользователя
function getUserGifts(username) {
    return giftsData[username] || { received: [], sent: [] };
}
// Запуск сервера
async function startServer() {
    try {
        await ensureDirectories();
        await ensureStaticFiles();
        await ensureTemplates();
        await loadUsers();
        await loadMessages();
        await loadGroups();
        await loadCurrencyData();
         await loadGiftsData(); 
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`💾 Data directory: ${dataDir}`);
            console.log(`📁 Uploads directory: ${uploadsDir}`);
            console.log(`👤 Avatars directory: ${avatarsDir}`);
            console.log(`👥 Groups loaded: ${groups.length}`);
            console.log(`💰 Currency users: ${Object.keys(currencyData).length}`);
            console.log(`💬 Active features: Private Chat, Group Chat, Voice/Video Calls, Screen Sharing, File Sharing, Avatars, Currency System`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();