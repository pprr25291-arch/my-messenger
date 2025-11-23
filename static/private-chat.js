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
                                <span class="user-avatar">👤</span>
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
        console.log(`🖼️ Loading avatar for user: ${username}`);
        
        // Пробуем разные эндпоинты
        const endpoints = [
            `/api/user/${username}/avatar`,
            `/api/user/${username}`,
            `/api/users/${username}/avatar`,
            `/avatars/${username}`
        ];
        
        let avatarUrl = this.getDefaultAvatarUrl();
        let success = false;
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Trying avatar endpoint: ${endpoint}`);
                const response = await fetch(endpoint, {
                    method: 'GET',
                    credentials: 'same-origin',
                    signal: AbortSignal.timeout(5000) // Таймаут 5 секунд
                });
                
                if (response.ok) {
                    if (endpoint.includes('/avatar')) {
                        // Если это прямой эндпоинт аватарки
                        const blob = await response.blob();
                        avatarUrl = URL.createObjectURL(blob);
                    } else {
                        // Если это данные пользователя
                        const userData = await response.json();
                        avatarUrl = userData.avatar || userData.avatarUrl || this.getDefaultAvatarUrl();
                    }
                    success = true;
                    console.log(`✅ Avatar loaded from ${endpoint}`);
                    break;
                }
            } catch (error) {
                console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                continue;
            }
        }
        
        if (!success) {
            console.warn(`⚠️ All avatar endpoints failed for ${username}, using default`);
            avatarUrl = this.getDefaultAvatarUrl();
        }
        
        // Обрабатываем URL аватарки
        if (avatarUrl && avatarUrl !== this.getDefaultAvatarUrl()) {
            if (!avatarUrl.startsWith('http') && !avatarUrl.startsWith('/') && !avatarUrl.startsWith('data:')) {
                avatarUrl = '/' + avatarUrl;
            }
            
            // Проверяем существование изображения
            try {
                const imgExists = await this.checkImageExists(avatarUrl);
                if (!imgExists) {
                    console.warn(`⚠️ Avatar image not found: ${avatarUrl}`);
                    avatarUrl = this.getDefaultAvatarUrl();
                }
            } catch (error) {
                console.warn(`⚠️ Error checking avatar image: ${error.message}`);
                avatarUrl = this.getDefaultAvatarUrl();
            }
        }
        
        console.log(`✅ Final avatar URL for ${username}: ${avatarUrl}`);
        this.avatarCache.set(username, avatarUrl);
        return avatarUrl;
        
    } catch (error) {
        console.error(`❌ Error loading avatar for ${username}:`, error);
        const defaultAvatar = this.getDefaultAvatarUrl();
        this.avatarCache.set(username, defaultAvatar);
        return defaultAvatar;
    }
}

// Метод для очистки кэша при необходимости
clearAvatarCache() {
    this.avatarCache.clear();
}

// Метод для обновления аватарки конкретного пользователя
async updateUserAvatar(username) {
    this.avatarCache.delete(username);
    return await this.loadUserAvatar(username);
}
    getDefaultAvatarUrl() {
        return '/default-avatar.png';
    }

   

  async checkImageExists(url) {
    try {
        const response = await fetch(url, { 
            method: 'HEAD',
            credentials: 'same-origin',
            signal: AbortSignal.timeout(3000)
        });
        return response.ok;
    } catch (error) {
        console.log(`❌ Image check failed for ${url}:`, error.message);
        return false;
    }
}
// Метод для безопасной загрузки аватаров с ограничением попыток
async loadUserAvatarSafe(username, maxRetries = 2) {
    if (!username) return this.getDefaultAvatarUrl();
    
    // Проверяем кэш
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

displayConversations() {
    const container = document.getElementById('conversationsList');
    if (!container) return;
    
    container.innerHTML = '';

    if (this.conversations.length === 0) {
        container.innerHTML = '<div class="conversation-item empty">Нет диалогов</div>';
        return;
    }

    // Загружаем аватары для всех пользователей заранее
    const loadAvatarPromises = this.conversations.map(async (conversation) => {
        if (!conversation.isGroup) {
            conversation.avatarUrl = await this.loadUserAvatarSafe(conversation.username);
        }
        return conversation;
    });

    // Ждем загрузки всех аватаров и затем отображаем
    Promise.all(loadAvatarPromises).then(conversationsWithAvatars => {
        conversationsWithAvatars.forEach(conversation => {
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
                // Используем загруженную аватарку пользователя вместо дефолтной
                const avatarUrl = conversation.avatarUrl || this.getDefaultAvatarUrl();
                convElement.innerHTML = `
                    <div class="conv-info">
                        <div class="conv-header">
                            <span class="conv-name">
                                <img src="${avatarUrl}" class="conversation-avatar" alt="${conversation.username}" onerror="this.src='${this.getDefaultAvatarUrl()}'">
                                ${conversation.username} ${onlineIndicator}
                            </span>
                            ${lastMsg ? `<span class="conv-time">${lastMsg.timestamp}</span>` : ''}
                        </div>
                        <div class="conv-preview">${preview}</div>
                    </div>
                `;
            } else {
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
    }).catch(error => {
        console.error('Error loading avatars for conversations:', error);
        // В случае ошибки отображаем с дефолтными аватарками
        this.displayConversationsWithDefaultAvatars();
    });
}
displayConversationsWithDefaultAvatars() {
    const container = document.getElementById('conversationsList');
    if (!container) return;
    
    container.innerHTML = '';

    this.conversations.forEach(conversation => {
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
            // Используем дефолтную аватарку
            const avatarUrl = this.getDefaultAvatarUrl();
            convElement.innerHTML = `
                <div class="conv-info">
                    <div class="conv-header">
                        <span class="conv-name">
                            <img src="${avatarUrl}" class="conversation-avatar" alt="${conversation.username}">
                            ${conversation.username} ${onlineIndicator}
                        </span>
                        ${lastMsg ? `<span class="conv-time">${lastMsg.timestamp}</span>` : ''}
                    </div>
                    <div class="conv-preview">${preview}</div>
                </div>
            `;
        } else {
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
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            adminPanel.style.display = adminPanel.style.display === 'none' ? 'flex' : 'none';
            
            if (adminPanel.style.display === 'flex') {
                this.loadOnlineUsers();
                this.switchAdminTab('system');
            }
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
            const response = await fetch('/api/users/online');
            const users = await response.json();
            
            const onlineUsersList = document.getElementById('onlineUsersList');
            if (onlineUsersList) {
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
        } catch (error) {
            console.error('Error loading online users:', error);
        }
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
}

class CallManager {
    constructor() {
        this.currentCall = null;
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.isInitiator = false;
        this.callStartTime = null;
        this.callTimer = null;
        this.screenStream = null;
        this.isScreenSharing = false;
        this.pendingIceCandidates = [];
        this.outgoingCallStartTime = null;
        this.outgoingCallTimer = null;
        this.currentGroupAudio = null;
        this.cameraStream = null;
        
        console.log('🎯 CallManager constructor called');
        
        this.setupSocketListeners();
        this.setupCallButtons();
    }

    setupCallButtons() {
        console.log('🎯 Setting up call buttons...');
        
        // Используем делегирование событий для динамически создаваемых кнопок
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('video-call-btn')) {
                const targetUser = this.getCurrentChatUser();
                if (targetUser) {
                    this.initiateCall(targetUser, 'video');
                }
            } else if (e.target.classList.contains('audio-call-btn')) {
                const targetUser = this.getCurrentChatUser();
                if (targetUser) {
                    this.initiateCall(targetUser, 'audio');
                }
            }
        });
    }

    getCurrentChatUser() {
        const currentChatUser = document.getElementById('currentChatUser');
        if (currentChatUser && currentChatUser.textContent) {
            return currentChatUser.textContent;
        }
        
        const groupChatContainer = document.getElementById('groupChatContainer');
        if (groupChatContainer && groupChatContainer.style.display !== 'none') {
            const groupName = document.querySelector('#groupChatContainer .user-details h4');
            if (groupName) {
                return groupName.textContent;
            }
        }
        
        this.showNotification('Выберите чат для звонка', 'error');
        return null;
    }

    setupSocketListeners() {
        if (!window.socket) {
            console.log('⚠️ Socket not available for CallManager');
            return;
        }
        
        console.log('🎯 Setting up CallManager socket listeners...');
        
        // Обработчики для звонков
        window.socket.on('incoming_call', (data) => {
            console.log('📞 Incoming call received:', data);
            this.handleIncomingCall(data);
        });

        window.socket.on('call_accepted', (data) => {
            console.log('✅ Call accepted:', data);
            this.handleCallAccepted(data);
        });

        window.socket.on('call_rejected', (data) => {
            console.log('❌ Call rejected:', data);
            this.handleCallRejected(data);
        });

        window.socket.on('call_ended', (data) => {
            console.log('📞 Call ended:', data);
            this.handleCallEnded(data);
        });

        window.socket.on('webrtc_offer', (data) => {
            console.log('📡 WebRTC offer received:', data);
            this.handleOffer(data);
        });

        window.socket.on('webrtc_answer', (data) => {
            console.log('📡 WebRTC answer received:', data);
            this.handleAnswer(data);
        });

        window.socket.on('webrtc_ice_candidate', (data) => {
            console.log('🧊 ICE candidate received:', data);
            this.handleIceCandidate(data);
        });

        // Обработчики для трансляции экрана
        window.socket.on('screen_share_started', (data) => {
            console.log('🖥️ Screen share started by:', data.sharer);
            this.showNotification(`${data.sharer} начал трансляцию экрана`, 'info');
            
            // Обновляем интерфейс если мы в активном звонке
            if (this.currentCall && 
                ((this.isInitiator && this.currentCall.targetUser === data.sharer) ||
                 (!this.isInitiator && this.currentCall.caller === data.sharer))) {
                this.showRemoteScreenShare(data);
            }
        });

        window.socket.on('screen_share_ended', (data) => {
            console.log('🖥️ Screen share ended by:', data.sharer);
            this.showNotification(`${data.sharer} остановил трансляцию экрана`, 'info');
            
            // Обновляем интерфейс если мы в активном звонке
            if (this.currentCall && 
                ((this.isInitiator && this.currentCall.targetUser === data.sharer) ||
                 (!this.isInitiator && this.currentCall.caller === data.sharer))) {
                this.hideRemoteScreenShare(data);
            }
        });

        // Обработчик ошибок
        window.socket.on('error', (data) => {
            console.error('❌ Socket error:', data);
            this.showNotification(data.message || 'Произошла ошибка', 'error');
        });

        console.log('✅ CallManager socket listeners setup completed');
    }

    showRemoteScreenShare(data) {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        // Для видеозвонков показываем индикатор
        if (this.currentCall && this.currentCall.type === 'video') {
            let indicator = modal.querySelector('.remote-screen-share-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'remote-screen-share-indicator';
                indicator.style.cssText = `
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(255, 107, 107, 0.9);
                    color: white;
                    padding: 8px 15px;
                    border-radius: 15px;
                    font-size: 12px;
                    font-weight: bold;
                    z-index: 10;
                `;
                indicator.textContent = `🖥️ ${data.sharer} транслирует экран`;
                modal.querySelector('.call-content').appendChild(indicator);
            }
        }
    }

    hideRemoteScreenShare(data) {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        const indicator = modal.querySelector('.remote-screen-share-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    handleIncomingCall(data) {
        console.log('📞 Incoming call:', data);
        
        if (this.currentCall) {
            console.log('❌ Already in call, rejecting incoming call');
            if (window.socket) {
                window.socket.emit('reject_call', {
                    callId: data.callId,
                    reason: 'User is busy'
                });
            }
            return;
        }

        this.currentCall = {
            id: data.callId,
            caller: data.caller,
            type: data.callType,
            status: 'incoming',
            isInitiator: false
        };

        this.isInitiator = false;
        this.showIncomingCallInterface(data);
    }

    showIncomingCallInterface(data) {
        console.log('🔄 Creating incoming call modal...');
        
        // Удаляем существующее модальное окно если есть
        const existingModal = document.getElementById('incomingCallModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'incomingCallModal';
        modal.className = 'incoming-call-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;

        const callTypeIcon = data.callType === 'video' ? '📹' : '📞';
        const callTypeText = data.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок';

        modal.innerHTML = `
            <div class="incoming-call-container" style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                max-width: 400px;
                width: 90%;
                border: 3px solid #667eea;
            ">
                <div class="call-header" style="margin-bottom: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 22px;">${callTypeIcon} Входящий звонок</h3>
                    <div style="font-size: 16px; color: #6c757d;">${data.caller} вызывает вас</div>
                </div>
                
                <div class="caller-info" style="
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 15px;
                    color: white;
                ">
                    <div class="caller-avatar" style="
                        font-size: 48px;
                        width: 80px;
                        height: 80px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    ">👤</div>
                    <div class="caller-details" style="text-align: left; flex: 1;">
                        <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">${data.caller}</div>
                        <div style="font-size: 14px; opacity: 0.9;">${callTypeText}</div>
                    </div>
                </div>
                
                <div class="call-buttons" style="display: flex; gap: 15px; justify-content: center;">
                    <button class="accept-call-btn" style="
                        padding: 15px 30px;
                        border: none;
                        border-radius: 50px;
                        cursor: pointer;
                        font-weight: bold;
                        transition: all 0.3s ease;
                        font-size: 16px;
                        min-width: 120px;
                        flex: 1;
                        background: linear-gradient(45deg, #28a745, #20c997);
                        color: white;
                        box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
                    ">📞 Принять</button>
                    <button class="reject-call-btn" style="
                        padding: 15px 30px;
                        border: none;
                        border-radius: 50px;
                        cursor: pointer;
                        font-weight: bold;
                        transition: all 0.3s ease;
                        font-size: 16px;
                        min-width: 120px;
                        flex: 1;
                        background: linear-gradient(45deg, #dc3545, #c82333);
                        color: white;
                        box-shadow: 0 4px 15px rgba(220, 53, 69, 0.4);
                    ">❌ Отклонить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        console.log('✅ Incoming call modal created');

        // Добавляем обработчики событий
        const acceptBtn = modal.querySelector('.accept-call-btn');
        const rejectBtn = modal.querySelector('.reject-call-btn');

        acceptBtn.addEventListener('click', (e) => {
            console.log('✅ Accept call button clicked');
            e.stopPropagation();
            this.acceptCall();
        });

        rejectBtn.addEventListener('click', (e) => {
            console.log('❌ Reject call button clicked');
            e.stopPropagation();
            this.rejectCall();
        });

        // Закрытие по клику на фон
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('🔄 Modal background clicked, rejecting call');
                this.rejectCall();
            }
        });

        // Добавляем анимацию появления
        setTimeout(() => {
            const container = modal.querySelector('.incoming-call-container');
            if (container) {
                container.style.transform = 'scale(1)';
                container.style.opacity = '1';
            }
        }, 10);
    }

    acceptCall() {
        console.log('🎯 Accepting call...');
        
        if (!this.currentCall) {
            console.error('❌ No current call to accept');
            return;
        }

        try {
            const constraints = {
                video: this.currentCall.type === 'video' ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                } : false,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000
                }
            };

            console.log('🎯 Requesting media permissions for accepting call...');
            
            navigator.mediaDevices.getUserMedia(constraints)
                .then(stream => {
                    console.log('✅ Media stream obtained for accepting call');
                    
                    // Проверяем аудио треки
                    const audioTracks = stream.getAudioTracks();
                    console.log('🎵 Audio tracks for accepting:', audioTracks.length);
                    audioTracks.forEach(track => {
                        console.log('🎵 Audio track settings (accepting):', track.getSettings());
                        console.log('🎵 Audio track enabled (accepting):', track.enabled);
                    });

                    this.localStream = stream;
                    this.currentCall.status = 'active';
                    
                    if (window.socket) {
                        console.log('🎯 Sending call acceptance via socket...');
                        window.socket.emit('accept_call', {
                            callId: this.currentCall.id,
                            caller: this.currentCall.caller,
                            acceptor: document.getElementById('username')?.textContent || 'user'
                        });
                    }

                    const incomingModal = document.getElementById('incomingCallModal');
                    if (incomingModal) {
                        console.log('✅ Removing incoming call modal');
                        incomingModal.remove();
                    }

                    console.log('🎯 Showing active call interface...');
                    this.showActiveCallInterface();
                    this.createPeerConnection();
                })
                .catch(error => {
                    console.error('❌ Error accessing media devices:', error);
                    this.showNotification('Ошибка доступа к камере/микрофону', 'error');
                    
                    const incomingModal = document.getElementById('incomingCallModal');
                    if (incomingModal) {
                        incomingModal.remove();
                    }
                    
                    this.endCall();
                });

        } catch (error) {
            console.error('❌ Error accepting call:', error);
            this.showNotification('Ошибка принятия звонка', 'error');
            
            const incomingModal = document.getElementById('incomingCallModal');
            if (incomingModal) {
                incomingModal.remove();
            }
            
            this.endCall();
        }
    }

    rejectCall() {
        console.log('🎯 Rejecting call...');
        
        if (!this.currentCall) {
            console.error('❌ No current call to reject');
            return;
        }

        if (window.socket) {
            console.log('🎯 Sending call rejection via socket...');
            window.socket.emit('reject_call', {
                callId: this.currentCall.id,
                caller: this.currentCall.caller,
                reason: 'Call rejected by user'
            });
        }

        this.cleanupCall();
        
        // Закрываем модальное окно
        const incomingModal = document.getElementById('incomingCallModal');
        if (incomingModal) {
            console.log('✅ Removing incoming call modal');
            incomingModal.remove();
        }
        
        this.showNotification('Звонок отклонен', 'info');
    }

    async startScreenShare() {
        try {
            console.log('🖥️ Starting screen share...');

            // Останавливаем текущую трансляцию если есть
            if (this.isScreenSharing) {
                await this.stopScreenShare();
                return;
            }

            // Сохраняем текущий поток камеры перед началом трансляции
            this.cameraStream = this.localStream;
            
            // Показываем уведомление о начале процесса
            this.showNotification('Запрашиваем разрешение на трансляцию экрана...', 'info');

            // Получаем поток экрана с улучшенной обработкой ошибок
            let screenStream;
            try {
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: 'always',
                        displaySurface: 'window',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30 }
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100
                    }
                });
            } catch (error) {
                console.error('❌ Screen share permission denied:', error);
                
                // Специфичная обработка разных типов ошибок
                if (error.name === 'NotAllowedError') {
                    this.showNotification(
                        'Разрешение на трансляцию экрана отклонено. ' +
                        'Чтобы поделиться экраном, нажмите "Разрешить" в диалоговом окне браузера.', 
                        'error'
                    );
                } else if (error.name === 'NotFoundError' || error.name === 'NotSupportedError') {
                    this.showNotification(
                        'Ваш браузер не поддерживает трансляцию экрана или не найдены доступные источники.', 
                        'error'
                    );
                } else if (error.name === 'AbortError') {
                    this.showNotification('Процесс выбора экрана был прерван.', 'warning');
                } else {
                    this.showNotification('Ошибка трансляции экрана: ' + error.message, 'error');
                }
                
                this.isScreenSharing = false;
                this.screenStream = null;
                this.cameraStream = null;
                return;
            }

            // Проверяем, был ли выбран источник (пользователь мог закрыть диалог без выбора)
            if (!screenStream || screenStream.getTracks().length === 0) {
                console.log('🖥️ User canceled screen share selection');
                this.showNotification('Выбор экрана отменен', 'info');
                this.isScreenSharing = false;
                this.screenStream = null;
                this.cameraStream = null;
                return;
            }

            console.log('🖥️ Screen stream obtained:', screenStream.getTracks());

            // Обработчик остановки трансляции пользователем
            const videoTrack = screenStream.getVideoTracks()[0];
            videoTrack.onended = () => {
                console.log('🖥️ Screen share ended by user');
                this.stopScreenShare();
            };

            // Обработчик ошибок трека
            videoTrack.onerror = (error) => {
                console.error('🖥️ Screen track error:', error);
                this.showNotification('Ошибка трансляции экрана', 'error');
                this.stopScreenShare();
            };

            this.screenStream = screenStream;
            this.isScreenSharing = true;

            // Обновляем peer connection для трансляции
            await this.setupScreenShareStream(screenStream);

            // Обновляем интерфейс для отображения трансляции
            this.updateCallInterfaceForScreenShare(screenStream);

            // Уведомляем собеседника о начале трансляции
            if (window.socket) {
                window.socket.emit('screen_share_started', {
                    callId: this.currentCall.id,
                    sharer: document.getElementById('username')?.textContent,
                    targetUser: this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller
                });
            }

            this.showNotification('Трансляция экрана начата', 'success');
            console.log('✅ Screen share started successfully');

        } catch (error) {
            console.error('❌ Error starting screen share:', error);
            
            // Общая обработка непредвиденных ошибок
            this.showNotification('Не удалось начать трансляцию экрана: ' + error.message, 'error');
            this.isScreenSharing = false;
            this.screenStream = null;
            this.cameraStream = null;
            
            // Восстанавливаем обычный интерфейс
            this.updateCallInterface();
        }
    }

    async setupScreenShareStream(screenStream) {
        if (!this.peerConnection) {
            console.error('❌ No peer connection for screen share');
            return;
        }

        try {
            // Получаем все senders
            const senders = this.peerConnection.getSenders();
            
            // Ищем video sender
            const videoSender = senders.find(sender => 
                sender.track && sender.track.kind === 'video'
            );

            if (videoSender) {
                console.log('🔄 Replacing video track with screen share');
                const screenVideoTrack = screenStream.getVideoTracks()[0];
                
                if (screenVideoTrack) {
                    await videoSender.replaceTrack(screenVideoTrack);
                    console.log('✅ Video track replaced with screen share');
                    
                    // Отправляем событие переnegoitation
                    if (this.isInitiator) {
                        await this.createOffer();
                    }
                }
            } else {
                // Если нет video sender, добавляем новый трек
                console.log('🔄 Adding new screen share track');
                screenStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, screenStream);
                });
                
                if (this.isInitiator) {
                    await this.createOffer();
                }
            }

        } catch (error) {
            console.error('❌ Error setting up screen share stream:', error);
            throw error;
        }
    }

    updateCallInterfaceForScreenShare(screenStream) {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        const isVideoCall = this.currentCall.type === 'video';
        
        if (isVideoCall) {
            this.setupVideoCallWithScreenShare(screenStream);
        } else {
            this.setupAudioCallWithScreenShare(screenStream);
        }
        
        // Обновляем кнопки управления
        this.updateControlButtons();
    }

    updateControlButtons() {
        const controlsContainer = document.querySelector('.call-controls');
        if (!controlsContainer) return;

        controlsContainer.innerHTML = ''; // Очищаем старые кнопки

        const buttons = [
            {
                class: 'mute-btn call-control',
                icon: '🎤',
                title: 'Выключить микрофон',
                onClick: () => this.toggleMute()
            },
            {
                class: 'video-btn call-control',
                icon: '📹', 
                title: 'Выключить камеру',
                onClick: () => this.toggleVideo(),
                show: this.currentCall.type === 'video' && !this.isScreenSharing
            },
            {
                class: `screen-share-btn call-control ${this.isScreenSharing ? 'sharing' : ''}`,
                icon: '🖥️',
                title: this.isScreenSharing ? 'Остановить трансляцию' : 'Начать трансляцию экрана',
                onClick: () => this.toggleScreenShare()
            },
            {
                class: 'end-call-btn call-control',
                icon: '📞',
                title: 'Завершить звонок',
                onClick: () => this.endCall()
            }
        ];

        buttons.forEach(button => {
            if (button.show === false) return;
            
            const btn = document.createElement('button');
            btn.className = button.class;
            btn.innerHTML = button.icon;
            btn.title = button.title;
            btn.onclick = button.onClick;
            
            controlsContainer.appendChild(btn);
        });

        // Добавляем кнопку полноэкранного режима
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'fullscreen-btn call-control';
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.title = 'Полный экран';
        fullscreenBtn.onclick = () => this.toggleFullscreen();
        controlsContainer.appendChild(fullscreenBtn);
    }

    setupVideoCallWithScreenShare(screenStream) {
        const callContent = document.querySelector('.call-content');
        if (!callContent) return;

        // Создаем контейнер для трансляции
        callContent.innerHTML = `
            <div class="video-call-with-screen-share">
                <div class="remote-video-container">
                    <video id="remoteVideo" autoplay playsinline></video>
                    <div class="remote-screen-share-badge">🖥️ Трансляция экрана</div>
                </div>
                <div class="local-video-container screen-share-active">
                    <video id="localScreenShare" autoplay playsinline muted></video>
                    <div class="screen-share-badge">🖥️ Ваш экран</div>
                </div>
            </div>
        `;

        // Устанавливаем поток трансляции
        const localScreenShare = document.getElementById('localScreenShare');
        if (localScreenShare) {
            localScreenShare.srcObject = screenStream;
            localScreenShare.play().catch(e => console.error('Screen share video play error:', e));
        }

        // Обновляем удаленное видео если есть
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
            remoteVideo.play().catch(e => console.error('Remote video play error:', e));
        }
    }

    setupAudioCallWithScreenShare(screenStream) {
        const callContent = document.querySelector('.call-content');
        if (!callContent) return;

        callContent.innerHTML = `
            <div class="audio-call-with-screen-share">
                <div class="audio-user-section">
                    <div class="audio-icon">🖥️</div>
                    <div class="audio-user-name">${this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller}</div>
                    <div class="audio-call-status">Идет трансляция вашего экрана</div>
                    <audio id="remoteAudio" autoplay style="display: none;"></audio>
                </div>
                <div class="screen-share-section">
                    <video id="localScreenShare" autoplay playsinline muted class="screen-share-video"></video>
                    <div class="screen-share-badge">🖥️ Ваш экран</div>
                </div>
            </div>
        `;

        // Устанавливаем поток трансляции
        const localScreenShare = document.getElementById('localScreenShare');
        if (localScreenShare) {
            localScreenShare.srcObject = screenStream;
            localScreenShare.play().catch(e => console.error('Screen share video play error:', e));
        }

        // Устанавливаем аудио
        const remoteAudio = document.getElementById('remoteAudio');
        if (remoteAudio && this.remoteStream) {
            remoteAudio.srcObject = this.remoteStream;
        }
    }

    async stopScreenShare() {
        if (!this.isScreenSharing) return;

        try {
            console.log('🖥️ Stopping screen share...');

            // Восстанавливаем камеру если она была
            if (this.cameraStream) {
                const videoTrack = this.cameraStream.getVideoTracks()[0];
                const senders = this.peerConnection.getSenders();
                
                if (videoTrack) {
                    const videoSender = senders.find(s => 
                        s.track && s.track.kind === 'video'
                    );
                    
                    if (videoSender) {
                        console.log('🔄 Restoring camera video track');
                        await videoSender.replaceTrack(videoTrack);
                        console.log('✅ Camera video track restored');
                    }
                }

                // Восстанавливаем локальное видео с камеры
                const localVideo = document.getElementById('localVideo');
                if (localVideo && this.cameraStream) {
                    localVideo.srcObject = this.cameraStream;
                    localVideo.play().catch(e => console.error('Local camera video play error:', e));
                    console.log('✅ Local video restored to camera');
                }
            } else {
                console.log('⚠️ No camera stream to restore');
            }

            // Останавливаем screen stream
            if (this.screenStream) {
                this.safeStopMediaTracks(this.screenStream);
                this.screenStream = null;
            }

            this.isScreenSharing = false;
            this.cameraStream = null;

            // Уведомляем собеседника об остановке трансляции
            if (window.socket) {
                window.socket.emit('screen_share_ended', {
                    callId: this.currentCall.id,
                    sharer: document.getElementById('username')?.textContent,
                    targetUser: this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller
                });
            }

            // Обновляем интерфейс
            this.updateCallInterface();

            this.showNotification('Трансляция экрана остановлена', 'info');
            console.log('✅ Screen share stopped successfully');

        } catch (error) {
            console.error('❌ Error stopping screen share:', error);
            this.showNotification('Ошибка остановки трансляции', 'error');
            
            // Принудительно сбрасываем состояние
            this.isScreenSharing = false;
            this.screenStream = null;
            this.cameraStream = null;
            this.updateCallInterface();
        }
    }

    toggleScreenShare() {
        try {
            // Проверяем поддержку браузера
            if (!this.checkScreenShareSupport()) {
                return;
            }

            if (!this.isScreenSharing) {
                this.startScreenShare();
            } else {
                this.stopScreenShare();
            }
        } catch (error) {
            console.error('❌ Error toggling screen share:', error);
            this.showNotification('Ошибка управления трансляцией экрана: ' + error.message, 'error');
        }
    }

    checkScreenShareSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            this.showNotification(
                'Трансляция экрана не поддерживается вашим браузером. ' +
                'Пожалуйста, используйте современный браузер (Chrome, Firefox, Edge).', 
                'error'
            );
            return false;
        }
        return true;
    }

    async initiateCall(targetUser, callType = 'video') {
        console.log('🎯 Initiate call started to:', targetUser, 'Type:', callType);
        
        if (this.currentCall) {
            this.showNotification('Уже есть активный звонок', 'error');
            return;
        }

        if (!targetUser) {
            this.showNotification('Выберите пользователя для звонка', 'error');
            return;
        }

        try {
            console.log('🎯 Requesting media permissions...');
            const constraints = {
                video: callType === 'video' ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                } : false,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000
                }
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Media stream obtained');
            
            // Проверяем аудио треки
            const audioTracks = this.localStream.getAudioTracks();
            console.log('🎵 Audio tracks:', audioTracks.length);
            audioTracks.forEach(track => {
                console.log('🎵 Audio track settings:', track.getSettings());
                console.log('🎵 Audio track enabled:', track.enabled);
            });

            // Проверяем видео треки
            const videoTracks = this.localStream.getVideoTracks();
            console.log('🎥 Video tracks:', videoTracks.length);
            
            const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            this.currentCall = {
                id: callId,
                targetUser: targetUser,
                type: callType,
                status: 'calling',
                isInitiator: true
            };

            this.isInitiator = true;
            console.log('🎯 Showing outgoing call interface...');
            this.showOutgoingCallInterface();

            if (window.socket) {
                console.log('🎯 Sending call request via socket...');
                window.socket.emit('initiate_call', {
                    callId: callId,
                    targetUser: targetUser,
                    caller: document.getElementById('username')?.textContent || 'user',
                    callType: callType,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.error('❌ Socket not connected');
                throw new Error('Socket not connected');
            }

        } catch (error) {
            console.error('❌ Error initiating call:', error);
            this.showNotification('Ошибка доступа к камере/микрофону: ' + error.message, 'error');
            this.cleanupCall();
        }
    }

    showOutgoingCallInterface() {
        console.log('🔄 Creating outgoing call modal...');
        
        const existingModal = document.getElementById('outgoingCallModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'outgoingCallModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;

        const callTypeIcon = this.currentCall.type === 'video' ? '📹' : '📞';
        const callTypeText = this.currentCall.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок';

        modal.innerHTML = `
            <div class="outgoing-call-window" style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                max-width: 400px;
                width: 90%;
            ">
                <div class="caller-info" style="margin-bottom: 25px;">
                    <div class="caller-avatar" style="
                        font-size: 60px;
                        margin-bottom: 15px;
                    ">👤</div>
                    <div class="caller-details">
                        <h4 style="margin: 0 0 10px 0; font-size: 24px;">${this.currentCall.targetUser}</h4>
                        <p style="margin: 0 0 5px 0; color: #666; font-size: 16px;">${callTypeText}</p>
                        <div class="call-status" style="color: #17a2b8; font-weight: bold; margin-bottom: 20px;">Звонок...</div>
                        <div class="call-timer" id="outgoingCallTimer" style="font-size: 18px; color: #667eea; font-weight: bold; font-family: 'Courier New', monospace;">00:00</div>
                    </div>
                </div>
                <div class="call-dialog-buttons">
                    <button class="cancel-call-btn" style="
                        padding: 15px 25px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        width: 100%;
                        transition: all 0.3s ease;
                    ">📞 Сбросить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        console.log('✅ Outgoing call modal created');

        // Запускаем таймер для исходящего звонка
        this.startOutgoingCallTimer();

        const cancelCallBtn = modal.querySelector('.cancel-call-btn');
        cancelCallBtn.addEventListener('click', () => {
            console.log('🎯 Cancel call button clicked');
            this.endCall();
        });
    }

    startOutgoingCallTimer() {
        this.outgoingCallStartTime = Date.now();
        this.outgoingCallTimer = setInterval(() => {
            const elapsed = Date.now() - this.outgoingCallStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            const timerElement = document.getElementById('outgoingCallTimer');
            if (timerElement) {
                timerElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    stopOutgoingCallTimer() {
        if (this.outgoingCallTimer) {
            clearInterval(this.outgoingCallTimer);
            this.outgoingCallTimer = null;
        }
    }

 async createPeerConnection() {
    if (!this.currentCall) return;

    try {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };

        this.peerConnection = new RTCPeerConnection(configuration);
        this.pendingIceCandidates = [];

        // Улучшенные обработчики состояния
        this.peerConnection.onconnectionstatechange = () => {
            console.log('🔗 Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                console.log('✅ Peer connection established successfully');
            } else if (this.peerConnection.connectionState === 'failed') {
                console.error('❌ Peer connection failed');
                this.showNotification('Ошибка соединения', 'error');
                this.endCall();
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
            if (this.peerConnection.iceConnectionState === 'failed') {
                console.error('❌ ICE connection failed');
                this.showNotification('Ошибка сетевого соединения', 'error');
            }
        };

        this.peerConnection.onsignalingstatechange = () => {
            console.log('📡 Signaling state:', this.peerConnection.signalingState);
        };

        // Обработчик входящих потоков
        this.peerConnection.ontrack = (event) => {
            console.log('📹 Remote track received:', event.track.kind, event.track.label);
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                
                // Для аудио
                if (event.track.kind === 'audio') {
                    console.log('🎵 Remote audio track received');
                    const remoteAudio = document.getElementById('remoteAudio');
                    if (remoteAudio) {
                        remoteAudio.srcObject = this.remoteStream;
                        remoteAudio.play().catch(e => console.error('Audio play error:', e));
                    }
                }
                
                // Для видео
                if (event.track.kind === 'video') {
                    console.log('🎥 Remote video track received');
                    const remoteVideo = document.getElementById('remoteVideo');
                    if (remoteVideo) {
                        remoteVideo.srcObject = this.remoteStream;
                        remoteVideo.play().catch(e => console.error('Video play error:', e));
                    }
                }
            }
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && window.socket) {
                console.log('📤 Sending ICE candidate');
                window.socket.emit('webrtc_ice_candidate', {
                    callId: this.currentCall.id,
                    candidate: event.candidate,
                    targetUser: this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller
                });
            } else if (!event.candidate) {
                console.log('✅ All ICE candidates sent');
            }
        };

        // Добавляем локальные треки
        if (this.localStream) {
            console.log('🎯 Adding local tracks to peer connection');
            this.localStream.getTracks().forEach(track => {
                console.log('🎯 Adding local track:', track.kind, track.label);
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        if (this.isInitiator) {
            await this.createOffer();
        }

    } catch (error) {
        console.error('❌ Error creating peer connection:', error);
        this.showNotification('Ошибка соединения', 'error');
        this.endCall();
    }
}

    async createOffer() {
        if (!this.peerConnection) return;

        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            if (window.socket) {
                window.socket.emit('webrtc_offer', {
                    callId: this.currentCall.id,
                    offer: offer,
                    targetUser: this.currentCall.targetUser
                });
            }
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    async handleOffer(data) {
        if (!this.peerConnection || !this.currentCall) return;

        try {
            console.log('✅ Setting remote description from offer');
            await this.peerConnection.setRemoteDescription(data.offer);
            
            // Добавляем отложенные ICE кандидаты
            if (this.pendingIceCandidates && this.pendingIceCandidates.length > 0) {
                console.log(`🔄 Adding ${this.pendingIceCandidates.length} pending ICE candidates`);
                for (const candidate of this.pendingIceCandidates) {
                    try {
                        await this.peerConnection.addIceCandidate(candidate);
                    } catch (candidateError) {
                        console.warn('⚠️ Failed to add pending ICE candidate:', candidateError);
                    }
                }
                this.pendingIceCandidates = [];
            }
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            if (window.socket) {
                console.log('📤 Sending answer');
                window.socket.emit('webrtc_answer', {
                    callId: this.currentCall.id,
                    answer: answer,
                    targetUser: data.targetUser || data.caller
                });
            }
        } catch (error) {
            console.error('❌ Error handling offer:', error);
        }
    }

   async handleAnswer(data) {
    if (!this.peerConnection) {
        console.error('❌ No peer connection for answer');
        return;
    }

    try {
        console.log('✅ Setting remote description from answer');
        await this.peerConnection.setRemoteDescription(data.answer);
        
        // Добавляем отложенные ICE кандидаты после установки remote description
        if (this.pendingIceCandidates && this.pendingIceCandidates.length > 0) {
            console.log(`🔄 Adding ${this.pendingIceCandidates.length} pending ICE candidates`);
            for (const candidate of this.pendingIceCandidates) {
                try {
                    await this.peerConnection.addIceCandidate(candidate);
                } catch (candidateError) {
                    console.warn('⚠️ Failed to add pending ICE candidate:', candidateError);
                }
            }
            this.pendingIceCandidates = [];
        }
        
    } catch (error) {
        console.error('❌ Error handling answer:', error);
    }
}

 async handleIceCandidate(data) {
    try {
        if (!this.peerConnection) {
            console.log('⚠️ No peer connection yet, caching ICE candidate');
            if (!this.pendingIceCandidates) {
                this.pendingIceCandidates = [];
            }
            this.pendingIceCandidates.push(data.candidate);
            return;
        }

        // Проверяем, установлено ли удаленное описание
        if (this.peerConnection.remoteDescription) {
            console.log('✅ Adding ICE candidate:', data.candidate);
            await this.peerConnection.addIceCandidate(data.candidate);
        } else {
            console.log('⚠️ Remote description not set yet, caching ICE candidate');
            if (!this.pendingIceCandidates) {
                this.pendingIceCandidates = [];
            }
            this.pendingIceCandidates.push(data.candidate);
        }
        
    } catch (error) {
        console.error('❌ Error handling ICE candidate:', error);
    }
}

    handleCallAccepted(data) {
        console.log('✅ Call accepted:', data);
        
        if (this.currentCall && this.currentCall.id === data.callId) {
            this.currentCall.status = 'active';
            
            const outgoingModal = document.getElementById('outgoingCallModal');
            if (outgoingModal) {
                outgoingModal.remove();
            }
            
            this.showActiveCallInterface();
            this.createPeerConnection();
        }
    }

    handleCallRejected(data) {
        console.log('❌ Call rejected:', data);
        
        this.cleanupCall();
        
        const outgoingModal = document.getElementById('outgoingCallModal');
        if (outgoingModal) {
            outgoingModal.remove();
        }
        
        this.showNotification('Звонок отклонен', 'error');
    }

    handleCallEnded(data) {
        console.log('📞 Call ended:', data);
        
        this.cleanupCall();
        
        const activeModal = document.getElementById('activeCallModal');
        const outgoingModal = document.getElementById('outgoingCallModal');
        const incomingModal = document.getElementById('incomingCallModal');
        
        if (activeModal) activeModal.remove();
        if (outgoingModal) outgoingModal.remove();
        if (incomingModal) incomingModal.remove();
        
        this.showNotification('Звонок завершен', 'info');
    }

    showActiveCallInterface() {
        const modal = document.createElement('div');
        modal.id = 'activeCallModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            z-index: 10001;
        `;

        const isVideoCall = this.currentCall.type === 'video';
        const remoteUser = this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller;

        modal.innerHTML = `
            <div class="call-header" style="padding: 20px; background: rgba(0,0,0,0.7); color: white; display: flex; justify-content: space-between; align-items: center;">
                <div class="call-info">
                    <h3 style="margin: 0;">${isVideoCall ? '📹' : '📞'} ${remoteUser}</h3>
                    <div class="call-timer" id="callTimer">00:00</div>
                </div>
                <div class="call-header-controls">
                    <button class="minimize-call-btn" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; margin-right: 10px;" title="Свернуть">➖</button>
                    <button class="fullscreen-call-btn" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-right: 10px;" title="Полный экран">⛶</button>
                </div>
            </div>
            
            <div class="call-content" style="flex: 1; position: relative;">
                ${this.getCallContentHTML(isVideoCall, remoteUser)}
            </div>
            
            <div class="call-controls" style="
                padding: 20px;
                background: rgba(0,0,0,0.7);
                display: flex;
                justify-content: center;
                gap: 15px;
            ">
                <!-- Кнопки будут добавлены через updateControlButtons -->
            </div>
        `;

        document.body.appendChild(modal);

        // Инициализируем кнопки управления
        this.updateControlButtons();

        this.startCallTimer();
        this.setupCallMedia();
        this.setupCallModalHandlers();
    }

    setupCallMedia() {
        console.log('🎯 Setting up call media...');
        
        const isVideoCall = this.currentCall.type === 'video';
        
        // Устанавливаем локальное видео для видеозвонков
        if (isVideoCall) {
            const localVideo = document.getElementById('localVideo');
            if (localVideo && this.localStream) {
                localVideo.srcObject = this.localStream;
                localVideo.play().catch(e => console.error('Local video play error:', e));
                console.log('✅ Local video set up');
            }
        }

        // Устанавливаем локальный аудио
        const localAudio = document.getElementById('localAudio');
        if (localAudio && this.localStream) {
            localAudio.srcObject = this.localStream;
            console.log('✅ Local audio set up');
        }

        // Устанавливаем удаленное аудио
        const remoteAudio = document.getElementById('remoteAudio');
        if (remoteAudio && this.remoteStream) {
            remoteAudio.srcObject = this.remoteStream;
            remoteAudio.play().catch(e => console.error('Remote audio play error:', e));
            console.log('✅ Remote audio set up');
        }

        // Устанавливаем удаленное видео
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
            remoteVideo.play().catch(e => console.error('Remote video play error:', e));
            console.log('✅ Remote video set up');
        }
    }

    getCallContentHTML(isVideoCall, remoteUser) {
        if (this.isScreenSharing) {
            if (isVideoCall) {
                return `
                    <div class="video-call-with-screen-share">
                        <div class="remote-video-container">
                            <video id="remoteVideo" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                            <div class="remote-screen-share-badge">🖥️ Трансляция экрана</div>
                        </div>
                        <div class="local-video-container screen-share-active">
                            <video id="localScreenShare" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
                            <div class="screen-share-badge">🖥️ Ваш экран</div>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="audio-call-with-screen-share">
                        <div class="audio-user-section">
                            <div class="audio-icon">🖥️</div>
                            <div class="audio-user-name">${remoteUser}</div>
                            <div class="audio-call-status">Идет трансляция вашего экрана</div>
                            <audio id="remoteAudio" autoplay style="display: none;"></audio>
                        </div>
                        <div class="screen-share-section">
                            <video id="localScreenShare" autoplay playsinline muted class="screen-share-video"></video>
                            <div class="screen-share-badge">🖥️ Ваш экран</div>
                        </div>
                    </div>
                `;
            }
        } else {
            if (isVideoCall) {
                return `
                    <video id="remoteVideo" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                    <video id="localVideo" autoplay playsinline muted style="
                        position: absolute;
                        bottom: 20px;
                        right: 20px;
                        width: 200px;
                        height: 150px;
                        border: 2px solid white;
                        border-radius: 10px;
                        object-fit: cover;
                    "></video>
                `;
            } else {
                return `
                    <div class="audio-call-container" style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                        height: 100%;
                        color: white;
                    ">
                        <div class="audio-icon" style="font-size: 80px; margin-bottom: 20px;">
                            📞
                        </div>
                        <div class="audio-user-name" style="font-size: 24px; margin-bottom: 10px;">${remoteUser}</div>
                        <div class="audio-call-status" style="font-size: 16px; opacity: 0.8;">
                            Идет разговор...
                        </div>
                        <audio id="remoteAudio" autoplay style="display: none;"></audio>
                    </div>
                `;
            }
        }
    }

    setupCallModalHandlers() {
        const modal = document.getElementById('activeCallModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('mute-btn')) {
                    this.toggleMute();
                } else if (e.target.classList.contains('video-btn')) {
                    this.toggleVideo();
                } else if (e.target.classList.contains('screen-share-btn')) {
                    this.toggleScreenShare();
                } else if (e.target.classList.contains('end-call-btn')) {
                    this.endCall();
                } else if (e.target.classList.contains('minimize-call-btn')) {
                    this.minimizeCall();
                } else if (e.target.classList.contains('fullscreen-call-btn')) {
                    this.toggleFullscreen();
                }
            });
        }
    }

    toggleFullscreen() {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        if (!document.fullscreenElement) {
            if (modal.requestFullscreen) {
                modal.requestFullscreen();
            } else if (modal.webkitRequestFullscreen) {
                modal.webkitRequestFullscreen();
            } else if (modal.msRequestFullscreen) {
                modal.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    endCall() {
        if (!this.currentCall) return;

        if (window.socket) {
            window.socket.emit('end_call', {
                callId: this.currentCall.id,
                reason: 'Call ended by user'
            });
        }

        this.cleanupCall();
        
        const activeModal = document.getElementById('activeCallModal');
        const outgoingModal = document.getElementById('outgoingCallModal');
        const incomingModal = document.getElementById('incomingCallModal');
        
        if (activeModal) activeModal.remove();
        if (outgoingModal) outgoingModal.remove();
        if (incomingModal) incomingModal.remove();
        
        this.showNotification('Звонок завершен', 'info');
    }

    minimizeCall() {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        // Создаем минимизированное окно если его нет
        let minimizedWindow = document.getElementById('minimizedCallWindow');
        
        if (!minimizedWindow) {
            minimizedWindow = document.createElement('div');
            minimizedWindow.id = 'minimizedCallWindow';
            minimizedWindow.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 300px;
                height: 120px;
                background: rgba(0, 0, 0, 0.9);
                border: 2px solid #007bff;
                border-radius: 15px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                color: white;
                overflow: hidden;
                cursor: pointer;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            `;

            const remoteUser = this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller;
            const callType = this.currentCall.type === 'video' ? '📹' : '📞';

            minimizedWindow.innerHTML = `
                <div style="padding: 10px; background: rgba(0,123,255,0.3); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: bold; font-size: 14px;">${callType} ${remoteUser}</div>
                    <div style="display: flex; gap: 5px;">
                        <button class="expand-call-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;" title="Развернуть">⛶</button>
                        <button class="end-call-minimized" style="background: none; border: none; color: #dc3545; cursor: pointer; font-size: 16px;" title="Завершить">✕</button>
                    </div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px;">
                    <div style="font-size: 24px; margin-bottom: 5px;">${callType}</div>
                    <div class="minimized-timer" style="font-size: 16px; font-family: 'Courier New', monospace;">${document.getElementById('callTimer')?.textContent || '00:00'}</div>
                    <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">Нажмите для разворачивания</div>
                </div>
            `;

            document.body.appendChild(minimizedWindow);

            // Обработчики для минимизированного окна
            minimizedWindow.addEventListener('click', (e) => {
                if (!e.target.classList.contains('end-call-minimized') && 
                    !e.target.classList.contains('expand-call-btn')) {
                    this.expandCall();
                }
            });

            const expandBtn = minimizedWindow.querySelector('.expand-call-btn');
            const endBtn = minimizedWindow.querySelector('.end-call-minimized');

            if (expandBtn) {
                expandBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.expandCall();
                });
            }

            if (endBtn) {
                endBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.endCall();
                });
            }
        }

        // Скрываем основное окно
        modal.style.display = 'none';
        
        // Обновляем таймер в минимизированном окне
        this.updateMinimizedTimer();
    }

    expandCall() {
        const modal = document.getElementById('activeCallModal');
        const minimizedWindow = document.getElementById('minimizedCallWindow');
        
        if (modal) {
            modal.style.display = 'flex';
        }
        
        if (minimizedWindow) {
            minimizedWindow.remove();
        }
    }

    updateMinimizedTimer() {
        const minimizedTimer = document.querySelector('.minimized-timer');
        if (minimizedTimer) {
            const mainTimer = document.getElementById('callTimer');
            if (mainTimer) {
                minimizedTimer.textContent = mainTimer.textContent;
            }
        }
    }

    toggleMute() {
        if (!this.localStream) return;

        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const isMuted = !audioTracks[0].enabled;
            audioTracks[0].enabled = isMuted;
            
            const muteBtn = document.querySelector('.mute-btn');
            if (muteBtn) {
                muteBtn.textContent = isMuted ? '🎤' : '🔇';
                muteBtn.style.background = isMuted ? '#6c757d' : '#dc3545';
            }
            
            this.showNotification(isMuted ? 'Микрофон включен' : 'Микрофон выключен', 'info');
        }
    }

    toggleVideo() {
        if (!this.localStream) return;

        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            const isVideoOn = !videoTracks[0].enabled;
            videoTracks[0].enabled = isVideoOn;
            
            const videoBtn = document.querySelector('.video-btn');
            if (videoBtn) {
                videoBtn.textContent = isVideoOn ? '📹' : '📷';
                videoBtn.style.background = isVideoOn ? '#6c757d' : '#dc3545';
            }
            
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.style.display = isVideoOn ? 'block' : 'none';
            }
            
            this.showNotification(isVideoOn ? 'Камера включена' : 'Камера выключена', 'info');
        }
    }

    updateCallInterface() {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        const isVideoCall = this.currentCall.type === 'video';
        const remoteUser = this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller;
        
        // Обновляем заголовок
        const callInfo = modal.querySelector('.call-info');
        if (callInfo) {
            const statusElement = callInfo.querySelector('.screen-share-status');
            if (this.isScreenSharing) {
                if (!statusElement) {
                    const statusDiv = document.createElement('div');
                    statusDiv.style.cssText = 'font-size: 14px; color: #ff6b6b; margin-top: 5px;';
                    statusDiv.className = 'screen-share-status';
                    statusDiv.textContent = '🖥️ Вы транслируете экран';
                    callInfo.appendChild(statusDiv);
                }
            } else if (statusElement) {
                statusElement.remove();
            }
        }

        // Обновляем иконку и статус для аудиозвонков
        if (!isVideoCall) {
            const audioIcon = modal.querySelector('.audio-icon');
            const audioStatus = modal.querySelector('.audio-call-status');
            
            if (audioIcon) {
                audioIcon.textContent = this.isScreenSharing ? '🖥️' : '📞';
            }
            
            if (audioStatus) {
                audioStatus.textContent = this.isScreenSharing ? '🖥️ Идет трансляция экрана...' : 'Идет разговор...';
            }
        }

        // Обновляем кнопку трансляции
        const screenShareBtn = modal.querySelector('.screen-share-btn');
        if (screenShareBtn) {
            if (this.isScreenSharing) {
                screenShareBtn.style.background = '#ff6b6b';
                screenShareBtn.innerHTML = '🖥️';
                screenShareBtn.title = 'Остановить трансляцию';
                screenShareBtn.classList.add('sharing');
            } else {
                screenShareBtn.style.background = '#6f42c1';
                screenShareBtn.innerHTML = '🖥️';
                screenShareBtn.title = 'Начать трансляцию экрана';
                screenShareBtn.classList.remove('sharing');
            }
        }

        console.log('✅ Call interface updated, screen sharing:', this.isScreenSharing);
    }

    startCallTimer() {
        this.callStartTime = Date.now();
        this.callTimer = setInterval(() => {
            const elapsed = Date.now() - this.callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            const timerElement = document.getElementById('callTimer');
            if (timerElement) {
                timerElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            
            // Обновляем таймер в минимизированном окне
            this.updateMinimizedTimer();
            
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }

    cleanupCall() {
        console.log('🧹 Cleaning up call resources');
        
        this.stopCallTimer();
        this.stopOutgoingCallTimer();

        // Останавливаем трансляцию экрана если активна
        if (this.isScreenSharing) {
            this.stopScreenShare();
        }

        // Останавливаем все медиа-потоки с обработкой ошибок
        this.safeStopMediaTracks(this.localStream);
        this.safeStopMediaTracks(this.remoteStream);
        this.safeStopMediaTracks(this.screenStream);
        this.safeStopMediaTracks(this.cameraStream);

        this.localStream = null;
        this.remoteStream = null;
        this.screenStream = null;
        this.cameraStream = null;

        if (this.peerConnection) {
            try {
                this.peerConnection.close();
            } catch (error) {
                console.warn('⚠️ Error closing peer connection:', error);
            }
            this.peerConnection = null;
        }

        this.pendingIceCandidates = [];
        this.isScreenSharing = false;

        // Удаляем модальные окна
        const modals = [
            'incomingCallModal',
            'outgoingCallModal', 
            'activeCallModal'
        ];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.remove();
            }
        });

        this.currentCall = null;
        this.isInitiator = false;
    }

    // Добавляем метод для безопасной остановки устройств
    safeStopMediaTracks(stream) {
        if (!stream) return;
        
        stream.getTracks().forEach(track => {
            try {
                if (track.readyState === 'live') {
                    track.stop();
                }
            } catch (error) {
                console.warn('Error stopping track:', error);
            }
        });
    }
openUserProfile(username) {
    if (!username || username === this.currentUser) return;
    
    console.log('👤 Opening profile for:', username);
    
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
                        <img id="profileAvatarImg" src="/default-avatar.png" alt="${username}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <h4 style="margin: 0 0 5px 0; color: #333;">${username}</h4>
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
}

// Метод для загрузки данных профиля
async loadProfileData(username) {
    try {
        const response = await fetch(`/api/user/${username}`);
        if (response.ok) {
            const userData = await response.json();
            
            // Обновляем аватар
            const avatarImg = document.getElementById('profileAvatarImg');
            if (avatarImg && userData.avatar) {
                avatarImg.src = userData.avatar;
            }
            
            // Обновляем статус онлайн
            const onlineStatus = document.getElementById('profileOnlineStatus');
            const userStatus = document.getElementById('profileUserStatus');
            if (onlineStatus && userStatus) {
                const isOnline = this.onlineUsers.has(username);
                onlineStatus.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
                onlineStatus.style.color = isOnline ? '#28a745' : '#dc3545';
                userStatus.textContent = isOnline ? 'В сети' : 'Не в сети';
            }
            
            // Загружаем баланс
            await this.loadUserBalance(username);
            
        } else {
            throw new Error('User not found');
        }
    } catch (error) {
        console.error('Error loading profile data:', error);
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

// Метод для открытия отправки подарка пользователю
openGiftForUser(username) {
    if (!window.currencyManager) {
        this.showNotification('Система подарков недоступна', 'error');
        return;
    }
    
    // Закрываем профиль
    const profileModal = document.getElementById('userProfileModal');
    if (profileModal) {
        profileModal.remove();
    }
    
    // Открываем магазин подарков с выбранным пользователем
    window.currencyManager.openGiftShop(username);
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
}

class GroupChatManager {
    constructor() {
        this.groups = new Map();
        this.currentGroup = null;
        this.selectedUsers = new Set();
        this.modal = null;
        
        this.displayedMessageIds = new Set();
        this.pendingMessages = new Set();
        
        this.currentGroupAudio = null;
        this.groupChatHandlers = null;
        this.voiceMessageHandler = null;
        
        this.setupSocketListeners();
        console.log('✅ GroupChatManager initialized');
    }

  
 removeDuplicateMessages(messages) {
    const seen = new Set();
    return messages.filter(message => {
        // Создаем уникальный идентификатор для сообщения
        const identifier = message.id || 
                          `${message.sender}_${message.messageType}_${message.timestamp}_${message.fileData?.path}_${message.message?.substring(0, 50)}`;
        
        if (seen.has(identifier)) {
            console.log('🔄 Removing duplicate message:', identifier);
            return false;
        }
        seen.add(identifier);
        return true;
    });
}

removeDuplicateGroups(groups) {
    const seen = new Set();
    return groups.filter(group => {
        const groupId = group.id || group._id;
        if (!groupId || seen.has(groupId)) {
            return false;
        }
        seen.add(groupId);
        return true;
    });
}

  // Исправленный метод formatMessageTime
formatMessageTime(timestamp) {
    if (!timestamp) return 'только что';
    
    try {
        let date;
        
        if (timestamp instanceof Date) {
            date = timestamp;
        } else if (typeof timestamp === 'string') {
            // Убираем лишние символы и пробуем разные форматы
            const cleanTimestamp = timestamp.replace(/[^\d\s:-TZ.]/g, ' ').trim();
            
            // Пробуем стандартный парсинг
            date = new Date(cleanTimestamp);
            
            if (isNaN(date.getTime())) {
                // Пробуем формат времени без даты
                const timeMatch = cleanTimestamp.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
                if (timeMatch) {
                    const now = new Date();
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
                    
                    date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
                    
                    // Если время в будущем, значит это вчера
                    if (date > now) {
                        date.setDate(date.getDate() - 1);
                    }
                } else {
                    return 'только что';
                }
            }
        } else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else {
            return 'только что';
        }
        
        if (isNaN(date.getTime())) {
            return 'только что';
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин назад`;
        if (diffHours < 24) return `${diffHours} ч назад`;
        if (diffDays < 7) return `${diffDays} дн назад`;
        
        // Для дат старше недели
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
        
    } catch (error) {
        console.error('Error formatting message time:', error, timestamp);
        return 'только что';
    }
}

// Также обновим метод для группового чата
formatGroupMessageTime(timestamp) {
    return this.formatMessageTime(timestamp);
}

   // В методе loadUserGroups замените обработку lastMessage
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
                                const sortedMessages = messages.sort((a, b) => {
                                    const timeA = this.getValidTimestamp(a.date || a.timestamp);
                                    const timeB = this.getValidTimestamp(b.date || b.timestamp);
                                    return timeB - timeA;
                                });
                                lastMessage = sortedMessages[0];
                            }
                        }
                    } catch (messageError) {
                        console.log(`📝 No messages for group ${group.id}:`, messageError.message);
                        
                        const localMessages = this.getLocalGroupMessages(group.id);
                        if (localMessages && localMessages.length > 0) {
                            const sortedLocalMessages = localMessages.sort((a, b) => {
                                const timeA = this.getValidTimestamp(a.date || a.timestamp);
                                const timeB = this.getValidTimestamp(b.date || b.timestamp);
                                return timeB - timeA;
                            });
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

// Добавим вспомогательный метод для получения валидного timestamp
getValidTimestamp(timestamp) {
    if (!timestamp) return new Date(0).getTime();
    
    try {
        let date;
        
        if (timestamp instanceof Date) {
            date = timestamp;
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                const cleanTimestamp = timestamp.replace(/[^\d\s:-]/g, '');
                date = new Date(cleanTimestamp);
                if (isNaN(date.getTime())) {
                    return new Date(0).getTime();
                }
            }
        } else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else {
            return new Date(0).getTime();
        }
        
        return date.getTime();
    } catch (error) {
        console.error('Error parsing timestamp:', error);
        return new Date(0).getTime();
    }
}

    // Исправленный метод обработки входящих групповых сообщений
    handleIncomingGroupMessage(data) {
        console.log('📨 Group message received in GroupChatManager:', data);
        
        const messageId = data.id || `${data.sender}_${data.messageType}_${data.timestamp}_${data.fileData?.path}`;
        
        if (this.displayedMessageIds.has(messageId)) {
            console.log('⚠️ Group message already displayed, skipping:', messageId);
            return;
        }
        
        this.displayedMessageIds.add(messageId);
        
        if (this.currentGroup && data.groupId === this.currentGroup.id) {
            console.log('✅ Displaying group message in current group chat');
            this.displayGroupMessage(data, true);
        }
        
        if (data.groupId) {
            this.saveLocalGroupMessage(data.groupId, data);
        }
        
        if (window.privateChatInstance) {
            window.privateChatInstance.loadConversations();
        }
    }

    // Исправленный метод отображения групповых сообщений
    displayGroupMessages(messages) {
        const container = document.getElementById('groupMessages');
        if (!container) return;
        
        container.innerHTML = '';
        this.displayedMessageIds.clear();
        
        const uniqueMessages = this.removeDuplicateMessages(messages);
        
        if (uniqueMessages.length === 0) {
            container.innerHTML = '<div class="no-messages">📝 Начните общение в группе!</div>';
            return;
        }
        
        uniqueMessages.sort((a, b) => new Date(a.date) - new Date(b.date));
        uniqueMessages.forEach(message => {
            if (!message.id) {
                message.id = 'msg_' + new Date(message.date).getTime() + '_' + Math.random().toString(36).substr(2, 5);
            }
            this.displayGroupMessage(message, false);
        });
        this.scrollGroupToBottom();
    }

    displayGroupMessage(message, shouldScroll = true) {
        const container = document.getElementById('groupMessages');
        if (!container) return;
        
        const messageId = message.id || `${message.sender}_${message.messageType}_${message.timestamp}_${message.fileData?.path}`;
        
        if (this.displayedMessageIds.has(messageId)) {
            console.log('⚠️ Group message already displayed, skipping:', messageId);
            return;
        }
        
        this.displayedMessageIds.add(messageId);
        
        const noMessagesElement = container.querySelector('.no-messages');
        if (noMessagesElement) noMessagesElement.remove();
        
        const currentUsername = document.getElementById('username')?.textContent;
        const isOwn = message.sender === currentUsername;
        
        const messageElement = document.createElement('div');
        messageElement.className = `private-message ${isOwn ? 'own' : 'other'}`;
        messageElement.setAttribute('data-message-id', messageId);
        
        if (message.messageType === 'voice') {
            this.displayGroupVoiceMessage(message, isOwn, messageElement);
        } else if (message.messageType === 'file') {
            this.displayGroupFileMessage(message, isOwn, messageElement);
        } else {
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
        
        if (shouldScroll) this.scrollGroupToBottom();
    }

    displayGroupVoiceMessage(message, isOwn, messageElement) {
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
                    
                    <div class="voice-duration" data-original-duration="${durationFormatted}">${durationFormatted}</div>
                    
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

        const container = document.getElementById('groupMessages');
        if (container) {
            container.appendChild(messageElement);
        }
    }

    displayGroupFileMessage(message, isOwn, messageElement) {
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
        }

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

        const container = document.getElementById('groupMessages');
        if (container) {
            container.appendChild(messageElement);
        }
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

    async sendGroupMessage() {
        if (!this.currentGroup) {
            this.showNotification('Выберите группу для отправки сообщения', 'error');
            return;
        }
        
        const input = document.getElementById('groupMessageInput');
        const files = document.getElementById('groupFileInput')?.files;
        
        const message = input?.value.trim();
        const hasFiles = files && files.length > 0;
        
        if (!message && !hasFiles) {
            this.showNotification('Введите сообщение или прикрепите файл', 'error');
            return;
        }

        const sendButton = document.querySelector('#groupChatContainer .send-button');
        if (sendButton) {
            sendButton.disabled = true;
            sendButton.textContent = 'Отправка...';
        }
        
        try {
            let fileData = null;
            
            if (hasFiles) {
                for (let i = 0; i < files.length; i++) {
                    fileData = await this.handleGroupFileUpload(files[i]);
                    if (fileData) {
                        await this.sendGroupMessageViaSocket(message || 'Файл', 'file', fileData);
                    }
                }
                
                const filePreview = document.getElementById('groupFilePreview');
                if (filePreview) {
                    filePreview.innerHTML = '';
                    filePreview.style.display = 'none';
                }
                document.getElementById('groupFileInput').value = '';
            }
            
            if (message && !hasFiles) {
                await this.sendGroupMessageViaSocket(message, 'text', null);
            }
            
            if (input) {
                input.value = '';
            }
            
        } catch (error) {
            console.error('Error sending group message:', error);
            this.showNotification('Ошибка отправки сообщения: ' + error.message, 'error');
        } finally {
            if (sendButton) {
                sendButton.disabled = false;
                sendButton.textContent = 'Отправить';
            }
            if (input) {
                input.focus();
            }
        }
    }

    async sendGroupMessageViaSocket(message, messageType, fileData) {
        if (!this.currentGroup) {
            this.showNotification('Ошибка: группа не выбрана', 'error');
            return;
        }
        
        const currentUser = document.getElementById('username')?.textContent;
        const timestamp = new Date().toLocaleTimeString();
        
        const messageObj = {
            groupId: this.currentGroup.id,
            sender: currentUser,
            message: message,
            messageType: messageType,
            fileData: fileData,
            timestamp: timestamp,
            date: new Date().toISOString(),
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        };
        
        console.log('📤 Sending group message:', messageObj);

        if (this.pendingMessages.has(messageObj.id)) {
            console.log('⚠️ Message already pending, skipping:', messageObj.id);
            return;
        }
        this.pendingMessages.add(messageObj.id);
        
        if (window.socket) {
            window.socket.emit('group_message', messageObj);
        } else {
            console.warn('Socket not available, showing message locally');
            this.displayGroupMessage(messageObj, true);
            this.saveLocalGroupMessage(this.currentGroup.id, messageObj);
        }

        setTimeout(() => {
            this.pendingMessages.delete(messageObj.id);
        }, 3000);
        
        if (window.privateChatInstance) {
            window.privateChatInstance.loadConversations();
        }
    }

    async handleGroupFileUpload(file) {
        if (!this.currentGroup) {
            this.showNotification('Выберите группу для отправки файла', 'error');
            return null;
        }

        return new Promise((resolve) => {
            setTimeout(() => {
                const fakeFileData = {
                    path: URL.createObjectURL(file),
                    originalName: file.name,
                    mimetype: file.type,
                    size: file.size,
                    thumbnail: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
                };
                resolve(fakeFileData);
            }, 500);
        });
    }

    handleGroupFileSelection(files) {
        const filePreview = document.getElementById('groupFilePreview');
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
                this.removeGroupFilePreview(filename);
            });
        });
        
        filePreview.style.display = 'block';
    }

    removeGroupFilePreview(filename) {
        const filePreview = document.getElementById('groupFilePreview');
        if (!filePreview) return;
        
        const fileElement = filePreview.querySelector(`[data-filename="${filename}"]`)?.closest('.file-preview-item');
        if (fileElement) {
            fileElement.remove();
        }
        
        if (filePreview.children.length === 0) {
            filePreview.style.display = 'none';
        }
        
        const fileInput = document.getElementById('groupFileInput');
        if (fileInput) {
            fileInput.value = '';
        }
    }

    scrollGroupToBottom() {
        const groupMessages = document.getElementById('groupMessages');
        if (groupMessages) {
            setTimeout(() => {
                groupMessages.scrollTop = groupMessages.scrollHeight;
            }, 100);
        }
    }

    openGroupVoiceRecordModal() {
        console.log('🎤 Opening voice record modal for group');
        
        if (!this.currentGroup) {
            this.showNotification('Выберите группу для отправки голосового сообщения', 'error');
            return;
        }

        if (window.voiceMessageManager) {
            const originalSendHandler = window.voiceMessageManager.sendVoiceMessage;
            
            window.voiceMessageManager.sendVoiceMessage = async () => {
                if (!window.voiceMessageManager.recordedBlob) {
                    window.voiceMessageManager.showError('Нет записанного сообщения');
                    return;
                }

                const duration = Date.now() - window.voiceMessageManager.recordingStartTime;
                if (duration < 1000) {
                    window.voiceMessageManager.showError('Сообщение слишком короткое (минимум 1 секунда)');
                    return;
                }

                try {
                    const formData = new FormData();
                    const filename = `group_voice_${Date.now()}.webm`;
                    
                    const voiceFile = new File([window.voiceMessageManager.recordedBlob], filename, {
                        type: 'audio/webm'
                    });
                    
                    formData.append('file', voiceFile);

                    console.log('Uploading group voice message...');

                    const response = await fetch('/api/upload-voice', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error(`Upload failed: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    
                    if (!result.success) {
                        throw new Error(result.error || 'Upload failed');
                    }
                    
                    await this.sendGroupVoiceMessage(result.file, duration);
                    
                } catch (error) {
                    console.error('Error sending group voice message:', error);
                    window.voiceMessageManager.showError('Ошибка отправки голосового сообщения: ' + error.message);
                } finally {
                    window.voiceMessageManager.sendVoiceMessage = originalSendHandler;
                }
            };
            
            window.voiceMessageManager.handleVoiceButtonClick(document.querySelector('.group-voice-message-btn'));
        }
    }

    async sendGroupVoiceMessage(fileData, duration) {
        if (!this.currentGroup) {
            this.showNotification('Ошибка: группа не выбрана', 'error');
            return;
        }

        const currentUser = document.getElementById('username')?.textContent;
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const messageData = {
            groupId: this.currentGroup.id,
            sender: currentUser,
            message: 'Голосовое сообщение',
            messageType: 'voice',
            fileData: {
                ...fileData,
                duration: duration,
                type: 'voice'
            },
            timestamp: new Date().toLocaleTimeString(),
            date: new Date().toISOString(),
            id: messageId
        };

        console.log('📤 Sending group voice message:', messageData);

        if (this.pendingMessages.has(messageId)) {
            console.log('⚠️ Voice message already pending, skipping:', messageId);
            return;
        }
        
        this.pendingMessages.add(messageId);

        this.displayedMessageIds.add(messageId);
        this.displayGroupMessage(messageData, true);

        if (window.socket) {
            window.socket.emit('group_message', messageData);
        } else {
            console.warn('Socket not available, saving message locally');
            this.saveLocalGroupMessage(this.currentGroup.id, messageData);
        }

        setTimeout(() => {
            this.pendingMessages.delete(messageId);
        }, 5000);
        
        if (window.privateChatInstance) {
            window.privateChatInstance.loadConversations();
        }
    }
    setupSocketListeners() {
        if (!window.socket) return;
        
        window.socket.on('group_message', (data) => {
            console.log('📨 Group message received:', data);
            this.handleIncomingGroupMessage(data);
        });

        window.socket.on('group_created', (data) => {
            console.log('👥 Group created event:', data);
            this.handleGroupCreated(data);
            if (window.privateChatInstance) {
                window.privateChatInstance.loadConversations();
            }
        });

        window.socket.on('group_updated', (data) => {
            console.log('👥 Group updated event:', data);
            if (this.currentGroup && this.currentGroup.id === data.groupId) {
                this.currentGroup = { ...this.currentGroup, ...data.groupData };
            }
            if (window.privateChatInstance) {
                window.privateChatInstance.loadConversations();
            }
        });

        window.socket.on('user_added_to_group', (data) => {
            console.log('👥 User added to group:', data);
            const currentUser = document.getElementById('username')?.textContent;
            if (currentUser && data.members && data.members.includes(currentUser)) {
                this.showNotification(`Вас добавили в группу "${data.groupName}"`, 'info');
                if (window.privateChatInstance) {
                    window.privateChatInstance.loadConversations();
                }
            }
        });

        window.socket.on('user_removed_from_group', (data) => {
            console.log('👥 User removed from group:', data);
            const currentUser = document.getElementById('username')?.textContent;
            if (currentUser && data.removedUser === currentUser) {
                this.showNotification(`Вас удалили из группы "${data.groupName}"`, 'warning');
                if (this.currentGroup && this.currentGroup.id === data.groupId) {
                    this.closeGroupChat();
                }
                if (window.privateChatInstance) {
                    window.privateChatInstance.loadConversations();
                }
            }
        });
    }

    // Настройка делегирования событий для голосовых сообщений
    setupGroupEventDelegation() {
        const container = document.getElementById('groupMessages');
        if (!container) return;

        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('play-voice-btn') || 
                e.target.closest('.play-voice-btn')) {
                const button = e.target.classList.contains('play-voice-btn') ? 
                              e.target : e.target.closest('.play-voice-btn');
                this.handleGroupVoicePlay(button);
            }
        });
    }

    // Обработка воспроизведения голосовых сообщений
    handleGroupVoicePlay(button) {
        const audioUrl = button.getAttribute('data-audio-url');
        const player = button.closest('.voice-message-player');
        const durationDisplay = player?.querySelector('.voice-duration');
        
        if (!audioUrl) {
            console.error('❌ No audio URL found for voice message');
            return;
        }

        if (button.classList.contains('playing')) {
            this.stopGroupVoicePlayback(button);
            return;
        }

        if (this.currentGroupAudio) {
            this.stopAllGroupVoicePlayback();
        }

        this.currentGroupAudio = new Audio(audioUrl);
        
        const progressBar = player?.querySelector('.voice-progress');

        this.currentGroupAudio.addEventListener('loadedmetadata', () => {
            button.classList.add('playing');
            button.innerHTML = '⏸️';
            console.log('✅ Group voice message loaded');
        });

        this.currentGroupAudio.addEventListener('timeupdate', () => {
            if (progressBar && this.currentGroupAudio) {
                const progress = (this.currentGroupAudio.currentTime / this.currentGroupAudio.duration) * 100;
                progressBar.style.width = `${progress}%`;
                
                if (durationDisplay) {
                    const currentTime = Math.floor(this.currentGroupAudio.currentTime);
                    const totalTime = Math.floor(this.currentGroupAudio.duration);
                    durationDisplay.textContent = 
                        `${Math.floor(currentTime / 60)}:${(currentTime % 60).toString().padStart(2, '0')}`;
                }
            }
        });

        this.currentGroupAudio.addEventListener('ended', () => {
            this.stopGroupVoicePlayback(button);
        });

        this.currentGroupAudio.addEventListener('error', (error) => {
            console.error('❌ Error playing group voice message:', error);
            this.stopGroupVoicePlayback(button);
            this.showNotification('Ошибка воспроизведения голосового сообщения', 'error');
        });

        this.currentGroupAudio.play().catch(error => {
            console.error('❌ Playback failed:', error);
            this.showNotification('Не удалось воспроизвести голосовое сообщение', 'error');
        });
    }

    stopGroupVoicePlayback(button) {
        if (this.currentGroupAudio) {
            this.currentGroupAudio.pause();
            this.currentGroupAudio = null;
        }
        
        if (button) {
            button.classList.remove('playing');
            button.innerHTML = '▶️';
            
            const player = button.closest('.voice-message-player');
            const progressBar = player?.querySelector('.voice-progress');
            const durationDisplay = player?.querySelector('.voice-duration');
            
            if (progressBar) {
                progressBar.style.width = '0%';
            }
            
            if (durationDisplay) {
                const durationText = durationDisplay.getAttribute('data-original-duration');
                if (durationText) {
                    durationDisplay.textContent = durationText;
                }
            }
        }
    }

    stopAllGroupVoicePlayback() {
        const playingButtons = document.querySelectorAll('#groupMessages .play-voice-btn.playing');
        playingButtons.forEach(button => {
            this.stopGroupVoicePlayback(button);
        });
    }

    async loadGroupMessages(groupId) {
        try {
            let messages = [];
            
            try {
                const response = await fetch(`/api/groups/${groupId}/messages`);
                if (response.ok) {
                    messages = await response.json();
                    console.log(`✅ Messages loaded for group ${groupId}:`, messages.length);
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (apiError) {
                console.log('⚠️ Using local messages:', apiError.message);
                messages = this.getLocalGroupMessages(groupId);
            }
            
            const uniqueMessages = this.removeDuplicateMessages(messages);
            this.displayGroupMessages(uniqueMessages);
            
        } catch (error) {
            console.error('Error loading group messages:', error);
            const container = document.getElementById('groupMessages');
            if (container) {
                container.innerHTML = '<div class="no-messages">❌ Ошибка загрузки сообщений</div>';
            }
        }
    }

    saveLocalGroupMessage(groupId, message) {
        const localMessages = JSON.parse(localStorage.getItem('groupMessages') || '{}');
        if (!localMessages[groupId]) {
            localMessages[groupId] = [];
        }
        
        const messageId = message.id || `${message.sender}_${message.messageType}_${message.timestamp}_${message.fileData?.path}`;
        
        const isDuplicate = localMessages[groupId].some(msg => {
            const existingId = msg.id || `${msg.sender}_${msg.messageType}_${msg.timestamp}_${msg.fileData?.path}`;
            return existingId === messageId;
        });
        
        if (!isDuplicate) {
            localMessages[groupId].push(message);
            localStorage.setItem('groupMessages', JSON.stringify(localMessages));
            console.log('💾 Group message saved locally:', messageId);
        } else {
            console.log('⚠️ Duplicate group message detected, not saving locally:', messageId);
        }
    }

    getLocalGroupMessages(groupId) {
        const localMessages = JSON.parse(localStorage.getItem('groupMessages') || '{}');
        return localMessages[groupId] || [];
    }

    getFileTypeText(mimeType, filename) {
        const extension = filename.split('.').pop().toLowerCase();
        
        if (mimeType.startsWith('image/')) return 'Картинка';
        else if (mimeType.startsWith('audio/')) return 'Аудио';
        else if (mimeType.startsWith('video/')) return 'Видео';
        else if (mimeType.includes('pdf')) return 'PDF документ';
        else if (mimeType.includes('word') || mimeType.includes('document') || 
                 ['.doc', '.docx'].includes('.' + extension)) return 'Word документ';
        else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive') ||
                 ['.zip', '.rar', '.7z'].includes('.' + extension)) return 'Архив';
        else if (mimeType.includes('text') || ['.txt'].includes('.' + extension)) return 'Текстовый файл';
        else return 'Документ';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showCreateGroupModal() {
        console.log('Opening create group modal...');
        
        let modal = document.getElementById('createGroupModal');
        
        if (modal) {
            console.log('Modal already exists, showing it');
            modal.style.display = 'flex';
            this.modal = modal;
            this.loadAvailableUsers();
            return;
        }
        
        modal = document.createElement('div');
        modal.id = 'createGroupModal';
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
                width: 600px;
                max-width: 95%;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
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

        document.body.appendChild(modal);
        this.modal = modal;
        this.setupGroupModalEvents();
        this.loadAvailableUsers();
    }

    setupGroupModalEvents() {
        const closeBtn = this.modal.querySelector('.close-modal');
        const createBtn = this.modal.querySelector('#createGroupBtn');
        
        const closeModal = () => {
            if (this.modal) {
                this.modal.style.display = 'none';
            }
            this.selectedUsers.clear();
        };
        
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            });
        }
        
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                closeModal();
            }
        });
        
        const modalContent = this.modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        if (createBtn) {
            createBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.createGroup();
            });
        }
        
        document.addEventListener('keydown', handleEscKey);
        
        const groupNameInput = this.modal.querySelector('#groupName');
        if (groupNameInput) {
            setTimeout(() => {
                groupNameInput.focus();
            }, 100);
        }
    }

 async loadAvailableUsers() {
    try {
        const container = document.getElementById('availableUsers');
        if (!container) {
            console.error('❌ Available users container not found');
            return;
        }

        container.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: #666;">Загрузка пользователей...</div>';

        // Создаем таймаут для fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут

        try {
            const response = await fetch('/api/users/all', {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const users = await response.json();
                this.displayAvailableUsers(users);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            if (fetchError.name === 'AbortError') {
                console.log('⚠️ Fetch timeout, using test users');
                this.useTestUsers();
            } else {
                throw fetchError;
            }
        }
        
    } catch (error) {
        console.error('❌ Error loading users:', error);
        this.useTestUsers(); // Всегда используем тестовых пользователей при ошибке
    }
}

    createTestUsers() {
        const testUsers = [
            { username: 'user1', isOnline: true },
            { username: 'user2', isOnline: false },
            { username: 'user3', isOnline: true },
            { username: 'alice', isOnline: true },
            { username: 'bob', isOnline: false },
            { username: 'charlie', isOnline: true }
        ];
        
        const moreUsers = ['david', 'eve', 'frank', 'grace', 'henry', 'ivan', 'julia', 'kevin'];
        moreUsers.forEach(username => {
            testUsers.push({
                username: username,
                isOnline: Math.random() > 0.5
            });
        });
        
        return testUsers;
    }

    async loadUsersFromServer() {
        const endpoints = [
            '/api/users/all',
            '/api/users', 
            '/users',
            '/api/users/online',
            '/api/chat/users'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Trying endpoint: ${endpoint}`);
                const response = await fetch(endpoint);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`✅ Success from ${endpoint}:`, data);
                    
                    if (Array.isArray(data)) {
                        return data.map(user => {
                            if (typeof user === 'string') {
                                return { username: user, isOnline: true };
                            }
                            return {
                                username: user.username || user.name || user.login,
                                isOnline: user.isOnline !== undefined ? user.isOnline : 
                                         user.online !== undefined ? user.online :
                                         user.status === 'online'
                            };
                        }).filter(user => user.username);
                    }
                    
                    return data;
                } else {
                    console.log(`❌ ${endpoint} returned ${response.status}`);
                }
            } catch (error) {
                console.log(`❌ ${endpoint} failed:`, error.message);
            }
        }
        
        throw new Error('Все эндпоинты недоступны');
    }

    displayAvailableUsers(users) {
        const container = document.getElementById('availableUsers');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!users || users.length === 0) {
            container.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: #666; font-style: italic; background: #f8f9fa; border-radius: 8px; border: 1px dashed #dee2e6;">
                    Нет доступных пользователей
                </div>
            `;
            return;
        }
        
        const currentUser = document.getElementById('username')?.textContent || 'admin';
        console.log('👤 Current user:', currentUser);
        console.log('📊 Total users received:', users.length);
        
        let displayedUsers = 0;
        
        users.forEach(user => {
            if (!user || !user.username) {
                console.log('⚠️ Skipping invalid user:', user);
                return;
            }
            
            if (user.username === currentUser) {
                console.log('⏩ Skipping current user:', user.username);
                return;
            }
            
            displayedUsers++;
            
            const userElement = document.createElement('div');
            userElement.className = 'user-select-item';
            userElement.style.cssText = `
                padding: 15px;
                border: 1px solid #f0f0f0;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                background: white;
                margin-bottom: 5px;
            `;
            
            userElement.addEventListener('mouseenter', () => {
                userElement.style.background = '#f8f9fa';
                userElement.style.borderColor = '#007bff';
            });
            
            userElement.addEventListener('mouseleave', () => {
                userElement.style.background = 'white';
                userElement.style.borderColor = '#f0f0f0';
            });
            
            const isOnline = user.isOnline === true || user.online === true || user.status === 'online';
            const statusClass = isOnline ? 'online' : 'offline';
            const statusText = isOnline ? 'online' : 'offline';
            const statusColor = isOnline ? '#28a745' : '#6c757d';
            const statusBg = isOnline ? '#d4edda' : '#e2e3e5';
            
            userElement.innerHTML = `
                <input type="checkbox" value="${user.username}" style="margin-right: 15px; transform: scale(1.3); cursor: pointer;">
                <span class="user-avatar" style="margin-right: 12px; font-size: 18px; width: 32px; height: 32px; background: linear-gradient(45deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">👤</span>
                <span class="user-name" style="flex: 1; font-size: 15px; font-weight: 500; color: #2c3e50;">${user.username}</span>
                <span class="user-status ${statusClass}" style="font-size: 12px; padding: 4px 10px; border-radius: 12px; font-weight: 500; flex-shrink: 0; background: ${statusBg}; color: ${statusColor}; border: 1px solid ${isOnline ? '#c3e6cb' : '#d6d8db'};">${statusText}</span>
            `;
            
            const checkbox = userElement.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleUserSelection(user.username, checkbox.checked);
            });
            
            userElement.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.toggleUserSelection(user.username, checkbox.checked);
                }
            });
            
            container.appendChild(userElement);
        });
        
        console.log(`✅ Displayed ${displayedUsers} users in the list`);
        
        if (displayedUsers === 0) {
            container.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: #666;">
                    <div>Только вы в системе</div>
                    <div style="font-size: 12px; margin-top: 5px;">Других пользователей не найдено</div>
                </div>
            `;
        }
    }

    showAvailableUsersError(errorMessage) {
        const container = document.getElementById('availableUsers');
        if (!container) return;
        
        container.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: #dc3545;">
                <div style="font-size: 18px; margin-bottom: 10px;">❌ Ошибка загрузки пользователей</div>
                <div style="font-size: 14px; margin-bottom: 15px; color: #666;">${errorMessage}</div>
                <button onclick="window.groupChatManager.loadAvailableUsers()" 
                        style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    🔄 Повторить попытку
                </button>
                <div style="margin-top: 10px;">
                    <button onclick="window.groupChatManager.useTestUsers()" 
                            style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">
                        Использовать тестовых пользователей
                    </button>
                </div>
            </div>
        `;
    }

    useTestUsers() {
        console.log('🔄 Loading test users...');
        const testUsers = this.createTestUsers();
        this.displayAvailableUsers(testUsers);
    }

    toggleUserSelection(username, selected) {
        console.log(`👤 User ${username} ${selected ? 'selected' : 'deselected'}`);
        
        if (selected) {
            this.selectedUsers.add(username);
        } else {
            this.selectedUsers.delete(username);
        }
        
        this.updateSelectedUsersDisplay();
        this.updateCheckboxes();
    }

    removeUserSelection(username) {
        console.log(`🗑️ Removing user from selection: ${username}`);
        this.selectedUsers.delete(username);
        this.updateSelectedUsersDisplay();
        this.updateCheckboxes();
    }

    updateSelectedUsersDisplay() {
        const selectedContainer = document.getElementById('selectedUsers');
        if (!selectedContainer) return;
        
        selectedContainer.innerHTML = '';
        
        if (this.selectedUsers.size === 0) {
            selectedContainer.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">Пользователи не выбраны</div>';
            return;
        }
        
        console.log(`📋 Displaying ${this.selectedUsers.size} selected users`);
        
        this.selectedUsers.forEach(username => {
            const badge = document.createElement('div');
            badge.className = 'selected-user-badge';
            badge.style.cssText = `
                display: inline-flex;
                align-items: center;
                background: linear-gradient(45deg, #28a745, #20c997);
                color: white;
                padding: 8px 15px;
                border-radius: 20px;
                margin: 2px;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s ease;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            `;
            
            badge.innerHTML = `
                👤 ${username}
                <span class="remove-user" data-username="${username}" style="margin-left: 10px; cursor: pointer; font-weight: bold; opacity: 0.9; background: rgba(255,255,255,0.2); border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 12px;">✕</span>
            `;
            
            const removeBtn = badge.querySelector('.remove-user');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeUserSelection(username);
            });
            
            selectedContainer.appendChild(badge);
        });
    }

    updateCheckboxes() {
        const checkboxes = document.querySelectorAll('#availableUsers input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.selectedUsers.has(checkbox.value);
        });
    }

    async createGroup() {
        console.log('🚀 Creating group...');
        
        const groupNameInput = document.getElementById('groupName');
        if (!groupNameInput) {
            this.showNotification('Ошибка: поле названия группы не найдено', 'error');
            return;
        }
        
        const groupName = groupNameInput.value.trim();
        console.log('📝 Group name:', groupName);

        if (!groupName) {
            this.showNotification('Введите название группы', 'error');
            groupNameInput.focus();
            return;
        }

        if (this.selectedUsers.size === 0) {
            this.showNotification('Выберите хотя бы одного участника', 'error');
            return;
        }

        console.log(`👥 Selected users: ${Array.from(this.selectedUsers).join(', ')}`);

        try {
            const currentUser = document.getElementById('username')?.textContent || 'admin';
            const allMembers = [currentUser, ...Array.from(this.selectedUsers)];
            
            console.log('📦 Sending group creation request:', {
                name: groupName,
                members: allMembers,
                createdBy: currentUser
            });

            let groupId;
            try {
                const response = await fetch('/api/groups/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: groupName,
                        members: allMembers,
                        createdBy: currentUser
                    })
                });

                console.log('📨 Response status:', response.status);

                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Group created via API:', result);
                    groupId = result.groupId || result.id;
                } else {
                    throw new Error(`API returned ${response.status}`);
                }
            } catch (apiError) {
                console.log('⚠️ API failed, creating local group:', apiError.message);
                groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                if (window.socket) {
                    window.socket.emit('group_created', {
                        group: {
                            id: groupId,
                            name: groupName,
                            members: allMembers,
                            createdBy: currentUser,
                            createdAt: new Date().toISOString()
                        }
                    });
                }
            }

            if (this.modal) {
                this.modal.style.display = 'none';
            }
            this.selectedUsers.clear();
            
            if (groupNameInput) {
                groupNameInput.value = '';
            }
            
            this.showNotification(`Группа "${groupName}" создана успешно!`, 'success');
            
            if (window.privateChatInstance) {
                await window.privateChatInstance.loadConversations();
            }
            
        } catch (error) {
            console.error('❌ Error creating group:', error);
            this.showNotification('Ошибка создания группы: ' + error.message, 'error');
        }
    }

    async openGroupChat(group) {
        this.currentGroup = group;
        
        this.displayedMessageIds.clear();
        this.pendingMessages.clear();
        
        this.removeGroupChatEventListeners();
        
        if (window.privateChatInstance?.currentChat) {
            window.privateChatInstance.closeCurrentChat();
        }
        
        const noChatSelected = document.getElementById('noChatSelected');
        const activeChat = document.getElementById('activeChat');
        
        if (noChatSelected) noChatSelected.style.display = 'none';
        if (activeChat) activeChat.style.display = 'none';
        
        let groupChatContainer = document.getElementById('groupChatContainer');
        if (!groupChatContainer) {
            groupChatContainer = document.createElement('div');
            groupChatContainer.id = 'groupChatContainer';
            groupChatContainer.className = 'active-chat';
            document.querySelector('.private-chat-main').appendChild(groupChatContainer);
        }
        
        const groupInfo = await this.getGroupInfo(group.id);
        const memberCount = groupInfo?.members?.length || group.members?.length || 0;
        
        groupChatContainer.style.display = 'flex';
        groupChatContainer.innerHTML = `
            <div class="chat-top-bar">
                <div class="chat-user-info">
                    <span class="user-avatar">👥</span>
                    <div class="user-details">
                        <h4>${group.name}</h4>
                        <span class="user-status group">Групповой чат • ${memberCount} участников</span>
                    </div>
                </div>
                <div class="chat-controls">
                    <button class="close-chat" title="Закрыть чат">✕</button>
                </div>
            </div>
            
            <div class="chat-messages-container">
                <div id="groupMessages" class="private-messages">
                    <div class="no-messages">📝 Загрузка сообщений...</div>
                </div>
            </div>
            
            <div class="message-input-area">
                <div class="message-input-container">
                    <input type="text" id="groupMessageInput" placeholder="Напишите сообщение в группу..." autocomplete="off">
                    <button type="button" class="emoji-picker-btn" title="Выбрать смайлик">😊</button>
                    <button type="button" class="group-voice-message-btn" title="Записать голосовое сообщение">🎤</button>
                    <button type="button" class="attach-file" title="Прикрепить файл">📎</button>
                    <button type="button" class="send-button">Отправить</button>
                    <input type="file" id="groupFileInput" style="display: none;" 
                           accept="image/*,.pdf,.doc,.docx,.txt,.zip,.mp3,.wav,.mp4,.mov"
                           multiple>
                </div>
                <div id="groupEmojiPicker" class="emoji-picker"></div>
                <div id="groupFilePreview" class="file-preview-container"></div>
            </div>
        `;
        
        this.setupGroupChatEventListeners(groupChatContainer);
        this.setupGroupEmojiPicker();
        this.setupGroupEventDelegation();
        await this.loadGroupMessages(group.id);
    }

    setupGroupChatEventListeners(container) {
        this.removeGroupChatEventListeners();
        
        const closeBtn = container.querySelector('.close-chat');
        const messageInput = container.querySelector('#groupMessageInput');
        const attachBtn = container.querySelector('.attach-file');
        const fileInput = container.querySelector('#groupFileInput');
        const sendButton = container.querySelector('.send-button');
        const emojiPickerBtn = container.querySelector('.emoji-picker-btn');
        const voiceBtn = container.querySelector('.group-voice-message-btn');
        
        this.groupChatHandlers = {
            closeChat: () => this.closeGroupChat(),
            sendMessage: () => this.sendGroupMessage(),
            keypressMessage: (e) => {
                if (e.key === 'Enter') this.sendGroupMessage();
            },
            attachFile: () => {
                console.log('Attach file clicked - opening file dialog');
                if (fileInput) {
                    fileInput.click();
                }
            },
            fileInputChange: (e) => {
                console.log('File input changed:', e.target.files.length);
                if (e.target.files.length > 0) {
                    this.handleGroupFileSelection(Array.from(e.target.files));
                }
            },
            toggleEmojiPicker: () => this.toggleGroupEmojiPicker(),
            openVoiceModal: (e) => {
                console.log('🎤 Voice button clicked in group chat');
                e.preventDefault();
                e.stopPropagation();
                this.openGroupVoiceRecordModal();
            }
        };
        
        if (closeBtn) closeBtn.addEventListener('click', this.groupChatHandlers.closeChat);
        if (sendButton) sendButton.addEventListener('click', this.groupChatHandlers.sendMessage);
        if (messageInput) messageInput.addEventListener('keypress', this.groupChatHandlers.keypressMessage);
        if (attachBtn) attachBtn.addEventListener('click', this.groupChatHandlers.attachFile);
        if (fileInput) fileInput.addEventListener('change', this.groupChatHandlers.fileInputChange);
        if (emojiPickerBtn) emojiPickerBtn.addEventListener('click', this.groupChatHandlers.toggleEmojiPicker);
        if (voiceBtn) {
            voiceBtn.replaceWith(voiceBtn.cloneNode(true));
            const newVoiceBtn = container.querySelector('.group-voice-message-btn');
            newVoiceBtn.addEventListener('click', this.groupChatHandlers.openVoiceModal);
        }
        
        console.log('Group chat event listeners setup completed');
    }

    removeGroupChatEventListeners() {
        const container = document.getElementById('groupChatContainer');
        if (!container || !this.groupChatHandlers) return;
        
        const closeBtn = container.querySelector('.close-chat');
        const messageInput = container.querySelector('#groupMessageInput');
        const attachBtn = container.querySelector('.attach-file');
        const fileInput = container.querySelector('#groupFileInput');
        const sendButton = container.querySelector('.send-button');
        const emojiPickerBtn = container.querySelector('.emoji-picker-btn');
        const voiceBtn = container.querySelector('.group-voice-message-btn');
        
        if (closeBtn) closeBtn.removeEventListener('click', this.groupChatHandlers.closeChat);
        if (sendButton) sendButton.removeEventListener('click', this.groupChatHandlers.sendMessage);
        if (messageInput) messageInput.removeEventListener('keypress', this.groupChatHandlers.keypressMessage);
        if (attachBtn) attachBtn.removeEventListener('click', this.groupChatHandlers.attachFile);
        if (fileInput) fileInput.removeEventListener('change', this.groupChatHandlers.fileInputChange);
        if (emojiPickerBtn) emojiPickerBtn.removeEventListener('click', this.groupChatHandlers.toggleEmojiPicker);
        if (voiceBtn) {
            voiceBtn.removeEventListener('click', this.groupChatHandlers.openVoiceModal);
        }
        
        this.groupChatHandlers = null;
        console.log('Group chat event listeners removed');
    }

    setupGroupEmojiPicker() {
        const emojiPicker = document.getElementById('groupEmojiPicker');
        if (!emojiPicker) return;
        
        const emojiCategories = {
            "😊 Люди": ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠"],
            "🐶 Животные": ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷", "🕸", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐕‍🦺", "🐈", "🐓", "🦃", "🦚", "🦜", "🦢", "🦩", "🐇", "🦝", "🦨", "🦡", "🦦", "🦥", "🐁", "🐀", "🐿", "🦔"]
        };

        let emojiPickerHTML = '<div class="emoji-picker-header">Выберите смайлик</div>';
        
        for (const [category, emojis] of Object.entries(emojiCategories)) {
            emojiPickerHTML += `<div class="emoji-category">
                <div class="emoji-category-title">${category}</div>
                <div class="emoji-list">`;
            
            emojis.forEach(emoji => {
                emojiPickerHTML += `<span class="emoji" data-emoji="${emoji}">${emoji}</span>`;
            });
            
            emojiPickerHTML += '</div></div>';
        }
        
        emojiPicker.innerHTML = emojiPickerHTML;
        
        const emojiElements = emojiPicker.querySelectorAll('.emoji');
        emojiElements.forEach(emojiEl => {
            emojiEl.addEventListener('click', () => {
                const emoji = emojiEl.getAttribute('data-emoji');
                this.insertGroupEmoji(emoji);
            });
        });
        
        document.addEventListener('click', (e) => {
            if (!emojiPicker.contains(e.target) && !e.target.classList.contains('emoji-picker-btn')) {
                emojiPicker.style.display = 'none';
            }
        });
    }

    toggleGroupEmojiPicker() {
        const emojiPicker = document.getElementById('groupEmojiPicker');
        if (!emojiPicker) return;
        
        if (emojiPicker.style.display === 'block') {
            emojiPicker.style.display = 'none';
        } else {
            emojiPicker.style.display = 'block';
            const messageInput = document.getElementById('groupMessageInput');
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

    insertGroupEmoji(emoji) {
        const messageInput = document.getElementById('groupMessageInput');
        if (messageInput) {
            const start = messageInput.selectionStart;
            const end = messageInput.selectionEnd;
            const text = messageInput.value;
            messageInput.value = text.substring(0, start) + emoji + text.substring(end);
            messageInput.focus();
            messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
        }
        
        const emojiPicker = document.getElementById('groupEmojiPicker');
        if (emojiPicker) {
            emojiPicker.style.display = 'none';
        }
    }

    async getGroupInfo(groupId) {
        try {
            const response = await fetch(`/api/groups/${groupId}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error loading group info:', error);
        }
        return null;
    }

    closeGroupChat() {
        this.stopAllGroupVoicePlayback();
        this.removeGroupChatEventListeners();
        
        this.currentGroup = null;
        const groupChatContainer = document.getElementById('groupChatContainer');
        if (groupChatContainer) {
            groupChatContainer.style.display = 'none';
        }
        
        const noChatSelected = document.getElementById('noChatSelected');
        if (noChatSelected && !window.privateChatInstance?.currentChat) {
            noChatSelected.style.display = 'flex';
        }
    }

    handleGroupCreated(data) {
        console.log('🔄 Handling group creation:', data);
        
        if (data.group) {
            this.saveLocalGroup(data.group);
        }
        
        this.showNotification(`Группа "${data.group?.name}" создана`, 'success');
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

    saveLocalGroup(group) {
        try {
            const localGroups = this.getLocalGroups();
            
            const existingIndex = localGroups.findIndex(g => g.id === group.id);
            if (existingIndex >= 0) {
                localGroups[existingIndex] = group;
            } else {
                localGroups.push(group);
            }
            
            localStorage.setItem('localGroups', JSON.stringify(localGroups));
            console.log('💾 Group saved locally:', group.name);
        } catch (error) {
            console.error('Error saving local group:', error);
        }
    }

    forceRefreshGroupChat() {
        if (this.currentGroup) {
            console.log('🔄 Force refreshing group chat...');
            this.loadGroupMessages(this.currentGroup.id);
        }
    }
}

