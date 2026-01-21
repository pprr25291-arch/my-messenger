// chat.js - Основной файл инициализации

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Функция для определения устройства
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
}

// Инициализация мобильного интерфейса
function initMobileInterface() {
    if (!isMobileDevice()) {
        console.log('🖥️ Desktop device detected');
        return false;
    }
    
    console.log('📱 Mobile device detected');
    
    const sidebar = document.querySelector('.private-chat-sidebar');
    const mainChat = document.querySelector('.private-chat-main');
    const noChatSelected = document.getElementById('noChatSelected');
    const activeChat = document.getElementById('activeChat');
    
    if (sidebar) sidebar.classList.remove('hidden');
    if (mainChat) mainChat.classList.remove('active');
    if (noChatSelected) noChatSelected.style.display = 'none';
    if (activeChat) activeChat.style.display = 'none';
    
    // Создаем мобильную навигацию если ее нет
    createMobileNavigation();
    
    // Настраиваем мобильную навигацию
    setupMobileNavigation();
    
    // Адаптируем интерфейс для мобильных
    adaptInterfaceForMobile();
    
    return true;
}

// Создание мобильной навигации
function createMobileNavigation() {
    // Проверяем, есть ли уже мобильная навигация
    if (document.querySelector('.mobile-nav')) return;
    
    const mobileNav = document.createElement('div');
    mobileNav.className = 'mobile-nav';
    mobileNav.innerHTML = `
        <button class="mobile-nav-btn active" id="mobileChatsBtn">
            <span>💬</span>
            <span>Чаты</span>
        </button>
        <button class="mobile-nav-btn" id="mobileGroupsBtn">
            <span>👥</span>
            <span>Группы</span>
        </button>
        <button class="mobile-nav-btn" id="mobileSearchBtn">
            <span>🔍</span>
            <span>Поиск</span>
        </button>
        <button class="mobile-nav-btn" id="mobileProfileBtn">
            <span>👤</span>
            <span>Профиль</span>
        </button>
        ${document.getElementById('username')?.textContent === 'admin' ? 
        '<button class="mobile-nav-btn" id="mobileAdminBtn">' +
            '<span>⚙️</span>' +
            '<span>Админ</span>' +
        '</button>' : ''}
    `;
    
    document.body.appendChild(mobileNav);
}
// Проверяем Tauri и настраиваем соединение
if (typeof window.isTauri !== 'undefined' && window.isTauri) {
    console.log('📱 Running in Tauri desktop app');
    
    // Используем Tauri-версию инициализации
    window.initSocket = function() {
        return initSocketForTauri();
    };
    
    // Обновляем URL для API запросов
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        if (typeof url === 'string' && url.startsWith('/api/')) {
            const fullUrl = getServerUrl() + url;
            console.log(`🔄 Fetching: ${fullUrl}`);
            return originalFetch(fullUrl, options);
        }
        return originalFetch(url, options);
    };
}
// Настройка мобильной навигации
function setupMobileNavigation() {
    // Кнопка "Назад" в чате
    const backBtn = document.querySelector('.back-to-chats');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const sidebar = document.querySelector('.private-chat-sidebar');
            const mainChat = document.querySelector('.private-chat-main');
            
            if (sidebar) sidebar.classList.remove('hidden');
            if (mainChat) mainChat.classList.remove('active');
            
            // Обновляем активную кнопку навигации
            updateMobileNavActive('chats');
            
            // Очищаем текущий чат
            if (window.privateChatInstance) {
                window.privateChatInstance.currentChat = null;
                const privateMessages = document.getElementById('privateMessages');
                if (privateMessages) {
                    privateMessages.innerHTML = '<div class="no-messages">📝 Выберите чат</div>';
                }
            }
        });
    }
    
    // Обработчики для мобильных кнопок навигации
    const mobileChatsBtn = document.getElementById('mobileChatsBtn');
    const mobileGroupsBtn = document.getElementById('mobileGroupsBtn');
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');
    const mobileProfileBtn = document.getElementById('mobileProfileBtn');
    const mobileAdminBtn = document.getElementById('mobileAdminBtn');
    
    if (mobileChatsBtn) {
        mobileChatsBtn.addEventListener('click', () => {
            showMobileSection('chats');
        });
    }
    
    if (mobileGroupsBtn) {
        mobileGroupsBtn.addEventListener('click', () => {
            showMobileSection('groups');
        });
    }
    
    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener('click', () => {
            showMobileSection('search');
        });
    }
    
    if (mobileProfileBtn) {
        mobileProfileBtn.addEventListener('click', () => {
            showMobileSection('profile');
        });
    }
    
    if (mobileAdminBtn) {
        mobileAdminBtn.addEventListener('click', () => {
            showMobileSection('admin');
        });
    }
}

