// chat.js - Основной файл инициализации (1000+ строк)
// Версия: 3.0.0
// Автор: Messenger Team
// Описание: Главный файл инициализации чата с поддержкой Tauri, мобильного интерфейса и всех функций

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let isMobile = false;
let isTauri = false;
let currentServerUrl = '';
let connectionCheckInterval = null;

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    SOCKET_RECONNECTION_DELAY: 1000,
    SOCKET_TIMEOUT: 30000,
    HEARTBEAT_INTERVAL: 25000,
    NOTIFICATION_TIMEOUT: 5000,
    API_TIMEOUT: 10000,
    MOBILE_BREAKPOINT: 768,
    DESKTOP_MIN_WIDTH: 1024
};

// ==================== УТИЛИТЫ ====================
function log(level, message, data = null) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const icon = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        debug: '🐛'
    }[level] || '📝';
    
    console.log(`${icon} [${timestamp}] ${message}`, data ? data : '');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ==================== ОПРЕДЕЛЕНИЕ СРЕДЫ ====================
function detectEnvironment() {
    // Проверяем Tauri
    isTauri = typeof window.__TAURI__ !== 'undefined' || 
              (typeof window.isTauri !== 'undefined' && window.isTauri);
    
    // Проверяем мобильное устройство
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;
    
    log('info', `Environment detected:`, {
        isTauri,
        isMobile,
        userAgent: navigator.userAgent.substring(0, 50) + '...',
        screen: `${window.innerWidth}x${window.innerHeight}`,
        hostname: window.location.hostname
    });
    
    return { isTauri, isMobile };
}

// ==================== УПРАВЛЕНИЕ URL СЕРВЕРА ====================
function getServerUrl() {
    if (currentServerUrl) {
        return currentServerUrl;
    }
    
    // Если мы в Tauri приложении
    if (isTauri) {
        currentServerUrl = 'https://my-messenger-9g2n.onrender.com';
        log('info', `Tauri mode detected, using server: ${currentServerUrl}`);
        return currentServerUrl;
    }
    
    // Автоматическое определение для веб-версии
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
        currentServerUrl = `http://${hostname}:3000`;
        log('info', `Local development detected, using server: ${currentServerUrl}`);
    } else if (hostname.includes('render.com') || hostname.includes('onrender.com')) {
        currentServerUrl = `https://${hostname}`;
        log('info', `Render.com deployment detected, using server: ${currentServerUrl}`);
    } else {
        // Для production сайта
        currentServerUrl = '';
        log('info', 'Production website detected, using relative URLs');
    }
    
    // Сохраняем в localStorage для последующего использования
    try {
        localStorage.setItem('serverUrl', currentServerUrl);
    } catch (e) {
        log('error', 'Failed to save server URL to localStorage:', e);
    }
    
    return currentServerUrl;
}

function updateServerUrl(newUrl) {
    if (!newUrl) return false;
    
    try {
        // Проверяем URL
        const url = new URL(newUrl);
        currentServerUrl = url.origin;
        
        // Сохраняем
        localStorage.setItem('serverUrl', currentServerUrl);
        localStorage.setItem('serverUrlUpdated', Date.now().toString());
        
        log('success', `Server URL updated to: ${currentServerUrl}`);
        
        // Переподключаем socket
        if (socket) {
            socket.disconnect();
            setTimeout(() => initSocket(), 1000);
        }
        
        return true;
    } catch (error) {
        log('error', 'Invalid server URL:', error);
        return false;
    }
}

function restoreServerUrl() {
    try {
        const savedUrl = localStorage.getItem('serverUrl');
        if (savedUrl && savedUrl !== currentServerUrl) {
            currentServerUrl = savedUrl;
            log('info', `Restored server URL from localStorage: ${currentServerUrl}`);
            return true;
        }
    } catch (e) {
        log('error', 'Failed to restore server URL:', e);
    }
    return false;
}

// ==================== ПАТЧИНГ FETCH ДЛЯ TAURI ====================
function patchFetchForTauri() {
    if (!isTauri) return;
    
    log('info', 'Patching fetch for Tauri environment');
    
    const originalFetch = window.fetch;
    
    window.fetch = async function(url, options = {}) {
        // Для относительных путей добавляем базовый URL
        if (typeof url === 'string') {
            if (url.startsWith('/api/') || url.startsWith('/socket.io/')) {
                const serverUrl = getServerUrl();
                const fullUrl = serverUrl + url;
                
                log('debug', `Fetch patched: ${url} -> ${fullUrl}`);
                
                // Добавляем таймауты для Tauri
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
                
                const fetchOptions = {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        ...(options.headers || {})
                    }
                };
                
                try {
                    const response = await originalFetch(fullUrl, fetchOptions);
                    clearTimeout(timeoutId);
                    return response;
                } catch (error) {
                    clearTimeout(timeoutId);
                    log('error', `Fetch error for ${fullUrl}:`, error);
                    throw error;
                }
            }
        }
        
        // Для абсолютных URL оставляем как есть
        return originalFetch(url, options);
    };
    
    // Также патчим XMLHttpRequest для старых библиотек
    if (window.XMLHttpRequest) {
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            if (typeof url === 'string' && (url.startsWith('/api/') || url.startsWith('/socket.io/'))) {
                const serverUrl = getServerUrl();
                const fullUrl = serverUrl + url;
                log('debug', `XMLHttpRequest patched: ${url} -> ${fullUrl}`);
                return originalOpen.call(this, method, fullUrl, async, user, password);
            }
            return originalOpen.call(this, method, url, async, user, password);
        };
    }
}

