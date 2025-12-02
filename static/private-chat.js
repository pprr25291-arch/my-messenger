class PrivateChat {
    constructor() {
        this.currentChat = null;
        this.conversations = [];
        this.isInitialized = false;
        this.onlineUsers = new Set();
        this.fileInput = null;
        this.currentUser = null;
        this.selectedFiles = [];
        this.isAdmin = false;
        this.groups = new Map();
        this.currentGroup = null;
        this.currentAudio = null;
        this.displayedMessageIds = new Set();
        this.avatarCache = new Map();
        
        if (!window.callManager) {
            window.callManager = new CallManager();
        }
        
        this.init();
    }

    checkAdminStatus() {
        try {
            const currentUser = document.getElementById('username')?.textContent || window.USERNAME;
            return currentUser === 'admin';
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }

    init() {
        if (this.isInitialized) return;
        
        try {
            console.log('🔄 Initializing private chat...');
            
            this.currentUser = document.getElementById('username')?.textContent;
            if (!this.currentUser) {
                console.warn('⚠️ Username not found in DOM, trying window.USERNAME');
                this.currentUser = window.USERNAME;
            }
            
            if (!this.currentUser) {
                console.error('❌ Username not found anywhere');
                this.showNotification('Не удалось определить пользователя', 'error');
                return;
            }
            
            this.isAdmin = this.checkAdminStatus();
            console.log('👤 Current user:', this.currentUser, 'Admin:', this.isAdmin);
            
            if (!window.callManager) {
                console.log('🔄 Initializing CallManager...');
                window.callManager = new CallManager();
            }
            
            this.createUI();
            this.setupEventListeners();
            this.setupSocketListeners();
            this.loadConversations();
            this.setupFileInput();
             this.setupAdminCurrencyHandlers()
            this.setupImageErrorHandling();
            this.addCustomStyles();
            this.addTypingIndicatorStyles();
            this.setupAdminPanelTabs();
            this.setupAdminNotificationHandler();
            this.setupGroupFeatures();
            this.setupEmojiPicker();
            this.setupTypingHandlers();
            
            this.isInitialized = true;
            console.log('✅ Private chat initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing PrivateChat:', error);
            this.showNotification('Ошибка инициализации приватного чата', 'error');
            this.createFallbackUI();
        }
    }
  createUI() {
    const privateChatContainer = document.getElementById('privateChat');
    if (!privateChatContainer) {
        console.error('❌ Private chat container not found');
        return;
    }

    privateChatContainer.innerHTML = `
        <div class="private-chat-layout">
            <div class="private-chat-sidebar">
                <div class="sidebar-header">
                    <h3>💬 Диалоги</h3>
                    ${this.isAdmin ? '<button class="admin-panel-btn" title="Панель администратора">🔧</button>' : ''}
                    <button class="create-group-btn" title="Создать группу">👥</button>
                </div>
                
                <div class="search-container">
                    <div class="search-input-wrapper">
                        <input type="text" id="userSearch" placeholder="🔍 Поиск пользователей..." class="search-input">
                        <button class="search-clear" id="searchClear">✕</button>
                    </div>
                    <div id="searchResults" class="search-results"></div>
                </div>
                
                <div class="conversations-header">
                    <span>Диалоги и группы</span>
                </div>
                
                <div class="conversations-list" id="conversationsList">
                    <div class="conversation-item empty">Загрузка диалогов...</div>
                </div>
            </div>
            
            <div class="private-chat-main">
                <div id="chatHeader" class="chat-header">
                    <div class="header-content">
                        <h3>💬 Приватные сообщения</h3>
                        <p>Выберите диалог или найдите пользователя</p>
                    </div>
                </div>
                
                <div id="activeChat" class="active-chat" style="display: none;">
                    <div class="chat-top-bar">
                        <div class="chat-user-info">
                            <span class="user-avatar">
                                <img src="/default-avatar.png" class="user-avatar-img" alt="" style="width: 40px; height: 40px; border-radius: 50%;">
                            </span>
                            <div class="user-details">
                                <h4 id="currentChatUser"></h4>
                                <span class="user-status" id="currentUserStatus">offline</span>
                            </div>
                        </div>
                        <div class="chat-controls">
                            <div class="call-buttons">
                                <button class="video-call-btn" title="Видеозвонок">📹</button>
                                <button class="audio-call-btn" title="Аудиозвонок">📞</button>
                            </div>
                        
                            <button class="close-chat" title="Закрыть чат">✕</button>
                        </div>
                    </div>
                    
                    <div class="chat-messages-container">
                        <div id="privateMessages" class="private-messages">
                            <div class="no-messages">📝 Начните общение первым!</div>
                        </div>
                    </div>
                    
                    <div class="message-input-area">
                        <div class="message-input-container">
                            <input type="text" id="privateMessageInput" placeholder="Напишите сообщение..." autocomplete="off">
                            <button type="button" class="emoji-picker-btn" title="Выбрать смайлик">😊</button>
                            <button type="button" class="voice-message-btn" title="Записать голосовое сообщение">🎤</button>
                            <button type="button" class="attach-file" title="Прикрепить файл">📎</button>
                            <button type="button" class="send-button">Отправить</button>
                            <input type="file" id="fileInput" style="display: none;" 
                                   accept="image/*,.pdf,.doc,.docx,.txt,.zip,.mp3,.wav,.mp4,.mov"
                                   multiple>
                        </div>
                        <div id="emojiPicker" class="emoji-picker"></div>
                        <div id="filePreview" class="file-preview-container"></div>
                    </div>
                </div>
                
                <div id="noChatSelected" class="no-chat-selected">
                    <div class="chat-icon">💬</div>
                    <h3>Выберите диалог</h3>
                    <p>Выберите существующий диалог или найдите пользователя чтобы начать общение</p>
                </div>
            </div>
        </div>
    `;

    this.createModals();
    this.setupEmojiPicker();
}
    // Новые методы для устранения дублирования
    removeDuplicateMessages(messages) {
        const seen = new Set();
        return messages.filter(message => {
            const identifier = message.id || `${message.sender}_${message.messageType}_${message.timestamp}_${message.fileData?.path}`;
            if (seen.has(identifier)) {
                console.log('🔄 Removing duplicate message:', identifier);
                return false;
            }
            seen.add(identifier);
            return true;
        });
    }
async sendGift(gift, targetUser = null) {
    const receiver = targetUser || this.currentChat;
    if (!receiver) {
        this.showNotification('Выберите чат для отправки подарка', 'error');
        return;
    }

    try {
        const currentUser = this.getCurrentUser();
        
        // Проверяем баланс
        if (window.currencyManager.balance < gift.price) {
            this.showNotification(`Недостаточно монет. Нужно: ${gift.price} 🪙`, 'error');
            return;
        }

        // Покупаем подарок
        await window.giftManager.buyGift(gift);
        
        // Создаем сообщение о подарке
        const messageData = {
            sender: currentUser,
            receiver: receiver,
            message: `🎁 Подарил(а) ${gift.name}`,
            messageType: 'gift',
            giftData: {
                id: gift.id,
                name: gift.name,
                type: gift.type,
                price: gift.price,
                icon: gift.name.split(' ')[0]
            },
            timestamp: new Date().toLocaleTimeString(),
            date: new Date().toISOString(),
            id: 'gift_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        };

        // Отправляем через сокет
        if (window.socket) {
            window.socket.emit('private message', messageData);
            
            // Также отправляем специальное событие для подарка
            window.socket.emit('send_gift', {
                sender: currentUser,
                receiver: receiver,
                gift: gift,
                messageId: messageData.id
            });
        }

        // Показываем уведомление
        this.showNotification(`Вы подарили ${gift.name} пользователю ${receiver}`, 'success');
        
        // Обновляем баланс
        this.updateCurrencyDisplays();
        
    } catch (error) {
        console.error('Error sending gift:', error);
        this.showNotification('Ошибка отправки подарка: ' + error.message, 'error');
    }
}

// Обновите метод sendGiftToCurrentChat
async sendGiftToCurrentChat(gift) {
    await this.sendGift(gift, this.currentChat);
}
    removeDuplicateGroups(groups) {
        const seen = new Set();
        return groups.filter(group => {
            if (seen.has(group.id)) {
                return false;
            }
            seen.add(group.id);
            return true;
        });
    }

setupCurrencyButtons() {
    // Обработка всех кнопок магазина подарков
    document.querySelectorAll('.gift-shop-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.currencyManager) {
                window.currencyManager.openGiftShop();
            } else {
                console.error('CurrencyManager not available');
                this.showNotification('Система подарков временно недоступна', 'error');
            }
        });
    });

    // Обработка всех кнопок баланса
    document.querySelectorAll('.currency-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showCurrencyPanel();
        });
    });

    // Кнопка ежедневной награды в сайдбаре
    const dailyRewardBtn = document.querySelector('.daily-reward-mini');
    if (dailyRewardBtn) {
        dailyRewardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.currencyManager) {
                window.currencyManager.claimDailyReward();
            }
        });
    }

    // Кнопка отправки подарка в активном чате
    const sendGiftBtn = document.querySelector('.send-gift-btn');
    if (sendGiftBtn) {
        sendGiftBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.currentChat) {
                this.openQuickGiftMenu();
            } else {
                this.showNotification('Выберите чат для отправки подарка', 'error');
            }
        });
    }

    // Кнопка быстрого подарка в поле ввода
    const quickGiftBtn = document.querySelector('.quick-gift-btn');
    if (quickGiftBtn) {
        quickGiftBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.currentChat) {
                this.openQuickGiftMenu();
            } else {
                this.showNotification('Выберите чат для отправки подарка', 'error');
            }
        });
    }

    // Обновляем баланс во всех местах
    this.updateCurrencyDisplays();
}

// Новый метод для обновления отображения баланса
updateCurrencyDisplays() {
    const balance = window.currencyManager?.balance || 0;
    
    // Обновляем баланс в сайдбаре
    const sidebarBalance = document.getElementById('sidebarBalance');
    if (sidebarBalance) sidebarBalance.textContent = balance;
    
    // Обновляем баланс в заголовке
    const headerBalance = document.getElementById('headerBalance');
    if (headerBalance) headerBalance.textContent = balance;
}

// Новый метод для меню быстрых подарков
openQuickGiftMenu() {
    if (!window.currencyManager || !window.giftManager) {
        this.showNotification('Система подарков недоступна', 'error');
        return;
    }

    const quickGifts = window.giftManager.gifts.slice(0, 3); // Берем первые 3 подарка для быстрого доступа

    const menu = document.createElement('div');
    menu.className = 'quick-gift-menu';
    menu.style.cssText = `
        position: absolute;
        bottom: 100%;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-radius: 10px;
        padding: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 1000;
        min-width: 200px;
    `;

    menu.innerHTML = `
        <div class="quick-gift-header" style="font-weight: bold; margin-bottom: 10px; text-align: center;">
            🎁 Быстрый подарок
        </div>
        ${quickGifts.map(gift => `
            <div class="quick-gift-item" data-gift-id="${gift.id}" 
                 style="display: flex; justify-content: space-between; align-items: center; 
                        padding: 8px; border-radius: 5px; cursor: pointer; margin-bottom: 5px;
                        transition: background 0.3s ease;">
                <div>
                    <span style="font-size: 20px;">${gift.name.split(' ')[0]}</span>
                    <span style="font-size: 12px; color: #666;">${gift.name}</span>
                </div>
                <div style="color: #28a745; font-weight: bold;">${gift.price} 🪙</div>
            </div>
        `).join('')}
        <div class="quick-gift-footer" style="text-align: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
            <button class="view-all-gifts" style="background: none; border: none; color: #007bff; cursor: pointer; font-size: 12px;">
                Посмотреть все подарки →
            </button>
        </div>
    `;

    // Добавляем обработчики для подарков
    menu.querySelectorAll('.quick-gift-item').forEach(item => {
        item.addEventListener('click', async () => {
            const giftId = item.getAttribute('data-gift-id');
            const gift = quickGifts.find(g => g.id === giftId);
            if (gift) {
                await this.sendGiftToCurrentChat(gift);
                menu.remove();
            }
        });
        
        // Эффекты при наведении
        item.addEventListener('mouseenter', () => {
            item.style.background = '#f8f9fa';
        });
        item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
        });
    });

    // Обработчик для кнопки "Посмотреть все"
    menu.querySelector('.view-all-gifts').addEventListener('click', () => {
        if (window.currencyManager) {
            window.currencyManager.openGiftShop();
        }
        menu.remove();
    });

    // Позиционируем меню и добавляем в DOM
    const sendGiftBtn = document.querySelector('.send-gift-btn') || document.querySelector('.quick-gift-btn');
    if (sendGiftBtn) {
        const rect = sendGiftBtn.getBoundingClientRect();
        menu.style.bottom = 'auto';
        menu.style.top = (rect.top - menu.offsetHeight - 10) + 'px';
        menu.style.left = (rect.left - menu.offsetWidth + rect.width) + 'px';
    }

    document.body.appendChild(menu);

    // Закрытие меню при клике вне его
    const closeMenu = (e) => {
        if (!menu.contains(e.target) && !sendGiftBtn.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);
}

// Метод для отправки подарка в текущий чат
async sendGiftToCurrentChat(gift) {
    if (!this.currentChat) {
        this.showNotification('Выберите чат для отправки подарка', 'error');
        return;
    }

    try {
        // Проверяем баланс
        if (window.currencyManager.balance < gift.price) {
            this.showNotification(`Недостаточно монет. Нужно: ${gift.price} 🪙`, 'error');
            return;
        }

        // Покупаем подарок
        await window.giftManager.buyGift(gift);
        
        // Отправляем сообщение о подарке
        const message = `🎁 Подарил(а) ${gift.name} пользователю ${this.currentChat}`;
        if (window.socket) {
            window.socket.emit('private message', {
                sender: document.getElementById('username')?.textContent,
                receiver: this.currentChat,
                message: message,
                messageType: 'gift',
                giftData: gift
            });
        }

        this.showNotification(`Вы подарили ${gift.name} пользователю ${this.currentChat}`, 'success');
        
    } catch (error) {
        console.error('Error sending gift:', error);
        this.showNotification('Ошибка отправки подарка', 'error');
    }
}
updateSidebarBalance() {
    const sidebarBalance = document.getElementById('sidebarBalance');
    if (sidebarBalance && window.currencyManager) {
        sidebarBalance.textContent = window.currencyManager.balance;
    }
}