// Показ разных секций на мобильных
function showMobileSection(section) {
    const sidebar = document.querySelector('.private-chat-sidebar');
    const mainChat = document.querySelector('.private-chat-main');
    
    switch(section) {
        case 'chats':
            if (sidebar) sidebar.classList.remove('hidden');
            if (mainChat) mainChat.classList.remove('active');
            updateMobileNavActive('chats');
            break;
            
        case 'groups':
            // Показываем группы в основном окне
            if (sidebar) sidebar.classList.add('hidden');
            if (mainChat) mainChat.classList.add('active');
            displayGroupsInMobile();
            updateMobileNavActive('groups');
            break;
            
        case 'search':
            // Фокус на поле поиска
            const searchInput = document.getElementById('userSearch');
            if (searchInput) {
                if (sidebar) sidebar.classList.remove('hidden');
                if (mainChat) mainChat.classList.remove('active');
                searchInput.focus();
            }
            updateMobileNavActive('search');
            break;
            
        case 'profile':
            // Открываем настройки профиля
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal) {
                settingsModal.style.display = 'flex';
            }
            updateMobileNavActive('profile');
            break;
            
        case 'admin':
            // Открываем админ панель
            if (window.privateChatInstance && window.privateChatInstance.isAdmin) {
                window.privateChatInstance.toggleAdminPanel();
            }
            updateMobileNavActive('admin');
            break;
    }
}

// Обновление активной кнопки в мобильной навигации
function updateMobileNavActive(activeBtn) {
    const navBtns = document.querySelectorAll('.mobile-nav-btn');
    navBtns.forEach(btn => {
        btn.classList.remove('active');
        const btnText = btn.querySelector('span:last-child')?.textContent?.toLowerCase();
        const btnId = btn.id?.toLowerCase();
        
        if ((btnText && btnText.includes(activeBtn)) || 
            (btnId && btnId.includes(activeBtn)) ||
            (activeBtn === 'chat' && btnText === 'чаты')) {
            btn.classList.add('active');
        }
    });
}

// Показать список групп на мобильном
function displayGroupsInMobile() {
    const mainChat = document.querySelector('.private-chat-main');
    if (!mainChat) return;
    
    mainChat.innerHTML = `
        <div class="chat-header">
            <div class="header-content" style="display: flex; align-items: center;">
                <button class="back-to-chats" style="background: none; border: none; font-size: 20px; margin-right: 10px; cursor: pointer;">←</button>
                <h3 style="margin: 0;">👥 Группы</h3>
            </div>
        </div>
        
        <div class="groups-list-container" style="padding: 15px;">
            <button class="create-group-btn-mobile" style="width: 100%; padding: 15px; background: #007bff; color: white; border: none; border-radius: 8px; margin-bottom: 15px; cursor: pointer; font-size: 16px;">
                👥 Создать группу
            </button>
            
            <div id="mobileGroupsList" class="groups-list">
                <div class="loading">Загрузка групп...</div>
            </div>
        </div>
    `;
    
    // Загружаем группы
    loadMobileGroups();
    
    // Обработчики
    const backBtn = mainChat.querySelector('.back-to-chats');
    const createGroupBtn = mainChat.querySelector('.create-group-btn-mobile');
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            showMobileSection('chats');
        });
    }
    
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', () => {
            if (window.groupChatManager) {
                window.groupChatManager.showCreateGroupModal();
            }
        });
    }
}

