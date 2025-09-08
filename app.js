const express = require('express');
const socketIo = require('socket.io');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
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
    res.render('chat', { username: req.user.username });
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
                    isOwn: lastMessage.sender === currentUser
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
        if (!query || query.length < 2) return res.json([]);
        
        const results = users.filter(user => 
            user.username.toLowerCase().includes(query.toLowerCase())
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

// Socket.io
io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('user authenticated', (username) => {
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
                date: new Date().toISOString()
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
        }
    });

    // Обработчики звонков
    socket.on('call-user', (data) => {
        try {
            const { from, to, offer, callId } = data;
            const receiverSocketId = userSockets.get(to);
            
            if (receiverSocketId) {
                callOffers.set(callId, { from, to, offer });
                
                io.to(receiverSocketId).emit('incoming-call', {
                    from,
                    callId,
                    offer
                });
                
                socket.emit('call-initiated', { callId });
            } else {
                socket.emit('call-failed', { 
                    reason: 'Пользователь недоступен' 
                });
            }
        } catch (error) {
            console.error('Call error:', error);
            socket.emit('call-failed', { 
                reason: 'Ошибка вызова' 
            });
        }
    });

    socket.on('accept-call', (data) => {
        try {
            const { callId, answer } = data;
            const callData = callOffers.get(callId);
            
            if (callData) {
                const callerSocketId = userSockets.get(callData.from);
                
                if (callerSocketId) {
                    io.to(callerSocketId).emit('call-accepted', {
                        callId,
                        answer
                    });
                    
                    activeCalls.set(callId, {
                        participants: [callData.from, callData.to],
                        startTime: new Date()
                    });
                }
            }
        } catch (error) {
            console.error('Accept call error:', error);
        }
    });

    socket.on('reject-call', (data) => {
        try {
            const { callId } = data;
            const callData = callOffers.get(callId);
            
            if (callData) {
                const callerSocketId = userSockets.get(callData.from);
                
                if (callerSocketId) {
                    io.to(callerSocketId).emit('call-rejected', {
                        callId,
                        reason: 'Вызов отклонен'
                    });
                }
                
                callOffers.delete(callId);
            }
        } catch (error) {
            console.error('Reject call error:', error);
        }
    });

    socket.on('end-call', (data) => {
        try {
            const { callId } = data;
            const callData = activeCalls.get(callId) || callOffers.get(callId);
            
            if (callData) {
                // Уведомляем всех участников о завершении звонка
                if (callData.participants) {
                    callData.participants.forEach(participant => {
                        const participantSocketId = userSockets.get(participant);
                        if (participantSocketId) {
                            io.to(participantSocketId).emit('call-ended', {
                                callId,
                                reason: 'Собеседник завершил звонок'
                            });
                        }
                    });
                } else {
                    // Для звонков, которые еще не были приняты
                    const callerSocketId = userSockets.get(callData.from);
                    const receiverSocketId = userSockets.get(callData.to);
                    
                    if (callerSocketId) {
                        io.to(callerSocketId).emit('call-ended', {
                            callId,
                            reason: 'Звонок завершен'
                        });
                    }
                    
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit('call-ended', {
                            callId,
                            reason: 'Звонок завершен'
                        });
                    }
                }
                
                activeCalls.delete(callId);
                callOffers.delete(callId);
            }
        } catch (error) {
            console.error('End call error:', error);
        }
    });

    socket.on('ice-candidate', (data) => {
        try {
            const { callId, candidate, targetUser } = data;
            const targetSocketId = userSockets.get(targetUser);
            
            if (targetSocketId) {
                io.to(targetSocketId).emit('ice-candidate', {
                    callId,
                    candidate
                });
            }
        } catch (error) {
            console.error('ICE candidate error:', error);
        }
    });

    // Обработчики трансляции экрана
    socket.on('start-screen-share', (data) => {
        try {
            const { from, to, offer, screenShareId } = data;
            const receiverSocketId = userSockets.get(to);
            
            if (receiverSocketId) {
                screenSharingSessions.set(screenShareId, { from, to });
                
                io.to(receiverSocketId).emit('screen-share-offer', {
                    from,
                    screenShareId,
                    offer
                });
                
                socket.emit('screen-share-started', { screenShareId });
            } else {
                socket.emit('screen-share-failed', { 
                    reason: 'Пользователь недоступен' 
                });
            }
        } catch (error) {
            console.error('Screen share error:', error);
            socket.emit('screen-share-failed', { 
                reason: 'Ошибка трансляции экрана' 
            });
        }
    });

    socket.on('accept-screen-share', (data) => {
        try {
            const { screenShareId, answer } = data;
            const screenShareData = screenSharingSessions.get(screenShareId);
            
            if (screenShareData) {
                const sharerSocketId = userSockets.get(screenShareData.from);
                
                if (sharerSocketId) {
                    io.to(sharerSocketId).emit('screen-share-accepted', {
                        screenShareId,
                        answer
                    });
                }
            }
        } catch (error) {
            console.error('Accept screen share error:', error);
        }
    });

    socket.on('reject-screen-share', (data) => {
        try {
            const { screenShareId } = data;
            const screenShareData = screenSharingSessions.get(screenShareId);
            
            if (screenShareData) {
                const sharerSocketId = userSockets.get(screenShareData.from);
                
                if (sharerSocketId) {
                    io.to(sharerSocketId).emit('screen-share-rejected', {
                        screenShareId,
                        reason: 'Трансляция отклонена'
                    });
                }
                
                screenSharingSessions.delete(screenShareId);
            }
        } catch (error) {
            console.error('Reject screen share error:', error);
        }
    });

    socket.on('end-screen-share', (data) => {
        try {
            const { screenShareId } = data;
            const screenShareData = screenSharingSessions.get(screenShareId);
            
            if (screenShareData) {
                const receiverSocketId = userSockets.get(screenShareData.to);
                const sharerSocketId = userSockets.get(screenShareData.from);
                
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('screen-share-ended', {
                        screenShareId,
                        reason: 'Трансляция завершена'
                    });
                }
                
                if (sharerSocketId) {
                    io.to(sharerSocketId).emit('screen-share-ended', {
                        screenShareId,
                        reason: 'Трансляция завершена'
                    });
                }
                
                screenSharingSessions.delete(screenShareId);
            }
        } catch (error) {
            console.error('End screen share error:', error);
        }
    });

    socket.on('screen-share-ice-candidate', (data) => {
        try {
            const { screenShareId, candidate, targetUser } = data;
            const targetSocketId = userSockets.get(targetUser);
            
            if (targetSocketId) {
                io.to(targetSocketId).emit('screen-share-ice-candidate', {
                    screenShareId,
                    candidate
                });
            }
        } catch (error) {
            console.error('Screen share ICE candidate error:', error);
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            userSockets.delete(socket.username);
            
            // Завершаем все активные сессии трансляции экрана при отключении
            for (const [screenShareId, session] of screenSharingSessions.entries()) {
                if (session.from === socket.username || session.to === socket.username) {
                    const otherUser = session.from === socket.username ? session.to : session.from;
                    const otherSocketId = userSockets.get(otherUser);
                    
                    if (otherSocketId) {
                        io.to(otherSocketId).emit('screen-share-ended', {
                            screenShareId,
                            reason: 'Пользователь отключился'
                        });
                    }
                    
                    screenSharingSessions.delete(screenShareId);
                }
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});