showCurrencyPanel() {
    // Создаем модальное окно с информацией о валюте
    const modal = document.createElement('div');
    modal.id = 'currencyPanelModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    modal.innerHTML = `
        <div class="modal-content" style="
            background: white;
            padding: 25px;
            border-radius: 15px;
            width: 400px;
            max-width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                <h3 style="margin: 0;">🪙 Мой баланс</h3>
                <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
            </div>
            
            <div class="currency-panel-content">
                <div class="balance-display-large" style="text-align: center; margin-bottom: 25px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">🪙</div>
                    <div style="font-size: 32px; font-weight: bold; color: #28a745;" id="modalBalance">${window.currencyManager?.balance || 0}</div>
                    <div style="color: #6c757d; margin-top: 5px;">монет</div>
                </div>
                
                <div class="currency-actions" style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <button class="btn-primary" onclick="window.currencyManager.claimDailyReward()" style="flex: 1; padding: 12px;">
                        🎁 Ежедневная награда
                    </button>
                    <button class="btn-secondary" onclick="window.currencyManager.openGiftShop()" style="flex: 1; padding: 12px;">
                        🛒 Магазин подарков
                    </button>
                </div>
                
                <div class="currency-info" style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <h5 style="margin-bottom: 10px;">💡 Как получить монеты?</h5>
                    <ul style="margin: 0; padding-left: 20px; color: #495057;">
                        <li>Ежедневные награды</li>
                        <li>Активность в чате</li>
                        <li>Создание групп</li>
                        <li>Приглашение друзей</li>
                    </ul>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Обработчики событий
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}
async loadUserAvatar(username) {
    if (!username) return this.getDefaultAvatarUrl();
    
    // Проверяем кэш
    if (this.avatarCache.has(username)) {
        return this.avatarCache.get(username);
    }

    try {
        // Пробуем несколько эндпоинтов
        const endpoints = [
            `/api/user/${username}/avatar`,
            `/api/users/${username}/avatar`, 
            `/uploads/avatars/${username}.jpg`,
            `/uploads/avatars/${username}.png`,
            `/uploads/avatars/avatar_${username}.jpg`,
            `/uploads/avatars/avatar_${username}.png`
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'HEAD',
                    credentials: 'same-origin'
                });
                
                if (response.ok) {
                    this.avatarCache.set(username, endpoint);
                    return endpoint;
                }
            } catch (error) {
                continue;
            }
        }
        
        // Если ничего не найдено, используем дефолтный аватар
        const defaultAvatar = this.getDefaultAvatarUrl();
        this.avatarCache.set(username, defaultAvatar);
        return defaultAvatar;
        
    } catch (error) {
        console.error('Error loading avatar:', error);
        return this.getDefaultAvatarUrl();
    }
}
// Метод для очистки кэша при необходимости
clearAvatarCache() {
    this.avatarCache.clear();
}

async updateUserAvatar(username) {
    this.avatarCache.delete(username);
    return await this.loadUserAvatar(username);
}
    getDefaultAvatarUrl() {
        return '/default-avatar.png';
    }
async checkImageExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        let timer = setTimeout(() => {
            resolve(false);
        }, 2000);
        
        img.onload = () => {
            clearTimeout(timer);
            resolve(true);
        };
        
        img.onerror = () => {
            clearTimeout(timer);
            resolve(false);
        };
        
        img.src = url;
    });
}
async loadUserAvatarSafe(username, maxRetries = 2) {
    if (!username) return this.getDefaultAvatarUrl();

    if (this.avatarCache.has(username)) {
        const cached = this.avatarCache.get(username);
        if (cached !== this.getDefaultAvatarUrl()) {
            return cached;
        }
    }
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const avatarUrl = await this.loadUserAvatar(username);
            if (avatarUrl && avatarUrl !== this.getDefaultAvatarUrl()) {
                return avatarUrl;
            }
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ Avatar load attempt ${attempt + 1} failed for ${username}:`, error.message);
            
            if (attempt < maxRetries) {
                // Ждем перед повторной попыткой
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }
    
    console.error(`❌ All avatar load attempts failed for ${username}:`, lastError);
    const defaultAvatar = this.getDefaultAvatarUrl();
    this.avatarCache.set(username, defaultAvatar);
    return defaultAvatar;
}

handleAvatarError(img) {
    console.log('❌ Avatar image failed to load, using default');
    img.src = this.getDefaultAvatarUrl();
    img.onerror = null; // Предотвращаем бесконечный цикл ошибок
    
    // Обновляем кэш
    if (img.alt) {
        this.avatarCache.set(img.alt, this.getDefaultAvatarUrl());
    }
}

    // Исправленный метод загрузки групп
    async loadUserGroups() {
        try {
            console.log('🔄 Loading user groups...');
            
            const endpoints = [
                '/api/groups/user',
                '/api/user/groups', 
                '/api/groups'
            ];
            
            let groups = [];
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`🔍 Trying endpoint: ${endpoint}`);
                    const response = await fetch(endpoint);
                    
                    if (response.ok) {
                        groups = await response.json();
                        console.log(`✅ Groups loaded from ${endpoint}:`, groups.length);
                        break;
                    } else {
                        console.log(`⚠️ ${endpoint} returned ${response.status}`);
                    }
                } catch (error) {
                    console.log(`❌ ${endpoint} failed:`, error.message);
                }
            }
            
            if (groups.length === 0) {
                console.log('⚠️ All API endpoints failed, using local groups');
                groups = this.getLocalGroups();
            }

            const currentUser = document.getElementById('username')?.textContent;
            
            const groupsWithMessages = await Promise.all(
                groups.map(async group => {
                    try {
                        let lastMessage = null;
                        
                        try {
                            const messagesResponse = await fetch(`/api/groups/${group.id}/messages`);
                            if (messagesResponse.ok) {
                                const messages = await messagesResponse.json();
                                if (messages && messages.length > 0) {
                                    const sortedMessages = messages.sort((a, b) => 
                                        new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp)
                                    );
                                    lastMessage = sortedMessages[0];
                                }
                            }
                        } catch (messageError) {
                            console.log(`📝 No messages for group ${group.id}:`, messageError.message);
                            
                            const localMessages = this.getLocalGroupMessages(group.id);
                            if (localMessages && localMessages.length > 0) {
                                const sortedLocalMessages = localMessages.sort((a, b) => 
                                    new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp)
                                );
                                lastMessage = sortedLocalMessages[0];
                            }
                        }
                        
                        const formattedGroup = {
                            id: group.id || group._id,
                            name: group.name || group.groupName,
                            isGroup: true,
                            username: group.name || group.groupName,
                            members: group.members || [],
                            createdBy: group.createdBy,
                            createdAt: group.createdAt,
                            memberCount: group.members ? group.members.length : 
                                       group.memberCount || group.participants ? group.participants.length : 0,
                            lastMessage: lastMessage ? {
                                text: lastMessage.message || lastMessage.text || 'Голосовое сообщение',
                                timestamp: this.formatMessageTime(lastMessage.timestamp || lastMessage.date),
                                sender: lastMessage.sender,
                                type: lastMessage.messageType || lastMessage.type || 'text',
                                isOwn: lastMessage.sender === currentUser
                            } : null
                        };
                        
                        return formattedGroup;
                        
                    } catch (error) {
                        console.error(`❌ Error processing group ${group.id}:`, error);
                        return {
                            id: group.id || group._id,
                            name: group.name || group.groupName,
                            isGroup: true,
                            username: group.name || group.groupName,
                            members: group.members || [],
                            lastMessage: null
                        };
                    }
                })
            );
            
            const validGroups = groupsWithMessages.filter(group => group && group.id);
            const uniqueGroups = this.removeDuplicateGroups(validGroups);
            
            console.log(`✅ Final processed groups:`, uniqueGroups.length);
            return uniqueGroups;
            
        } catch (error) {
            console.error('❌ Error loading user groups:', error);
            return [];
        }
    }

    // Исправленный метод отображения истории сообщений
    displayMessageHistory(messages) {
        const container = document.getElementById('privateMessages');
        if (!container) return;
        
        container.innerHTML = '';
        this.displayedMessageIds.clear();
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="no-messages">📝 Начните общение первым!</div>';
            return;
        }
        
        const uniqueMessages = this.removeDuplicateMessages(messages);
        uniqueMessages.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        uniqueMessages.forEach(message => {
            if (!message.id) {
                message.id = 'msg_' + new Date(message.date).getTime() + '_' + Math.random().toString(36).substr(2, 5);
            }
            this.displayMessage(message, false);
        });
        this.scrollToBottom();
    }

    // Исправленный метод обработки входящих сообщений
    handleIncomingMessage(data) {
        const messageId = data.id || `${data.sender}_${data.messageType}_${data.timestamp}_${data.fileData?.path}`;
        
        if (this.displayedMessageIds.has(messageId)) {
            console.log('⚠️ Private message already displayed, skipping:', messageId);
            return;
        }
        
        this.displayedMessageIds.add(messageId);
        
        if (this.currentChat && 
            ((data.sender === this.currentChat && data.receiver === document.getElementById('username')?.textContent) ||
             (data.receiver === this.currentChat && data.sender === document.getElementById('username')?.textContent))) {
            
            console.log('📨 Displaying incoming message:', data.messageType, data);
            this.displayMessage(data, true);
        }
        this.loadConversations();
    }

    createFallbackUI() {
        const privateChatContainer = document.getElementById('privateChat');
        if (!privateChatContainer) return;
        
        privateChatContainer.innerHTML = `
            <div class="fallback-chat">
                <div class="fallback-header">
                    <h3>💬 Приватные сообщения</h3>
                </div>
                <div class="fallback-content">
                    <p>Не удалось загрузить полнофункциональный приватный чат.</p>
                    <p>Попробуйте обновить страницу или обратитесь к администратору.</p>
                    <button onclick="location.reload()">Обновить страницу</button>
                </div>
            </div>
        `;
    }

  
// В методе createModals класса PrivateChat, добавьте новую вкладку:
addCurrencyAdminTab() {
    const adminPanel = document.getElementById('adminPanel');
    if (!adminPanel) return;

    // Добавляем кнопку вкладки
    const tabsContainer = adminPanel.querySelector('.admin-tabs');
    if (tabsContainer) {
        tabsContainer.innerHTML += `
            <button class="admin-tab-btn" data-tab="currency" style="padding: 10px 15px; border: none; background: #6c757d; color: white; border-radius: 5px; cursor: pointer;">🪙 Управление валютой</button>
        `;
    }

    // Добавляем содержимое вкладки
    const tabContent = adminPanel.querySelector('.admin-tab-content');
    if (tabContent) {
        tabContent.innerHTML += `
            <div id="tab-currency" class="admin-tab-pane">
                <div class="currency-admin-controls">
                    <h4 style="margin-bottom: 15px;">🪙 Управление валютой пользователей</h4>
                    
                    <div class="admin-currency-form">
                        <h5>Изменение баланса</h5>
                        <div class="currency-controls">
                            <div class="form-group currency-user-input">
                                <label>Пользователь:</label>
                                <input type="text" id="currencyTargetUser" class="form-input" placeholder="Имя пользователя">
                            </div>
                            <div class="form-group currency-amount-input">
                                <label>Сумма:</label>
                                <input type="number" id="currencyAmount" class="form-input" placeholder="0" value="10">
                            </div>
                            <div class="form-group">
                                <label>Действие:</label>
                                <div style="display: flex; gap: 10px;">
                                    <button class="btn-success" onclick="window.currencyManager.addCurrency()" style="padding: 10px 15px;">➕ Добавить</button>
                                    <button class="btn-danger" onclick="window.currencyManager.removeCurrency()" style="padding: 10px 15px;">➖ Снять</button>
                                </div>
                            </div>
                        </div>
                        <div class="form-group" style="margin-top: 10px;">
                            <label>Причина:</label>
                            <input type="text" id="currencyReason" class="form-input" placeholder="Необязательно">
                        </div>
                    </div>

                    <div class="users-currency-list" style="margin-top: 20px;">
                        <h5>Балансы пользователей</h5>
                        <div id="usersCurrencyList" class="users-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                            <div class="loading">Загрузка...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
    setupEmojiPicker() {
        const emojiPicker = document.getElementById('emojiPicker');
        if (!emojiPicker) return;
        
        const basicEmojis = [
            "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", 
            "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", 
            "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", 
            "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", 
            "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠"
        ];
        
        emojiPicker.innerHTML = '<div class="emoji-picker-header">Выберите смайлик</div><div class="emoji-list">';
        
        basicEmojis.forEach(emoji => {
            emojiPicker.innerHTML += `<span class="emoji" data-emoji="${emoji}">${emoji}</span>`;
        });
        
        emojiPicker.innerHTML += '</div>';
        
        const emojiElements = emojiPicker.querySelectorAll('.emoji');
        emojiElements.forEach(emojiEl => {
            emojiEl.addEventListener('click', () => {
                const emoji = emojiEl.getAttribute('data-emoji');
                this.insertEmoji(emoji);
            });
        });
        
        document.addEventListener('click', (e) => {
            if (!emojiPicker.contains(e.target) && !e.target.classList.contains('emoji-picker-btn')) {
                emojiPicker.style.display = 'none';
            }
        });
    }

    insertEmoji(emoji) {
        const messageInput = document.getElementById('privateMessageInput');
        const groupMessageInput = document.getElementById('groupMessageInput');
        
        if (messageInput && messageInput.offsetParent !== null) {
            const start = messageInput.selectionStart;
            const end = messageInput.selectionEnd;
            const text = messageInput.value;
            messageInput.value = text.substring(0, start) + emoji + text.substring(end);
            messageInput.focus();
            messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
        } else if (groupMessageInput && groupMessageInput.offsetParent !== null) {
            const start = groupMessageInput.selectionStart;
            const end = groupMessageInput.selectionEnd;
            const text = groupMessageInput.value;
            groupMessageInput.value = text.substring(0, start) + emoji + text.substring(end);
            groupMessageInput.focus();
            groupMessageInput.selectionStart = groupMessageInput.selectionEnd = start + emoji.length;
        }
        
        const emojiPicker = document.getElementById('emojiPicker');
        if (emojiPicker) {
            emojiPicker.style.display = 'none';
        }
    }
createModals() {
    // Админ панель
    if (!document.getElementById('adminPanel')) {
        const adminPanel = document.createElement('div');
        adminPanel.id = 'adminPanel';
        adminPanel.className = 'modal-overlay';
        adminPanel.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        adminPanel.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 25px;
                border-radius: 15px;
                width: 700px;
                max-width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <div class="admin-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                    <h3 style="margin: 0;">🔧 Панель администратора</h3>
                    <button class="close-admin-panel" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
                </div>
                
                <div class="admin-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                    <button class="admin-tab-btn active" data-tab="system" style="padding: 10px 15px; border: none; background: #007bff; color: white; border-radius: 5px; cursor: pointer; margin-bottom: 5px;">📢 Системные уведомления</button>
                    <button class="admin-tab-btn" data-tab="users" style="padding: 10px 15px; border: none; background: #6c757d; color: white; border-radius: 5px; cursor: pointer; margin-bottom: 5px;">👥 Управление пользователями</button>
                    <button class="admin-tab-btn" data-tab="currency" style="padding: 10px 15px; border: none; background: #28a745; color: white; border-radius: 5px; cursor: pointer; margin-bottom: 5px;">🪙 Управление валютой</button>
                </div>
                
                <div class="admin-tab-content">
                    <div id="tab-system" class="admin-tab-pane active">
                        <div class="notification-form">
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Тип уведомления:</label>
                                <select id="notificationType" class="form-input" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                    <option value="info">ℹ️ Информация</option>
                                    <option value="warning">⚠️ Предупреждение</option>
                                    <option value="error">❌ Ошибка</option>
                                    <option value="success">✅ Успех</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Заголовок:</label>
                                <input type="text" id="notificationTitle" class="form-input" placeholder="Введите заголовок уведомления" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Получатель:</label>
                                <select id="notificationTarget" class="form-input" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                    <option value="all">👥 Все пользователи</option>
                                    <option value="user">👤 Конкретный пользователь</option>
                                </select>
                            </div>
                            <div id="userSelection" class="form-group" style="display: none; margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Пользователь:</label>
                                <input type="text" id="targetUser" class="form-input" placeholder="Введите имя пользователя" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            </div>
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Сообщение:</label>
                                <textarea id="notificationMessage" class="form-input" rows="4" placeholder="Текст системного уведомления..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;"></textarea>
                            </div>
                            <button class="send-notification-btn" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">📢 Отправить уведомление</button>
                        </div>
                    </div>
                    
                    <div id="tab-users" class="admin-tab-pane" style="display: none;">
                        <div class="users-management">
                            <h4 style="margin-bottom: 15px;">👥 Активные пользователи</h4>
                            <div id="onlineUsersList" class="users-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                                <div class="loading">Загрузка...</div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="tab-currency" class="admin-tab-pane" style="display: none;">
                        <div class="currency-admin-controls">
                            <h4 style="margin-bottom: 15px;">🪙 Управление валютой пользователей</h4>
                            
                            <div class="admin-currency-form" style="margin-bottom: 20px;">
                                <h5 style="margin-bottom: 10px;">Изменение баланса</h5>
                                <div class="currency-controls" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                    <div class="form-group">
                                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Пользователь:</label>
                                        <input type="text" id="currencyTargetUser" class="form-input" placeholder="Имя пользователя" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                    </div>
                                    <div class="form-group">
                                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Сумма:</label>
                                        <input type="number" id="currencyAmount" class="form-input" placeholder="0" value="10" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                    </div>
                                </div>
                                <div class="form-group" style="margin-bottom: 15px;">
                                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Действие:</label>
                                    <div style="display: flex; gap: 10px;">
                                        <button class="btn-success" onclick="window.currencyManager.addCurrency()" style="padding: 10px 15px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; flex: 1;">➕ Добавить</button>
                                        <button class="btn-danger" onclick="window.currencyManager.removeCurrency()" style="padding: 10px 15px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; flex: 1;">➖ Снять</button>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Причина:</label>
                                    <input type="text" id="currencyReason" class="form-input" placeholder="Необязательно" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                </div>
                            </div>

                            <div class="users-currency-list">
                                <h5 style="margin-bottom: 10px;">Балансы пользователей</h5>
                                <div id="usersCurrencyList" class="users-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                                    <div class="loading">Загрузка...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(adminPanel);
    }

    // Модальное окно просмотра изображений
    if (!document.getElementById('imageViewerModal')) {
        const imageViewer = document.createElement('div');
        imageViewer.id = 'imageViewerModal';
        imageViewer.className = 'modal-overlay';
        imageViewer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        imageViewer.innerHTML = `
            <button class="close-image-viewer" style="
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                font-size: 20px;
                cursor: pointer;
                z-index: 10001;
            ">✕</button>
            <div class="image-container" style="max-width: 90vw; max-height: 90vh;">
                <img src="" alt="Просмотр изображения" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">
            </div>
        `;
        
        document.body.appendChild(imageViewer);

        const closeBtn = imageViewer.querySelector('.close-image-viewer');
        closeBtn.addEventListener('click', () => {
            imageViewer.style.display = 'none';
        });
        
        imageViewer.addEventListener('click', (e) => {
            if (e.target === imageViewer) {
                imageViewer.style.display = 'none';
            }
        });
    }

    // Модальное окно создания группы
    if (!document.getElementById('createGroupModal')) {
        const createGroupModal = document.createElement('div');
        createGroupModal.id = 'createGroupModal';
        createGroupModal.className = 'modal-overlay';
        createGroupModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        createGroupModal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 25px;
                border-radius: 15px;
                width: 600px;
                max-width: 95%;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            ">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                    <h3 style="margin: 0; color: #333;">👥 Создать групповой чат</h3>
                    <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
                </div>
                
                <div class="modal-body" style="flex: 1; overflow-y: auto; padding-right: 5px; margin-bottom: 20px;">
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 15px; color: #2c3e50;">Название группы:</label>
                        <input type="text" id="groupName" class="form-control" placeholder="Введите название группы" style="width: 100%; padding: 14px 16px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 15px;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 15px; color: #2c3e50;">Выберите участников:</label>
                        <div class="users-list-container" style="max-height: 400px; min-height: 300px; overflow-y: auto; border: 2px solid #e9ecef; border-radius: 10px; background: white; padding: 10px;">
                            <div id="availableUsers" class="users-list">
                                <div style="padding: 20px; text-align: center; color: #666;">Загрузка пользователей...</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 15px; color: #2c3e50;">Выбранные участники:</label>
                        <div class="selected-users-container" style="min-height: 100px; max-height: 150px; overflow-y: auto; border: 2px dashed #dee2e6; padding: 15px; border-radius: 10px; background: #f8f9fa;">
                            <div id="selectedUsers" class="selected-users">
                                <div style="color: #666; text-align: center; padding: 20px;">Пользователи не выбраны</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <button id="createGroupBtn" class="btn-primary" style="background: linear-gradient(45deg, #667eea, #764ba2); color: white; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.3s ease; width: 100%;">Создать группу</button>
            </div>
        `;

        document.body.appendChild(createGroupModal);
    }

    // Модальное окно профиля пользователя
    if (!document.getElementById('userProfileModal')) {
        const profileModal = document.createElement('div');
        profileModal.id = 'userProfileModal';
        profileModal.className = 'modal-overlay';
        profileModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        profileModal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 25px;
                border-radius: 15px;
                width: 400px;
                max-width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                    <h3 style="margin: 0;">👤 Профиль пользователя</h3>
                    <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
                </div>
                
                <div class="profile-content">
                    <div class="profile-header" style="text-align: center; margin-bottom: 20px;">
                        <div class="profile-avatar" style="width: 100px; height: 100px; border-radius: 50%; overflow: hidden; margin: 0 auto 15px; border: 3px solid #007bff;">
                            <img id="profileAvatarImg" src="/default-avatar.png" alt="" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <h4 id="profileUsername" style="margin: 0 0 5px 0; color: #333;">Загрузка...</h4>
                        <div class="user-status" id="profileUserStatus" style="color: #6c757d;">Загрузка...</div>
                    </div>
                    
                    <div class="profile-actions" style="display: flex; gap: 10px; margin-bottom: 20px;">
                        <button class="btn-primary" id="profileMessageBtn" style="flex: 1; padding: 10px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            💬 Написать сообщение
                        </button>
                        <button class="btn-secondary" id="profileGiftBtn" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            🎁 Отправить подарок
                        </button>
                    </div>
                    
                    <div class="profile-info">
                        <div class="info-section" style="margin-bottom: 15px;">
                            <h5 style="margin-bottom: 10px; color: #495057;">📊 Статистика</h5>
                            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                                <div class="stat-item" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                                    <div style="font-size: 12px; color: #6c757d;">В сети</div>
                                    <div id="profileOnlineStatus" style="font-weight: bold; color: #28a745;">Проверка...</div>
                                </div>
                                <div class="stat-item" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                                    <div style="font-size: 12px; color: #6c757d;">Баланс</div>
                                    <div id="profileBalance" style="font-weight: bold;">🪙 ...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(profileModal);
    }

    // Модальное окно магазина подарков
    if (!document.getElementById('giftShopModal')) {
        const giftShopModal = document.createElement('div');
        giftShopModal.id = 'giftShopModal';
        giftShopModal.className = 'modal-overlay';
        giftShopModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        giftShopModal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 25px;
                border-radius: 15px;
                width: 800px;
                max-width: 95%;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            ">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                    <h3 style="margin: 0; color: #333;">🛒 Магазин подарков</h3>
                    <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
                </div>
                
                <div class="gift-shop-content" style="flex: 1; overflow-y: auto;">
                    <div class="gift-shop-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div class="user-balance" style="font-size: 18px; font-weight: bold; color: #28a745;">
                            Ваш баланс: <span id="giftShopBalance">0</span> 🪙
                        </div>
                        <div class="gift-categories" style="display: flex; gap: 10px;">
                            <button class="category-btn active" data-category="all" style="padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">Все</button>
                            <button class="category-btn" data-category="common" style="padding: 8px 12px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">Обычные</button>
                            <button class="category-btn" data-category="rare" style="padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">Редкие</button>
                            <button class="category-btn" data-category="epic" style="padding: 8px 12px; background: #6f42c1; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">Эпические</button>
                        </div>
                    </div>
                    
                    <div id="giftsGrid" class="gifts-grid" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                        gap: 15px;
                        padding: 10px;
                    ">
                        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6c757d;">
                            Загрузка подарков...
                        </div>
                    </div>
                </div>
                
                <div class="gift-shop-footer" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e9ecef;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 14px; color: #6c757d;">
                            Выбрано: <span id="selectedGiftCount">0</span> подарков
                        </div>
                        <button id="confirmGiftPurchase" class="btn-primary" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                            🛒 Купить выбранное
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(giftShopModal);
    }

    // Модальное окно смены пароля
    if (!document.getElementById('changePasswordModal')) {
        const changePasswordModal = document.createElement('div');
        changePasswordModal.id = 'changePasswordModal';
        changePasswordModal.className = 'modal-overlay';
        changePasswordModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;

        changePasswordModal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 25px;
                border-radius: 15px;
                width: 400px;
                max-width: 95%;
            ">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                    <h3 style="margin: 0; color: #333;">🔑 Смена пароля</h3>
                    <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
                </div>
                
                <div class="password-form">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Текущий пароль</label>
                        <input type="password" id="currentPassword" class="form-control" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ced4da;
                            border-radius: 5px;
                        ">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Новый пароль</label>
                        <input type="password" id="newPassword" class="form-control" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ced4da;
                            border-radius: 5px;
                        ">
                        <div class="password-strength" style="margin-top: 5px;">
                            <div class="strength-bar" style="
                                height: 5px;
                                background: #e9ecef;
                                border-radius: 3px;
                                overflow: hidden;
                                margin-bottom: 5px;
                            ">
                                <div style="height: 100%; background: #dc3545; width: 0%; transition: width 0.3s ease;"></div>
                            </div>
                            <div class="strength-text" style="font-size: 12px; color: #6c757d;">Надежность пароля: Слабый</div>
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Подтвердите новый пароль</label>
                        <input type="password" id="confirmPassword" class="form-control" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ced4da;
                            border-radius: 5px;
                        ">
                    </div>
                    
                    <button id="confirmPasswordChange" class="btn-primary" style="
                        width: 100%;
                        padding: 12px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                    ">💾 Сохранить пароль</button>
                </div>
            </div>
        `;

        document.body.appendChild(changePasswordModal);
    }

    // Настройка обработчиков событий для модальных окон
    this.setupModalEventListeners();
}

setupModalEventListeners() {
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) {
        const closeAdminPanel = adminPanel.querySelector('.close-admin-panel');
        const notificationTarget = adminPanel.querySelector('#notificationTarget');
        const userSelection = adminPanel.querySelector('#userSelection');
        
        if (closeAdminPanel) {
            closeAdminPanel.addEventListener('click', () => {
                adminPanel.style.display = 'none';
            });
        }
        
        if (notificationTarget && userSelection) {
            notificationTarget.addEventListener('change', (e) => {
                if (e.target.value === 'user') {
                    userSelection.style.display = 'block';
                } else {
                    userSelection.style.display = 'none';
                }
            });
        }
        
        adminPanel.addEventListener('click', (e) => {
            if (e.target === adminPanel) {
                adminPanel.style.display = 'none';
            }
        });
    }

    // Обработчики для других модальных окон
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('video-call-btn')) {
                const targetUser = this.getCurrentChatUser();
                if (targetUser) {
                    window.callManager.initiateCall(targetUser, 'video');
                }
            } else if (e.target.classList.contains('audio-call-btn')) {
                const targetUser = this.getCurrentChatUser();
                if (targetUser) {
                    window.callManager.initiateCall(targetUser, 'audio');
                }
            }
        });
 document.addEventListener('click', (e) => {
        const avatar = e.target.closest('.user-avatar-img, .conversation-avatar, .search-avatar-img');
        if (avatar && avatar.alt) {
            e.preventDefault();
            e.stopPropagation();
            this.openUserProfile(avatar.alt);
        }
    });
        document.addEventListener('click', (e) => {
            if (e.target.id === 'searchClear') {
                const userSearch = document.getElementById('userSearch');
                const results = document.getElementById('searchResults');
                if (userSearch) userSearch.value = '';
                if (results) {
                    results.innerHTML = '';
                    results.style.display = 'none';
                }
            }

            if (e.target.classList.contains('send-button')) {
                this.sendPrivateMessage();
            }

            if (e.target.classList.contains('close-chat')) {
                this.closeCurrentChat();
            }

            if (e.target.classList.contains('attach-file')) {
                const fileInput = document.getElementById('fileInput');
                if (fileInput) fileInput.click();
            }

            if (e.target.classList.contains('admin-panel-btn')) {
                this.toggleAdminPanel();
            }

            if (e.target.classList.contains('emoji-picker-btn')) {
                this.toggleEmojiPicker();
            }
        
           else if (e.target.classList.contains('gift-shop-btn')) {
            if (window.currencyManager) {
                window.currencyManager.openGiftShop();
            }
        }
        else if (e.target.classList.contains('currency-btn')) {
            this.showCurrencyPanel();
        }
    });

        const userSearch = document.getElementById('userSearch');
        if (userSearch) {
            userSearch.addEventListener('input', this.debounce(() => {
                this.searchUsers();
            }, 300));
        }

        const messageInput = document.getElementById('privateMessageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendPrivateMessage();
            });
        }

        this.setupFileInput();

        document.addEventListener('click', (e) => {
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer && !searchContainer.contains(e.target)) {
                const results = document.getElementById('searchResults');
                if (results) results.style.display = 'none';
            }
        });
            document.addEventListener('click', (e) => {
        if (e.target.classList.contains('video-call-btn')) {
            const targetUser = this.getCurrentChatUser();
            if (targetUser) {
                window.callManager.initiateCall(targetUser, 'video');
            }
        } else if (e.target.classList.contains('audio-call-btn')) {
            const targetUser = this.getCurrentChatUser();
            if (targetUser) {
                window.callManager.initiateCall(targetUser, 'audio');
            }
        }
    });
    document.addEventListener('click', (e) => {
        const avatar = e.target.closest('.user-avatar-img, .conversation-avatar, .search-avatar-img');
        if (avatar && avatar.alt) {
            e.preventDefault();
            e.stopPropagation();
            this.openUserProfile(avatar.alt);
        }
    });

    }