// Загрузка групп для мобильного интерфейса
async function loadMobileGroups() {
    const groupsList = document.getElementById('mobileGroupsList');
    if (!groupsList) return;
    
    try {
        const response = await fetch('/api/groups/user');
        if (response.ok) {
            const groups = await response.json();
            
            if (groups.length === 0) {
                groupsList.innerHTML = '<div class="empty" style="text-align: center; padding: 40px; color: #6c757d;">У вас нет групп</div>';
                return;
            }
            
            groupsList.innerHTML = groups.map(group => `
                <div class="group-item-mobile" data-group-id="${group.id}" style="
                    padding: 15px;
                    border-bottom: 1px solid #e9ecef;
                    cursor: pointer;
                ">
                    <div style="display: flex; align-items: center;">
                        <div style="font-size: 24px; margin-right: 15px;">👥</div>
                        <div style="flex: 1;">
                            <div style="font-weight: bold; margin-bottom: 5px;">${group.name}</div>
                            <div style="font-size: 12px; color: #6c757d;">
                                ${group.memberCount || group.members?.length || 0} участников
                            </div>
                        </div>
                        <div style="font-size: 20px;">→</div>
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
            });
        }
    } catch (error) {
        console.error('Error loading mobile groups:', error);
        groupsList.innerHTML = '<div class="error" style="text-align: center; padding: 40px; color: #dc3545;">Ошибка загрузки групп</div>';
    }
}

// Показать групповой чат на мобильном
function showGroupChatInMobile(group) {
    const mainChat = document.querySelector('.private-chat-main');
    if (!mainChat) return;
    
    mainChat.innerHTML = `
        <div class="chat-top-bar" style="padding: 10px 15px; border-bottom: 1px solid #e9ecef; display: flex; align-items: center;">
            <button class="back-to-groups" style="background: none; border: none; font-size: 20px; margin-right: 10px; cursor: pointer;">←</button>
            <div class="chat-user-info" style="flex: 1; display: flex; align-items: center;">
                <div class="group-avatar" style="font-size: 24px; margin-right: 10px;">👥</div>
                <div class="user-details">
                    <h4 style="margin: 0; font-size: 16px;">${group.name}</h4>
                    <span class="user-status" style="font-size: 12px; color: #6c757d;">${group.memberCount || group.members?.length || 0} участников</span>
                </div>
            </div>
        </div>
        
        <div class="chat-messages-container" style="flex: 1; overflow-y: auto;">
            <div id="mobileGroupMessages" class="private-messages" style="padding: 15px;">
                <div class="loading">Загрузка сообщений...</div>
            </div>
        </div>
        
        <div class="message-input-area" style="padding: 10px; border-top: 1px solid #e9ecef;">
            <div class="message-input-container" style="display: flex; gap: 8px;">
                <input type="text" id="mobileGroupMessageInput" placeholder="Напишите сообщение..." autocomplete="off" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                <button type="button" class="emoji-picker-btn" style="padding: 10px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 5px; cursor: pointer;">😊</button>
                <button type="button" class="attach-file" style="padding: 10px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 5px; cursor: pointer;">📎</button>
                <button type="button" class="send-button" style="padding: 10px 15px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Отправить</button>
            </div>
        </div>
    `;
    
    // Загружаем сообщения группы
    loadMobileGroupMessages(group.id);
    
    // Обработчики
    const backBtn = mainChat.querySelector('.back-to-groups');
    const sendBtn = mainChat.querySelector('.send-button');
    const messageInput = mainChat.querySelector('#mobileGroupMessageInput');
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            showMobileSection('groups');
        });
    }
    
    if (sendBtn && messageInput) {
        sendBtn.addEventListener('click', () => {
            sendMobileGroupMessage(group.id, messageInput.value);
            messageInput.value = '';
        });
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMobileGroupMessage(group.id, messageInput.value);
                messageInput.value = '';
            }
        });
    }
}

// Загрузка сообщений группы для мобильного
async function loadMobileGroupMessages(groupId) {
    const messagesContainer = document.getElementById('mobileGroupMessages');
    if (!messagesContainer) return;
    
    try {
        const response = await fetch(`/api/groups/${groupId}/messages`);
        if (response.ok) {
            const messages = await response.json();
            
            if (messages.length === 0) {
                messagesContainer.innerHTML = '<div class="no-messages" style="text-align: center; padding: 40px; color: #6c757d;">Нет сообщений</div>';
                return;
            }
            
            const currentUser = document.getElementById('username')?.textContent || window.USERNAME;
            
            messagesContainer.innerHTML = messages.map(msg => `
                <div class="private-message ${msg.sender === currentUser ? 'own' : 'other'}" style="
                    max-width: 85%;
                    margin-bottom: 10px;
                    padding: 10px;
                    border-radius: 15px;
                    ${msg.sender === currentUser ? 
                        'background: #007bff; color: white; margin-left: auto;' : 
                        'background: #f8f9fa; color: #333; margin-right: auto;'}
                ">
                    <div class="message-content">
                        <div class="message-header" style="margin-bottom: 5px; font-size: 12px;">
                            <strong>${msg.sender}</strong>
                            <span class="message-time" style="opacity: 0.8; margin-left: 10px;">${msg.timestamp}</span>
                        </div>
                        <div class="message-text" style="font-size: 14px;">${msg.message}</div>
                    </div>
                </div>
            `).join('');
            
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } catch (error) {
        console.error('Error loading mobile group messages:', error);
        messagesContainer.innerHTML = '<div class="error" style="text-align: center; padding: 40px; color: #dc3545;">Ошибка загрузки сообщений</div>';
    }
}

// Отправка сообщения в группу с мобильного
async function sendMobileGroupMessage(groupId, message) {
    if (!message.trim()) return;
    
    try {
        const response = await fetch(`/api/groups/${groupId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                messageType: 'text'
            })
        });
        
        if (response.ok) {
            loadMobileGroupMessages(groupId);
        }
    } catch (error) {
        console.error('Error sending mobile group message:', error);
    }
}

