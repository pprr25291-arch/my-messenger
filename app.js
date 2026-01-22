const express = require('express');
const socketIo = require('socket.io');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { exec } = require('child_process');
const os = require('os');
const net = require('net');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend', 'templates'));
const server = http.createServer(app);

// Определение окружения
const isTauri = process.env.TAURI_ENV === 'production' || process.env.NODE_ENV === 'tauri';
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production' && !isTauri;

console.log(`🌍 Environment: ${isTauri ? 'Tauri Desktop' : isDevelopment ? 'Development' : 'Production'}`);

// Конфигурация CORS
const corsOrigins = [];
if (isTauri) {
    // Для Tauri разрешаем все источники
    corsOrigins.push('*');
    corsOrigins.push('tauri://localhost');
    corsOrigins.push('http://tauri.localhost');
    corsOrigins.push('http://localhost:1420');
    corsOrigins.push('http://localhost:3000');
} else if (isDevelopment) {
    // Для разработки
    corsOrigins.push('http://localhost:3000');
    corsOrigins.push('http://localhost:1420');
    corsOrigins.push('http://localhost:5173');
    corsOrigins.push('http://localhost:8080');
} else if (isProduction) {
    // Для продакшена на Render
    corsOrigins.push('https://my-messenger-9g2n.onrender.com');
    corsOrigins.push('https://*.onrender.com');
    corsOrigins.push('tauri://localhost');
    corsOrigins.push('http://tauri.localhost');
}

console.log('🔧 CORS Origins:', corsOrigins);

// Конфигурация Socket.IO
const io = socketIo(server, {
    cors: {
        origin: function(origin, callback) {
            // В Tauri режиме разрешаем все
            if (isTauri) {
                return callback(null, true);
            }
            
            // В разработке разрешаем все локальные адреса
            if (isDevelopment && (!origin || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
                return callback(null, true);
            }
            
            // В продакшене проверяем разрешенные origin
            if (isProduction) {
                if (!origin || corsOrigins.some(allowed => {
                    if (allowed === '*') return true;
                    if (allowed instanceof RegExp) return allowed.test(origin);
                    return allowed === origin;
                })) {
                    return callback(null, true);
                }
            }
            
            callback(new Error('CORS не разрешен'));
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization", "Origin", "X-Requested-With", "Accept"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// Middleware CORS
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    if (isTauri) {
        // В Tauri разрешаем все
        res.header('Access-Control-Allow-Origin', '*');
    } else if (origin) {
        // Проверяем, разрешен ли origin
        const isAllowed = corsOrigins.some(allowed => {
            if (allowed === '*') return true;
            if (allowed instanceof RegExp) return allowed.test(origin);
            return allowed === origin;
        });
        
        if (isAllowed) {
            res.header('Access-Control-Allow-Origin', origin);
        }
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, X-Requested-With, Accept, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Expose-Headers', 'Content-Disposition');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

// JWT секрет
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production-for-security';
let PORT = parseInt(process.env.PORT) || 3000;

// Определение путей для данных
function getDataPath() {
    if (isTauri) {
        // В Tauri используем папку рядом с исполняемым файлом
        try {
            const tauriPath = path.join(__dirname, '..', '..');
            const dataPath = path.join(tauriPath, 'data');
            console.log(`📁 Tauri data path: ${dataPath}`);
            return dataPath;
        } catch (error) {
            console.error('❌ Error getting Tauri data path:', error);
            return path.join(__dirname, 'data');
        }
    } else if (process.env.DATA_PATH) {
        // Используем переменную окружения
        const dataPath = process.env.DATA_PATH;
        console.log(`📁 Using DATA_PATH from env: ${dataPath}`);
        return dataPath;
    } else if (isProduction) {
        // На Render используем /tmp для данных
        const renderDataPath = path.join('/tmp', 'messenger-data');
        console.log(`📁 Render data path: ${renderDataPath}`);
        return renderDataPath;
    } else {
        // Локальная разработка
        const devDataPath = path.join(__dirname, 'data');
        console.log(`📁 Development data path: ${devDataPath}`);
        return devDataPath;
    }
}

const dataDir = getDataPath();
const uploadsDir = path.join(dataDir, 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
const backupsDir = path.join(dataDir, 'backups');

console.log(`📂 Data directory: ${dataDir}`);
console.log(`📂 Uploads directory: ${uploadsDir}`);
console.log(`📂 Avatars directory: ${avatarsDir}`);

// Создание необходимых директорий
function createDirectoriesSync() {
    const dirs = [dataDir, uploadsDir, avatarsDir, backupsDir];
    
    for (const dir of dirs) {
        if (!fsSync.existsSync(dir)) {
            try {
                fsSync.mkdirSync(dir, { recursive: true });
                console.log(`✅ Created directory: ${dir}`);
            } catch (error) {
                console.error(`❌ Failed to create directory ${dir}:`, error.message);
            }
        }
    }
}

createDirectoriesSync();

// Глобальные переменные для данных
let users = [];
let messages = [];
let systemNotifications = [];
let groups = [];
let currencyData = {};
let giftsData = {};

// Map для управления соединениями
const userSockets = new Map();
const onlineUsers = new Set();
const activeCalls = new Map();
const screenShares = new Map();
const userPresence = new Map();

// Интервалы
let autoSaveInterval = null;
let presenceCheckInterval = null;

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

// Обслуживание статических файлов
app.use('/static', express.static(path.join(__dirname, 'frontend', 'static'), {
    maxAge: '1d',
    etag: true,
    lastModified: true
}));

app.use('/uploads', express.static(uploadsDir, {
    maxAge: '7d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        // Устанавливаем правильные заголовки для изображений
        if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.gif')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
}));

// Обслуживание всех статических файлов из frontend
app.use(express.static(path.join(__dirname, 'frontend'), {
    maxAge: '1d',
    etag: true,
    lastModified: true
}));

// Конфигурация Multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = file.fieldname + '-' + uniqueSuffix + ext;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv', 'text/html',
        'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
        'application/x-tar', 'application/gzip', 'application/x-bzip2',
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/x-m4a', 'audio/x-wav', 'audio/flac',
        'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
        'application/json', 'application/xml'
    ];

    const allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg', '.bmp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.html', '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.aac', '.webm', '.flac', '.mov', '.avi', '.mkv', '.json', '.xml'];

    const fileExt = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
        cb(null, true);
    } else {
        cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}. Разрешены: изображения, документы, аудио, видео, архивы`), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
        files: 10
    },
    fileFilter: fileFilter
});

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, avatarsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'avatar-' + uniqueSuffix + ext);
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Разрешены только изображения'), false);
        }
    }
});

const voiceUpload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Разрешены только аудио файлы'), false);
        }
    }
});

// Функции для работы с данными

/**
 * Инициализация директорий
 */
async function ensureDirectories() {
    try {
        const dirs = [
            dataDir,
            uploadsDir,
            avatarsDir,
            backupsDir,
            path.join(__dirname, 'frontend', 'static'),
            path.join(__dirname, 'frontend', 'templates')
        ];

        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
                console.log(`✅ Created directory: ${dir}`);
            }
        }

        return true;
    } catch (error) {
        console.error('❌ Error ensuring directories:', error);
        return false;
    }
}

/**
 * Очистка старых аватаров пользователя
 */
async function cleanupUserAvatars(username) {
    try {
        if (!fsSync.existsSync(avatarsDir)) {
            return;
        }

        const files = await fs.readdir(avatarsDir);
        let deletedCount = 0;

        for (const file of files) {
            if (file.includes(`avatar_${username}_`) || file.startsWith(`avatar-${username}-`)) {
                try {
                    await fs.unlink(path.join(avatarsDir, file));
                    deletedCount++;
                    console.log(`🗑️ Deleted old avatar: ${file}`);
                } catch (error) {
                    console.error(`❌ Error deleting avatar ${file}:`, error.message);
                }
            }
        }

        if (deletedCount > 0) {
            console.log(`✅ Cleaned up ${deletedCount} old avatars for ${username}`);
        }
    } catch (error) {
        console.error('❌ Error in cleanupUserAvatars:', error.message);
    }
}

/**
 * Удаление дубликатов сообщений
 */
function removeDuplicateMessages(messagesArray) {
    const uniqueMessages = [];
    const seenMessages = new Set();

    for (const msg of messagesArray) {
        const msgKey = `${msg.sender}|${msg.receiver || msg.groupId}|${msg.message}|${msg.timestamp}`;
        if (!seenMessages.has(msgKey)) {
            seenMessages.add(msgKey);
            uniqueMessages.push(msg);
        }
    }

    return uniqueMessages;
}

/**
 * Очистка старых загрузок
 */
async function cleanupOldUploads() {
    try {
        if (!fsSync.existsSync(uploadsDir)) {
            return { deleted: 0, skipped: 0 };
        }

        const files = await fs.readdir(uploadsDir);
        const now = Date.now();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

        let deleted = 0;
        let skipped = 0;

        for (const file of files) {
            // Пропускаем системные файлы и аватары
            if (file.startsWith('.') || file === 'avatars' || file.includes('avatar')) {
                skipped++;
                continue;
            }

            const filePath = path.join(uploadsDir, file);
            try {
                const stats = await fs.stat(filePath);

                if (stats.isDirectory()) {
                    // Рекурсивно очищаем поддиректории
                    const subDirFiles = await fs.readdir(filePath);
                    for (const subFile of subDirFiles) {
                        const subFilePath = path.join(filePath, subFile);
                        try {
                            const subStats = await fs.stat(subFilePath);
                            if (subStats.mtimeMs < oneWeekAgo) {
                                await fs.unlink(subFilePath);
                                deleted++;
                            } else {
                                skipped++;
                            }
                        } catch (error) {
                            console.error(`❌ Error processing subfile ${subFile}:`, error.message);
                            skipped++;
                        }
                    }
                } else if (stats.mtimeMs < oneWeekAgo) {
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

        console.log(`✅ Cleanup completed: ${deleted} files deleted, ${skipped} files kept`);
        return { deleted, skipped };
    } catch (error) {
        console.error('❌ Error in cleanupOldUploads:', error.message);
        return { deleted: 0, skipped: 0, error: error.message };
    }
}

// Функции загрузки данных

/**
 * Загрузка пользователей
 */
async function loadUsers() {
    const usersPath = path.join(dataDir, 'users.json');
    try {
        if (fsSync.existsSync(usersPath)) {
            const data = await fs.readFile(usersPath, 'utf8');
            users = JSON.parse(data);
            console.log(`✅ Users loaded: ${users.length}`);
            
            // Инициализируем валюту для всех пользователей
            for (const user of users) {
                if (!currencyData[user.username]) {
                    currencyData[user.username] = {
                        balance: 100,
                        dailyStreak: 0,
                        lastDailyReward: null,
                        transactionHistory: []
                    };
                }
                
                if (!giftsData[user.username]) {
                    giftsData[user.username] = {
                        received: [],
                        sent: []
                    };
                }
            }
        } else {
            console.log('⚠️ No users file found, starting with empty array');
            users = [];
            await saveUsers();
        }
    } catch (error) {
        console.error('❌ Error loading users:', error);
        users = [];
    }
}

/**
 * Загрузка сообщений
 */
async function loadMessages() {
    const messagesPath = path.join(dataDir, 'messages.json');
    try {
        if (fsSync.existsSync(messagesPath)) {
            const data = await fs.readFile(messagesPath, 'utf8');
            const loadedMessages = JSON.parse(data);
            messages = removeDuplicateMessages(loadedMessages);
            
            const duplicatesRemoved = loadedMessages.length - messages.length;
            if (duplicatesRemoved > 0) {
                console.log(`✅ Messages loaded: ${messages.length} (removed ${duplicatesRemoved} duplicates)`);
            } else {
                console.log(`✅ Messages loaded: ${messages.length}`);
            }
        } else {
            console.log('⚠️ No messages file found, starting with empty array');
            messages = [];
            await saveMessages();
        }
    } catch (error) {
        console.error('❌ Error loading messages:', error);
        messages = [];
    }
}

/**
 * Загрузка групп
 */
async function loadGroups() {
    const groupsPath = path.join(dataDir, 'groups.json');
    try {
        if (fsSync.existsSync(groupsPath)) {
            const data = await fs.readFile(groupsPath, 'utf8');
            groups = JSON.parse(data);
            console.log(`✅ Groups loaded: ${groups.length}`);
        } else {
            console.log('⚠️ No groups file found, starting with empty array');
            groups = [];
            await saveGroups();
        }
    } catch (error) {
        console.error('❌ Error loading groups:', error);
        groups = [];
    }
}

/**
 * Загрузка данных валюты
 */
async function loadCurrencyData() {
    const currencyPath = path.join(dataDir, 'currency.json');
    try {
        if (fsSync.existsSync(currencyPath)) {
            const data = await fs.readFile(currencyPath, 'utf8');
            currencyData = JSON.parse(data);
            console.log(`✅ Currency data loaded for ${Object.keys(currencyData).length} users`);
        } else {
            console.log('⚠️ No currency data found, starting with empty object');
            currencyData = {};
            await saveCurrencyData();
        }
    } catch (error) {
        console.error('❌ Error loading currency data:', error);
        currencyData = {};
    }
}

/**
 * Загрузка данных подарков
 */
async function loadGiftsData() {
    const giftsPath = path.join(dataDir, 'gifts.json');
    try {
        if (fsSync.existsSync(giftsPath)) {
            const data = await fs.readFile(giftsPath, 'utf8');
            giftsData = JSON.parse(data);
            console.log(`✅ Gifts data loaded for ${Object.keys(giftsData).length} users`);
        } else {
            console.log('⚠️ No gifts data found, starting with empty object');
            giftsData = {};
            await saveGiftsData();
        }
    } catch (error) {
        console.error('❌ Error loading gifts data:', error);
        giftsData = {};
    }
}

// Функции сохранения данных

/**
 * Сохранение пользователей
 */
async function saveUsers() {
    try {
        const usersPath = path.join(dataDir, 'users.json');
        const usersData = JSON.stringify(users, null, 2);
        await fs.writeFile(usersPath, usersData);
        console.log('✅ Users saved locally');
        return true;
    } catch (error) {
        console.error('❌ Error saving users:', error.message);
        return false;
    }
}

/**
 * Сохранение сообщений
 */
async function saveMessages() {
    try {
        const messagesPath = path.join(dataDir, 'messages.json');
        const messagesData = JSON.stringify(messages, null, 2);
        await fs.writeFile(messagesPath, messagesData);
        console.log('✅ Messages saved locally');
        return true;
    } catch (error) {
        console.error('❌ Error saving messages:', error.message);
        return false;
    }
}

/**
 * Сохранение групп
 */
async function saveGroups() {
    try {
        const groupsPath = path.join(dataDir, 'groups.json');
        const groupsData = JSON.stringify(groups, null, 2);
        await fs.writeFile(groupsPath, groupsData);
        console.log('✅ Groups saved locally');
        return true;
    } catch (error) {
        console.error('❌ Error saving groups:', error.message);
        return false;
    }
}

/**
 * Сохранение данных валюты
 */
async function saveCurrencyData() {
    try {
        const currencyPath = path.join(dataDir, 'currency.json');
        const currencyDataStr = JSON.stringify(currencyData, null, 2);
        await fs.writeFile(currencyPath, currencyDataStr);
        console.log('✅ Currency data saved locally');
        return true;
    } catch (error) {
        console.error('❌ Error saving currency data:', error.message);
        return false;
    }
}

/**
 * Сохранение данных подарков
 */
async function saveGiftsData() {
    try {
        const giftsPath = path.join(dataDir, 'gifts.json');
        const giftsDataStr = JSON.stringify(giftsData, null, 2);
        await fs.writeFile(giftsPath, giftsDataStr);
        console.log('✅ Gifts data saved locally');
        return true;
    } catch (error) {
        console.error('❌ Error saving gifts data:', error.message);
        return false;
    }
}

/**
 * Сохранение всех данных
 */
async function saveAllData() {
    try {
        console.log('💾 Auto-saving all data...');
        const results = await Promise.allSettled([
            saveUsers(),
            saveMessages(),
            saveGroups(),
            saveCurrencyData(),
            saveGiftsData()
        ]);
        
        let successCount = 0;
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                successCount++;
            }
        });
        
        console.log(`✅ Auto-save completed: ${successCount}/5 successful`);
        return successCount === 5;
    } catch (error) {
        console.error('❌ Error in saveAllData:', error.message);
        return false;
    }
}

/**
 * Автоматическое сохранение
 */
function startAutoSave() {
    console.log('⏰ Starting auto-save every 30 seconds');
    
    // Сохраняем сразу при старте
    saveAllData().catch(console.error);
    
    // Устанавливаем интервал
    autoSaveInterval = setInterval(() => {
        saveAllData().catch(console.error);
    }, 30 * 1000);
    
    return autoSaveInterval;
}

/**
 * Проверка активности пользователей
 */
function startPresenceCheck() {
    console.log('👁️ Starting presence check every 60 seconds');
    
    presenceCheckInterval = setInterval(() => {
        const now = Date.now();
        const inactiveThreshold = 120 * 1000; // 2 минуты
        
        for (const [username, lastActivity] of userPresence.entries()) {
            if (now - lastActivity > inactiveThreshold) {
                // Пользователь неактивен слишком долго
                const socketId = userSockets.get(username);
                if (socketId) {
                    const socket = io.sockets.sockets.get(socketId);
                    if (socket) {
                        socket.disconnect(true);
                        console.log(`👋 Disconnected inactive user: ${username}`);
                    }
                }
            }
        }
    }, 60 * 1000);
    
    return presenceCheckInterval;
}

// Middleware аутентификации

/**
 * Аутентификация по токену
 */
function authenticateToken(req, res, next) {
    try {
        // Получаем токен из разных источников
        let token = req.cookies?.token;
        
        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        
        if (!token && req.query.token) {
            token = req.query.token;
        }
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'Требуется аутентификация',
                code: 'NO_TOKEN'
            });
        }
        
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.error('❌ JWT verification error:', err.message);
                return res.status(403).json({ 
                    success: false, 
                    error: 'Недействительный или просроченный токен',
                    code: 'INVALID_TOKEN'
                });
            }
            
            req.user = user;
            next();
        });
    } catch (error) {
        console.error('❌ Authentication error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка аутентификации',
            code: 'AUTH_ERROR'
        });
    }
}

/**
 * Аутентификация администратора
 */
function authenticateAdmin(req, res, next) {
    authenticateToken(req, res, () => {
        if (req.user.username === 'admin') {
            next();
        } else {
            res.status(403).json({ 
                success: false, 
                error: 'Требуются права администратора',
                code: 'ADMIN_REQUIRED'
            });
        }
    });
}

// Вспомогательные функции для данных пользователя

/**
 * Инициализация валюты пользователя
 */
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

/**
 * Инициализация подарков пользователя
 */
function initUserGifts(username) {
    if (!giftsData[username]) {
        giftsData[username] = {
            received: [],
            sent: []
        };
    }
    return giftsData[username];
}

/**
 * Получение подарков пользователя
 */
function getUserGifts(username) {
    return giftsData[username] || { received: [], sent: [] };
}

/**
 * Поиск пользователя
 */
function findUser(username) {
    return users.find(u => u.username === username);
}

/**
 * Проверка существования пользователя
 */
function userExists(username) {
    return users.some(u => u.username === username);
}

// Функции для работы с файлами

/**
 * Создание миниатюры для изображения
 */
async function createThumbnail(sourcePath, thumbnailPath, size = 200) {
    try {
        await sharp(sourcePath)
            .resize(size, size, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);
        return true;
    } catch (error) {
        console.error('❌ Error creating thumbnail:', error);
        return false;
    }
}

/**
 * Получение MIME типа по расширению файла
 */
function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed',
        '.7z': 'application/x-7z-compressed',
        '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.json': 'application/json',
        '.xml': 'application/xml'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
}

// Маршруты

/**
 * Главная страница
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

/**
 * Страница регистрации
 */
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'templates', 'register.html'));
});

/**
 * Страница входа
 */
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'templates', 'login.html'));
});

/**
 * Страница чата
 */
app.get('/chat', authenticateToken, (req, res) => {
    try {
        const user = req.user;
        const token = req.cookies?.token || req.query.token;
        
        // Рендерим шаблон чата
        res.render('chat', {
            username: user.username,
            token: token,
            isAdmin: user.username === 'admin',
            serverUrl: isTauri ? `http://localhost:${PORT}` : `https://${req.headers.host || `localhost:${PORT}`}`
        });
    } catch (error) {
        console.error('❌ Chat page error:', error);
        res.status(500).send('Ошибка загрузки чата');
    }
});

