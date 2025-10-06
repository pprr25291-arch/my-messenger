// private-chat.js - Полная реализация приватного чата

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
        
        // Улучшенная инициализация
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
            
            // Получаем имя пользователя
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
            
            this.createUI();
            this.setupEventListeners();
            this.setupSocketListeners();
            this.loadConversations();
            this.setupFileInput();
            this.setupImageErrorHandling();
            this.addCustomStyles();
            this.setupAdminPanelTabs();
            this.setupAdminNotificationHandler();
            this.setupGroupFeatures();
            
            this.isInitialized = true;
            console.log('✅ Private chat initialized successfully');
            
            // Показываем уведомление об успешной инициализации
            setTimeout(() => {
                this.showNotification('Приватный чат готов к использованию', 'success');
            }, 1000);
            
        } catch (error) {
            console.error('❌ Error initializing PrivateChat:', error);
            this.showNotification('Ошибка инициализации приватного чата', 'error');
            
            // Показываем fallback интерфейс
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
                            <div class="call-buttons">
                                <button class="call-btn video-call-btn" title="Видеозвонок">📹</button>
                                <button class="call-btn audio-call-btn" title="Аудиозвонок">📞</button>
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
                                <button type="button" class="attach-file" title="Прикрепить файл">📎</button>
                                <button type="button" class="send-button">Отправить</button>
                                <input type="file" id="fileInput" style="display: none;" 
                                       accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.tar,.gz,.mp3,.wav,.ogg,.mp4,.mov,.avi,.mkv,.json,.xml"
                                       multiple>
                            </div>
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
        this.setupCallButtonHandlers();
    }

    createModals() {
        // УБРАЛИ создание модального окна для групп здесь - оно будет создаваться в GroupChatManager
        
        // Админ-панель
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

        // Модальное окно для просмотра изображений
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

            // Обработчики для закрытия просмотра изображений
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

        // Окно звонка
        if (!document.getElementById('callWindow')) {
            const callWindow = document.createElement('div');
            callWindow.id = 'callWindow';
            callWindow.className = 'call-window';
            callWindow.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 0 20px rgba(0,0,0,0.3);
                z-index: 10000;
                min-width: 400px;
                display: none;
            `;
            
            callWindow.innerHTML = `
                <div class="call-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0;">📞 Звонок</h3>
                    <span id="callTimer" style="font-weight: bold;">00:00</span>
                </div>
                <div class="video-container" style="margin-bottom: 15px;">
                    <video id="localVideo" autoplay muted style="width: 100%; max-width: 300px; border-radius: 8px;"></video>
                    <video id="remoteVideo" autoplay style="width: 100%; max-width: 300px; border-radius: 8px;"></video>
                </div>
                <div class="call-controls" style="display: flex; gap: 10px; justify-content: center;">
                    <button class="mute-btn" style="padding: 10px; border: none; border-radius: 50%; background: #6c757d; color: white; cursor: pointer;">🎤</button>
                    <button class="video-btn" style="padding: 10px; border: none; border-radius: 50%; background: #6c757d; color: white; cursor: pointer;">📹</button>
                    <button class="end-call-btn" style="padding: 10px; border: none; border-radius: 50%; background: #dc3545; color: white; cursor: pointer;">📞</button>
                </div>
            `;
            
            document.body.appendChild(callWindow);
        }

        // Окно входящего звонка
        if (!document.getElementById('incomingCallWindow')) {
            const incomingCallWindow = document.createElement('div');
            incomingCallWindow.id = 'incomingCallWindow';
            incomingCallWindow.className = 'incoming-call-window';
            incomingCallWindow.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 0 20px rgba(0,0,0,0.3);
                z-index: 10000;
                min-width: 300px;
                display: none;
            `;
            
            incomingCallWindow.innerHTML = `
                <div class="incoming-call-content" style="text-align: center;">
                    <div class="call-icon" style="font-size: 48px; margin-bottom: 10px;">📞</div>
                    <h3 style="margin: 0 0 10px 0;">Входящий звонок</h3>
                    <p style="margin: 0 0 20px 0;">От: <span id="callerName"></span></p>
                    <div class="call-buttons" style="display: flex; gap: 10px; justify-content: center;">
                        <button class="accept-call-btn" style="padding: 10px 20px; border: none; border-radius: 5px; background: #28a745; color: white; cursor: pointer;">Принять</button>
                        <button class="reject-call-btn" style="padding: 10px 20px; border: none; border-radius: 5px; background: #dc3545; color: white; cursor: pointer;">Отклонить</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(incomingCallWindow);
        }

        // Установка обработчиков событий для модальных окон
        this.setupModalEventListeners();
    }

    setupModalEventListeners() {
        // Обработчики для админ-панели
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
            
            // Закрытие по клику вне области
            adminPanel.addEventListener('click', (e) => {
                if (e.target === adminPanel) {
                    adminPanel.style.display = 'none';
                }
            });
        }
    }

    setupEventListeners() {
        // Используем делегирование событий для динамически созданных элементов
        document.addEventListener('click', (e) => {
            // Поиск пользователей
            if (e.target.id === 'searchClear') {
                const userSearch = document.getElementById('userSearch');
                const results = document.getElementById('searchResults');
                if (userSearch) userSearch.value = '';
                if (results) {
                    results.innerHTML = '';
                    results.style.display = 'none';
                }
            }

            // Отправка сообщений
            if (e.target.classList.contains('send-button')) {
                this.sendPrivateMessage();
            }

            // Закрытие чата
            if (e.target.classList.contains('close-chat')) {
                this.closeCurrentChat();
            }

            // Прикрепление файлов
            if (e.target.classList.contains('attach-file')) {
                const fileInput = document.getElementById('fileInput');
                if (fileInput) fileInput.click();
            }

            // Админ-панель
            if (e.target.classList.contains('admin-panel-btn')) {
                this.toggleAdminPanel();
            }
        });

        // Поиск пользователей с дебаунсингом
        const userSearch = document.getElementById('userSearch');
        if (userSearch) {
            userSearch.addEventListener('input', this.debounce(() => {
                this.searchUsers();
            }, 300));
        }

        // Отправка сообщения по Enter
        const messageInput = document.getElementById('privateMessageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendPrivateMessage();
            });
        }

        // Обработка выбора файлов
        this.setupFileInput();

        // Закрытие результатов поиска при клике вне области
        document.addEventListener('click', (e) => {
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer && !searchContainer.contains(e.target)) {
                const results = document.getElementById('searchResults');
                if (results) results.style.display = 'none';
            }
        });

        // Кнопки звонков
        this.setupCallButtons();
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

    setupCallButtonHandlers() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('mute-btn')) {
                window.callManager?.toggleMute();
            } else if (e.target.classList.contains('video-btn')) {
                window.callManager?.toggleVideo();
            } else if (e.target.classList.contains('screen-share-btn')) {
                window.callManager?.toggleScreenShare();
            } else if (e.target.classList.contains('end-call-btn')) {
                window.callManager?.endCall();
            } else if (e.target.classList.contains('accept-call-btn')) {
                window.callManager?.acceptCall(true);
            } else if (e.target.classList.contains('reject-call-btn')) {
                window.callManager?.rejectCall();
            }
        });
    }

    setupCallButtons() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('video-call-btn')) {
                this.initiateCall(true);
            } else if (e.target.classList.contains('audio-call-btn')) {
                this.initiateCall(false);
            }
        });
    }

    async initiateCall(isVideoCall) {
        if (!this.currentChat) {
            this.showNotification('Выберите собеседника для звонка', 'error');
            return;
        }
        
        if (!window.callManager) {
            window.callManager = new WebRTCCallManager();
        }
        
        const mediaCheck = await window.callManager.checkMediaPermissions(isVideoCall, true);
        if (!mediaCheck.hasPermission) {
            this.showNotification(mediaCheck.error || `Для ${isVideoCall ? 'видеозвонка' : 'аудиозвонка'} разрешите доступ к устройствам`, 'error');
            return;
        }
        
        window.callManager.initCall(this.currentChat, isVideoCall);
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
                
                // Используем существующий GroupChatManager или создаем новый
                if (!window.groupChatManager) {
                    window.groupChatManager = new GroupChatManager();
                    console.log('GroupChatManager created');
                }
                
                // Проверяем, не открыто ли уже модальное окно
                const existingModal = document.getElementById('createGroupModal');
                if (existingModal) {
                    console.log('Using existing modal');
                    existingModal.style.display = 'flex';
                    window.groupChatManager.loadAvailableUsers();
                } else {
                    console.log('Creating new modal');
                    window.groupChatManager.showCreateGroupModal();
                }
            }
        });
    }

    addCustomStyles() {
        if (!document.getElementById('private-chat-styles')) {
            const styles = document.createElement('style');
            styles.id = 'private-chat-styles';
            styles.textContent = `
                .private-chat-layout {
                    display: flex;
                    height: 70vh;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .private-chat-sidebar {
                    width: 300px;
                    border-right: 1px solid #ddd;
                    background: #f8f9fa;
                    display: flex;
                    flex-direction: column;
                }
                
                .private-chat-main {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                
                .conversation-item {
                    padding: 10px;
                    border-bottom: 1px solid #eee;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                
                .conversation-item:hover {
                    background: #e9ecef;
                }
                
                .conversation-item.active {
                    background: #007bff;
                    color: white;
                }
                
                .call-window {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.3);
                    z-index: 10000;
                    min-width: 400px;
                }
                
                .incoming-call-window {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.3);
                    z-index: 10000;
                }
            `;
            document.head.appendChild(styles);
        }
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

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

    // ========== ОСНОВНЫЕ ФУНКЦИИ ЧАТА ==========

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
        // Открываем групповой чат
        const group = {
            id: groupId,
            name: username
        };
        await window.groupChatManager.openGroupChat(group);
    } else {
        // Существующая логика для приватных чатов
        this.currentChat = username;
        
        const searchResults = document.getElementById('searchResults');
        const userSearch = document.getElementById('userSearch');
        const noChatSelected = document.getElementById('noChatSelected');
        const activeChat = document.getElementById('activeChat');
        
        if (searchResults) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
        }
        if (userSearch) userSearch.value = '';
        if (noChatSelected) noChatSelected.style.display = 'none';
        if (activeChat) activeChat.style.display = 'flex';
        
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
        // Загружаем приватные диалоги
        const response = await fetch('/api/conversations');
        if (!response.ok) throw new Error('Failed to load conversations');
        this.conversations = await response.json();
        
        // Загружаем группы
        const groups = await window.groupChatManager.loadUserGroups();
        
        // Добавляем группы в список диалогов
        this.conversations = [
            ...this.conversations,
            ...groups.map(group => ({
                username: group.name,
                isGroup: true,
                groupId: group.id,
                lastMessage: group.lastMessage ? {
                    text: group.lastMessage.text,
                    timestamp: group.lastMessage.timestamp,
                    isOwn: group.lastMessage.sender === this.currentUser,
                    type: group.lastMessage.type || 'text'
                } : null
            }))
        ];
        
        this.displayConversations();
    } catch (error) {
        const container = document.getElementById('conversationsList');
        if (container) {
            container.innerHTML = '<div class="conversation-item empty">Ошибка загрузки диалогов</div>';
        }
        this.showNotification('Ошибка загрузки диалогов', 'error');
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

    this.conversations.forEach(conversation => {
        const convElement = document.createElement('div');
        const isGroup = conversation.isGroup;
        const isActive = isGroup ? 
            (window.groupChatManager.currentGroup && window.groupChatManager.currentGroup.id === conversation.groupId) :
            (conversation.username === this.currentChat);
            
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

        convElement.innerHTML = `
            <div class="conv-info">
                <div class="conv-name">${avatar} ${conversation.username} ${onlineIndicator}</div>
                <div class="conv-preview">${preview}</div>
            </div>
            ${lastMsg ? `<div class="conv-time">${lastMsg.timestamp}</div>` : ''}
        `;

        convElement.addEventListener('click', () => {
            if (isGroup) {
                this.startChat(conversation.username, true, conversation.groupId);
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
        
        if (message.messageType === 'file') {
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
                    <div class="message-text">${message.message}</div>
                </div>
            `;
            
            container.appendChild(messageElement);
        }
        
        if (shouldScroll) this.scrollToBottom();
    }

    displayFileMessage(message, isOwn) {
        const container = document.getElementById('privateMessages');
        if (!container) return;

        const messageElement = document.createElement('div');
        messageElement.className = `private-message ${isOwn ? 'own' : 'other'}`;
        
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

    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

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
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <button style="
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
            " onclick="this.parentElement.remove()">✕</button>
            <div style="max-width: 90vw; max-height: 90vh;">
                <img src="${imageUrl}" alt="Просмотр изображения" 
                     style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
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
        if (noChatSelected) noChatSelected.style.display = 'flex';
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

    setupSocketListeners() {
        if (!window.socket) return;
        
        window.socket.on('private message', (data) => {
            this.handleIncomingMessage(data);
        });

        window.socket.on('conversations updated', () => {
            this.loadConversations();
        });

        window.socket.on('user-status-changed', (data) => {
            this.handleUserStatusChange(data);
        });

        window.socket.on('call-offer', (data) => {
            if (!window.callManager) window.callManager = new WebRTCCallManager();
            window.callManager.handleIncomingOffer(data.offer, data.caller, data.audioOnly);
        });
        
        window.socket.on('call-answer', (data) => {
            if (window.callManager) window.callManager.handleAnswer(data.answer);
        });
        
        window.socket.on('ice-candidate', (data) => {
            if (window.callManager) window.callManager.handleICECandidate(data.candidate);
        });
        
        window.socket.on('call-end', () => {
            if (window.callManager) window.callManager.endCall();
        });
    }

    handleIncomingMessage(data) {
        if (this.currentChat && 
            ((data.sender === this.currentChat && data.receiver === document.getElementById('username')?.textContent) ||
             (data.receiver === this.currentChat && data.sender === document.getElementById('username')?.textContent))) {
            this.displayMessage(data, true);
        }
        this.loadConversations();
    }

    handleUserStatusChange(data) {
        if (data.isOnline) {
            this.onlineUsers.add(data.username);
        } else {
            this.onlineUsers.delete(data.username);
        }
        this.updateOnlineStatuses();
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
        const oldNotifications = document.querySelectorAll('.notification');
        oldNotifications.forEach(notif => notif.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 5px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            max-width: 300px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        const colors = {
            error: '#dc3545',
            warning: '#ffc107',
            success: '#28a745',
            info: '#17a2b8'
        };
        
        notification.style.background = colors[type] || colors.info;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 3000);
    }

    // ========== АДМИН-ПАНЕЛЬ МЕТОДЫ ==========

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
                
                // Очищаем поля
                titleInput.value = '';
                messageInput.value = '';
                if (targetUserInput) {
                    targetUserInput.value = '';
                }
                
                // Закрываем админ-панель
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
}

// ========== КЛАСС ДЛЯ УПРАВЛЕНИЯ ЗВОНКАМИ ==========

class WebRTCCallManager {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isCaller = false;
        this.isInCall = false;
        this.isMuted = false;
        this.isVideoDisabled = false;
        this.isScreenSharing = false;
        this.callTimer = null;
        this.callDuration = 0;
        this.currentCall = null;
        this.pendingOffer = null;
        this.audioOnly = false;
    }

    async checkMediaPermissions(video = true, audio = true) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideo = devices.some(device => device.kind === 'videoinput' && device.deviceId);
            const hasAudio = devices.some(device => device.kind === 'audioinput' && device.deviceId);
            
            return { 
                hasVideo, 
                hasAudio, 
                hasPermission: true 
            };
            
        } catch (error) {
            console.error('Media permission check failed:', error);
            return { 
                hasVideo: false, 
                hasAudio: false, 
                hasPermission: false,
                error: 'Не удалось проверить доступ к медиаустройствам'
            };
        }
    }

    async initCall(targetUsername, isVideoCall = true) {
        if (this.isInCall) {
            this.showNotification('Уже в звонке', 'error');
            return;
        }

        this.currentCall = targetUsername;
        this.isCaller = true;
        
        try {
            const mediaCheck = await this.checkMediaPermissions(isVideoCall, true);
            
            if (!mediaCheck.hasPermission) {
                this.showNotification('Разрешите доступ к камере и микрофону для звонка', 'error');
                return;
            }

            const constraints = {
                video: isVideoCall && mediaCheck.hasVideo ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 24 }
                } : false,
                audio: mediaCheck.hasAudio ? {
                    echoCancellation: true,
                    noiseSuppression: true
                } : false
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.createPeerConnection();
            
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: isVideoCall
            });
            
            await this.peerConnection.setLocalDescription(offer);
            
            if (window.socket) {
                window.socket.emit('call-offer', {
                    target: targetUsername,
                    offer: offer
                });
                
                this.showCallWindow(true, isVideoCall);
                const callType = isVideoCall ? 'видео' : 'аудио';
                this.showNotification(`Звонок ${targetUsername} (${callType})...`, 'info');
            }
            
        } catch (error) {
            console.error('Error initializing call:', error);
            this.showNotification(`Ошибка инициализации звонка: ${error.message}`, 'error');
            this.endCall();
        }
    }

    createPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };
        
        this.peerConnection = new RTCPeerConnection(configuration);
        
        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            this.updateRemoteVideo();
        };
        
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.peerConnection && this.currentCall) {
                window.socket.emit('ice-candidate', {
                    target: this.currentCall,
                    candidate: event.candidate
                });
            }
        };
    }

    async handleIncomingOffer(offer, caller) {
        if (this.isInCall) {
            if (window.socket) {
                window.socket.emit('call-end', { target: caller });
            }
            return;
        }

        this.currentCall = caller;
        this.isCaller = false;
        this.pendingOffer = offer;
        
        this.showIncomingCallWindow(caller);
    }

    async acceptCall(isVideoCall = true) {
        try {
            const mediaCheck = await this.checkMediaPermissions(isVideoCall, true);
            
            if (!mediaCheck.hasPermission) {
                this.showNotification('Разрешите доступ к устройствам для принятия звонка', 'error');
                return;
            }

            const constraints = {
                video: isVideoCall && mediaCheck.hasVideo ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 24 }
                } : false,
                audio: mediaCheck.hasAudio ? {
                    echoCancellation: true,
                    noiseSuppression: true
                } : false
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.createPeerConnection();
            
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            await this.peerConnection.setRemoteDescription(this.pendingOffer);
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            if (window.socket) {
                window.socket.emit('call-answer', {
                    target: this.currentCall,
                    answer: answer
                });
                
                this.showCallWindow(false, isVideoCall);
                this.hideIncomingCallWindow();
                this.showNotification('Звонок начат', 'success');
            }
            
        } catch (error) {
            console.error('Error accepting call:', error);
            this.showNotification(`Ошибка принятия звонка: ${error.message}`, 'error');
            this.endCall();
        }
    }

    rejectCall() {
        if (window.socket && this.currentCall) {
            window.socket.emit('call-end', { target: this.currentCall });
        }
        this.endCall();
        this.showNotification('Звонок отклонен', 'info');
    }

    async handleAnswer(answer) {
        try {
            if (!this.peerConnection) return;
            await this.peerConnection.setRemoteDescription(answer);
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleICECandidate(candidate) {
        try {
            if (!this.peerConnection) return;
            await this.peerConnection.addIceCandidate(candidate);
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    endCall() {
        this.stopCallTimer();
        this.isInCall = false;
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.hideCallWindow();
        this.hideIncomingCallWindow();
        
        if (this.currentCall && window.socket) {
            window.socket.emit('call-end', { target: this.currentCall });
        }
        
        this.currentCall = null;
        this.pendingOffer = null;
    }

    toggleMute() {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                this.isMuted = !audioTracks[0].enabled;
                audioTracks.forEach(track => {
                    track.enabled = !this.isMuted;
                });
                this.showNotification(this.isMuted ? '🔇 Микрофон выключен' : '🎤 Микрофон включен', 'info');
            }
        }
    }

    toggleVideo() {
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            if (videoTracks.length > 0) {
                this.isVideoDisabled = !videoTracks[0].enabled;
                videoTracks.forEach(track => {
                    track.enabled = !this.isVideoDisabled;
                });
                this.showNotification(this.isVideoDisabled ? '📹 Камера выключена' : '📹 Камера включена', 'info');
            }
        }
    }

    startCallTimer() {
        this.callDuration = 0;
        this.callTimer = setInterval(() => {
            this.callDuration++;
            this.updateCallTimer();
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }

    updateCallTimer() {
        const minutes = Math.floor(this.callDuration / 60);
        const seconds = this.callDuration % 60;
        const timerElement = document.getElementById('callTimer');
        
        if (timerElement) {
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    updateRemoteVideo() {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
        }
    }

    showCallWindow(isCaller, isVideoCall = true) {
        const callWindow = document.getElementById('callWindow');
        if (callWindow) {
            callWindow.style.display = 'block';
            
            if (!isVideoCall) {
                const videoContainer = callWindow.querySelector('.video-container');
                if (videoContainer) {
                    videoContainer.innerHTML = `
                        <div class="audio-call-placeholder">
                            <div class="audio-icon">📞</div>
                            <div class="audio-user-name">${this.currentCall}</div>
                            <div class="audio-status">Аудиозвонок</div>
                        </div>
                    `;
                }
            }
        }
    }

    hideCallWindow() {
        const callWindow = document.getElementById('callWindow');
        if (callWindow) {
            callWindow.style.display = 'none';
        }
    }

    showIncomingCallWindow(caller) {
        const incomingCallWindow = document.getElementById('incomingCallWindow');
        const callerNameElement = document.getElementById('callerName');
        
        if (incomingCallWindow && callerNameElement) {
            callerNameElement.textContent = caller;
            incomingCallWindow.style.display = 'block';
        }
    }

    hideIncomingCallWindow() {
        const incomingCallWindow = document.getElementById('incomingCallWindow');
        if (incomingCallWindow) {
            incomingCallWindow.style.display = 'none';
        }
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
        `;
        
        const colors = {
            error: '#dc3545',
            warning: '#ffc107',
            success: '#28a745',
            info: '#17a2b8'
        };
        
        notification.style.background = colors[type] || colors.info;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }
}

// ========== КЛАСС ДЛЯ ГРУППОВЫХ ЧАТОВ ==========

class GroupChatManager {
    constructor() {
        this.groups = new Map();
        this.currentGroup = null;
        this.selectedUsers = new Set();
        this.modal = null;
    }

    // Показ модального окна создания группы
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
                            <div id="availableUsers" class="users-list"></div>
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 15px; color: #2c3e50;">Выбранные участники:</label>
                        <div class="selected-users-container" style="min-height: 100px; max-height: 150px; overflow-y: auto; border: 2px dashed #dee2e6; padding: 15px; border-radius: 10px; background: #f8f9fa;">
                            <div id="selectedUsers" class="selected-users"></div>
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
            const response = await fetch('/api/users/all');
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            const users = await response.json();
            
            const container = document.getElementById('availableUsers');
            if (!container) return;
            
            container.innerHTML = '';
            
            if (!users || users.length === 0) {
                container.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: #666; font-style: italic; background: #f8f9fa; border-radius: 8px; border: 1px dashed #dee2e6;">Нет доступных пользователей</div>';
                return;
            }
            
            const currentUser = document.getElementById('username')?.textContent;
            
            users.forEach(user => {
                if (!user || !user.username) return;
                if (user.username === currentUser) return;
                
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
                
                const isOnline = user.isOnline === true;
                const statusClass = isOnline ? 'online' : 'offline';
                const statusText = isOnline ? 'online' : 'offline';
                
                userElement.innerHTML = `
                    <input type="checkbox" value="${user.username}" style="margin-right: 15px; transform: scale(1.3); cursor: pointer;">
                    <span class="user-avatar" style="margin-right: 12px; font-size: 18px; width: 32px; height: 32px; background: linear-gradient(45deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">👤</span>
                    <span class="user-name" style="flex: 1; font-size: 15px; font-weight: 500; color: #2c3e50;">${user.username}</span>
                    <span class="user-status ${statusClass}" style="font-size: 12px; padding: 4px 10px; border-radius: 12px; font-weight: 500; flex-shrink: 0; background: ${isOnline ? '#d4edda' : '#e2e3e5'}; color: ${isOnline ? '#155724' : '#6c757d'}; border: 1px solid ${isOnline ? '#c3e6cb' : '#d6d8db'};">${statusText}</span>
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
            
        } catch (error) {
            console.error('Error loading users:', error);
            const container = document.getElementById('availableUsers');
            if (container) {
                container.innerHTML = `
                    <div style="padding: 40px 20px; text-align: center; color: #dc3545;">
                        <div>❌ Ошибка загрузки пользователей</div>
                        <div style="font-size: 12px; margin-top: 5px;">${error.message}</div>
                        <button onclick="window.groupChatManager.loadAvailableUsers()" 
                                style="margin-top: 10px; padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            Повторить
                        </button>
                    </div>
                `;
            }
        }
    }

    toggleUserSelection(username, selected) {
        if (selected) {
            this.selectedUsers.add(username);
        } else {
            this.selectedUsers.delete(username);
        }
        
        this.updateSelectedUsersDisplay();
        this.updateCheckboxes();
    }

    removeUserSelection(username) {
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
        const groupNameInput = document.getElementById('groupName');
        if (!groupNameInput) {
            this.showNotification('Ошибка: поле названия группы не найдено', 'error');
            return;
        }
        
        const groupName = groupNameInput.value.trim();

        if (!groupName) {
            this.showNotification('Введите название группы', 'error');
            groupNameInput.focus();
            return;
        }

        if (this.selectedUsers.size === 0) {
            this.showNotification('Выберите хотя бы одного участника', 'error');
            return;
        }

        try {
            const currentUser = document.getElementById('username')?.textContent;
            const allMembers = [currentUser, ...Array.from(this.selectedUsers)];
            
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

            if (response.ok) {
                const result = await response.json();
                
                if (this.modal) {
                    this.modal.style.display = 'none';
                }
                this.selectedUsers.clear();
                
                if (groupNameInput) {
                    groupNameInput.value = '';
                }
                
                this.showNotification('Группа создана успешно!', 'success');
                
                // Обновляем список диалогов
                if (window.privateChatInstance) {
                    window.privateChatInstance.loadConversations();
                }
                
            } else {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
        } catch (error) {
            console.error('Error creating group:', error);
            this.showNotification('Ошибка создания группы: ' + error.message, 'error');
        }
    }

    // Загрузка групп пользователя
    async loadUserGroups() {
        try {
            const response = await fetch('/api/user/groups');
            if (!response.ok) throw new Error('Failed to load groups');
            
            const groups = await response.json();
            return groups;
        } catch (error) {
            console.error('Error loading user groups:', error);
            return [];
        }
    }

    // Открытие группового чата
    async openGroupChat(group) {
        this.currentGroup = group;
        
        // Скрываем другие элементы
        const noChatSelected = document.getElementById('noChatSelected');
        const activeChat = document.getElementById('activeChat');
        
        if (noChatSelected) noChatSelected.style.display = 'none';
        if (activeChat) activeChat.style.display = 'none';
        
        // Создаем интерфейс группового чата
        let groupChatContainer = document.getElementById('groupChatContainer');
        if (!groupChatContainer) {
            groupChatContainer = document.createElement('div');
            groupChatContainer.id = 'groupChatContainer';
            groupChatContainer.className = 'active-chat';
            document.querySelector('.private-chat-main').appendChild(groupChatContainer);
        }
        
        groupChatContainer.style.display = 'flex';
        groupChatContainer.innerHTML = `
            <div class="chat-top-bar">
                <div class="chat-user-info">
                    <span class="user-avatar">👥</span>
                    <div class="user-details">
                        <h4>${group.name}</h4>
                        <span class="user-status group">Групповой чат • ${group.members ? group.members.length : 0} участников</span>
                    </div>
                </div>
                <div class="call-buttons">
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
                    <button type="button" class="attach-file" title="Прикрепить файл">📎</button>
                    <button type="button" class="send-button" onclick="window.groupChatManager.sendGroupMessage()">Отправить</button>
                    <input type="file" id="groupFileInput" style="display: none;" 
                           accept="image/*,.pdf,.doc,.docx,.txt,.zip,.mp3,.wav,.mp4,.mov"
                           multiple>
                </div>
                <div id="groupFilePreview" class="file-preview-container"></div>
            </div>
        `;
        
        // Добавляем обработчики
        const closeBtn = groupChatContainer.querySelector('.close-chat');
        closeBtn.addEventListener('click', () => this.closeGroupChat());
        
        const messageInput = groupChatContainer.querySelector('#groupMessageInput');
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendGroupMessage();
        });
        
        const attachBtn = groupChatContainer.querySelector('.attach-file');
        const fileInput = groupChatContainer.querySelector('#groupFileInput');
        attachBtn.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleGroupFileSelection(Array.from(e.target.files));
            }
        });
        
        // Загружаем сообщения группы
        await this.loadGroupMessages(group.id);
    }

    closeGroupChat() {
        this.currentGroup = null;
        const groupChatContainer = document.getElementById('groupChatContainer');
        if (groupChatContainer) {
            groupChatContainer.style.display = 'none';
        }
        
        const noChatSelected = document.getElementById('noChatSelected');
        if (noChatSelected) noChatSelected.style.display = 'flex';
    }

    async loadGroupMessages(groupId) {
        try {
            const response = await fetch(`/api/groups/${groupId}/messages`);
            if (!response.ok) throw new Error('Failed to load group messages');
            
            const messages = await response.json();
            this.displayGroupMessages(messages);
        } catch (error) {
            console.error('Error loading group messages:', error);
            const container = document.getElementById('groupMessages');
            if (container) {
                container.innerHTML = '<div class="no-messages">❌ Ошибка загрузки сообщений</div>';
            }
        }
    }

    displayGroupMessages(messages) {
        const container = document.getElementById('groupMessages');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="no-messages">📝 Начните общение в группе!</div>';
            return;
        }
        
        messages.sort((a, b) => new Date(a.date) - new Date(b.date));
        messages.forEach(message => this.displayGroupMessage(message, false));
        this.scrollGroupToBottom();
    }

    displayGroupMessage(message, shouldScroll = true) {
        const container = document.getElementById('groupMessages');
        if (!container) return;
        
        const noMessagesElement = container.querySelector('.no-messages');
        if (noMessagesElement) noMessagesElement.remove();
        
        const currentUsername = document.getElementById('username')?.textContent;
        const isOwn = message.sender === currentUsername;
        
        const messageElement = document.createElement('div');
        messageElement.className = `private-message ${isOwn ? 'own' : 'other'}`;
        
        if (message.messageType === 'file') {
            this.displayGroupFileMessage(message, isOwn);
        } else {
            messageElement.innerHTML = `
                <div class="message-content">
                    <div class="message-header">
                        <strong>${isOwn ? 'Вы' : message.sender}</strong>
                        <span class="message-time">${message.timestamp}</span>
                    </div>
                    <div class="message-text">${message.message}</div>
                </div>
            `;
            
            container.appendChild(messageElement);
        }
        
        if (shouldScroll) this.scrollGroupToBottom();
    }

    displayGroupFileMessage(message, isOwn) {
        const container = document.getElementById('groupMessages');
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

    async sendGroupMessage() {
        if (!this.currentGroup) {
            this.showNotification('Выберите группу для отправки сообщения', 'error');
            return;
        }
        
        const input = document.getElementById('groupMessageInput');
        const files = document.getElementById('groupFileInput')?.files;
        
        const message = input?.value.trim();
        const hasFiles = files && files.length > 0;
        
        if (!message && !hasFiles) return;
        
        try {
            if (hasFiles) {
                for (let i = 0; i < files.length; i++) {
                    await this.handleGroupFileUpload(files[i]);
                }
                const filePreview = document.getElementById('groupFilePreview');
                if (filePreview) {
                    filePreview.innerHTML = '';
                    filePreview.style.display = 'none';
                }
                document.getElementById('groupFileInput').value = '';
            }
            
            if (message) {
                const response = await fetch(`/api/groups/${this.currentGroup.id}/messages`, {
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
                    input.value = '';
                } else {
                    throw new Error('Failed to send message');
                }
            }
            
            if (input) input.focus();
            
        } catch (error) {
            console.error('Error sending group message:', error);
            this.showNotification('Ошибка отправки сообщения', 'error');
        }
    }

    async handleGroupFileUpload(file) {
        if (!this.currentGroup) {
            this.showNotification('Выберите группу для отправки файла', 'error');
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
                await fetch(`/api/groups/${this.currentGroup.id}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: this.getFileTypeText(result.file.mimetype, result.file.originalName),
                        messageType: 'file',
                        fileData: result.file
                    })
                });
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            this.showNotification('Ошибка загрузки файла: ' + error.message, 'error');
        }
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

    // Вспомогательные методы
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
        if (window.privateChatInstance && typeof window.privateChatInstance.showNotification === 'function') {
            window.privateChatInstance.showNotification(message, type);
        } else {
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

    // Socket listeners для групповых сообщений
    setupSocketListeners() {
        if (window.socket) {
            window.socket.on('group_message', (data) => {
                if (this.currentGroup && data.groupId === this.currentGroup.id) {
                    this.displayGroupMessage(data, true);
                }
            });
            
            window.socket.on('group_created', (data) => {
                this.showNotification(`Создана новая группа: ${data.group.name}`, 'success');
                if (window.privateChatInstance) {
                    window.privateChatInstance.loadConversations();
                }
            });
        }
    }
}
// Глобальные методы для доступа из HTML
window.PrivateChat = PrivateChat;
window.GroupChatManager = GroupChatManager;
window.WebRTCCallManager = WebRTCCallManager;