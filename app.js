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

// Инициализация хранилищ
let users = [];
let messages = [];
let systemNotifications = [];
let groups = [];
const userSockets = new Map();
const onlineUsers = new Set();
const activeCalls = new Map();
const screenShares = new Map();

async function ensureDirectories() {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.mkdir(uploadsDir, { recursive: true });
        console.log('Directories ensured');
    } catch (error) {
        console.error('Error creating directories:', error);
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

// Загрузка данных
async function loadUsers() {
    try {
        const data = await fs.readFile(path.join(dataDir, 'users.json'), 'utf8');
        users = JSON.parse(data);
        console.log('Users loaded:', users.length);
    } catch (error) {
        users = [];
        await saveUsers();
    }
}

async function loadMessages() {
    try {
        const data = await fs.readFile(path.join(dataDir, 'messages.json'), 'utf8');
        messages = JSON.parse(data);
        console.log('Messages loaded:', messages.length);
    } catch (error) {
        messages = [];
        await saveMessages();
    }
}

async function loadGroups() {
    try {
        const data = await fs.readFile(path.join(dataDir, 'groups.json'), 'utf8');
        groups = JSON.parse(data);
        console.log('Groups loaded:', groups.length);
    } catch (error) {
        groups = [];
        await saveGroups();
    }
}

async function saveUsers() {
    try {
        await fs.writeFile(path.join(dataDir, 'users.json'), JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error saving users:', error);
    }
}

async function saveMessages() {
    try {
        await fs.writeFile(path.join(dataDir, 'messages.json'), JSON.stringify(messages, null, 2));
    } catch (error) {
        console.error('Error saving messages:', error);
    }
}

async function saveGroups() {
    try {
        await fs.writeFile(path.join(dataDir, 'groups.json'), JSON.stringify(groups, null, 2));
    } catch (error) {
        console.error('Error saving groups:', error);
    }
}

// Аутентификация
function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
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

// 1. Аутентификация
app.post('/api/register', async (req, res) => {
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
        
        users.push({ 
            username, 
            password: hashedPassword
        });
        
        await saveUsers();
        
        const token = jwt.sign({ username }, JWT_SECRET);
        res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        res.json({ success: true, token });
    } catch (error) {
        console.error('Registration error:', error);
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
        res.json({ success: true, token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// 2. Системные уведомления
app.get('/api/notifications', authenticateToken, (req, res) => {
    try {
        const recentNotifications = systemNotifications
            .slice(-50)
            .reverse();
        res.json(recentNotifications);
    } catch (error) {
        console.error('Notifications error:', error);
        res.status(500).json({ error: 'Failed to load notifications' });
    }
});

// 3. Чаты и сообщения
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
        console.error('Conversations error:', error);
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
        console.error('Messages error:', error);
        res.status(500).json({ error: 'Failed to load messages' });
    }
});

// 4. Пользователи
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
        console.error('Search error:', error);
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
        console.error('Error getting all users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// 5. Загрузка файлов
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
                console.error('Thumbnail creation error:', sharpError);
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
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Ошибка загрузки файла: ' + error.message });
    }
});

// 6. Загрузка голосовых сообщений
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

        console.log('Voice message uploaded:', fileResponse.file.originalName);
        res.json(fileResponse);

    } catch (error) {
        console.error('Voice upload error:', error);
        
        if (req.file) {
            await fs.unlink(req.file.path).catch(console.error);
        }
        
        res.status(500).json({ error: 'Ошибка загрузки голосового сообщения: ' + error.message });
    }
});

// 7. Админ панель
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
        console.error('Error loading online users:', error);
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

        res.json({ 
            success: true,
            message: 'Уведомление отправлено'
        });
        
    } catch (error) {
        console.error('Admin notification error:', error);
        res.status(500).json({ error: 'Ошибка отправки уведомления: ' + error.message });
    }
});

// 8. Группы
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

        res.json({
            success: true,
            group: group
        });
        
    } catch (error) {
        console.error('Group creation error:', error);
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
        console.error('Groups error:', error);
        res.status(500).json({ error: 'Failed to load groups' });
    }
});

// 9. Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        users: users.length,
        messages: messages.length,
        groups: groups.length,
        onlineUsers: onlineUsers.size,
        notifications: systemNotifications.length
    });
});

