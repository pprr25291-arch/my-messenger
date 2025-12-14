// server.js - Сервер мессенджера с автосохранением каждые 30 секунд
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
const MegaStorage = require('./mega-storage');
const TelegramStorage = require('./telegram-storage');
const { exec } = require('child_process');
const os = require('os');

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

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
let PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(__dirname, 'uploads', 'avatars');

let users = [];
let messages = [];
let systemNotifications = [];
let groups = [];
const userSockets = new Map();
const onlineUsers = new Set();
const activeCalls = new Map();
const screenShares = new Map();
let currencyData = {};
let giftsData = {};

let megaStorage = null;
let telegramStorage = null;
let megaSyncInterval = null;
let autoSaveInterval = null;

// Функция для освобождения порта
function killPort(port) {
    return new Promise((resolve) => {
        console.log(`🔍 Checking port ${port}...`);
        
        if (os.platform() === 'win32') {
            exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
                if (err || !stdout) {
                    console.log(`✅ Port ${port} is free`);
                    resolve(false);
                    return;
                }
                
                const lines = stdout.trim().split('\n');
                let killed = false;
                
                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid && !isNaN(pid)) {
                        exec(`taskkill /F /PID ${pid}`, (err) => {
                            if (!err) {
                                console.log(`✅ Killed process ${pid} on port ${port}`);
                                killed = true;
                            }
                        });
                    }
                });
                
                setTimeout(() => {
                    resolve(killed);
                }, 1000);
            });
        } else {
            // Linux/Mac
            exec(`lsof -ti:${port}`, (err, stdout) => {
                if (err || !stdout) {
                    console.log(`✅ Port ${port} is free`);
                    resolve(false);
                    return;
                }
                
                const pids = stdout.trim().split('\n');
                let killed = false;
                
                pids.forEach(pid => {
                    if (pid && !isNaN(pid)) {
                        exec(`kill -9 ${pid}`, (err) => {
                            if (!err) {
                                console.log(`✅ Killed process ${pid} on port ${port}`);
                                killed = true;
                            }
                        });
                    }
                });
                
                setTimeout(() => {
                    resolve(killed);
                }, 1000);
            });
        }
    });
}

// Функция для поиска свободного порта
async function findFreePort(startPort, maxAttempts = 10) {
    let port = startPort;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
            const inUse = await isPortInUse(port);
            
            if (!inUse) {
                console.log(`✅ Found free port: ${port}`);
                return port;
            }
            
            console.log(`⚠️ Port ${port} is busy, trying ${port + 1}`);
            port++;
            attempts++;
            
        } catch (error) {
            console.log(`❌ Error checking port ${port}: ${error.message}`);
            port++;
            attempts++;
        }
    }
    
    throw new Error(`Could not find free port after ${maxAttempts} attempts`);
}

// Функция проверки занятости порта
function isPortInUse(port) {
    return new Promise((resolve) => {
        const tester = require('net').createServer()
            .once('error', () => {
                resolve(true);
            })
            .once('listening', () => {
                tester.once('close', () => {
                    resolve(false);
                }).close();
            })
            .listen(port);
    });
}

// Функция для очистки старых файлов в uploads
async function cleanupOldUploads() {
    try {
        if (!fs.existsSync(uploadsDir)) {
            return { deleted: 0, skipped: 0 };
        }
        
        const files = await fs.readdir(uploadsDir);
        const now = Date.now();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        let deleted = 0;
        let skipped = 0;
        
        for (const file of files) {
            // Пропускаем аватары и системные файлы
            if (file.includes('avatar_') || file === '.gitkeep' || file === 'avatars') {
                skipped++;
                continue;
            }
            
            const filePath = path.join(uploadsDir, file);
            try {
                const stats = await fs.stat(filePath);
                
                // Удаляем файлы старше 7 дней
                if (stats.mtimeMs < oneWeekAgo) {
                    await fs.unlink(filePath);
                    deleted++;
                    console.log(`🗑️ Deleted old file: ${file}`);
                } else {
                    skipped++;
                }
            } catch (error) {
                console.error(`❌ Error processing file ${file}:`, error.message);
                skipped++;
            }
        }
        
        console.log(`✅ Cleanup completed: ${deleted} deleted, ${skipped} skipped`);
        return { deleted, skipped };
        
    } catch (error) {
        console.error('❌ Error cleaning up uploads:', error.message);
        return { deleted: 0, skipped: 0, error: error.message };
    }
}

// Функция для очистки дубликатов сообщений
function removeDuplicateMessages(messagesArray) {
    const uniqueMessages = [];
    const seenMessages = new Set();
    
    for (const msg of messagesArray) {
        const msgKey = `${msg.sender}|${msg.receiver || msg.groupId}|${msg.message}|${msg.date}`;
        if (!seenMessages.has(msgKey)) {
            seenMessages.add(msgKey);
            uniqueMessages.push(msg);
        }
    }
    
    return uniqueMessages;
}

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