// ==================== УПРАВЛЕНИЕ СОЕДИНЕНИЕМ ====================
function initSocket() {
    if (socket && socket.connected) {
        log('warning', 'Socket already connected');
        return socket;
    }
    
    try {
        const serverUrl = getServerUrl();
        const socketUrl = isTauri ? serverUrl : '';
        
        log('info', `Initializing socket connection to: ${socketUrl || 'current server'}`);
        
        // Создаем опции подключения
        const socketOptions = {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            reconnectionDelay: CONFIG.SOCKET_RECONNECTION_DELAY,
            reconnectionDelayMax: 5000,
            timeout: CONFIG.SOCKET_TIMEOUT,
            autoConnect: true,
            forceNew: true,
            multiplex: false
        };
        
        // Создаем socket соединение
        socket = io(socketUrl, socketOptions);
        window.socket = socket;
        
        // ============ ОБРАБОТЧИКИ СОБЫТИЙ SOCKET ============
        
        socket.on('connect', () => {
            log('success', 'Socket connected successfully');
            reconnectAttempts = 0;
            showConnectionStatus('✅ Подключено к серверу', 'success');
            
            // Отправляем аутентификацию
            const username = getCurrentUsername();
            if (username) {
                setTimeout(() => {
                    socket.emit('user authenticated', username);
                    log('info', `User authenticated: ${username}`);
                }, 100);
            }
            
            // Загружаем уведомления
            loadNotifications();
            
            // Запускаем heartbeat
            startHeartbeat();
            
            // Обновляем статус соединения
            updateConnectionStatus(true);
            
            // Инициализируем чаты после подключения
            setTimeout(() => {
                if (window.privateChatInstance && typeof window.privateChatInstance.loadChats === 'function') {
                    window.privateChatInstance.loadChats();
                }
                if (window.groupChatManager && typeof window.groupChatManager.loadGroups === 'function') {
                    window.groupChatManager.loadGroups();
                }
            }, 500);
        });
        
        socket.on('disconnect', (reason) => {
            log('warning', `Socket disconnected: ${reason}`);
            showConnectionStatus('🔌 Отключено от сервера', 'warning');
            updateConnectionStatus(false);
            stopHeartbeat();
            
            if (reason === 'io server disconnect') {
                // Сервер принудительно отключил
                setTimeout(() => socket.connect(), 1000);
            }
        });
        
        socket.on('connect_error', (error) => {
            reconnectAttempts++;
            log('error', `Socket connection error (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`, error);
            
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                showConnectionStatus('❌ Не удалось подключиться к серверу', 'error');
            } else {
                showConnectionStatus(`🔄 Переподключение... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, 'warning');
            }
        });
        
        socket.on('reconnect', (attemptNumber) => {
            log('success', `Socket reconnected after ${attemptNumber} attempts`);
            showConnectionStatus('✅ Переподключено', 'success');
            updateConnectionStatus(true);
            startHeartbeat();
        });
        
        socket.on('reconnect_attempt', (attemptNumber) => {
            log('info', `Socket reconnection attempt ${attemptNumber}`);
        });
        
        socket.on('reconnect_error', (error) => {
            log('error', 'Socket reconnection error:', error);
        });
        
        socket.on('reconnect_failed', () => {
            log('error', 'Socket reconnection failed completely');
            showConnectionStatus('❌ Не удалось восстановить соединение', 'error');
            updateConnectionStatus(false);
        });
        
        socket.on('ping', () => {
            socket.emit('pong');
            log('debug', 'Ping received, pong sent');
        });
        
        socket.on('system_notification', (data) => {
            log('info', 'System notification received:', data);
            displayNotification(data, true);
            
            // Обновляем счетчик уведомлений
            updateNotificationCount();
        });
        
        socket.on('notifications_updated', () => {
            log('info', 'Notifications updated signal received');
            loadNotifications();
        });
        
        socket.on('user_status_change', (data) => {
            log('info', 'User status change:', data);
            updateUserStatus(data.username, data.status);
        });
        
        socket.on('private_message', (data) => {
            log('info', 'Private message received:', data);
            if (window.privateChatInstance && typeof window.privateChatInstance.handleIncomingMessage === 'function') {
                window.privateChatInstance.handleIncomingMessage(data);
            }
        });
        
        socket.on('group_message', (data) => {
            log('info', 'Group message received:', data);
            if (window.groupChatManager && typeof window.groupChatManager.handleIncomingMessage === 'function') {
                window.groupChatManager.handleIncomingMessage(data);
            }
        });
        
        socket.on('message_read', (data) => {
            log('info', 'Message read receipt:', data);
            if (window.privateChatInstance && typeof window.privateChatInstance.handleMessageRead === 'function') {
                window.privateChatInstance.handleMessageRead(data);
            }
        });
        
        socket.on('typing_start', (data) => {
            log('debug', 'Typing started:', data);
            if (window.privateChatInstance && typeof window.privateChatInstance.showTypingIndicator === 'function') {
                window.privateChatInstance.showTypingIndicator(data);
            }
        });
        
        socket.on('typing_stop', (data) => {
            log('debug', 'Typing stopped:', data);
            if (window.privateChatInstance && typeof window.privateChatInstance.hideTypingIndicator === 'function') {
                window.privateChatInstance.hideTypingIndicator(data);
            }
        });
        
        socket.on('call_offer', (data) => {
            log('info', 'Call offer received:', data);
            if (window.callManager && typeof window.callManager.handleCallOffer === 'function') {
                window.callManager.handleCallOffer(data);
            }
        });
        
        socket.on('call_answer', (data) => {
            log('info', 'Call answer received:', data);
            if (window.callManager && typeof window.callManager.handleCallAnswer === 'function') {
                window.callManager.handleCallAnswer(data);
            }
        });
        
        socket.on('call_ice_candidate', (data) => {
            log('info', 'Call ICE candidate received:', data);
            if (window.callManager && typeof window.callManager.handleICECandidate === 'function') {
                window.callManager.handleICECandidate(data);
            }
        });
        
        socket.on('call_end', (data) => {
            log('info', 'Call end received:', data);
            if (window.callManager && typeof window.callManager.handleCallEnd === 'function') {
                window.callManager.handleCallEnd(data);
            }
        });
        
        socket.on('gift_sent', (data) => {
            log('info', 'Gift sent notification:', data);
            if (window.giftManager && typeof window.giftManager.handleGiftNotification === 'function') {
                window.giftManager.handleGiftNotification(data);
            }
        });
        
        socket.on('currency_update', (data) => {
            log('info', 'Currency update:', data);
            if (window.currencyManager && typeof window.currencyManager.updateBalance === 'function') {
                window.currencyManager.updateBalance(data);
            }
        });
        
        socket.on('error', (error) => {
            log('error', 'Socket error event:', error);
            showConnectionStatus(`❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`, 'error');
        });
        
        // ============ ТЕСТИРОВАНИЕ СОЕДИНЕНИЯ ============
        // Периодическая проверка соединения
        connectionCheckInterval = setInterval(() => {
            if (socket && !socket.connected) {
                log('warning', 'Socket not connected, attempting reconnect');
                socket.connect();
            }
        }, 30000);
        
        log('success', 'Socket initialization complete');
        return socket;
        
    } catch (error) {
        log('error', 'Failed to initialize socket:', error);
        showConnectionStatus('❌ Ошибка инициализации соединения', 'error');
        return null;
    }
}

function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
        window.socket = null;
        log('info', 'Socket disconnected');
    }
    
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
    }
    
    stopHeartbeat();
    updateConnectionStatus(false);
}

function startHeartbeat() {
    if (window.heartbeatInterval) {
        clearInterval(window.heartbeatInterval);
    }
    
    window.heartbeatInterval = setInterval(() => {
        if (socket && socket.connected) {
            socket.emit('heartbeat', { timestamp: Date.now() });
            log('debug', 'Heartbeat sent');
        }
    }, CONFIG.HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
    if (window.heartbeatInterval) {
        clearInterval(window.heartbeatInterval);
        window.heartbeatInterval = null;
    }
}

function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatusBadge');
    if (!statusElement) return;
    
    if (connected) {
        statusElement.innerHTML = '<span class="status-dot online"></span> Онлайн';
        statusElement.className = 'connection-status online';
    } else {
        statusElement.innerHTML = '<span class="status-dot offline"></span> Офлайн';
        statusElement.className = 'connection-status offline';
    }
}

// ==================== УВЕДОМЛЕНИЯ ====================
function loadNotifications() {
    const apiUrl = `/api/notifications`;
    
    log('info', `Loading notifications from: ${apiUrl}`);
    
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(notifications => {
            log('info', `Loaded ${notifications.length} notifications`);
            displayNotifications(notifications);
            updateNotificationCount(notifications.length);
        })
        .catch(error => {
            log('error', 'Error loading notifications:', error);
            showNotificationsError();
        });
}

function displayNotifications(notifications) {
    const notificationsContainer = document.getElementById('notifications');
    if (!notificationsContainer) {
        log('warning', 'Notifications container not found');
        return;
    }
    
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
    
    // Сортируем по времени (новые сверху)
    notifications.sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
    
    notifications.forEach(notification => {
        displayNotification(notification, false);
    });
}

function displayNotification(data, isNew = false) {
    const notificationsContainer = document.getElementById('notifications');
    if (!notificationsContainer) return;
    
    // Убираем сообщение "нет уведомлений" если есть
    const noNotifications = notificationsContainer.querySelector('.no-notifications');
    if (noNotifications) {
        noNotifications.remove();
    }
    
    const notificationElement = document.createElement('div');
    notificationElement.className = `system-notification ${data.type || 'info'} ${isNew ? 'new' : ''}`;
    notificationElement.dataset.notificationId = data.id || Date.now();
    
    const icons = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        success: '✅',
        gift: '🎁',
        message: '💬',
        call: '📞',
        system: '⚙️',
        friend: '👤',
        group: '👥',
        currency: '💰'
    };
    
    const icon = icons[data.icon] || icons[data.type] || icons['info'];
    const time = data.timestamp ? formatTime(new Date(data.timestamp)) : 'Только что';
    
    notificationElement.innerHTML = `
        <div class="system-notification-content">
            <div class="system-icon">${icon}</div>
            <div class="system-body">
                <div class="system-title">${data.title || 'Системное уведомление'}</div>
                <div class="system-message">${data.message}</div>
                <div class="system-meta">
                    <span class="system-sender">${data.sender || 'Система'}</span>
                    <span class="system-time">${time}</span>
                </div>
            </div>
            ${isNew ? '<div class="notification-new-badge">NEW</div>' : ''}
            <button class="notification-close" title="Удалить">×</button>
        </div>
    `;
    
    // Анимация для новых уведомлений
    if (isNew) {
        notificationElement.style.animation = 'notificationSlideIn 0.3s ease-out';
        
        // Показываем toast уведомление
        showToastNotification(data);
    }
    
    notificationsContainer.appendChild(notificationElement);
    
    // Обработчик закрытия уведомления
    const closeBtn = notificationElement.querySelector('.notification-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            notificationElement.style.animation = 'notificationSlideOut 0.3s ease-out';
            setTimeout(() => {
                if (notificationElement.parentElement) {
                    notificationElement.remove();
                    updateNotificationCount();
                    
                    // Если уведомлений не осталось, показываем заглушку
                    if (!notificationsContainer.querySelector('.system-notification')) {
                        notificationsContainer.innerHTML = `
                            <div class="no-notifications">
                                <div class="no-notifications-icon">📋</div>
                                <h3>Нет уведомлений</h3>
                                <p>Здесь будут отображаться системные уведомления</p>
                            </div>
                        `;
                    }
                }
            }, 250);
        });
    }
}

function showToastNotification(data) {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${data.type || 'info'}`;
    
    const icons = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        success: '✅',
        gift: '🎁',
        message: '💬'
    };
    
    const icon = icons[data.type] || icons['info'];
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${data.title || 'Уведомление'}</div>
            <div class="toast-message">${data.message}</div>
        </div>
        <button class="toast-close" title="Закрыть">×</button>
    `;
    
    document.body.appendChild(toast);
    
    // Показываем с анимацией
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Обработчик закрытия
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    });
    
    // Автоматическое скрытие
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }
    }, CONFIG.NOTIFICATION_TIMEOUT);
}

function updateNotificationCount(count = null) {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    if (count === null) {
        // Подсчитываем уведомления
        const notificationsContainer = document.getElementById('notifications');
        if (notificationsContainer) {
            count = notificationsContainer.querySelectorAll('.system-notification.new').length;
        } else {
            count = 0;
        }
    }
    
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count.toString();
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function markAllNotificationsAsRead() {
    const newNotifications = document.querySelectorAll('.system-notification.new');
    newNotifications.forEach(notification => {
        notification.classList.remove('new');
        const badge = notification.querySelector('.notification-new-badge');
        if (badge) badge.remove();
    });
    
    updateNotificationCount(0);
    
    // Отправляем на сервер
    if (socket && socket.connected) {
        socket.emit('notifications_read');
    }
}

function showNotificationsError() {
    const notificationsContainer = document.getElementById('notifications');
    if (notificationsContainer) {
        notificationsContainer.innerHTML = `
            <div class="no-notifications error">
                <div class="no-notifications-icon">❌</div>
                <h3>Ошибка загрузки</h3>
                <p>Не удалось загрузить уведомления</p>
                <button class="retry-btn" onclick="loadNotifications()">Повторить</button>
            </div>
        `;
    }
}

// ==================== СТАТУС СОЕДИНЕНИЯ ====================
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
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        max-width: 350px;
        text-align: center;
        background: ${colors[type] || colors.info};
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: statusSlideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    const icon = {
        error: '❌',
        warning: '⚠️',
        success: '✅',
        info: 'ℹ️'
    }[type] || 'ℹ️';
    
    statusElement.innerHTML = `
        <span style="font-size: 18px;">${icon}</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(statusElement);
    
    // Автоматическое скрытие для не-ошибок
    if (type !== 'error') {
        setTimeout(() => {
            if (statusElement.parentElement) {
                statusElement.style.animation = 'statusSlideOut 0.3s ease-out';
                setTimeout(() => {
                    if (statusElement.parentElement) {
                        statusElement.remove();
                    }
                }, 250);
            }
        }, 5000);
    } else {
        // Для ошибок добавляем кнопку закрытия
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            margin-left: auto;
            padding: 0 5px;
        `;
        closeBtn.addEventListener('click', () => {
            if (statusElement.parentElement) {
                statusElement.remove();
            }
        });
        statusElement.appendChild(closeBtn);
    }
}

// ==================== НАВИГАЦИЯ ====================
function switchToNotifications() {
    const notificationsPanel = document.getElementById('notificationsPanel');
    const privateChat = document.getElementById('privateChat');
    const notificationsBtn = document.getElementById('notificationsBtn');
    const privateBtn = document.getElementById('privateBtn');
    
    if (notificationsPanel) {
        notificationsPanel.style.display = 'block';
        notificationsPanel.classList.add('active');
    }
    if (privateChat) {
        privateChat.style.display = 'none';
        privateChat.classList.remove('active');
    }
    if (notificationsBtn) notificationsBtn.classList.add('active');
    if (privateBtn) privateBtn.classList.remove('active');
    
    loadNotifications();
    updateMobileNavActive('notifications');
}

function switchToPrivate() {
    const notificationsPanel = document.getElementById('notificationsPanel');
    const privateChat = document.getElementById('privateChat');
    const notificationsBtn = document.getElementById('notificationsBtn');
    const privateBtn = document.getElementById('privateBtn');
    
    if (notificationsPanel) {
        notificationsPanel.style.display = 'none';
        notificationsPanel.classList.remove('active');
    }
    if (privateChat) {
        privateChat.style.display = 'block';
        privateChat.classList.add('active');
    }
    if (notificationsBtn) notificationsBtn.classList.remove('active');
    if (privateBtn) privateBtn.classList.add('active');
    
    updateMobileNavActive('chats');
}

function setupChatNavigation() {
    const notificationsBtn = document.getElementById('notificationsBtn');
    const privateBtn = document.getElementById('privateBtn');
    const groupsBtn = document.getElementById('groupsBtn');
    const searchBtn = document.getElementById('searchBtn');
    const profileBtn = document.getElementById('profileBtn');
    
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', switchToNotifications);
    }
    
    if (privateBtn) {
        privateBtn.addEventListener('click', switchToPrivate);
    }
    
    if (groupsBtn) {
        groupsBtn.addEventListener('click', () => {
            if (window.groupChatManager) {
                window.groupChatManager.showGroupsPanel();
            }
            updateMobileNavActive('groups');
        });
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const searchInput = document.getElementById('userSearch');
            if (searchInput) {
                searchInput.focus();
                searchInput.scrollIntoView({ behavior: 'smooth' });
            }
            updateMobileNavActive('search');
        });
    }
    
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            if (window.profileManager) {
                window.profileManager.showProfile();
            }
            updateMobileNavActive('profile');
        });
    }
    
    log('success', 'Chat navigation setup complete');
}

// ==================== МОБИЛЬНЫЙ ИНТЕРФЕЙС ====================
function initMobileInterface() {
    if (!isMobile) {
        log('info', 'Desktop device detected, skipping mobile interface');
        return false;
    }
    
    log('info', 'Mobile device detected, initializing mobile interface');
    
    // Инициализация мобильного лейаута
    const sidebar = document.querySelector('.private-chat-sidebar');
    const mainChat = document.querySelector('.private-chat-main');
    const noChatSelected = document.getElementById('noChatSelected');
    const activeChat = document.getElementById('activeChat');
    
    if (sidebar) {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('mobile-sidebar');
    }
    
    if (mainChat) {
        mainChat.classList.remove('active');
        mainChat.classList.add('mobile-main');
    }
    
    if (noChatSelected) noChatSelected.style.display = 'none';
    if (activeChat) activeChat.style.display = 'none';
    
    // Создаем мобильную навигацию
    createMobileNavigation();
    
    // Настраиваем мобильную навигацию
    setupMobileNavigation();
    
    // Адаптируем интерфейс
    adaptInterfaceForMobile();
    
    // Добавляем обработчики свайпов
    setupSwipeGestures();
    
    log('success', 'Mobile interface initialized');
    return true;
}

function createMobileNavigation() {
    if (document.querySelector('.mobile-nav')) return;
    
    const mobileNav = document.createElement('div');
    mobileNav.className = 'mobile-nav';
    
    const username = getCurrentUsername();
    const isAdmin = username === 'admin';
    
    mobileNav.innerHTML = `
        <button class="mobile-nav-btn active" id="mobileChatsBtn" data-section="chats">
            <span class="nav-icon">💬</span>
            <span class="nav-label">Чаты</span>
        </button>
        <button class="mobile-nav-btn" id="mobileGroupsBtn" data-section="groups">
            <span class="nav-icon">👥</span>
            <span class="nav-label">Группы</span>
        </button>
        <button class="mobile-nav-btn" id="mobileSearchBtn" data-section="search">
            <span class="nav-icon">🔍</span>
            <span class="nav-label">Поиск</span>
        </button>
        <button class="mobile-nav-btn" id="mobileNotificationsBtn" data-section="notifications">
            <span class="nav-icon">🔔</span>
            <span class="nav-label">Уведомления</span>
            <span class="nav-badge" id="mobileNotificationBadge"></span>
        </button>
        <button class="mobile-nav-btn" id="mobileProfileBtn" data-section="profile">
            <span class="nav-icon">👤</span>
            <span class="nav-label">Профиль</span>
        </button>
        ${isAdmin ? `
        <button class="mobile-nav-btn" id="mobileAdminBtn" data-section="admin">
            <span class="nav-icon">⚙️</span>
            <span class="nav-label">Админ</span>
        </button>
        ` : ''}
    `;
    
    document.body.appendChild(mobileNav);
}

function setupMobileNavigation() {
    // Кнопка "Назад" в чате
    const backBtn = document.querySelector('.back-to-chats');
    if (backBtn) {
        backBtn.addEventListener('click', handleBackButton);
    }
    
    // Обработчики для мобильных кнопок навигации
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            showMobileSection(section);
        });
    });
    
    // Синхронизация с десктопной навигацией
    syncDesktopMobileNavigation();
}

function showMobileSection(section) {
    log('info', `Showing mobile section: ${section}`);
    
    const sidebar = document.querySelector('.private-chat-sidebar');
    const mainChat = document.querySelector('.private-chat-main');
    
    switch(section) {
        case 'chats':
            if (sidebar) sidebar.classList.remove('hidden');
            if (mainChat) mainChat.classList.remove('active');
            switchToPrivate();
            break;
            
        case 'groups':
            if (sidebar) sidebar.classList.add('hidden');
            if (mainChat) mainChat.classList.add('active');
            displayGroupsInMobile();
            break;
            
        case 'search':
            if (sidebar) sidebar.classList.remove('hidden');
            if (mainChat) mainChat.classList.remove('active');
            const searchInput = document.getElementById('userSearch');
            if (searchInput) {
                searchInput.focus();
                searchInput.scrollIntoView({ behavior: 'smooth' });
            }
            break;
            
        case 'notifications':
            if (sidebar) sidebar.classList.add('hidden');
            if (mainChat) mainChat.classList.add('active');
            displayNotificationsInMobile();
            break;
            
        case 'profile':
            if (sidebar) sidebar.classList.add('hidden');
            if (mainChat) mainChat.classList.add('active');
            displayProfileInMobile();
            break;
            
        case 'admin':
            if (window.privateChatInstance && window.privateChatInstance.isAdmin) {
                window.privateChatInstance.toggleAdminPanel();
            }
            break;
    }
    
    updateMobileNavActive(section);
}

function updateMobileNavActive(activeSection) {
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.remove('active');
        const section = btn.getAttribute('data-section');
        if (section === activeSection) {
            btn.classList.add('active');
        }
    });
}

function handleBackButton() {
    const sidebar = document.querySelector('.private-chat-sidebar');
    const mainChat = document.querySelector('.private-chat-main');
    
    if (sidebar) sidebar.classList.remove('hidden');
    if (mainChat) mainChat.classList.remove('active');
    
    updateMobileNavActive('chats');
    
    // Очищаем текущий чат
    if (window.privateChatInstance) {
        window.privateChatInstance.currentChat = null;
        const privateMessages = document.getElementById('privateMessages');
        if (privateMessages) {
            privateMessages.innerHTML = '<div class="no-messages">📝 Выберите чат</div>';
        }
    }
}

function adaptInterfaceForMobile() {
    if (!isMobile) return;
    
    // Добавляем кнопку "Назад" если ее нет
    const chatHeader = document.querySelector('.chat-header .header-content');
    if (chatHeader && !chatHeader.querySelector('.back-to-chats')) {
        const backBtn = document.createElement('button');
        backBtn.className = 'back-to-chats';
        backBtn.innerHTML = '←';
        backBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 24px;
            margin-right: 10px;
            cursor: pointer;
            padding: 5px;
            color: #333;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            transition: background-color 0.2s;
        `;
        
        backBtn.addEventListener('mouseenter', () => {
            backBtn.style.backgroundColor = 'rgba(0,0,0,0.1)';
        });
        
        backBtn.addEventListener('mouseleave', () => {
            backBtn.style.backgroundColor = 'transparent';
        });
        
        backBtn.addEventListener('click', handleBackButton);
        
        chatHeader.insertBefore(backBtn, chatHeader.firstChild);
    }
    
    // Оптимизация для мобильных устройств
    optimizeForMobile();
}

function optimizeForMobile() {
    // Ленивая загрузка изображений
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                    }
                    imageObserver.unobserve(img);
                }
            });
        });
        
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
    
    // Улучшаем производительность на мобильных
    document.body.classList.add('mobile-optimized');
}