setupAdminCurrencyHandlers() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-success') && e.target.onclick) {
            const userInput = document.getElementById('currencyTargetUser');
            const amountInput = document.getElementById('currencyAmount');
            const reasonInput = document.getElementById('currencyReason');
            
            if (userInput && amountInput) {
                const username = userInput.value.trim();
                const amount = parseInt(amountInput.value);
                const reason = reasonInput.value.trim();
                
                if (username && amount > 0) {
                    // Используем CurrencyManager вместо прямого вызова
                    if (window.currencyManager) {
                        window.currencyManager.addCurrencyToUser(username, amount, reason);
                    } else {
                        this.showNotification('Менеджер валюты недоступен', 'error');
                    }
                } else {
                    this.showNotification('Заполните имя пользователя и сумму', 'error');
                }
            }
        }
        
        if (e.target.classList.contains('btn-danger') && e.target.onclick) {
            const userInput = document.getElementById('currencyTargetUser');
            const amountInput = document.getElementById('currencyAmount');
            const reasonInput = document.getElementById('currencyReason');
            
            if (userInput && amountInput) {
                const username = userInput.value.trim();
                const amount = parseInt(amountInput.value);
                const reason = reasonInput.value.trim();
                
                if (username && amount > 0) {
                    // Используем CurrencyManager вместо прямого вызова
                    if (window.currencyManager) {
                        window.currencyManager.removeCurrencyFromUser(username, amount, reason);
                    } else {
                        this.showNotification('Менеджер валюты недоступен', 'error');
                    }
                } else {
                    this.showNotification('Заполните имя пользователя и сумму', 'error');
                }
            }
        }
    });
}
async removeCurrencyFromUser(username, amount, reason = '') {
    if (!this.isAdmin) {
        this.showNotification('Недостаточно прав', 'error');
        return false;
    }

    try {
        // Если это текущий пользователь, обновляем мгновенно
        if (username === this.currentUser) {
            return await this.removeCurrency(amount, reason);
        }

        // Для других пользователей используем API
        const endpoints = [
            '/api/currency/remove',
            '/api/currency/admin/remove',
            '/api/admin/currency/remove'
        ];
        
        let success = false;
        let responseData = null;
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Trying to remove currency via: ${endpoint}`);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        targetUser: username,
                        amount: amount,
                        reason: reason,
                        admin: this.currentUser
                    })
                });

                if (response.ok) {
                    responseData = await response.json();
                    console.log('✅ Currency removed successfully:', responseData);
                    
                    const removedAmount = responseData.amount || amount;
                    const message = responseData.message || `Списано ${removedAmount} монет у пользователя ${username}`;
                    
                    this.showNotification(message, 'success');
                    success = true;
                    break;
                }
            } catch (error) {
                console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                continue;
            }
        }

        if (!success) {
            // Локальная логика для демонстрации
            const message = `[ДЕМО] Списано ${amount} монет у пользователя ${username}`;
            this.showNotification(message, 'info');
            success = true;
        }

        // Обновляем список пользователей если открыта админ-панель
        if (document.getElementById('adminPanel')?.style.display === 'flex') {
            this.loadUsersCurrencyList();
        }

        return success;
    } catch (error) {
        console.error('Error removing currency:', error);
        this.showNotification('Ошибка списания валюты', 'error');
        return false;
    }
}
    getCurrentChatUser() {
        if (this.currentChat) {
            return this.currentChat;
        }
        this.showNotification('Выберите чат для звонка', 'error');
        return null;
    }

    toggleEmojiPicker() {
        const emojiPicker = document.getElementById('emojiPicker');
        if (!emojiPicker) return;
        
        if (emojiPicker.style.display === 'block') {
            emojiPicker.style.display = 'none';
        } else {
            emojiPicker.style.display = 'block';
            const messageInput = document.getElementById('privateMessageInput');
            if (messageInput) {
                const rect = messageInput.getBoundingClientRect();
                emojiPicker.style.position = 'absolute';
                emojiPicker.style.bottom = '100%';
                emojiPicker.style.left = '0';
                emojiPicker.style.width = '300px';
                emojiPicker.style.maxHeight = '200px';
                emojiPicker.style.overflowY = 'auto';
                emojiPicker.style.background = 'white';
                emojiPicker.style.border = '1px solid #ddd';
                emojiPicker.style.borderRadius = '8px';
                emojiPicker.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                emojiPicker.style.zIndex = '1000';
            }
        }
    }

    setupFileInput() {
        this.fileInput = document.getElementById('fileInput');
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelection(Array.from(e.target.files));
                }
            });
        }
    }

    setupImageErrorHandling() {
        document.addEventListener('error', (e) => {
            if (e.target.tagName === 'IMG') {
                const img = e.target;
                if (img.src.includes('thumb-') && img.dataset.original) {
                    img.src = img.dataset.original;
                }
            }
        }, true);
    }
setupAdminPanelTabs() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('admin-tab-btn')) {
            const tabName = e.target.getAttribute('data-tab');
            this.switchAdminTab(tabName);
            
            // При переключении на вкладку валюты загружаем список пользователей
            if (tabName === 'currency' && window.currencyManager) {
                setTimeout(() => {
                    window.currencyManager.loadUsersCurrencyList();
                }, 100);
            }
        }
    });
}

    setupAdminNotificationHandler() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('send-notification-btn')) {
                this.sendSystemNotification();
            }
        });
    }

    setupGroupFeatures() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('create-group-btn')) {
                console.log('Create group button clicked');
                e.preventDefault();
                e.stopPropagation();
                
                if (!window.groupChatManager) {
                    console.log('🔄 Creating new GroupChatManager...');
                    window.groupChatManager = new GroupChatManager();
                }
                
                const existingModal = document.getElementById('createGroupModal');
                if (existingModal) {
                    console.log('Using existing modal');
                    existingModal.style.display = 'flex';
                    try {
                        window.groupChatManager.loadAvailableUsers();
                    } catch (error) {
                        console.error('Error loading available users:', error);
                    }
                } else {
                    console.log('Creating new modal');
                    window.groupChatManager.showCreateGroupModal();
                }
            }
        });
    }

    setupSocketListeners() {
        if (!window.socket) {
            console.log('⚠️ Socket not available for PrivateChat');
            return;
        }
        
        console.log('🎯 Setting up PrivateChat socket listeners...');
        
        window.socket.on('private message', (data) => {
            console.log('📨 Private message received:', data);
            this.handleIncomingMessage(data);
        });

        window.socket.on('group_message', (data) => {
            console.log('📨 Group message received in PrivateChat:', data);
            this.handleIncomingGroupMessage(data);
        });

        window.socket.on('conversations updated', () => {
            console.log('🔄 Conversations updated event received');
            this.loadConversations();
        });
         window.socket.on('gift_received', (data) => {
        console.log('🎁 Gift received:', data);
        this.handleGiftReceived(data);
    });

    // Обработчик отправки подарка
    window.socket.on('gift_sent', (data) => {
        console.log('🎁 Gift sent confirmation:', data);
        this.showNotification(`Подарок "${data.gift.name}" отправлен пользователю ${data.receiver}`, 'success');
    });
window.socket.on('gift_received', (data) => {
        console.log('🎁 Gift received:', data);
        this.showNotification(`🎁 Вы получили подарок "${data.gift.name}" от ${data.sender}`, 'success');
        
        // Обновляем профиль если открыт
        if (window.profileManager && window.profileManager.currentProfile) {
            window.profileManager.viewProfile(window.profileManager.currentProfile.username);
        }
    });
        window.socket.on('user-status-changed', (data) => {
            console.log('🔄 User status changed via socket:', data);
            
            if (data.status === 'online') {
                this.onlineUsers.add(data.username);
            } else if (data.status === 'offline') {
                this.onlineUsers.delete(data.username);
            }
            
            this.updateOnlineStatuses();
            this.loadConversations();
        });

        window.socket.on('group_created', (data) => {
            console.log('👥 Group created event:', data);
            if (window.groupChatManager) {
                window.groupChatManager.handleGroupCreated(data);
            }
            this.loadConversations();
        });

        window.socket.on('group_updated', (data) => {
            console.log('👥 Group updated event:', data);
            if (window.groupChatManager && this.currentGroup && this.currentGroup.id === data.groupId) {
                this.currentGroup = { ...this.currentGroup, ...data.groupData };
            }
            this.loadConversations();
        });

        window.socket.on('user_added_to_group', (data) => {
            console.log('👥 User added to group:', data);
            const currentUser = document.getElementById('username')?.textContent;
            if (currentUser && data.members && data.members.includes(currentUser)) {
                this.showNotification(`Вас добавили в группу "${data.groupName}"`, 'info');
                this.loadConversations();
            }
        });

        window.socket.on('user_removed_from_group', (data) => {
            console.log('👥 User removed from group:', data);
            const currentUser = document.getElementById('username')?.textContent;
            if (currentUser && data.removedUser === currentUser) {
                this.showNotification(`Вас удалили из группы "${data.groupName}"`, 'warning');
                if (window.groupChatManager?.currentGroup && window.groupChatManager.currentGroup.id === data.groupId) {
                    window.groupChatManager.closeGroupChat();
                }
                this.loadConversations();
            }
        });

        window.socket.on('system_notification', (data) => {
            console.log('📢 System notification received:', data);
            this.showNotification(data.message, data.type || 'info');
        });

        window.socket.on('error', (data) => {
            console.error('❌ Socket error:', data);
            this.showNotification(data.message || 'Произошла ошибка', 'error');
        });

        window.socket.on('connect', () => {
            console.log('✅ Socket connected for PrivateChat');
            this.showNotification('Соединение установлено', 'success');
            
            setTimeout(() => {
                this.loadConversations();
            }, 1000);
        });

        window.socket.on('disconnect', (reason) => {
            console.log('⚠️ Socket disconnected:', reason);
            this.showNotification('Соединение прервано', 'error');
        });

        window.socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
            this.showNotification('Соединение восстановлено', 'success');
            
            setTimeout(() => {
                this.loadConversations();
            }, 500);
        });

        window.socket.on('online_users', (data) => {
            console.log('👥 Online users received:', data.users);
            if (data.users && Array.isArray(data.users)) {
                this.onlineUsers = new Set(data.users);
                this.updateOnlineStatuses();
            }
        });

        window.socket.on('message_history', (data) => {
            console.log('📜 Message history received for:', data.chatId);
            if (data.messages && Array.isArray(data.messages)) {
                if (data.chatType === 'private' && this.currentChat === data.chatId) {
                    this.displayMessageHistory(data.messages);
                } else if (data.chatType === 'group' && window.groupChatManager?.currentGroup?.id === data.chatId) {
                    window.groupChatManager.displayGroupMessages(data.messages);
                }
            }
        });

        window.socket.on('message_delivered', (data) => {
            console.log('✅ Message delivered:', data.messageId);
            if (data.messageId) {
                const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
                if (messageElement) {
                    const deliveredBadge = messageElement.querySelector('.delivery-status');
                    if (!deliveredBadge) {
                        const statusElement = document.createElement('span');
                        statusElement.className = 'delivery-status';
                        statusElement.textContent = ' ✓';
                        statusElement.style.color = '#28a745';
                        statusElement.style.marginLeft = '5px';
                        messageElement.querySelector('.message-time')?.appendChild(statusElement);
                    }
                }
            }
        });

        window.socket.on('message_read', (data) => {
            console.log('👀 Message read:', data.messageId);
            if (data.messageId) {
                const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
                if (messageElement) {
                    const readBadge = messageElement.querySelector('.read-status');
                    if (!readBadge) {
                        const statusElement = document.createElement('span');
                        statusElement.className = 'read-status';
                        statusElement.textContent = ' 👁️';
                        statusElement.style.color = '#007bff';
                        statusElement.style.marginLeft = '5px';
                        messageElement.querySelector('.message-time')?.appendChild(statusElement);
                    }
                }
            }
        });

        window.socket.on('user_typing', (data) => {
            console.log('⌨️ User typing:', data);
            if (this.currentChat === data.sender) {
                this.showTypingIndicator(data.sender);
            }
        });

        window.socket.on('user_stopped_typing', (data) => {
            console.log('💤 User stopped typing:', data);
            if (this.currentChat === data.sender) {
                this.hideTypingIndicator();
            }
        });

        console.log('✅ PrivateChat socket listeners setup completed');
    }
handleGiftReceived(data) {
    const notificationMessage = `🎁 Вы получили подарок "${data.gift.name}" от ${data.sender}`;
    
    // Показываем уведомление
    this.showNotification(notificationMessage, 'success');
    
    // Если открыт профиль, обновляем его
    if (window.profileManager && window.profileManager.currentProfile) {
        window.profileManager.viewProfile(window.profileManager.currentProfile.username);
    }
    
    // Обновляем баланс если это наш подарок
    if (data.receiver === this.getCurrentUser()) {
        this.updateCurrencyDisplays();
    }
}
    handleIncomingGroupMessage(data) {
        console.log('📨 Group message received in PrivateChat:', data);
        
        if (window.groupChatManager) {
            if (window.groupChatManager.currentGroup && 
                window.groupChatManager.currentGroup.id === data.groupId) {
                console.log('✅ Immediately displaying group message in active chat');
                window.groupChatManager.forceRefreshGroupChat();
            } else {
                console.log('ℹ️ Group message for inactive group, will update on next conversation load');
            }
        }
        
        this.loadConversations();
    }

    showTypingIndicator(username) {
        const messagesContainer = document.getElementById('privateMessages');
        if (!messagesContainer) return;

        this.hideTypingIndicator();

        const typingElement = document.createElement('div');
        typingElement.id = 'typing-indicator';
        typingElement.className = 'typing-indicator';
        typingElement.innerHTML = `
            <div class="typing-content">
                <span class="typing-username">${username}</span>
                <span class="typing-text">печатает</span>
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        messagesContainer.appendChild(typingElement);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const existingIndicator = document.getElementById('typing-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
    }

    setupTypingHandlers() {
        const messageInput = document.getElementById('privateMessageInput');
        const groupMessageInput = document.getElementById('groupMessageInput');
        
        let typingTimeout;
        let isTyping = false;

        const sendTypingEvent = (isTyping, chatType, target) => {
            if (!window.socket) return;

            window.socket.emit('typing_event', {
                isTyping: isTyping,
                chatType: chatType,
                target: target,
                sender: document.getElementById('username')?.textContent
            });
        };

        const handleInput = (chatType, target) => {
            if (!isTyping) {
                isTyping = true;
                sendTypingEvent(true, chatType, target);
            }

            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                isTyping = false;
                sendTypingEvent(false, chatType, target);
            }, 1000);
        };

        if (messageInput) {
            messageInput.addEventListener('input', () => {
                if (this.currentChat) {
                    handleInput('private', this.currentChat);
                }
            });

            messageInput.addEventListener('blur', () => {
                if (isTyping) {
                    isTyping = false;
                    sendTypingEvent(false, 'private', this.currentChat);
                }
            });
        }

        if (groupMessageInput) {
            groupMessageInput.addEventListener('input', () => {
                if (window.groupChatManager?.currentGroup) {
                    handleInput('group', window.groupChatManager.currentGroup.id);
                }
            });

            groupMessageInput.addEventListener('blur', () => {
                if (isTyping) {
                    isTyping = false;
                    sendTypingEvent(false, 'group', window.groupChatManager?.currentGroup?.id);
                }
            });
        }
    }

    addTypingIndicatorStyles() {
        if (!document.getElementById('typing-indicator-styles')) {
            const styles = document.createElement('style');
            styles.id = 'typing-indicator-styles';
            styles.textContent = `
                .typing-indicator {
                    padding: 10px 15px;
                    margin: 5px 0;
                    background: #f8f9fa;
                    border-radius: 15px;
                    border: 1px solid #e9ecef;
                    max-width: 200px;
                    animation: fadeIn 0.3s ease;
                }

                .typing-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .typing-username {
                    font-weight: bold;
                    font-size: 12px;
                    color: #6c757d;
                }

                .typing-text {
                    font-size: 12px;
                    color: #6c757d;
                }

                .typing-dots {
                    display: flex;
                    gap: 3px;
                }

                .typing-dots span {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #6c757d;
                    animation: typingBounce 1.4s infinite ease-in-out;
                }

                .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
                .typing-dots span:nth-child(2) { animation-delay: -0.16s; }

                @keyframes typingBounce {
                    0%, 80%, 100% {
                        transform: scale(0.8);
                        opacity: 0.5;
                    }
                    40% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .delivery-status, .read-status {
                    font-size: 10px;
                    margin-left: 5px;
                }
            `;
            document.head.appendChild(styles);
        }
    }

    addCustomStyles() {
        if (!document.getElementById('private-chat-styles')) {
            const styles = document.createElement('style');
            styles.id = 'private-chat-styles';
            styles.textContent = `
                .voice-message-player {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 10px;
                    margin: 5px 0;
                }
                
                .play-voice-btn {
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    transition: all 0.3s ease;
                }
                
                .play-voice-btn:hover {
                    background: #0056b3;
                    transform: scale(1.1);
                }
                
                .play-voice-btn.playing {
                    background: #dc3545;
                }
                
                .voice-waveform {
                    flex: 1;
                    height: 20px;
                    background: #e9ecef;
                    border-radius: 10px;
                    overflow: hidden;
                    position: relative;
                }
                
                .voice-progress {
                    height: 100%;
                    background: linear-gradient(90deg, #007bff, #0056b3);
                    width: 0%;
                    transition: width 0.1s ease;
                    border-radius: 10px;
                }
                
                .voice-duration {
                    font-size: 12px;
                    color: #6c757d;
                    font-weight: bold;
                    min-width: 40px;
                    text-align: center;
                }
                
                .download-voice-btn {
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    padding: 5px 10px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .download-voice-btn:hover {
                    background: #218838;
                }
                
                .voice-message-info {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    margin-top: 5px;
                    font-size: 12px;
                    color: #6c757d;
                }
                
                .voice-icon {
                    font-size: 14px;
                }
            `;
            document.head.appendChild(styles);
        }
    }

    debounce(func, wait) {
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

    async searchUsers() {
        const query = document.getElementById('userSearch')?.value.trim();
        const resultsContainer = document.getElementById('searchResults');
        
        if (!resultsContainer || !query) return;
        
        if (query.length === 0) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
            return;
        }
        
        if (query.length < 2) {
            resultsContainer.innerHTML = '<div class="search-result empty">Введите минимум 2 символа</div>';
            resultsContainer.style.display = 'block';
            return;
        }
        
        resultsContainer.innerHTML = '<div class="search-result loading">Поиск...</div>';
        resultsContainer.style.display = 'block';

        try {
            const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`);
            
            if (response.ok) {
                const users = await response.json();
                this.displaySearchResults(users);
            } else {
                throw new Error('Search failed');
            }
        } catch (error) {
            resultsContainer.innerHTML = '<div class="search-result error">Ошибка поиска</div>';
        }
    }
displaySearchResults(users) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = '';
    
    if (!users || users.length === 0) {
        resultsContainer.innerHTML = '<div class="search-result empty">Никого не найдено</div>';
        return;
    }

    users.forEach(user => {
        if (!user || !user.username) return;
        
        const isOnline = user.isOnline === true;
        const statusClass = isOnline ? 'online' : 'offline';
        const statusText = isOnline ? 'online' : 'offline';
        
        const userElement = document.createElement('div');
        userElement.className = 'search-result';
        
        const avatarUrl = '/default-avatar.png';
        
        userElement.innerHTML = `
            <div class="search-user-info">
                <img src="${avatarUrl}" class="search-avatar-img" alt="${user.username}" onerror="this.src='/default-avatar.png'">
                <div class="search-user-details">
                    <span class="search-username">${user.username}</span>
                    <span class="search-user-status ${statusClass}">${statusText}</span>
                </div>
            </div>
            <button type="button" class="start-chat-btn">Написать</button>
        `;

        const chatButton = userElement.querySelector('.start-chat-btn');
        
        userElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('start-chat-btn')) {
                this.startChat(user.username);
                resultsContainer.style.display = 'none';
            }
        });

        chatButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startChat(user.username);
            resultsContainer.style.display = 'none';
        });

        resultsContainer.appendChild(userElement);
    });
    
    resultsContainer.style.display = 'block';
}
    async startChat(username, isGroup = false, groupId = null) {
        console.log('💬 Starting chat:', { username, isGroup, groupId });
        
        if (isGroup) {
            const group = {
                id: groupId,
                name: username
            };
            
            if (window.groupChatManager) {
                await window.groupChatManager.openGroupChat(group);
            } else {
                console.error('❌ GroupChatManager not available');
                this.showNotification('Ошибка открытия группового чата', 'error');
            }
        } else {
            console.log('👤 Opening private chat with:', username);
            
            if (window.groupChatManager?.currentGroup) {
                window.groupChatManager.closeGroupChat();
            }
            
            this.currentChat = username;
            
            const searchResults = document.getElementById('searchResults');
            const userSearch = document.getElementById('userSearch');
            const noChatSelected = document.getElementById('noChatSelected');
            const activeChat = document.getElementById('activeChat');
            const groupChatContainer = document.getElementById('groupChatContainer');
            
            if (noChatSelected) noChatSelected.style.display = 'none';
            if (activeChat) activeChat.style.display = 'flex';
            if (groupChatContainer) groupChatContainer.style.display = 'none';
            if (searchResults) {
                searchResults.innerHTML = '';
                searchResults.style.display = 'none';
            }
            if (userSearch) userSearch.value = '';
            
            const currentChatUser = document.getElementById('currentChatUser');
            const currentUserStatus = document.getElementById('currentUserStatus');
            
            if (currentChatUser) currentChatUser.textContent = username;
            if (currentUserStatus) {
                const isOnline = this.onlineUsers.has(username);
                currentUserStatus.textContent = isOnline ? 'online' : 'offline';
                currentUserStatus.className = `user-status ${isOnline ? 'online' : 'offline'}`;
            }
            
            console.log('🖼️ Loading avatar for user:', username);
            this.loadUserAvatar(username).then(avatarUrl => {
                console.log('✅ Avatar URL loaded:', avatarUrl);
                const userAvatar = document.querySelector('.chat-user-info .user-avatar');
                if (userAvatar) {
                    userAvatar.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = avatarUrl;
                    img.className = 'user-avatar-img';
                    img.alt = username;
                    img.onerror = () => this.handleAvatarError(img);
                    userAvatar.appendChild(img);
                    console.log('✅ Avatar set in chat header');
                } else {
                    console.error('❌ User avatar element not found in chat header');
                }
            }).catch((error) => {
                console.error('❌ Error loading avatar:', error);
                const userAvatar = document.querySelector('.chat-user-info .user-avatar');
                if (userAvatar) {
                    userAvatar.innerHTML = `<img src="/default-avatar.png" class="user-avatar-img" alt="${username}">`;
                    console.log('✅ Default avatar set due to error');
                }
            });
            
            try {
                console.log('📨 Loading messages for user:', username);
                const response = await fetch(`/api/messages/private/${username}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const messages = await response.json();
                console.log('✅ Messages loaded:', messages.length);
                this.displayMessageHistory(messages);
            } catch (error) {
                console.error('❌ Error loading messages:', error);
                this.showNotification('Ошибка загрузки сообщений', 'error');
                
                const container = document.getElementById('privateMessages');
                if (container) {
                    container.innerHTML = '<div class="no-messages">📝 Начните общение первым!</div>';
                }
            }
            
            setTimeout(() => {
                const messageInput = document.getElementById('privateMessageInput');
                if (messageInput) {
                    messageInput.focus();
                }
            }, 100);
        }
        
        this.loadConversations();
        
        console.log('✅ Chat started successfully');
    }

    async loadConversations() {
        try {
            console.log('🔄 Loading conversations...');
            
            let privateConversations = [];
            try {
                const response = await fetch('/api/conversations');
                if (response.ok) {
                    privateConversations = await response.json();
                    console.log('✅ Private conversations loaded:', privateConversations.length);
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.log('⚠️ Using local conversations:', error.message);
                privateConversations = this.getLocalConversations();
            }
            
            let groupConversations = [];
            if (window.groupChatManager) {
                groupConversations = await window.groupChatManager.loadUserGroups();
                console.log('✅ Group conversations loaded:', groupConversations.length);
            }
            
            this.conversations = [...privateConversations, ...groupConversations].sort((a, b) => {
                const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp) : new Date(0);
                const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp) : new Date(0);
                return timeB - timeA;
            });
            
            console.log(`✅ Total conversations: ${this.conversations.length}`);
            this.displayConversations();
            
        } catch (error) {
            console.error('❌ Error loading conversations:', error);
            this.conversations = [];
            this.displayConversations();
        }
    }