/**
 * API: Регистрация
 */
app.post('/api/register', avatarUpload.single('avatar'), async (req, res) => {
    try {
        const { username, password, email } = req.body;
        
        // Валидация
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Имя пользователя и пароль обязательны' 
            });
        }
        
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ 
                success: false, 
                error: 'Имя пользователя должно быть от 3 до 20 символов' 
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                error: 'Пароль должен быть не менее 6 символов' 
            });
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Имя пользователя может содержать только буквы, цифры и подчеркивания' 
            });
        }
        
        // Проверка существования пользователя
        if (userExists(username)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Имя пользователя уже занято' 
            });
        }
        
        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Создание пользователя
        const newUser = {
            username,
            password: hashedPassword,
            email: email || null,
            avatar: '/static/default-avatar.png',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            bio: '',
            isOnline: false,
            isAdmin: username === 'admin'
        };
        
        // Обработка аватара
        if (req.file) {
            try {
                await cleanupUserAvatars(username);
                
                const avatarExt = path.extname(req.file.originalname);
                const avatarFilename = `avatar_${username}_${Date.now()}${avatarExt}`;
                const avatarPath = path.join(avatarsDir, avatarFilename);
                
                await fs.rename(req.file.path, avatarPath);
                
                // Создание миниатюры
                const thumbFilename = `thumb_${avatarFilename}`;
                const thumbPath = path.join(avatarsDir, thumbFilename);
                await createThumbnail(avatarPath, thumbPath);
                
                newUser.avatar = `/uploads/avatars/${avatarFilename}`;
                newUser.avatarThumb = `/uploads/avatars/${thumbFilename}`;
            } catch (avatarError) {
                console.error('❌ Avatar processing error:', avatarError);
                // Продолжаем без аватара
            }
        }
        
        // Добавление пользователя
        users.push(newUser);
        await saveUsers();
        
        // Инициализация валюты и подарков
        initUserCurrency(username);
        initUserGifts(username);
        await saveCurrencyData();
        await saveGiftsData();
        
        // Создание токена
        const token = jwt.sign({ 
            username: newUser.username,
            isAdmin: newUser.isAdmin 
        }, JWT_SECRET, { expiresIn: '7d' });
        
        // Установка cookie
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
            sameSite: 'strict',
            secure: isProduction,
            path: '/'
        });
        
        // Ответ
        res.json({
            success: true,
            message: 'Регистрация успешна!',
            token,
            user: {
                username: newUser.username,
                avatar: newUser.avatar,
                isAdmin: newUser.isAdmin
            }
        });
        
        console.log(`✅ New user registered: ${username}`);
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка регистрации',
            details: isDevelopment ? error.message : undefined
        });
    }
});

/**
 * API: Вход
 */
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Имя пользователя и пароль обязательны' 
            });
        }
        
        // Поиск пользователя
        const user = findUser(username);
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Неверное имя пользователя или пароль' 
            });
        }
        
        // Проверка пароля
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ 
                success: false, 
                error: 'Неверное имя пользователя или пароль' 
            });
        }
        
        // Обновление времени последнего входа
        user.lastLogin = new Date().toISOString();
        await saveUsers();
        
        // Создание токена
        const token = jwt.sign({ 
            username: user.username,
            isAdmin: user.isAdmin || false
        }, JWT_SECRET, { expiresIn: '7d' });
        
        // Установка cookie
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'strict',
            secure: isProduction,
            path: '/'
        });
        
        // Ответ
        res.json({
            success: true,
            message: 'Вход выполнен успешно!',
            token,
            user: {
                username: user.username,
                avatar: user.avatar || '/static/default-avatar.png',
                isAdmin: user.isAdmin || false,
                bio: user.bio || ''
            }
        });
        
        console.log(`✅ User logged in: ${username}`);
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка входа',
            details: isDevelopment ? error.message : undefined
        });
    }
});

/**
 * API: Выход
 */
app.post('/api/logout', authenticateToken, (req, res) => {
    try {
        res.clearCookie('token', {
            path: '/',
            httpOnly: true,
            sameSite: 'strict',
            secure: isProduction
        });
        
        res.json({
            success: true,
            message: 'Выход выполнен успешно'
        });
        
        console.log(`✅ User logged out: ${req.user.username}`);
        
    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка выхода' 
        });
    }
});

/**
 * API: Получение информации о текущем пользователе
 */
app.get('/api/me', authenticateToken, (req, res) => {
    try {
        const user = findUser(req.user.username);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        const { password, ...userWithoutPassword } = user;
        
        res.json({
            success: true,
            user: {
                ...userWithoutPassword,
                isOnline: onlineUsers.has(user.username)
            }
        });
        
    } catch (error) {
        console.error('❌ Get me error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения информации' 
        });
    }
});

/**
 * API: Обновление профиля
 */