class VoiceMessageManager {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingStartTime = 0;
        this.recordingTimer = null;
        this.recordedBlob = null;
        this.holdTimer = null;
        this.isHolding = false;
        this.maxRecordingTime = 60000;
        this.minRecordingTime = 1000;
        this.recordingIndicator = null;
        this.lockRecording = false;
        
        this.init();
    }

    init() {
        this.createRecordingIndicator();
        this.setupVoiceMessageButton();
        this.setupGlobalEventListeners();
    }

    setupVoiceMessageButton() {
        // Обработчик для кнопок голосовых сообщений
        document.addEventListener('click', (e) => {
            const voiceBtn = e.target.closest('.voice-message-btn') || 
                           e.target.closest('.group-voice-message-btn');
            if (voiceBtn) {
                e.preventDefault();
                e.stopPropagation();
                this.handleVoiceButtonClick(voiceBtn);
            }
        });
    }

    handleVoiceButtonClick(button) {
        if (this.isRecording) {
            this.stopRecording();
            return;
        }

        // Добавляем класс активации для визуальной обратной связи
        button.classList.add('voice-btn-active');
        
        // Начинаем слушать события мыши/тача
        this.startListeningForHold(button);
    }

    startListeningForHold(button) {
        const endHold = (e) => {
            // Предотвращаем стандартное поведение для тача
            if (e.type === 'touchend') {
                e.preventDefault();
            }
            this.endHold();
            button.classList.remove('voice-btn-active');
            this.removeHoldListeners();
        };

        const cancelHold = (e) => {
            if (this.isHolding && !this.isRecording) {
                this.showNotification('Запись отменена', 'info');
            }
            this.endHold();
            button.classList.remove('voice-btn-active');
            this.removeHoldListeners();
        };

        // Добавляем обработчики для удержания
        document.addEventListener('mouseup', endHold);
        document.addEventListener('touchend', endHold, { passive: false });
        document.addEventListener('mouseleave', cancelHold);
        document.addEventListener('touchcancel', cancelHold);

        // Сохраняем ссылки для удаления
        this.currentHoldListeners = { endHold, cancelHold };
        this.currentButton = button;

        // Начинаем отсчет удержания
        this.startHold();
    }

    removeHoldListeners() {
        if (this.currentHoldListeners) {
            document.removeEventListener('mouseup', this.currentHoldListeners.endHold);
            document.removeEventListener('touchend', this.currentHoldListeners.endHold);
            document.removeEventListener('mouseleave', this.currentHoldListeners.cancelHold);
            document.removeEventListener('touchcancel', this.currentHoldListeners.cancelHold);
            this.currentHoldListeners = null;
        }
        
        if (this.currentButton) {
            this.currentButton.classList.remove('voice-btn-active');
            this.currentButton = null;
        }
    }

    startHold() {
        if (this.isRecording) return;

        this.isHolding = true;
        
        // Задержка перед началом записи
        this.holdTimer = setTimeout(() => {
            if (this.isHolding) {
                this.startRecording();
            }
        }, 300);
    }

    endHold() {
        this.isHolding = false;
        
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }

        if (this.isRecording) {
            this.stopRecording();
        }
        
        this.removeHoldListeners();
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 44100
                } 
            });

            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.handleRecordingComplete();
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            this.showRecordingIndicator();
            this.startRecordingTimer();

            // Обновляем кнопку
            if (this.currentButton) {
                this.currentButton.classList.add('voice-recording');
                this.currentButton.classList.remove('voice-btn-active');
            }

        } catch (error) {
            console.error('Recording error:', error);
            this.showError('Ошибка доступа к микрофону');
            this.endHold();
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.stopRecordingTimer();
            this.hideRecordingIndicator();
            
            // Восстанавливаем кнопку
            if (this.currentButton) {
                this.currentButton.classList.remove('voice-recording');
            }
        }
    }

    createRecordingIndicator() {
        // Создаем индикатор записи в стиле Telegram
        this.recordingIndicator = document.createElement('div');
        this.recordingIndicator.className = 'voice-recording-indicator';
        this.recordingIndicator.innerHTML = `
            <div class="voice-recording-content">
                <div class="voice-recording-left">
                    <div class="recording-animation">
                        <div class="recording-dot"></div>
                        <div class="recording-bars">
                            <div class="bar"></div>
                            <div class="bar"></div>
                            <div class="bar"></div>
                            <div class="bar"></div>
                            <div class="bar"></div>
                        </div>
                    </div>
                    <div class="recording-info">
                        <div class="recording-title">Запись голосового сообщения</div>
                        <div class="recording-timer">0:00</div>
                    </div>
                </div>
                <div class="voice-recording-right">
                    <button class="send-voice-btn" title="Отправить">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                    <button class="cancel-voice-btn" title="Отменить">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.recordingIndicator);
        
        // Добавляем обработчики для кнопок
        this.setupRecordingControls();
    }

    setupRecordingControls() {
        const sendBtn = this.recordingIndicator.querySelector('.send-voice-btn');
        const cancelBtn = this.recordingIndicator.querySelector('.cancel-voice-btn');

        sendBtn?.addEventListener('click', () => {
            if (this.isRecording) {
                this.stopRecording();
            }
        });

        cancelBtn?.addEventListener('click', () => {
            this.cancelRecording();
        });
    }

    showRecordingIndicator() {
        if (this.recordingIndicator) {
            this.recordingIndicator.classList.add('active');
            this.updateRecordingTimer();
            
            // Позиционируем индикатор рядом с кнопкой если возможно
            this.positionIndicator();
        }
    }

    positionIndicator() {
        if (!this.currentButton || !this.recordingIndicator) return;

        const rect = this.currentButton.getBoundingClientRect();
        const indicator = this.recordingIndicator.querySelector('.voice-recording-content');
        
        // Позиционируем индикатор над кнопкой
        this.recordingIndicator.style.position = 'fixed';
        this.recordingIndicator.style.bottom = '100px';
        this.recordingIndicator.style.left = '50%';
        this.recordingIndicator.style.transform = 'translateX(-50%)';
    }

    hideRecordingIndicator() {
        if (this.recordingIndicator) {
            this.recordingIndicator.classList.remove('active');
        }
    }

    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            this.updateRecordingTimer();
            
            // Автоматическая остановка при достижении лимита
            const elapsed = Date.now() - this.recordingStartTime;
            if (elapsed >= this.maxRecordingTime) {
                this.stopRecording();
            }
        }, 1000);
    }

    updateRecordingTimer() {
        if (!this.recordingIndicator) return;
        
        const elapsed = Date.now() - this.recordingStartTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        const timerElement = this.recordingIndicator.querySelector('.recording-timer');
        if (timerElement) {
            timerElement.textContent = 
                `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    handleRecordingComplete() {
        const duration = Date.now() - this.recordingStartTime;
        
        if (duration >= this.minRecordingTime) {
            this.sendVoiceMessage();
        } else {
            this.showError('Запись слишком короткая');
        }
    }

    cancelRecording() {
        this.stopRecording();
        this.recordedBlob = null;
        this.showNotification('Запись отменена', 'info');
    }

    async sendVoiceMessage() {
        if (!this.recordedBlob) {
            this.showError('Нет записанного сообщения');
            return;
        }

        const duration = Date.now() - this.recordingStartTime;
        if (duration < this.minRecordingTime) {
            this.showError('Сообщение слишком короткое');
            return;
        }

        try {
            const formData = new FormData();
            const filename = `voice_message_${Date.now()}.webm`;
            
            const voiceFile = new File([this.recordedBlob], filename, {
                type: 'audio/webm'
            });
            
            formData.append('file', voiceFile);

            const response = await fetch('/api/upload-voice', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Upload failed');
            }
            
            this.sendVoiceToChat(result.file, duration);
            this.showNotification('Голосовое сообщение отправлено', 'success');
            
        } catch (error) {
            console.error('Error sending voice message:', error);
            this.showError('Ошибка отправки голосового сообщения');
        }
    }

    sendVoiceToChat(fileData, duration) {
        const currentUser = document.getElementById('username')?.textContent;
        let targetChat = null;
        let isGroup = false;

        // Определяем тип чата
        if (window.privateChatInstance?.currentChat) {
            targetChat = window.privateChatInstance.currentChat;
            isGroup = false;
        } else if (window.groupChatManager?.currentGroup) {
            targetChat = window.groupChatManager.currentGroup.id;
            isGroup = true;
        }

        if (!currentUser || !targetChat) {
            this.showError('Не выбран чат для отправки');
            return;
        }

        const voiceMessageData = {
            sender: currentUser,
            message: 'Голосовое сообщение',
            messageType: 'voice',
            fileData: {
                ...fileData,
                duration: duration,
                type: 'voice'
            },
            timestamp: new Date().toLocaleTimeString(),
            date: new Date().toISOString(),
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        };

        // Добавляем получателя
        if (isGroup) {
            voiceMessageData.groupId = targetChat;
        } else {
            voiceMessageData.receiver = targetChat;
        }

        if (window.socket) {
            if (isGroup) {
                window.socket.emit('group_message', voiceMessageData);
            } else {
                window.socket.emit('private message', voiceMessageData);
            }
        } else {
            console.error('Socket not available');
            this.showError('Нет соединения с сервером');
            return;
        }

        // Отображаем сообщение локально
        if (!isGroup && window.privateChatInstance) {
            window.privateChatInstance.displayMessage(voiceMessageData, true);
        } else if (isGroup && window.groupChatManager) {
            window.groupChatManager.displayGroupMessage(voiceMessageData, true);
        }
    }

    setupGlobalEventListeners() {
        // Запрещаем контекстное меню на кнопках записи
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.voice-message-btn') || 
                e.target.closest('.group-voice-message-btn')) {
                e.preventDefault();
            }
        });

        // Останавливаем запись при потере фокуса
        window.addEventListener('blur', () => {
            if (this.isRecording) {
                this.stopRecording();
            }
        });

        // Обработка клавиши Escape для отмены записи
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isRecording) {
                this.cancelRecording();
            }
        });
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `voice-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    forceStopRecording() {
        if (this.isRecording) {
            this.stopRecording();
            this.showNotification('Запись остановлена', 'info');
        }
    }
}

// Добавляем CSS стили в стиле Telegram
function addVoiceMessageStyles() {
    if (!document.getElementById('voice-message-styles')) {
        const styles = document.createElement('style');
        styles.id = 'voice-message-styles';
        styles.textContent = `
            /* Стили для кнопки голосовых сообщений */
            .voice-message-btn, .group-voice-message-btn {
                transition: all 0.2s ease;
                position: relative;
                overflow: hidden;
                cursor: pointer;
                border: none;
                background: transparent;
                padding: 8px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .voice-message-btn:hover, 
            .group-voice-message-btn:hover {
                background: rgba(0, 0, 0, 0.05);
            }

            .voice-message-btn:active, 
            .group-voice-message-btn:active,
            .voice-btn-active {
                transform: scale(0.95);
                background: #0088cc !important;
                color: white !important;
            }

            .voice-recording {
                background: #ff3b30 !important;
                color: white !important;
                animation: pulse 1.5s ease-in-out infinite;
            }

            /* Индикатор записи в стиле Telegram */
            .voice-recording-indicator {
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: white;
                border-radius: 16px;
                padding: 12px 16px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                border: 1px solid #e0e0e0;
                min-width: 300px;
                max-width: 90vw;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 10000;
            }

            .voice-recording-indicator.active {
                opacity: 1;
                visibility: visible;
                transform: translateX(-50%) translateY(0);
            }

            .voice-recording-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }

            .voice-recording-left {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
            }

            .recording-animation {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .recording-dot {
                width: 12px;
                height: 12px;
                background: #ff3b30;
                border-radius: 50%;
                animation: recordingDot 1.5s ease-in-out infinite;
            }

            .recording-bars {
                display: flex;
                align-items: center;
                gap: 2px;
                height: 20px;
            }

            .recording-bars .bar {
                width: 3px;
                background: #0088cc;
                border-radius: 2px;
                animation: recordingBars 1.5s ease-in-out infinite;
            }

            .recording-bars .bar:nth-child(1) { animation-delay: 0.1s; height: 8px; }
            .recording-bars .bar:nth-child(2) { animation-delay: 0.2s; height: 12px; }
            .recording-bars .bar:nth-child(3) { animation-delay: 0.3s; height: 16px; }
            .recording-bars .bar:nth-child(4) { animation-delay: 0.4s; height: 12px; }
            .recording-bars .bar:nth-child(5) { animation-delay: 0.5s; height: 8px; }

            .recording-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .recording-title {
                font-size: 14px;
                color: #666;
                font-weight: 500;
            }

            .recording-timer {
                font-size: 16px;
                font-weight: 600;
                color: #333;
                font-family: 'Courier New', monospace;
            }

            .voice-recording-right {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .send-voice-btn, .cancel-voice-btn {
                background: transparent;
                border: none;
                padding: 8px;
                border-radius: 50%;
                cursor: pointer;
                color: #0088cc;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s ease;
            }

            .send-voice-btn:hover, .cancel-voice-btn:hover {
                background: rgba(0, 136, 204, 0.1);
            }

            .cancel-voice-btn {
                color: #ff3b30;
            }

            .cancel-voice-btn:hover {
                background: rgba(255, 59, 48, 0.1);
            }

            /* Уведомления */
            .voice-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10010;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                background: #333;
                max-width: 300px;
                word-wrap: break-word;
            }

            .voice-notification.error {
                background: #ff3b30;
            }

            .voice-notification.success {
                background: #4cd964;
            }

            .voice-notification.info {
                background: #007aff;
            }

            /* Анимации */
            @keyframes recordingDot {
                0%, 100% {
                    opacity: 1;
                    transform: scale(1);
                }
                50% {
                    opacity: 0.5;
                    transform: scale(0.8);
                }
            }

            @keyframes recordingBars {
                0%, 100% {
                    transform: scaleY(0.8);
                }
                50% {
                    transform: scaleY(1.2);
                }
            }

            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.7;
                }
            }

            /* Адаптивность для мобильных */
            @media (max-width: 768px) {
                .voice-recording-indicator {
                    bottom: 80px;
                    min-width: 280px;
                    padding: 10px 14px;
                }

                .voice-recording-content {
                    gap: 12px;
                }

                .recording-title {
                    font-size: 13px;
                }

                .recording-timer {
                    font-size: 15px;
                }
            }

            /* Темная тема */
            @media (prefers-color-scheme: dark) {
                .voice-recording-indicator {
                    background: #2c2c2e;
                    border-color: #3a3a3c;
                    color: white;
                }

                .recording-title {
                    color: #98989f;
                }

                .recording-timer {
                    color: white;
                }

                .voice-message-btn:hover, 
                .group-voice-message-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    addVoiceMessageStyles();
    
    if (!window.voiceMessageManager) {
        window.voiceMessageManager = new VoiceMessageManager();
        console.log('✅ VoiceMessageManager initialized with Telegram-style recording');
    }
});