async displayConversations() {
        const container = document.getElementById('conversationsList');
        if (!container) return;
        
        container.innerHTML = '<div class="conversation-item empty">Загрузка...</div>';

        try {
            // Загружаем аватары с обработкой ошибок
            const conversationsWithAvatars = await Promise.all(
                this.conversations.map(async (conversation) => {
                    try {
                        if (!conversation.isGroup) {
                            conversation.avatarUrl = await this.loadUserAvatarSafe(conversation.username);
                        }
                        return conversation;
                    } catch (error) {
                        console.error(`Error loading avatar for ${conversation.username}:`, error);
                        conversation.avatarUrl = this.getDefaultAvatarUrl();
                        return conversation;
                    }
                })
            );

            // Используем существующий метод для отображения
            this.renderConversationsList(conversationsWithAvatars, container);
            
        } catch (error) {
            console.error('Error displaying conversations:', error);
            // Используем запасной метод
            this.displayConversationsWithDefaultAvatars();
        }
    }
   renderConversationsList(conversations, container) {
    if (!container) return;
    
    container.innerHTML = '';

    if (conversations.length === 0) {
        container.innerHTML = '<div class="conversation-item empty">Нет диалогов</div>';
        return;
    }

    conversations.forEach(conversation => {
        const convElement = document.createElement('div');
        const isGroup = conversation.isGroup;
        
        let isActive = false;
        if (isGroup) {
            isActive = window.groupChatManager?.currentGroup && 
                      window.groupChatManager.currentGroup.id === conversation.id;
        } else {
            isActive = conversation.username === this.currentChat;
        }
        
        convElement.className = `conversation-item ${isActive ? 'active' : ''} ${isGroup ? 'group-item' : ''}`;
        
        const lastMsg = conversation.lastMessage;
        let preview = 'Нет сообщений';
        
        if (lastMsg) {
            preview = lastMsg.isOwn ? `Вы: ${lastMsg.text}` : 
                     isGroup ? `${lastMsg.sender}: ${lastMsg.text}` : lastMsg.text;
            if (preview.length > 30) preview = preview.substring(0, 30) + '...';
        }

        const isOnline = !isGroup && this.onlineUsers.has(conversation.username);
        const onlineIndicator = isOnline ? '<span class="online-dot"></span>' : '';
        
        if (!isGroup) {
            // Для приватных чатов
            const avatarUrl = conversation.avatarUrl || this.getDefaultAvatarUrl();
            convElement.innerHTML = `
                <div class="conv-info">
                    <div class="conv-header">
                        <span class="conv-name">
                            <img src="${avatarUrl}" class="conversation-avatar" alt="${conversation.username}" 
                                 onerror="this.src='${this.getDefaultAvatarUrl()}'">
                            ${conversation.username} ${onlineIndicator}
                        </span>
                        ${lastMsg ? `<span class="conv-time">${lastMsg.timestamp}</span>` : ''}
                    </div>
                    <div class="conv-preview">${preview}</div>
                </div>
            `;
        } else {
            // Для групповых чатов
            const memberInfo = `<div class="conv-members">${conversation.memberCount || conversation.members?.length || 0} участников</div>`;
            
            convElement.innerHTML = `
                <div class="conv-info">
                    <div class="conv-header">
                        <span class="conv-name">
                            <div class="group-avatar">👥</div>
                            ${conversation.name}
                        </span>
                        ${lastMsg ? `<span class="conv-time">${lastMsg.timestamp}</span>` : ''}
                    </div>
                    <div class="conv-preview">${preview}</div>
                    ${memberInfo}
                </div>
            `;
        }

        convElement.addEventListener('click', () => {
            if (isGroup) {
                this.startChat(conversation.name, true, conversation.id);
            } else {
                this.startChat(conversation.username);
            }
        });
        
        container.appendChild(convElement);
    });
}
displayConversationsWithDefaultAvatars() {
    const container = document.getElementById('conversationsList');
    if (!container) {
        console.error('❌ Conversations list container not found');
        return;
    }
    
    container.innerHTML = '';

    if (this.conversations.length === 0) {
        container.innerHTML = '<div class="conversation-item empty">📝 Нет диалогов</div>';
        return;
    }

    console.log(`🔄 Displaying ${this.conversations.length} conversations with default avatars`);

    this.conversations.forEach(conversation => {
        if (!conversation) return;
        
        const convElement = document.createElement('div');
        const isGroup = conversation.isGroup;
        const currentUser = document.getElementById('username')?.textContent;
        
        // Определяем активен ли чат
        let isActive = false;
        if (isGroup) {
            isActive = window.groupChatManager?.currentGroup && 
                      window.groupChatManager.currentGroup.id === conversation.id;
        } else {
            isActive = conversation.username === this.currentChat;
        }
        
        convElement.className = `conversation-item ${isActive ? 'active' : ''} ${isGroup ? 'group-item' : ''}`;
        
        // Обрабатываем последнее сообщение
        const lastMsg = conversation.lastMessage;
        let preview = '📝 Нет сообщений';
        let timestamp = '';
        
        if (lastMsg) {
            // Форматируем текст предпросмотра
            let messageText = lastMsg.text || '📄 Вложение';
            if (lastMsg.type === 'voice') {
                messageText = '🎤 Голосовое сообщение';
            } else if (lastMsg.type === 'file') {
                messageText = '📎 Файл';
            } else if (lastMsg.type === 'image') {
                messageText = '🖼️ Изображение';
            }
            
            preview = lastMsg.isOwn ? `Вы: ${messageText}` : 
                     isGroup ? `${lastMsg.sender}: ${messageText}` : messageText;
            
            // Обрезаем длинный текст
            if (preview.length > 35) {
                preview = preview.substring(0, 35) + '...';
            }
            
            // Форматируем время
            timestamp = lastMsg.timestamp || this.formatMessageTime(lastMsg.date);
        }

        // Статус онлайн для приватных чатов
        const isOnline = !isGroup && this.onlineUsers.has(conversation.username);
        const onlineIndicator = isOnline ? '<span class="online-dot" title="В сети"></span>' : '';
        
        if (!isGroup) {
            // Приватный чат
            const avatarUrl = this.getDefaultAvatarUrl();
            const displayName = conversation.username || 'Неизвестный';
            
            convElement.innerHTML = `
                <div class="conv-info">
                    <div class="conv-header">
                        <div class="conv-name-wrapper">
                            <span class="conv-name">
                                <img src="${avatarUrl}" class="conversation-avatar" alt="${displayName}" 
                                     onerror="this.src='${this.getDefaultAvatarUrl()}'">
                                <span class="username-text">${displayName}</span>
                                ${onlineIndicator}
                            </span>
                            ${timestamp ? `<span class="conv-time">${timestamp}</span>` : ''}
                        </div>
                    </div>
                    <div class="conv-preview">${preview}</div>
                    ${isOnline ? '<div class="conv-status online">🟢 онлайн</div>' : '<div class="conv-status offline">⚫ не в сети</div>'}
                </div>
            `;
        } else {
            // Групповой чат
            const memberCount = conversation.memberCount || conversation.members?.length || 0;
            const displayName = conversation.name || conversation.username || 'Без названия';
            const createdBy = conversation.createdBy ? `Создал: ${conversation.createdBy}` : '';
            
            convElement.innerHTML = `
                <div class="conv-info">
                    <div class="conv-header">
                        <div class="conv-name-wrapper">
                            <span class="conv-name">
                                <div class="group-avatar">👥</div>
                                <span class="group-name-text">${displayName}</span>
                            </span>
                            ${timestamp ? `<span class="conv-time">${timestamp}</span>` : ''}
                        </div>
                    </div>
                    <div class="conv-preview">${preview}</div>
                    <div class="conv-meta">
                        <span class="conv-members">👤 ${memberCount} участников</span>
                        ${createdBy ? `<span class="conv-creator">${createdBy}</span>` : ''}
                    </div>
                </div>
            `;
        }

        // Обработчик клика
        convElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log(`💬 Opening chat:`, {
                isGroup: isGroup,
                name: conversation.name || conversation.username,
                id: conversation.id
            });
            
            if (isGroup) {
                this.startChat(conversation.name || conversation.username, true, conversation.id);
            } else {
                this.startChat(conversation.username);
            }
        });

        // Эффекты при наведении
        convElement.addEventListener('mouseenter', () => {
            if (!isActive) {
                convElement.style.backgroundColor = '#f8f9fa';
            }
        });

        convElement.addEventListener('mouseleave', () => {
            if (!isActive) {
                convElement.style.backgroundColor = '';
            }
        });

        container.appendChild(convElement);
    });

    console.log('✅ Conversations displayed with default avatars');
}