app.post('/api/profile/update', authenticateToken, avatarUpload.single('avatar'), async (req, res) => {
    try {
        const username = req.user.username;
        const { bio } = req.body;
        const user = findUser(username);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        // Обновление биографии
        if (bio !== undefined) {
            user.bio = bio.substring(0, 500); // Ограничение длины
        }
        
        // Обновление аватара
        if (req.file) {
            try {
                await cleanupUserAvatars(username);
                
                const avatarExt = path.extname(req.file.originalname);
                const avatarFilename = `avatar_${username}_${Date.now()}${avatarExt}`;
                const avatarPath = path.join(avatarsDir, avatarFilename);
                
                await fs.rename(req.file.path, avatarPath);
                
                // Создание миниатюры
                const thumbFilename = `thumb_${avatarFilename}`;
                const thumbPath = path.join(avatarsDir, thumbFilename);
                await createThumbnail(avatarPath, thumbPath);
                
                user.avatar = `/uploads/avatars/${avatarFilename}`;
                user.avatarThumb = `/uploads/avatars/${thumbFilename}`;
                
                // Уведомление об обновлении аватара
                io.emit('user_avatar_updated', {
                    username: username,
                    avatar: user.avatar,
                    avatarThumb: user.avatarThumb
                });
                
            } catch (avatarError) {
                console.error('❌ Avatar update error:', avatarError);
            }
        }
        
        await saveUsers();
        
        res.json({
            success: true,
            message: 'Профиль обновлен успешно',
            user: {
                username: user.username,
                avatar: user.avatar,
                bio: user.bio,
                avatarThumb: user.avatarThumb
            }
        });
        
        console.log(`✅ Profile updated: ${username}`);
        
    } catch (error) {
        console.error('❌ Profile update error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка обновления профиля' 
        });
    }
});

/**
 * API: Поиск пользователей
 */
app.get('/api/users/search', authenticateToken, (req, res) => {
    try {
        const { q: query, limit = 20 } = req.query;
        const currentUser = req.user.username;
        
        if (!query || query.trim().length < 2) {
            return res.json({ 
                success: true, 
                users: [], 
                total: 0 
            });
        }
        
        const searchTerm = query.toLowerCase().trim();
        
        const results = users
            .filter(user => {
                if (!user.username || user.username === currentUser) {
                    return false;
                }
                
                const username = user.username.toLowerCase();
                const bio = (user.bio || '').toLowerCase();
                
                return username.includes(searchTerm) || bio.includes(searchTerm);
            })
            .slice(0, parseInt(limit))
            .map(({ password, ...user }) => ({
                ...user,
                isOnline: onlineUsers.has(user.username),
                lastSeen: user.lastLogin || user.createdAt
            }));
        
        res.json({
            success: true,
            users: results,
            total: results.length,
            query: searchTerm
        });
        
    } catch (error) {
        console.error('❌ User search error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка поиска пользователей' 
        });
    }
});

/**
 * API: Получение всех пользователей
 */
app.get('/api/users', authenticateToken, (req, res) => {
    try {
        const { page = 1, limit = 50, onlineOnly = false } = req.query;
        const currentUser = req.user.username;
        
        let filteredUsers = users.filter(user => user.username !== currentUser);
        
        if (onlineOnly === 'true') {
            filteredUsers = filteredUsers.filter(user => onlineUsers.has(user.username));
        }
        
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        
        const paginatedUsers = filteredUsers
            .slice(startIndex, endIndex)
            .map(({ password, ...user }) => ({
                ...user,
                isOnline: onlineUsers.has(user.username),
                lastSeen: user.lastLogin || user.createdAt
            }));
        
        res.json({
            success: true,
            users: paginatedUsers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: filteredUsers.length,
                totalPages: Math.ceil(filteredUsers.length / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('❌ Get users error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения пользователей' 
        });
    }
});

/**
 * API: Получение информации о пользователе
 */
app.get('/api/users/:username', authenticateToken, (req, res) => {
    try {
        const { username } = req.params;
        const currentUser = req.user.username;
        
        const user = findUser(username);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        const { password, ...userWithoutPassword } = user;
        
        // Получение статистики
        const userMessages = messages.filter(msg => 
            msg.sender === username || msg.receiver === username
        ).length;
        
        const userGroups = groups.filter(group => 
            group.members && group.members.includes(username)
        ).length;
        
        res.json({
            success: true,
            user: {
                ...userWithoutPassword,
                isOnline: onlineUsers.has(username),
                statistics: {
                    messages: userMessages,
                    groups: userGroups,
                    registrationDate: user.createdAt,
                    lastLogin: user.lastLogin
                }
            },
            canMessage: username !== currentUser
        });
        
    } catch (error) {
        console.error('❌ Get user error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения информации о пользователе' 
        });
    }
});

/**
 * API: Получение аватара пользователя
 */
app.get('/api/users/:username/avatar', async (req, res) => {
    try {
        const { username } = req.params;
        const { size = 'original' } = req.query;
        
        const user = findUser(username);
        if (!user) {
            return res.redirect('/static/default-avatar.png');
        }
        
        let avatarPath = user.avatar || '/static/default-avatar.png';
        
        // Если запрошена миниатюра
        if (size === 'thumb' && user.avatarThumb) {
            avatarPath = user.avatarThumb;
        }
        
        // Если это путь к загруженному аватару
        if (avatarPath.startsWith('/uploads/avatars/')) {
            const filename = avatarPath.split('/').pop();
            const filePath = path.join(avatarsDir, filename);
            
            try {
                await fs.access(filePath);
                return res.sendFile(filePath);
            } catch {
                // Файл не найден, используем дефолтный
                return res.redirect('/static/default-avatar.png');
            }
        }
        
        // Дефолтный аватар или внешняя ссылка
        res.redirect(avatarPath);
        
    } catch (error) {
        console.error('❌ Get avatar error:', error);
        res.redirect('/static/default-avatar.png');
    }
});

/**
 * API: Загрузка файла
 */
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'Файл не загружен' 
            });
        }
        
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (req.file.size > maxSize) {
            await fs.unlink(req.file.path).catch(() => {});
            return res.status(400).json({ 
                success: false, 
                error: 'Файл слишком большой (максимум 100MB)' 
            });
        }
        
        const fileInfo = {
            originalName: req.file.originalname,
            filename: req.file.filename,
            path: `/uploads/${req.file.filename}`,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadDate: new Date().toISOString(),
            uploadedBy: req.user.username
        };
        
        // Создание миниатюры для изображений
        if (req.file.mimetype.startsWith('image/')) {
            try {
                const thumbFilename = `thumb_${req.file.filename}`;
                const thumbPath = path.join(uploadsDir, thumbFilename);
                
                await createThumbnail(req.file.path, thumbPath, 300);
                fileInfo.thumbnail = `/uploads/${thumbFilename}`;
                
            } catch (thumbError) {
                console.error('❌ Thumbnail creation error:', thumbError);
            }
        }
        
        res.json({
            success: true,
            message: 'Файл загружен успешно',
            file: fileInfo
        });
        
        console.log(`✅ File uploaded: ${req.file.originalname} by ${req.user.username}`);
        
    } catch (error) {
        console.error('❌ Upload error:', error);
        
        // Удаляем файл при ошибке
        if (req.file) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка загрузки файла' 
        });
    }
});

/**
 * API: Загрузка голосового сообщения
 */
app.post('/api/upload/voice', authenticateToken, voiceUpload.single('voice'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'Аудио файл не загружен' 
            });
        }
        
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (req.file.size > maxSize) {
            await fs.unlink(req.file.path).catch(() => {});
            return res.status(400).json({ 
                success: false, 
                error: 'Аудио файл слишком большой (максимум 50MB)' 
            });
        }
        
        const duration = req.body.duration || 0;
        
        const voiceInfo = {
            originalName: req.file.originalname,
            filename: req.file.filename,
            path: `/uploads/${req.file.filename}`,
            size: req.file.size,
            mimetype: req.file.mimetype,
            duration: parseInt(duration),
            uploadDate: new Date().toISOString(),
            uploadedBy: req.user.username,
            type: 'voice'
        };
        
        res.json({
            success: true,
            message: 'Голосовое сообщение загружено успешно',
            voice: voiceInfo
        });
        
        console.log(`✅ Voice message uploaded: ${req.file.originalname} by ${req.user.username}`);
        
    } catch (error) {
        console.error('❌ Voice upload error:', error);
        
        if (req.file) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка загрузки голосового сообщения' 
        });
    }
});

/**
 * API: Получение приватных сообщений
 */
app.get('/api/messages/private/:username', authenticateToken, (req, res) => {
    try {
        const { username: otherUser } = req.params;
        const currentUser = req.user.username;
        const { limit = 100, before = null } = req.query;
        
        // Проверка существования пользователя
        if (!userExists(otherUser)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        // Фильтрация сообщений
        let privateMessages = messages.filter(msg => 
            msg.type === 'private' &&
            ((msg.sender === currentUser && msg.receiver === otherUser) ||
             (msg.sender === otherUser && msg.receiver === currentUser))
        );
        
        // Фильтрация по времени если указано
        if (before) {
            const beforeDate = new Date(before);
            privateMessages = privateMessages.filter(msg => new Date(msg.date) < beforeDate);
        }
        
        // Сортировка по времени (новые в конце)
        privateMessages.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Ограничение количества
        const limitedMessages = privateMessages.slice(-parseInt(limit));
        
        res.json({
            success: true,
            messages: limitedMessages,
            total: privateMessages.length,
            hasMore: privateMessages.length > parseInt(limit),
            currentUser,
            otherUser
        });
        
    } catch (error) {
        console.error('❌ Get private messages error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения сообщений' 
        });
    }
});

/**
 * API: Получение списка бесед
 */
app.get('/api/conversations', authenticateToken, (req, res) => {
    try {
        const currentUser = req.user.username;
        const conversationsMap = new Map();
        
        // Собираем все приватные сообщения пользователя
        messages.forEach(msg => {
            if (msg.type === 'private') {
                let otherUser = null;
                
                if (msg.sender === currentUser) {
                    otherUser = msg.receiver;
                } else if (msg.receiver === currentUser) {
                    otherUser = msg.sender;
                }
                
                if (otherUser) {
                    if (!conversationsMap.has(otherUser)) {
                        conversationsMap.set(otherUser, {
                            user: otherUser,
                            lastMessage: msg,
                            unreadCount: 0,
                            messageCount: 0
                        });
                    }
                    
                    const conversation = conversationsMap.get(otherUser);
                    conversation.messageCount++;
                    
                    // Обновляем последнее сообщение если оно новее
                    if (new Date(msg.date) > new Date(conversation.lastMessage.date)) {
                        conversation.lastMessage = msg;
                    }
                    
                    // Считаем непрочитанные
                    if (msg.sender === otherUser && !msg.read) {
                        conversation.unreadCount++;
                    }
                }
            }
        });
        
        // Преобразуем Map в массив и сортируем по времени последнего сообщения
        const conversations = Array.from(conversationsMap.values())
            .map(conv => {
                const user = findUser(conv.user);
                return {
                    user: conv.user,
                    userInfo: user ? {
                        username: user.username,
                        avatar: user.avatar,
                        isOnline: onlineUsers.has(user.username),
                        bio: user.bio
                    } : null,
                    lastMessage: conv.lastMessage,
                    unreadCount: conv.unreadCount,
                    messageCount: conv.messageCount,
                    lastActivity: conv.lastMessage.date
                };
            })
            .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
        
        res.json({
            success: true,
            conversations,
            total: conversations.length
        });
        
    } catch (error) {
        console.error('❌ Get conversations error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения бесед' 
        });
    }
});

/**
 * API: Отметка сообщений как прочитанных
 */
app.post('/api/messages/mark-read', authenticateToken, async (req, res) => {
    try {
        const { sender, messageIds } = req.body;
        const currentUser = req.user.username;
        
        let markedCount = 0;
        
        for (const msgId of messageIds) {
            const message = messages.find(msg => 
                msg.id === msgId && 
                msg.sender === sender && 
                msg.receiver === currentUser &&
                msg.type === 'private' &&
                !msg.read
            );
            
            if (message) {
                message.read = true;
                message.readAt = new Date().toISOString();
                markedCount++;
            }
        }
        
        if (markedCount > 0) {
            await saveMessages();
            
            // Уведомляем отправителя о прочтении
            const senderSocketId = userSockets.get(sender);
            if (senderSocketId) {
                io.to(senderSocketId).emit('messages_read', {
                    reader: currentUser,
                    messageIds,
                    readAt: new Date().toISOString()
                });
            }
        }
        
        res.json({
            success: true,
            message: `Отмечено как прочитано: ${markedCount} сообщений`,
            markedCount
        });
        
    } catch (error) {
        console.error('❌ Mark read error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка отметки сообщений' 
        });
    }
});

/**
 * API: Создание группы
 */
app.post('/api/groups/create', authenticateToken, async (req, res) => {
    try {
        const { name, description, members, isPublic = false } = req.body;
        const creator = req.user.username;
        
        if (!name || !members || !Array.isArray(members)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Название и участники группы обязательны' 
            });
        }
        
        if (name.length < 3 || name.length > 50) {
            return res.status(400).json({ 
                success: false, 
                error: 'Название группы должно быть от 3 до 50 символов' 
            });
        }
        
        // Проверяем существующих участников
        const validMembers = members.filter(member => userExists(member));
        if (!validMembers.includes(creator)) {
            validMembers.push(creator);
        }
        
        // Проверяем уникальность названия для создателя
        const existingGroup = groups.find(group => 
            group.name === name && group.createdBy === creator
        );
        
        if (existingGroup) {
            return res.status(400).json({ 
                success: false, 
                error: 'У вас уже есть группа с таким названием' 
            });
        }
        
        // Создаем группу
        const group = {
            id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            description: description || '',
            members: validMembers,
            createdBy: creator,
            createdAt: new Date().toISOString(),
            isPublic: !!isPublic,
            avatar: null,
            settings: {
                allowMessages: true,
                allowFiles: true,
                allowVoice: true,
                adminOnlyMessages: false
            },
            admins: [creator]
        };
        
        groups.push(group);
        await saveGroups();
        
        // Уведомляем участников о создании группы
        validMembers.forEach(member => {
            const memberSocketId = userSockets.get(member);
            if (memberSocketId) {
                io.to(memberSocketId).emit('group_created', {
                    group,
                    createdBy: creator
                });
            }
        });
        
        res.json({
            success: true,
            message: 'Группа создана успешно',
            group
        });
        
        console.log(`✅ Group created: ${name} by ${creator} with ${validMembers.length} members`);
        
    } catch (error) {
        console.error('❌ Create group error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка создания группы' 
        });
    }
});