function initializeCallButtons() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                const callButtons = document.querySelectorAll('.video-call-btn, .audio-call-btn');
                callButtons.forEach(button => {
                    if (!button.hasAttribute('data-call-initialized')) {
                        button.setAttribute('data-call-initialized', 'true');
                        console.log('Call button found:', button.className);
                    }
                });
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.userSettings = {};
        this.defaultSettings = {
            theme: 'auto',
            accentColor: '#007bff',
            compactMode: false,
            showAvatars: true,
            animations: true,
            showOnlineStatus: true,
            allowGroupInvites: true,
            allowPrivateMessages: true,
            notifyMessages: true,
            notifyCalls: true,
            notifyMentions: true,
            soundEnabled: true,
            notificationSound: 'default',
            userStatus: 'online'
        };
        
        this.init();
    }

    init() {
        this.currentUser = document.getElementById('username')?.textContent;
        this.loadUserSettings();
        this.setupEventListeners();
        this.applySettings();
        console.log('✅ SettingsManager initialized');
    }

    loadUserSettings() {
        try {
            const savedSettings = localStorage.getItem(`userSettings_${this.currentUser}`);
            if (savedSettings) {
                this.userSettings = { ...this.defaultSettings, ...JSON.parse(savedSettings) };
            } else {
                this.userSettings = { ...this.defaultSettings };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.userSettings = { ...this.defaultSettings };
        }
    }

    saveUserSettings() {
        try {
            localStorage.setItem(`userSettings_${this.currentUser}`, JSON.stringify(this.userSettings));
            console.log('💾 Settings saved');
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    setupEventListeners() {
        // Кнопка открытия настроек
        document.addEventListener('click', (e) => {
            if (e.target.id === 'settingsBtn' || e.target.closest('#settingsBtn')) {
                this.openSettings();
            }
        });

        // Закрытие модальных окон
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-modal') || e.target.closest('.close-modal')) {
                e.target.closest('.modal-overlay').style.display = 'none';
            }
        });

        // Клик вне модального окна
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.style.display = 'none';
            }
        });

        // Переключение вкладок
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('settings-tab')) {
                this.switchTab(e.target.getAttribute('data-tab'));
            }
        });

        // Загрузка аватара
        document.addEventListener('click', (e) => {
            if (e.target.id === 'uploadAvatarBtnSettings' || e.target.closest('#uploadAvatarBtnSettings')) {
                document.getElementById('avatarInputSettings').click();
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.id === 'avatarInputSettings') {
                this.handleAvatarUpload(e.target.files[0]);
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.id === 'avatarPreviewLarge' || e.target.closest('#avatarPreviewLarge')) {
                document.getElementById('avatarInputSettings').click();
            }
        });

        // Удаление аватара
        document.addEventListener('click', (e) => {
            if (e.target.id === 'removeAvatarBtn' || e.target.closest('#removeAvatarBtn')) {
                this.removeAvatar();
            }
        });

        // Выбор темы
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('theme-option') || e.target.closest('.theme-option')) {
                const option = e.target.classList.contains('theme-option') ? e.target : e.target.closest('.theme-option');
                this.selectTheme(option.getAttribute('data-theme'));
            }
        });

        // Выбор цвета
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-option') || e.target.closest('.color-option')) {
                const option = e.target.classList.contains('color-option') ? e.target : e.target.closest('.color-option');
                this.selectAccentColor(option.getAttribute('data-color'));
            }
        });

        // Чекбоксы
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('checkbox-input')) {
                this.handleCheckboxChange(e.target.id, e.target.checked);
            }
        });

        // Смена пароля
        document.addEventListener('click', (e) => {
            if (e.target.id === 'changePasswordBtn' || e.target.closest('#changePasswordBtn')) {
                this.openChangePasswordModal();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.id === 'confirmPasswordChange' || e.target.closest('#confirmPasswordChange')) {
                this.changePassword();
            }
        });

        // Выход со всех устройств
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logoutAllBtn' || e.target.closest('#logoutAllBtn')) {
                this.logoutAllDevices();
            }
        });

        // Тест звука
        document.addEventListener('click', (e) => {
            if (e.target.id === 'testSoundBtn' || e.target.closest('#testSoundBtn')) {
                this.testNotificationSound();
            }
        });

        // Сохранение настроек
        document.addEventListener('click', (e) => {
            if (e.target.id === 'saveSettings' || e.target.closest('#saveSettings')) {
                this.saveSettings();
            }
        });

        // Сброс настроек
        document.addEventListener('click', (e) => {
            if (e.target.id === 'resetSettings' || e.target.closest('#resetSettings')) {
                this.resetSettings();
            }
        });

        // Выход
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logoutBtn' || e.target.closest('#logoutBtn')) {
                this.logout();
            }
        });

        // Отслеживание силы пароля
        document.addEventListener('input', (e) => {
            if (e.target.id === 'newPassword') {
                this.checkPasswordStrength(e.target.value);
            }
        });

        // Инициализация модального окна настроек
        this.createSettingsModal();
    }

    createSettingsModal() {
        if (document.getElementById('settingsModal')) return;

        const modal = document.createElement('div');
        modal.id = 'settingsModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
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

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 0;
                border-radius: 15px;
                width: 900px;
                max-width: 95%;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
            ">
                <!-- Боковая панель с вкладками -->
                <div class="settings-sidebar" style="
                    width: 250px;
                    background: #f8f9fa;
                    padding: 20px;
                    border-right: 1px solid #e9ecef;
                    overflow-y: auto;
                ">
                    <div class="sidebar-header" style="margin-bottom: 30px;">
                        <h3 style="margin: 0 0 10px 0; color: #333;">⚙️ Настройки</h3>
                        <div style="font-size: 12px; color: #6c757d;">${this.currentUser}</div>
                    </div>
                    
                    <div class="settings-tabs" style="display: flex; flex-direction: column; gap: 5px;">
                        <button class="settings-tab active" data-tab="profile" style="
                            padding: 12px 15px;
                            border: none;
                            background: #007bff;
                            color: white;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        ">
                            👤 Профиль
                        </button>
                        <button class="settings-tab" data-tab="appearance" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🎨 Внешний вид
                        </button>
                        <button class="settings-tab" data-tab="notifications" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🔔 Уведомления
                        </button>
                        <button class="settings-tab" data-tab="privacy" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🔒 Приватность
                        </button>
                        <button class="settings-tab" data-tab="gifts" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🎁 Мои подарки
                        </button>
                        <button class="settings-tab" data-tab="currency" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🪙 Валюта
                        </button>
                        <button class="settings-tab" data-tab="security" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🛡️ Безопасность
                        </button>
                    </div>
                    
                    <div class="sidebar-footer" style="margin-top: auto; padding-top: 20px; border-top: 1px solid #e9ecef;">
                        <button id="saveSettings" class="btn-primary" style="
                            width: 100%;
                            padding: 12px;
                            background: #28a745;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            margin-bottom: 10px;
                        ">💾 Сохранить</button>
                        <button id="resetSettings" class="btn-secondary" style="
                            width: 100%;
                            padding: 10px;
                            background: #6c757d;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                        ">🔄 Сбросить</button>
                    </div>
                </div>
                
                <!-- Основное содержимое -->
                <div class="settings-main" style="
                    flex: 1;
                    padding: 25px;
                    overflow-y: auto;
                    max-height: 80vh;
                ">
                    <div class="settings-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                        <h3 style="margin: 0; color: #333;" id="settingsTitle">Настройки профиля</h3>
                        <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
                    </div>
                    
                    <div class="settings-content">
                        <!-- Вкладка профиля -->
                        <div id="tab-profile" class="settings-tab-content active">
                            <div class="profile-settings">
                                <div class="avatar-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🖼️ Аватар</h4>
                                    <div style="display: flex; align-items: center; gap: 20px;">
                                        <div id="avatarPreviewLarge" style="
                                            width: 100px;
                                            height: 100px;
                                            border-radius: 50%;
                                            border: 3px solid #007bff;
                                            overflow: hidden;
                                            cursor: pointer;
                                            background: #f8f9fa;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                        ">
                                            <img id="avatarPreviewImgLarge" src="/default-avatar.png" alt="Аватар" style="width: 100%; height: 100%; object-fit: cover;">
                                        </div>
                                        <div>
                                            <button id="uploadAvatarBtnSettings" class="btn-primary" style="
                                                padding: 8px 16px;
                                                background: #007bff;
                                                color: white;
                                                border: none;
                                                border-radius: 5px;
                                                cursor: pointer;
                                                font-size: 14px;
                                                margin-bottom: 5px;
                                                display: block;
                                            ">📁 Загрузить новый</button>
                                            <button id="removeAvatarBtn" class="btn-secondary" style="
                                                padding: 6px 12px;
                                                background: #dc3545;
                                                color: white;
                                                border: none;
                                                border-radius: 5px;
                                                cursor: pointer;
                                                font-size: 12px;
                                            ">🗑️ Удалить</button>
                                            <input type="file" id="avatarInputSettings" accept="image/*" style="display: none;">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="profile-info-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">👤 Информация профиля</h4>
                                    <div class="form-group" style="margin-bottom: 15px;">
                                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Имя пользователя</label>
                                        <input type="text" id="usernameDisplay" class="form-control" readonly style="
                                            width: 100%;
                                            padding: 10px;
                                            border: 1px solid #ced4da;
                                            border-radius: 5px;
                                            background: #f8f9fa;
                                        ">
                                    </div>
                                    <div class="form-group">
                                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Статус</label>
                                        <select id="userStatus" class="form-control" style="
                                            width: 100%;
                                            padding: 10px;
                                            border: 1px solid #ced4da;
                                            border-radius: 5px;
                                        ">
                                            <option value="online">🟢 В сети</option>
                                            <option value="away">🟡 Отошел</option>
                                            <option value="dnd">🔴 Не беспокоить</option>
                                            <option value="offline">⚫ Не в сети</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка внешнего вида -->
                        <div id="tab-appearance" class="settings-tab-content">
                            <div class="appearance-settings">
                                <div class="theme-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🌙 Тема</h4>
                                    <div class="theme-options" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                                        <div class="theme-option active" data-theme="auto" style="
                                            border: 2px solid #007bff;
                                            border-radius: 10px;
                                            padding: 15px;
                                            text-align: center;
                                            cursor: pointer;
                                            background: linear-gradient(45deg, #f8f9fa 50%, #343a40 50%);
                                        ">
                                            <div style="font-size: 24px;">🌓</div>
                                            <div style="font-size: 12px; margin-top: 5px;">Авто</div>
                                        </div>
                                        <div class="theme-option" data-theme="light" style="
                                            border: 1px solid #dee2e6;
                                            border-radius: 10px;
                                            padding: 15px;
                                            text-align: center;
                                            cursor: pointer;
                                            background: #f8f9fa;
                                        ">
                                            <div style="font-size: 24px;">☀️</div>
                                            <div style="font-size: 12px; margin-top: 5px;">Светлая</div>
                                        </div>
                                        <div class="theme-option" data-theme="dark" style="
                                            border: 1px solid #dee2e6;
                                            border-radius: 10px;
                                            padding: 15px;
                                            text-align: center;
                                            cursor: pointer;
                                            background: #343a40;
                                            color: white;
                                        ">
                                            <div style="font-size: 24px;">🌙</div>
                                            <div style="font-size: 12px; margin-top: 5px;">Темная</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="color-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🎨 Акцентный цвет</h4>
                                    <div class="color-options" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;">
                                        <div class="color-option active" data-color="#007bff" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #007bff;
                                            cursor: pointer;
                                            border: 3px solid #007bff;
                                        "></div>
                                        <div class="color-option" data-color="#28a745" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #28a745;
                                            cursor: pointer;
                                            border: 3px solid white;
                                        "></div>
                                        <div class="color-option" data-color="#dc3545" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #dc3545;
                                            cursor: pointer;
                                            border: 3px solid white;
                                        "></div>
                                        <div class="color-option" data-color="#ffc107" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #ffc107;
                                            cursor: pointer;
                                            border: 3px solid white;
                                        "></div>
                                        <div class="color-option" data-color="#6f42c1" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #6f42c1;
                                            cursor: pointer;
                                            border: 3px solid white;
                                        "></div>
                                        <div class="color-option" data-color="#fd7e14" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #fd7e14;
                                            cursor: pointer;
                                            border: 3px solid white;
                                        "></div>
                                    </div>
                                </div>
                                
                                <div class="layout-section">
                                    <h4 style="margin-bottom: 15px; color: #495057;">📐 Оформление</h4>
                                    <div class="checkbox-group" style="display: flex; flex-direction: column; gap: 15px;">
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="compactMode" class="checkbox-input" style="transform: scale(1.2);">
                                            <span>Компактный режим</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="showAvatars" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Показывать аватары</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="animations" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Анимации</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка уведомлений -->
                        <div id="tab-notifications" class="settings-tab-content">
                            <div class="notifications-settings">
                                <div class="notifications-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🔔 Уведомления</h4>
                                    <div class="checkbox-group" style="display: flex; flex-direction: column; gap: 15px;">
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="notifyMessages" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Новые сообщения</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="notifyCalls" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Входящие звонки</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="notifyMentions" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Упоминания</span>
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="sound-section">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🔊 Звук</h4>
                                    <div class="checkbox-group" style="display: flex; flex-direction: column; gap: 15px;">
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="soundEnabled" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Включить звук</span>
                                        </label>
                                        <div class="form-group">
                                            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Звук уведомления</label>
                                            <select id="notificationSound" class="form-control" style="
                                                width: 100%;
                                                padding: 10px;
                                                border: 1px solid #ced4da;
                                                border-radius: 5px;
                                            ">
                                                <option value="default">🔔 По умолчанию</option>
                                                <option value="chime">🎵 Мелодия</option>
                                                <option value="bell">🔔 Колокольчик</option>
                                                <option value="pop">💥 Хлопок</option>
                                            </select>
                                        </div>
                                        <button id="testSoundBtn" class="btn-secondary" style="
                                            padding: 8px 16px;
                                            background: #6c757d;
                                            color: white;
                                            border: none;
                                            border-radius: 5px;
                                            cursor: pointer;
                                            font-size: 14px;
                                            align-self: flex-start;
                                        ">🎵 Тест звука</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка приватности -->
                        <div id="tab-privacy" class="settings-tab-content">
                            <div class="privacy-settings">
                                <div class="privacy-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">👥 Видимость</h4>
                                    <div class="checkbox-group" style="display: flex; flex-direction: column; gap: 15px;">
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="showOnlineStatus" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Показывать статус "В сети"</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="allowGroupInvites" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Разрешить приглашения в группы</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="allowPrivateMessages" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Разрешить личные сообщения</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка подарков -->
                        <div id="tab-gifts" class="settings-tab-content">
                            <div class="gifts-management">
                                <h4 style="margin-bottom: 20px; color: #495057;">🎁 Управление подарками</h4>
                                
                                <div class="equipped-gifts-section" style="margin-bottom: 25px;">
                                    <h5 style="margin-bottom: 15px; color: #495057;">🎽 Надетые подарки</h5>
                                    <div id="equippedGiftsList" class="equipped-gifts-list" style="
                                        display: grid;
                                        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                                        gap: 15px;
                                        margin-bottom: 20px;
                                    ">
                                        <!-- Список надетых подарков -->
                                    </div>
                                </div>
                                
                                <div class="all-gifts-section">
                                    <h5 style="margin-bottom: 15px; color: #495057;">📦 Все подарки</h5>
                                    <div id="userGiftsManagementList" class="user-gifts-management-list" style="
                                        display: grid;
                                        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                                        gap: 10px;
                                        max-height: 400px;
                                        overflow-y: auto;
                                        padding: 15px;
                                        background: #f8f9fa;
                                        border-radius: 8px;
                                    ">
                                        <!-- Список всех подарков -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка валюты -->
                        <div id="tab-currency" class="settings-tab-content">
                            <div class="currency-settings">
                                <div class="currency-balance-section" style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px;">
                                    <div style="font-size: 14px; opacity: 0.9;">Ваш баланс</div>
                                    <div style="font-size: 32px; font-weight: bold;" id="userBalance">0</div>
                                    <div style="font-size: 12px; margin-top: 5px;">Ежедневная серия: <span id="dailyStreak">0</span> дней</div>
                                </div>
                                
                                <div class="daily-reward-section" style="margin-bottom: 25px;">
                                    <h5 style="margin-bottom: 10px; color: #495057;">🎁 Ежедневная награда</h5>
                                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                                        <div style="font-size: 14px; color: #6c757d; margin-bottom: 10px;">
                                            Следующая награда: <span id="nextRewardTime">Доступно сейчас!</span>
                                        </div>
                                        <button id="dailyRewardBtn" class="btn-primary" style="
                                            width: 100%;
                                            padding: 12px;
                                            background: linear-gradient(45deg, #28a745, #20c997);
                                            color: white;
                                            border: none;
                                            border-radius: 8px;
                                            cursor: pointer;
                                            font-size: 16px;
                                            font-weight: bold;
                                        ">🎁 Получить ежедневную награду</button>
                                    </div>
                                </div>
                                
                                <div class="currency-history-section">
                                    <h5 style="margin-bottom: 15px; color: #495057;">📊 История операций</h5>
                                    <div id="currencyHistory" class="currency-history" style="
                                        max-height: 200px;
                                        overflow-y: auto;
                                        background: #f8f9fa;
                                        border-radius: 8px;
                                        padding: 15px;
                                    ">
                                        <!-- История операций -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка безопасности -->
                        <div id="tab-security" class="settings-tab-content">
                            <div class="security-settings">
                                <div class="password-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🔐 Безопасность</h4>
                                    <button id="changePasswordBtn" class="btn-primary" style="
                                        padding: 10px 20px;
                                        background: #007bff;
                                        color: white;
                                        border: none;
                                        border-radius: 5px;
                                        cursor: pointer;
                                        font-size: 14px;
                                    ">🔑 Сменить пароль</button>
                                </div>
                                
                                <div class="sessions-section" style="margin-bottom: 25px;">
                                    <h5 style="margin-bottom: 10px; color: #495057;">🌐 Активные сессии</h5>
                                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                                        <div style="font-size: 14px; color: #6c757d;">
                                            Вы вошли с этого устройства
                                        </div>
                                        <div style="font-size: 12px; color: #495057; margin-top: 5px;">
                                            ${new Date().toLocaleString()}
                                        </div>
                                    </div>
                                    <button id="logoutAllBtn" class="btn-secondary" style="
                                        padding: 8px 16px;
                                        background: #dc3545;
                                        color: white;
                                        border: none;
                                        border-radius: 5px;
                                        cursor: pointer;
                                        font-size: 14px;
                                    ">🚪 Выйти со всех устройств</button>
                                </div>
                                
                                <div class="logout-section">
                                    <button id="logoutBtn" class="btn-secondary" style="
                                        padding: 10px 20px;
                                        background: #6c757d;
                                        color: white;
                                        border: none;
                                        border-radius: 5px;
                                        cursor: pointer;
                                        font-size: 14px;
                                    ">🚪 Выйти</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Создаем модальные окна для смены пароля
        this.createChangePasswordModal();
    }

    createChangePasswordModal() {
        if (document.getElementById('changePasswordModal')) return;

        const modal = document.createElement('div');
        modal.id = 'changePasswordModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
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

        modal.innerHTML = `
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
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Текущий пароль</label>
                        <input type="password" id="currentPassword" class="form-control" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ced4da;
                            border-radius: 5px;
                        ">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Новый пароль</label>
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
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Подтвердите новый пароль</label>
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

        document.body.appendChild(modal);
    }

  openSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        this.loadCurrentSettings();
        modal.style.display = 'flex';
        this.switchTab('profile');
    } else {
        console.error('Settings modal not found');
        this.createSettingsModal(); // Создаем модальное окно если его нет
        setTimeout(() => this.openSettings(), 100);
    }
}

  switchTab(tabName) {
    // Деактивируем все вкладки
    document.querySelectorAll('.settings-tab').forEach(tab => {
        if (tab) {
            tab.classList.remove('active');
            tab.style.background = 'transparent';
            tab.style.color = '#333';
        }
    });
    
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        if (content) {
            content.classList.remove('active');
            content.style.display = 'none';
        }
    });

    // Активируем выбранную вкладку
    const activeTab = document.querySelector(`.settings-tab[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`tab-${tabName}`);
    
    if (activeTab && activeContent) {
        activeTab.classList.add('active');
        activeTab.style.background = '#007bff';
        activeTab.style.color = 'white';
        activeContent.classList.add('active');
        activeContent.style.display = 'block';
        
        // Обновляем заголовок
        const titleElement = document.getElementById('settingsTitle');
        if (titleElement) {
            const titles = {
                'profile': 'Настройки профиля',
                'appearance': 'Внешний вид',
                'notifications': 'Уведомления',
                'privacy': 'Приватность',
                'gifts': 'Мои подарки',
                'currency': 'Валюта и награды',
                'security': 'Безопасность'
            };
            
            titleElement.textContent = titles[tabName] || 'Настройки';
        }
    }
}

    loadCurrentSettings() {
        // Загружаем текущие настройки в форму
        document.getElementById('usernameDisplay').value = this.currentUser;
        document.getElementById('userStatus').value = this.userSettings.userStatus;

        // Тема
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            option.style.borderColor = '#dee2e6';
        });
        
        const activeTheme = document.querySelector(`.theme-option[data-theme="${this.userSettings.theme}"]`);
        if (activeTheme) {
            activeTheme.classList.add('active');
            activeTheme.style.borderColor = '#007bff';
        }

        // Цвет
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
            option.style.borderColor = 'white';
        });
        
        const activeColor = document.querySelector(`.color-option[data-color="${this.userSettings.accentColor}"]`);
        if (activeColor) {
            activeColor.classList.add('active');
            activeColor.style.borderColor = activeColor.getAttribute('data-color');
        }

        // Чекбоксы
        document.getElementById('compactMode').checked = this.userSettings.compactMode;
        document.getElementById('showAvatars').checked = this.userSettings.showAvatars;
        document.getElementById('animations').checked = this.userSettings.animations;
        document.getElementById('showOnlineStatus').checked = this.userSettings.showOnlineStatus;
        document.getElementById('allowGroupInvites').checked = this.userSettings.allowGroupInvites;
        document.getElementById('allowPrivateMessages').checked = this.userSettings.allowPrivateMessages;
        document.getElementById('notifyMessages').checked = this.userSettings.notifyMessages;
        document.getElementById('notifyCalls').checked = this.userSettings.notifyCalls;
        document.getElementById('notifyMentions').checked = this.userSettings.notifyMentions;
        document.getElementById('soundEnabled').checked = this.userSettings.soundEnabled;

        // Звук уведомлений
        document.getElementById('notificationSound').value = this.userSettings.notificationSound;

        // Загружаем аватар
        this.loadUserAvatar();
    }

    async loadUserAvatar() {
        try {
            const response = await fetch(`/api/user/${this.currentUser}`);
            if (response.ok) {
                const userData = await response.json();
                const avatarUrl = userData.avatar || '/default-avatar.png';
                document.getElementById('avatarPreviewImgLarge').src = avatarUrl;
            }
        } catch (error) {
            console.error('Error loading user avatar:', error);
        }
    }

    async handleAvatarUpload(file) {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showNotification('Пожалуйста, выберите изображение', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Размер файла не должен превышать 5MB', 'error');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await fetch('/api/user/avatar', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                document.getElementById('avatarPreviewImgLarge').src = result.avatar;
                this.showNotification('Аватар успешно обновлен', 'success');
                
                // Обновляем аватар во всем приложении
                if (window.privateChatInstance) {
                    window.privateChatInstance.updateUserAvatar(this.currentUser);
                }
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            this.showNotification('Ошибка загрузки аватара', 'error');
        }
    }

    async removeAvatar() {
        try {
            // Здесь должна быть логика удаления аватара на сервере
            // Пока просто сбрасываем на дефолтный
            document.getElementById('avatarPreviewImgLarge').src = '/default-avatar.png';
            this.showNotification('Аватар удален', 'success');
        } catch (error) {
            console.error('Error removing avatar:', error);
            this.showNotification('Ошибка удаления аватара', 'error');
        }
    }

    selectTheme(theme) {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            option.style.borderColor = '#dee2e6';
        });
        
        const selectedTheme = document.querySelector(`.theme-option[data-theme="${theme}"]`);
        if (selectedTheme) {
            selectedTheme.classList.add('active');
            selectedTheme.style.borderColor = '#007bff';
        }
        
        this.userSettings.theme = theme;
        this.applyTheme();
    }

    selectAccentColor(color) {
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
            option.style.borderColor = 'white';
        });
        
        const selectedColor = document.querySelector(`.color-option[data-color="${color}"]`);
        if (selectedColor) {
            selectedColor.classList.add('active');
            selectedColor.style.borderColor = color;
        }
        
        this.userSettings.accentColor = color;
        this.applyAccentColor();
    }

    handleCheckboxChange(setting, value) {
        this.userSettings[setting] = value;
        
        // Немедленно применяем некоторые настройки
        if (setting === 'compactMode' || setting === 'showAvatars' || setting === 'animations') {
            this.applySettings();
        }
    }

    applySettings() {
        this.applyTheme();
        this.applyAccentColor();
        this.applyLayoutSettings();
    }

    applyTheme() {
        const theme = this.userSettings.theme;
        let actualTheme = theme;

        if (theme === 'auto') {
            actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        document.documentElement.setAttribute('data-theme', actualTheme);
        document.body.className = `${actualTheme}-theme`;
    }

    applyAccentColor() {
        const color = this.userSettings.accentColor;
        document.documentElement.style.setProperty('--accent-color', color);
        document.documentElement.style.setProperty('--accent-color-dark', this.darkenColor(color, 20));
        document.documentElement.style.setProperty('--accent-color-light', this.lightenColor(color, 20));
    }

    applyLayoutSettings() {
        if (this.userSettings.compactMode) {
            document.body.classList.add('compact-mode');
        } else {
            document.body.classList.remove('compact-mode');
        }

        if (!this.userSettings.showAvatars) {
            document.body.classList.add('hide-avatars');
        } else {
            document.body.classList.remove('hide-avatars');
        }

        if (!this.userSettings.animations) {
            document.body.classList.add('no-animations');
        } else {
            document.body.classList.remove('no-animations');
        }
    }

    darkenColor(color, percent) {
        // Упрощенная функция затемнения цвета
        return color;
    }

    lightenColor(color, percent) {
        // Упрощенная функция осветления цвета
        return color;
    }

    openChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        }
    }

    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('Пароли не совпадают', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showNotification('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        try {
            // Здесь должна быть логика смены пароля на сервере
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            if (response.ok) {
                this.showNotification('Пароль успешно изменен', 'success');
                document.getElementById('changePasswordModal').style.display = 'none';
            } else {
                throw new Error('Password change failed');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            this.showNotification('Ошибка смены пароля', 'error');
        }
    }

    checkPasswordStrength(password) {
        const strengthBar = document.querySelector('.strength-bar div');
        const strengthText = document.querySelector('.strength-text');
        
        if (!strengthBar || !strengthText) return;

        let strength = 0;
        let text = 'Слабый';
        let color = '#dc3545';

        if (password.length >= 8) strength += 25;
        if (/[A-Z]/.test(password)) strength += 25;
        if (/[0-9]/.test(password)) strength += 25;
        if (/[^A-Za-z0-9]/.test(password)) strength += 25;

        if (strength >= 75) {
            text = 'Сильный';
            color = '#28a745';
        } else if (strength >= 50) {
            text = 'Средний';
            color = '#ffc107';
        }

        strengthBar.style.width = `${strength}%`;
        strengthBar.style.background = color;
        strengthText.textContent = `Надежность пароля: ${text}`;
        strengthText.style.color = color;
    }

    async logoutAllDevices() {
        if (confirm('Вы уверены, что хотите выйти со всех устройств? Это завершит все активные сессии.')) {
            try {
                const response = await fetch('/api/user/logout-all', {
                    method: 'POST'
                });

                if (response.ok) {
                    this.showNotification('Все сессии завершены', 'success');
                    setTimeout(() => {
                        this.logout();
                    }, 2000);
                }
            } catch (error) {
                console.error('Error logging out from all devices:', error);
                this.showNotification('Ошибка выхода со всех устройств', 'error');
            }
        }
    }

    testNotificationSound() {
        // Проигрываем тестовый звук
        const audio = new Audio('/sounds/notification.mp3');
        audio.play().catch(e => console.log('Audio play failed:', e));
        this.showNotification('Тестовый звук воспроизведен', 'info');
    }

    saveSettings() {
        // Сохраняем выбранный статус
        this.userSettings.userStatus = document.getElementById('userStatus').value;

        this.saveUserSettings();
        this.applySettings();
        this.showNotification('Настройки сохранены', 'success');

        // Обновляем статус пользователя
        this.updateUserStatus();
    }

    resetSettings() {
        if (confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
            this.userSettings = { ...this.defaultSettings };
            this.saveUserSettings();
            this.applySettings();
            this.loadCurrentSettings();
            this.showNotification('Настройки сброшены', 'success');
        }
    }

    logout() {
        fetch('/api/logout', { method: 'POST' })
            .then(() => window.location.href = '/')
            .catch(() => window.location.href = '/');
    }

    updateUserStatus() {
        if (window.socket && this.userSettings.userStatus) {
            window.socket.emit('user_status_change', {
                username: this.currentUser,
                status: this.userSettings.userStatus
            });
        }
    }

    // Методы для управления подарками
    loadGiftsManagement() {
        const currentUser = document.getElementById('username')?.textContent;
        if (!currentUser || !window.giftManager) return;

        const userGifts = window.giftManager.userGifts.get(currentUser) || [];
        const equippedGifts = window.giftManager.getEquippedGifts(currentUser);
        
        this.updateEquippedGiftsList(equippedGifts, userGifts);
        this.updateUserGiftsManagementList(userGifts, currentUser);
    }

    updateEquippedGiftsList(equippedGifts, userGifts) {
        const equippedList = document.getElementById('equippedGiftsList');
        if (!equippedList) return;

        const slots = {
            head: 'Голова',
            badge: 'Значок', 
            background: 'Фон',
            effect: 'Эффект'
        };

        equippedList.innerHTML = Object.entries(slots).map(([slot, name]) => {
            const giftId = equippedGifts[slot];
            const gift = giftId ? userGifts.find(g => g.id === giftId) : null;
            
            return `
                <div class="equipped-slot-item" style="
                    border: 2px dashed ${gift ? '#28a745' : '#dee2e6'};
                    border-radius: 10px;
                    padding: 15px;
                    text-align: center;
                    background: ${gift ? '#f8fff9' : '#f8f9fa'};
                ">
                    <div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">${name}</div>
                    ${gift ? `
                        <div style="font-size: 24px; margin-bottom: 8px;">${gift.name.split(' ')[0]}</div>
                        <div style="font-size: 11px; color: #495057; margin-bottom: 10px;">${gift.name}</div>
                        <button class="unequip-gift-btn" data-slot="${slot}" data-gift-id="${gift.id}" style="
                            padding: 5px 10px;
                            background: #dc3545;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 11px;
                        ">Снять</button>
                    ` : `
                        <div style="font-size: 20px; color: #6c757d; margin-bottom: 8px;">┄</div>
                        <div style="font-size: 11px; color: #6c757d;">Пусто</div>
                    `}
                </div>
            `;
        }).join('');

        // Обработчики для кнопок снятия
        equippedList.querySelectorAll('.unequip-gift-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const slot = e.target.getAttribute('data-slot');
                const giftId = e.target.getAttribute('data-gift-id');
                const currentUser = document.getElementById('username')?.textContent;
                
                try {
                    await window.giftManager.toggleGiftEquip(currentUser, giftId, slot);
                    this.showNotification('Подарок снят', 'success');
                    this.loadGiftsManagement();
                } catch (error) {
                    this.showNotification(error.message, 'error');
                }
            });
        });
    }

    updateUserGiftsManagementList(userGifts, currentUser) {
        const giftsList = document.getElementById('userGiftsManagementList');
        if (!giftsList) return;

        if (userGifts.length === 0) {
            giftsList.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🎁</div>
                    <div>У вас пока нет подарков</div>
                    <button class="open-gift-shop-btn" style="margin-top: 15px; padding: 8px 16px; background: #ffc107; color: #212529; border: none; border-radius: 5px; cursor: pointer;">
                        🛒 Перейти в магазин
                    </button>
                </div>
            `;
            
            giftsList.querySelector('.open-gift-shop-btn')?.addEventListener('click', () => {
                if (window.currencyManager) {
                    window.currencyManager.openGiftShop();
                }
            });
            
            return;
        }

        giftsList.innerHTML = userGifts.map(gift => {
            const isEquipped = window.giftManager.isGiftEquipped(currentUser, gift.id);
            const canEquip = gift.wearable && !isEquipped;
            
            return `
                <div class="management-gift-item ${isEquipped ? 'equipped' : ''}" style="
                    border: 1px solid ${isEquipped ? '#007bff' : '#dee2e6'};
                    border-radius: 8px;
                    padding: 10px;
                    text-align: center;
                    background: ${isEquipped ? '#e7f3ff' : 'white'};
                    position: relative;
                " data-gift-id="${gift.id}">
                    ${isEquipped ? '<div style="position: absolute; top: 5px; right: 5px; color: #007bff; font-size: 12px;">✓</div>' : ''}
                    <div style="font-size: 20px; margin-bottom: 5px;">${gift.name.split(' ')[0]}</div>
                    <div style="font-size: 10px; color: #6c757d; margin-bottom: 8px; height: 30px; overflow: hidden;">${gift.name}</div>
                    
                    ${gift.from ? `
                        <div style="font-size: 9px; color: #28a745; margin-bottom: 5px;">
                            от ${gift.from}
                        </div>
                    ` : ''}
                    
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        ${canEquip ? `
                            <button class="equip-gift-management-btn" style="
                                padding: 3px 8px;
                                background: #28a745;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 10px;
                            ">Надеть</button>
                        ` : isEquipped ? `
                            <button class="unequip-gift-management-btn" style="
                                padding: 3px 8px;
                                background: #dc3545;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 10px;
                            ">Снять</button>
                        ` : ''}
                        
                        ${!gift.wearable ? `
                            <div style="font-size: 9px; color: #6c757d; padding: 2px;">
                                📦 Коллекционный
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Обработчики для кнопок управления
        giftsList.querySelectorAll('.equip-gift-management-btn, .unequip-gift-management-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const giftItem = e.target.closest('.management-gift-item');
                const giftId = giftItem.getAttribute('data-gift-id');
                const gift = userGifts.find(g => g.id === giftId);
                
                if (gift && gift.wearable) {
                    try {
                        await window.giftManager.toggleGiftEquip(currentUser, giftId, gift.slot);
                        this.showNotification(
                            window.giftManager.isGiftEquipped(currentUser, giftId) 
                                ? 'Подарок надет!' 
                                : 'Подарок снят!', 
                            'success'
                        );
                        this.loadGiftsManagement();
                    } catch (error) {
                        this.showNotification(error.message, 'error');
                    }
                }
            });
        });
    }

    // Методы для валюты
    loadCurrencyData() {
        if (window.currencyManager) {
            document.getElementById('userBalance').textContent = window.currencyManager.balance;
            document.getElementById('dailyStreak').textContent = `${window.currencyManager.dailyStreak} дней`;
            this.updateCurrencyHistory();
        }
    }

    updateCurrencyHistory() {
        const historyElement = document.getElementById('currencyHistory');
        if (!historyElement || !window.currencyManager) return;

        const history = window.currencyManager.transactionHistory || [];

        if (history.length === 0) {
            historyElement.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">История операций пуста</div>';
            return;
        }

        historyElement.innerHTML = history.slice(0, 10).map(transaction => `
            <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                <div style="flex: 1;">
                    <div style="font-size: 12px; color: #495057;">${transaction.description}</div>
                    <div style="font-size: 10px; color: #6c757d;">${new Date(transaction.timestamp).toLocaleDateString()}</div>
                </div>
                <div style="font-weight: bold; color: ${transaction.amount >= 0 ? '#28a745' : '#dc3545'};">
                    ${transaction.amount >= 0 ? '+' : ''}${transaction.amount}
                </div>
            </div>
        `).join('');
    }

    showNotification(message, type = 'info') {
        // Используем существующую систему уведомлений
        if (window.privateChatInstance) {
            window.privateChatInstance.showNotification(message, type);
        } else {
            // Простая реализация, если privateChatInstance недоступен
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
                background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 3000);
        }
    }
}

class CurrencyManager {
    constructor() {
        this.balance = 0;
        this.dailyStreak = 0;
        this.lastDailyReward = null;
        this.transactionHistory = [];
        this.isAdmin = false;
        
        this.init();
    }

 async init() {
        this.currentUser = document.getElementById('username')?.textContent;
        this.isAdmin = this.currentUser === 'admin';
        
        // Сначала пробуем загрузить с сервера, потом локально
        await this.loadUserData();
        await this.loadLocalData(); // Загружаем локальные данные как резерв
        
        this.setupEventListeners();
        this.updateDisplay();
        
        console.log('✅ CurrencyManager initialized');
    }
 setupGiftShopInSettings() {
        this.loadGiftsToSettingsShop();
        this.setupGiftShopEventsInSettings();
    }

loadGiftsToSettingsShop() {
    const giftsGrid = document.getElementById('giftsGrid');
    if (!giftsGrid) {
        console.error('Gifts grid not found');
        return;
    }

    giftsGrid.innerHTML = '';

    if (!window.giftManager) {
        giftsGrid.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">Магазин подарков загружается...</div>';
        return;
    }

    window.giftManager.gifts.forEach(gift => {
        const giftElement = document.createElement('div');
        giftElement.className = `gift-item ${gift.type}`;
        
        const isOwned = window.giftManager.isGiftOwned(gift.id);
        const canAfford = this.balance >= gift.price;
        
        giftElement.innerHTML = `
            <div class="gift-icon">${gift.name.split(' ')[0]}</div>
            <div class="gift-name">${gift.name}</div>
            <div class="gift-price">${gift.price} 🪙</div>
            <div class="gift-type">
                ${this.getGiftTypeBadge(gift.type)}
            </div>
            <button class="buy-gift-btn ${isOwned ? 'owned' : ''}" 
                    data-gift-id="${gift.id}"
                    ${isOwned ? 'disabled' : !canAfford ? 'disabled' : ''}>
                ${isOwned ? '✅ Куплен' : !canAfford ? '💸 Не хватает' : '🛒 Купить'}
            </button>
        `;

        if (!isOwned && canAfford) {
            const buyBtn = giftElement.querySelector('.buy-gift-btn');
            buyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.buyGiftFromSettings(gift);
            });
        }

        giftsGrid.appendChild(giftElement);
    });

    this.updateGiftShopInSettings();
}
  async saveUserData() {
        try {
            const endpoints = [
                '/api/currency/save',
                '/api/currency/user/save',
                '/api/user/currency/save'
            ];
            
            let success = false;
            
            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            username: this.currentUser,
                            balance: this.balance,
                            dailyStreak: this.dailyStreak,
                            lastDailyReward: this.lastDailyReward,
                            transactionHistory: this.transactionHistory
                        })
                    });

                    if (response.ok) {
                        console.log('✅ Currency data saved to server');
                        success = true;
                        break;
                    }
                } catch (error) {
                    console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                    continue;
                }
            }

            if (!success) {
                // Сохраняем локально если сервер недоступен
                this.saveLocalData();
            }

            return true;
        } catch (error) {
            console.error('❌ Error saving currency data:', error);
            this.saveLocalData(); // Всегда сохраняем локально при ошибке
            return false;
        }
    }

    saveLocalData() {
        try {
            const data = {
                balance: this.balance,
                dailyStreak: this.dailyStreak,
                lastDailyReward: this.lastDailyReward,
                transactionHistory: this.transactionHistory
            };
            localStorage.setItem(`currency_${this.currentUser}`, JSON.stringify(data));
            console.log('💾 Currency data saved locally');
        } catch (error) {
            console.error('❌ Error saving local currency data:', error);
        }
    }

    async loadLocalData() {
        try {
            const data = JSON.parse(localStorage.getItem(`currency_${this.currentUser}`) || '{}');
            this.balance = data.balance || 0;
            this.dailyStreak = data.dailyStreak || 0;
            this.lastDailyReward = data.lastDailyReward;
            this.transactionHistory = data.transactionHistory || [];
            console.log('📦 Loaded local currency data');
        } catch (error) {
            console.log('⚠️ No local currency data found');
        }
    }

    getGiftTypeBadge(type) {
        const badges = {
            'common': '<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Обычный</span>',
            'rare': '<span style="background: #007bff; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Редкий</span>',
            'epic': '<span style="background: #6f42c1; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Эпический</span>',
            'legendary': '<span style="background: #fd7e14; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Легендарный</span>'
        };
        return badges[type] || badges.common;
    }

    setupGiftShopEventsInSettings() {
        const categoryBtns = document.querySelectorAll('#tab-currency .category-btn');
        const giftsGrid = document.getElementById('giftsGrid');

        categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                categoryBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterGiftsInSettings(btn.dataset.category);
            });
        });

        // Обновляем магазин при переключении на вкладку валюты
        const currencyTab = document.querySelector('.settings-tab[data-tab="currency"]');
        if (currencyTab) {
            currencyTab.addEventListener('click', () => {
                setTimeout(() => {
                    this.loadGiftsToSettingsShop();
                }, 100);
            });
        }
    }

    filterGiftsInSettings(category) {
        if (!window.giftManager) return;

        const giftItems = document.querySelectorAll('#giftsGrid .gift-item');
        giftItems.forEach(item => {
            const giftName = item.querySelector('.gift-name').textContent;
            const gift = window.giftManager.gifts.find(g => g.name === giftName);
            
            if (category === 'all' || gift.category === category) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    async buyGiftFromSettings(gift) {
        if (!window.giftManager) {
            this.showNotification('Магазин подарков недоступен', 'error');
            return;
        }

        try {
            await window.giftManager.buyGift(gift);
            this.loadGiftsToSettingsShop();
            this.updateDisplay();
            this.showNotification(`Подарок "${gift.name}" успешно куплен!`, 'success');
        } catch (error) {
            console.error('Error buying gift from settings:', error);
            this.showNotification(error.message, 'error');
        }
    }
    updateGiftShopInSettings() {
        this.updateGiftShopBalanceInSettings();
        this.updateUserGiftsListInSettings();
    }

    updateGiftShopBalanceInSettings() {
        const balanceElement = document.getElementById('userBalance');
        if (balanceElement) {
            balanceElement.textContent = this.balance;
        }

        const ownedCountElement = document.getElementById('ownedGiftsCount');
        if (ownedCountElement && window.giftManager) {
            const currentUser = document.getElementById('username')?.textContent;
            const ownedCount = window.giftManager.userGifts.get(currentUser)?.length || 0;
            ownedCountElement.textContent = ownedCount;
        }
    }

    updateUserGiftsListInSettings() {
        const userGiftsList = document.getElementById('userGiftsList');
        if (!userGiftsList || !window.giftManager) return;

        const currentUser = document.getElementById('username')?.textContent;
        const userGifts = window.giftManager.userGifts.get(currentUser) || [];

        if (userGifts.length === 0) {
            userGiftsList.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 10px; font-size: 11px;">Пока нет подарков</div>';
            return;
        }

        userGiftsList.innerHTML = userGifts.map(gift => `
            <div class="owned-gift-item" title="${gift.name} (куплен ${new Date(gift.purchaseDate).toLocaleDateString()})">
                <div class="owned-gift-icon">${gift.name.split(' ')[0]}</div>
                <div class="owned-gift-name">${gift.name.split(' ').slice(1).join(' ')}</div>
            </div>
        `).join('');
    }

    updateDisplay() {
    // Обновляем баланс во всех местах
    const balance = this.balance;
    
    // Основной баланс в настройках
    const balanceElement = document.getElementById('userBalance');
    if (balanceElement) {
        balanceElement.textContent = balance;
    }

    // Баланс в сайдбаре
    const sidebarBalance = document.getElementById('sidebarBalance');
    if (sidebarBalance) {
        sidebarBalance.textContent = balance;
    }

    // Баланс в заголовке
    const headerBalance = document.getElementById('headerBalance');
    if (headerBalance) {
        headerBalance.textContent = balance;
    }

    // Баланс в магазине подарков
    const giftShopBalance = document.getElementById('giftShopBalance');
    if (giftShopBalance) {
        giftShopBalance.textContent = balance;
    }

    // Баланс в модальном окне валюты
    const modalBalance = document.getElementById('modalBalance');
    if (modalBalance) {
        modalBalance.textContent = balance;
    }

    // Обновляем серию
    const streakElement = document.getElementById('dailyStreak');
    if (streakElement) {
        streakElement.textContent = `${this.dailyStreak} дней`;
    }

    // Обновляем историю
    this.updateHistoryDisplay();

    // Обновляем магазин подарков в настройках
    this.updateGiftShopInSettings();
    
    console.log('💰 Balance updated:', balance);
}
    async loadUserData() {
        try {
            console.log('🔄 Loading currency data for:', this.currentUser);
            
            // Пробуем разные эндпоинты для валюты
            const endpoints = [
                `/api/user/${this.currentUser}/currency`,
                `/api/currency/user/${this.currentUser}`,
                `/api/currency/${this.currentUser}`
            ];
            
            let success = false;
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`🔍 Trying currency endpoint: ${endpoint}`);
                    const response = await fetch(endpoint);
                    
                    if (response.ok) {
                        const data = await response.json();
                        this.balance = data.balance || 0;
                        this.dailyStreak = data.dailyStreak || 0;
                        this.lastDailyReward = data.lastDailyReward;
                        this.transactionHistory = data.transactionHistory || [];
                        
                        console.log('✅ Currency data loaded from:', endpoint, {
                            balance: this.balance,
                            streak: this.dailyStreak,
                            lastReward: this.lastDailyReward
                        });
                        
                        success = true;
                        break;
                    }
                } catch (error) {
                    console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                    continue;
                }
            }
            
            if (!success) {
                console.log('⚠️ All currency endpoints failed, using default data');
                this.useDefaultCurrencyData();
            }
            
        } catch (error) {
            console.error('❌ Error loading currency data:', error);
            this.useDefaultCurrencyData();
        }
    }

    useDefaultCurrencyData() {
        this.balance = 100;
        this.dailyStreak = 0;
        this.lastDailyReward = null;
        this.transactionHistory = [];
        
        console.log('✅ Using default currency data');
    }

    setupEventListeners() {
        // Кнопка ежедневной награды
        document.getElementById('dailyRewardBtn')?.addEventListener('click', () => {
            this.claimDailyReward();
        });

        // Обновляем таймер следующей награды
        this.updateNextRewardTimer();
        setInterval(() => this.updateNextRewardTimer(), 60000); // Обновляем каждую минуту
    }

    updateDisplay() {
        // Обновляем баланс
        const balanceElement = document.getElementById('userBalance');
        if (balanceElement) {
            balanceElement.textContent = this.balance;
        }

        // Обновляем серию
        const streakElement = document.getElementById('dailyStreak');
        if (streakElement) {
            streakElement.textContent = `${this.dailyStreak} дней`;
        }

        // Обновляем историю
        this.updateHistoryDisplay();
    }

    canClaimDailyReward() {
        if (!this.lastDailyReward) {
            console.log('✅ No previous reward - can claim');
            return true;
        }

        const lastClaim = new Date(this.lastDailyReward);
        const now = new Date();
        
        // Награда доступна раз в 23 часа
        const timeSinceLastReward = now - lastClaim;
        const hoursSinceLastReward = timeSinceLastReward / (1000 * 60 * 60);
        
        console.log('⏰ Time since last reward:', {
            lastClaim: lastClaim.toISOString(),
            now: now.toISOString(),
            hoursSinceLastReward: hoursSinceLastReward.toFixed(2),
            canClaim: hoursSinceLastReward >= 23
        });
        
        return hoursSinceLastReward >= 23;
    }

    updateNextRewardTimer() {
        const nextRewardElement = document.getElementById('nextRewardTime');
        if (!nextRewardElement) return;

        const canClaim = this.canClaimDailyReward();

        if (canClaim) {
            nextRewardElement.textContent = 'Доступно сейчас!';
            nextRewardElement.style.color = '#28a745';
        } else {
            // Исправленная логика расчета времени до следующей награды
            const now = new Date();
            const lastClaim = new Date(this.lastDailyReward);
            
            // Время следующей награды = время последней награды + 23 часа
            const nextRewardTime = new Date(lastClaim.getTime() + (23 * 60 * 60 * 1000));
            
            // Если следующая награда уже прошла, показываем "Доступно сейчас"
            if (nextRewardTime <= now) {
                nextRewardElement.textContent = 'Доступно сейчас!';
                nextRewardElement.style.color = '#28a745';
                return;
            }
            
            // Рассчитываем оставшееся время
            const timeUntilReward = nextRewardTime - now;
            const hours = Math.floor(timeUntilReward / (1000 * 60 * 60));
            const minutes = Math.floor((timeUntilReward % (1000 * 60 * 60)) / (1000 * 60));

            nextRewardElement.textContent = `Через ${hours}ч ${minutes}м`;
            nextRewardElement.style.color = '#6c757d';
            
            console.log('⏳ Next reward countdown:', {
                nextRewardTime: nextRewardTime.toISOString(),
                hoursRemaining: hours,
                minutesRemaining: minutes
            });
        }

        // Обновляем состояние кнопки
        const rewardBtn = document.getElementById('dailyRewardBtn');
        if (rewardBtn) {
            rewardBtn.disabled = !canClaim;
            if (canClaim) {
                rewardBtn.innerHTML = '🎁 Получить ежедневную награду';
                rewardBtn.style.background = 'linear-gradient(45deg, #28a745, #20c997)';
            } else {
                rewardBtn.innerHTML = '⏳ Награда скоро будет доступна';
                rewardBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            }
        }
    }
async claimDailyReward() {
    try {
        console.log('🎁 Starting daily reward claim process...');
        
        const currentUser = this.currentUser;
        if (!currentUser) {
            this.showNotification('Пользователь не определен', 'error');
            return;
        }

        // Проверяем возможность получения награды
        if (!this.canClaimDailyReward()) {
            this.showNotification('Вы уже получали награду сегодня. Попробуйте позже.', 'error');
            return;
        }

        console.log('🎁 User can claim reward, proceeding...');

        // Пробуем разные эндпоинты для получения награды
        const endpoints = [
            '/api/currency/daily-reward',
            '/api/currency/reward/daily', 
            '/api/daily-reward'
        ];
        
        let success = false;
        let result = null;
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Trying reward endpoint: ${endpoint}`);
                
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: currentUser
                    })
                });

                console.log(`📨 Response status from ${endpoint}:`, response.status);
                
                if (response.ok) {
                    result = await response.json();
                    console.log('✅ Reward claimed successfully from:', endpoint, result);
                    success = true;
                    break;
                } else {
                    const errorText = await response.text();
                    console.log(`❌ ${endpoint} returned ${response.status}:`, errorText);
                }
            } catch (error) {
                console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                continue;
            }
        }

        if (!success) {
            // Если все эндпоинты не сработали, используем локальную логику
            console.log('⚠️ All reward endpoints failed, using local logic');
            result = this.calculateLocalReward();
            success = true; // Локальная логика всегда успешна для демо
        }

        if (success && result) {
            // Обновляем локальные данные
            this.balance = result.newBalance || this.balance + (result.rewardAmount || 50);
            this.dailyStreak = result.streak || this.dailyStreak + 1;
            this.lastDailyReward = new Date().toISOString();
            
            // Добавляем в историю
            this.addTransaction({
                type: 'daily_reward',
                amount: result.rewardAmount || 50,
                description: `Ежедневная награда (серия: ${this.dailyStreak} дней)`,
                timestamp: new Date().toISOString()
            });

            // Сохраняем данные
            await this.saveUserData();
            
            this.updateDisplay();
            this.showRewardNotification(result.rewardAmount || 50, this.dailyStreak);
            
            console.log('✅ Daily reward claimed successfully', {
                newBalance: this.balance,
                newStreak: this.dailyStreak,
                lastReward: this.lastDailyReward
            });
            
        } else {
            throw new Error(result?.error || 'Failed to claim reward');
        }
    } catch (error) {
        console.error('❌ Error claiming daily reward:', error);
        this.showNotification('Ошибка получения награды: ' + error.message, 'error');
    }
}