// Вспомогательный метод для форматирования времени (если его нет)
formatMessageTime(timestamp) {
    if (!timestamp) return 'только что';
    
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'только что';
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин назад`;
        if (diffHours < 24) return `${diffHours} ч назад`;
        if (diffDays < 7) return `${diffDays} дн назад`;
        
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
        
    } catch (error) {
        console.error('Error formatting time:', error);
        return 'только что';
    }
}
    displayMessage(message, shouldScroll = true) {
        const container = document.getElementById('privateMessages');
        if (!container) return;
        
        const noMessagesElement = container.querySelector('.no-messages');
        if (noMessagesElement) noMessagesElement.remove();
        
        const currentUsername = document.getElementById('username')?.textContent;
        const isOwn = message.sender === currentUsername;
        
        if (message.messageType === 'voice') {
            this.displayVoiceMessage(message, isOwn);
        } else if (message.messageType === 'file') {
            this.displayFileMessage(message, isOwn);
        } else {
            const messageElement = document.createElement('div');
            messageElement.className = `private-message ${isOwn ? 'own' : 'other'}`;
            
            messageElement.innerHTML = `
                <div class="message-content">
                    <div class="message-header">
                        <strong>${isOwn ? 'Вы' : message.sender}</strong>
                        <span class="message-time">${message.timestamp}</span>
                    </div>
                    <div class="message-text">${this.parseEmojis(message.message)}</div>
                </div>
            `;
            
            container.appendChild(messageElement);
        }
        
        if (shouldScroll) this.scrollToBottom();
    }

    displayVoiceMessage(message, isOwn = false) {
        const container = document.getElementById('privateMessages');
        if (!container) return;

        const messageElement = document.createElement('div');
        messageElement.className = `private-message ${isOwn ? 'own' : 'other'}`;
        messageElement.setAttribute('data-message-id', message.id);
        
        const duration = message.fileData?.duration || 0;
        const durationSeconds = Math.floor(duration / 1000);
        const durationFormatted = `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, '0')}`;

        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <strong>${isOwn ? 'Вы' : message.sender}</strong>
                    <span class="message-time">${message.timestamp}</span>
                </div>
                
                <div class="voice-message-player">
                    <button class="play-voice-btn" data-audio-url="${message.fileData.path}">
                        ▶️
                    </button>
                    
                    <div class="voice-waveform">
                        <div class="voice-progress"></div>
                    </div>
                    
                    <div class="voice-duration">${durationFormatted}</div>
                    
                    <button class="download-voice-btn" onclick="window.open('${message.fileData.path}', '_blank')" title="Скачать">
                        📥
                    </button>
                </div>
                
                <div class="voice-message-info">
                    <span class="voice-icon">🎤</span>
                    <span>Голосовое сообщение</span>
                </div>
            </div>
        `;

        const playBtn = messageElement.querySelector('.play-voice-btn');
        playBtn.addEventListener('click', (e) => {
            this.playVoiceMessage(e.target, message.fileData.path, duration);
        });

        container.appendChild(messageElement);
    }

    playVoiceMessage(button, audioUrl, duration) {
        if (button.classList.contains('playing')) {
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio = null;
            }
            button.classList.remove('playing');
            button.innerHTML = '▶️';
            return;
        }

        if (this.currentAudio) {
            this.currentAudio.pause();
        }

        this.currentAudio = new Audio(audioUrl);
        
        const player = button.closest('.voice-message-player');
        const progressBar = player?.querySelector('.voice-progress');
        const durationDisplay = player?.querySelector('.voice-duration');

        this.currentAudio.addEventListener('loadedmetadata', () => {
            button.classList.add('playing');
            button.innerHTML = '⏸️';
        });

        this.currentAudio.addEventListener('timeupdate', () => {
            if (progressBar && this.currentAudio) {
                const progress = (this.currentAudio.currentTime / this.currentAudio.duration) * 100;
                progressBar.style.width = `${progress}%`;
                
                if (durationDisplay) {
                    const currentTime = Math.floor(this.currentAudio.currentTime);
                    const totalTime = Math.floor(this.currentAudio.duration);
                    durationDisplay.textContent = 
                        `${Math.floor(currentTime / 60)}:${(currentTime % 60).toString().padStart(2, '0')}`;
                }
            }
        });

        this.currentAudio.addEventListener('ended', () => {
            button.classList.remove('playing');
            button.innerHTML = '▶️';
            if (progressBar) {
                progressBar.style.width = '0%';
            }
            if (durationDisplay && duration) {
                const durationSeconds = Math.floor(duration / 1000);
                durationDisplay.textContent = 
                    `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, '0')}`;
            }
        });

        this.currentAudio.play();
    }

    displayFileMessage(message, isOwn) {
        const container = document.getElementById('privateMessages');
        if (!container) return;

        const file = message.fileData;
        if (!file) return;
        
        const fileSize = this.formatFileSize(file.size);
        const fileTypeText = this.getFileTypeText(file.mimetype, file.originalName);

        let fileContent = '';
        let fileIcon = '📁';
        
        if (file.mimetype.startsWith('image/')) {
            fileIcon = '🖼️';
            fileContent = `
                <img src="${file.thumbnail || file.path}" 
                     class="file-preview" 
                     style="max-width: 200px; max-height: 200px; border-radius: 8px; cursor: pointer;"
                     onclick="window.privateChatInstance.viewImage('${file.path}')"
                     alt="${fileTypeText}"
                     data-original="${file.path}"
                     onerror="this.src='${file.path}'">
            `;
        } else if (file.mimetype.startsWith('audio/')) {
            fileIcon = '🎵';
            fileContent = `
                <audio controls style="width: 100%; max-width: 300px;">
                    <source src="${file.path}" type="${file.mimetype}">
                </audio>
            `;
        } else if (file.mimetype.startsWith('video/')) {
            fileIcon = '🎬';
            fileContent = `
                <video controls style="max-width: 300px; max-height: 200px; border-radius: 8px;">
                    <source src="${file.path}" type="${file.mimetype}">
                </video>
            `;
        }

        const messageElement = document.createElement('div');
        messageElement.className = `private-message ${isOwn ? 'own' : 'other'}`;
        
        messageElement.innerHTML = `
            <div class="message-content file-message">
                <div class="message-header">
                    <strong>${isOwn ? 'Вы' : message.sender}</strong>
                    <span class="message-time">${message.timestamp}</span>
                </div>
                
                ${fileContent}
                
                <div class="file-info">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-details">
                        <div class="file-type">${fileTypeText}</div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                    <button class="file-download" onclick="window.open('${file.path}', '_blank')" title="Скачать файл">
                        📥
                    </button>
                </div>
            </div>
        `;

        container.appendChild(messageElement);
    }

    parseEmojis(text) {
        if (!text) return '';
        
        const emojiMap = {
            ':)': '😊',
            ':-)': '😊',
            ':(': '😞',
            ':-(': '😞',
            ':D': '😃',
            ':-D': '😃',
            ':P': '😛',
            ':-P': '😛',
            ';)': '😉',
            ';-)': '😉',
            ':O': '😮',
            ':-O': '😮',
            ':*': '😘',
            ':-*': '😘',
            '<3': '❤️',
            '</3': '💔'
        };
        
        let parsedText = text;
        
        Object.keys(emojiMap).forEach(key => {
            const regex = new RegExp(this.escapeRegExp(key), 'g');
            parsedText = parsedText.replace(regex, emojiMap[key]);
        });
        
        return parsedText;
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    async sendPrivateMessage() {
        const input = document.getElementById('privateMessageInput');
        const currentUsername = document.getElementById('username')?.textContent;
        
        if (!input || !currentUsername || !this.currentChat) return;
        
        const message = input.value.trim();
        const files = this.fileInput?.files;
        
        if (!message && (!files || files.length === 0)) return;
        
        try {
            if (files && files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    await this.handleFileUpload(files[i]);
                }
                const filePreview = document.getElementById('filePreview');
                if (filePreview) {
                    filePreview.innerHTML = '';
                    filePreview.style.display = 'none';
                }
                this.fileInput.value = '';
            }
            
            if (message) {
                if (window.socket) {
                    window.socket.emit('private message', {
                        sender: currentUsername,
                        receiver: this.currentChat,
                        message: message,
                        messageType: 'text'
                    });
                }
                input.value = '';
            }
            
            input.focus();
            
        } catch (error) {
            this.showNotification('Ошибка отправки сообщения', 'error');
        }
    }

    async handleFileUpload(file) {
        if (!this.currentChat) {
            this.showNotification('Выберите собеседника для отправки файла', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            
            if (result.success) {
                this.sendFileMessage(result.file);
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            this.showNotification('Ошибка загрузки файла: ' + error.message, 'error');
        }
    }

    sendFileMessage(fileData) {
        const currentUsername = document.getElementById('username')?.textContent;
        
        if (window.socket && this.currentChat) {
            const fileType = this.getFileTypeText(fileData.mimetype, fileData.originalName);
            
            window.socket.emit('private message', {
                sender: currentUsername,
                receiver: this.currentChat,
                message: fileType,
                messageType: 'file',
                fileData: fileData
            });
        }
    }

    handleFileSelection(files) {
        const filePreview = document.getElementById('filePreview');
        if (!filePreview) return;
        
        filePreview.innerHTML = '';
        
        files.forEach(file => {
            if (file.size > 100 * 1024 * 1024) {
                this.showNotification(`Файл "${file.name}" слишком большой (макс. 100MB)`, 'error');
                return;
            }
            
            const fileElement = document.createElement('div');
            fileElement.className = 'file-preview-item';
            
            const fileType = this.getFileTypeText(file.type, file.name);
            let fileIcon = '📁';
            
            if (file.type.startsWith('image/')) fileIcon = '🖼️';
            else if (file.type.startsWith('audio/')) fileIcon = '🎵';
            else if (file.type.startsWith('video/')) fileIcon = '🎬';
            else if (file.type.includes('pdf')) fileIcon = '📄';
            
            fileElement.innerHTML = `
                <div class="file-preview-icon">${fileIcon}</div>
                <div class="file-preview-content">
                    <div class="file-preview-name">${file.name}</div>
                    <div class="file-preview-type">${fileType}</div>
                    <div class="file-preview-size">${this.formatFileSize(file.size)}</div>
                </div>
                <button class="file-preview-remove" data-filename="${file.name}">✕</button>
            `;
            
            filePreview.appendChild(fileElement);
        });
        
        filePreview.querySelectorAll('.file-preview-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filename = e.target.getAttribute('data-filename');
                this.removeFilePreview(filename);
            });
        });
        
        filePreview.style.display = 'block';
    }

    removeFilePreview(filename) {
        const filePreview = document.getElementById('filePreview');
        if (!filePreview) return;
        
        const fileElement = filePreview.querySelector(`[data-filename="${filename}"]`)?.closest('.file-preview-item');
        if (fileElement) {
            fileElement.remove();
        }
        
        if (filePreview.children.length === 0) {
            filePreview.style.display = 'none';
        }
        
        if (this.fileInput) {
            this.fileInput.value = '';
        }
    }

    getFileTypeText(mimeType, filename) {
        const extension = filename.split('.').pop().toLowerCase();
        
        if (mimeType.startsWith('image/')) return 'Картинка';
        else if (mimeType.startsWith('audio/')) return 'Аудио';
        else if (mimeType.startsWith('video/')) return 'Видео';
        else if (mimeType.includes('pdf')) return 'PDF документ';
        else if (mimeType.includes('word') || mimeType.includes('document') || 
                 ['.doc', '.docx'].includes('.' + extension)) return 'Word документ';
        else if (mimeType.includes('excel') || mimeType.includes('spreadsheet') ||
                 ['.xls', '.xlsx'].includes('.' + extension)) return 'Excel таблица';
        else if (mimeType.includes('powerpoint') || mimeType.includes('presentation') ||
                 ['.ppt', '.pptx'].includes('.' + extension)) return 'PowerPoint презентация';
        else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive') ||
                 ['.zip', '.rar', '.7z', '.tar', '.gz'].includes('.' + extension)) return 'Архив';
        else if (mimeType.includes('text') || ['.txt', '.csv'].includes('.' + extension)) return 'Текстовый файл';
        else if (mimeType.includes('json') || ['.json'].includes('.' + extension)) return 'JSON файл';
        else if (mimeType.includes('xml') || ['.xml'].includes('.' + extension)) return 'XML файл';
        else return 'Документ';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    viewImage(imageUrl) {
        const modal = document.getElementById('imageViewerModal');
        if (modal) {
            const img = modal.querySelector('img');
            img.src = imageUrl;
            modal.style.display = 'flex';
        }
    }

    scrollToBottom() {
        const privateMessages = document.getElementById('privateMessages');
        if (privateMessages) {
            setTimeout(() => {
                privateMessages.scrollTop = privateMessages.scrollHeight;
            }, 100);
        }
    }

    closeCurrentChat() {
        this.currentChat = null;
        
        const noChatSelected = document.getElementById('noChatSelected');
        const activeChat = document.getElementById('activeChat');
        const groupChatContainer = document.getElementById('groupChatContainer');
        
        if (noChatSelected && !groupChatContainer?.style.display !== 'flex') {
            noChatSelected.style.display = 'flex';
        }
        if (activeChat) activeChat.style.display = 'none';
        
        const privateMessages = document.getElementById('privateMessages');
        if (privateMessages) privateMessages.innerHTML = '<div class="no-messages">📝 Начните общение первым!</div>';
        
        const messageInput = document.getElementById('privateMessageInput');
        if (messageInput) messageInput.value = '';
        
        const filePreview = document.getElementById('filePreview');
        if (filePreview) {
            filePreview.innerHTML = '';
            filePreview.style.display = 'none';
        }
        
        this.loadConversations();
    }

    updateOnlineStatuses() {
        console.log('🔄 Updating online statuses...');
        
        if (this.currentChat) {
            const currentUserStatus = document.getElementById('currentUserStatus');
            if (currentUserStatus) {
                const isOnline = this.onlineUsers.has(this.currentChat);
                currentUserStatus.textContent = isOnline ? 'online' : 'offline';
                currentUserStatus.className = `user-status ${isOnline ? 'online' : 'offline'}`;
            }
        }
        
        const conversationItems = document.querySelectorAll('.conversation-item:not(.group-item)');
        conversationItems.forEach(item => {
            const usernameElement = item.querySelector('.conv-name');
            if (usernameElement) {
                const text = usernameElement.textContent.trim();
                const username = text.replace(/^👤\s*/, '').split(' ')[0];
                
                if (username) {
                    const isOnline = this.onlineUsers.has(username);
                    const onlineDot = isOnline ? '<span class="online-dot"></span>' : '';
                    
                    const currentContent = usernameElement.innerHTML;
                    const baseContent = currentContent.replace(/<span class="online-dot"><\/span>/g, '');
                    usernameElement.innerHTML = baseContent + onlineDot;
                }
            }
        });
        
        const searchResults = document.querySelectorAll('.search-result');
        searchResults.forEach(result => {
            const usernameElement = result.querySelector('.search-username');
            if (usernameElement) {
                const username = usernameElement.textContent.trim();
                const statusElement = result.querySelector('.search-user-status');
                if (statusElement && username) {
                    const isOnline = this.onlineUsers.has(username);
                    statusElement.textContent = isOnline ? 'online' : 'offline';
                    statusElement.className = `search-user-status ${isOnline ? 'online' : 'offline'}`;
                }
            }
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 10010;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

toggleAdminPanel() {
    try {
        // Проверяем права администратора
        if (!this.isAdmin) {
            this.showNotification('Недостаточно прав для доступа к панели администратора', 'error');
            return;
        }

        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            const isVisible = adminPanel.style.display === 'flex';
            adminPanel.style.display = isVisible ? 'none' : 'flex';
            
            if (!isVisible) {
                this.loadOnlineUsers();
                this.switchAdminTab('system');
            }
        } else {
            console.error('❌ Admin panel not found');
            this.showNotification('Панель администратора не найдена', 'error');
        }
    } catch (error) {
        console.error('❌ Error toggling admin panel:', error);
        this.showNotification('Ошибка открытия панели администратора', 'error');
    }
}
    switchAdminTab(tabName) {
        const adminPanel = document.getElementById('adminPanel');
        if (!adminPanel) return;
        
        const tabBtns = adminPanel.querySelectorAll('.admin-tab-btn');
        const tabPanes = adminPanel.querySelectorAll('.admin-tab-pane');
        
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            }
        });
        
        tabPanes.forEach(pane => {
            pane.style.display = 'none';
            if (pane.id === `tab-${tabName}`) {
                pane.style.display = 'block';
            }
        });
    }