/**
 * API: Получение списка групп пользователя
 */
app.get('/api/groups', authenticateToken, (req, res) => {
    try {
        const currentUser = req.user.username;
        const { type = 'all' } = req.query; // all, member, admin, public
        
        let userGroups = groups;
        
        if (type === 'member') {
            userGroups = groups.filter(group => 
                group.members && group.members.includes(currentUser)
            );
        } else if (type === 'admin') {
            userGroups = groups.filter(group => 
                group.admins && group.admins.includes(currentUser)
            );
        } else if (type === 'public') {
            userGroups = groups.filter(group => group.isPublic);
        }
        
        // Добавляем информацию о последнем сообщении и статистику
        const groupsWithInfo = userGroups.map(group => {
            const groupMessages = messages.filter(msg => 
                msg.type === 'group' && msg.groupId === group.id
            );
            
            const lastMessage = groupMessages.length > 0 
                ? groupMessages[groupMessages.length - 1]
                : null;
            
            const unreadCount = groupMessages.filter(msg => 
                !msg.read && msg.sender !== currentUser
            ).length;
            
            return {
                ...group,
                memberCount: group.members ? group.members.length : 0,
                messageCount: groupMessages.length,
                lastMessage,
                unreadCount,
                isMember: group.members && group.members.includes(currentUser),
                isAdmin: group.admins && group.admins.includes(currentUser)
            };
        });
        
        // Сортировка по времени последнего сообщения
        groupsWithInfo.sort((a, b) => {
            if (!a.lastMessage && !b.lastMessage) return 0;
            if (!a.lastMessage) return 1;
            if (!b.lastMessage) return -1;
            return new Date(b.lastMessage.date) - new Date(a.lastMessage.date);
        });
        
        res.json({
            success: true,
            groups: groupsWithInfo,
            total: groupsWithInfo.length
        });
        
    } catch (error) {
        console.error('❌ Get groups error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения групп' 
        });
    }
});

/**
 * API: Получение информации о группе
 */
app.get('/api/groups/:groupId', authenticateToken, (req, res) => {
    try {
        const { groupId } = req.params;
        const currentUser = req.user.username;
        
        const group = groups.find(g => g.id === groupId);
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Группа не найдена' 
            });
        }
        
        // Проверка доступа
        if (!group.isPublic && (!group.members || !group.members.includes(currentUser))) {
            return res.status(403).json({ 
                success: false, 
                error: 'Доступ к группе запрещен' 
            });
        }
        
        // Получаем информацию об участниках
        const membersInfo = (group.members || []).map(username => {
            const user = findUser(username);
            return user ? {
                username: user.username,
                avatar: user.avatar,
                isOnline: onlineUsers.has(user.username),
                isAdmin: group.admins && group.admins.includes(user.username),
                joinedAt: user.createdAt
            } : null;
        }).filter(Boolean);
        
        // Получаем статистику группы
        const groupMessages = messages.filter(msg => 
            msg.type === 'group' && msg.groupId === groupId
        );
        
        res.json({
            success: true,
            group: {
                ...group,
                members: membersInfo,
                memberCount: membersInfo.length,
                messageCount: groupMessages.length,
                isMember: group.members && group.members.includes(currentUser),
                isAdmin: group.admins && group.admins.includes(currentUser),
                statistics: {
                    totalMessages: groupMessages.length,
                    lastActivity: groupMessages.length > 0 
                        ? groupMessages[groupMessages.length - 1].date 
                        : group.createdAt,
                    filesCount: groupMessages.filter(msg => msg.fileData).length,
                    voiceCount: groupMessages.filter(msg => msg.messageType === 'voice').length
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Get group error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения информации о группе' 
        });
    }
});

/**
 * API: Получение сообщений группы
 */
app.get('/api/groups/:groupId/messages', authenticateToken, (req, res) => {
    try {
        const { groupId } = req.params;
        const currentUser = req.user.username;
        const { limit = 100, before = null } = req.query;
        
        const group = groups.find(g => g.id === groupId);
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Группа не найдена' 
            });
        }
        
        // Проверка доступа
        if (!group.isPublic && (!group.members || !group.members.includes(currentUser))) {
            return res.status(403).json({ 
                success: false, 
                error: 'Доступ к сообщениям группы запрещен' 
            });
        }
        
        // Фильтрация сообщений группы
        let groupMessages = messages.filter(msg => 
            msg.type === 'group' && msg.groupId === groupId
        );
        
        // Фильтрация по времени если указано
        if (before) {
            const beforeDate = new Date(before);
            groupMessages = groupMessages.filter(msg => new Date(msg.date) < beforeDate);
        }
        
        // Сортировка по времени (старые в начале)
        groupMessages.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Ограничение количества
        const limitedMessages = groupMessages.slice(-parseInt(limit));
        
        // Помечаем сообщения как прочитанные для текущего пользователя
        const unreadMessages = limitedMessages.filter(msg => 
            !msg.readBy || !msg.readBy.includes(currentUser)
        );
        
        if (unreadMessages.length > 0) {
            unreadMessages.forEach(msg => {
                if (!msg.readBy) msg.readBy = [];
                if (!msg.readBy.includes(currentUser)) {
                    msg.readBy.push(currentUser);
                }
            });
            
            // Сохраняем асинхронно
            saveMessages().catch(console.error);
        }
        
        res.json({
            success: true,
            messages: limitedMessages,
            total: groupMessages.length,
            hasMore: groupMessages.length > parseInt(limit),
            groupId,
            unreadCount: unreadMessages.length
        });
        
    } catch (error) {
        console.error('❌ Get group messages error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения сообщений группы' 
        });
    }
});

/**
 * API: Вступление в группу
 */
app.post('/api/groups/:groupId/join', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const currentUser = req.user.username;
        
        const group = groups.find(g => g.id === groupId);
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Группа не найдена' 
            });
        }
        
        if (!group.isPublic) {
            return res.status(403).json({ 
                success: false, 
                error: 'Группа является приватной' 
            });
        }
        
        if (group.members && group.members.includes(currentUser)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Вы уже являетесь участником этой группы' 
            });
        }
        
        // Добавляем пользователя в группу
        if (!group.members) group.members = [];
        group.members.push(currentUser);
        
        await saveGroups();
        
        // Уведомляем участников группы
        group.members.forEach(member => {
            const memberSocketId = userSockets.get(member);
            if (memberSocketId) {
                io.to(memberSocketId).emit('group_member_joined', {
                    groupId,
                    username: currentUser,
                    joinedAt: new Date().toISOString()
                });
            }
        });
        
        res.json({
            success: true,
            message: 'Вы успешно присоединились к группе',
            group
        });
        
        console.log(`✅ User joined group: ${currentUser} -> ${group.name}`);
        
    } catch (error) {
        console.error('❌ Join group error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка вступления в группу' 
        });
    }
});

/**
 * API: Выход из группы
 */
app.post('/api/groups/:groupId/leave', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const currentUser = req.user.username;
        
        const group = groups.find(g => g.id === groupId);
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Группа не найдена' 
            });
        }
        
        if (!group.members || !group.members.includes(currentUser)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Вы не являетесь участником этой группы' 
            });
        }
        
        // Нельзя покинуть группу если вы создатель
        if (group.createdBy === currentUser) {
            return res.status(400).json({ 
                success: false, 
                error: 'Создатель группы не может покинуть её' 
            });
        }
        
        // Удаляем пользователя из группы
        group.members = group.members.filter(member => member !== currentUser);
        
        // Удаляем из администраторов если был
        if (group.admins) {
            group.admins = group.admins.filter(admin => admin !== currentUser);
        }
        
        await saveGroups();
        
        // Уведомляем участников группы
        group.members.forEach(member => {
            const memberSocketId = userSockets.get(member);
            if (memberSocketId) {
                io.to(memberSocketId).emit('group_member_left', {
                    groupId,
                    username: currentUser,
                    leftAt: new Date().toISOString()
                });
            }
        });
        
        res.json({
            success: true,
            message: 'Вы успешно покинули группу',
            groupId
        });
        
        console.log(`✅ User left group: ${currentUser} -> ${group.name}`);
        
    } catch (error) {
        console.error('❌ Leave group error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка выхода из группы' 
        });
    }
});

/**
 * API: Управление участниками группы (только для администраторов)
 */
app.post('/api/groups/:groupId/members', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { action, username, role } = req.body;
        const currentUser = req.user.username;
        
        const group = groups.find(g => g.id === groupId);
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                error: 'Группа не найдена' 
            });
        }
        
        // Проверка прав администратора
        if (!group.admins || !group.admins.includes(currentUser)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Требуются права администратора' 
            });
        }
        
        // Проверка существования пользователя
        if (!userExists(username)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        if (action === 'add') {
            // Добавление пользователя в группу
            if (group.members && group.members.includes(username)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Пользователь уже является участником группы' 
                });
            }
            
            if (!group.members) group.members = [];
            group.members.push(username);
            
            // Уведомление пользователя
            const userSocketId = userSockets.get(username);
            if (userSocketId) {
                io.to(userSocketId).emit('group_invitation', {
                    groupId,
                    groupName: group.name,
                    invitedBy: currentUser,
                    invitedAt: new Date().toISOString()
                });
            }
            
            res.json({
                success: true,
                message: `Пользователь ${username} добавлен в группу`
            });
            
        } else if (action === 'remove') {
            // Удаление пользователя из группы
            if (!group.members || !group.members.includes(username)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Пользователь не является участником группы' 
                });
            }
            
            // Нельзя удалить создателя
            if (group.createdBy === username) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Нельзя удалить создателя группы' 
                });
            }
            
            group.members = group.members.filter(member => member !== username);
            
            // Удаляем из администраторов если был
            if (group.admins) {
                group.admins = group.admins.filter(admin => admin !== username);
            }
            
            // Уведомление пользователя
            const userSocketId = userSockets.get(username);
            if (userSocketId) {
                io.to(userSocketId).emit('group_removed', {
                    groupId,
                    groupName: group.name,
                    removedBy: currentUser,
                    removedAt: new Date().toISOString()
                });
            }
            
            res.json({
                success: true,
                message: `Пользователь ${username} удален из группы`
            });
            
        } else if (action === 'promote' || action === 'demote') {
            // Изменение роли пользователя
            if (!group.members || !group.members.includes(username)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Пользователь не является участником группы' 
                });
            }
            
            if (!group.admins) group.admins = [];
            
            if (action === 'promote') {
                // Назначение администратором
                if (group.admins.includes(username)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Пользователь уже является администратором' 
                    });
                }
                
                group.admins.push(username);
                res.json({
                    success: true,
                    message: `Пользователь ${username} назначен администратором`
                });
                
            } else if (action === 'demote') {
                // Снятие прав администратора
                if (!group.admins.includes(username)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Пользователь не является администратором' 
                    });
                }
                
                // Нельзя снять права у создателя
                if (group.createdBy === username) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Нельзя снять права администратора у создателя группы' 
                    });
                }
                
                group.admins = group.admins.filter(admin => admin !== username);
                res.json({
                    success: true,
                    message: `Пользователь ${username} лишен прав администратора`
                });
            }
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'Неизвестное действие' 
            });
        }
        
        await saveGroups();
        
        // Уведомляем всех участников группы об изменениях
        group.members.forEach(member => {
            const memberSocketId = userSockets.get(member);
            if (memberSocketId) {
                io.to(memberSocketId).emit('group_updated', {
                    groupId,
                    action,
                    username,
                    by: currentUser,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Group members management error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка управления участниками группы' 
        });
    }
});

/**
 * API: Получение ежедневной награды
 */
