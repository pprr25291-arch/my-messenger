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
let systemNotifications = []; // Добавьте эту строку
const userSockets = new Map();
const onlineUsers = new Set();

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

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
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
            'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac',
            'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime',
            'application/json', 'application/xml'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            const allowedExtensions = /\.(jpeg|jpg|png|gif|bmp|webp|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z|tar|gz|mp3|wav|ogg|mp4|m4a|mov|avi|mkv|json|xml)$/i;
            if (allowedExtensions.test(file.originalname)) {
                cb(null, true);
            } else {
                cb(new Error('Неподдерживаемый тип файла: ' + file.mimetype));
            }
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

// 2. Системные уведомления (ТОЛЬКО ОДИН ЭНДПОИНТ!)
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

// 6. Админ панель
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

// 7. Группы
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
            messages: []
        };

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
        const userGroups = [];
        res.json(userGroups);
    } catch (error) {
        console.error('Groups error:', error);
        res.status(500).json({ error: 'Failed to load groups' });
    }
});

// 8. Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        users: users.length,
        messages: messages.length,
        onlineUsers: onlineUsers.size,
        notifications: systemNotifications.length
    });
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

    // Обработчики звонков
    socket.on('call-offer', (data) => {
        const targetSocketId = userSockets.get(data.target);
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-offer', {
                offer: data.offer,
                caller: socket.username
            });
        }
    });
    
    socket.on('call-answer', (data) => {
        const targetSocketId = userSockets.get(data.target);
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-answer', {
                answer: data.answer
            });
        }
    });
    
    socket.on('ice-candidate', (data) => {
        const targetSocketId = userSockets.get(data.target);
        if (targetSocketId) {
            io.to(targetSocketId).emit('ice-candidate', {
                candidate: data.candidate
            });
        }
    });
    
    socket.on('call-end', (data) => {
        const targetSocketId = userSockets.get(data.target);
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-end');
        }
    });

    socket.on('ping', (cb) => {
        if (typeof cb === 'function') {
            cb('pong');
        }
    });
});

// Запуск сервера
async function startServer() {
    try {
        await ensureDirectories();
        await loadUsers();
        await loadMessages();
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`💾 Data directory: ${dataDir}`);
            console.log(`📁 Uploads directory: ${uploadsDir}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
// API для добавления пользователей в группу
app.post('/api/groups/:groupId/add-users', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { users } = req.body;
        const currentUser = req.user.username;

        // Здесь должна быть логика поиска группы в базе данных
        // const group = await findGroupById(groupId);
        
        // Проверяем права доступа
        // if (!group.members.includes(currentUser)) {
        //     return res.status(403).json({ error: 'У вас нет доступа к этой группе' });
        // }

        // Добавляем пользователей в группу
        // group.members = [...new Set([...group.members, ...users])];
        // await saveGroup(group);

        // Отправляем уведомления новым участникам
        users.forEach(username => {
            const userSocketId = userSockets.get(username);
            if (userSocketId) {
                io.to(userSocketId).emit('group_invitation', {
                    groupId: groupId,
                    groupName: 'Название группы', // Замените на реальное название
                    inviter: currentUser
                });
            }
        });

        // Уведомляем всех участников группы об обновлении
        // group.members.forEach(member => {
        //     const memberSocketId = userSockets.get(member);
        //     if (memberSocketId) {
        //         io.to(memberSocketId).emit('group_updated', {
        //             groupId: groupId,
        //             action: 'users_added',
        //             addedUsers: users,
        //             updatedBy: currentUser
        //         });
        //     }
        // });

        res.json({ 
            success: true,
            message: 'Пользователи успешно добавлены в группу',
            addedUsers: users
        });

    } catch (error) {
        console.error('Error adding users to group:', error);
        res.status(500).json({ error: 'Ошибка добавления пользователей в группу' });
    }
});

// API для удаления пользователя из группы
app.post('/api/groups/:groupId/remove-member', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { member } = req.body;
        const currentUser = req.user.username;

        // Здесь должна быть логика поиска группы в базе данных
        // const group = await findGroupById(groupId);
        
        // Проверяем права доступа (только создатель или сам пользователь может удалить)
        // if (group.createdBy !== currentUser && member !== currentUser) {
        //     return res.status(403).json({ error: 'Недостаточно прав для удаления пользователя' });
        // }

        // Удаляем пользователя из группы
        // group.members = group.members.filter(m => m !== member);
        // await saveGroup(group);

        // Уведомляем участников группы
        // group.members.forEach(member => {
        //     const memberSocketId = userSockets.get(member);
        //     if (memberSocketId) {
        //         io.to(memberSocketId).emit('group_updated', {
        //             groupId: groupId,
        //             action: 'member_removed',
        //             removedMember: member,
        //             updatedBy: currentUser
        //         });
        //     }
        // });

        // Уведомляем удаленного пользователя
        const removedUserSocketId = userSockets.get(member);
        if (removedUserSocketId) {
            io.to(removedUserSocketId).emit('group_removed', {
                groupId: groupId,
                groupName: 'Название группы' // Замените на реальное название
            });
        }

        res.json({ 
            success: true,
            message: 'Пользователь удален из группы'
        });

    } catch (error) {
        console.error('Error removing member from group:', error);
        res.status(500).json({ error: 'Ошибка удаления пользователя из группы' });
    }
})
// 9. Групповые сообщения
app.get('/api/groups/:groupId/messages', authenticateToken, (req, res) => {
    try {
        const { groupId } = req.params;
        
        // Временная реализация - в реальном приложении нужно хранить сообщения групп
        const groupMessages = messages.filter(msg => 
            msg.type === 'group' && msg.groupId === groupId
        );
        
        res.json(groupMessages);
    } catch (error) {
        console.error('Group messages error:', error);
        res.status(500).json({ error: 'Failed to load group messages' });
    }
});

// 10. Отправка сообщений в группу
app.post('/api/groups/:groupId/messages', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { message, messageType = 'text', fileData = null } = req.body;
        const sender = req.user.username;

        if (!message && !fileData) {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
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

        // Отправляем сообщение всем участникам группы
        // В реальном приложении нужно получить участников группы из базы данных
        const groupMembers = []; // Здесь должны быть участники группы
        
        groupMembers.forEach(member => {
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

// 11. Получение списка групп пользователя
app.get('/api/user/groups', authenticateToken, (req, res) => {
    try {
        const currentUser = req.user.username;
        
        // Временная реализация - в реальном приложении нужно хранить группы
        const userGroups = [
            {
                id: 'group_1',
                name: 'Тестовая группа',
                members: [currentUser, 'user1', 'user2'],
                createdBy: 'admin',
                createdAt: new Date().toISOString(),
                lastMessage: null
            }
        ];
        
        // Добавляем информацию о последнем сообщении
        userGroups.forEach(group => {
            const lastGroupMessage = messages
                .filter(msg => msg.type === 'group' && msg.groupId === group.id)
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            
            group.lastMessage = lastGroupMessage ? {
                text: lastGroupMessage.message,
                timestamp: lastGroupMessage.timestamp,
                sender: lastGroupMessage.sender,
                type: lastGroupMessage.messageType || 'text'
            } : null;
        });
        
        res.json(userGroups);
        
    } catch (error) {
        console.error('User groups error:', error);
        res.status(500).json({ error: 'Failed to load user groups' });
    }
});
startServer();