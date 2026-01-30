class AdminPanel {
    constructor() {
        this.isAdmin = false;
        this.adminUsername = 'admin'; // Имя администратора
        this.init();
    }

    init() {
        this.checkAdminStatus();
        this.createAdminUI();
        this.setupSocketListeners();
    }

    checkAdminStatus() {
        const username = document.getElementById('username')?.textContent;
        this.isAdmin = username === this.adminUsername;
    }

    createAdminUI() {
        if (!this.isAdmin) return;

        // Добавляем кнопку админ-панели в header
        const header = document.querySelector('header');
        if (header) {
            const adminBtn = document.createElement('button');
            adminBtn.className = 'header-btn';
            adminBtn.id = 'adminBtn';
            adminBtn.textContent = '⚙️ Админ';
            adminBtn.style.background = '#dc3545';
            
            header.querySelector('.header-buttons').appendChild(adminBtn);
            
            adminBtn.addEventListener('click', () => this.toggleAdminPanel());
        }

        // Создаем панель администратора
        const adminPanel = document.createElement('div');
        adminPanel.id = 'adminPanel';
        adminPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 500px;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            padding: 25px;
            display: none;
        `;

    adminPanel.innerHTML = `
            <div class="admin-header">
                <h3>⚙️ Панель администратора</h3>
                <button class="close-admin" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
            </div>
            
            <div class="admin-tabs">
                <button class="tab-btn active" data-tab="notifications">📢 Уведомления</button>
                <button class="tab-btn" data-tab="verification">✅ Верификация</button>
                <button class="tab-btn" data-tab="users">👥 Пользователи</button>
                <button class="tab-btn" data-tab="system">🛠️ Система</button>
            </div>
            
            
            <div class="tab-content">
                <div id="notificationsTab" class="tab-pane active">
                    <div class="form-group">
                        <label>Тип уведомления:</label>
                        <select id="notificationType" class="form-control">
                            <option value="global">Всем пользователям</option>
                            <option value="user">Конкретному пользователю</option>
                        </select>
                    </div>
                    
                    <div id="userSelection" class="form-group" style="display: none;">
                        <label>Выберите пользователя:</label>
                        <input type="text" id="targetUser" class="form-control" placeholder="Имя пользователя">
                    </div>
                    
                    <div class="form-group">
                        <label>Сообщение:</label>
                        <textarea id="adminMessage" class="form-control" rows="4" placeholder="Введите системное уведомление..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Тип сообщения:</label>
                        <select id="messageType" class="form-control">
                            <option value="info">ℹ️ Информация</option>
                            <option value="warning">⚠️ Предупреждение</option>
                            <option value="error">❌ Ошибка</option>
                            <option value="success">✅ Успех</option>
                        </select>
                    </div>
                    
                    <button id="sendNotification" class="btn btn-primary">📢 Отправить уведомление</button>
                </div>
                
                <div id="usersTab" class="tab-pane">
                    <div class="users-list" id="onlineUsersList">
                        <h4>👥 Онлайн пользователи</h4>
                        <div class="users-container"></div>
                    </div>
                </div>
                
                <div id="systemTab" class="tab-pane">
                    <div class="system-actions">
                        <button id="clearChat" class="btn btn-warning">🗑️ Очистить общий чат</button>
                        <button id="maintenanceMode" class="btn btn-danger">🛠️ Режим техобслуживания</button>
                        <button id="exportData" class="btn btn-info">📊 Экспорт данных</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(adminPanel);
        this.setupAdminEvents();
    }

    setupAdminEvents() {
        const adminPanel = document.getElementById('adminPanel');
        const closeBtn = adminPanel.querySelector('.close-admin');
        const tabBtns = adminPanel.querySelectorAll('.tab-btn');
        const notificationType = adminPanel.querySelector('#notificationType');
        const userSelection = adminPanel.querySelector('#userSelection');
        const sendNotification = adminPanel.querySelector('#sendNotification');

        closeBtn.addEventListener('click', () => this.hideAdminPanel());

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        notificationType.addEventListener('change', (e) => {
            userSelection.style.display = e.target.value === 'user' ? 'block' : 'none';
        });

        sendNotification.addEventListener('click', () => this.sendSystemNotification());
        
        // Другие обработчики событий
        adminPanel.querySelector('#clearChat').addEventListener('click', () => this.clearGlobalChat());
        adminPanel.querySelector('#maintenanceMode').addEventListener('click', () => this.toggleMaintenance());
        adminPanel.querySelector('#exportData').addEventListener('click', () => this.exportData());
    }

    toggleAdminPanel() {
        const adminPanel = document.getElementById('adminPanel');
        adminPanel.style.display = adminPanel.style.display === 'none' ? 'block' : 'none';
        
        if (adminPanel.style.display === 'block') {
            this.loadOnlineUsers();
        }
    }

    hideAdminPanel() {
        document.getElementById('adminPanel').style.display = 'none';
    }

    switchTab(tabName) {
        // Скрыть все вкладки
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Показать выбранную вкладку
        document.getElementById(tabName + 'Tab').classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    async sendSystemNotification() {
        const message = document.getElementById('adminMessage').value.trim();
        const type = document.getElementById('notificationType').value;
        const targetUser = document.getElementById('targetUser').value.trim();
        const messageType = document.getElementById('messageType').value;

        if (!message) {
            this.showNotification('Введите сообщение', 'error');
            return;
        }

        if (type === 'user' && !targetUser) {
            this.showNotification('Введите имя пользователя', 'error');
            return;
        }

        try {
            const response = await fetch('/api/admin/notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    type: type,
                    targetUser: targetUser,
                    messageType: messageType
                })
            });

            if (response.ok) {
                this.showNotification('Уведомление отправлено', 'success');
                document.getElementById('adminMessage').value = '';
                document.getElementById('targetUser').value = '';
            } else {
                throw new Error('Failed to send notification');
            }
        } catch (error) {
            this.showNotification('Ошибка отправки уведомления', 'error');
        }
    }

    async loadOnlineUsers() {
        try {
            const response = await fetch('/api/users/online');
            const users = await response.json();
            
            const container = document.querySelector('#onlineUsersList .users-container');
            container.innerHTML = '';
            
            users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.innerHTML = `
                    <span>👤 ${user.username}</span>
                    <span class="user-status">${user.isOnline ? '🟢' : '🔴'}</span>
                `;
                container.appendChild(userElement);
            });
        } catch (error) {
            console.error('Error loading online users:', error);
        }
    }

    async clearGlobalChat() {
        if (confirm('Вы уверены, что хотите очистить общий чат?')) {
            try {
                const response = await fetch('/api/admin/clear-chat', {
                    method: 'POST'
                });
                
                if (response.ok) {
                    this.showNotification('Чат очищен', 'success');
                }
            } catch (error) {
                this.showNotification('Ошибка очистки чата', 'error');
            }
        }
    }

    toggleMaintenance() {
        // Реализация режима техобслуживания
        this.showNotification('Функция в разработке', 'info');
    }

    exportData() {
        // Реализация экспорта данных
        this.showNotification('Функция в разработке', 'info');
    }

    setupSocketListeners() {
        if (window.socket) {
            window.socket.on('system_notification', (data) => {
                this.displaySystemNotification(data);
            });
        }
    }

    displaySystemNotification(data) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        const notificationElement = document.createElement('div');
        notificationElement.className = `system-notification ${data.messageType || 'info'}`;
        
        const icons = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
        };

        notificationElement.innerHTML = `
            <div class="notification-header">
                <span class="notification-icon">${icons[data.messageType] || 'ℹ️'}</span>
                <strong>Системное уведомление</strong>
                <span class="notification-time">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="notification-message">${data.message}</div>
        `;

        messagesContainer.appendChild(notificationElement);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messages');
        if (messagesContainer) {
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }
    }

    showNotification(message, type = 'info') {
        // Используем существующую функцию уведомлений
        if (window.privateChatInstance) {
            window.privateChatInstance.showNotification(message, type);
        }
    }
}