function setupSwipeGestures() {
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50;
    
    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });
    
    document.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });
    
    function handleSwipe() {
        const distance = touchEndX - touchStartX;
        const sidebar = document.querySelector('.private-chat-sidebar');
        const mainChat = document.querySelector('.private-chat-main');
        
        if (Math.abs(distance) < minSwipeDistance) return;
        
        if (distance > 0) {
            // Свайп вправо - показываем sidebar
            if (sidebar && sidebar.classList.contains('hidden')) {
                sidebar.classList.remove('hidden');
                if (mainChat) mainChat.classList.remove('active');
                updateMobileNavActive('chats');
            }
        } else {
            // Свайп влево - скрываем sidebar (только если открыт чат)
            if (sidebar && !sidebar.classList.contains('hidden') && 
                window.privateChatInstance && window.privateChatInstance.currentChat) {
                sidebar.classList.add('hidden');
                if (mainChat) mainChat.classList.add('active');
            }
        }
    }
}

function syncDesktopMobileNavigation() {
    // Синхронизация активных состояний между десктопной и мобильной навигацией
    const syncNavigation = () => {
        const activeDesktopBtn = document.querySelector('.chat-nav-btn.active');
        if (activeDesktopBtn) {
            const section = activeDesktopBtn.id.replace('Btn', '');
            updateMobileNavActive(section);
        }
    };
    
    // Следим за изменениями в десктопной навигации
    const observer = new MutationObserver(syncNavigation);
    const navContainer = document.querySelector('.chat-nav');
    if (navContainer) {
        observer.observe(navContainer, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: true
        });
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function getCurrentUsername() {
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        return usernameElement.textContent.trim();
    }
    
    // Пробуем получить из localStorage
    try {
        return localStorage.getItem('username') || 'Гость';
    } catch {
        return 'Гость';
    }
}