app.get('/api/currency/daily-reward', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const userCurrency = initUserCurrency(username);
        const now = new Date();
        
        // Проверяем, получал ли пользователь награду сегодня
        if (userCurrency.lastDailyReward) {
            const lastReward = new Date(userCurrency.lastDailyReward);
            const timeDiff = now - lastReward;
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            if (hoursDiff < 23) {
                const hoursLeft = Math.ceil(23 - hoursDiff);
                return res.status(400).json({
                    success: false,
                    error: `Вы уже получали награду сегодня. Следующая награда через ${hoursLeft} часов`,
                    nextRewardIn: hoursLeft
                });
            }
            
            // Проверяем серию (получал ли вчера)
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (lastReward.toDateString() === yesterday.toDateString()) {
                // Продолжаем серию
                userCurrency.dailyStreak++;
            } else if (hoursDiff >= 48) {
                // Сбрасываем серию (пропустил день)
                userCurrency.dailyStreak = 1;
            }
            // Если получал сегодня, но уже прошло 23+ часов, продолжаем серию
        } else {
            // Первая награда
            userCurrency.dailyStreak = 1;
        }
        
        // Рассчитываем награду
        const baseReward = 50;
        const streakBonus = Math.min(userCurrency.dailyStreak * 10, 100); // Максимум +100 за серию
        const totalReward = baseReward + streakBonus;
        
        // Обновляем баланс
        userCurrency.balance += totalReward;
        userCurrency.lastDailyReward = now.toISOString();
        
        // Добавляем запись в историю
        userCurrency.transactionHistory.unshift({
            type: 'daily_reward',
            amount: totalReward,
            description: `Ежедневная награда (серия: ${userCurrency.dailyStreak} дней)`,
            timestamp: now.toISOString(),
            streak: userCurrency.dailyStreak
        });
        
        // Ограничиваем историю последними 100 транзакциями
        if (userCurrency.transactionHistory.length > 100) {
            userCurrency.transactionHistory = userCurrency.transactionHistory.slice(0, 100);
        }
        
        await saveCurrencyData();
        
        res.json({
            success: true,
            message: `Получено ${totalReward} монет! Серия: ${userCurrency.dailyStreak} дней`,
            reward: {
                base: baseReward,
                streakBonus: streakBonus,
                total: totalReward
            },
            currency: {
                balance: userCurrency.balance,
                streak: userCurrency.dailyStreak,
                lastReward: userCurrency.lastDailyReward
            }
        });
        
        console.log(`💰 Daily reward claimed: ${username} received ${totalReward} coins (streak: ${userCurrency.dailyStreak})`);
        
    } catch (error) {
        console.error('❌ Daily reward error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения ежедневной награды'
        });
    }
});

/**
 * API: Получение информации о валюте пользователя
 */
app.get('/api/currency', authenticateToken, (req, res) => {
    try {
        const username = req.user.username;
        const userCurrency = initUserCurrency(username);
        
        // Проверяем возможность получения ежедневной награды
        let canClaimDaily = true;
        let nextDailyReward = null;
        
        if (userCurrency.lastDailyReward) {
            const lastReward = new Date(userCurrency.lastDailyReward);
            const now = new Date();
            const timeDiff = now - lastReward;
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            if (hoursDiff < 23) {
                canClaimDaily = false;
                const nextRewardTime = new Date(lastReward);
                nextRewardTime.setHours(nextRewardTime.getHours() + 23);
                nextDailyReward = nextRewardTime.toISOString();
            }
        }
        
        res.json({
            success: true,
            currency: {
                balance: userCurrency.balance,
                streak: userCurrency.dailyStreak,
                lastDailyReward: userCurrency.lastDailyReward,
                transactionHistory: userCurrency.transactionHistory.slice(0, 20), // Последние 20 транзакций
                canClaimDaily,
                nextDailyReward
            }
        });
        
    } catch (error) {
        console.error('❌ Get currency error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения информации о валюте'
        });
    }
});

/**
 * API: Отправка подарка
 */