// Инициализация админ-панели
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        window.adminPanel = new AdminPanel();
    }, 1000);
})// Добавьте после существующих API эндпоинтов

// API для администратора
app.post('/api/admin/send-notification', authenticateToken, async (req, res) => {
    try {
        // Проверяем, является ли пользователь администратором
        if (req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }

        const { message, type, targetUser, messageType } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Сообщение обязательно' });
        }

        const notificationData = {
            message: message,
            type: messageType || 'info',
            timestamp: new Date().toLocaleTimeString(),
            date: new Date().toISOString(),
            isSystem: true
        };

        if (type === 'global' || !targetUser) {
            // Отправляем всем пользователям
            io.emit('system_notification', notificationData);
            
            // Сохраняем в историю сообщений как системное
            messages.push({
                username: 'SYSTEM',
                message: `[${messageType?.toUpperCase() || 'INFO'}] ${message}`,
                timestamp: notificationData.timestamp,
                type: 'global',
                date: notificationData.date
            });
            
        } else if (type === 'user' && targetUser) {
            // Отправляем конкретному пользователю
            const targetSocketId = userSockets.get(targetUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('system_notification', notificationData);
            }
        }

        await saveMessages();
        res.json({ success: true });
        
    } catch (error) {
        console.error('Admin notification error:', error);
        res.status(500).json({ error: 'Ошибка отправки уведомления' });
    }
});

// API для получения всех пользователей
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

// API для онлайн пользователей (только для админа)
app.get('/api/users/online', authenticateToken, (req, res) => {
    try {
        // Проверяем, является ли пользователь администратором
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