function formatTime(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays === 1) return 'Вчера';
    if (diffDays < 7) return `${diffDays} дн назад`;
    
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function updateUserStatus(username, status) {
    const userElements = document.querySelectorAll(`[data-username="${username}"] .user-status`);
    userElements.forEach(element => {
        element.textContent = status === 'online' ? 'В сети' : 'Не в сети';
        element.className = `user-status ${status}`;
    });
}

function showLoading(show = true, message = 'Загрузка...') {
    let loader = document.getElementById('globalLoader');
    
    if (show) {
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'globalLoader';
            loader.className = 'global-loader';
            loader.innerHTML = `
                <div class="loader-content">
                    <div class="loader-spinner"></div>
                    <div class="loader-text">${message}</div>
                </div>
            `;
            document.body.appendChild(loader);
        }
        loader.style.display = 'flex';
    } else if (loader) {
        loader.style.display = 'none';
    }
}

function showError(message, duration = 5000) {
    showConnectionStatus(`❌ ${message}`, 'error');
}

function showSuccess(message, duration = 3000) {
    showConnectionStatus(`✅ ${message}`, 'success');
}

// ==================== ЛОГАУТ И АУТЕНТИФИКАЦИЯ ====================
function logout() {
    showLoading(true, 'Выход из системы...');
    
    fetch('/api/logout', { 
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (response.ok) {
            // Очищаем локальные данные
            localStorage.removeItem('authToken');
            localStorage.removeItem('username');
            localStorage.removeItem('userData');
            
            // Отключаем socket
            disconnectSocket();
            
            // Перенаправляем на страницу входа
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        } else {
            throw new Error('Logout failed');
        }
    })
    .catch(error => {
        log('error', 'Logout error:', error);
        showError('Ошибка при выходе из системы');
        showLoading(false);
        
        // Все равно пытаемся перенаправить
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    });
}

