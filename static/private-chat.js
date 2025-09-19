class PrivateChat {
    constructor() {
        this.currentChat = null;
        this.conversations = [];
        this.isInitialized = false;
        this.onlineUsers = new Set();
    }

    init() {
        if (this.isInitialized) return;
        
        try {
            console.log('🔄 Initializing private chat...');
            this.createUI();
            this.setupEventListeners();
            this.setupSocketListeners();
            this.loadConversations();
            this.setupFileInput();
            this.isInitialized = true;
            console.log('✅ Private chat initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing PrivateChat:', error);
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
                    </div>
                    
                    <div class="search-container">
                        <div class="search-input-wrapper">
                            <input type="text" id="userSearch" placeholder="🔍 Поиск пользователей..." class="search-input">
                            <button class="search-clear" id="searchClear">✕</button>
                        </div>
                        <div id="searchResults" class="search-results"></div>
                    </div>
                    
                    <div class="conversations-header">
                        <span>Последние диалоги</span>
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
                                    <span class="user-status" id="currentUserStatus">online</span>
                                </div>
                            </div>
                            <div class="chat-buttons">
                                <button type="button" class="attach-file" title="Прикрепить файл">📎</button>
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
                                <button type="button" class="send-button">Отправить</button>
                                <input type="file" id="fileInput" style="display: none;" accept="image/*,.pdf,.doc,.docx,.txt">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        setTimeout(() => {
            const userSearch = document.getElementById('userSearch');
            if (userSearch) {
                userSearch.addEventListener('input', this.debounce(() => {
                    this.searchUsers();
                }, 300));
                
                userSearch.addEventListener('focus', () => {
                    const results = document.getElementById('searchResults');
                    if (results && results.innerHTML !== '') {
                        results.style.display = 'block';
                    }
                });
            }

            const searchClear = document.getElementById('searchClear');
            if (searchClear) {
                searchClear.addEventListener('click', () => {
                    const userSearch = document.getElementById('userSearch');
                    const results = document.getElementById('searchResults');
                    if (userSearch) userSearch.value = '';
                    if (results) {
                        results.innerHTML = '';
                        results.style.display = 'none';
                    }
                });
            }

            const messageInput = document.getElementById('privateMessageInput');
            if (messageInput) {
                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.sendPrivateMessage();
                });
            }

            const sendButton = document.querySelector('.send-button');
            if (sendButton) {
                sendButton.addEventListener('click', () => this.sendPrivateMessage());
            }

            this.setupFileInput();

            document.addEventListener('click', (e) => {
                const searchContainer = document.querySelector('.search-container');
                if (searchContainer && !searchContainer.contains(e.target)) {
                    const results = document.getElementById('searchResults');
                    if (results) results.style.display = 'none';
                }
            });

        }, 100);
    }

    setupFileInput() {
        this.fileInput = document.getElementById('fileInput');
        const attachButton = document.querySelector('.attach-file');
        
        if (attachButton && this.fileInput) {
            attachButton.addEventListener('click', () => {
                this.fileInput.click();
            });
            
            this.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                }
            });
        }
    }

    async handleFileUpload(file) {
        if (!this.currentChat) {
            this.showNotification('Выберите собеседника для отправки файла', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showNotification('Файл слишком большой (макс. 10MB)', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            this.showNotification('Загрузка файла...', 'info');
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки файла: ' + response.status);
            }

            const result = await response.json();
            
            if (result.success) {
                this.sendFileMessage(result.file);
                this.showNotification('Файл отправлен', 'success');
            } else {
                throw new Error(result.error || 'Ошибка загрузки');
            }
        } catch (error) {
            console.error('File upload error:', error);
            this.showNotification('Ошибка загрузки файла: ' + error.message, 'error');
        }
    }

    sendFileMessage(fileData) {
        const currentUsername = document.getElementById('username')?.textContent;
        
        if (window.socket && this.currentChat) {
            window.socket.emit('private message', {
                sender: currentUsername,
                receiver: this.currentChat,
                message: `Файл: ${fileData.originalName}`,
                messageType: 'file',
                fileData: fileData
            });
        }
    }

    async searchUsers() {
        const query = document.getElementById('userSearch').value.trim();
        const resultsContainer = document.getElementById('searchResults');
        
        if (!resultsContainer) {
            console.error('❌ Search results container not found');
            return;
        }
        
        if (query.length === 0) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
            return;
        }
        
        resultsContainer.innerHTML = '<div class="search-result loading">Поиск...</div>';
        resultsContainer.style.display = 'block';

        try {
            const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`);
            
            if (response.ok) {
                const users = await response.json();
                this.displaySearchResults(users);
                return;
            }
            
            throw new Error('Search failed');
            
        } catch (error) {
            console.error('❌ Search error:', error);
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

            userElement.addEventListener('click', (e) => {
                if (!e.target.classList.contains('start-chat-btn')) {
                    this.startChat(user.username);
                    resultsContainer.style.display = 'none';
                }
            });

            const chatButton = userElement.querySelector('.start-chat-btn');
            chatButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startChat(user.username);
                resultsContainer.style.display = 'none';
            });

            resultsContainer.appendChild(userElement);
        });
        
        resultsContainer.style.display = 'block';
    }

    async startChat(username) {
        console.log('Starting chat with:', username);
        this.currentChat = username;
        
        const searchResults = document.getElementById('searchResults');
        const userSearch = document.getElementById('userSearch');
        if (searchResults) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
        }
        if (userSearch) userSearch.value = '';
        
        const chatHeader = document.getElementById('chatHeader');
        const activeChat = document.getElementById('activeChat');
        if (chatHeader) chatHeader.style.display = 'none';
        if (activeChat) activeChat.style.display = 'flex';
        
        const currentChatUser = document.getElementById('currentChatUser');
        const currentUserStatus = document.getElementById('currentUserStatus');
        
        if (currentChatUser) currentChatUser.textContent = username;
        if (currentUserStatus) {
            const isOnline = this.onlineUsers.has(username);
            currentUserStatus.textContent = isOnline ? 'online' : 'offline';
            currentUserStatus.className = `user-status ${isOnline ? 'online' : 'offline'}`;
        }
        
        this.scrollToActiveConversation();
        
        try {
            const response = await fetch(`/api/messages/private/${username}`);
            if (!response.ok) {
                throw new Error('Failed to load messages: ' + response.status);
            }
            const messages = await response.json();
            this.displayMessageHistory(messages);
        } catch (error) {
            console.error('Error loading messages:', error);
            this.showNotification('Ошибка загрузки сообщений', 'error');
        }
        
        this.loadConversations();
    }

    scrollToActiveConversation() {
        const activeItems = document.querySelectorAll('.conversation-item.active');
        activeItems.forEach(item => {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }

    closeCurrentChat() {
        this.currentChat = null;
        
        const chatHeader = document.getElementById('chatHeader');
        const activeChat = document.getElementById('activeChat');
        if (chatHeader) chatHeader.style.display = 'block';
        if (activeChat) activeChat.style.display = 'none';
        
        const privateMessages = document.getElementById('privateMessages');
        if (privateMessages) privateMessages.innerHTML = '<div class="no-messages">📝 Начните общение первым!</div>';
        
        const messageInput = document.getElementById('privateMessageInput');
        if (messageInput) messageInput.value = '';
        
        this.loadConversations();
    }

    async loadConversations() {
        try {
            console.log('📥 Loading conversations...');
            const response = await fetch('/api/conversations');
            if (!response.ok) {
                throw new Error('Failed to load conversations: ' + response.status);
            }
            this.conversations = await response.json();
            console.log('✅ Conversations loaded:', this.conversations);
            this.displayConversations();
        } catch (error) {
            console.error('❌ Error loading conversations:', error);
            const container = document.getElementById('conversationsList');
            if (container) {
                container.innerHTML = '<div class="conversation-item empty">Ошибка загрузки диалогов</div>';
            }
            this.showNotification('Ошибка загрузки диалогов', 'error');
        }
    }

    displayConversations() {
        const container = document.getElementById('conversationsList');
        if (!container) {
            console.error('❌ Conversations container not found');
            return;
        }
        
        console.log('📋 Displaying conversations:', this.conversations);
        container.innerHTML = '';

        if (this.conversations.length === 0) {
            container.innerHTML = '<div class="conversation-item empty">Нет диалогов</div>';
            return;
        }

        this.conversations.forEach(conversation => {
            const convElement = document.createElement('div');
            convElement.className = `conversation-item ${conversation.username === this.currentChat ? 'active' : ''}`;
            
            const lastMsg = conversation.lastMessage;
            let preview = 'Нет сообщений';
            
            if (lastMsg) {
                preview = lastMsg.isOwn ? `Вы: ${lastMsg.text}` : lastMsg.text;
                if (preview.length > 30) {
                    preview = preview.substring(0, 30) + '...';
                }
            }

            const isOnline = this.onlineUsers.has(conversation.username);
            const onlineIndicator = isOnline ? '<span class="online-dot"></span>' : '';

            convElement.innerHTML = `
                <div class="conv-info">
                    <div class="conv-name">${conversation.username} ${onlineIndicator}</div>
                    <div class="conv-preview">${preview}</div>
                </div>
                ${lastMsg ? `<div class="conv-time">${lastMsg.timestamp}</div>` : ''}
            `;

            convElement.addEventListener('click', () => this.startChat(conversation.username));
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
            
            const formattedMessage = this.formatMessageText(message.message);
            
            messageElement.innerHTML = `
                <div class="message-content">
                    <div class="message-header">
                        <strong>${isOwn ? 'Вы' : message.sender}</strong>
                        <span class="message-time">${message.timestamp}</span>
                    </div>
                    <div class="message-text">${formattedMessage}</div>
                </div>
            `;
            
            container.appendChild(messageElement);
        }
        
        if (shouldScroll) {
            this.scrollToBottom();
        }
    }

    displayFileMessage(message, isOwn) {
        const container = document.getElementById('privateMessages');
        if (!container) return;

        const messageElement = document.createElement('div');
        messageElement.className = `private-message ${isOwn ? 'own' : 'other'}`;
        
        const file = message.fileData;
        const fileSize = Math.round(file.size / 1024) + ' KB';

        let fileContent = '';
        
       if (file.mimetype.startsWith('image/')) {
    fileContent = `
        <img src="${file.thumbnail || file.path}" 
             class="file-preview" 
             style="max-width: 200px; max-height: 200px; border-radius: 8px; cursor: pointer;"
             onclick="window.privateChatInstance.viewImage('${file.path}')"
             alt="${file.originalName}"
             onerror="if(this.src !== '${file.path}') this.src='${file.path}'">
    `;

        } else {
            const fileIcon = this.getFileIcon(file.mimetype);
            fileContent = `
                <div class="file-info" style="display: flex; align-items: center; gap: 8px;">
                    <div class="file-icon" style="font-size: 24px;">${fileIcon}</div>
                    <div class="file-details" style="flex: 1;">
                        <div class="file-name" style="font-weight: bold; margin-bottom: 4px;">${file.originalName}</div>
                        <div class="file-size" style="font-size: 12px; color: #6c757d;">${fileSize}</div>
                    </div>
                    <button class="file-download" onclick="window.open('${file.path}', '_blank')" 
                            style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        📥
                    </button>
                </div>
            `;
        }

        messageElement.innerHTML = `
            <div class="message-content" style="max-width: 300px; margin: 10px 0; padding: 12px; border-radius: 12px; background: #f8f9fa; border: 1px solid #e9ecef;">
                <div class="message-header" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong>${isOwn ? 'Вы' : message.sender}</strong>
                    <span class="message-time">${message.timestamp}</span>
                </div>
                ${fileContent}
                <div class="message-text" style="margin-top: 8px;">${message.message}</div>
            </div>
        `;

        container.appendChild(messageElement);
    }

    viewImage(imageUrl) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <button style="position: absolute; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.2); color: white; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 20px; cursor: pointer;"
                    onclick="this.parentElement.remove()">✕</button>
            <div style="max-width: 90%; max-height: 90%;">
                <img src="${imageUrl}" alt="Просмотр изображения" style="max-width: 100%; max-height: 100%; object-fit: contain;">
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    getFileIcon(mimeType) {
        const icons = {
            'application/pdf': '📄',
            'application/msword': '📝',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
            'text/plain': '📄',
            'default': '📁'
        };
        
        return icons[mimeType] || icons.default;
    }

    formatMessageText(text) {
        if (!text) return '';
        
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';

        words.forEach(word => {
            if ((currentLine + word).length > 20) {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = word;
            } else {
                currentLine = currentLine ? currentLine + ' ' + word : word;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.join('<br>');
    }

    sendPrivateMessage() {
        const input = document.getElementById('privateMessageInput');
        const currentUsername = document.getElementById('username')?.textContent;
        
        if (!input || !currentUsername || !this.currentChat) return;
        
        const message = input.value.trim();
        
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
            input.focus();
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

    setupSocketListeners() {
        if (!window.socket) {
            console.warn('Socket.io not available');
            return;
        }
        
        window.socket.on('private message', (data) => {
            this.handleIncomingMessage(data);
        });

        window.socket.on('conversations updated', () => {
            this.loadConversations();
        });

        window.socket.on('user-status-changed', (data) => {
            this.handleUserStatusChange(data);
        });

        window.socket.on('connect', () => {
            console.log('✅ Socket connected for private chat');
        });

        window.socket.on('disconnect', () => {
            console.log('❌ Socket disconnected from private chat');
        });
    }

    handleIncomingMessage(data) {
        console.log('📨 Incoming private message:', data);
        
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
        
        const searchResults = document.querySelectorAll('.search-result');
        searchResults.forEach(result => {
            const statusElement = result.querySelector('.search-user-status');
            if (statusElement) {
                const username = result.querySelector('.search-username').textContent;
                const isOnline = this.onlineUsers.has(username);
                statusElement.textContent = isOnline ? 'online' : 'offline';
                statusElement.className = `search-user-status ${isOnline ? 'online' : 'offline'}`;
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
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            color: white;
            border-radius: 5px;
            z-index: 10000;
            font-size: 14px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
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
}

function initPrivateChat() {
    if (!window.privateChatInstance) {
        window.privateChatInstance = new PrivateChat();
    }
    window.privateChatInstance.init();
    return window.privateChatInstance;
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 DOM loaded, creating private chat instance');
    window.privateChatInstance = new PrivateChat();
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const privateChat = document.getElementById('privateChat');
                if (privateChat && privateChat.style.display !== 'none') {
                    console.log('🎯 Private chat shown, initializing...');
                    window.privateChatInstance.init();
                    observer.disconnect();
                }
            }
        });
    });

    const privateChat = document.getElementById('privateChat');
    if (privateChat) {
        observer.observe(privateChat, { attributes: true });
    }
});

window.initPrivateChat = initPrivateChat;