async function cleanupUserAvatars(username) {
    try {
        if (!fs.existsSync(avatarsDir)) {
            console.log(`📁 Avatar directory does not exist: ${avatarsDir}`);
            return;
        }
        
        const files = await fs.readdir(avatarsDir);
        const userAvatarPattern = new RegExp(`^avatar_${username}_\\d+\\.[a-zA-Z]+$`);
        
        console.log(`🗑️ Looking for old avatars for user: ${username}`);
        console.log(`📂 Files in avatars directory: ${files.length}`);
        
        let deletedCount = 0;
        
        for (const file of files) {
            if (file.startsWith(`avatar_${username}_`)) {
                const filePath = path.join(avatarsDir, file);
                try {
                    await fs.unlink(filePath);
                    deletedCount++;
                    console.log(`🗑️ Deleted old avatar: ${file}`);
                } catch (error) {
                    console.error(`❌ Error deleting file ${file}:`, error.message);
                }
            }
        }
        
        console.log(`✅ Cleaned up ${deletedCount} old avatars for user ${username}`);
        
    } catch (error) {
        console.error('❌ Error cleaning up user avatars:', error.message);
    }
}

// Функция для сохранения всех данных
async function saveAllData() {
    try {
        console.log('💾 Auto-saving all data...');
        
        // Сохраняем все данные последовательно
        await saveUsers();
        await saveMessages();
        await saveGroups();
        await saveCurrencyData();
        await saveGiftsData();
        
        console.log('✅ All data auto-saved');
        return true;
    } catch (error) {
        console.error('❌ Error auto-saving data:', error.message);
        return false;
    }
}

// Запуск автоматического сохранения данных
async function startAutoSave() {
    console.log('⏰ Starting auto-save every 30 seconds');
    
    // Сохраняем сразу при старте
    await saveAllData();
    
    // Устанавливаем интервал сохранения
    autoSaveInterval = setInterval(async () => {
        try {
            await saveAllData();
        } catch (error) {
            console.error('❌ Error in auto-save:', error.message);
        }
    }, 30 * 1000); // 30 секунд
    
    return autoSaveInterval;
}

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

async function loadUsers() {
    try {
        const data = await fs.readFile(path.join(dataDir, 'users.json'), 'utf8');
        users = JSON.parse(data);
        console.log('✅ Users loaded:', users.length);
    } catch (error) {
        console.log('⚠️ No users found, starting with empty array');
        users = [];
        await saveUsers();
    }
}