// 10. Групповые сообщения
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
        console.error('Group messages error:', error);
        res.status(500).json({ error: 'Failed to load group messages' });
    }
});

// 11. Отправка сообщений в группу
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

        res.json({ success: true, message: messageData });
        
    } catch (error) {
        console.error('Group message error:', error);
        res.status(500).json({ error: 'Ошибка отправки сообщения' });
    }
});

// 12. Получение списка групп пользователя
app.get('/api/user/groups', authenticateToken, (req, res) => {
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
            memberCount: group.members ? group.members.length : 0,
            isGroup: true
        }));
        
        res.json(userGroups);
        
    } catch (error) {
        console.error('User groups error:', error);
        res.status(500).json({ error: 'Failed to load user groups' });
    }
});

// 13. Получение информации о группе
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
        console.error('Group info error:', error);
        res.status(500).json({ error: 'Failed to load group info' });
    }
});

// 14. Добавление пользователей в группу
app.post('/api/groups/:groupId/add-users', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { users: usersToAdd } = req.body;
        const currentUser = req.user.username;

        const group = groups.find(g => g.id === groupId);
        
        if (!group) {
            return res.status(404).json({ error: 'Группа не найдена' });
        }

        if (group.createdBy !== currentUser) {
            return res.status(403).json({ error: 'Только создатель группы может добавлять участников' });
        }

        const newMembers = usersToAdd.filter(user => !group.members.includes(user));
        group.members = [...group.members, ...newMembers];
        group.memberCount = group.members.length;
        
        await saveGroups();

        newMembers.forEach(username => {
            const userSocketId = userSockets.get(username);
            if (userSocketId) {
                io.to(userSocketId).emit('group_invitation', {
                    groupId: groupId,
                    groupName: group.name,
                    inviter: currentUser
                });
            }
        });

        group.members.forEach(member => {
            const memberSocketId = userSockets.get(member);
            if (memberSocketId) {
                io.to(memberSocketId).emit('group_updated', {
                    groupId: groupId,
                    action: 'users_added',
                    addedUsers: newMembers,
                    updatedBy: currentUser,
                    memberCount: group.memberCount
                });
            }
        });

        res.json({ 
            success: true,
            message: 'Пользователи успешно добавлены в группу',
            addedUsers: newMembers,
            memberCount: group.memberCount
        });

    } catch (error) {
        console.error('Error adding users to group:', error);
        res.status(500).json({ error: 'Ошибка добавления пользователей в группу' });
    }
});

// 15. Удаление пользователя из группы
app.post('/api/groups/:groupId/remove-member', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { member } = req.body;
        const currentUser = req.user.username;

        const group = groups.find(g => g.id === groupId);
        
        if (!group) {
            return res.status(404).json({ error: 'Группа не найдена' });
        }

        if (group.createdBy !== currentUser && member !== currentUser) {
            return res.status(403).json({ error: 'Недостаточно прав для удаления пользователя' });
        }

        group.members = group.members.filter(m => m !== member);
        group.memberCount = group.members.length;
        
        await saveGroups();

        group.members.forEach(member => {
            const memberSocketId = userSockets.get(member);
            if (memberSocketId) {
                io.to(memberSocketId).emit('group_updated', {
                    groupId: groupId,
                    action: 'member_removed',
                    removedMember: member,
                    updatedBy: currentUser,
                    memberCount: group.memberCount
                });
            }
        });

        const removedUserSocketId = userSockets.get(member);
        if (removedUserSocketId) {
            io.to(removedUserSocketId).emit('group_removed', {
                groupId: groupId,
                groupName: group.name
            });
        }

        res.json({ 
            success: true,
            message: 'Пользователь удален из группы',
            memberCount: group.memberCount
        });

    } catch (error) {
        console.error('Error removing member from group:', error);
        res.status(500).json({ error: 'Ошибка удаления пользователя из группы' });
    }
});