// Добавьте метод для расчета локальной награды
calculateLocalReward() {
    const baseReward = 50;
    const streakBonus = Math.min(this.dailyStreak * 5, 100);
    const totalReward = baseReward + streakBonus;
    
    return {
        success: true,
        rewardAmount: totalReward,
        newBalance: this.balance + totalReward,
        streak: this.dailyStreak + 1
    };
}
async loadUsersCurrencyList() {
    try {
        const usersList = document.getElementById('usersCurrencyList');
        if (!usersList) return;

        usersList.innerHTML = '<div class="loading">Загрузка пользователей...</div>';

        // Получаем список пользователей
        const response = await fetch('/api/users/all');
        if (!response.ok) throw new Error('Failed to load users');

        const users = await response.json();
        
        let html = '';
        for (const user of users) {
            try {
                const currencyResponse = await fetch(`/api/user/${user.username}/currency`);
                const currencyData = currencyResponse.ok ? await currencyResponse.json() : { balance: 0 };
                
                html += `
                    <div class="user-currency-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                        <div class="user-info" style="display: flex; align-items: center; gap: 10px;">
                            <img src="${user.avatar || '/default-avatar.png'}" style="width: 30px; height: 30px; border-radius: 50%;" alt="${user.username}">
                            <span>${user.username}</span>
                            ${user.isOnline ? '<span style="color: #28a745; font-size: 12px;">🟢</span>' : '<span style="color: #dc3545; font-size: 12px;">🔴</span>'}
                        </div>
                        <div class="currency-info" style="font-weight: bold; color: #28a745;">
                            🪙 ${currencyData.balance || 0}
                        </div>
                    </div>
                `;
            } catch (error) {
                console.log(`Error loading currency for ${user.username}:`, error);
            }
        }

        usersList.innerHTML = html || '<div class="empty">Пользователи не найдены</div>';

    } catch (error) {
        console.error('Error loading users currency list:', error);
        const usersList = document.getElementById('usersCurrencyList');
        if (usersList) {
            usersList.innerHTML = '<div class="error">Ошибка загрузки пользователей</div>';
        }
    }
}

    addTransaction(transaction) {
        this.transactionHistory.unshift(transaction);
        if (this.transactionHistory.length > 50) {
            this.transactionHistory = this.transactionHistory.slice(0, 50);
        }
    }

    updateHistoryDisplay() {
        const historyElement = document.getElementById('currencyHistory');
        if (!historyElement) return;

        if (this.transactionHistory.length === 0) {
            historyElement.innerHTML = '<div class="history-empty">История операций пуста</div>';
            return;
        }

        historyElement.innerHTML = this.transactionHistory.map(transaction => `
            <div class="history-item">
                <div class="history-info">
                    <div class="history-description">${transaction.description}</div>
                    <div class="history-date">${this.formatDate(transaction.timestamp)}</div>
                </div>
                <div class="history-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}">
                    ${transaction.amount >= 0 ? '+' : ''}${transaction.amount}
                </div>
            </div>
        `).join('');
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showRewardNotification(amount, streak) {
        const notification = document.createElement('div');
        notification.className = 'reward-notification';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="font-size: 24px;">🪙</div>
                <div>
                    <div>🎉 Вы получили ${amount} монет!</div>
                    ${streak > 1 ? `<div style="font-size: 12px; opacity: 0.9;">Серия: ${streak} дней подряд!</div>` : ''}
                </div>
            </div>
        `;
        
        // Добавляем анимацию к иконке валюты в балансе
        const currencyIcon = document.querySelector('.currency-icon');
        if (currencyIcon) {
            currencyIcon.classList.add('coin-animation');
            setTimeout(() => {
                currencyIcon.classList.remove('coin-animation');
            }, 800);
        }

        // Вставляем уведомление
        const balanceDisplay = document.querySelector('.currency-balance');
        if (balanceDisplay) {
            balanceDisplay.parentNode.insertBefore(notification, balanceDisplay);
            
            // Убираем уведомление через 3 секунды
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateY(-20px)';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.remove();
                        }
                    }, 300);
                }
            }, 3000);
        }
    }

    showNotification(message, type = 'info') {
        // Используем существующую систему уведомлений
        if (window.privateChatInstance) {
            window.privateChatInstance.showNotification(message, type);
        } else {
            // Простая реализация, если privateChatInstance недоступен
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
                background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 3000);
        }
    }

    // Методы для администратора
 async addCurrencyToUser(username, amount, reason = '') {
    if (!this.isAdmin) {
        this.showNotification('Недостаточно прав', 'error');
        return false;
    }

    try {
        const endpoints = [
            '/api/currency/add',
            '/api/currency/admin/add',
            '/api/admin/currency/add'
        ];
        
        let success = false;
        
        for (const endpoint of endpoints) {
            try {
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
                    // ОБНОВЛЯЕМ БАЛАНС ЛОКАЛЬНО ДЛЯ МГНОВЕННОГО ОТОБРАЖЕНИЯ
                    if (username === this.currentUser) {
                        this.balance += amount;
                        this.addTransaction({
                            type: 'admin_add',
                            amount: amount,
                            description: reason || 'Административное начисление',
                            timestamp: new Date().toISOString()
                        });
                        this.updateDisplay(); // ОБНОВЛЯЕМ ОТОБРАЖЕНИЕ
                    }
                    
                    this.showNotification(`Добавлено ${amount} монет пользователю ${username}`, 'success');
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
            if (username === this.currentUser) {
                this.balance += amount;
                this.addTransaction({
                    type: 'admin_add',
                    amount: amount,
                    description: reason || '[ДЕМО] Административное начисление',
                    timestamp: new Date().toISOString()
                });
                this.updateDisplay(); // ОБНОВЛЯЕМ ОТОБРАЖЕНИЕ
            }
            this.showNotification(`[ДЕМО] Добавлено ${amount} монет пользователю ${username}`, 'info');
            success = true;
        }

        return success;
    } catch (error) {
        console.error('Error adding currency:', error);
        this.showNotification('Ошибка добавления валюты', 'error');
        return false;
    }
}
async removeCurrencyFromUser(username, amount, reason = '') {
    if (!this.isAdmin) {
        this.showNotification('Недостаточно прав', 'error');
        return false;
    }

    try {
        const endpoints = [
            '/api/currency/remove',
            '/api/currency/admin/remove',
            '/api/admin/currency/remove'
        ];
        
        let success = false;
        
        for (const endpoint of endpoints) {
            try {
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
                    // ОБНОВЛЯЕМ БАЛАНС ЛОКАЛЬНО ДЛЯ МГНОВЕННОГО ОТОБРАЖЕНИЯ
                    if (username === this.currentUser) {
                        this.balance -= amount;
                        this.addTransaction({
                            type: 'admin_remove',
                            amount: -amount,
                            description: reason || 'Административное списание',
                            timestamp: new Date().toISOString()
                        });
                        this.updateDisplay(); // ОБНОВЛЯЕМ ОТОБРАЖЕНИЕ
                    }
                    
                    this.showNotification(`Списано ${amount} монет у пользователя ${username}`, 'success');
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
            if (username === this.currentUser) {
                this.balance -= amount;
                this.addTransaction({
                    type: 'admin_remove',
                    amount: -amount,
                    description: reason || '[ДЕМО] Административное списание',
                    timestamp: new Date().toISOString()
                });
                this.updateDisplay(); // ОБНОВЛЯЕМ ОТОБРАЖЕНИЕ
            }
            this.showNotification(`[ДЕМО] Списано ${amount} монет у пользователя ${username}`, 'info');
            success = true;
        }

        return success;
    } catch (error) {
        console.error('Error removing currency:', error);
        this.showNotification('Ошибка списания валюты', 'error');
        return false;
    }
}
}


class GiftManager {
    constructor() {
        this.gifts = [
            { 
                id: 'gift_1', 
                name: '🎈 Воздушный шарик', 
                price: 10, 
                type: 'common', 
                category: 'decor', 
                wearable: true, 
                slot: 'background',
                description: 'Веселый воздушный шарик для украшения профиля'
            },
            { 
                id: 'gift_2', 
                name: '🎁 Подарок', 
                price: 25, 
                type: 'common', 
                category: 'gift', 
                wearable: false,
                description: 'Тайный подарок для друзей'
            },
            { 
                id: 'gift_3', 
                name: '🏆 Кубок', 
                price: 50, 
                type: 'rare', 
                category: 'achievement', 
                wearable: true, 
                slot: 'badge',
                description: 'Кубок победителя для лучших пользователей'
            },
            { 
                id: 'gift_4', 
                name: '👑 Корона', 
                price: 100, 
                type: 'epic', 
                category: 'premium', 
                wearable: true, 
                slot: 'head',
                description: 'Корона для настоящих королей чата'
            },
            { 
                id: 'gift_5', 
                name: '⭐ Звезда', 
                price: 30, 
                type: 'common', 
                category: 'decor', 
                wearable: true, 
                slot: 'badge',
                description: 'Сияющая звезда успеха'
            },
            { 
                id: 'gift_6', 
                name: '💖 Сердце', 
                price: 40, 
                type: 'common', 
                category: 'emotion', 
                wearable: true, 
                slot: 'effect',
                description: 'Сердце, полное любви и заботы'
            },
            { 
                id: 'gift_7', 
                name: '🚀 Ракета', 
                price: 75, 
                type: 'rare', 
                category: 'premium', 
                wearable: true, 
                slot: 'background',
                description: 'Ракета для стремительного роста'
            },
            { 
                id: 'gift_8', 
                name: '🎨 Палитра', 
                price: 35, 
                type: 'common', 
                category: 'creativity', 
                wearable: true, 
                slot: 'badge',
                description: 'Палитра для творческих личностей'
            },
            { 
                id: 'gift_9', 
                name: '🏅 Медаль', 
                price: 60, 
                type: 'rare', 
                category: 'achievement', 
                wearable: true, 
                slot: 'badge',
                description: 'Медаль за достижения'
            },
            { 
                id: 'gift_10', 
                name: '💎 Алмаз', 
                price: 150, 
                type: 'legendary', 
                category: 'premium', 
                wearable: true, 
                slot: 'effect',
                description: 'Редкий алмаз для избранных'
            },
            { 
                id: 'gift_11', 
                name: '🎭 Маска', 
                price: 45, 
                type: 'common', 
                category: 'mystery', 
                wearable: true, 
                slot: 'head',
                description: 'Таинственная маска'
            },
            { 
                id: 'gift_12', 
                name: '🛡️ Щит', 
                price: 80, 
                type: 'rare', 
                category: 'protection', 
                wearable: true, 
                slot: 'badge',
                description: 'Щит для защиты вашего профиля'
            }
        ];
        
        this.userGifts = new Map();
        this.userProfiles = new Map();
        this.equippedGifts = new Map();
        this.giftCategories = ['all', 'decor', 'achievement', 'premium', 'emotion', 'creativity', 'mystery', 'protection'];
        
        this.init();
    }

    async init() {
        console.log('🔄 Initializing GiftManager...');
        await this.loadUserGifts();
        await this.loadUserProfiles();
        await this.loadEquippedGifts();
        this.setupDefaultGifts();
        console.log('✅ GiftManager initialized');
    }

    // Загрузка данных пользователей
    async loadUserGifts() {
        try {
            const savedGifts = JSON.parse(localStorage.getItem('userGifts') || '{}');
            this.userGifts = new Map(Object.entries(savedGifts));
            console.log('📦 Loaded user gifts:', this.userGifts.size);
        } catch (error) {
            console.log('⚠️ Using empty user gifts data');
            this.userGifts = new Map();
        }
    }

    async loadUserProfiles() {
        try {
            const savedProfiles = JSON.parse(localStorage.getItem('userProfiles') || '{}');
            this.userProfiles = new Map(Object.entries(savedProfiles));
            console.log('👤 Loaded user profiles:', this.userProfiles.size);
        } catch (error) {
            console.log('⚠️ Using empty user profiles data');
            this.userProfiles = new Map();
        }
    }

    async loadEquippedGifts() {
        try {
            const equippedData = JSON.parse(localStorage.getItem('equippedGifts') || '{}');
            this.equippedGifts = new Map(Object.entries(equippedData));
            console.log('🎽 Loaded equipped gifts:', this.equippedGifts.size);
        } catch (error) {
            console.log('⚠️ Using empty equipped gifts data');
            this.equippedGifts = new Map();
        }
    }

    // Сохранение данных
    async saveUserGifts() {
        try {
            const data = Object.fromEntries(this.userGifts);
            localStorage.setItem('userGifts', JSON.stringify(data));
            console.log('💾 Saved user gifts');
        } catch (error) {
            console.error('❌ Error saving user gifts:', error);
        }
    }

    async saveEquippedGifts() {
        try {
            const data = Object.fromEntries(this.equippedGifts);
            localStorage.setItem('equippedGifts', JSON.stringify(data));
            console.log('💾 Saved equipped gifts');
        } catch (error) {
            console.error('❌ Error saving equipped gifts:', error);
        }
    }

    // Настройка подарков по умолчанию для новых пользователей
    setupDefaultGifts() {
        const currentUser = this.getCurrentUser();
        if (currentUser && !this.userGifts.has(currentUser)) {
            // Дарим бесплатный подарок новым пользователям
            const welcomeGift = {
                ...this.gifts.find(g => g.id === 'gift_1'),
                purchaseDate: new Date().toISOString(),
                isFree: true
            };
            
            this.userGifts.set(currentUser, [welcomeGift]);
            this.saveUserGifts();
            console.log('🎁 Added welcome gift for new user:', currentUser);
        }
    }

    // Основные методы работы с подарками
    getCurrentUser() {
        return document.getElementById('username')?.textContent || 'anonymous';
    }

    isGiftOwned(giftId, username = null) {
        const user = username || this.getCurrentUser();
        const userGifts = this.userGifts.get(user) || [];
        return userGifts.some(gift => gift.id === giftId);
    }

    getUserGifts(username = null) {
        const user = username || this.getCurrentUser();
        return this.userGifts.get(user) || [];
    }

    getUserGift(username, giftId) {
        const userGifts = this.getUserGifts(username);
        return userGifts.find(gift => gift.id === giftId);
    }

    getGiftById(giftId) {
        return this.gifts.find(gift => gift.id === giftId);
    }

 async buyGift(gift) {
        const currentUser = this.getCurrentUser();
        if (!currentUser || currentUser === 'anonymous') {
            throw new Error('Пользователь не найден');
        }

        if (this.isGiftOwned(gift.id)) {
            throw new Error('У вас уже есть этот подарок');
        }

        if (!window.currencyManager) {
            throw new Error('Система валюты недоступна');
        }

        if (window.currencyManager.balance < gift.price) {
            throw new Error(`Недостаточно монет. Нужно: ${gift.price} 🪙, у вас: ${window.currencyManager.balance} 🪙`);
        }

        try {
            // Списываем монеты
            window.currencyManager.balance -= gift.price;
            
            // Добавляем подарок пользователю
            const userGifts = this.getUserGifts();
            userGifts.push({
                ...gift,
                purchaseDate: new Date().toISOString(),
                from: 'purchase'
            });
            
            this.userGifts.set(currentUser, userGifts);

            // Сохраняем изменения
            await this.saveUserGifts();
            
            // Сохраняем данные валюты (используем существующий метод)
            if (window.currencyManager.saveUserData) {
                await window.currencyManager.saveUserData();
            } else {
                // Если метода нет, сохраняем локально
                window.currencyManager.saveLocalData();
            }

            // Добавляем запись в историю транзакций
            window.currencyManager.addTransaction({
                type: 'gift_purchase',
                amount: -gift.price,
                description: `Покупка подарка: ${gift.name}`,
                timestamp: new Date().toISOString()
            });

            console.log('✅ Gift purchased:', gift.name, 'by', currentUser);
            return true;
            
        } catch (error) {
            console.error('❌ Error buying gift:', error);
            
            // Откатываем изменения при ошибке
            window.currencyManager.balance += gift.price;
            
            throw new Error('Ошибка покупки подарка: ' + error.message);
        }
    }

    // Отправка подарка другому пользователю
    async sendGift(sender, receiver, giftId) {
        if (!sender || !receiver) {
            throw new Error('Не указан отправитель или получатель');
        }

        if (!this.isGiftOwned(giftId, sender)) {
            throw new Error('У вас нет этого подарка');
        }

        if (sender === receiver) {
            throw new Error('Нельзя отправить подарок самому себе');
        }

        try {
            const gift = this.getUserGift(sender, giftId);
            if (!gift) {
                throw new Error('Подарок не найден');
            }

            // Удаляем подарок у отправителя
            const senderGifts = this.getUserGifts(sender);
            const giftIndex = senderGifts.findIndex(g => g.id === giftId);
            if (giftIndex === -1) {
                throw new Error('Подарок не найден у отправителя');
            }

            senderGifts.splice(giftIndex, 1);
            this.userGifts.set(sender, senderGifts);

            // Добавляем подарок получателю
            const receiverGifts = this.getUserGifts(receiver);
            receiverGifts.push({
                ...gift,
                from: sender,
                receivedDate: new Date().toISOString(),
                originalPurchaseDate: gift.purchaseDate
            });
            
            this.userGifts.set(receiver, receiverGifts);

            // Сохраняем изменения
            await this.saveUserGifts();

            // Отправляем уведомление
            if (window.socket) {
                window.socket.emit('gift_sent', {
                    sender: sender,
                    receiver: receiver,
                    gift: gift,
                    timestamp: new Date().toISOString()
                });
            }

            // Показываем уведомление
            this.showNotification(`Подарок "${gift.name}" отправлен пользователю ${receiver}`, 'success');

            console.log('✅ Gift sent:', gift.name, 'from', sender, 'to', receiver);
            return true;
            
        } catch (error) {
            console.error('❌ Error sending gift:', error);
            throw error;
        }
    }

    // Управление надетыми подарками
    getEquippedGifts(username = null) {
        const user = username || this.getCurrentUser();
        return this.equippedGifts.get(user) || {};
    }

    isGiftEquipped(username, giftId) {
        const equipped = this.getEquippedGifts(username);
        return Object.values(equipped).includes(giftId);
    }

    async toggleGiftEquip(username, giftId, slot) {
        const user = username || this.getCurrentUser();
        
        if (!user) {
            throw new Error('Пользователь не найден');
        }

        try {
            if (!this.equippedGifts.has(user)) {
                this.equippedGifts.set(user, {});
            }

            const userEquipped = this.equippedGifts.get(user);
            const gift = this.getUserGift(user, giftId);

            if (!gift) {
                throw new Error('Подарок не найден');
            }

            if (!gift.wearable) {
                throw new Error('Этот подарок нельзя надеть');
            }

            if (gift.slot !== slot) {
                throw new Error(`Этот подарок можно надеть только в слот: ${gift.slot}`);
            }

            const isCurrentlyEquipped = userEquipped[slot] === giftId;
            let action;

            if (isCurrentlyEquipped) {
                // Снимаем подарок
                userEquipped[slot] = null;
                action = 'снят';
            } else {
                // Надеваем подарок (снимаем предыдущий если был)
                userEquipped[slot] = giftId;
                action = 'надет';
            }

            this.equippedGifts.set(user, userEquipped);
            await this.saveEquippedGifts();

            // Обновляем отображение профиля
            this.updateProfileDisplay(user);

            this.showNotification(`Подарок "${gift.name}" ${action}!`, 'success');
            console.log(`✅ Gift ${action}:`, gift.name, 'for user:', user);

            return !isCurrentlyEquipped; // возвращаем true если надели, false если сняли
            
        } catch (error) {
            console.error('❌ Error toggling gift equip:', error);
            this.showNotification(error.message, 'error');
            throw error;
        }
    }

    // Снятие всех подарков
    async unequipAllGifts(username = null) {
        const user = username || this.getCurrentUser();
        
        if (this.equippedGifts.has(user)) {
            this.equippedGifts.set(user, {});
            await this.saveEquippedGifts();
            this.updateProfileDisplay(user);
            this.showNotification('Все подарки сняты', 'info');
        }
    }

    // Получение статистики подарков
    getUserGiftStats(username = null) {
        const user = username || this.getCurrentUser();
        const userGifts = this.getUserGifts(user);
        const equippedGifts = this.getEquippedGifts(user);

        return {
            totalGifts: userGifts.length,
            equippedGifts: Object.values(equippedGifts).filter(Boolean).length,
            wearableGifts: userGifts.filter(g => g.wearable).length,
            collectedGifts: userGifts.filter(g => !g.wearable).length,
            byType: this.groupGiftsByType(userGifts),
            byCategory: this.groupGiftsByCategory(userGifts)
        };
    }

    groupGiftsByType(gifts) {
        return gifts.reduce((acc, gift) => {
            acc[gift.type] = (acc[gift.type] || 0) + 1;
            return acc;
        }, {});
    }

    groupGiftsByCategory(gifts) {
        return gifts.reduce((acc, gift) => {
            acc[gift.category] = (acc[gift.category] || 0) + 1;
            return acc;
        }, {});
    }

    // Поиск и фильтрация подарков
    searchGifts(query, category = 'all') {
        let filteredGifts = this.gifts;

        if (category !== 'all') {
            filteredGifts = filteredGifts.filter(gift => gift.category === category);
        }

        if (query) {
            const searchQuery = query.toLowerCase();
            filteredGifts = filteredGifts.filter(gift => 
                gift.name.toLowerCase().includes(searchQuery) ||
                gift.description.toLowerCase().includes(searchQuery)
            );
        }

        return filteredGifts;
    }

    getGiftsByCategory(category) {
        if (category === 'all') return this.gifts;
        return this.gifts.filter(gift => gift.category === category);
    }

    getGiftsByType(type) {
        return this.gifts.filter(gift => gift.type === type);
    }

    // Получение редких подарков
    getRareGifts() {
        return this.gifts.filter(gift => gift.type === 'rare' || gift.type === 'epic' || gift.type === 'legendary');
    }

    // Получение доступных для покупки подарков
    getAvailableGifts(username = null) {
        const user = username || this.getCurrentUser();
        return this.gifts.filter(gift => !this.isGiftOwned(gift.id, user));
    }

    // Восстановление подарков (для админа)
    async adminAddGift(username, giftId, from = 'admin') {
        const gift = this.getGiftById(giftId);
        if (!gift) {
            throw new Error('Подарок не найден');
        }

        const userGifts = this.getUserGifts(username);
        userGifts.push({
            ...gift,
            from: from,
            receivedDate: new Date().toISOString(),
            isAdminGift: true
        });

        this.userGifts.set(username, userGifts);
        await this.saveUserGifts();

        console.log(`✅ Admin added gift: ${gift.name} to user: ${username}`);
        return true;
    }

    // Удаление подарка (для админа)
    async adminRemoveGift(username, giftId) {
        const userGifts = this.getUserGifts(username);
        const filteredGifts = userGifts.filter(gift => gift.id !== giftId);
        
        this.userGifts.set(username, filteredGifts);
        await this.saveUserGifts();

        // Снимаем подарок если он был надет
        const equipped = this.getEquippedGifts(username);
        Object.keys(equipped).forEach(slot => {
            if (equipped[slot] === giftId) {
                equipped[slot] = null;
            }
        });
        this.equippedGifts.set(username, equipped);
        await this.saveEquippedGifts();

        console.log(`✅ Admin removed gift: ${giftId} from user: ${username}`);
        return true;
    }

    // Обновление отображения профиля
    updateProfileDisplay(username) {
        if (window.profileManager && window.profileManager.currentProfile?.username === username) {
            window.profileManager.displayProfile(window.profileManager.currentProfile);
        }

        // Обновляем отображение в настройках если открыто
        if (window.settingsManager && username === this.getCurrentUser()) {
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal && settingsModal.style.display === 'flex') {
                const activeTab = document.querySelector('.settings-tab.active');
                if (activeTab && activeTab.getAttribute('data-tab') === 'gifts') {
                    window.settingsManager.loadGiftsManagement();
                }
            }
        }
    }

    // Вспомогательные методы
    showNotification(message, type = 'info') {
        if (window.privateChatInstance) {
            window.privateChatInstance.showNotification(message, type);
        } else {
            // Простая реализация уведомления
            const notification = document.createElement('div');
            notification.className = `gift-notification ${type}`;
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
                background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 3000);
        }
    }

    // Получение информации о подарке для отображения
    getGiftDisplayInfo(gift) {
        return {
            id: gift.id,
            name: gift.name,
            icon: gift.name.split(' ')[0],
            description: gift.description,
            price: gift.price,
            type: gift.type,
            category: gift.category,
            wearable: gift.wearable,
            slot: gift.slot,
            isNew: !gift.purchaseDate,
            from: gift.from
        };
    }

    // Экспорт данных пользователя (для бэкапа)
    exportUserData(username = null) {
        const user = username || this.getCurrentUser();
        const userGifts = this.getUserGifts(user);
        const equippedGifts = this.getEquippedGifts(user);

        return {
            username: user,
            exportDate: new Date().toISOString(),
            gifts: userGifts,
            equippedGifts: equippedGifts,
            stats: this.getUserGiftStats(user)
        };
    }

    // Импорт данных пользователя (для восстановления)
    async importUserData(data) {
        if (!data || !data.username || !data.gifts) {
            throw new Error('Некорректные данные для импорта');
        }

        this.userGifts.set(data.username, data.gifts);
        
        if (data.equippedGifts) {
            this.equippedGifts.set(data.username, data.equippedGifts);
        }

        await this.saveUserGifts();
        await this.saveEquippedGifts();

        this.showNotification('Данные подарков успешно импортированы', 'success');
        return true;
    }

    // Очистка данных пользователя (для тестирования)
    async clearUserData(username = null) {
        const user = username || this.getCurrentUser();
        
        this.userGifts.delete(user);
        this.equippedGifts.delete(user);
        
        await this.saveUserGifts();
        await this.saveEquippedGifts();

        this.showNotification('Данные подарков очищены', 'info');
        return true;
    }
}

// Добавляем методы для глобального доступа
GiftManager.prototype.getGiftTypeBadge = function(type) {
    const badges = {
        'common': '<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Обычный</span>',
        'rare': '<span style="background: #007bff; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Редкий</span>',
        'epic': '<span style="background: #6f42c1; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Эпический</span>',
        'legendary': '<span style="background: #fd7e14; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Легендарный</span>'
    };
    return badges[type] || badges.common;
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    if (!window.giftManager) {
        window.giftManager = new GiftManager();
    }
});


// Добавляем методы для глобального доступа
CurrencyManager.prototype.addCurrency = async function() {
    const username = document.getElementById('currencyTargetUser')?.value;
    const amount = parseInt(document.getElementById('currencyAmount')?.value);
    const reason = document.getElementById('currencyReason')?.value;

    if (!username || !amount) {
        this.showNotification('Заполните все поля', 'error');
        return;
    }

    await this.addCurrencyToUser(username, amount, reason);
};

CurrencyManager.prototype.removeCurrency = async function() {
    const username = document.getElementById('currencyTargetUser')?.value;
    const amount = parseInt(document.getElementById('currencyAmount')?.value);
    const reason = document.getElementById('currencyReason')?.value;

    if (!username || !amount) {
        this.showNotification('Заполните все поля', 'error');
        return;
    }

    await this.removeCurrencyFromUser(username, amount, reason);
};

class ProfileManager {
    constructor() {
        this.currentProfile = null;
        this.userProfiles = new Map();
        this.init();
    }

    async init() {
        await this.loadUserProfiles();
        this.setupProfileViewer();
        console.log('✅ ProfileManager initialized');
    }

    // Обновленный метод отображения профиля
    displayProfile(profileData) {
        const profileContent = document.getElementById('profileContent');
        if (!profileContent) return;

        const currentUser = document.getElementById('username')?.textContent;
        const isOwnProfile = currentUser === profileData.username;
        const equippedGifts = window.giftManager ? window.giftManager.getEquippedGifts(profileData.username) : {};
        const userGifts = window.giftManager ? window.giftManager.userGifts.get(profileData.username) || [] : [];

        profileContent.innerHTML = `
            <div class="profile-header" style="text-align: center; margin-bottom: 25px; position: relative;">
                <!-- Отображение надетых подарков -->
                <div class="equipped-gifts-overlay" style="position: relative; display: inline-block;">
                    ${this.renderEquippedGifts(equippedGifts, profileData.username)}
                    <div class="profile-avatar" style="position: relative; display: inline-block;">
                        <img src="${profileData.avatar}" 
                             alt="${profileData.username}" 
                             style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid #007bff;">
                        ${this.getStatusIndicator(profileData.status)}
                    </div>
                </div>
                <h4 style="margin: 15px 0 5px 0; color: #333;">${profileData.username}</h4>
                <div class="profile-status" style="color: #6c757d; margin-bottom: 15px;">
                    ${this.getStatusText(profileData.status)}
                </div>
                ${isOwnProfile ? `
                    <button class="edit-profile-btn" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                        ✏️ Редактировать профиль
                    </button>
                ` : `
                    <button class="send-gift-profile-btn" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; margin-left: 10px;">
                        🎁 Отправить подарок
                    </button>
                `}
            </div>

            <div class="profile-info" style="margin-bottom: 25px;">
                <div class="info-section">
                    <h5 style="margin-bottom: 10px; color: #495057;">📊 Статистика</h5>
                    <div class="stats-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center;">
                        <div class="stat-item">
                            <div style="font-size: 12px; color: #6c757d;">Сообщения</div>
                            <div style="font-weight: bold; font-size: 18px;">${profileData.stats.messagesSent || 0}</div>
                        </div>
                        <div class="stat-item">
                            <div style="font-size: 12px; color: #6c757d;">Группы</div>
                            <div style="font-weight: bold; font-size: 18px;">${profileData.stats.groupsCreated || 0}</div>
                        </div>
                        <div class="stat-item">
                            <div style="font-size: 12px; color: #6c757d;">Дни</div>
                            <div style="font-weight: bold; font-size: 18px;">${profileData.stats.daysActive || 1}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="profile-bio" style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h5 style="margin-bottom: 10px; color: #495057;">📝 О себе</h5>
                <div class="bio-text" style="color: #333; line-height: 1.5;">
                    ${profileData.bio || 'Пользователь еще не добавил информацию о себе.'}
                </div>
                ${isOwnProfile && !profileData.bio ? `
                    <button class="add-bio-btn" style="margin-top: 10px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">
                        + Добавить описание
                    </button>
                ` : ''}
            </div>

            <div class="profile-gifts">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h5 style="margin: 0; color: #495057;">
                        🎁 Подарки (${userGifts.length})
                    </h5>
                    ${isOwnProfile ? `
                        <div>
                            <button class="manage-gifts-btn" style="padding: 5px 10px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; margin-right: 5px;">
                                🛠️ Управление
                            </button>
                            <button class="open-gift-shop-btn" style="padding: 5px 10px; background: #ffc107; color: #212529; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">
                                🛒 Магазин
                            </button>
                        </div>
                    ` : ''}
                </div>
                
                ${userGifts.length > 0 ? `
                    <div class="gifts-display" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                        gap: 10px;
                        padding: 15px;
                        background: white;
                        border: 1px solid #e9ecef;
                        border-radius: 8px;
                        max-height: 300px;
                        overflow-y: auto;
                    ">
                        ${userGifts.map(gift => this.renderGiftItem(gift, profileData.username, isOwnProfile)).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: 30px; color: #6c757d; background: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 40px; margin-bottom: 10px;">🎁</div>
                        <div>${isOwnProfile ? 'У вас пока нет подарков' : 'У пользователя пока нет подарков'}</div>
                        ${isOwnProfile ? `
                            <button class="open-gift-shop-btn" style="margin-top: 10px; padding: 8px 16px; background: #ffc107; color: #212529; border: none; border-radius: 5px; cursor: pointer;">
                                🛒 Посмотреть магазин
                            </button>
                        ` : ''}
                    </div>
                `}
            </div>

            ${isOwnProfile ? `
                <div class="profile-actions" style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e9ecef;">
                    <button class="btn-primary" onclick="window.currencyManager.openGiftShop()" style="width: 100%; padding: 12px; margin-bottom: 10px;">
                        🛒 Магазин подарков
                    </button>
                    <button class="btn-secondary" onclick="window.settingsManager.openSettings()" style="width: 100%; padding: 10px;">
                        ⚙️ Настройки профиля
                    </button>
                </div>
            ` : ''}
        `;

        // Добавляем обработчики событий
        this.setupProfileEventHandlers(isOwnProfile, profileData.username);
    }

    // Рендер надетых подарков
    renderEquippedGifts(equippedGifts, username) {
        let html = '';
        const userGifts = window.giftManager ? window.giftManager.userGifts.get(username) || [] : [];
        
        Object.entries(equippedGifts).forEach(([slot, giftId]) => {
            if (giftId) {
                const gift = userGifts.find(g => g.id === giftId);
                if (gift) {
                    const positions = {
                        head: 'top: -20px; left: 50%; transform: translateX(-50%);',
                        badge: 'bottom: 10px; right: 10px;',
                        background: 'top: 0; left: 0; width: 100%; height: 100%;',
                        effect: 'top: 50%; left: 50%; transform: translate(-50%, -50%);'
                    };
                    
                    html += `<div class="equipped-gift ${slot}" style="
                        position: absolute; 
                        ${positions[slot] || ''}
                        z-index: ${slot === 'background' ? 1 : 10};
                        font-size: ${slot === 'head' ? '24px' : '20px'};
                    ">${gift.name.split(' ')[0]}</div>`;
                }
            }
        });
        
        return html;
    }

    // Рендер элемента подарка
    renderGiftItem(gift, username, isOwnProfile) {
        const isEquipped = window.giftManager ? window.giftManager.isGiftEquipped(username, gift.id) : false;
        const canEquip = gift.wearable && isOwnProfile;
        
        return `
            <div class="gift-item-profile ${isEquipped ? 'equipped' : ''}" 
                 style="text-align: center; padding: 10px; background: ${isEquipped ? '#e7f3ff' : 'white'}; border-radius: 8px; border: 1px solid ${isEquipped ? '#007bff' : '#dee2e6'}; position: relative;"
                 data-gift-id="${gift.id}">
                ${isEquipped ? '<div style="position: absolute; top: 5px; right: 5px; color: #007bff; font-size: 12px;">✓</div>' : ''}
                <div style="font-size: 24px; margin-bottom: 5px;">${gift.name.split(' ')[0]}</div>
                <div style="font-size: 10px; color: #6c757d; margin-bottom: 8px; height: 30px; overflow: hidden;">${gift.name}</div>
                ${gift.from ? `
                    <div style="font-size: 9px; color: #28a745; margin-bottom: 5px;">
                        от ${gift.from}
                    </div>
                ` : ''}
                ${canEquip ? `
                    <button class="equip-gift-btn" style="
                        padding: 3px 8px; 
                        background: ${isEquipped ? '#dc3545' : '#28a745'}; 
                        color: white; 
                        border: none; 
                        border-radius: 3px; 
                        cursor: pointer; 
                        font-size: 10px;
                        width: 100%;
                    ">
                        ${isEquipped ? 'Снять' : 'Надеть'}
                    </button>
                ` : ''}
                ${!isOwnProfile && window.giftManager ? `
                    <div style="font-size: 9px; color: #6c757d;">
                        ${gift.wearable ? '🎽 Можно надеть' : '📦 Коллекционный'}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Обновленная настройка обработчиков событий
    setupProfileEventHandlers(isOwnProfile, username) {
        if (isOwnProfile) {
            const editBtn = document.querySelector('.edit-profile-btn');
            const giftShopBtn = document.querySelector('.open-gift-shop-btn');
            const addBioBtn = document.querySelector('.add-bio-btn');
            const manageGiftsBtn = document.querySelector('.manage-gifts-btn');

            editBtn?.addEventListener('click', () => {
                this.openEditProfile();
            });

            giftShopBtn?.addEventListener('click', () => {
                if (window.currencyManager) {
                    window.currencyManager.openGiftShop();
                }
            });

            addBioBtn?.addEventListener('click', () => {
                this.editBio();
            });

            manageGiftsBtn?.addEventListener('click', () => {
                this.openGiftManagement();
            });

            // Обработчики для кнопок надевания/снятия подарков
            document.querySelectorAll('.equip-gift-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const giftItem = e.target.closest('.gift-item-profile');
                    const giftId = giftItem.getAttribute('data-gift-id');
                    const gift = window.giftManager.getUserGift(username, giftId);
                    
                    if (gift && gift.wearable) {
                        try {
                            await window.giftManager.toggleGiftEquip(username, giftId, gift.slot);
                            this.showNotification(
                                window.giftManager.isGiftEquipped(username, giftId) 
                                    ? 'Подарок надет!' 
                                    : 'Подарок снят!', 
                                'success'
                            );
                        } catch (error) {
                            this.showNotification(error.message, 'error');
                        }
                    }
                });
            });
            
        } else {
            const sendGiftBtn = document.querySelector('.send-gift-profile-btn');
            sendGiftBtn?.addEventListener('click', () => {
                this.openSendGiftModal(username);
            });
        }
    }

    // Модальное окно отправки подарка
    openSendGiftModal(receiverUsername) {
        const currentUser = document.getElementById('username')?.textContent;
        const userGifts = window.giftManager ? window.giftManager.userGifts.get(currentUser) || [] : [];
        
        const modal = document.createElement('div');
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
                width: 500px;
                max-width: 95%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                    <h3 style="margin: 0; color: #333;">🎁 Отправить подарок</h3>
                    <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
                </div>
                
                <div style="text-align: center; margin-bottom: 20px;">
                    <div>Отправка подарка пользователю</div>
                    <div style="font-weight: bold; font-size: 18px; color: #007bff;">${receiverUsername}</div>
                </div>
                
                ${userGifts.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin-bottom: 15px;">Ваши подарки:</h4>
                        <div class="send-gifts-grid" style="
                            display: grid;
                            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                            gap: 10px;
                            max-height: 300px;
                            overflow-y: auto;
                        ">
                            ${userGifts.map(gift => `
                                <div class="send-gift-item" data-gift-id="${gift.id}" style="
                                    border: 1px solid #dee2e6;
                                    border-radius: 8px;
                                    padding: 10px;
                                    text-align: center;
                                    cursor: pointer;
                                    transition: all 0.3s ease;
                                ">
                                    <div style="font-size: 24px; margin-bottom: 5px;">${gift.name.split(' ')[0]}</div>
                                    <div style="font-size: 11px; color: #6c757d;">${gift.name}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <button id="confirmSendGift" class="btn-primary" disabled style="
                        width: 100%; 
                        padding: 12px; 
                        background: #6c757d; 
                        color: white; 
                        border: none; 
                        border-radius: 8px; 
                        cursor: not-allowed;
                    ">
                        Выберите подарок для отправки
                    </button>
                ` : `
                    <div style="text-align: center; padding: 40px; color: #6c757d;">
                        <div style="font-size: 48px; margin-bottom: 15px;">🎁</div>
                        <div style="margin-bottom: 15px;">У вас нет подарков для отправки</div>
                        <button class="open-gift-shop-btn" style="padding: 10px 20px; background: #ffc107; color: #212529; border: none; border-radius: 5px; cursor: pointer;">
                            🛒 Перейти в магазин
                        </button>
                    </div>
                `}
            </div>
        `;

        document.body.appendChild(modal);

        let selectedGiftId = null;

        // Обработчики событий
        const closeBtn = modal.querySelector('.close-modal');
        const confirmBtn = modal.querySelector('#confirmSendGift');
        const giftShopBtn = modal.querySelector('.open-gift-shop-btn');

        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Выбор подарка
        modal.querySelectorAll('.send-gift-item').forEach(item => {
            item.addEventListener('click', () => {
                modal.querySelectorAll('.send-gift-item').forEach(i => {
                    i.style.background = 'white';
                    i.style.borderColor = '#dee2e6';
                });
                
                item.style.background = '#e7f3ff';
                item.style.borderColor = '#007bff';
                
                selectedGiftId = item.getAttribute('data-gift-id');
                confirmBtn.disabled = false;
                confirmBtn.style.background = '#28a745';
                confirmBtn.style.cursor = 'pointer';
                confirmBtn.textContent = '🎁 Отправить подарок';
            });
        });

        // Подтверждение отправки
        confirmBtn.addEventListener('click', async () => {
            if (!selectedGiftId) return;

            try {
                await window.giftManager.sendGift(currentUser, receiverUsername, selectedGiftId);
                this.showNotification('Подарок успешно отправлен!', 'success');
                modal.remove();
                
                // Обновляем профиль если он открыт
                if (this.currentProfile?.username === receiverUsername) {
                    this.viewProfile(receiverUsername);
                }
                
            } catch (error) {
                this.showNotification(error.message, 'error');
            }
        });

        // Переход в магазин
        giftShopBtn?.addEventListener('click', () => {
            modal.remove();
            if (window.currencyManager) {
                window.currencyManager.openGiftShop();
            }
        });
    }

    // Управление подарками
    openGiftManagement() {
        this.showNotification('Управление подарками будет доступно в следующем обновлении', 'info');
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    if (!window.currencyManager) {
        window.currencyManager = new CurrencyManager();
        console.log('✅ CurrencyManager initialized');
    }
});
// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    if (!window.settingsManager) {
        window.settingsManager = new SettingsManager();
    }
});

// В конце файла, после определения классов
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Starting application initialization...');
    
    try {
        // Инициализируем менеджеры с обработкой ошибок
        if (!window.currencyManager) {
            window.currencyManager = new CurrencyManager();
        }
        
        if (!window.giftManager) {
            window.giftManager = new GiftManager();
        }

        if (!window.settingsManager) {
            window.settingsManager = new SettingsManager();
        }

        // Инициализируем приватный чат с задержкой
        setTimeout(() => {
            if (!window.privateChatInstance) {
                console.log('🔄 Creating PrivateChat instance...');
                try {
                    window.privateChatInstance = new PrivateChat();
                } catch (error) {
                    console.error('❌ Error initializing PrivateChat:', error);
                }
            }
        }, 1000);

        // Инициализируем магазин подарков в настройках
        setTimeout(() => {
            if (window.currencyManager) {
                try {
                    window.currencyManager.setupGiftShopInSettings();
                } catch (error) {
                    console.error('❌ Error setting up gift shop:', error);
                }
            }
        }, 2000);

    } catch (error) {
        console.error('❌ Error during application initialization:', error);
    }
});

// Глобальный обработчик ошибок
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
});
document.addEventListener('DOMContentLoaded', function() {
    if (!window.currencyManager) {
        window.currencyManager = new CurrencyManager();
    }
    
    if (!window.giftManager) {
        window.giftManager = new GiftManager();
    }

    // Инициализируем магазин подарков в настройках
    setTimeout(() => {
        if (window.currencyManager) {
            window.currencyManager.setupGiftShopInSettings();
        }
    }, 2000);
});

// Добавляем обработчик для переключения вкладок в настройках
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('settings-tab') && e.target.getAttribute('data-tab') === 'currency') {
        setTimeout(() => {
            if (window.currencyManager) {
                window.currencyManager.loadGiftsToSettingsShop();
            }
        }, 100);
    }
});
// Экспорт классов для глобального доступа
window.PrivateChat = PrivateChat;
window.GroupChatManager = GroupChatManager;
window.VoiceMessageManager = VoiceMessageManager;
window.CallManager = CallManager;
window.GiftManager = GiftManager;

window.debugCallSystem = function() {
    return {
        callManager: window.callManager,
        privateChat: window.privateChatInstance,
        socket: window.socket,
        mediaDevices: navigator.mediaDevices,
        currentCall: window.callManager ? window.callManager.currentCall : null
    };
};