async loadOnlineUsers() {
    try {
        console.log('🔄 Loading online users...');
        
        // Проверяем права администратора
        if (!this.isAdmin) {
            console.log('⚠️ User is not admin, skipping online users load');
            return;
        }

        const response = await fetch('/api/users/online');
        
        if (response.status === 404) {
            console.log('⚠️ Online users endpoint not found, using fallback');
            this.showFallbackOnlineUsers();
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const users = await response.json();
        this.displayOnlineUsers(users);
        
    } catch (error) {
        console.error('❌ Error loading online users:', error);
        this.showFallbackOnlineUsers();
    }
}   
showFallbackOnlineUsers() {
    const onlineUsersList = document.getElementById('onlineUsersList');
    if (onlineUsersList) {
        onlineUsersList.innerHTML = `
            <div class="empty">
                <p>Функция онлайн пользователей временно недоступна</p>
                <p style="font-size: 12px; color: #6c757d; margin-top: 5px;">
                    Используйте поиск пользователей для начала общения
                </p>
            </div>
        `;
    }
}

displayOnlineUsers(users) {
    const onlineUsersList = document.getElementById('onlineUsersList');
    if (!onlineUsersList) return;
    
    onlineUsersList.innerHTML = '';
    
    if (users.length === 0) {
        onlineUsersList.innerHTML = '<div class="empty">Нет активных пользователей</div>';
        return;
    }
    
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        userElement.innerHTML = `
            <div class="user-info">
                <span class="user-avatar">👤</span>
                <span class="user-name">${user.username}</span>
                <span class="user-status online">🟢 online</span>
            </div>
        `;
        onlineUsersList.appendChild(userElement);
    });
}

    async sendSystemNotification() {
        console.log('Sending system notification...');
        
        const messageInput = document.getElementById('notificationMessage');
        const titleInput = document.getElementById('notificationTitle');
        const typeSelect = document.getElementById('notificationType');
        const targetSelect = document.getElementById('notificationTarget');
        const targetUserInput = document.getElementById('targetUser');
        
        if (!messageInput || !titleInput || !typeSelect || !targetSelect) {
            this.showNotification('Ошибка: элементы формы не найдены', 'error');
            return;
        }
        
        const title = titleInput.value.trim();
        const message = messageInput.value.trim();
        const messageType = typeSelect.value;
        const target = targetSelect.value;
        const targetUser = targetUserInput ? targetUserInput.value.trim() : '';
        const currentUser = document.getElementById('username')?.textContent || 'admin';
        
        console.log('Form data:', { title, message, messageType, target, targetUser });

        if (!title || !message) {
            this.showNotification('Заполните заголовок и сообщение', 'error');
            return;
        }

        if (target === 'user' && !targetUser) {
            this.showNotification('Введите имя пользователя', 'error');
            return;
        }

        try {
            console.log('Sending request to server...');
            
            const requestBody = {
                title: title,
                message: message,
                type: target,
                targetUser: targetUser,
                messageType: messageType,
                sender: currentUser
            };
            
            console.log('Request body:', requestBody);

            const response = await fetch('/api/admin/send-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Response status:', response.status);
            
            const result = await response.json();
            console.log('Response data:', result);

            if (response.ok) {
                this.showNotification('Уведомление отправлено', 'success');
                
                titleInput.value = '';
                messageInput.value = '';
                if (targetUserInput) {
                    targetUserInput.value = '';
                }
                
                const adminPanel = document.getElementById('adminPanel');
                if (adminPanel) {
                    adminPanel.style.display = 'none';
                }
            } else {
                throw new Error(result.error || `Ошибка ${response.status}`);
            }
        } catch (error) {
            console.error('Notification error:', error);
            this.showNotification('Ошибка отправки уведомления: ' + error.message, 'error');
        }
    }

    getLocalConversations() {
        try {
            const localConversations = JSON.parse(localStorage.getItem('privateConversations') || '[]');
            console.log('📂 Local conversations from storage:', localConversations.length);
            return localConversations;
        } catch (error) {
            console.error('Error reading local conversations:', error);
            return [];
        }
    }

    saveLocalConversations(conversations) {
        try {
            localStorage.setItem('privateConversations', JSON.stringify(conversations));
            console.log('💾 Conversations saved locally:', conversations.length);
        } catch (error) {
            console.error('Error saving local conversations:', error);
        }
    }

    getLocalGroups() {
        try {
            const localGroups = JSON.parse(localStorage.getItem('localGroups') || '[]');
            console.log('📂 Local groups from storage:', localGroups.length);
            return localGroups;
        } catch (error) {
            console.error('Error reading local groups:', error);
            return [];
        }
    }

    getLocalGroupMessages(groupId) {
        try {
            const localMessages = JSON.parse(localStorage.getItem('groupMessages') || '{}');
            return localMessages[groupId] || [];
        } catch (error) {
            console.error('Error reading local group messages:', error);
            return [];
        }
    }

    forceRefreshGroupChat() {
        if (this.currentGroup) {
            console.log('🔄 Force refreshing group chat...');
            this.loadGroupMessages(this.currentGroup.id);
        }
    }