function checkAuth() {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        window.location.href = '/';
        return false;
    }
    
    // Проверяем токен на сервере
    fetch('/api/verify-token', {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Invalid token');
        }
        return response.json();
    })
    .then(data => {
        log('info', 'User authenticated:', data.username);
        // Обновляем имя пользователя в интерфейсе
        const usernameElement = document.getElementById('username');
        if (usernameElement && data.username) {
            usernameElement.textContent = data.username;
        }
    })
    .catch(error => {
        log('error', 'Auth check failed:', error);
        localStorage.removeItem('authToken');
        window.location.href = '/';
    });
}

// ==================== МОБИЛЬНЫЕ КОМПОНЕНТЫ ====================
function displayGroupsInMobile() {
    const mainChat = document.querySelector('.private-chat-main');
    if (!mainChat) return;
    
    showLoading(true, 'Загрузка групп...');
    
    mainChat.innerHTML = `
        <div class="chat-header">
            <div class="header-content" style="display: flex; align-items: center;">
                <button class="back-to-chats" style="background: none; border: none; font-size: 24px; margin-right: 10px; cursor: pointer; padding: 5px;">←</button>
                <h3 style="margin: 0; flex: 1;">👥 Мои группы</h3>
            </div>
        </div>
        
        <div class="groups-list-container" style="padding: 15px; flex: 1; overflow-y: auto;">
            <button class="create-group-btn-mobile" style="width: 100%; padding: 15px; background: linear-gradient(135deg, #007bff, #0056b3); color: white; border: none; border-radius: 10px; margin-bottom: 20px; cursor: pointer; font-size: 16px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 2px 10px rgba(0,123,255,0.2);">
                <span style="font-size: 20px;">👥</span>
                <span>Создать группу</span>
            </button>
            
            <div id="mobileGroupsList" class="groups-list">
                <div class="loading" style="text-align: center; padding: 40px;">
                    <div class="spinner" style="width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <p style="color: #6c757d; margin: 0;">Загрузка групп...</p>
                </div>
            </div>
        </div>
    `;
    
    // Загружаем группы
    loadMobileGroups();
    
    // Обработчики
    const backBtn = mainChat.querySelector('.back-to-chats');
    const createGroupBtn = mainChat.querySelector('.create-group-btn-mobile');
    
    if (backBtn) {
        backBtn.addEventListener('click', () => showMobileSection('chats'));
    }
    
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', () => {
            if (window.groupChatManager) {
                window.groupChatManager.showCreateGroupModal();
            }
        });
    }
    
    showLoading(false);
}