app.post('/api/gifts/send', authenticateToken, async (req, res) => {
    try {
        const { receiver, giftId, giftName, giftPrice, giftImage, message = '' } = req.body;
        const sender = req.user.username;
        
        if (!receiver || !giftId || !giftName || giftPrice === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Необходимо указать получателя и информацию о подарке'
            });
        }
        
        // Проверка существования получателя
        if (!userExists(receiver)) {
            return res.status(404).json({
                success: false,
                error: 'Получатель не найден'
            });
        }
        
        // Нельзя отправлять подарок самому себе
        if (sender === receiver) {
            return res.status(400).json({
                success: false,
                error: 'Нельзя отправлять подарок самому себе'
            });
        }
        
        // Проверка баланса отправителя
        const senderCurrency = initUserCurrency(sender);
        if (senderCurrency.balance < giftPrice) {
            return res.status(400).json({
                success: false,
                error: 'Недостаточно монет для отправки подарка'
            });
        }
        
        // Проверяем, не отправлял ли уже подарок сегодня этому пользователю
        const today = new Date().toDateString();
        const alreadySentToday = giftsData[sender]?.sent?.some(gift => 
            gift.receiver === receiver && 
            new Date(gift.sentAt).toDateString() === today
        );
        
        if (alreadySentToday) {
            return res.status(400).json({
                success: false,
                error: 'Вы уже отправляли подарок этому пользователю сегодня'
            });
        }
        
        // Списываем монеты у отправителя
        senderCurrency.balance -= giftPrice;
        senderCurrency.transactionHistory.unshift({
            type: 'gift_sent',
            amount: -giftPrice,
            description: `Подарок для ${receiver}: ${giftName}${message ? ` (${message})` : ''}`,
            timestamp: new Date().toISOString(),
            receiver: receiver,
            giftId: giftId
        });
        
        // Создаем запись о подарке
        const gift = {
            id: `gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            giftId,
            name: giftName,
            price: giftPrice,
            image: giftImage || '/static/default-gift.png',
            sender,
            receiver,
            message: message || '',
            sentAt: new Date().toISOString(),
            isRead: false,
            isDelivered: false
        };
        
        // Добавляем подарок в данные отправителя и получателя
        const senderGifts = initUserGifts(sender);
        const receiverGifts = initUserGifts(receiver);
        
        senderGifts.sent.unshift(gift);
        receiverGifts.received.unshift(gift);
        
        // Дарим бонус получателю (10% от стоимости подарка)
        const receiverBonus = Math.floor(giftPrice * 0.1);
        const receiverCurrency = initUserCurrency(receiver);
        receiverCurrency.balance += receiverBonus;
        receiverCurrency.transactionHistory.unshift({
            type: 'gift_received',
            amount: receiverBonus,
            description: `Бонус за подарок от ${sender}: ${giftName}`,
            timestamp: new Date().toISOString(),
            sender: sender,
            giftId: giftId
        });
        
        // Сохраняем данные
        await Promise.all([
            saveCurrencyData(),
            saveGiftsData()
        ]);
        
        // Уведомляем получателя
        const receiverSocketId = userSockets.get(receiver);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('gift_received', {
                gift,
                bonus: receiverBonus,
                from: sender,
                timestamp: new Date().toISOString()
            });
        }
        
        // Уведомляем отправителя об успешной отправке
        const senderSocketId = userSockets.get(sender);
        if (senderSocketId) {
            io.to(senderSocketId).emit('gift_sent_success', {
                gift,
                newBalance: senderCurrency.balance
            });
        }
        
        res.json({
            success: true,
            message: `Подарок "${giftName}" успешно отправлен пользователю ${receiver}!`,
            gift: {
                ...gift,
                bonusGiven: receiverBonus
            },
            senderBalance: senderCurrency.balance,
            receiverBonus: receiverBonus
        });
        
        console.log(`🎁 Gift sent: ${sender} -> ${receiver} (${giftName}, ${giftPrice} coins)`);
        
    } catch (error) {
        console.error('❌ Send gift error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка отправки подарка'
        });
    }
});

/**
 * API: Получение подарков пользователя
 */
app.get('/api/gifts', authenticateToken, (req, res) => {
    try {
        const username = req.user.username;
        const { type = 'received', limit = 20, offset = 0 } = req.query;
        
        const userGifts = getUserGifts(username);
        let gifts = [];
        
        if (type === 'received') {
            gifts = userGifts.received || [];
        } else if (type === 'sent') {
            gifts = userGifts.sent || [];
        } else if (type === 'unread') {
            gifts = (userGifts.received || []).filter(gift => !gift.isRead);
        }
        
        // Сортировка по времени (новые первые)
        gifts.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
        
        // Пагинация
        const paginatedGifts = gifts.slice(
            parseInt(offset),
            parseInt(offset) + parseInt(limit)
        );
        
        // Помечаем полученные подарки как прочитанные
        if (type === 'received' || type === 'unread') {
            const unreadGifts = paginatedGifts.filter(gift => !gift.isRead);
            if (unreadGifts.length > 0) {
                unreadGifts.forEach(gift => {
                    gift.isRead = true;
                    gift.readAt = new Date().toISOString();
                });
                
                // Сохраняем асинхронно
                saveGiftsData().catch(console.error);
            }
        }
        
        res.json({
            success: true,
            gifts: paginatedGifts,
            pagination: {
                total: gifts.length,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + parseInt(limit) < gifts.length
            },
            statistics: {
                totalReceived: (userGifts.received || []).length,
                totalSent: (userGifts.sent || []).length,
                unreadCount: (userGifts.received || []).filter(gift => !gift.isRead).length
            }
        });
        
    } catch (error) {
        console.error('❌ Get gifts error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения подарков'
        });
    }
});

/**
 * API: Получение доступных подарков
 */
app.get('/api/gifts/shop', authenticateToken, (req, res) => {
    try {
        // Список доступных подарков
        const availableGifts = [
            {
                id: 'gift_rose',
                name: 'Роза',
                price: 10,
                image: '/static/gifts/rose.png',
                description: 'Красная роза как символ любви и уважения',
                category: 'flowers'
            },
            {
                id: 'gift_chocolate',
                name: 'Шоколад',
                price: 15,
                image: '/static/gifts/chocolate.png',
                description: 'Сладкий подарок для хорошего настроения',
                category: 'food'
            },
            {
                id: 'gift_crown',
                name: 'Корона',
                price: 50,
                image: '/static/gifts/crown.png',
                description: 'Корона для короля или королевы чата',
                category: 'premium'
            },
            {
                id: 'gift_star',
                name: 'Звезда',
                price: 30,
                image: '/static/gifts/star.png',
                description: 'Сияющая звезда для особенных людей',
                category: 'premium'
            },
            {
                id: 'gift_heart',
                name: 'Сердце',
                price: 20,
                image: '/static/gifts/heart.png',
                description: 'Сердечко для выражения симпатии',
                category: 'emotions'
            },
            {
                id: 'gift_coffee',
                name: 'Кофе',
                price: 12,
                image: '/static/gifts/coffee.png',
                description: 'Чашечка кофе для бодрости',
                category: 'food'
            },
            {
                id: 'gift_diamond',
                name: 'Алмаз',
                price: 100,
                image: '/static/gifts/diamond.png',
                description: 'Драгоценный алмаз для самых важных людей',
                category: 'premium'
            },
            {
                id: 'gift_music',
                name: 'Музыка',
                price: 25,
                image: '/static/gifts/music.png',
                description: 'Музыкальная нота для меломанов',
                category: 'hobbies'
            },
            {
                id: 'gift_game',
                name: 'Игра',
                price: 40,
                image: '/static/gifts/game.png',
                description: 'Игровой контроллер для геймеров',
                category: 'hobbies'
            },
            {
                id: 'gift_book',
                name: 'Книга',
                price: 18,
                image: '/static/gifts/book.png',
                description: 'Книга знаний для любознательных',
                category: 'hobbies'
            }
        ];
        
        // Группировка по категориям
        const giftsByCategory = {};
        availableGifts.forEach(gift => {
            if (!giftsByCategory[gift.category]) {
                giftsByCategory[gift.category] = [];
            }
            giftsByCategory[gift.category].push(gift);
        });
        
        res.json({
            success: true,
            gifts: availableGifts,
            byCategory: giftsByCategory,
            categories: [
                { id: 'flowers', name: 'Цветы', icon: '🌹' },
                { id: 'food', name: 'Еда', icon: '🍫' },
                { id: 'premium', name: 'Премиум', icon: '👑' },
                { id: 'emotions', name: 'Эмоции', icon: '❤️' },
                { id: 'hobbies', name: 'Хобби', icon: '🎮' }
            ]
        });
        
    } catch (error) {
        console.error('❌ Get gifts shop error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения магазина подарков'
        });
    }
});

/**
 * API: Получение статистики подарков
 */
app.get('/api/gifts/stats', authenticateToken, (req, res) => {
    try {
        const username = req.user.username;
        
        const allGifts = [];
        for (const user in giftsData) {
            if (giftsData[user].received) {
                allGifts.push(...giftsData[user].received.map(gift => ({ ...gift, recipient: user })));
            }
        }
        
        // Самые популярные подарки
        const giftCounts = {};
        allGifts.forEach(gift => {
            if (!giftCounts[gift.giftId]) {
                giftCounts[gift.giftId] = {
                    giftId: gift.giftId,
                    name: gift.name,
                    count: 0,
                    totalSpent: 0
                };
            }
            giftCounts[gift.giftId].count++;
            giftCounts[gift.giftId].totalSpent += gift.price;
        });
        
        const popularGifts = Object.values(giftCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        // Самые щедрые отправители
        const senderStats = {};
        allGifts.forEach(gift => {
            if (!senderStats[gift.sender]) {
                senderStats[gift.sender] = {
                    username: gift.sender,
                    sentCount: 0,
                    totalSpent: 0
                };
            }
            senderStats[gift.sender].sentCount++;
            senderStats[gift.sender].totalSpent += gift.price;
        });
        
        const topSenders = Object.values(senderStats)
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 10);
        
        // Статистика по пользователю
        const userGifts = getUserGifts(username);
        const userStats = {
            sentCount: userGifts.sent?.length || 0,
            receivedCount: userGifts.received?.length || 0,
            totalSpent: userGifts.sent?.reduce((sum, gift) => sum + gift.price, 0) || 0,
            totalReceived: userGifts.received?.reduce((sum, gift) => sum + gift.price, 0) || 0
        };
        
        res.json({
            success: true,
            globalStats: {
                totalGifts: allGifts.length,
                totalUsers: Object.keys(giftsData).length,
                totalSpent: allGifts.reduce((sum, gift) => sum + gift.price, 0)
            },
            popularGifts,
            topSenders,
            userStats
        });
        
    } catch (error) {
        console.error('❌ Get gifts stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения статистики подарков'
        });
    }
});

/**
 * API: Административные функции - добавление валюты
 */
app.post('/api/admin/currency/add', authenticateAdmin, async (req, res) => {
    try {
        const { username, amount, reason } = req.body;
        const admin = req.user.username;
        
        if (!username || !amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Укажите пользователя и корректную сумму'
            });
        }
        
        if (!userExists(username)) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        const userCurrency = initUserCurrency(username);
        userCurrency.balance += parseFloat(amount);
        
        userCurrency.transactionHistory.unshift({
            type: 'admin_add',
            amount: parseFloat(amount),
            description: reason || 'Административное начисление',
            timestamp: new Date().toISOString(),
            admin: admin
        });
        
        await saveCurrencyData();
        
        res.json({
            success: true,
            message: `Начислено ${amount} монет пользователю ${username}`,
            user: username,
            amount: parseFloat(amount),
            newBalance: userCurrency.balance,
            reason: reason || 'Административное начисление'
        });
        
        console.log(`🔧 Admin ${admin} added ${amount} currency to ${username}. Reason: ${reason}`);
        
    } catch (error) {
        console.error('❌ Admin add currency error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка начисления валюты'
        });
    }
});

/**
 * API: Административные функции - удаление валюты
 */
app.post('/api/admin/currency/remove', authenticateAdmin, async (req, res) => {
    try {
        const { username, amount, reason } = req.body;
        const admin = req.user.username;
        
        if (!username || !amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Укажите пользователя и корректную сумму'
            });
        }
        
        if (!userExists(username)) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        const userCurrency = initUserCurrency(username);
        if (userCurrency.balance < amount) {
            return res.status(400).json({
                success: false,
                error: 'У пользователя недостаточно монет'
            });
        }
        
        userCurrency.balance -= parseFloat(amount);
        
        userCurrency.transactionHistory.unshift({
            type: 'admin_remove',
            amount: -parseFloat(amount),
            description: reason || 'Административное списание',
            timestamp: new Date().toISOString(),
            admin: admin
        });
        
        await saveCurrencyData();
        
        res.json({
            success: true,
            message: `Списано ${amount} монет у пользователя ${username}`,
            user: username,
            amount: parseFloat(amount),
            newBalance: userCurrency.balance,
            reason: reason || 'Административное списание'
        });
        
        console.log(`🔧 Admin ${admin} removed ${amount} currency from ${username}. Reason: ${reason}`);
        
    } catch (error) {
        console.error('❌ Admin remove currency error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка списания валюты'
        });
    }
});

/**
 * API: Административные функции - отправка уведомления
 */
app.post('/api/admin/notify', authenticateAdmin, async (req, res) => {
    try {
        const { title, message, type = 'info', target = 'all', targetUser = null } = req.body;
        const admin = req.user.username;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Сообщение обязательно'
            });
        }
        
        const notification = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: title || 'Системное уведомление',
            message,
            type,
            sender: admin,
            target,
            targetUser,
            timestamp: new Date().toISOString(),
            isSystem: true
        };
        
        systemNotifications.unshift(notification);
        
        // Ограничиваем количество уведомлений
        if (systemNotifications.length > 1000) {
            systemNotifications = systemNotifications.slice(0, 500);
        }
        
        // Отправляем уведомление через WebSocket
        if (target === 'all') {
            io.emit('system_notification', notification);
        } else if (target === 'user' && targetUser) {
            const targetSocketId = userSockets.get(targetUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('system_notification', notification);
            }
        }
        
        res.json({
            success: true,
            message: 'Уведомление отправлено',
            notification
        });
        
        console.log(`🔧 Admin ${admin} sent notification: ${title || message}`);
        
    } catch (error) {
        console.error('❌ Admin notify error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка отправки уведомления'
        });
    }
});

/**
 * API: Административные функции - получение статистики сервера
 */
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    try {
        const stats = {
            users: {
                total: users.length,
                online: onlineUsers.size,
                registeredToday: users.filter(user => {
                    const regDate = new Date(user.createdAt);
                    const today = new Date();
                    return regDate.toDateString() === today.toDateString();
                }).length,
                activeToday: Array.from(onlineUsers).filter(username => {
                    const user = findUser(username);
                    return user && user.lastLogin && 
                        new Date(user.lastLogin).toDateString() === new Date().toDateString();
                }).length
            },
            messages: {
                total: messages.length,
                today: messages.filter(msg => 
                    new Date(msg.date).toDateString() === new Date().toDateString()
                ).length,
                private: messages.filter(msg => msg.type === 'private').length,
                group: messages.filter(msg => msg.type === 'group').length,
                withFiles: messages.filter(msg => msg.fileData).length,
                voice: messages.filter(msg => msg.messageType === 'voice').length
            },
            groups: {
                total: groups.length,
                public: groups.filter(g => g.isPublic).length,
                private: groups.filter(g => !g.isPublic).length,
                averageMembers: groups.length > 0 
                    ? groups.reduce((sum, g) => sum + (g.members?.length || 0), 0) / groups.length 
                    : 0
            },
            currency: {
                totalUsers: Object.keys(currencyData).length,
                totalBalance: Object.values(currencyData).reduce((sum, curr) => sum + curr.balance, 0),
                averageBalance: Object.keys(currencyData).length > 0
                    ? Object.values(currencyData).reduce((sum, curr) => sum + curr.balance, 0) / Object.keys(currencyData).length
                    : 0,
                dailyRewards: Object.values(currencyData).filter(curr => 
                    curr.lastDailyReward && 
                    new Date(curr.lastDailyReward).toDateString() === new Date().toDateString()
                ).length
            },
            gifts: {
                totalSent: Object.values(giftsData).reduce((sum, g) => sum + (g.sent?.length || 0), 0),
                totalReceived: Object.values(giftsData).reduce((sum, g) => sum + (g.received?.length || 0), 0),
                totalSpent: Object.values(giftsData).reduce((sum, g) => 
                    sum + (g.sent?.reduce((s, gift) => s + gift.price, 0) || 0), 0
                ),
                uniqueSenders: new Set(
                    Object.values(giftsData)
                        .flatMap(g => g.sent?.map(gift => gift.sender) || [])
                ).size
            },
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                platform: process.platform,
                nodeVersion: process.version,
                connections: io.engine.clientsCount,
                notifications: systemNotifications.length
            }
        };
        
        res.json({
            success: true,
            stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Admin stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения статистики'
        });
    }
});

/**
 * API: Административные функции - очистка старых данных
 */
app.post('/api/admin/cleanup', authenticateAdmin, async (req, res) => {
    try {
        const { days = 30, type = 'all' } = req.body;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
        
        let cleaned = {
            messages: 0,
            notifications: 0,
            uploads: 0
        };
        
        if (type === 'all' || type === 'messages') {
            const initialCount = messages.length;
            messages = messages.filter(msg => new Date(msg.date) > cutoffDate);
            cleaned.messages = initialCount - messages.length;
            await saveMessages();
        }
        
        if (type === 'all' || type === 'notifications') {
            const initialCount = systemNotifications.length;
            systemNotifications = systemNotifications.filter(notif => 
                new Date(notif.timestamp) > cutoffDate
            );
            cleaned.notifications = initialCount - systemNotifications.length;
        }
        
        if (type === 'all' || type === 'uploads') {
            const uploadsResult = await cleanupOldUploads();
            cleaned.uploads = uploadsResult.deleted;
        }
        
        res.json({
            success: true,
            message: `Очистка завершена за последние ${days} дней`,
            cleaned,
            cutoffDate: cutoffDate.toISOString()
        });
        
        console.log(`🔧 Admin cleanup: ${cleaned.messages} messages, ${cleaned.notifications} notifications, ${cleaned.uploads} files`);
        
    } catch (error) {
        console.error('❌ Admin cleanup error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка очистки данных'
        });
    }
});

/**
 * API: Получение уведомлений
 */
app.get('/api/notifications', authenticateToken, (req, res) => {
    try {
        const { limit = 50, unreadOnly = false } = req.query;
        const username = req.user.username;
        
        let userNotifications = systemNotifications;
        
        if (unreadOnly === 'true') {
            // В реальном приложении нужно хранить информацию о прочитанных уведомлениях
            // Здесь просто возвращаем все системные уведомления
            userNotifications = systemNotifications;
        }
        
        const notifications = userNotifications
            .slice(0, parseInt(limit))
            .map(notif => ({
                ...notif,
                isMine: notif.targetUser === username || 
                       (notif.target === 'user' && notif.targetUser === username) ||
                       notif.target === 'all'
            }));
        
        res.json({
            success: true,
            notifications,
            total: userNotifications.length,
            unreadCount: 0 // В реальном приложении нужно считать непрочитанные
        });
        
    } catch (error) {
        console.error('❌ Get notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения уведомлений'
        });
    }
});

/**
 * API: Проверка здоровья сервера
 */
app.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: {
            environment: isTauri ? 'tauri' : isProduction ? 'production' : 'development',
            port: PORT,
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            }
        },
        data: {
            users: users.length,
            messages: messages.length,
            groups: groups.length,
            onlineUsers: onlineUsers.size,
            connections: io.engine.clientsCount,
            currencyUsers: Object.keys(currencyData).length,
            giftsUsers: Object.keys(giftsData).length
        },
        services: {
            websocket: 'connected',
            database: 'connected',
            uploads: fsSync.existsSync(uploadsDir) ? 'available' : 'unavailable'
        }
    };
    
    res.json(health);
});

/**
 * API: Получение информации о сервере
 */
app.get('/api/server/info', authenticateToken, (req, res) => {
    try {
        const info = {
            name: 'Anonka Messenger',
            version: '1.0.0',
            environment: isTauri ? 'Tauri Desktop' : isProduction ? 'Production' : 'Development',
            uptime: process.uptime(),
            startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
            features: {
                privateMessages: true,
                groupChats: true,
                fileSharing: true,
                voiceMessages: true,
                videoCalls: true,
                screenSharing: true,
                currencySystem: true,
                gifts: true,
                notifications: true
            },
            limits: {
                maxFileSize: '100MB',
                maxMessageLength: 10000,
                maxGroupMembers: 1000,
                dailyReward: '50-150 coins',
                avatarSize: '10MB'
            },
            statistics: {
                totalUsers: users.length,
                onlineUsers: onlineUsers.size,
                totalMessages: messages.length,
                totalGroups: groups.length,
                activeCalls: activeCalls.size
            }
        };
        
        res.json({
            success: true,
            info
        });
        
    } catch (error) {
        console.error('❌ Get server info error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения информации о сервере'
        });
    }
});

/**
 * API: Получение файла
 */
app.get('/uploads/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(uploadsDir, filename);
        
        if (!fsSync.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Файл не найден'
            });
        }
        
        // Проверяем, является ли файл изображением для создания миниатюры
        if (req.query.size === 'thumb' && 
            (filename.endsWith('.jpg') || filename.endsWith('.jpeg') || 
             filename.endsWith('.png') || filename.endsWith('.gif'))) {
            
            const thumbFilename = `thumb_${filename}`;
            const thumbPath = path.join(uploadsDir, thumbFilename);
            
            if (!fsSync.existsSync(thumbPath)) {
                await createThumbnail(filePath, thumbPath, 300);
            }
            
            return res.sendFile(thumbPath);
        }
        
        // Определяем MIME тип
        const mimeType = getMimeType(filename);
        res.setHeader('Content-Type', mimeType);
        
        // Для изображений и PDF устанавливаем inline, для остальных - attachment
        if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        } else {
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        }
        
        res.sendFile(filePath);
        
    } catch (error) {
        console.error('❌ Get file error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения файла'
        });
    }
});

// WebSocket обработчики
io.on('connection', (socket) => {
    console.log('🔌 New connection:', socket.id);
    
    // Обработчик ошибок сокета
    socket.on('error', (error) => {
        console.error(`❌ Socket error (${socket.id}):`, error);
    });
    
    // Аутентификация пользователя
    socket.on('authenticate', async (data) => {
        try {
            const { token } = data;
            
            if (!token) {
                socket.emit('authentication_error', { error: 'Токен отсутствует' });
                socket.disconnect();
                return;
            }
            
            jwt.verify(token, JWT_SECRET, (err, decoded) => {
                if (err) {
                    socket.emit('authentication_error', { error: 'Недействительный токен' });
                    socket.disconnect();
                    return;
                }
                
                const username = decoded.username;
                const user = findUser(username);
                
                if (!user) {
                    socket.emit('authentication_error', { error: 'Пользователь не найден' });
                    socket.disconnect();
                    return;
                }
                
                // Сохраняем информацию о пользователе в сокете
                socket.username = username;
                socket.userId = username;
                socket.isAdmin = user.isAdmin || false;
                
                // Обновляем карту подключений
                const oldSocketId = userSockets.get(username);
                if (oldSocketId && oldSocketId !== socket.id) {
                    // Отключаем старое соединение
                    const oldSocket = io.sockets.sockets.get(oldSocketId);
                    if (oldSocket) {
                        oldSocket.disconnect(true);
                        console.log(`🔌 Disconnected old socket for ${username}`);
                    }
                }
                
                userSockets.set(username, socket.id);
                onlineUsers.add(username);
                userPresence.set(username, Date.now());
                
                // Обновляем статус пользователя в данных
                user.isOnline = true;
                user.lastLogin = new Date().toISOString();
                saveUsers().catch(console.error);
                
                // Уведомляем всех о новом онлайн пользователе
                io.emit('user_online', {
                    username,
                    timestamp: new Date().toISOString()
                });
                
                // Отправляем информацию о текущих онлайн пользователях
                const onlineUsersList = Array.from(onlineUsers).map(u => ({
                    username: u,
                    isOnline: true,
                    lastSeen: findUser(u)?.lastLogin
                }));
                
                socket.emit('authenticated', {
                    username,
                    isAdmin: socket.isAdmin,
                    onlineUsers: onlineUsersList,
                    serverTime: new Date().toISOString()
                });
                
                console.log(`✅ User authenticated: ${username} (${socket.id})`);
                
                // Отправляем непрочитанные сообщения
                const unreadMessages = messages.filter(msg => 
                    (msg.type === 'private' && msg.receiver === username && !msg.read) ||
                    (msg.type === 'group' && msg.groupId && !msg.readBy?.includes(username))
                );
                
                if (unreadMessages.length > 0) {
                    socket.emit('unread_messages', {
                        count: unreadMessages.length,
                        messages: unreadMessages.slice(0, 50)
                    });
                }
                
                // Отправляем непрочитанные подарки
                const userGifts = getUserGifts(username);
                const unreadGifts = (userGifts.received || []).filter(gift => !gift.isRead);
                if (unreadGifts.length > 0) {
                    socket.emit('unread_gifts', {
                        count: unreadGifts.length,
                        gifts: unreadGifts.slice(0, 10)
                    });
                }
                
            });
            
        } catch (error) {
            console.error('❌ Authentication error:', error);
            socket.emit('authentication_error', { error: 'Ошибка аутентификации' });
            socket.disconnect();
        }
    });
    
    // Обработка приватных сообщений
    socket.on('private_message', async (data) => {
        try {
            if (!socket.username) {
                socket.emit('error', { error: 'Требуется аутентификация' });
                return;
            }
            
            const { receiver, message, messageType = 'text', fileData = null } = data;
            const sender = socket.username;
            
            if (!receiver || (!message && !fileData)) {
                socket.emit('error', { error: 'Получатель и сообщение обязательны' });
                return;
            }
            
            if (sender === receiver) {
                socket.emit('error', { error: 'Нельзя отправлять сообщения самому себе' });
                return;
            }
            
            if (!userExists(receiver)) {
                socket.emit('error', { error: 'Получатель не найден' });
                return;
            }
            
            // Создаем объект сообщения
            const messageObj = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                sender,
                receiver,
                message: message || '',
                messageType,
                fileData,
                timestamp: new Date().toLocaleTimeString(),
                date: new Date().toISOString(),
                type: 'private',
                read: false,
                readAt: null
            };
            
            // Добавляем сообщение
            messages.push(messageObj);
            await saveMessages();
            
            // Отправляем отправителю
            socket.emit('private_message_sent', {
                ...messageObj,
                status: 'sent'
            });
            
            // Отправляем получателю если онлайн
            const receiverSocketId = userSockets.get(receiver);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('private_message', messageObj);
                
                // Обновляем статус доставки
                const sentMessage = messages.find(msg => msg.id === messageObj.id);
                if (sentMessage) {
                    sentMessage.delivered = true;
                    sentMessage.deliveredAt = new Date().toISOString();
                    saveMessages().catch(console.error);
                }
            }
            
            // Уведомляем об обновлении списка бесед
            io.to(socket.id).emit('conversation_updated', {
                with: receiver,
                lastMessage: messageObj
            });
            
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('conversation_updated', {
                    with: sender,
                    lastMessage: messageObj
                });
            }
            
            console.log(`📨 Private message: ${sender} -> ${receiver}`);
            
        } catch (error) {
            console.error('❌ Private message error:', error);
            socket.emit('error', { error: 'Ошибка отправки сообщения' });
        }
    });
    
    // Обработка групповых сообщений
    socket.on('group_message', async (data) => {
        try {
            if (!socket.username) {
                socket.emit('error', { error: 'Требуется аутентификация' });
                return;
            }
            
            const { groupId, message, messageType = 'text', fileData = null } = data;
            const sender = socket.username;
            
            if (!groupId || (!message && !fileData)) {
                socket.emit('error', { error: 'Группа и сообщение обязательны' });
                return;
            }
            
            const group = groups.find(g => g.id === groupId);
            if (!group) {
                socket.emit('error', { error: 'Группа не найдена' });
                return;
            }
            
            if (!group.members || !group.members.includes(sender)) {
                socket.emit('error', { error: 'Вы не являетесь участником этой группы' });
                return;
            }
            
            if (group.settings?.adminOnlyMessages && 
                (!group.admins || !group.admins.includes(sender))) {
                socket.emit('error', { error: 'Только администраторы могут отправлять сообщения' });
                return;
            }
            
            if (!group.settings?.allowMessages) {
                socket.emit('error', { error: 'Сообщения в этой группе запрещены' });
                return;
            }
            
            if (messageType === 'file' && !group.settings?.allowFiles) {
                socket.emit('error', { error: 'Отправка файлов в этой группе запрещена' });
                return;
            }
            
            if (messageType === 'voice' && !group.settings?.allowVoice) {
                socket.emit('error', { error: 'Голосовые сообщения в этой группе запрещены' });
                return;
            }
            
            // Создаем объект сообщения
            const messageObj = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                sender,
                groupId,
                message: message || '',
                messageType,
                fileData,
                timestamp: new Date().toLocaleTimeString(),
                date: new Date().toISOString(),
                type: 'group',
                readBy: [sender]
            };
            
            // Добавляем сообщение
            messages.push(messageObj);
            await saveMessages();
            
            // Отправляем отправителю
            socket.emit('group_message_sent', {
                ...messageObj,
                status: 'sent'
            });
            
            // Отправляем всем участникам группы
            group.members.forEach(member => {
                if (member !== sender) {
                    const memberSocketId = userSockets.get(member);
                    if (memberSocketId) {
                        io.to(memberSocketId).emit('group_message', messageObj);
                    }
                }
            });
            
            // Уведомляем об обновлении группы
            group.members.forEach(member => {
                const memberSocketId = userSockets.get(member);
                if (memberSocketId) {
                    io.to(memberSocketId).emit('group_updated', {
                        groupId,
                        action: 'new_message',
                        by: sender,
                        messageId: messageObj.id,
                        timestamp: messageObj.date
                    });
                }
            });
            
            console.log(`📢 Group message: ${sender} -> ${group.name} (${group.members.length} members)`);
            
        } catch (error) {
            console.error('❌ Group message error:', error);
            socket.emit('error', { error: 'Ошибка отправки сообщения' });
        }
    });
    
    // Отметка сообщений как прочитанных
    socket.on('mark_messages_read', async (data) => {
        try {
            if (!socket.username) return;
            
            const { messageIds, conversationId, isGroup = false } = data;
            const username = socket.username;
            
            if (!messageIds || !Array.isArray(messageIds)) return;
            
            let updatedCount = 0;
            
            for (const msgId of messageIds) {
                const message = messages.find(msg => msg.id === msgId);
                if (!message) continue;
                
                if (isGroup) {
                    // Групповое сообщение
                    if (message.type === 'group' && message.groupId === conversationId) {
                        if (!message.readBy) message.readBy = [];
                        if (!message.readBy.includes(username)) {
                            message.readBy.push(username);
                            updatedCount++;
                        }
                    }
                } else {
                    // Приватное сообщение
                    if (message.type === 'private' && 
                        ((message.sender === conversationId && message.receiver === username) ||
                         (message.sender === username && message.receiver === conversationId))) {
                        
                        if (!message.read) {
                            message.read = true;
                            message.readAt = new Date().toISOString();
                            updatedCount++;
                            
                            // Уведомляем отправителя о прочтении
                            if (message.sender !== username) {
                                const senderSocketId = userSockets.get(message.sender);
                                if (senderSocketId) {
                                    io.to(senderSocketId).emit('message_read', {
                                        messageId: msgId,
                                        reader: username,
                                        readAt: message.readAt
                                    });
                                }
                            }
                        }
                    }
                }
            }
            
            if (updatedCount > 0) {
                await saveMessages();
                socket.emit('messages_marked_read', {
                    count: updatedCount,
                    messageIds
                });
            }
            
        } catch (error) {
            console.error('❌ Mark messages read error:', error);
        }
    });
    
    // Инициализация звонка
    socket.on('initiate_call', (data) => {
        try {
            if (!socket.username) {
                socket.emit('call_error', { error: 'Требуется аутентификация' });
                return;
            }
            
            const { targetUser, callType = 'audio', callId } = data;
            const caller = socket.username;
            
            if (!targetUser || !callId) {
                socket.emit('call_error', { error: 'Получатель и ID звонка обязательны' });
                return;
            }
            
            if (caller === targetUser) {
                socket.emit('call_error', { error: 'Нельзя звонить самому себе' });
                return;
            }
            
            if (!userExists(targetUser)) {
                socket.emit('call_error', { error: 'Пользователь не найден' });
                return;
            }
            
            // Проверяем, не занят ли уже пользователь другим звонком
            if (activeCalls.has(targetUser)) {
                const existingCall = activeCalls.get(targetUser);
                if (existingCall.status === 'active' || existingCall.status === 'ringing') {
                    socket.emit('call_error', { error: 'Пользователь уже в звонке' });
                    return;
                }
            }
            
            // Создаем запись о звонке
            const call = {
                callId,
                caller,
                targetUser,
                callType,
                status: 'ringing',
                startTime: new Date().toISOString(),
                participants: [caller],
                iceCandidates: []
            };
            
            activeCalls.set(caller, call);
            activeCalls.set(targetUser, call);
            
            // Отправляем звонок получателю
            const targetSocketId = userSockets.get(targetUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('incoming_call', {
                    callId,
                    caller,
                    callType,
                    timestamp: new Date().toISOString()
                });
                
                socket.emit('call_initiated', {
                    callId,
                    targetUser,
                    status: 'ringing'
                });
                
                console.log(`📞 Call initiated: ${caller} -> ${targetUser} (${callType})`);
            } else {
                // Пользователь не в сети
                activeCalls.delete(caller);
                activeCalls.delete(targetUser);
                socket.emit('call_error', { error: 'Пользователь не в сети' });
            }
            
        } catch (error) {
            console.error('❌ Initiate call error:', error);
            socket.emit('call_error', { error: 'Ошибка инициализации звонка' });
        }
    });
    
    // Принятие звонка
    socket.on('accept_call', (data) => {
        try {
            if (!socket.username) return;
            
            const { callId } = data;
            const acceptor = socket.username;
            
            const call = activeCalls.get(acceptor);
            if (!call || call.callId !== callId || call.status !== 'ringing') {
                socket.emit('call_error', { error: 'Звонок не найден или уже принят' });
                return;
            }
            
            // Обновляем статус звонка
            call.status = 'active';
            call.participants.push(acceptor);
            call.answerTime = new Date().toISOString();
            
            // Уведомляем звонящего
            const callerSocketId = userSockets.get(call.caller);
            if (callerSocketId) {
                io.to(callerSocketId).emit('call_accepted', {
                    callId,
                    acceptor,
                    timestamp: new Date().toISOString()
                });
            }
            
            console.log(`✅ Call accepted: ${acceptor} accepted call from ${call.caller}`);
            
        } catch (error) {
            console.error('❌ Accept call error:', error);
            socket.emit('call_error', { error: 'Ошибка принятия звонка' });
        }
    });
    
    // Отклонение звонка
    socket.on('reject_call', (data) => {
        try {
            if (!socket.username) return;
            
            const { callId, reason = 'Отклонено' } = data;
            const rejector = socket.username;
            
            const call = activeCalls.get(rejector);
            if (!call || call.callId !== callId) return;
            
            // Обновляем статус звонка
            call.status = 'rejected';
            call.endTime = new Date().toISOString();
            call.endReason = reason;
            
            // Уведомляем другого участника
            const otherUser = call.caller === rejector ? call.targetUser : call.caller;
            const otherSocketId = userSockets.get(otherUser);
            if (otherSocketId) {
                io.to(otherSocketId).emit('call_rejected', {
                    callId,
                    by: rejector,
                    reason,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Удаляем запись о звонке
            activeCalls.delete(call.caller);
            activeCalls.delete(call.targetUser);
            
            console.log(`❌ Call rejected: ${rejector} rejected call ${callId}`);
            
        } catch (error) {
            console.error('❌ Reject call error:', error);
        }
    });
    
    // Завершение звонка
    socket.on('end_call', (data) => {
        try {
            if (!socket.username) return;
            
            const { callId, reason = 'Завершено' } = data;
            const ender = socket.username;
            
            const call = activeCalls.get(ender);
            if (!call || call.callId !== callId) return;
            
            // Обновляем статус звонка
            call.status = 'ended';
            call.endTime = new Date().toISOString();
            call.endReason = reason;
            call.endedBy = ender;
            
            // Уведомляем всех участников
            call.participants.forEach(participant => {
                const participantSocketId = userSockets.get(participant);
                if (participantSocketId) {
                    io.to(participantSocketId).emit('call_ended', {
                        callId,
                        by: ender,
                        reason,
                        duration: call.startTime ? 
                            (new Date() - new Date(call.startTime)) / 1000 : 0,
                        timestamp: new Date().toISOString()
                    });
                }
            });
            
            // Удаляем запись о звонке
            activeCalls.delete(call.caller);
            activeCalls.delete(call.targetUser);
            
            // Удаляем запись о трансляции экрана если была
            if (screenShares.has(ender)) {
                const screenShare = screenShares.get(ender);
                if (screenShare.callId === callId) {
                    screenShares.delete(ender);
                }
            }
            
            console.log(`📞 Call ended: ${ender} ended call ${callId}`);
            
        } catch (error) {
            console.error('❌ End call error:', error);
        }
    });
    
    // WebRTC сигналинг: отправка offer
    socket.on('webrtc_offer', (data) => {
        try {
            if (!socket.username) return;
            
            const { callId, targetUser, offer } = data;
            const sender = socket.username;
            
            const targetSocketId = userSockets.get(targetUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('webrtc_offer', {
                    callId,
                    sender,
                    offer,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error('❌ WebRTC offer error:', error);
        }
    });
    
    // WebRTC сигналинг: отправка answer
    socket.on('webrtc_answer', (data) => {
        try {
            if (!socket.username) return;
            
            const { callId, targetUser, answer } = data;
            const sender = socket.username;
            
            const targetSocketId = userSockets.get(targetUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('webrtc_answer', {
                    callId,
                    sender,
                    answer,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error('❌ WebRTC answer error:', error);
        }
    });
    
    // WebRTC сигналинг: отправка ICE candidate
    socket.on('webrtc_ice_candidate', (data) => {
        try {
            if (!socket.username) return;
            
            const { callId, targetUser, candidate } = data;
            const sender = socket.username;
            
            const targetSocketId = userSockets.get(targetUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('webrtc_ice_candidate', {
                    callId,
                    sender,
                    candidate,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error('❌ WebRTC ICE candidate error:', error);
        }
    });
    
    // Начало трансляции экрана
    socket.on('screen_share_started', (data) => {
        try {
            if (!socket.username) return;
            
            const { callId, targetUser } = data;
            const sharer = socket.username;
            
            // Сохраняем информацию о трансляции
            screenShares.set(sharer, {
                callId,
                sharer,
                targetUser,
                startTime: new Date().toISOString(),
                participants: [sharer]
            });
            
            // Уведомляем получателя
            const targetSocketId = userSockets.get(targetUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('screen_share_started', {
                    callId,
                    sharer,
                    timestamp: new Date().toISOString()
                });
            }
            
            console.log(`🖥️ Screen share started: ${sharer} -> ${targetUser}`);
            
        } catch (error) {
            console.error('❌ Screen share started error:', error);
        }
    });
    
    // Завершение трансляции экрана
    socket.on('screen_share_ended', (data) => {
        try {
            if (!socket.username) return;
            
            const { callId, targetUser } = data;
            const sharer = socket.username;
            
            // Удаляем информацию о трансляции
            screenShares.delete(sharer);
            
            // Уведомляем получателя
            const targetSocketId = userSockets.get(targetUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('screen_share_ended', {
                    callId,
                    sharer,
                    timestamp: new Date().toISOString()
                });
            }
            
            console.log(`🖥️ Screen share ended: ${sharer} -> ${targetUser}`);
            
        } catch (error) {
            console.error('❌ Screen share ended error:', error);
        }
    });
    
    // Отправка подарка через WebSocket
    socket.on('send_gift', async (data) => {
        try {
            if (!socket.username) {
                socket.emit('gift_error', { error: 'Требуется аутентификация' });
                return;
            }
            
            const { receiver, giftId, giftName, giftPrice, giftImage, message = '' } = data;
            const sender = socket.username;
            
            // Валидация
            if (!receiver || !giftId || !giftName || giftPrice === undefined) {
                socket.emit('gift_error', { error: 'Необходимо указать получателя и информацию о подарке' });
                return;
            }
            
            if (sender === receiver) {
                socket.emit('gift_error', { error: 'Нельзя отправлять подарок самому себе' });
                return;
            }
            
            if (!userExists(receiver)) {
                socket.emit('gift_error', { error: 'Получатель не найден' });
                return;
            }
            
            // Проверка баланса
            const senderCurrency = initUserCurrency(sender);
            if (senderCurrency.balance < giftPrice) {
                socket.emit('gift_error', { error: 'Недостаточно монет' });
                return;
            }
            
            // Создаем подарок
            const gift = {
                id: `gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                giftId,
                name: giftName,
                price: giftPrice,
                image: giftImage || '/static/default-gift.png',
                sender,
                receiver,
                message,
                sentAt: new Date().toISOString(),
                isRead: false
            };
            
            // Обновляем данные
            const senderGifts = initUserGifts(sender);
            const receiverGifts = initUserGifts(receiver);
            
            senderGifts.sent.unshift(gift);
            receiverGifts.received.unshift(gift);
            
            senderCurrency.balance -= giftPrice;
            senderCurrency.transactionHistory.unshift({
                type: 'gift_sent',
                amount: -giftPrice,
                description: `Подарок для ${receiver}: ${giftName}`,
                timestamp: new Date().toISOString()
            });
            
            // Бонус получателю
            const receiverBonus = Math.floor(giftPrice * 0.1);
            const receiverCurrency = initUserCurrency(receiver);
            receiverCurrency.balance += receiverBonus;
            receiverCurrency.transactionHistory.unshift({
                type: 'gift_received_bonus',
                amount: receiverBonus,
                description: `Бонус за подарок от ${sender}`,
                timestamp: new Date().toISOString()
            });
            
            await Promise.all([
                saveGiftsData(),
                saveCurrencyData()
            ]);
            
            // Уведомляем получателя
            const receiverSocketId = userSockets.get(receiver);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('gift_received', {
                    gift,
                    bonus: receiverBonus,
                    from: sender,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Подтверждаем отправителю
            socket.emit('gift_sent_success', {
                gift,
                newBalance: senderCurrency.balance,
                timestamp: new Date().toISOString()
            });
            
            console.log(`🎁 Gift sent via WS: ${sender} -> ${receiver} (${giftName})`);
            
        } catch (error) {
            console.error('❌ Send gift WS error:', error);
            socket.emit('gift_error', { error: 'Ошибка отправки подарка' });
        }
    });
    
    // Пинг для поддержания соединения
    socket.on('ping', (cb) => {
        if (typeof cb === 'function') {
            cb('pong');
        }
        
        // Обновляем время последней активности
        if (socket.username) {
            userPresence.set(socket.username, Date.now());
        }
    });
    
    // Получение онлайн пользователей
    socket.on('get_online_users', (cb) => {
        if (typeof cb === 'function') {
            const onlineUsersList = Array.from(onlineUsers).map(username => {
                const user = findUser(username);
                return {
                    username,
                    avatar: user?.avatar,
                    isOnline: true,
                    lastSeen: user?.lastLogin,
                    bio: user?.bio
                };
            });
            
            cb(onlineUsersList);
        }
    });
    
    // Обновление активности пользователя
    socket.on('update_presence', () => {
        if (socket.username) {
            userPresence.set(socket.username, Date.now());
        }
    });
    
    // Отключение пользователя
    socket.on('disconnect', (reason) => {
        console.log(`🔌 Disconnected: ${socket.id} (${socket.username || 'anonymous'}) - ${reason}`);
        
        if (socket.username) {
            const username = socket.username;
            
            // Удаляем из онлайн пользователей
            userSockets.delete(username);
            onlineUsers.delete(username);
            userPresence.delete(username);
            
            // Обновляем статус пользователя в данных
            const user = findUser(username);
            if (user) {
                user.isOnline = false;
                saveUsers().catch(console.error);
            }
            
            // Уведомляем всех о выходе пользователя
            io.emit('user_offline', {
                username,
                timestamp: new Date().toISOString()
            });
            
            // Завершаем активные звонки
            if (activeCalls.has(username)) {
                const call = activeCalls.get(username);
                if (call) {
                    call.status = 'ended';
                    call.endTime = new Date().toISOString();
                    call.endReason = 'Пользователь отключился';
                    call.endedBy = 'system';
                    
                    // Уведомляем другого участника
                    const otherUser = call.caller === username ? call.targetUser : call.caller;
                    const otherSocketId = userSockets.get(otherUser);
                    if (otherSocketId) {
                        io.to(otherSocketId).emit('call_ended', {
                            callId: call.callId,
                            by: 'system',
                            reason: 'Пользователь отключился',
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                    activeCalls.delete(call.caller);
                    activeCalls.delete(call.targetUser);
                }
            }
            
            // Останавливаем трансляцию экрана
            if (screenShares.has(username)) {
                const screenShare = screenShares.get(username);
                if (screenShare) {
                    const targetSocketId = userSockets.get(screenShare.targetUser);
                    if (targetSocketId) {
                        io.to(targetSocketId).emit('screen_share_ended', {
                            callId: screenShare.callId,
                            sharer: username,
                            reason: 'Пользователь отключился',
                            timestamp: new Date().toISOString()
                        });
                    }
                    screenShares.delete(username);
                }
            }
            
            console.log(`👋 User offline: ${username}`);
        }
    });
});

/**
 * Запуск сервера
 */
async function startServer() {
    try {
        // Создаем директории
        await ensureDirectories();
        
        // Загружаем данные
        console.log('📂 Loading data...');
        await loadUsers();
        await loadMessages();
        await loadGroups();
        await loadCurrencyData();
        await loadGiftsData();
        
        // Создаем администратора если нет
        if (!userExists('admin')) {
            const adminPassword = await bcrypt.hash('admin123', 12);
            const adminUser = {
                username: 'admin',
                password: adminPassword,
                avatar: '/static/default-avatar.png',
                createdAt: new Date().toISOString(),
                lastLogin: null,
                bio: 'Системный администратор',
                isOnline: false,
                isAdmin: true
            };
            users.push(adminUser);
            await saveUsers();
            
            initUserCurrency('admin');
            initUserGifts('admin');
            await saveCurrencyData();
            await saveGiftsData();
            
            console.log('✅ Created default admin user (password: admin123)');
        }
        
        // Очищаем старые загрузки
        console.log('🗑️ Cleaning up old uploads...');
        await cleanupOldUploads();
        
        // Запускаем автосохранение
        startAutoSave();
        
        // Запускаем проверку активности
        startPresenceCheck();
        
        // Запускаем сервер
        server.listen(PORT, '0.0.0.0', () => {
            console.log('='.repeat(60));
            console.log(`🚀 Anonka Messenger Server started!`);
            console.log('='.repeat(60));
            console.log(`🌐 Environment: ${isTauri ? 'Tauri Desktop' : isProduction ? 'Production' : 'Development'}`);
            console.log(`🔗 URL: http://localhost:${PORT}`);
            console.log(`🔗 Health: http://localhost:${PORT}/health`);
            console.log(`📊 Statistics:`);
            console.log(`   👥 Users: ${users.length}`);
            console.log(`   💬 Messages: ${messages.length}`);
            console.log(`   👥 Groups: ${groups.length}`);
            console.log(`   💰 Currency users: ${Object.keys(currencyData).length}`);
            console.log(`   🎁 Gifts data: ${Object.keys(giftsData).length}`);
            console.log('='.repeat(60));
            console.log(`✅ Server is ready to accept connections!`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

/**
 * Обработка завершения работы
 */
process.on('SIGINT', async () => {
    console.log('\n⚠️  Shutting down server...');
    
    // Останавливаем интервалы
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        console.log('⏹️  Stopped auto-save interval');
    }
    
    if (presenceCheckInterval) {
        clearInterval(presenceCheckInterval);
        console.log('⏹️  Stopped presence check interval');
    }
    
    // Сохраняем данные перед выходом
    console.log('💾 Saving data before shutdown...');
    try {
        await saveAllData();
        console.log('✅ Data saved successfully');
    } catch (error) {
        console.error('❌ Error saving data:', error);
    }
    
    // Отключаем всех пользователей
    console.log('👋 Disconnecting all users...');
    io.disconnectSockets(true);
    
    console.log('✅ Server shutdown complete');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Запуск сервера
startServer();