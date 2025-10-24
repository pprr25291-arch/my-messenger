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
        this.addTypingIndicatorStyles(); // Добавляем стили для типинга
        this.setupAdminPanelTabs();
        this.setupAdminNotificationHandler();
        this.setupGroupFeatures();
        this.setupEmojiPicker();
        this.setupTypingHandlers(); // Добавляем обработчики типинга
        
        this.isInitialized = true;
        console.log('✅ Private chat initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing PrivateChat:', error);
        this.showNotification('Ошибка инициализации приватного чата', 'error');
        this.createFallbackUI();
    }
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
                    width: 600px;
                    max-width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                ">
                    <div class="admin-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                        <h3 style="margin: 0;">🔧 Панель администратора</h3>
                        <button class="close-admin-panel" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
                    </div>
                    
                    <div class="admin-tabs" style="display: flex; gap: 10px; margin-bottom: 20px;">
                        <button class="admin-tab-btn active" data-tab="system" style="padding: 10px 15px; border: none; background: #007bff; color: white; border-radius: 5px; cursor: pointer;">📢 Системные уведомления</button>
                        <button class="admin-tab-btn" data-tab="users" style="padding: 10px 15px; border: none; background: #6c757d; color: white; border-radius: 5px; cursor: pointer;">👥 Управление пользователями</button>
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
                    </div>
                </div>
            `;
            
            document.body.appendChild(adminPanel);
        }

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
    }

    setupEventListeners() {
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
    
    // Обработчик приватных сообщений
    window.socket.on('private message', (data) => {
        console.log('📨 Private message received:', data);
        this.handleIncomingMessage(data);
    });

    // Обработчик групповых сообщений
    window.socket.on('group_message', (data) => {
        console.log('📨 Group message received in PrivateChat:', data);
        this.handleIncomingGroupMessage(data);
    });

    // Обработчик обновления списка диалогов
    window.socket.on('conversations updated', () => {
        console.log('🔄 Conversations updated event received');
        this.loadConversations();
    });

    // Обработчик изменения статуса пользователей
    window.socket.on('user-status-changed', (data) => {
        console.log('🔄 User status changed via socket:', data);
        
        // Обновляем набор онлайн пользователей
        if (data.status === 'online') {
            this.onlineUsers.add(data.username);
        } else if (data.status === 'offline') {
            this.onlineUsers.delete(data.username);
        }
        
        // Обновляем статусы в интерфейсе
        this.updateOnlineStatuses();
        
        // Обновляем список диалогов
        this.loadConversations();
    });

    // Обработчик создания группы
    window.socket.on('group_created', (data) => {
        console.log('👥 Group created event:', data);
        if (window.groupChatManager) {
            window.groupChatManager.handleGroupCreated(data);
        }
        this.loadConversations();
    });

    // Обработчик обновления информации о группе
    window.socket.on('group_updated', (data) => {
        console.log('👥 Group updated event:', data);
        if (window.groupChatManager && this.currentGroup && this.currentGroup.id === data.groupId) {
            // Обновляем информацию о текущей группе если она активна
            this.currentGroup = { ...this.currentGroup, ...data.groupData };
        }
        this.loadConversations();
    });

    // Обработчик добавления в группу
    window.socket.on('user_added_to_group', (data) => {
        console.log('👥 User added to group:', data);
        const currentUser = document.getElementById('username')?.textContent;
        if (currentUser && data.members && data.members.includes(currentUser)) {
            this.showNotification(`Вас добавили в группу "${data.groupName}"`, 'info');
            this.loadConversations();
        }
    });

    // Обработчик удаления из группы
    window.socket.on('user_removed_from_group', (data) => {
        console.log('👥 User removed from group:', data);
        const currentUser = document.getElementById('username')?.textContent;
        if (currentUser && data.removedUser === currentUser) {
            this.showNotification(`Вас удалили из группы "${data.groupName}"`, 'warning');
            // Закрываем групповой чат если он активен
            if (window.groupChatManager?.currentGroup && window.groupChatManager.currentGroup.id === data.groupId) {
                window.groupChatManager.closeGroupChat();
            }
            this.loadConversations();
        }
    });

    // Обработчик системных уведомлений
    window.socket.on('system_notification', (data) => {
        console.log('📢 System notification received:', data);
        this.showNotification(data.message, data.type || 'info');
    });

    // Обработчик ошибок
    window.socket.on('error', (data) => {
        console.error('❌ Socket error:', data);
        this.showNotification(data.message || 'Произошла ошибка', 'error');
    });

    // Обработчик подключения
    window.socket.on('connect', () => {
        console.log('✅ Socket connected for PrivateChat');
        this.showNotification('Соединение установлено', 'success');
        
        // Загружаем данные после подключения
        setTimeout(() => {
            this.loadConversations();
        }, 1000);
    });

    // Обработчик отключения
    window.socket.on('disconnect', (reason) => {
        console.log('⚠️ Socket disconnected:', reason);
        this.showNotification('Соединение прервано', 'error');
    });

    // Обработчик переподключения
    window.socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
        this.showNotification('Соединение восстановлено', 'success');
        
        // Перезагружаем данные после переподключения
        setTimeout(() => {
            this.loadConversations();
        }, 500);
    });

    // Обработчик списка онлайн пользователей
    window.socket.on('online_users', (data) => {
        console.log('👥 Online users received:', data.users);
        if (data.users && Array.isArray(data.users)) {
            // Обновляем набор онлайн пользователей
            this.onlineUsers = new Set(data.users);
            this.updateOnlineStatuses();
        }
    });

    // Обработчик истории сообщений
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

    // Обработчик подтверждения доставки сообщения
    window.socket.on('message_delivered', (data) => {
        console.log('✅ Message delivered:', data.messageId);
        // Можно добавить визуальное подтверждение доставки
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

    // Обработчик прочтения сообщения
    window.socket.on('message_read', (data) => {
        console.log('👀 Message read:', data.messageId);
        // Можно добавить визуальное подтверждение прочтения
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

    // Обработчик типинга (пользователь печатает)
    window.socket.on('user_typing', (data) => {
        console.log('⌨️ User typing:', data);
        if (this.currentChat === data.sender) {
            this.showTypingIndicator(data.sender);
        }
    });

    // Обработчик остановки типинга
    window.socket.on('user_stopped_typing', (data) => {
        console.log('💤 User stopped typing:', data);
        if (this.currentChat === data.sender) {
            this.hideTypingIndicator();
        }
    });

    // Обработчик обновления профиля пользователя
    window.socket.on('user_profile_updated', (data) => {
        console.log('👤 User profile updated:', data);
        // Можно обновить отображение информации о пользователе если нужно
        if (this.currentChat === data.username) {
            this.showNotification(`Пользователь ${data.username} обновил профиль`, 'info');
        }
    });

    // Обработчик новых файлов
    window.socket.on('new_file_uploaded', (data) => {
        console.log('📁 New file uploaded:', data);
        if (data.sender === this.currentChat || 
            (window.groupChatManager?.currentGroup && data.groupId === window.groupChatManager.currentGroup.id)) {
            this.showNotification(`Новый файл от ${data.sender}`, 'info');
        }
    });

    // Обработчик голосовых сообщений
    window.socket.on('voice_message_received', (data) => {
        console.log('🎵 Voice message received:', data);
        // Обработка голосовых сообщений уже есть в основном обработчике сообщений
    });

    // Обработчик запроса истории чата
    window.socket.on('chat_history_response', (data) => {
        console.log('📜 Chat history response:', data);
        if (data.chatId && data.messages) {
            if (data.chatType === 'private' && this.currentChat === data.chatId) {
                this.displayMessageHistory(data.messages);
            } else if (data.chatType === 'group' && window.groupChatManager?.currentGroup?.id === data.chatId) {
                window.groupChatManager.displayGroupMessages(data.messages);
            }
        }
    });

    console.log('✅ PrivateChat socket listeners setup completed');
}

// Добавляем вспомогательные методы для обработки событий

showTypingIndicator(username) {
    const messagesContainer = document.getElementById('privateMessages');
    if (!messagesContainer) return;

    // Удаляем существующий индикатор
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

// Метод для отправки события типинга
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

// Добавляем стили для индикатора типинга
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
            /* Существующие стили... */
            
            /* Стили для плеера голосовых сообщений */
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
            userElement.innerHTML = `
                <div class="search-user-info">
                    <span class="search-avatar">👤</span>
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
        if (isGroup) {
            const group = {
                id: groupId,
                name: username
            };
            await window.groupChatManager.openGroupChat(group);
        } else {
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
            
            try {
                const response = await fetch(`/api/messages/private/${username}`);
                if (!response.ok) throw new Error('Failed to load messages');
                const messages = await response.json();
                this.displayMessageHistory(messages);
            } catch (error) {
                this.showNotification('Ошибка загрузки сообщений', 'error');
            }
        }
        
        this.loadConversations();
    }

    async loadConversations() {
        try {
            const response = await fetch('/api/conversations');
            if (!response.ok) throw new Error('Failed to load conversations');
            const privateConversations = await response.json();
            
            let groups = [];
            try {
                groups = await window.groupChatManager?.loadUserGroups() || [];
            } catch (groupError) {
                console.error('Error loading groups:', groupError);
            }
            
            this.conversations = [
                ...privateConversations,
                ...groups
            ];
            
            this.removeDuplicateConversations();
            this.displayConversations();
        } catch (error) {
            console.error('Error loading conversations:', error);
            const container = document.getElementById('conversationsList');
            if (container) {
                container.innerHTML = '<div class="conversation-item empty">Ошибка загрузки диалогов</div>';
            }
            this.showNotification('Ошибка загрузки диалогов', 'error');
        }
    }

    removeDuplicateConversations() {
        const seen = new Set();
        this.conversations = this.conversations.filter(conv => {
            const identifier = conv.isGroup ? `group_${conv.id}` : `user_${conv.username}`;
            if (seen.has(identifier)) {
                return false;
            }
            seen.add(identifier);
            return true;
        });
    }

    displayConversations() {
        const container = document.getElementById('conversationsList');
        if (!container) return;
        
        container.innerHTML = '';

        if (this.conversations.length === 0) {
            container.innerHTML = '<div class="conversation-item empty">Нет диалогов</div>';
            return;
        }

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
            const avatar = isGroup ? '👥' : '👤';
            
            const memberInfo = isGroup ? 
                `<div class="conv-members">${conversation.memberCount || conversation.members?.length || 0} участников</div>` : '';

            convElement.innerHTML = `
                <div class="conv-info">
                    <div class="conv-header">
                        <span class="conv-name">${avatar} ${isGroup ? conversation.name : conversation.username} ${onlineIndicator}</span>
                        ${lastMsg ? `<span class="conv-time">${lastMsg.timestamp}</span>` : ''}
                    </div>
                    <div class="conv-preview">${preview}</div>
                    ${memberInfo}
                </div>
            `;

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

    displayMessageHistory(messages) {
        const container = document.getElementById('privateMessages');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="no-messages">📝 Начните общение первым!</div>';
            return;
        }
        
        messages.sort((a, b) => new Date(a.date) - new Date(b.date));
        messages.forEach(message => this.displayMessage(message, false));
        this.scrollToBottom();
    }

   displayMessage(message, shouldScroll = true) {
    const container = document.getElementById('privateMessages');
    if (!container) return;
    
    const noMessagesElement = container.querySelector('.no-messages');
    if (noMessagesElement) noMessagesElement.remove();
    
    const currentUsername = document.getElementById('username')?.textContent;
    const isOwn = message.sender === currentUsername;
    
    // Проверяем тип сообщения
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

 

    handleIncomingGroupMessage(data) {
        console.log('🔄 Handling incoming group message in PrivateChat:', data);
        
        if (window.groupChatManager?.currentGroup && 
            data.groupId === window.groupChatManager.currentGroup.id) {
            console.log('✅ Displaying group message in current group chat');
            window.groupChatManager.displayGroupMessage(data, true);
        }
        
        this.loadConversations();
    }

 handleIncomingMessage(data) {
    if (this.currentChat && 
        ((data.sender === this.currentChat && data.receiver === document.getElementById('username')?.textContent) ||
         (data.receiver === this.currentChat && data.sender === document.getElementById('username')?.textContent))) {
        
        console.log('📨 Displaying incoming message:', data.messageType, data);
        this.displayMessage(data, true);
    }
    this.loadConversations();
}
handleUserStatusChange(data) {
    console.log('🔄 User status changed:', data);
    
    // Обновляем набор онлайн пользователей
    if (data.status === 'online') {
        this.onlineUsers.add(data.username);
    } else if (data.status === 'offline') {
        this.onlineUsers.delete(data.username);
    }
    
    // Обновляем статусы в интерфейсе
    this.updateOnlineStatuses();
    
    // Обновляем список диалогов
    this.loadConversations();
}

    updateOnlineStatuses() {
        if (this.currentChat) {
            const currentUserStatus = document.getElementById('currentUserStatus');
            if (currentUserStatus) {
                const isOnline = this.onlineUsers.has(this.currentChat);
                currentUserStatus.textContent = isOnline ? 'online' : 'offline';
                currentUserStatus.className = `user-status ${isOnline ? 'online' : 'offline'}`;
            }
        }
        
        const conversationItems = document.querySelectorAll('.conversation-item');
        conversationItems.forEach(item => {
            const usernameElement = item.querySelector('.conv-name');
            if (usernameElement) {
                const username = usernameElement.textContent.split(' ')[0];
                const isOnline = this.onlineUsers.has(username);
                const onlineDot = isOnline ? '<span class="online-dot"></span>' : '';
                usernameElement.innerHTML = `${username} ${onlineDot}`;
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
    // Добавьте этот метод в класс PrivateChat
updateOnlineStatuses() {
    console.log('🔄 Updating online statuses...');
    
    // Обновляем статус в активном чате
    if (this.currentChat) {
        const currentUserStatus = document.getElementById('currentUserStatus');
        if (currentUserStatus) {
            const isOnline = this.onlineUsers.has(this.currentChat);
            currentUserStatus.textContent = isOnline ? 'online' : 'offline';
            currentUserStatus.className = `user-status ${isOnline ? 'online' : 'offline'}`;
        }
    }
    
    // Обновляем статусы в списке диалогов
    const conversationItems = document.querySelectorAll('.conversation-item:not(.group-item)');
    conversationItems.forEach(item => {
        const usernameElement = item.querySelector('.conv-name');
        if (usernameElement) {
            // Извлекаем имя пользователя из текста (убираем эмодзи и пробелы)
            const text = usernameElement.textContent.trim();
            const username = text.replace(/^👤\s*/, '').split(' ')[0]; // Убираем эмодзи и берем первое слово
            
            if (username) {
                const isOnline = this.onlineUsers.has(username);
                const onlineDot = isOnline ? '<span class="online-dot"></span>' : '';
                
                // Сохраняем текущее содержимое и добавляем/обновляем онлайн индикатор
                const currentContent = usernameElement.innerHTML;
                const baseContent = currentContent.replace(/<span class="online-dot"><\/span>/g, '');
                usernameElement.innerHTML = baseContent + onlineDot;
            }
        }
    });
    
    // Обновляем статусы в результатах поиска
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
// В класс PrivateChat добавьте этот метод
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

// Метод для воспроизведения голосовых сообщений
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
            console.log('🎯 Click event:', e.target.className);
            
            if (e.target.classList.contains('video-call-btn')) {
                console.log('🎯 Video call button clicked');
                const username = this.getCurrentChatUser();
                if (username) {
                    this.initiateCall(username, 'video');
                }
            }
            
            if (e.target.classList.contains('audio-call-btn')) {
                console.log('🎯 Audio call button clicked');
                const username = this.getCurrentChatUser();
                if (username) {
                    this.initiateCall(username, 'audio');
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

        // Обработчик подключения
        window.socket.on('connect', () => {
            console.log('✅ Socket connected for CallManager');
        });

        // Обработчик отключения
        window.socket.on('disconnect', (reason) => {
            console.log('⚠️ Socket disconnected:', reason);
            this.showNotification('Соединение прервано', 'error');
        });

        // Обработчик переподключения
        window.socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
            this.showNotification('Соединение восстановлено', 'success');
        });

        // Обработчики трансляции экрана
        window.socket.on('screen_share_started', (data) => {
            console.log('🖥️ Screen share started by:', data.sharer);
            this.handleIncomingScreenShare(data);
        });

        window.socket.on('screen_share_ended', (data) => {
            console.log('🖥️ Screen share ended by:', data.sharer);
            this.handleScreenShareEnded(data);
        });
        window.socket.on('screen_share_started', (data) => {
    console.log('🖥️ Screen share started by:', data.sharer);
    
    // Показываем информативное уведомление
    this.showNotification(
        `${data.sharer} начал трансляцию экрана. ` +
        'Вы можете просматривать трансляцию в окне звонка.', 
        'info'
    );
    
    // Обновляем интерфейс если мы в активном звонке
    if (this.currentCall && 
        ((this.isInitiator && this.currentCall.targetUser === data.sharer) ||
         (!this.isInitiator && this.currentCall.caller === data.sharer))) {
        
        // Показываем индикатор трансляции
        this.showRemoteScreenShare(data);
        
        // Для аудиозвонков предлагаем переключиться на видео
        if (this.currentCall.type === 'audio') {
            this.showNotification(
                `Собеседник начал трансляцию экрана. ` +
                `Рекомендуется перейти на видеозвонок для лучшего просмотра.`, 
                'warning'
            );
        }
    }
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

    // Метод для отображения трансляции от собеседника
    showRemoteScreenShare(data) {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        const isVideoCall = this.currentCall.type === 'video';
        
        if (isVideoCall) {
            this.setupRemoteScreenShareForVideoCall();
        } else {
            this.setupRemoteScreenShareForAudioCall();
        }
    }

    setupRemoteScreenShareForVideoCall() {
        const callContent = document.querySelector('.call-content');
        if (!callContent) return;

        callContent.innerHTML = `
            <div class="video-call-with-screen-share">
                <div class="remote-video-container">
                    <video id="remoteScreenShare" autoplay playsinline></video>
                    <div class="remote-screen-share-badge">🖥️ Экран собеседника</div>
                </div>
                <div class="local-video-container">
                    <video id="localVideo" autoplay playsinline muted></video>
                    <div class="screen-share-badge">📹 Ваша камера</div>
                </div>
            </div>
        `;

        // Устанавливаем локальное видео
        const localVideo = document.getElementById('localVideo');
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
            localVideo.play().catch(e => console.error('Local video play error:', e));
        }
    }

    setupRemoteScreenShareForAudioCall() {
        const callContent = document.querySelector('.call-content');
        if (!callContent) return;

        callContent.innerHTML = `
            <div class="audio-call-with-screen-share">
                <div class="audio-user-section">
                    <div class="audio-icon">🖥️</div>
                    <div class="audio-user-name">${this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller}</div>
                    <div class="audio-call-status">Собеседник транслирует экран</div>
                    <audio id="remoteAudio" autoplay style="display: none;"></audio>
                </div>
                <div class="screen-share-section">
                    <video id="remoteScreenShare" autoplay playsinline class="screen-share-video"></video>
                    <div class="remote-screen-share-badge">🖥️ Экран собеседника</div>
                </div>
            </div>
        `;
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
    handleIncomingScreenShare(data) {
        console.log('🖥️ Incoming screen share from:', data.sharer);
        
        if (this.currentCall && 
            ((this.isInitiator && this.currentCall.targetUser === data.sharer) ||
             (!this.isInitiator && this.currentCall.caller === data.sharer))) {
            
            this.showNotification(`${data.sharer} начал трансляцию экрана`, 'info');
            
            // Ждем немного чтобы трек успел добавиться
            setTimeout(() => {
                this.showRemoteScreenShare(data);
            }, 1000);
        }
    }

    // Обработчик остановки трансляции от собеседника
    handleScreenShareEnded(data) {
        console.log('🖥️ Screen share ended by:', data.sharer);
        
        if (this.currentCall && 
            ((this.isInitiator && this.currentCall.targetUser === data.sharer) ||
             (!this.isInitiator && this.currentCall.caller === data.sharer))) {
            
            this.showNotification(`${data.sharer} остановил трансляцию экрана`, 'info');
            this.updateCallInterface(); // Восстанавливаем обычный интерфейс
        }
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
                iceCandidatePoolSize: 10
            };

            this.peerConnection = new RTCPeerConnection(configuration);
            this.pendingIceCandidates = [];

            // Добавляем обработчики для отладки
            this.peerConnection.onconnectionstatechange = () => {
                console.log('🔗 Connection state:', this.peerConnection.connectionState);
                if (this.peerConnection.connectionState === 'connected') {
                    console.log('✅ Peer connection established successfully');
                }
            };

            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
            };

            this.peerConnection.onsignalingstatechange = () => {
                console.log('📡 Signaling state:', this.peerConnection.signalingState);
            };

            // Обработчик входящих потоков
            this.peerConnection.ontrack = (event) => {
                console.log('📹 Remote track received:', event.track.kind, event.track.label);
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
            };

            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate && window.socket) {
                    console.log('📤 Sending ICE candidate');
                    window.socket.emit('webrtc_ice_candidate', {
                        callId: this.currentCall.id,
                        candidate: event.candidate,
                        targetUser: this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller
                    });
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
        if (!this.peerConnection) {
            console.log('⚠️ No peer connection yet, caching ICE candidate');
            if (!this.pendingIceCandidates) {
                this.pendingIceCandidates = [];
            }
            this.pendingIceCandidates.push(data.candidate);
            return;
        }

        try {
            // Проверяем, установлено ли удаленное описание
            if (!this.peerConnection.remoteDescription) {
                console.log('⚠️ Remote description not set yet, caching ICE candidate');
                // Кэшируем кандидата для добавления позже
                if (!this.pendingIceCandidates) {
                    this.pendingIceCandidates = [];
                }
                this.pendingIceCandidates.push(data.candidate);
                return;
            }

            console.log('✅ Adding ICE candidate:', data.candidate);
            await this.peerConnection.addIceCandidate(data.candidate);
            
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
        this.setupCallMedia(); // ИСПРАВЛЕННЫЙ ВЫЗОВ МЕТОДА
        this.setupCallModalHandlers();
    }

    // ДОБАВЛЕННЫЙ МЕТОД setupCallMedia
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

   async toggleScreenShare() {
    try {
        // Проверяем поддержку браузера
        if (!this.checkScreenShareSupport()) {
            return;
        }

        if (!this.isScreenSharing) {
            await this.startScreenShare();
        } else {
            await this.stopScreenShare();
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

    // Добавляем кнопку завершения игры если это игровой звонок
    if (this.currentCall && this.currentCall.isGameCall) {
        const endGameBtn = document.createElement('button');
        endGameBtn.className = 'end-game-btn call-control';
        endGameBtn.innerHTML = '🎮';
        endGameBtn.title = 'Завершить игру';
        endGameBtn.onclick = () => this.endGame();
        controlsContainer.appendChild(endGameBtn);
    }
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
        
        this.setupSocketListeners();
        this.setupVoiceMessageHandlers();
        console.log('✅ GroupChatManager initialized');
    }

    setupVoiceMessageHandlers() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('group-voice-message-btn')) {
                this.openGroupVoiceRecordModal();
            }
        });
    }

    openGroupVoiceRecordModal() {
        if (!this.currentGroup) {
            this.showNotification('Выберите группу для отправки голосового сообщения', 'error');
            return;
        }

        if (window.voiceMessageManager) {
            window.voiceMessageManager.openVoiceRecordModal();
            
            const originalSendVoiceMessage = window.voiceMessageManager.sendVoiceMessage;
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
                        let errorText;
                        try {
                            errorText = await response.text();
                        } catch {
                            errorText = `HTTP ${response.status}`;
                        }
                        throw new Error(`Upload failed: ${response.status} ${errorText}`);
                    }
                    
                    const result = await response.json();
                    console.log('Group voice upload successful:', result);
                    
                    if (!result.success) {
                        throw new Error(result.error || 'Upload failed');
                    }
                    
                    this.sendGroupVoiceMessage(result.file, duration);
                    window.voiceMessageManager.closeVoiceRecordModal();
                    window.voiceMessageManager.sendVoiceMessage = originalSendVoiceMessage;
                    
                } catch (error) {
                    console.error('Error sending group voice message:', error);
                    window.voiceMessageManager.showError('Ошибка отправки голосового сообщения: ' + error.message);
                }
            };
        }
    }

    async sendGroupVoiceMessage(fileData, duration) {
        if (!this.currentGroup) {
            this.showNotification('Ошибка: группа не выбрана', 'error');
            return;
        }

        const currentUser = document.getElementById('username')?.textContent;
        
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
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        };

        console.log('📤 Sending group voice message:', messageData);

        if (this.pendingMessages.has(messageData.id)) {
            console.log('⚠️ Voice message already pending, skipping:', messageData.id);
            return;
        }
        this.pendingMessages.add(messageData.id);

        if (window.socket) {
            window.socket.emit('group_message', messageData);
        } else {
            console.warn('Socket not available, showing message locally');
            this.displayGroupMessage(messageData, true);
            this.saveLocalGroupMessage(this.currentGroup.id, messageData);
        }

        setTimeout(() => {
            this.pendingMessages.delete(messageData.id);
        }, 3000);
        
        if (window.privateChatInstance) {
            window.privateChatInstance.loadConversations();
        }
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
        console.log('🔄 Loading available users...');
        
        try {
            const container = document.getElementById('availableUsers');
            if (!container) {
                console.error('❌ Available users container not found');
                return;
            }

            container.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: #666; font-style: italic; background: #f8f9fa; border-radius: 8px; border: 1px dashed #dee2e6;">Загрузка пользователей...</div>';

            const testUsers = this.createTestUsers();
            console.log('✅ Using test users:', testUsers);
            this.displayAvailableUsers(testUsers);
            
            try {
                const serverUsers = await this.loadUsersFromServer();
                if (serverUsers && serverUsers.length > 0) {
                    console.log('✅ Server users loaded:', serverUsers);
                    this.displayAvailableUsers(serverUsers);
                }
            } catch (serverError) {
                console.log('⚠️ Using test users only:', serverError.message);
            }
            
        } catch (error) {
            console.error('❌ Error loading users:', error);
            this.showAvailableUsersError(error.message);
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

    async loadUserGroups() {
        try {
            let groups = [];
            try {
                const response = await fetch('/api/user/groups');
                if (response.ok) {
                    groups = await response.json();
                    console.log('✅ Groups loaded from API:', groups);
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (apiError) {
                console.log('⚠️ Using local groups storage:', apiError.message);
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
                                lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
                            }
                        } catch (messageError) {
                            console.log(`No messages for group ${group.id}`);
                        }
                        
                        return {
                            ...group,
                            isGroup: true,
                            lastMessage: lastMessage ? {
                                text: lastMessage.message,
                                timestamp: lastMessage.timestamp,
                                sender: lastMessage.sender,
                                type: lastMessage.messageType || 'text',
                                isOwn: lastMessage.sender === currentUser
                            } : null
                        };
                    } catch (error) {
                        console.error(`Error processing group ${group.id}:`, error);
                        return {
                            ...group,
                            isGroup: true,
                            lastMessage: null
                        };
                    }
                })
            );
            
            return groupsWithMessages;
            
        } catch (error) {
            console.error('Error loading user groups:', error);
            return [];
        }
    }

    getLocalGroups() {
        const localGroups = JSON.parse(localStorage.getItem('localGroups') || '[]');
        console.log('📂 Local groups:', localGroups);
        return localGroups;
    }

    saveLocalGroup(group) {
        const localGroups = this.getLocalGroups();
        localGroups.push(group);
        localStorage.setItem('localGroups', JSON.stringify(localGroups));
    }

    async openGroupChat(group) {
        this.currentGroup = group;
        this.displayedMessageIds.clear();
        
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
            openVoiceModal: () => this.openGroupVoiceRecordModal()
        };
        
        if (closeBtn) closeBtn.addEventListener('click', this.groupChatHandlers.closeChat);
        if (sendButton) sendButton.addEventListener('click', this.groupChatHandlers.sendMessage);
        if (messageInput) messageInput.addEventListener('keypress', this.groupChatHandlers.keypressMessage);
        if (attachBtn) attachBtn.addEventListener('click', this.groupChatHandlers.attachFile);
        if (fileInput) fileInput.addEventListener('change', this.groupChatHandlers.fileInputChange);
        if (emojiPickerBtn) emojiPickerBtn.addEventListener('click', this.groupChatHandlers.toggleEmojiPicker);
        if (voiceBtn) voiceBtn.addEventListener('click', this.groupChatHandlers.openVoiceModal);
        
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
        if (voiceBtn) voiceBtn.removeEventListener('click', this.groupChatHandlers.openVoiceModal);
        
        this.groupChatHandlers = null;
        console.log('Group chat event listeners removed');
    }

    setupGroupEmojiPicker() {
        const emojiPicker = document.getElementById('groupEmojiPicker');
        if (!emojiPicker) return;
        
        const emojiCategories = {
            "😊 Люди": ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠"],
            "🐶 Животные": ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷", "🕸", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐕‍🦺", "🐈", "🐓", "🦃", "🦚", "🦜", "🦢", "🦩", "🐇", "🦝", "🦨", "🦡", "🦦", "🦥", "🐁", "🐀", "🐿", "🦔"],
            "🍎 Еда": ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🥘", "🫕", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "🍼", "🫖", "☕", "🍵", "🧃", "🥤", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🧉", "🍾", "🧊", "🥄", "🍴", "🍽", "🥣", "🥡", "🥢"],
            "⚽ Спорт": ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸", "🥌", "🎿", "⛷", "🏂", "🪂", "🏋️", "🤼", "🤸", "⛹️", "🤾", "🚴", "🚵", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚵", "🎯", "🎮", "🎲", "🎳", "♟", "🎭", "🎨", "🎪", "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻", "🎬", "🏆", "🎖", "🏅", "🥇", "🥈", "🥉"],
            "🚗 Транспорт": ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🦯", "🦽", "🦼", "🛴", "🚲", "🛵", "🏍", "🛺", "🚨", "🚔", "🚍", "🚘", "🚖", "🚡", "🚠", "🚟", "🚃", "🚋", "🚞", "🚝", "🚄", "🚅", "🚈", "🚂", "🚆", "🚇", "🚊", "🚉", "✈️", "🛫", "🛬", "🛩", "💺", "🛰", "🚀", "🛸", "🚁", "🛶", "⛵", "🚤", "🛥", "🛳", "⛴", "🚢", "⚓", "⛽", "🚧", "🚦", "🚥", "🚏", "🗺", "🗿", "🗽", "🗼", "🏰", "🏯", "🏟", "🎡", "🎢", "🎠", "⛲", "⛱", "🏖", "🏝", "🏜", "🌋", "⛰", "🏔", "🗻", "🏕", "🏠", "🏡", "🏘", "🏚", "🏗", "🏭", "🏢", "🏬", "🏣", "🏤", "🏥", "🏦", "🏨", "🏪", "🏫", "🏩", "💒", "🏛", "⛪", "🕌", "🕍", "🛕", "🕋", "⛩"]
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
            
            this.displayGroupMessages(messages);
        } catch (error) {
            console.error('Error loading group messages:', error);
            const container = document.getElementById('groupMessages');
            if (container) {
                container.innerHTML = '<div class="no-messages">❌ Ошибка загрузки сообщений</div>';
            }
        }
    }

    getLocalGroupMessages(groupId) {
        const localMessages = JSON.parse(localStorage.getItem('groupMessages') || '{}');
        return localMessages[groupId] || [];
    }

    saveLocalGroupMessage(groupId, message) {
        const localMessages = JSON.parse(localStorage.getItem('groupMessages') || '{}');
        if (!localMessages[groupId]) {
            localMessages[groupId] = [];
        }
        
        const existingIndex = localMessages[groupId].findIndex(msg => 
            msg.id === message.id || 
            (msg.sender === message.sender && 
             msg.message === message.message && 
             Math.abs(new Date(msg.date) - new Date(message.date)) < 1000)
        );
        
        if (existingIndex === -1) {
            localMessages[groupId].push(message);
            localStorage.setItem('groupMessages', JSON.stringify(localMessages));
        } else {
            console.log('⚠️ Duplicate message detected, not saving locally');
        }
    }

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

    removeDuplicateMessages(messages) {
        const seen = new Set();
        return messages.filter(message => {
            const identifier = message.id || `${message.sender}_${message.message}_${message.timestamp}`;
            if (seen.has(identifier)) {
                return false;
            }
            seen.add(identifier);
            return true;
        });
    }

    displayGroupMessage(message, shouldScroll = true) {
        const container = document.getElementById('groupMessages');
        if (!container) return;
        
        if (this.displayedMessageIds.has(message.id)) {
            console.log('⚠️ Message already displayed, skipping:', message.id, message.message);
            return;
        }
        
        this.displayedMessageIds.add(message.id);
        
        const noMessagesElement = container.querySelector('.no-messages');
        if (noMessagesElement) noMessagesElement.remove();
        
        const currentUsername = document.getElementById('username')?.textContent;
        const isOwn = message.sender === currentUsername;
        
        const messageElement = document.createElement('div');
        messageElement.className = `private-message ${isOwn ? 'own' : 'other'}`;
        messageElement.setAttribute('data-message-id', message.id);
        
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
        
        console.log('✅ Message displayed:', message.id, message.messageType);
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
            this.playGroupVoiceMessage(e.target, message.fileData.path, duration);
        });

        const container = document.getElementById('groupMessages');
        if (container) {
            container.appendChild(messageElement);
        }
    }

    playGroupVoiceMessage(button, audioUrl, duration) {
        if (button.classList.contains('playing')) {
            if (this.currentGroupAudio) {
                this.currentGroupAudio.pause();
                this.currentGroupAudio = null;
            }
            button.classList.remove('playing');
            button.innerHTML = '▶️';
            return;
        }

        if (this.currentGroupAudio) {
            this.currentGroupAudio.pause();
        }

        this.currentGroupAudio = new Audio(audioUrl);
        
        const player = button.closest('.voice-message-player');
        const progressBar = player?.querySelector('.voice-progress');
        const durationDisplay = player?.querySelector('.voice-duration');

        this.currentGroupAudio.addEventListener('loadedmetadata', () => {
            button.classList.add('playing');
            button.innerHTML = '⏸️';
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

        this.currentGroupAudio.play();
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
            '</3': '💔',
            ':heart:': '❤️',
            ':smile:': '😊',
            ':laughing:': '😆',
            ':wink:': '😉',
            ':cool:': '😎',
            ':kiss:': '😘',
            ':cry:': '😢',
            ':angry:': '😠',
            ':thumbsup:': '👍',
            ':thumbsdown:': '👎',
            ':fire:': '🔥',
            ':star:': '⭐',
            ':clap:': '👏',
            ':ok_hand:': '👌',
            ':pray:': '🙏',
            ':muscle:': '💪',
            ':100:': '💯'
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

  // В классе GroupChatManager замените метод setupSocketListeners:

setupSocketListeners() {
    if (!window.socket) return;
    
    window.socket.on('private message', (data) => {
        this.handleIncomingMessage(data);
    });

    window.socket.on('group_message', (data) => {
        console.log('📨 Group message received in PrivateChat:', data);
        this.handleIncomingGroupMessage(data);
    });

    window.socket.on('conversations updated', () => {
        this.loadConversations();
    });

    window.socket.on('user-status-changed', (data) => {
        // Вместо вызова несуществующего метода, обновляем статусы через PrivateChat
        if (window.privateChatInstance && window.privateChatInstance.handleUserStatusChange) {
            window.privateChatInstance.handleUserStatusChange(data);
        }
    });

    // Обработчики для трансляции экрана
    window.socket.on('screen_share_started', (data) => {
        console.log('🖥️ Screen share started by:', data.sharer);
        this.showNotification(`${data.sharer} начал трансляцию экрана`, 'info');
        
        // Обновляем интерфейс если мы в активном звонке
        if (this.currentCall && 
            ((this.isInitiator && this.currentCall.targetUser === data.sharer) ||
             (!this.isInitiator && this.currentCall.caller === data.sharer))) {
            this.updateCallInterface();
        }
    });

    window.socket.on('screen_share_ended', (data) => {
        console.log('🖥️ Screen share ended by:', data.sharer);
        this.showNotification(`${data.sharer} остановил трансляцию экрана`, 'info');
        
        // Обновляем интерфейс если мы в активном звонке
        if (this.currentCall && 
            ((this.isInitiator && this.currentCall.targetUser === data.sharer) ||
             (!this.isInitiator && this.currentCall.caller === data.sharer))) {
            this.updateCallInterface();
        }
    });
    // Обработчик начала трансляции экрана от собеседника
window.socket.on('screen_share_started', (data) => {
    console.log('🖥️ Screen share started by:', data.sharer);
    this.showNotification(`${data.sharer} начал трансляцию экрана`, 'info');
    
    // Обновляем интерфейс для отображения трансляции
    if (this.currentCall && 
        ((this.isInitiator && this.currentCall.targetUser === data.sharer) ||
         (!this.isInitiator && this.currentCall.caller === data.sharer))) {
        
        // Показываем индикатор трансляции
        this.showRemoteScreenShare(data);
        
        // Автоматически переключаемся на видео если это аудиозвонок
        if (this.currentCall.type === 'audio') {
            this.showNotification(`Собеседник начал трансляцию экрана. Рекомендуется перейти на видеозвонок.`, 'warning');
        }
    }
});

// Обработчик остановки трансляции экрана от собеседника
window.socket.on('screen_share_ended', (data) => {
    console.log('🖥️ Screen share ended by:', data.sharer);
    this.showNotification(`${data.sharer} остановил трансляцию экрана`, 'info');
    
    // Скрываем индикатор трансляции
    if (this.currentCall && 
        ((this.isInitiator && this.currentCall.targetUser === data.sharer) ||
         (!this.isInitiator && this.currentCall.caller === data.sharer))) {
        this.hideRemoteScreenShare(data);
    }
});
}

// Также добавьте недостающие методы в GroupChatManager:

handleIncomingMessage(data) {
    // Обработка входящих приватных сообщений (если нужно)
    console.log('Private message in GroupChatManager:', data);
}

async loadConversations() {
    try {
        // Делегируем загрузку диалогов PrivateChat
        if (window.privateChatInstance) {
            await window.privateChatInstance.loadConversations();
        }
    } catch (error) {
        console.error('Error loading conversations in GroupChatManager:', error);
    }
}

// В классе PrivateChat убедитесь, что метод handleUserStatusChange существует:

handleUserStatusChange(data) {
    console.log('🔄 User status changed:', data);
    
    // Обновляем набор онлайн пользователей
    if (data.status === 'online') {
        this.onlineUsers.add(data.username);
    } else if (data.status === 'offline') {
        this.onlineUsers.delete(data.username);
    }
    
    // Обновляем статусы в интерфейсе
    this.updateOnlineStatuses();
    
    // Обновляем список диалогов
    this.loadConversations();
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

class VoiceMessageManager {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingStartTime = 0;
        this.recordingTimer = null;
        this.audioContext = null;
        this.analyser = null;
        this.canvasContext = null;
        this.currentAudio = null;
        this.recordedBlob = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupVisualization();
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('voice-message-btn')) {
                this.openVoiceRecordModal();
            }
        });

        this.setupModalEvents();
    }

    setupModalEvents() {
        const modal = document.getElementById('voiceRecordModal');
        if (!modal) return;

        const closeBtn = modal.querySelector('.close-modal');
        const startBtn = document.getElementById('startRecordingBtn');
        const stopBtn = document.getElementById('stopRecordingBtn');
        const playBtn = document.getElementById('playRecordingBtn');
        const sendBtn = document.getElementById('sendVoiceBtn');
        const cancelBtn = document.getElementById('cancelRecordingBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeVoiceRecordModal());
        }

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startRecording());
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopRecording());
        }

        if (playBtn) {
            playBtn.addEventListener('click', () => this.playRecording());
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendVoiceMessage());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeVoiceRecordModal());
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeVoiceRecordModal();
            }
        });
    }

    setupVisualization() {
        const canvas = document.getElementById('voiceVisualization');
        if (canvas) {
            this.canvasContext = canvas.getContext('2d');
        }
    }

    async openVoiceRecordModal() {
        const modal = document.getElementById('voiceRecordModal');
        if (!modal) return;

        this.resetRecording();
        modal.style.display = 'flex';
        
        try {
            await this.checkMicrophonePermission();
        } catch (error) {
            this.showError('Не удалось получить доступ к микрофону');
            console.error('Microphone access error:', error);
        }
    }

    closeVoiceRecordModal() {
        const modal = document.getElementById('voiceRecordModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        if (this.isRecording) {
            this.stopRecording();
        }
        
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        
        this.resetRecording();
    }

    async checkMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            stream.getTracks().forEach(track => track.stop());
            
            return true;
        } catch (error) {
            throw new Error('Microphone permission denied');
        }
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

            this.setupAudioVisualization(stream);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.enablePlaybackControls();
                
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            this.updateUIForRecording();
            this.startTimer();

        } catch (error) {
            console.error('Recording error:', error);
            this.showError('Ошибка записи: ' + error.message);
        }
    }

    setupAudioVisualization(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(stream);
        
        source.connect(this.analyser);
        this.analyser.fftSize = 256;
        
        this.drawVisualization();
    }

    drawVisualization() {
        if (!this.isRecording || !this.analyser || !this.canvasContext) return;

        const canvas = document.getElementById('voiceVisualization');
        if (!canvas) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        requestAnimationFrame(() => this.drawVisualization());

        this.analyser.getByteFrequencyData(dataArray);

        this.canvasContext.fillStyle = 'rgb(248, 249, 250)';
        this.canvasContext.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;

            const gradient = this.canvasContext.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#dc3545');
            gradient.addColorStop(1, '#ff6b6b');
            
            this.canvasContext.fillStyle = gradient;
            this.canvasContext.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.stopTimer();
            this.updateUIForStopped();
        }
    }

    startTimer() {
        this.recordingTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            
            const timerElement = document.getElementById('recordingTimer');
            if (timerElement) {
                timerElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            }

            if (seconds >= 300) {
                this.stopRecording();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    playRecording() {
        if (!this.recordedBlob) return;

        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        const audioURL = URL.createObjectURL(this.recordedBlob);
        this.currentAudio = new Audio(audioURL);
        
        this.currentAudio.addEventListener('loadedmetadata', () => {
            this.updatePlaybackControls();
        });
        
        this.currentAudio.addEventListener('ended', () => {
            const playBtn = document.getElementById('playRecordingBtn');
            if (playBtn) {
                playBtn.innerHTML = '▶️ Прослушать';
                playBtn.classList.remove('playing');
            }
        });

        this.currentAudio.play();
        
        const playBtn = document.getElementById('playRecordingBtn');
        if (playBtn) {
            playBtn.innerHTML = '⏸️ Пауза';
            playBtn.classList.add('playing');
        }
    }

    updatePlaybackControls() {
    }

   async sendVoiceMessage() {
    if (!this.recordedBlob) {
        this.showError('Нет записанного сообщения'); // This should be showNotification
        return;
    }

    const duration = Date.now() - this.recordingStartTime;
    if (duration < 1000) {
        this.showError('Сообщение слишком короткое (минимум 1 секунда)'); // This should be showNotification
        return;
    }

    try {
        const formData = new FormData();
        const filename = `voice_message_${Date.now()}.webm`;
        
        const voiceFile = new File([this.recordedBlob], filename, {
            type: 'audio/webm'
        });
        
        formData.append('file', voiceFile);

        console.log('Uploading voice message...');

        const response = await fetch('/api/upload-voice', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch {
                errorText = `HTTP ${response.status}`;
            }
            throw new Error(`Upload failed: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Upload successful:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Upload failed');
        }
        
        this.sendVoiceToChat(result.file, duration);
        this.closeVoiceRecordModal();
        
    } catch (error) {
        console.error('Error sending voice message:', error);
        this.showNotification('Ошибка отправки голосового сообщения: ' + error.message, 'error');
    }
}

    async convertToMP3(webmBlob) {
        return webmBlob;
    }

  sendVoiceToChat(fileData, duration) {
    const currentUser = document.getElementById('username')?.textContent;
    const currentChat = window.privateChatInstance?.currentChat;
    
    if (!currentUser || !currentChat) {
        this.showError('Не выбран чат для отправки');
        return;
    }

    const voiceMessageData = {
        sender: currentUser,
        receiver: currentChat,
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

    if (window.socket) {
        window.socket.emit('private message', voiceMessageData);
    } else {
        console.error('Socket not available');
        this.showError('Нет соединения с сервером');
        return;
    }

    // Отображаем сообщение локально
    if (window.privateChatInstance) {
        window.privateChatInstance.displayMessage(voiceMessageData, true);
    }

    this.showNotification('Голосовое сообщение отправлено', 'success');
}

    updateUIForRecording() {
        const startBtn = document.getElementById('startRecordingBtn');
        const stopBtn = document.getElementById('stopRecordingBtn');
        const playBtn = document.getElementById('playRecordingBtn');
        const sendBtn = document.getElementById('sendVoiceBtn');
        const status = document.getElementById('recordingStatus');

        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        if (playBtn) playBtn.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        if (status) {
            status.innerHTML = '<span class="recording-indicator"></span>Идет запись...';
        }

        const voiceBtn = document.querySelector('.voice-message-btn');
        if (voiceBtn) {
            voiceBtn.classList.add('recording');
        }
    }

    updateUIForStopped() {
        const startBtn = document.getElementById('startRecordingBtn');
        const stopBtn = document.getElementById('stopRecordingBtn');
        const playBtn = document.getElementById('playRecordingBtn');
        const sendBtn = document.getElementById('sendVoiceBtn');
        const status = document.getElementById('recordingStatus');

        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (playBtn) playBtn.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        if (status) {
            status.textContent = 'Запись завершена';
        }

        const voiceBtn = document.querySelector('.voice-message-btn');
        if (voiceBtn) {
            voiceBtn.classList.remove('recording');
        }
    }

    enablePlaybackControls() {
        const playBtn = document.getElementById('playRecordingBtn');
        const sendBtn = document.getElementById('sendVoiceBtn');
        
        if (playBtn) playBtn.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
    }

    resetRecording() {
        this.audioChunks = [];
        this.isRecording = false;
        this.recordedBlob = null;
        this.recordingStartTime = 0;
        
        this.stopTimer();
        
        const timerElement = document.getElementById('recordingTimer');
        if (timerElement) {
            timerElement.textContent = '00:00';
        }
        
        const statusElement = document.getElementById('recordingStatus');
        if (statusElement) {
            statusElement.textContent = 'Готов к записи...';
        }

        if (this.canvasContext) {
            const canvas = document.getElementById('voiceVisualization');
            if (canvas) {
                this.canvasContext.fillStyle = 'rgb(248, 249, 250)';
                this.canvasContext.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
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
            background: #dc3545;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    displayVoiceMessage(message, isOwn = false) {
        const container = document.getElementById('privateMessages');
        if (!container) return;

        const messageElement = document.createElement('div');
        messageElement.className = `private-message ${isOwn ? 'own' : 'other'}`;
        
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

function createVoiceRecordModal() {
    if (document.getElementById('voiceRecordModal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'voiceRecordModal';
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
            padding: 25px;
            border-radius: 15px;
            width: 400px;
            max-width: 90%;
            text-align: center;
        ">
            <div class="modal-header" style="margin-bottom: 20px;">
                <h3 style="margin: 0;">🎤 Запись голосового сообщения</h3>
                <button class="close-modal" style="
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    position: absolute;
                    top: 15px;
                    right: 15px;
                ">✕</button>
            </div>
            
            <div class="recording-status" id="recordingStatus" style="margin-bottom: 15px;">
                Готов к записи...
            </div>
            
            <div class="recording-timer" id="recordingTimer" style="
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 20px;
            ">00:00</div>
            
            <canvas id="voiceVisualization" width="300" height="80" style="
                width: 100%;
                height: 80px;
                background: #f8f9fa;
                border-radius: 8px;
                margin-bottom: 20px;
            "></canvas>
            
            <div class="recording-controls" style="display: flex; gap: 10px; justify-content: center;">
                <button id="startRecordingBtn" style="
                    padding: 10px 20px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">🎤 Начать запись</button>
                <button id="stopRecordingBtn" disabled style="
                    padding: 10px 20px;
                    background: #dc3545;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: not-allowed;
                ">⏹️ Остановить</button>
            </div>
            
            <div class="playback-controls" style="margin-top: 15px;">
                <button id="playRecordingBtn" disabled style="
                    padding: 8px 16px;
                    background: #17a2b8;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: not-allowed;
                    margin-right: 10px;
                ">▶️ Прослушать</button>
                <button id="sendVoiceBtn" disabled style="
                    padding: 8px 16px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: not-allowed;
                ">📤 Отправить</button>
            </div>
            
            <div style="margin-top: 15px;">
                <button id="cancelRecordingBtn" style="
                    padding: 8px 16px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">❌ Отмена</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

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

document.addEventListener('DOMContentLoaded', function() {
    if (!window.callManager) {
        window.callManager = new CallManager();
        console.log('✅ CallManager initialized globally');
    }
    
    console.log('🚀 Initializing chat system...');
    
    createVoiceRecordModal();
    
    if (!window.privateChatInstance) {
        window.privateChatInstance = new PrivateChat();
        console.log('✅ PrivateChat initialized globally');
    }
    
    if (!window.groupChatManager) {
        window.groupChatManager = new GroupChatManager();
        console.log('✅ GroupChatManager initialized globally');
    }
    
    if (!window.voiceMessageManager) {
        window.voiceMessageManager = new VoiceMessageManager();
        console.log('✅ VoiceMessageManager initialized globally');
    }
    
    initializeCallButtons();
});

window.PrivateChat = PrivateChat;
window.GroupChatManager = GroupChatManager;
window.VoiceMessageManager = VoiceMessageManager;
window.CallManager = CallManager;

window.debugCallSystem = function() {
    return {
        callManager: window.callManager,
        privateChat: window.privateChatInstance,
        socket: window.socket,
        mediaDevices: navigator.mediaDevices,
        currentCall: window.callManager ? window.callManager.currentCall : null
    };
};