openUserProfile(username) {
    if (!username || username === this.currentUser) return;
    
    console.log('👤 Opening profile for:', username);
    
    // Закрываем существующее модальное окно если есть
    const existingModal = document.getElementById('userProfileModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Создаем модальное окно профиля
    const modal = document.createElement('div');
    modal.id = 'userProfileModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    modal.innerHTML = `
        <div class="modal-content" style="
            background: white;
            padding: 25px;
            border-radius: 15px;
            width: 400px;
            max-width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                <h3 style="margin: 0;">👤 Профиль пользователя</h3>
                <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
            </div>
            
            <div class="profile-content">
                <div class="profile-header" style="text-align: center; margin-bottom: 20px;">
                    <div class="profile-avatar" style="width: 100px; height: 100px; border-radius: 50%; overflow: hidden; margin: 0 auto 15px; border: 3px solid #007bff;">
                        <img id="profileAvatarImg" src="${this.getDefaultAvatarUrl()}" alt="${username}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <h4 id="profileUsername" style="margin: 0 0 5px 0; color: #333;">${username}</h4>
                    <div class="user-status" id="profileUserStatus" style="color: #6c757d;">Загрузка...</div>
                </div>
                
                <div class="profile-actions" style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <button class="btn-primary" onclick="window.privateChatInstance.startChat('${username}')" style="flex: 1; padding: 10px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        💬 Написать сообщение
                    </button>
                    <button class="btn-secondary" onclick="window.privateChatInstance.openGiftForUser('${username}')" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        🎁 Отправить подарок
                    </button>
                </div>
                
                <div class="profile-info">
                    <div class="info-section" style="margin-bottom: 15px;">
                        <h5 style="margin-bottom: 10px; color: #495057;">📊 Статистика</h5>
                        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div class="stat-item" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 12px; color: #6c757d;">В сети</div>
                                <div id="profileOnlineStatus" style="font-weight: bold; color: #28a745;">Проверка...</div>
                            </div>
                            <div class="stat-item" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 12px; color: #6c757d;">Баланс</div>
                                <div id="profileBalance" style="font-weight: bold;">🪙 ...</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Добавляем секцию био -->
                    <div class="bio-section" style="margin-bottom: 15px; display: none;" id="profileBioSection">
                        <h5 style="margin-bottom: 10px; color: #495057;">📝 О себе</h5>
                        <div id="profileBio" style="color: #333; line-height: 1.4; font-size: 14px; padding: 10px; background: #f8f9fa; border-radius: 5px;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Загружаем данные профиля
    this.loadProfileData(username);

    // Обработчики закрытия
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Предотвращаем всплытие события
    modal.querySelector('.modal-content').addEventListener('click', (e) => {
        e.stopPropagation();
    });
}
async loadProfileData(username) {
    try {
        console.log('👤 Loading profile data for:', username);
        
        // Сначала устанавливаем базовую информацию
        const profileUsername = document.getElementById('profileUsername');
        const profileUserStatus = document.getElementById('profileUserStatus');
        const profileAvatarImg = document.getElementById('profileAvatarImg');
        
        if (profileUsername) profileUsername.textContent = username;
        if (profileUserStatus) profileUserStatus.textContent = 'Загрузка...';
        if (profileAvatarImg) profileAvatarImg.src = this.getDefaultAvatarUrl();

        // Обновляем статус онлайн сразу
        const onlineStatus = document.getElementById('profileOnlineStatus');
        const userStatus = document.getElementById('profileUserStatus');
        if (onlineStatus && userStatus) {
            const isOnline = this.onlineUsers.has(username);
            onlineStatus.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
            onlineStatus.style.color = isOnline ? '#28a745' : '#dc3545';
            userStatus.textContent = isOnline ? 'В сети' : 'Не в сети';
        }

        // Параллельно загружаем данные пользователя и баланс
        const [userDataResponse, balanceResponse] = await Promise.allSettled([
            fetch(`/api/user/${username}`),
            fetch(`/api/user/${username}/currency`)
        ]);

        // Обрабатываем данные пользователя
        if (userDataResponse.status === 'fulfilled' && userDataResponse.value.ok) {
            const userData = await userDataResponse.value.json();
            
            // Обновляем аватар если есть
            const avatarImg = document.getElementById('profileAvatarImg');
            if (avatarImg && userData.avatar) {
                // Проверяем, что аватар действительно существует
                const avatarExists = await this.checkImageExists(userData.avatar);
                if (avatarExists) {
                    avatarImg.src = userData.avatar;
                } else {
                    console.log('⚠️ Avatar not found, using default');
                    avatarImg.src = this.getDefaultAvatarUrl();
                }
            }
            
            // Обновляем другую информацию пользователя если есть
            if (userData.bio) {
                const bioElement = document.getElementById('profileBio');
                if (bioElement) {
                    bioElement.textContent = userData.bio;
                }
            }
        } else {
            console.log('⚠️ User data not available, using default avatar');
            const avatarImg = document.getElementById('profileAvatarImg');
            if (avatarImg) {
                avatarImg.src = this.getDefaultAvatarUrl();
            }
        }

        // Обрабатываем баланс
        if (balanceResponse.status === 'fulfilled' && balanceResponse.value.ok) {
            const currencyData = await balanceResponse.value.json();
            const balanceElement = document.getElementById('profileBalance');
            if (balanceElement) {
                balanceElement.textContent = `🪙 ${currencyData.balance || 0}`;
            }
        } else {
            console.log('⚠️ Balance not available for user:', username);
            const balanceElement = document.getElementById('profileBalance');
            if (balanceElement) {
                balanceElement.textContent = '🪙 0';
            }
        }

        console.log('✅ Profile data loaded successfully for:', username);
        
    } catch (error) {
        console.error('❌ Error loading profile data:', error);
        
        // Устанавливаем дефолтные значения при ошибке
        const avatarImg = document.getElementById('profileAvatarImg');
        if (avatarImg) {
            avatarImg.src = this.getDefaultAvatarUrl();
        }
        
        const balanceElement = document.getElementById('profileBalance');
        if (balanceElement) {
            balanceElement.textContent = '🪙 0';
        }
        
        const onlineStatus = document.getElementById('profileOnlineStatus');
        const userStatus = document.getElementById('profileUserStatus');
        if (onlineStatus && userStatus) {
            onlineStatus.textContent = '🔴 Offline';
            onlineStatus.style.color = '#dc3545';
            userStatus.textContent = 'Не в сети';
        }
        
        this.showNotification('Ошибка загрузки профиля', 'error');
    }
}


// Метод для загрузки баланса пользователя
async loadUserBalance(username) {
    try {
        const response = await fetch(`/api/user/${username}/currency`);
        if (response.ok) {
            const currencyData = await response.json();
            const balanceElement = document.getElementById('profileBalance');
            if (balanceElement) {
                balanceElement.textContent = `🪙 ${currencyData.balance || 0}`;
            }
        }
    } catch (error) {
        console.log('Balance not available for user:', username);
        const balanceElement = document.getElementById('profileBalance');
        if (balanceElement) {
            balanceElement.textContent = '🪙 0';
        }
    }
}
openGiftForUser(username) {
        if (!window.currencyManager || !window.giftManager) {
            this.showNotification('Система подарков временно недоступна', 'error');
            return;
        }
        const profileModal = document.getElementById('userProfileModal');
        if (profileModal) {
            profileModal.remove();
        }
        this.openGiftSelectionModal(username);
    }
     openGiftSelectionModal(targetUser) {
        const currentUser = this.getCurrentUser();
        const userGifts = window.giftManager.getUserGifts(currentUser);
        
        const modal = document.createElement('div');
        modal.id = 'giftSelectionModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 25px;
                border-radius: 15px;
                width: 700px;
                max-width: 95%;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            ">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                    <h3 style="margin: 0; color: #333;">🎁 Отправить подарок пользователю ${targetUser}</h3>
                    <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
                </div>
                
                <div class="gift-selection-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #e9ecef; padding-bottom: 15px;">
                    <button class="gift-tab-btn active" data-tab="inventory" style="padding: 10px 15px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        📦 Мои подарки (${userGifts.length})
                    </button>
                    <button class="gift-tab-btn" data-tab="shop" style="padding: 10px 15px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        🛒 Купить новый
                    </button>
                </div>
                
                <div class="gift-selection-content" style="flex: 1; overflow-y: auto;">
                    <div id="giftInventoryTab" class="gift-tab-content active">
                        ${this.renderGiftInventory(userGifts, targetUser)}
                    </div>
                    <div id="giftShopTab" class="gift-tab-content" style="display: none;">
                        <div style="text-align: center; padding: 20px;">
                            <button class="open-gift-shop-btn" style="padding: 12px 24px; background: #ffc107; color: #212529; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">
                                🛒 Открыть магазин подарков
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupGiftSelectionModalEvents(modal, targetUser);
    }
    renderGiftInventory(userGifts, targetUser) {
        if (userGifts.length === 0) {
            return `
                <div style="text-align: center; padding: 40px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🎁</div>
                    <div style="margin-bottom: 15px; font-size: 16px;">У вас пока нет подарков</div>
                    <div style="margin-bottom: 20px; font-size: 14px;">Приобретите подарки в магазине, чтобы отправить их друзьям</div>
                    <button class="open-gift-shop-inventory-btn" style="padding: 12px 24px; background: #ffc107; color: #212529; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
                        🛒 Перейти в магазин
                    </button>
                </div>
            `;
        }

        return `
            <div style="margin-bottom: 15px; font-size: 14px; color: #6c757d; text-align: center;">
                Выберите подарок из вашей коллекции для отправки
            </div>
            <div class="inventory-grid" style="
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
                padding: 10px;
            ">
                ${userGifts.map(gift => this.renderInventoryGiftItem(gift, targetUser)).join('')}
            </div>
        `;
    }
      renderInventoryGiftItem(gift, targetUser) {
        const isEquipped = window.giftManager.isGiftEquipped(this.getCurrentUser(), gift.id);
        
        return `
            <div class="inventory-gift-item" data-gift-id="${gift.id}" style="
                border: 2px solid ${isEquipped ? '#007bff' : '#dee2e6'};
                border-radius: 10px;
                padding: 15px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                background: white;
                position: relative;
            ">
                ${isEquipped ? '<div style="position: absolute; top: 5px; right: 5px; color: #007bff; font-size: 12px;">🎽</div>' : ''}
                
                <div class="gift-icon" style="font-size: 40px; margin-bottom: 10px;">${gift.name.split(' ')[0]}</div>
                
                <div class="gift-name" style="font-weight: bold; margin-bottom: 5px; font-size: 14px; height: 40px; overflow: hidden;">
                    ${gift.name}
                </div>
                
                <div class="gift-description" style="font-size: 11px; color: #6c757d; margin-bottom: 10px; height: 30px; overflow: hidden;">
                    ${gift.description}
                </div>
                
                ${gift.from ? `
                    <div style="font-size: 10px; color: #28a745; background: #d4edda; padding: 2px 5px; border-radius: 3px; margin-bottom: 8px;">
                        от ${gift.from}
                    </div>
                ` : ''}
                
                <button class="send-gift-from-inventory-btn" data-gift-id="${gift.id}" style="
                    width: 100%;
                    padding: 8px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.3s ease;
                ">
                    🎁 Отправить
                </button>
            </div>
        `;
    }
        setupGiftSelectionModalEvents(modal, targetUser) {
        const closeBtn = modal.querySelector('.close-modal');
        const tabBtns = modal.querySelectorAll('.gift-tab-btn');
        const openShopBtn = modal.querySelector('.open-gift-shop-btn');
        const openShopInventoryBtn = modal.querySelector('.open-gift-shop-inventory-btn');
        
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Переключение вкладок
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-tab');
                
                // Обновляем активные кнопки
                tabBtns.forEach(b => b.style.background = '#6c757d');
                btn.style.background = '#007bff';
                
                // Показываем соответствующий контент
                document.querySelectorAll('.gift-tab-content').forEach(content => {
                    content.style.display = 'none';
                });
                
                const activeContent = document.getElementById(`gift${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
                if (activeContent) {
                    activeContent.style.display = 'block';
                }
            });
        });
        
        // Кнопки открытия магазина
        const openGiftShop = () => {
            closeModal();
            if (window.currencyManager) {
                window.currencyManager.openGiftShop(targetUser);
            }
        };
        
        if (openShopBtn) openShopBtn.addEventListener('click', openGiftShop);
        if (openShopInventoryBtn) openShopInventoryBtn.addEventListener('click', openGiftShop);
        
        // Обработчики отправки подарков из инвентаря
        modal.querySelectorAll('.send-gift-from-inventory-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const giftId = btn.getAttribute('data-gift-id');
                await this.sendGiftFromInventory(giftId, targetUser, modal);
            });
        });
        
        // Выбор подарка по клику на карточку
        modal.querySelectorAll('.inventory-gift-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('send-gift-from-inventory-btn')) {
                    const giftId = item.getAttribute('data-gift-id');
                    const sendBtn = item.querySelector('.send-gift-from-inventory-btn');
                    sendBtn.click();
                }
            });
        });
    }

    async sendGiftFromInventory(giftId, targetUser, modal) {
        const currentUser = this.getCurrentUser();
        
        if (!currentUser || !targetUser) {
            this.showNotification('Ошибка: пользователь не определен', 'error');
            return;
        }
        
        if (currentUser === targetUser) {
            this.showNotification('Нельзя отправить подарок самому себе', 'error');
            return;
        }
        
        try {
            const gift = window.giftManager.getUserGift(currentUser, giftId);
            if (!gift) {
                throw new Error('Подарок не найден');
            }
            
            // Показываем подтверждение
            if (!confirm(`Вы уверены, что хотите отправить подарок "${gift.name}" пользователю ${targetUser}?`)) {
                return;
            }
            
            // Показываем индикатор загрузки
            const sendBtn = modal.querySelector(`[data-gift-id="${giftId}"] .send-gift-from-inventory-btn`);
            const originalText = sendBtn.innerHTML;
            sendBtn.innerHTML = '⏳ Отправка...';
            sendBtn.disabled = true;
            
            // Отправляем подарок
            await window.giftManager.sendGiftFromInventory(currentUser, targetUser, giftId);
            
            // Закрываем модальное окно
            modal.remove();
            
            // Показываем уведомление об успехе
            this.showNotification(`Подарок "${gift.name}" успешно отправлен пользователю ${targetUser}!`, 'success');
            
            // Обновляем профили если они открыты
            if (window.profileManager) {
                if (window.profileManager.currentProfile?.username === targetUser) {
                    window.profileManager.viewProfile(targetUser);
                }
                if (window.profileManager.currentProfile?.username === currentUser) {
                    window.profileManager.viewProfile(currentUser);
                }
            }
            
        } catch (error) {
            console.error('Error sending gift from inventory:', error);
            this.showNotification(error.message, 'error');
            
            // Восстанавливаем кнопку
            const sendBtn = modal.querySelector(`[data-gift-id="${giftId}"] .send-gift-from-inventory-btn`);
            if (sendBtn) {
                sendBtn.innerHTML = '🎁 Отправить';
                sendBtn.disabled = false;
            }
        }
    }

    getCurrentUser() {
        return document.getElementById('username')?.textContent || 'anonymous';
    }
}
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Starting application initialization...');
    
    // Настраиваем навигацию
    setupChatNavigation();
    
    // Инициализируем socket
    initSocket();
    
    // Сначала инициализируем CurrencyManager
    if (!window.currencyManager) {
        console.log('💰 Creating CurrencyManager instance...');
        window.currencyManager = new CurrencyManager();
    }
    
    // Затем GiftManager
    if (!window.giftManager) {
        console.log('🎁 Creating GiftManager instance...');
        window.giftManager = new GiftManager();
    }
    
    // Затем приватный чат
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
    
    // Инициализируем менеджер профилей
    setTimeout(() => {
        if (!window.profileManager) {
            console.log('👤 Creating ProfileManager instance...');
            window.profileManager = new ProfileManager();
        }
    }, 300);
    
    // Инициализируем менеджер настроек
    setTimeout(() => {
        if (!window.settingsManager) {
            console.log('⚙️ Creating SettingsManager instance...');
            window.settingsManager = new SettingsManager();
        }
    }, 400);
    
    // Инициализируем менеджер звонковвлавда
    setTimeout(() => {
        if (!window.callManager) {
            console.log('📞 Creating CallManager instance...');
            window.callManager = new CallManager();
        }
    }, 200);
    
    console.log('✅ Application initialization complete');
});
window.PrivateChat = PrivateChat;