// Адаптация интерфейса для мобильных
function adaptInterfaceForMobile() {
    if (!isMobileDevice()) return;
    
    // Добавляем кнопку "Назад" в заголовок
    const chatHeader = document.querySelector('.chat-header .header-content');
    if (chatHeader && !chatHeader.querySelector('.back-to-chats')) {
        const backBtn = document.createElement('button');
        backBtn.className = 'back-to-chats';
        backBtn.innerHTML = '←';
        backBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 20px;
            margin-right: 10px;
            cursor: pointer;
            padding: 5px;
        `;
        
        chatHeader.insertBefore(backBtn, chatHeader.firstChild);
        
        backBtn.addEventListener('click', () => {
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
        });
    }
}

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
window.isMobileDevice = isMobileDevice;
window.updateMobileNavActive = updateMobileNavActive;
window.showMobileSection = showMobileSection;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Starting application initialization...');
    
    // Инициализируем мобильный интерфейс если нужно
    const isMobile = initMobileInterface();
    
    // Настраиваем навигацию
    setupChatNavigation();
    
    // Инициализируем socket
    initSocket();
    
    // Инициализируем CurrencyManager
    setTimeout(() => {
        if (!window.currencyManager) {
            console.log('💰 Creating CurrencyManager instance...');
            window.currencyManager = new CurrencyManager();
        }
    }, 50);
    
    // Инициализируем GiftManager
    setTimeout(() => {
        if (!window.giftManager) {
            console.log('🎁 Creating GiftManager instance...');
            window.giftManager = new GiftManager();
        }
    }, 100);
    
    // Инициализируем приватный чат с учетом типа устройства
    setTimeout(() => {
        if (!window.privateChatInstance) {
            console.log('🔄 Creating PrivateChat instance...');
            window.privateChatInstance = new PrivateChat();
            
            // Добавляем мобильные обработчики если нужно
            if (isMobile && window.privateChatInstance.setupMobileChatHandlers) {
                window.privateChatInstance.setupMobileChatHandlers();
            }
        }
    }, 150);
    
    // Инициализируем групповые чаты
    setTimeout(() => {
        if (!window.groupChatManager) {
            console.log('🔄 Creating GroupChatManager instance...');
            window.groupChatManager = new GroupChatManager();
            window.groupChatManager.setupSocketListeners();
            
            // Добавляем мобильные обработчики если нужно
            if (isMobile && window.groupChatManager.setupMobileGroupHandlers) {
                window.groupChatManager.setupMobileGroupHandlers();
            }
        }
    }, 200);
    
    // Инициализируем менеджер профилей
    setTimeout(() => {
        if (!window.profileManager) {
            console.log('👤 Creating ProfileManager instance...');
            window.profileManager = new ProfileManager();
        }
    }, 250);
    
    // Инициализируем менеджер настроек
    setTimeout(() => {
        if (!window.settingsManager) {
            console.log('⚙️ Creating SettingsManager instance...');
            window.settingsManager = new SettingsManager();
        }
    }, 300);
    
    // Инициализируем менеджер звонков
    setTimeout(() => {
        if (!window.callManager) {
            console.log('📞 Creating CallManager instance...');
            window.callManager = new CallManager();
        }
    }, 350);
    
    // Добавляем обработчик изменения размера окна
    window.addEventListener('resize', function() {
        if (isMobileDevice()) {
            initMobileInterface();
        }
    });
    
    console.log('✅ Application initialization complete');
});

// Стили для мобильного интерфейса
const mobileStyles = `
    .mobile-nav {
        display: flex;
        justify-content: space-around;
        padding: 10px 5px;
        background: #ffffff;
        border-top: 1px solid #e9ecef;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
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
    }
    
    .mobile-nav-btn.active {
        color: #007bff;
    }
    
    .mobile-nav-btn span:first-child {
        font-size: 18px;
        margin-bottom: 4px;
    }
    
    .mobile-nav-btn span:last-child {
        font-size: 10px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }
    
    @media (min-width: 769px) {
        .mobile-nav {
            display: none !important;
        }
    }
    
    /* Адаптация интерфейса для мобильных */
    @media (max-width: 768px) {
        .chat-container {
            height: calc(100vh - 60px) !important;
            overflow: hidden;
        }
        
        .private-chat-layout {
            display: flex !important;
            flex-direction: column;
            height: 100%;
            position: relative;
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
            transition: transform 0.3s ease;
        }
        
        .private-chat-sidebar.hidden {
            transform: translateX(-100%);
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
            transition: transform 0.3s ease;
            display: flex !important;
            flex-direction: column;
        }
        
        .private-chat-main.active {
            transform: translateX(0);
        }
        
        .chat-header {
            padding: 15px !important;
        }
        
        .chat-top-bar {
            padding: 10px 15px !important;
        }
        
        .chat-messages-container {
            flex: 1 !important;
            overflow-y: auto !important;
        }
        
        .message-input-area {
            padding: 10px !important;
            border-top: 1px solid #e9ecef !important;
        }
        
        .message-input-container {
            gap: 5px !important;
        }
        
        #privateMessageInput, #mobileGroupMessageInput {
            padding: 8px !important;
            font-size: 14px !important;
        }
        
        .send-button {
            padding: 8px 12px !important;
            font-size: 14px !important;
        }
    }
`;

// Добавляем стили для мобильного интерфейса
if (!document.getElementById('mobile-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'mobile-styles';
    styleEl.textContent = mobileStyles;
    document.head.appendChild(styleEl);
}