async function loadMessages() {
    try {
        const data = await fs.readFile(path.join(dataDir, 'messages.json'), 'utf8');
        const loadedMessages = JSON.parse(data);
        
        // Удаляем дубликаты сообщений
        messages = removeDuplicateMessages(loadedMessages);
        
        const duplicatesRemoved = loadedMessages.length - messages.length;
        if (duplicatesRemoved > 0) {
            console.log(`✅ Messages loaded: ${messages.length} (removed ${duplicatesRemoved} duplicates)`);
            
            // Сохраняем очищенные данные
            await saveMessages();
        } else {
            console.log('✅ Messages loaded:', messages.length);
        }
    } catch (error) {
        console.log('⚠️ No messages found, starting with empty array');
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

async function loadGiftsData() {
    try {
        const data = await fs.readFile(path.join(dataDir, 'gifts.json'), 'utf8');
        giftsData = JSON.parse(data);
        console.log('✅ Gifts data loaded');
    } catch (error) {
        giftsData = {};
        await saveGiftsData();
    }
}

async function saveUsers() {
    try {
        const filePath = path.join(dataDir, 'users.json');
        const usersData = JSON.stringify(users, null, 2);
        
        // Всегда перезаписываем файл
        await fs.writeFile(filePath, usersData);
        console.log('✅ Users saved locally');
        
        // Синхронизация с MEGA (если подключено)
        if (megaStorage?.isInitialized && !megaStorage.syncInProgress) {
            try {
                const result = await megaStorage.uploadFile(filePath, 'users.json');
                if (result && result.uploaded) {
                    console.log(`✅ Users ${result.updated ? 'updated' : 'uploaded'} to MEGA`);
                }
            } catch (syncError) {
                console.error('⚠️ MEGA sync error for users:', syncError.message);
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error saving users:', error.message);
        return false;
    }
}

async function saveMessages() {
    try {
        const filePath = path.join(dataDir, 'messages.json');
        const messagesData = JSON.stringify(messages, null, 2);
        
        // Всегда перезаписываем файл
        await fs.writeFile(filePath, messagesData);
        console.log('✅ Messages saved locally');
        
        // Синхронизация с MEGA (если подключено)
        if (megaStorage?.isInitialized && !megaStorage.syncInProgress) {
            try {
                const result = await megaStorage.uploadFile(filePath, 'messages.json');
                if (result && result.uploaded) {
                    console.log(`✅ Messages ${result.updated ? 'updated' : 'uploaded'} to MEGA`);
                }
            } catch (syncError) {
                console.error('⚠️ MEGA sync error for messages:', syncError.message);
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error saving messages:', error.message);
        return false;
    }
}

async function saveGroups() {
    try {
        const filePath = path.join(dataDir, 'groups.json');
        const groupsData = JSON.stringify(groups, null, 2);
        
        // Всегда перезаписываем файл
        await fs.writeFile(filePath, groupsData);
        console.log('✅ Groups saved locally');
        
        // Синхронизация с MEGA (если подключено)
        if (megaStorage?.isInitialized && !megaStorage.syncInProgress) {
            try {
                const result = await megaStorage.uploadFile(filePath, 'groups.json');
                if (result && result.uploaded) {
                    console.log(`✅ Groups ${result.updated ? 'updated' : 'uploaded'} to MEGA`);
                }
            } catch (syncError) {
                console.error('⚠️ MEGA sync error for groups:', syncError.message);
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error saving groups:', error.message);
        return false;
    }
}

async function saveCurrencyData() {
    try {
        const filePath = path.join(dataDir, 'currency.json');
        const currencyDataStr = JSON.stringify(currencyData, null, 2);
        
        // Всегда перезаписываем файл
        await fs.writeFile(filePath, currencyDataStr);
        console.log('✅ Currency data saved locally');
        
        // Синхронизация с MEGA (если подключено)
        if (megaStorage?.isInitialized && !megaStorage.syncInProgress) {
            try {
                const result = await megaStorage.uploadFile(filePath, 'currency.json');
                if (result && result.uploaded) {
                    console.log(`✅ Currency data ${result.updated ? 'updated' : 'uploaded'} to MEGA`);
                }
            } catch (syncError) {
                console.error('⚠️ MEGA sync error for currency data:', syncError.message);
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error saving currency data:', error.message);
        return false;
    }
}

async function saveGiftsData() {
    try {
        const filePath = path.join(dataDir, 'gifts.json');
        const giftsDataStr = JSON.stringify(giftsData, null, 2);
        
        // Всегда перезаписываем файл
        await fs.writeFile(filePath, giftsDataStr);
        console.log('✅ Gifts data saved locally');
        
        // Синхронизация с MEGA (если подключено)
        if (megaStorage?.isInitialized && !megaStorage.syncInProgress) {
            try {
                const result = await megaStorage.uploadFile(filePath, 'gifts.json');
                if (result && result.uploaded) {
                    console.log(`✅ Gifts data ${result.updated ? 'updated' : 'uploaded'} to MEGA`);
                }
            } catch (syncError) {
                console.error('⚠️ MEGA sync error for gifts data:', syncError.message);
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error saving gifts data:', error.message);
        return false;
    }
}

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

function initUserGifts(username) {
    if (!giftsData[username]) {
        giftsData[username] = {
            received: [],
            sent: []
        };
    }
    return giftsData[username];
}

function getUserGifts(username) {
    return giftsData[username] || { received: [], sent: [] };
}

function authenticateToken(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

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
            const { createCanvas } = require('canvas');
            const canvas = createCanvas(200, 200);
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 200, 200);
            gradient.addColorStop(0, '#4facfe');
            gradient.addColorStop(1, '#00f2fe');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 200, 200);
            
            ctx.beginPath();
            ctx.arc(100, 100, 80, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(100, 70, 30, 0, Math.PI * 2);
            ctx.fillStyle = '#4facfe';
            ctx.fill();
            
            ctx.beginPath();
            ctx.rect(70, 100, 60, 50);
            ctx.fillStyle = '#4facfe';
            ctx.fill();
            
            const buffer = canvas.toBuffer('image/png');
            await fs.writeFile(avatarPath, buffer);
            console.log('✅ Created default-avatar.png');
        }
    } catch (error) {
        console.error('❌ Error creating static files:', error);
    }
}

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
        
        const newUser = { 
            username, 
            password: hashedPassword,
            avatar: '/default-avatar.png',
            createdAt: new Date().toISOString()
        };
        
        if (req.file) {
            try {
                await cleanupUserAvatars(username);
                
                const uniqueName = `avatar_${username}_${Date.now()}${path.extname(req.file.originalname)}`;
                const newAvatarPath = path.join(avatarsDir, uniqueName);
                
                await fs.rename(req.file.path, newAvatarPath);
                
                newUser.avatar = `/uploads/avatars/${uniqueName}`;
            } catch (avatarError) {
                console.error('Avatar processing error:', avatarError);
            }
        }
        
        users.push(newUser);
        await saveUsers();
        
        if (!currencyData[username]) {
            currencyData[username] = {
                balance: 100,
                dailyStreak: 0,
                lastDailyReward: null,
                transactionHistory: []
            };
            await saveCurrencyData();
        }
        
        if (!giftsData[username]) {
            giftsData[username] = {
                received: [],
                sent: []
            };
            await saveGiftsData();
        }

        const token = jwt.sign({ username }, JWT_SECRET);
        
        res.cookie('token', token, { 
            httpOnly: true, 
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'strict'
        });
        
        res.json({ 
            success: true, 
            token,
            user: {
                username: newUser.username,
                avatar: newUser.avatar
            }
        });
        
    } catch (error) {
        console.error('❌ Registration error details:', error);
        res.status(500).json({ 
            error: 'Registration failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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

app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        // Проверяем размер файла
        const maxSize = 50 * 1024 * 1024;
        if (req.file.size > maxSize) {
            await fs.unlink(req.file.path).catch(console.error);
            return res.status(400).json({ error: 'Файл слишком большой (макс. 50MB)' });
        }

        // Проверяем, не существует ли уже такой файл
        const existingFiles = await fs.readdir(uploadsDir);
        const existingFile = existingFiles.find(f => {
            if (f === req.file.filename) return false; // Это тот же файл
            const stats = fs.statSync(path.join(uploadsDir, f));
            return stats.size === req.file.size && 
                   path.extname(f) === path.extname(req.file.originalname);
        });
        
        if (existingFile) {
            // Если файл уже существует, используем существующий
            await fs.unlink(req.file.path).catch(console.error);
            
            const fileResponse = {
                success: true,
                file: {
                    originalName: req.file.originalname,
                    filename: existingFile,
                    path: `/uploads/${existingFile}`,
                    size: req.file.size,
                    mimetype: req.file.mimetype,
                    uploadDate: new Date().toISOString(),
                    reused: true
                }
            };
            
            return res.json(fileResponse);
        }

        let thumbnailPath = null;
        let telegramFileData = null;
        
        if (telegramStorage?.isInitialized) {
            try {
                telegramFileData = await telegramStorage.uploadFile(
                    req.file.path,
                    `File: ${req.file.originalname}`
                );
                
                if (telegramFileData) {
                    console.log(`✅ Media uploaded to Telegram: ${req.file.originalname}`);
                }
            } catch (telegramError) {
                console.error('⚠️ Telegram upload failed:', telegramError.message);
            }
        }

        if (req.file.mimetype.startsWith('image/')) {
            try {
                const thumbnailFilename = `thumb_${req.file.filename}`;
                const thumbnailFullPath = path.join(uploadsDir, thumbnailFilename);
                
                await sharp(req.file.path)
                    .resize(200, 200, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 80 })
                    .toFile(thumbnailFullPath);
                
                thumbnailPath = `/uploads/${thumbnailFilename}`;
                
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
                uploadDate: new Date().toISOString(),
                reused: false
            }
        };

        if (telegramFileData) {
            const directUrl = await telegramStorage.getDirectFileUrl(telegramFileData.file_id);
            fileResponse.telegram = {
                file_id: telegramFileData.file_id,
                message_id: telegramFileData.message_id,
                media_type: telegramFileData.media_type || 'document',
                telegram_url: directUrl,
                file_url: `/api/media/${telegramFileData.file_id}`
            };
        }

        res.json(fileResponse);

    } catch (error) {
        console.error('❌ Upload error:', error);
        
        if (req.file) {
            await fs.unlink(req.file.path).catch(console.error);
        }
        
        res.status(500).json({ error: 'Ошибка загрузки файла: ' + error.message });
    }
});

app.get('/api/media/:fileId', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        
        if (!telegramStorage?.isInitialized) {
            return res.status(503).json({ error: 'Telegram storage not available' });
        }

        const directUrl = await telegramStorage.getDirectFileUrl(fileId);
        
        if (directUrl) {
            res.redirect(directUrl);
        } else {
            res.status(404).json({ error: 'File not found in Telegram' });
        }
        
    } catch (error) {
        console.error('❌ Media error:', error);
        res.status(500).json({ error: 'Failed to get media' });
    }
});

app.post('/api/upload-voice', authenticateToken, voiceUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        let telegramFileData = null;
        
        if (telegramStorage?.isInitialized) {
            try {
                telegramFileData = await telegramStorage.uploadFile(
                    req.file.path,
                    `Voice message: ${req.file.originalname}`
                );
            } catch (telegramError) {
                console.error('⚠️ Telegram voice upload failed:', telegramError.message);
            }
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

        if (telegramFileData) {
            const directUrl = await telegramStorage.getDirectFileUrl(telegramFileData.file_id);
            fileResponse.telegram = {
                file_id: telegramFileData.file_id,
                message_id: telegramFileData.message_id,
                media_type: 'audio',
                telegram_url: directUrl,
                file_url: `/api/media/${telegramFileData.file_id}`
            };
        }

        console.log('✅ Voice message uploaded:', req.file.originalname);
        res.json(fileResponse);

    } catch (error) {
        console.error('❌ Voice upload error:', error);
        
        if (req.file) {
            await fs.unlink(req.file.path).catch(console.error);
        }
        
        res.status(500).json({ error: 'Ошибка загрузки голосового сообщения: ' + error.message });
    }
});

app.get('/api/user/groups', authenticateToken, async (req, res) => {
    try {
        const currentUser = req.user.username;
        
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
        
        res.json(groupMessages);
    } catch (error) {
        console.error('❌ Group messages error:', error);
        res.status(500).json({ error: 'Failed to load group messages' });
    }
});

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
        
        if (userCurrency.lastDailyReward) {
            const lastReward = new Date(userCurrency.lastDailyReward);
            const hoursSinceLastReward = (now - lastReward) / (1000 * 60 * 60);
            
            if (hoursSinceLastReward < 23) {
                return res.status(400).json({
                    success: false,
                    error: 'Вы уже получали награду сегодня'
                });
            }
            
            if (hoursSinceLastReward < 48) {
                userCurrency.dailyStreak += 1;
            } else {
                userCurrency.dailyStreak = 1;
            }
        } else {
            userCurrency.dailyStreak = 1;
        }

        const baseReward = 50;
        const streakBonus = Math.min(userCurrency.dailyStreak * 5, 100);
        const totalReward = baseReward + streakBonus;
        
        userCurrency.balance += totalReward;
        userCurrency.lastDailyReward = now.toISOString();
        
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

app.get('/api/user/:username/avatar', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const avatarPath = user.avatar || '/default-avatar.png';
        
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
        
        res.redirect(avatarPath);
        
    } catch (error) {
        console.error('❌ Avatar error:', error);
        res.redirect('/default-avatar.png');
    }
});

app.post('/api/currency/save', authenticateToken, async (req, res) => {
    try {
        const { username, balance, dailyStreak, lastDailyReward, transactionHistory } = req.body;
        
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

app.post('/api/gifts/send', authenticateToken, async (req, res) => {
    try {
        const { sender, receiver, giftId, giftName, giftPrice, giftImage } = req.body;
        
        if (req.user.username !== sender) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const receiverUser = users.find(u => u.username === receiver);
        if (!receiverUser) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        const senderCurrency = initUserCurrency(sender);
        if (senderCurrency.balance < giftPrice) {
            return res.status(400).json({
                success: false,
                error: 'Недостаточно монет для покупки подарка'
            });
        }

        const senderGifts = initUserGifts(sender);
        const receiverGifts = initUserGifts(receiver);

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

        receiverGifts.received.unshift(gift);
        
        senderGifts.sent.unshift({
            ...gift,
            received: true
        });

        senderCurrency.balance -= giftPrice;

        senderCurrency.transactionHistory.unshift({
            type: 'gift_sent',
            amount: -giftPrice,
            description: `Подарок для ${receiver}: ${giftName}`,
            timestamp: new Date().toISOString()
        });

        const receiverBonus = Math.floor(giftPrice * 0.1);
        const receiverCurrency = initUserCurrency(receiver);
        receiverCurrency.balance += receiverBonus;

        receiverCurrency.transactionHistory.unshift({
            type: 'gift_received',
            amount: receiverBonus,
            description: `Бонус за подарок от ${sender}: ${giftName}`,
            timestamp: new Date().toISOString()
        });

        await saveGiftsData();
        await saveCurrencyData();

        const receiverSocketId = userSockets.get(receiver);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('gift_received', {
                gift: gift,
                bonus: receiverBonus,
                newBalance: receiverCurrency.balance
            });
        }

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

app.get('/api/mega/sync', authenticateToken, async (req, res) => {
    try {
        if (req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }

        const result = await megaStorage.syncToMega(dataDir);
        res.json(result);
        
    } catch (error) {
        console.error('❌ MEGA sync error:', error);
        res.status(500).json({ error: 'Ошибка синхронизации с MEGA' });
    }
});

app.get('/api/mega/backup', authenticateToken, async (req, res) => {
    try {
        if (req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }

        const backupName = req.query.name || null;
        const result = await megaStorage.backupData(dataDir, backupName);
        
        if (result) {
            res.json({ 
                success: true, 
                message: 'Backup created successfully' 
            });
        } else {
            res.status(500).json({ error: 'Failed to create backup' });
        }
        
    } catch (error) {
        console.error('❌ MEGA backup error:', error);
        res.status(500).json({ error: 'Ошибка создания бэкапа' });
    }
});

app.get('/api/mega/restore', authenticateToken, async (req, res) => {
    try {
        if (req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }

        const { backupName } = req.query;
        if (!backupName) {
            return res.status(400).json({ error: 'Имя бэкапа обязательно' });
        }

        const result = await megaStorage.restoreFromBackup(backupName, dataDir);
        
        if (result) {
            await loadUsers();
            await loadMessages();
            await loadGroups();
            await loadCurrencyData();
            await loadGiftsData();
            
            res.json({ 
                success: true, 
                message: 'Data restored successfully' 
            });
        } else {
            res.status(500).json({ error: 'Failed to restore from backup' });
        }
        
    } catch (error) {
        console.error('❌ MEGA restore error:', error);
        res.status(500).json({ error: 'Ошибка восстановления из бэкапа' });
    }
});

app.get('/api/mega/force-sync', authenticateToken, async (req, res) => {
    try {
        if (req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }

        console.log('🔄 Force syncing all data to MEGA...');
        
        await saveUsers();
        await saveMessages();
        await saveGroups();
        await saveCurrencyData();
        await saveGiftsData();
        
        const result = await megaStorage.syncToMega(dataDir);
        
        res.json({
            success: true,
            message: 'Force sync completed',
            result: result
        });
        
    } catch (error) {
        console.error('❌ Force sync error:', error);
        res.status(500).json({ error: 'Ошибка принудительной синхронизации' });
    }
});

app.get('/api/storage/info', authenticateToken, async (req, res) => {
    try {
        const megaInfo = megaStorage ? await megaStorage.getStorageInfo() : null;
        const telegramInfo = telegramStorage ? await telegramStorage.getStorageInfo() : null;
        
        res.json({
            mega: megaInfo,
            telegram: telegramInfo,
            local: {
                users: users.length,
                messages: messages.length,
                groups: groups.length,
                currency_users: Object.keys(currencyData).length,
                gifts_users: Object.keys(giftsData).length
            }
        });
        
    } catch (error) {
        console.error('❌ Storage info error:', error);
        res.status(500).json({ error: 'Failed to get storage info' });
    }
});

app.post('/api/admin/cleanup', authenticateToken, async (req, res) => {
    try {
        if (req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }

        const result = {
            uploads: await cleanupOldUploads(),
            mega: megaStorage ? await megaStorage.cleanupOldBackups() : null
        };
        
        res.json({
            success: true,
            message: 'Cleanup completed',
            result: result
        });
        
    } catch (error) {
        console.error('❌ Cleanup error:', error);
        res.status(500).json({ error: 'Ошибка очистки' });
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
        giftsUsers: Object.keys(giftsData).length,
        telegram: telegramStorage?.isInitialized ? 'connected' : 'disconnected',
        mega: megaStorage?.isInitialized ? 'connected' : 'disconnected'
    });
});

app.get('/default-avatar.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'default-avatar.png'));
});

app.use((req, res, next) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
    console.error('❌ Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// WebSocket соединения
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
            
            // Завершаем активные звонки при отключении
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
            
            // Останавливаем трансляцию экрана при отключении
            if (screenShares.has(socket.username)) {
                const screenShareData = screenShares.get(socket.username);
                screenShares.delete(socket.username);
                
                // Уведомляем всех участников о завершении трансляции
                screenShareData.participants?.forEach(participant => {
                    const participantSocket = userSockets.get(participant);
                    if (participantSocket) {
                        io.to(participantSocket).emit('screen_share_ended', {
                            sharer: socket.username,
                            callId: screenShareData.callId
                        });
                    }
                });
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

    socket.on('group_created', (data) => {
        console.log(`👥 Group created event: ${data.group.name}`);
        data.group.members.forEach(member => {
            const memberSocketId = userSockets.get(member);
            if (memberSocketId) {
                io.to(memberSocketId).emit('group_created', data);
            }
        });
    });

    // Инициализация звонка
    socket.on('initiate_call', (data) => {
        console.log(`📞 ${data.caller} звонит ${data.targetUser}`);
        
        const targetSocketId = userSockets.get(data.targetUser);
        if (targetSocketId) {
            activeCalls.set(data.callId, {
                callId: data.callId,
                caller: data.caller,
                targetUser: data.targetUser,
                type: data.callType,
                status: 'ringing',
                startTime: new Date(),
                participants: [data.caller, data.targetUser]
            });
            
            io.to(targetSocketId).emit('incoming_call', {
                callId: data.callId,
                caller: data.caller,
                callType: data.callType
            });
            
            socket.emit('call_initiated', {
                callId: data.callId,
                targetUser: data.targetUser,
                status: 'ringing'
            });
        } else {
            socket.emit('call_rejected', {
                callId: data.callId,
                reason: 'Пользователь не в сети'
            });
        }
    });

    // Принятие звонка
    socket.on('accept_call', (data) => {
        console.log(`✅ ${data.acceptor} принял звонок от ${data.caller}`);
        
        const callData = activeCalls.get(data.callId);
        if (callData) {
            callData.status = 'active';
            callData.acceptor = data.acceptor;
            
            const callerSocketId = userSockets.get(data.caller);
            if (callerSocketId) {
                io.to(callerSocketId).emit('call_accepted', {
                    callId: data.callId,
                    acceptor: data.acceptor
                });
            }
        }
    });

    // Отклонение звонка
    socket.on('reject_call', (data) => {
        console.log(`❌ ${data.caller} получил отказ: ${data.reason}`);
        
        const callData = activeCalls.get(data.callId);
        if (callData) {
            callData.status = 'rejected';
            callData.endTime = new Date();
            callData.endReason = data.reason;
            
            const callerSocketId = userSockets.get(data.caller);
            if (callerSocketId) {
                io.to(callerSocketId).emit('call_rejected', {
                    callId: data.callId,
                    reason: data.reason
                });
            }
            
            activeCalls.delete(data.callId);
        }
    });

    // Завершение звонка
    socket.on('end_call', (data) => {
        console.log(`📞 Звонок ${data.callId} завершен: ${data.reason}`);
        
        const callData = activeCalls.get(data.callId);
        if (callData) {
            callData.status = 'ended';
            callData.endTime = new Date();
            callData.endReason = data.reason;
            
            const callerSocketId = userSockets.get(callData.caller);
            const targetSocketId = userSockets.get(callData.targetUser);
            
            if (callerSocketId) {
                io.to(callerSocketId).emit('call_ended', {
                    callId: data.callId,
                    reason: data.reason,
                    endedBy: socket.username
                });
            }
            
            if (targetSocketId) {
                io.to(targetSocketId).emit('call_ended', {
                    callId: data.callId,
                    reason: data.reason,
                    endedBy: socket.username
                });
            }
            
            // Удаляем запись о трансляции экрана, если она была
            if (screenShares.has(socket.username)) {
                const screenShareData = screenShares.get(socket.username);
                if (screenShareData.callId === data.callId) {
                    screenShares.delete(socket.username);
                }
            }
            
            activeCalls.delete(data.callId);
        }
    });

    // WebRTC передача предложения (offer)
    socket.on('webrtc_offer', (data) => {
        console.log(`📤 WebRTC offer от ${socket.username} к ${data.targetUser}`);
        
        const targetSocketId = userSockets.get(data.targetUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc_offer', {
                callId: data.callId,
                caller: socket.username,
                offer: data.offer
            });
        }
    });

    // WebRTC передача ответа (answer)
    socket.on('webrtc_answer', (data) => {
        console.log(`📤 WebRTC answer от ${socket.username} к ${data.targetUser}`);
        
        const targetSocketId = userSockets.get(data.targetUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc_answer', {
                callId: data.callId,
                answer: data.answer
            });
        }
    });

    // WebRTC передача ICE кандидата
    socket.on('webrtc_ice_candidate', (data) => {
        const targetSocketId = userSockets.get(data.targetUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc_ice_candidate', {
                callId: data.callId,
                candidate: data.candidate
            });
        }
    });

    // Начало трансляции экрана
    socket.on('screen_share_started', (data) => {
        console.log(`🖥️ ${socket.username} начал трансляцию экрана в звонке ${data.callId}`);
        
        // Сохраняем информацию о трансляции
        screenShares.set(socket.username, {
            callId: data.callId,
            sharer: socket.username,
            targetUser: data.targetUser,
            startTime: new Date(),
            participants: [socket.username, data.targetUser]
        });
        
        // Получаем информацию о звонке
        const callData = activeCalls.get(data.callId);
        if (!callData) {
            console.error('❌ Call not found for screen share');
            return;
        }
        
        // Определяем получателя
        const targetUser = callData.caller === socket.username ? callData.targetUser : callData.caller;
        
        // Отправляем уведомление получателю
        const targetSocketId = userSockets.get(targetUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('screen_share_started', {
                callId: data.callId,
                sharer: socket.username,
                targetUser: targetUser
            });
            console.log(`📤 Уведомление о начале трансляции отправлено ${targetUser}`);
        } else {
            console.error(`❌ Target user ${targetUser} not found`);
        }
    });

    // Завершение трансляции экрана
    socket.on('screen_share_ended', (data) => {
        console.log(`🖥️ ${socket.username} завершил трансляцию экрана в звонке ${data.callId}`);
        
        // Удаляем информацию о трансляции
        if (screenShares.has(socket.username)) {
            const screenShareData = screenShares.get(socket.username);
            
            // Получаем информацию о звонке
            const callData = activeCalls.get(data.callId);
            if (callData) {
                // Определяем получателя
                const targetUser = callData.caller === socket.username ? callData.targetUser : callData.caller;
                
                // Отправляем уведомление получателю
                const targetSocketId = userSockets.get(targetUser);
                if (targetSocketId) {
                    io.to(targetSocketId).emit('screen_share_ended', {
                        callId: data.callId,
                        sharer: socket.username,
                        targetUser: targetUser
                    });
                    console.log(`📤 Уведомление о завершении трансляции отправлено ${targetUser}`);
                }
            }
            
            screenShares.delete(socket.username);
        }
    });

    socket.on('send_gift', async (data) => {
        try {
            const { sender, receiver, gift, messageId } = data;
            
            const senderCurrency = initUserCurrency(sender);
            if (senderCurrency.balance < gift.price) {
                socket.emit('gift_error', {
                    error: 'Недостаточно монет'
                });
                return;
            }
            
            senderCurrency.balance -= gift.price;
            senderCurrency.transactionHistory.unshift({
                type: 'gift_sent',
                amount: -gift.price,
                description: `Подарок для ${receiver}: ${gift.name}`,
                timestamp: new Date().toISOString()
            });
            
            await saveCurrencyData();
            
            socket.to(receiver).emit('gift_received', {
                sender,
                gift,
                messageId,
                timestamp: new Date()
            });
            
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

    socket.on('user_avatar_updated', (data) => {
        io.emit('user_avatar_updated', data);
    });

    socket.on('ping', (cb) => {
        if (typeof cb === 'function') {
            cb('pong');
        }
    });

    socket.on('get_online_users', (cb) => {
        if (typeof cb === 'function') {
            cb(Array.from(onlineUsers));
        }
    });

    socket.on('storage_sync_request', async (data) => {
        try {
            if (socket.username === 'admin') {
                console.log('🔄 Admin requested storage sync');
                
                const megaResult = megaStorage ? await megaStorage.syncToMega(dataDir) : null;
                
                socket.emit('storage_sync_response', {
                    success: true,
                    mega: megaResult,
                    message: 'Storage sync completed'
                });
            }
        } catch (error) {
            console.error('❌ Storage sync error:', error);
            socket.emit('storage_sync_response', {
                success: false,
                error: error.message
            });
        }
    });
});

async function startServer() {
    try {
        await ensureDirectories();
        await ensureStaticFiles();
        await ensureTemplates();
        
        // Очищаем старые файлы при старте
        console.log('🗑️ Cleaning up old uploads...');
        await cleanupOldUploads();
        
        console.log('📱 Initializing Telegram storage...');
        telegramStorage = new TelegramStorage(
            '8501177708:AAETyTKHluPQOCeYBdvKvJ-YVr7cDwPQC6g',
            '5324471398'
        );
        
        const telegramInitialized = await telegramStorage.initialize();
        if (telegramInitialized) {
            console.log('✅ Telegram storage connected successfully');
        } else {
            console.error('❌ Failed to initialize Telegram storage');
        }
        
        console.log('☁️ Initializing MEGA storage...');
        const megaEmail = process.env.MEGA_EMAIL || 'pprr25291@gmail.com';
        const megaPassword = process.env.MEGA_PASSWORD || 'e:cfLnZEiE44.5E';
        
        megaStorage = new MegaStorage(megaEmail, megaPassword);
        const megaInitialized = await megaStorage.initialize();
        
        if (megaInitialized) {
            console.log('✅ MEGA storage connected successfully');
            
            try {
                await megaStorage.syncFromMega(dataDir);
                console.log('✅ Data synced from MEGA');
            } catch (syncError) {
                console.warn('⚠️ MEGA sync failed:', syncError.message);
            }
            
            megaSyncInterval = await megaStorage.startAutoSync(dataDir, 5);
        } else {
            console.error('❌ Failed to initialize MEGA storage');
        }
        
        await loadUsers();
        await loadMessages();
        await loadGroups();
        await loadCurrencyData();
        await loadGiftsData();
        
        // Запускаем автосохранение каждые 30 секунд
        await startAutoSave();
        
        // Попытка запуска сервера с обработкой занятого порта
        const maxAttempts = 10;
        let attempts = 0;
        
        async function tryStartServer() {
            try {
                // Проверяем, свободен ли порт
                const portInUse = await isPortInUse(PORT);
                
                if (portInUse) {
                    console.log(`⚠️ Port ${PORT} is busy. Attempting to kill process...`);
                    
                    // Пробуем завершить процесс
                    const killed = await killPort(PORT);
                    
                    if (!killed) {
                        // Если не удалось завершить, пробуем другой порт
                        PORT++;
                        console.log(`🔄 Trying port ${PORT} instead...`);
                    }
                    
                    // Ждем немного
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // Запускаем сервер
                server.listen(PORT, '0.0.0.0', () => {
                    console.log(`🚀 Server running on port ${PORT}`);
                    console.log(`📊 Health check: http://localhost:${PORT}/health`);
                    console.log(`💾 Storage: Local + Telegram + MEGA (with smart sync)`);
                    console.log(`👥 Users: ${users.length}`);
                    console.log(`💬 Messages: ${messages.length}`);
                    console.log(`💰 Currency users: ${Object.keys(currencyData).length}`);
                    console.log(`🎁 Gifts users: ${Object.keys(giftsData).length}`);
                    console.log(`🖥️ Screen sharing: READY (WebRTC based)`);
                    console.log(`⏰ Auto-save: ENABLED (every 30 seconds)`);
                    
                    scheduleDailyBackup();
                });
                
            } catch (error) {
                if (error.code === 'EADDRINUSE') {
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log(`⚠️ Port ${PORT} is busy, trying ${PORT + 1}...`);
                        PORT++;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        return tryStartServer();
                    } else {
                        console.error(`❌ Failed to start server after ${maxAttempts} attempts`);
                        throw error;
                    }
                } else {
                    throw error;
                }
            }
        }
        
        await tryStartServer();
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        
        // Пробуем альтернативный порт
        console.log('🔄 Trying alternative port 3001...');
        PORT = 3001;
        
        try {
            server.listen(PORT, '0.0.0.0', () => {
                console.log(`✅ Server started on alternative port ${PORT}`);
                console.log(`🌐 http://localhost:${PORT}`);
            });
        } catch (fallbackError) {
            console.error('❌ Failed to start on fallback port:', fallbackError);
            process.exit(1);
        }
    }
}

function scheduleDailyBackup() {
    setInterval(async () => {
        try {
            console.log('⏰ Starting scheduled daily backup...');
            
            if (megaStorage?.isInitialized) {
                const timestamp = new Date().toISOString().slice(0, 10);
                const backupName = `daily-backup-${timestamp}.zip`;
                
                const result = await megaStorage.backupData(dataDir, backupName);
                if (result) {
                    console.log(`✅ Daily backup created: ${backupName}`);
                } else {
                    console.error('❌ Failed to create daily backup');
                }
            }
        } catch (error) {
            console.error('❌ Error in daily backup:', error.message);
        }
    }, 24 * 60 * 60 * 1000);
}

// Обработчик ошибок сервера
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Trying ${PORT + 1}...`);
        PORT++;
        setTimeout(() => {
            server.listen(PORT, '0.0.0.0');
        }, 1000);
    } else {
        console.error('❌ Server error:', error);
    }
});

process.on('SIGINT', async () => {
    console.log('\n⚠️ Shutting down server...');
    
    // Останавливаем автосохранение
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        console.log('⏹️ Stopped auto-save interval');
    }
    
    if (megaSyncInterval) {
        clearInterval(megaSyncInterval);
        console.log('🔄 Stopping MEGA sync...');
    }
    
    // Выполняем финальное сохранение
    console.log('💾 Performing final data save...');
    await saveAllData();
    
    if (megaStorage) {
        try {
            console.log('☁️ Syncing final data to MEGA...');
            await megaStorage.syncToMega(dataDir);
        } catch (error) {
            console.error('❌ Error syncing data to MEGA:', error);
        }
        
        await megaStorage.close();
    }
    
    if (telegramStorage) {
        await telegramStorage.close();
    }
    
    console.log('👋 Server shutdown complete');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();