async function loadMobileGroups() {
    const groupsList = document.getElementById('mobileGroupsList');
    if (!groupsList) return;
    
    try {
        const response = await fetch('/api/groups/user');
        if (response.ok) {
            const groups = await response.json();
            
            if (groups.length === 0) {
                groupsList.innerHTML = `
                    <div class="empty" style="text-align: center; padding: 60px 20px;">
                        <div style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;">👥</div>
                        <h4 style="margin: 0 0 10px 0; color: #6c757d;">У вас нет групп</h4>
                        <p style="color: #adb5bd; margin: 0 0 20px 0;">Создайте первую группу для общения</p>
                        <button class="create-group-btn-empty" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Создать группу</button>
                    </div>
                `;
                
                const createBtn = groupsList.querySelector('.create-group-btn-empty');
                if (createBtn) {
                    createBtn.addEventListener('click', () => {
                        if (window.groupChatManager) {
                            window.groupChatManager.showCreateGroupModal();
                        }
                    });
                }
                return;
            }
            
            groupsList.innerHTML = groups.map(group => `
                <div class="group-item-mobile" data-group-id="${group.id}" style="
                    padding: 15px;
                    border-bottom: 1px solid #e9ecef;
                    cursor: pointer;
                    transition: background-color 0.2s;
                ">
                    <div style="display: flex; align-items: center;">
                        <div style="font-size: 32px; margin-right: 15px; background: linear-gradient(135deg, #007bff, #00bfff); width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white;">👥</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 5px; font-size: 16px; color: #333;">${group.name}</div>
                            <div style="font-size: 13px; color: #6c757d; display: flex; align-items: center; gap: 10px;">
                                <span>👤 ${group.memberCount || group.members?.length || 0}</span>
                                <span>💬 ${group.messageCount || 0}</span>
                            </div>
                        </div>
                        <div style="font-size: 20px; color: #adb5bd;">→</div>
                    </div>
                </div>
            `).join('');
            
            // Обработчики для групп
            groupsList.querySelectorAll('.group-item-mobile').forEach(item => {
                item.addEventListener('click', () => {
                    const groupId = item.getAttribute('data-group-id');
                    const group = groups.find(g => g.id === groupId);
                    if (group && window.groupChatManager) {
                        window.groupChatManager.openGroupChat(group);
                        showGroupChatInMobile(group);
                    }
                });
                
                item.addEventListener('mouseenter', () => {
                    item.style.backgroundColor = '#f8f9fa';
                });
                
                item.addEventListener('mouseleave', () => {
                    item.style.backgroundColor = 'transparent';
                });
            });
        }
    } catch (error) {
        log('error', 'Error loading mobile groups:', error);
        groupsList.innerHTML = `
            <div class="error" style="text-align: center; padding: 40px; color: #dc3545;">
                <div style="font-size: 48px; margin-bottom: 20px;">😕</div>
                <h4 style="margin: 0 0 10px 0;">Ошибка загрузки</h4>
                <p style="margin: 0 0 20px 0;">Не удалось загрузить список групп</p>
                <button class="retry-btn" onclick="loadMobileGroups()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Повторить</button>
            </div>
        `;
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ====================
function initializeApplication() {
    log('info', '🚀 Starting Messenger application initialization...');
    
    // 1. Определяем среду
    detectEnvironment();
    
    // 2. Восстанавливаем URL сервера
    restoreServerUrl();
    
    // 3. Патчим fetch для Tauri
    if (isTauri) {
        patchFetchForTauri();
    }
    
    // 4. Инициализируем мобильный интерфейс
    isMobile = initMobileInterface();
    
    // 5. Настраиваем навигацию
    setupChatNavigation();
    
    // 6. Проверяем аутентификацию
    checkAuth();
    
    // 7. Инициализируем менеджеры в правильном порядке
    const managers = [
        { name: 'CurrencyManager', instance: 'currencyManager', delay: 50 },
        { name: 'GiftManager', instance: 'giftManager', delay: 100 },
        { name: 'PrivateChat', instance: 'privateChatInstance', delay: 150 },
        { name: 'GroupChatManager', instance: 'groupChatManager', delay: 200 },
        { name: 'ProfileManager', instance: 'profileManager', delay: 250 },
        { name: 'SettingsManager', instance: 'settingsManager', delay: 300 },
        { name: 'CallManager', instance: 'callManager', delay: 350 }
    ];
    
    managers.forEach(({ name, instance, delay }) => {
        setTimeout(() => {
            try {
                if (!window[instance] && window[name]) {
                    log('info', `Creating ${name} instance...`);
                    window[instance] = new window[name]();
                    
                    // Настраиваем мобильные обработчики если нужно
                    if (isMobile) {
                        const mobileSetupMethod = `setupMobile${name.replace('Manager', '').replace('Chat', '')}Handlers`;
                        if (window[instance] && typeof window[instance][mobileSetupMethod] === 'function') {
                            window[instance][mobileSetupMethod]();
                        }
                    }
                }
            } catch (error) {
                log('error', `Error creating ${name}:`, error);
            }
        }, delay);
    });
    
    // 8. Инициализируем socket соединение
    setTimeout(() => {
        log('info', 'Initializing socket connection...');
        initSocket();
    }, 500);
    
    // 9. Настраиваем глобальные обработчики
    setupGlobalHandlers();
    
    // 10. Запускаем фоновые задачи
    startBackgroundTasks();
    
    log('success', '✅ Application initialization complete');
}

function setupGlobalHandlers() {
    // Обработчик изменения размера окна
    window.addEventListener('resize', debounce(() => {
        const newIsMobile = window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;
        if (newIsMobile !== isMobile) {
            isMobile = newIsMobile;
            initMobileInterface();
        }
    }, 250));
    
    // Обработчик онлайн/офлайн
    window.addEventListener('online', () => {
        log('success', 'Internet connection restored');
        showConnectionStatus('🌐 Интернет соединение восстановлено', 'success');
        
        if (socket && !socket.connected) {
            setTimeout(() => socket.connect(), 1000);
        }
    });
    
    window.addEventListener('offline', () => {
        log('warning', 'Internet connection lost');
        showConnectionStatus('🌐 Интернет соединение потеряно', 'warning');
    });
    
    // Обработчик закрытия страницы
    window.addEventListener('beforeunload', (event) => {
        if (socket && socket.connected) {
            socket.emit('user_disconnecting', getCurrentUsername());
            socket.disconnect();
        }
    });
    
    // Обработчик клавиатуры для быстрых клавиш
    document.addEventListener('keydown', (event) => {
        // Ctrl/Cmd + / для поиска
        if ((event.ctrlKey || event.metaKey) && event.key === '/') {
            event.preventDefault();
            const searchInput = document.getElementById('userSearch');
            if (searchInput) {
                searchInput.focus();
            }
        }
        
        // Escape для закрытия модальных окон
        if (event.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal.show, .toast-notification.show');
            openModals.forEach(modal => {
                if (modal.classList.contains('toast-notification')) {
                    const closeBtn = modal.querySelector('.toast-close');
                    if (closeBtn) closeBtn.click();
                } else {
                    modal.style.display = 'none';
                }
            });
        }
    });
    
    log('success', 'Global handlers setup complete');
}

function startBackgroundTasks() {
    // Периодическая проверка состояния
    setInterval(() => {
        if (socket && socket.connected) {
            // Обновляем время последней активности
            localStorage.setItem('lastActivity', Date.now().toString());
            
            // Проверяем непрочитанные сообщения
            checkUnreadMessages();
            
            // Синхронизируем данные если нужно
            syncData();
        }
    }, 60000); // Каждую минуту
    
    // Проверка обновлений приложения
    setTimeout(() => {
        checkForUpdates();
    }, 10000);
    
    log('info', 'Background tasks started');
}

function checkUnreadMessages() {
    // Логика проверки непрочитанных сообщений
    // Может быть реализована позже
}

function syncData() {
    // Логика синхронизации данных
    // Может быть реализована позже
}

function checkForUpdates() {
    if (!isTauri) return;
    
    // Для Tauri приложения можно добавить проверку обновлений
    log('info', 'Checking for updates...');
    
    // Здесь может быть логика проверки обновлений для Tauri
}

// ==================== ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ ====================
window.getServerUrl = getServerUrl;
window.updateServerUrl = updateServerUrl;
window.loadNotifications = loadNotifications;
window.switchToNotifications = switchToNotifications;
window.switchToPrivate = switchToPrivate;
window.isMobileDevice = () => isMobile;
window.updateMobileNavActive = updateMobileNavActive;
window.showMobileSection = showMobileSection;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.logout = logout;
window.showLoading = showLoading;
window.showError = showError;
window.showSuccess = showSuccess;
window.disconnectSocket = disconnectSocket;
window.initSocket = initSocket;

// ==================== СТИЛИ ДЛЯ МОБИЛЬНОГО ИНТЕРФЕЙСА ====================
const mobileStyles = `
    .mobile-nav {
        display: flex;
        justify-content: space-around;
        padding: 10px 5px 12px;
        background: #ffffff;
        border-top: 1px solid #e9ecef;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        box-shadow: 0 -2px 20px rgba(0,0,0,0.1);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    }
    
    .mobile-nav-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: none;
        border: none;
        padding: 8px 5px;
        font-size: 11px;
        color: #6c757d;
        cursor: pointer;
        flex: 1;
        min-width: 0;
        max-width: 80px;
        position: relative;
        transition: all 0.2s;
        border-radius: 8px;
    }
    
    .mobile-nav-btn:hover {
        background: rgba(0,0,0,0.05);
    }
    
    .mobile-nav-btn.active {
        color: #007bff;
        transform: translateY(-2px);
    }
    
    .mobile-nav-btn.active .nav-icon {
        transform: scale(1.1);
    }
    
    .nav-icon {
        font-size: 22px;
        margin-bottom: 4px;
        transition: transform 0.2s;
    }
    
    .nav-label {
        font-size: 10px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        font-weight: 500;
    }
    
    .nav-badge {
        position: absolute;
        top: 2px;
        right: 10px;
        background: #dc3545;
        color: white;
        font-size: 9px;
        min-width: 16px;
        height: 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        font-weight: bold;
    }
    
    @media (min-width: 769px) {
        .mobile-nav {
            display: none !important;
        }
    }
    
    /* Мобильная адаптация */
    @media (max-width: 768px) {
        .chat-container {
            height: calc(100vh - 70px) !important;
            overflow: hidden;
            padding-bottom: 70px !important;
        }
        
        .private-chat-layout {
            display: flex !important;
            flex-direction: column;
            height: 100%;
            position: relative;
            overflow: hidden;
        }
        
        .private-chat-sidebar {
            position: absolute !important;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 100;
            background: white;
            transform: translateX(0);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 2px 0 10px rgba(0,0,0,0.1);
        }
        
        .private-chat-sidebar.hidden {
            transform: translateX(-100%);
            box-shadow: none;
        }
        
        .private-chat-main {
            position: absolute !important;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 101;
            background: white;
            transform: translateX(100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex !important;
            flex-direction: column;
        }
        
        .private-chat-main.active {
            transform: translateX(0);
        }
        
        .chat-header {
            padding: 15px !important;
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        .chat-top-bar {
            padding: 12px 15px !important;
            background: white;
            border-bottom: 1px solid #e9ecef;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        .chat-messages-container {
            flex: 1 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch;
        }
        
        .message-input-area {
            padding: 12px 15px !important;
            border-top: 1px solid #e9ecef !important;
            background: white;
            position: sticky;
            bottom: 0;
            z-index: 10;
        }
        
        .message-input-container {
            gap: 8px !important;
        }
        
        #privateMessageInput, #mobileGroupMessageInput {
            padding: 12px 15px !important;
            font-size: 16px !important;
            border-radius: 25px !important;
            border: 2px solid #e9ecef !important;
            background: #f8f9fa;
            transition: border-color 0.2s;
        }
        
        #privateMessageInput:focus, #mobileGroupMessageInput:focus {
            border-color: #007bff !important;
            background: white;
            outline: none;
            box-shadow: 0 0 0 3px rgba(0,123,255,0.1);
        }
        
        .send-button {
            padding: 12px 20px !important;
            font-size: 16px !important;
            border-radius: 25px !important;
            background: linear-gradient(135deg, #007bff, #0056b3) !important;
            border: none !important;
            color: white !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: transform 0.2s, box-shadow 0.2s !important;
            min-width: 80px !important;
        }
        
        .send-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 15px rgba(0,123,255,0.3);
        }
        
        .send-button:active {
            transform: translateY(0);
        }
        
        /* Анимации */
        @keyframes statusSlideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes statusSlideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        @keyframes notificationSlideIn {
            from {
                transform: translateY(-20px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        @keyframes notificationSlideOut {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(-20px);
                opacity: 0;
            }
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Оптимизация для мобильных */
        .mobile-optimized * {
            -webkit-tap-highlight-color: transparent;
        }
        
        .mobile-optimized input, 
        .mobile-optimized textarea, 
        .mobile-optimized button {
            font-size: 16px !important; /* Предотвращает масштабирование в iOS */
        }
        
        .mobile-optimized .private-message {
            max-width: 90% !important;
            margin-bottom: 12px !important;
        }
    }
    
    /* Глобальный лоадер */
    .global-loader {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
    }
    
    .loader-content {
        text-align: center;
        background: white;
        padding: 40px;
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    
    .loader-spinner {
        width: 60px;
        height: 60px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
    }
    
    .loader-text {
        font-size: 16px;
        color: #333;
        font-weight: 500;
    }
    
    /* Toast уведомления */
    .toast-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 350px;
        z-index: 10001;
        transform: translateX(150%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-left: 4px solid #007bff;
    }
    
    .toast-notification.show {
        transform: translateX(0);
    }
    
    .toast-notification.success {
        border-left-color: #28a745;
    }
    
    .toast-notification.warning {
        border-left-color: #ffc107;
    }
    
    .toast-notification.error {
        border-left-color: #dc3545;
    }
    
    .toast-icon {
        font-size: 24px;
    }
    
    .toast-content {
        flex: 1;
    }
    
    .toast-title {
        font-weight: 600;
        margin-bottom: 4px;
        color: #333;
    }
    
    .toast-message {
        font-size: 14px;
        color: #666;
        line-height: 1.4;
    }
    
    .toast-close {
        background: none;
        border: none;
        font-size: 20px;
        color: #999;
        cursor: pointer;
        padding: 0 0 0 8px;
        line-height: 1;
    }
    
    /* Статус соединения */
    .connection-status {
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        max-width: 350px;
        text-align: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: statusSlideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .connection-status.error {
        background: #dc3545;
    }
    
    .connection-status.warning {
        background: #ffc107;
        color: #333;
    }
    
    .connection-status.success {
        background: #28a745;
    }
    
    .connection-status.info {
        background: #17a2b8;
    }
    
    /* Бейдж статуса в навигации */
    .connection-status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .connection-status-badge.online {
        background: rgba(40, 167, 69, 0.1);
        color: #28a745;
    }
    
    .connection-status-badge.offline {
        background: rgba(220, 53, 69, 0.1);
        color: #dc3545;
    }
    
    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
    }
    
    .status-dot.online {
        background: #28a745;
        box-shadow: 0 0 0 2px rgba(40, 167, 69, 0.2);
    }
    
    .status-dot.offline {
        background: #dc3545;
        box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2);
    }
`;

// Добавляем стили
if (!document.getElementById('mobile-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'mobile-styles';
    styleEl.textContent = mobileStyles;
    document.head.appendChild(styleEl);
    log('info', 'Mobile styles injected');
}

// ==================== ЗАПУСК ПРИЛОЖЕНИЯ ====================
document.addEventListener('DOMContentLoaded', initializeApplication);

// Экспортируем для использования в других модулях
export {
    getServerUrl,
    updateServerUrl,
    initSocket,
    disconnectSocket,
    loadNotifications,
    showLoading,
    showError,
    showSuccess,
    isMobile,
    isTauri
};