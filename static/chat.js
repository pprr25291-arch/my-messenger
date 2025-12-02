// chat.js - Основной файл инициализации

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Основные функции управления соединением
function initSocket() {
    try {
        socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            reconnectionDelay: 1000
        });

        window.socket = socket;

        socket.on('connect', () => {
            console.log('✅ Connected to server');
            reconnectAttempts = 0;
            showConnectionStatus('Подключено к серверу', 'success');
            
            const username = document.getElementById('username')?.textContent;
            if (username) {
                socket.emit('user authenticated', username);
            }
            
            loadNotifications();
        });

        socket.on('disconnect', (reason) => {
            console.log('🔌 Disconnected:', reason);
            showConnectionStatus('Отключено от сервера', 'error');
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            reconnectAttempts++;
            
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                showConnectionStatus('Не удалось подключиться к серверу', 'error');
            } else {
                showConnectionStatus(`Переподключение... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, 'warning');
            }
        });

        socket.on('system_notification', (data) => {
            console.log('📢 System notification:', data);
            displayNotification(data, true);
        });

        socket.on('notifications_updated', () => {
            console.log('🔄 Notifications updated');
            loadNotifications();
        });

        socket.on('ping', () => {
            socket.emit('pong');
        });

    } catch (error) {
        console.error('❌ Failed to initialize socket:', error);
        showConnectionStatus('Ошибка инициализации соединения', 'error');
    }
}

function loadNotifications() {
    fetch('/api/notifications')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(notifications => {
            const notificationsContainer = document.getElementById('notifications');
            if (notificationsContainer) {
                displayNotifications(notifications);
            }
        })
        .catch(error => {
            console.error('❌ Error loading notifications:', error);
            showNotificationsError();
        });
}

function displayNotifications(notifications) {
    const notificationsContainer = document.getElementById('notifications');
    if (!notificationsContainer) return;
    
    notificationsContainer.innerHTML = '';
    
    if (!notifications || notifications.length === 0) {
        notificationsContainer.innerHTML = `
            <div class="no-notifications">
                <div class="no-notifications-icon">📋</div>
                <h3>Нет уведомлений</h3>
                <p>Здесь будут отображаться системные уведомления</p>
            </div>
        `;
        return;
    }
    
    notifications.forEach(notification => {
        displayNotification(notification, false);
    });
}

function displayNotification(data, isNew = false) {
    const notificationsContainer = document.getElementById('notifications');
    if (!notificationsContainer) return;
    
    const noNotifications = notificationsContainer.querySelector('.no-notifications');
    if (noNotifications) {
        noNotifications.remove();
    }
    
    const notificationElement = document.createElement('div');
    notificationElement.className = `system-notification ${data.type || 'info'}`;
    
    const icons = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        success: '✅'
    };

    notificationElement.innerHTML = `
        <div class="system-notification-content">
            <div class="system-icon">${icons[data.type] || 'ℹ️'}</div>
            <div class="system-body">
                <div class="system-title">${data.title || 'Системное уведомление'}</div>
                <div class="system-message">${data.message}</div>
                <div class="system-meta">
                    <span class="system-sender">${data.sender || 'Система'}</span>
                    <span class="system-time">${data.timestamp || new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    `;
    
    if (isNew) {
        notificationElement.style.animation = 'messageSlideIn 0.3s ease-out';
        showToastNotification(data);
    }
    
    notificationsContainer.appendChild(notificationElement);
}

function showToastNotification(data) {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${data.type || 'info'}`;
    
    const icons = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        success: '✅'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[data.type] || 'ℹ️'}</div>
        <div class="toast-content">
            <div class="toast-title">${data.title || 'Уведомление'}</div>
            <div class="toast-message">${data.message}</div>
        </div>
        <button class="toast-close">✕</button>
    `;
    
    document.body.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.remove();
    });
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

function showNotificationsError() {
    const notificationsContainer = document.getElementById('notifications');
    if (notificationsContainer) {
        notificationsContainer.innerHTML = `
            <div class="no-notifications">
                <div class="no-notifications-icon">❌</div>
                <h3>Ошибка загрузки</h3>
                <p>Не удалось загрузить уведомления</p>
            </div>
        `;
    }
}

function showConnectionStatus(message, type = 'info') {
    const oldStatus = document.getElementById('connectionStatus');
    if (oldStatus) {
        oldStatus.remove();
    }
    
    const statusElement = document.createElement('div');
    statusElement.id = 'connectionStatus';
    statusElement.className = `connection-status ${type}`;
    
    const colors = {
        error: '#dc3545',
        warning: '#ffc107',
        success: '#28a745',
        info: '#17a2b8'
    };

    statusElement.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 10px 15px;
        border-radius: 5px;
        color: white;
        font-size: 14px;
        z-index: 10000;
        max-width: 300px;
        text-align: center;
        background: ${colors[type] || colors.info};
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    statusElement.textContent = message;
    document.body.appendChild(statusElement);
    
    if (type !== 'error') {
        setTimeout(() => {
            if (statusElement.parentElement) {
                statusElement.remove();
            }
        }, 5000);
    }
}

function switchToNotifications() {
    const notificationsPanel = document.getElementById('notificationsPanel');
    const privateChat = document.getElementById('privateChat');
    const notificationsBtn = document.getElementById('notificationsBtn');
    const privateBtn = document.getElementById('privateBtn');
    
    if (notificationsPanel) notificationsPanel.style.display = 'block';
    if (privateChat) privateChat.style.display = 'none';
    if (notificationsBtn) notificationsBtn.classList.add('active');
    if (privateBtn) privateBtn.classList.remove('active');
    
    loadNotifications();
}

function switchToPrivate() {
    const notificationsPanel = document.getElementById('notificationsPanel');
    const privateChat = document.getElementById('privateChat');
    const notificationsBtn = document.getElementById('notificationsBtn');
    const privateBtn = document.getElementById('privateBtn');
    
    if (notificationsPanel) notificationsPanel.style.display = 'none';
    if (privateChat) privateChat.style.display = 'block';
    if (notificationsBtn) notificationsBtn.classList.remove('active');
    if (privateBtn) privateBtn.classList.add('active');
}

function logout() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('username');
            window.location.href = '/';
        })
        .catch(() => {
            window.location.href = '/';
        });
}

function setupChatNavigation() {
    const notificationsBtn = document.getElementById('notificationsBtn');
    const privateBtn = document.getElementById('privateBtn');
    
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', switchToNotifications);
    }
    
    if (privateBtn) {
        privateBtn.addEventListener('click', switchToPrivate);
    }
    
    console.log('✅ Chat navigation setup complete');
}

// Делаем функции глобальными для доступа из других файлов
window.loadNotifications = loadNotifications;
window.switchToNotifications = switchToNotifications;
window.switchToPrivate = switchToPrivate;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Starting application initialization...');
    
    // Настраиваем навигацию
    setupChatNavigation();
    
    // Инициализируем socket
    initSocket();
    
    // Инициализируем приватный чат
    setTimeout(() => {
        if (!window.privateChatInstance) {
            console.log('🔄 Creating PrivateChat instance...');
            window.privateChatInstance = new PrivateChat();
        }
    }, 100);

    // Инициализируем групповые чаты
    setTimeout(() => {
        if (!window.groupChatManager) {
            console.log('🔄 Creating GroupChatManager instance...');
            window.groupChatManager = new GroupChatManager();
            window.groupChatManager.setupSocketListeners();
        }
    }, 500);
    
    console.log('✅ Application initialization complete');
});