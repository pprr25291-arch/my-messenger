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

// Обслуживание статических файлов
app.use('/static', express.static(path.join(__dirname, 'static')));
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

app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

// Настройка шаблонов
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

// Хранилище данных (вместо MongoDB)
let users = [];
loadUsers();

async function loadUsers() {
    try {
        const data = await fs.readFile('users.json', 'utf8');
        users = JSON.parse(data);
    } catch (error) {
        users = [];
    }
}

async function saveUsers() {
    await fs.writeFile('users.json', JSON.stringify(users, null, 2));
}

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
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        users.push({ username, password: hashedPassword });
        await saveUsers();
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ username }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true });
    res.json({ success: true });
});

// Socket.io для реального времени
io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('chat message', (data) => {
        io.emit('chat message', {
            username: data.username,
            message: data.message,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});