// Socket.io логика
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });

    socket.on('disconnect', (reason) => {
        console.log('User disconnected:', socket.id, 'Reason:', reason);
        if (socket.username) {
            userSockets.delete(socket.username);
            onlineUsers.delete(socket.username);
            
            // Завершаем активные звонки пользователя
            if (activeCalls.has(socket.username)) {
                const callData = activeCalls.get(socket.username);
                activeCalls.delete(socket.username);
                
                // Уведомляем участников звонка о отключении
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
            
            // Останавливаем трансляцию экрана
            if (screenShares.has(socket.username)) {
                screenShares.delete(socket.username);
            }
            
            io.emit('user-status-changed', {
                username: socket.username,
                isOnline: false
            });
        }
    });

    socket.on('user authenticated', (username) => {
        console.log('User authenticated:', username, 'Socket ID:', socket.id);
        userSockets.set(username, socket.id);
        onlineUsers.add(username);
        socket.username = username;
        
        io.emit('user-status-changed', {
            username: username,
            isOnline: true
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
        } catch (error) {
            console.error('Private message error:', error);
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
            
        } catch (error) {
            console.error('Group message error:', error);
            socket.emit('error', { message: 'Failed to send group message' });
        }
    });

    // Обработчики обновлений групп
    socket.on('group_created', (data) => {
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
            // Сохраняем информацию о звонке
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
        } else {
            // Пользователь не в сети
            socket.emit('call_rejected', {
                callId: data.callId,
                reason: 'Пользователь не в сети'
            });
        }
    });

    socket.on('accept_call', (data) => {
        const callerSocketId = userSockets.get(data.caller);
        if (callerSocketId) {
            // Обновляем информацию о звонке
            const callData = activeCalls.get(data.caller);
            if (callData) {
                callData.participants.push(data.acceptor);
                activeCalls.set(data.caller, callData);
            }
            
            io.to(callerSocketId).emit('call_accepted', {
                callId: data.callId,
                acceptor: socket.username
            });
        }
    });

    socket.on('reject_call', (data) => {
        const callerSocketId = userSockets.get(data.caller);
        if (callerSocketId) {
            // Удаляем информацию о звонке
            activeCalls.delete(data.caller);
            
            io.to(callerSocketId).emit('call_rejected', {
                callId: data.callId,
                reason: data.reason
            });
        }
    });

    socket.on('end_call', (data) => {
        // Удаляем информацию о звонке
        activeCalls.delete(socket.username);
        
        // Уведомляем всех участников звонка о завершении
        io.emit('call_ended', {
            callId: data.callId,
            reason: data.reason,
            endedBy: socket.username
        });
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
            // Сохраняем информацию о трансляции
            screenShares.set(socket.username, {
                targetUser: data.targetUser,
                callId: data.callId,
                startTime: new Date().toISOString()
            });
            
            io.to(targetSocketId).emit('screen_share_started', {
                callId: data.callId,
                sharer: socket.username
            });
        }
    });

    socket.on('screen_share_ended', (data) => {
        const targetSocketId = userSockets.get(data.targetUser);
        if (targetSocketId) {
            // Удаляем информацию о трансляции
            screenShares.delete(socket.username);
            
            io.to(targetSocketId).emit('screen_share_ended', {
                callId: data.callId,
                sharer: socket.username
            });
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

        // Отправляем уведомление всем пользователям
        io.emit('system_notification', notificationData);
    });

    // Ping для проверки соединения
    socket.on('ping', (cb) => {
        if (typeof cb === 'function') {
            cb('pong');
        }
    });
    // Трансляция экрана
socket.on('screen_share_started', (data) => {
    const targetSocketId = userSockets.get(data.targetUser);
    if (targetSocketId) {
        // Сохраняем информацию о трансляции
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
        // Удаляем информацию о трансляции
        screenShares.delete(socket.username);
        
        io.to(targetSocketId).emit('screen_share_ended', {
            callId: data.callId,
            sharer: socket.username
        });
        
        console.log(`🖥️ Screen share ended: ${socket.username} -> ${data.targetUser}`);
    }
});
});

// Запуск сервера
async function startServer() {
    try {
        await ensureDirectories();
        await loadUsers();
        await loadMessages();
        await loadGroups();
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`💾 Data directory: ${dataDir}`);
            console.log(`📁 Uploads directory: ${uploadsDir}`);
            console.log(`👥 Groups loaded: ${groups.length}`);
            console.log(`💬 Active features: Private Chat, Group Chat, Voice/Video Calls, Screen Sharing, File Sharing`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();