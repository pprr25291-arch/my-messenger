class PrivateChat {
    constructor() {
        this.currentChat = null;
        this.conversations = [];
        this.isScrolledToBottom = true;
        this.callWindow = null;
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.currentCallId = null;
        this.isMuted = false;
        this.isVideoEnabled = true;
        this.timerInterval = null;
        this.callStartTime = null;
        this.incomingCallOffer = null;
        this.isScreenSharing = false;
        this.screenStream = null;
        this.cameraStream = null;
        this.isAudioCall = false;
        this.fileInput = null;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            setTimeout(() => this.init(), 100);
        }
    }

    init() {
        try {
            this.createUI();
            this.setupEventListeners();
            this.setupSocketListeners();
            this.loadConversations();
            this.setupFileInput();
        } catch (error) {
            console.error('Error initializing PrivateChat:', error);
        }
    }

    createUI() {
        const privateChatContainer = document.getElementById('privateChat');
        if (!privateChatContainer) {
            console.error('Private chat container not found');
            return;
        }

        const privateChatHTML = `
            <div class="private-chat-container">
                <div class="private-chat-sidebar">
                    <div class="search-container">
                        <input type="text" id="userSearch" placeholder="🔍 Поиск пользователей...">
                        <div id="searchResults" class="search-results"></div>
                    </div>
                    <div class="conversations-list" id="conversationsList">
                        <div class="conversation-item empty">Начните общение с кем-то</div>
                    </div>
                </div>
                
                <div class="private-chat-main">
                    <div id="chatHeader" class="chat-header">
                        <h3>💬 Приватные сообщения</h3>
                        <p>Выберите диалог или найдите пользователя</p>
                    </div>
                    
                    <div id="activeChat" class="active-chat" style="display: none;">
                        <div class="chat-top-bar">
                            <div class="chat-user-info">
                                <span class="user-avatar">👤</span>
                                <div>
                                    <h4 id="currentChatUser"></h4>
                                    <span class="user-status">online</span>
                                </div>
                            </div>
                            <div class="call-buttons">
                                <button type="button" class="call-btn video-call" title="Видеозвонок">
                                    📹
                                </button>
                                <button type="button" class="call-btn voice-call" title="Голосовой звонок">
                                    📞
                                </button>
                                <button type="button" class="call-btn screen-share-audio" title="Трансляция экрана в голосовом звонке" style="display: none;">
                                    🖥️
                                </button>
                                <button type="button" class="call-btn attach-file" title="Прикрепить файл">
                                    📎
                                </button>
                            </div>
                            <button type="button" class="close-chat">✕</button>
                        </div>
                        
                        <div class="chat-messages-wrapper">
                            <div id="privateMessages" class="private-messages">
                                <div class="no-messages">📝 Начните общение первым!</div>
                            </div>
                            <div class="scroll-indicator" id="scrollIndicator" style="display: none;">
                                <button type="button" onclick="window.privateChatInstance.scrollToBottom()">
                                    <span class="scroll-arrow">⬇️</span>
                                    <span class="scroll-text">Новые сообщения</span>
                                </button>
                            </div>
                        </div>
                        
                        <div class="message-input-container">
                            <input type="text" id="privateMessageInput" placeholder="Напишите сообщение..." autocomplete="off">
                            <button type="button" class="send-button">Отправить</button>
                            <input type="file" id="fileInput" style="display: none;" accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar">
                        </div>

                        <div id="fileUploadProgress" style="display: none; margin-top: 10px;">
                            <div class="progress-bar">
                                <div class="progress"></div>
                            </div>
                            <div class="progress-text">Загрузка: 0%</div>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .progress-bar {
                    width: 100%;
                    height: 8px;
                    background: #e0e0e0;
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 5px;
                }
                
                .progress {
                    height: 100%;
                    background: linear-gradient(45deg, #667eea, #764ba2);
                    border-radius: 4px;
                    transition: width 0.3s ease;
                    width: 0%;
                }
                
                .progress-text {
                    font-size: 12px;
                    color: #666;
                    text-align: center;
                }
                
                .file-message {
                    max-width: 300px;
                    margin: 10px 0;
                    padding: 12px;
                    border-radius: 12px;
                    background: #f8f9fa;
                    border: 1px solid #e9ecef;
                }
                
                .file-preview {
                    max-width: 100%;
                    max-height: 200px;
                    border-radius: 8px;
                    margin-bottom: 8px;
                    cursor: pointer;
                }
                
                .file-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .file-icon {
                    font-size: 24px;
                }
                
                .file-details {
                    flex: 1;
                    min-width: 0;
                }
                
                .file-name {
                    font-weight: bold;
                    margin-bottom: 4px;
                    word-break: break-word;
                }
                
                .file-size {
                    font-size: 12px;
                    color: #6c757d;
                }
                
                .file-download {
                    padding: 6px 12px;
                    background: linear-gradient(45deg, #667eea, #764ba2);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                }
                
                .image-view-modal {
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
                }
                
                .image-view-content {
                    max-width: 90%;
                    max-height: 90%;
                }
                
                .image-view-content img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                
                .close-image-view {
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
                }
            </style>
        `;

        privateChatContainer.innerHTML = privateChatHTML;
    }

    setupEventListeners() {
        setTimeout(() => {
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

            const sendButton = document.querySelector('.send-button');
            if (sendButton) {
                sendButton.addEventListener('click', () => this.sendPrivateMessage());
            }

            const closeChat = document.querySelector('.close-chat');
            if (closeChat) {
                closeChat.addEventListener('click', () => this.closeCurrentChat());
            }

            const videoCallBtn = document.querySelector('.video-call');
            if (videoCallBtn) {
                videoCallBtn.addEventListener('click', () => this.startCall(true));
            }

            const voiceCallBtn = document.querySelector('.voice-call');
            if (voiceCallBtn) {
                voiceCallBtn.addEventListener('click', () => this.startCall(false));
            }

            const screenShareAudioBtn = document.querySelector('.screen-share-audio');
            if (screenShareAudioBtn) {
                screenShareAudioBtn.addEventListener('click', () => this.startScreenShareInAudioCall());
            }

            document.addEventListener('click', (e) => {
                const searchContainer = document.querySelector('.search-container');
                if (searchContainer && !e.target.closest('.search-container')) {
                    const resultsContainer = document.getElementById('searchResults');
                    if (resultsContainer) {
                        resultsContainer.style.display = 'none';
                    }
                }
            });

            const messagesContainer = document.getElementById('privateMessages');
            if (messagesContainer) {
                messagesContainer.addEventListener('scroll', () => {
                    this.handleScroll();
                });
            }

        }, 200);
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

        // Проверка размера файла
        if (file.size > 10 * 1024 * 1024) { // 10MB
            this.showNotification('Файл слишком большой (макс. 10MB)', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            this.showUploadProgress(0);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки файла');
            }

            const result = await response.json();
            
            if (result.success) {
                // Сохраняем файл локально
                const fileData = {
                    id: result.file.filename,
                    originalName: result.file.originalName,
                    filename: result.file.filename,
                    type: file.type,
                    size: file.size,
                    path: result.file.path,
                    thumbnail: result.file.thumbnail,
                    conversation: this.getConversationId(this.currentChat),
                    sender: document.getElementById('username')?.textContent,
                    timestamp: Date.now()
                };

                // Сохраняем в локальное хранилище
                if (window.fileManager && window.fileManager.isSupported()) {
                    await window.fileManager.saveFileFromUrl(result.file.path, fileData);
                }

                // Отправляем сообщение с файлом
                this.sendFileMessage(fileData);
                
                this.showUploadProgress(100);
                setTimeout(() => this.hideUploadProgress(), 1000);
                
            } else {
                throw new Error(result.error || 'Ошибка загрузки');
            }
        } catch (error) {
            console.error('File upload error:', error);
            this.showNotification('Ошибка загрузки файла: ' + error.message, 'error');
            this.hideUploadProgress();
        }
    }

    showUploadProgress(percent) {
        const progressContainer = document.getElementById('fileUploadProgress');
        const progressBar = progressContainer?.querySelector('.progress');
        const progressText = progressContainer?.querySelector('.progress-text');
        
        if (progressContainer && progressBar && progressText) {
            progressContainer.style.display = 'block';
            progressBar.style.width = percent + '%';
            progressText.textContent = `Загрузка: ${percent}%`;
        }
    }

    hideUploadProgress() {
        const progressContainer = document.getElementById('fileUploadProgress');
        if (progressContainer) {
            progressContainer.style.display = 'none';
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

    displayFileMessage(message, isOwn) {
        const container = document.getElementById('privateMessages');
        if (!container) return;

        const messageElement = document.createElement('div');
        messageElement.className = `private-message ${isOwn ? 'own' : 'other'}`;
        
        const file = message.fileData;
        const fileSize = window.fileManager ? window.fileManager.formatFileSize(file.size) : Math.round(file.size / 1024) + ' KB';

        let fileContent = '';
        
        if (file.type.startsWith('image/')) {
            fileContent = `
                <img src="${file.thumbnail || file.path}" 
                     class="file-preview" 
                     onclick="window.privateChatInstance.viewImage('${file.path}')"
                     alt="${file.originalName}">
            `;
        } else {
            const fileIcon = this.getFileIcon(file.type);
            fileContent = `
                <div class="file-info">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-details">
                        <div class="file-name">${file.originalName}</div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                    <button class="file-download" onclick="window.privateChatInstance.downloadFile('${file.path}', '${file.originalName}')">
                        📥
                    </button>
                </div>
            `;
        }

        messageElement.innerHTML = `
            <div class="message-content file-message">
                <div class="message-header">
                    <strong>${isOwn ? 'Вы' : message.sender}</strong>
                    <span class="message-time">${message.timestamp}</span>
                </div>
                ${fileContent}
                <div class="message-text">${message.message}</div>
            </div>
        `;

        container.appendChild(messageElement);
        
        if (this.isScrolledToBottom) {
            setTimeout(() => this.scrollToBottom(), 50);
        }
    }

    getFileIcon(mimeType) {
        const icons = {
            'application/pdf': '📄',
            'application/msword': '📝',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
            'text/plain': '📄',
            'application/zip': '📦',
            'application/x-rar-compressed': '📦',
            'default': '📁'
        };
        
        return icons[mimeType] || icons.default;
    }

    viewImage(imageUrl) {
        const modal = document.createElement('div');
        modal.className = 'image-view-modal';
        modal.innerHTML = `
            <button class="close-image-view" onclick="this.parentElement.remove()">✕</button>
            <div class="image-view-content">
                <img src="${imageUrl}" alt="Просмотр изображения">
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Закрытие по клику вне изображения
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    getConversationId(username) {
        const currentUser = document.getElementById('username')?.textContent;
        return [currentUser, username].sort().join('_');
    }

    async searchUsers() {
        const query = document.getElementById('userSearch').value.trim();
        const resultsContainer = document.getElementById('searchResults');
        
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        
        if (query.length < 2) {
            return;
        }

        try {
            const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const users = await response.json();
            this.displaySearchResults(users);
        } catch (error) {
            console.error('Search error:', error);
            this.displaySearchError(error);
        }
    }

    displaySearchResults(users) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = '';
        
        if (users.length === 0) {
            resultsContainer.innerHTML = `
                <div class="search-result">
                    <div class="search-user-info">
                        <span class="search-avatar">😢</span>
                        <span class="search-username">Никого не найдено</span>
                    </div>
                </div>
            `;
        } else {
            users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'search-result';
                userElement.innerHTML = `
                    <div class="search-user-info">
                        <span class="search-avatar">👤</span>
                        <span class="search-username">${user.username}</span>
                    </div>
                    <button type="button" class="start-chat-btn">💬 Написать</button>
                `;

                userElement.querySelector('.start-chat-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.startChat(user.username);
                });

                resultsContainer.appendChild(userElement);
            });
        }
        
        resultsContainer.style.display = 'block';
    }

    displaySearchError(error) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = `
            <div class="search-result error">
                <div class="search-user-info">
                    <span class="search-avatar">⚠️</span>
                    <span class="search-username">Ошибка поиска</span>
                </div>
                <div class="error-details">${error.message}</div>
            </div>
        `;
        resultsContainer.style.display = 'block';
    }

    async startChat(username) {
        this.currentChat = username;
        
        const searchResults = document.getElementById('searchResults');
        const userSearch = document.getElementById('userSearch');
        if (searchResults) searchResults.style.display = 'none';
        if (userSearch) userSearch.value = '';
        
        const chatHeader = document.getElementById('chatHeader');
        const activeChat = document.getElementById('activeChat');
        if (chatHeader) chatHeader.style.display = 'none';
        if (activeChat) activeChat.style.display = 'flex';
        
        const currentChatUser = document.getElementById('currentChatUser');
        if (currentChatUser) currentChatUser.textContent = username;
        
        try {
            const response = await fetch(`/api/messages/private/${username}`);
            const messages = await response.json();
            this.displayMessageHistory(messages);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
        
        const messageInput = document.getElementById('privateMessageInput');
        if (messageInput) messageInput.focus();
        
        this.loadConversations();
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
        
        this.hideScrollIndicator();
        this.loadConversations();
    }

    async loadConversations() {
        try {
            const response = await fetch('/api/conversations');
            this.conversations = await response.json();
            this.displayConversations();
        } catch (error) {
            console.error('Error loading conversations:', error);
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
            convElement.className = `conversation-item ${conversation.username === this.currentChat ? 'active' : ''}`;
            
            const lastMsg = conversation.lastMessage;
            let preview = 'Нет сообщений';
            
            if (lastMsg) {
                if (lastMsg.type === 'file') {
                    preview = lastMsg.isOwn ? 'Вы: 📎 Файл' : '📎 Файл';
                } else {
                    preview = lastMsg.isOwn ? `Вы: ${lastMsg.text}` : lastMsg.text;
                }
            }
            
            const shortPreview = preview.length > 25 ? preview.substring(0, 25) + '...' : preview;

            convElement.innerHTML = `
                <div class="conv-avatar">👤</div>
                <div class="conv-info">
                    <div class="conv-name">${conversation.username}</div>
                    <div class="conv-preview">${shortPreview}</div>
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
        setTimeout(() => this.scrollToBottom(), 100);
    }

    displayMessage(message, shouldScroll = true) {
        const container = document.getElementById('privateMessages');
        if (!container) return;
        
        const noMessagesElement = container.querySelector('.no-messages');
        if (noMessagesElement) {
            noMessagesElement.remove();
        }
        
        const currentUsername = document.getElementById('username')?.textContent;
        const isOwn = message.sender === currentUsername;
        
        if (message.messageType === 'file') {
            this.displayFileMessage(message, isOwn);
        } else {
            // Обычное текстовое сообщение
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
        
        if (shouldScroll && this.isScrolledToBottom) {
            setTimeout(() => this.scrollToBottom(), 50);
        } else if (shouldScroll) {
            this.showScrollIndicator();
        }
    }

    formatMessageText(text) {
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
        
        if (message && this.currentChat) {
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
            privateMessages.scrollTop = privateMessages.scrollHeight;
            this.isScrolledToBottom = true;
            this.hideScrollIndicator();
        }
    }

    isAtBottom(container) {
        if (!container) return false;
        const threshold = 50;
        const position = container.scrollTop + container.clientHeight;
        const height = container.scrollHeight;
        return position >= height - threshold;
    }

    handleScroll() {
        const container = document.getElementById('privateMessages');
        const scrollIndicator = document.getElementById('scrollIndicator');
        
        if (container) {
            this.isScrolledToBottom = this.isAtBottom(container);
            
            if (scrollIndicator) {
                if (this.isScrolledToBottom) {
                    scrollIndicator.style.display = 'none';
                } else {
                    scrollIndicator.style.display = 'block';
                }
            }
        }
    }

    showScrollIndicator() {
        const scrollIndicator = document.getElementById('scrollIndicator');
        if (scrollIndicator && !this.isScrolledToBottom) {
            scrollIndicator.style.display = 'block';
        }
    }

    hideScrollIndicator() {
        const scrollIndicator = document.getElementById('scrollIndicator');
        if (scrollIndicator) {
            scrollIndicator.style.display = 'none';
        }
    }

    setupSocketListeners() {
        if (!window.socket) return;
        
        window.socket.on('private message', (data) => {
            this.handleIncomingMessage(data);
        });

        window.socket.on('conversations updated', () => {
            this.loadConversations();
        });

        window.socket.on('incoming-call', (data) => {
            this.handleIncomingCall(data);
        });

        window.socket.on('call-answered', async (data) => {
            if (data.callId === this.currentCallId) {
                try {
                    await this.peerConnection.setRemoteDescription(data.answer);
                } catch (error) {
                    console.error('Error setting remote description:', error);
                }
            }
        });

        window.socket.on('ice-candidate', async (data) => {
            if (data.callId === this.currentCallId) {
                try {
                    await this.peerConnection.addIceCandidate(data.candidate);
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            }
        });

        window.socket.on('call-ended', (data) => {
            if (data.callId === this.currentCallId) {
                this.endCall();
            }
        });

        window.socket.on('screen-share-started', (data) => {
            if (data.callId === this.currentCallId) {
                this.showNotification('Собеседник начал трансляцию экрана', 'info');
                this.showScreenShareWindow();
            }
        });
        
        window.socket.on('screen-share-ended', (data) => {
            if (data.callId === this.currentCallId) {
                this.showNotification('Собеседник остановил трансляцию экрана', 'info');
                this.hideScreenShareWindow();
            }
        });
    }

    handleIncomingMessage(data) {
        if (this.currentChat && 
            ((data.sender === this.currentChat && data.receiver === document.getElementById('username')?.textContent) ||
             (data.receiver === this.currentChat && data.sender === document.getElementById('username')?.textContent))) {
            this.displayMessage(data, true);
            
            // Сохраняем файл локально если это файловое сообщение
            if (data.messageType === 'file' && data.fileData && window.fileManager) {
                window.fileManager.saveFileFromUrl(data.fileData.path, {
                    ...data.fileData,
                    conversation: this.getConversationId(data.sender),
                    sender: data.sender,
                    timestamp: Date.now()
                }).catch(console.error);
            }
        }
        
        this.loadConversations();
    }

    handleIncomingCall(data) {
        this.incomingCallOffer = data;
        this.showIncomingCallDialog(data);
    }

    showIncomingCallDialog(data) {
        const dialog = document.createElement('div');
        dialog.className = 'incoming-call-window';
        dialog.innerHTML = `
            <div class="incoming-call-content">
                <h4>Входящий ${data.isVideoCall ? 'видео' : 'голосовой'} звонок</h4>
                <p>От: ${data.from}</p>
                <div class="incoming-call-buttons">
                    <button class="accept-call-btn" type="button">Принять</button>
                    <button class="reject-call-btn" type="button">Отклонить</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        dialog.style.display = 'block';

        dialog.querySelector('.accept-call-btn').addEventListener('click', () => {
            this.acceptIncomingCall(data);
            dialog.remove();
        });

        dialog.querySelector('.reject-call-btn').addEventListener('click', () => {
            this.rejectIncomingCall(data);
            dialog.remove();
        });
    }

    async acceptIncomingCall(data) {
        try {
            this.currentCallId = data.callId;
            this.currentChat = data.from;
            this.isAudioCall = !data.isVideoCall;
            
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: data.isVideoCall,
                audio: true
            });
            
            this.cameraStream = this.localStream;
            
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });
            
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                this.setupRemoteVideo();
            };
            
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    window.socket.emit('ice-candidate', {
                        to: data.from,
                        candidate: event.candidate,
                        callId: this.currentCallId
                    });
                }
            };
            
            await this.peerConnection.setRemoteDescription(data.offer);
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            window.socket.emit('call-answer', {
                to: data.from,
                answer: answer,
                callId: this.currentCallId
            });
            
            this.showCallWindow(data.isVideoCall);
            
        } catch (error) {
            console.error('Error accepting call:', error);
            this.showNotification('Ошибка при принятии звонка: ' + error.message, 'error');
        }
    }

    rejectIncomingCall(data) {
        window.socket.emit('end-call', {
            to: data.from,
            callId: data.callId
        });
    }

    async startCall(isVideoCall) {
        try {
            const currentUsername = document.getElementById('username')?.textContent;
            
            if (!this.currentChat) {
                this.showNotification('Выберите собеседника для звонка', 'error');
                return;
            }
            
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: isVideoCall,
                audio: true
            });
            
            this.cameraStream = this.localStream;
            this.isAudioCall = !isVideoCall;
            
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });
            
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                this.setupRemoteVideo();
            };
            
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    window.socket.emit('ice-candidate', {
                        to: this.currentChat,
                        candidate: event.candidate,
                        callId: this.currentCallId
                    });
                }
            };
            
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.currentCallId = generateUUID();
            
            window.socket.emit('call-offer', {
                to: this.currentChat,
                offer: offer,
                isVideoCall: isVideoCall,
                callId: this.currentCallId
            });
            
            this.showCallWindow(isVideoCall);
            
        } catch (error) {
            console.error('Error starting call:', error);
            this.showNotification('Ошибка при запуске звонка: ' + error.message, 'error');
        }
    }

    showCallWindow(isVideoCall) {
        const callWindow = document.createElement('div');
        callWindow.className = 'call-window';
        
        if (isVideoCall) {
            callWindow.innerHTML = `
                <div class="call-header">
                    <h4>Видеозвонок</h4>
                    <div class="call-timer">00:00</div>
                </div>
                
                <div class="video-container">
                    <video id="remoteVideo" autoplay playsinline></video>
                    <video id="localVideo" autoplay playsinline muted></video>
                </div>
                
                <div class="call-controls">
                    <button class="call-control mute-btn" type="button" title="Отключить звук">🔇</button>
                    <button class="call-control video-btn" type="button" title="Отключить видео">📹</button>
                    <button class="call-control screen-share-btn" type="button" title="Трансляция экрана">🖥️</button>
                    <button class="call-control fullscreen-btn" type="button" title="Полный экран">⛶</button>
                    <button class="call-control end-call-btn" type="button" title="Завершить звонок">📞</button>
                </div>
                
                <div class="call-status">Соединение установлено</div>
            `;
        } else {
            callWindow.innerHTML = `
                <div class="call-header">
                    <h4>Голосовой звонок</h4>
                    <div class="call-timer">00:00</div>
                </div>
                
                <div class="audio-call-placeholder">
                    <div class="audio-icon">📞</div>
                    <div class="audio-user-name">${this.currentChat}</div>
                    <div class="audio-status">Идет разговор</div>
                </div>
                
                <div class="call-controls">
                    <button class="call-control mute-btn" type="button" title="Отключить звук">🔇</button>
                    <button class="call-control screen-share-btn" type="button" title="Трансляция экрана">🖥️</button>
                    <button class="call-control end-call-btn" type="button" title="Завершить звонок">📞</button>
                </div>
                
                <div class="call-status">Соединение установлено</div>
            `;
        }

        document.body.appendChild(callWindow);
        callWindow.style.display = 'block';
        this.callWindow = callWindow;

        const localVideo = callWindow.querySelector('#localVideo');
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
        }

        callWindow.querySelector('.mute-btn').addEventListener('click', () => {
            this.toggleMute();
        });

        callWindow.querySelector('.end-call-btn').addEventListener('click', () => {
            this.endCall();
        });

        const screenShareBtn = callWindow.querySelector('.screen-share-btn');
        if (screenShareBtn) {
            screenShareBtn.addEventListener('click', () => {
                this.toggleScreenShare();
            });
            
            if (!this.checkScreenShareSupport()) {
                screenShareBtn.disabled = true;
                screenShareBtn.title = 'Трансляция экрана не поддерживается вашим браузером';
                screenShareBtn.style.opacity = '0.5';
            }
        }

        if (isVideoCall) {
            callWindow.querySelector('.video-btn').addEventListener('click', () => {
                this.toggleVideo();
            });
        }

        callWindow.querySelector('.fullscreen-btn')?.addEventListener('click', () => {
            const videoContainer = callWindow.querySelector('.video-container');
            if (videoContainer) {
                this.toggleFullscreen(videoContainer);
            }
        });

        this.startCallTimer();
        
        // Показываем кнопку трансляции экрана в UI чата
        const screenShareAudioBtn = document.querySelector('.screen-share-audio');
        if (screenShareAudioBtn && this.isAudioCall) {
            screenShareAudioBtn.style.display = 'block';
        }
    }

    setupRemoteVideo() {
        if (this.callWindow && this.remoteStream) {
            const remoteVideo = this.callWindow.querySelector('#remoteVideo');
            if (remoteVideo) {
                remoteVideo.srcObject = this.remoteStream;
            }
        }
    }

    toggleMute() {
        if (this.localStream) {
            this.isMuted = !this.isMuted;
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !this.isMuted;
            });
            
            const muteBtn = this.callWindow.querySelector('.mute-btn');
            if (muteBtn) {
                muteBtn.textContent = this.isMuted ? '🔇' : '🎤';
                muteBtn.title = this.isMuted ? 'Включить звук' : 'Отключить звук';
            }
        }
    }

    toggleVideo() {
        if (this.localStream) {
            this.isVideoEnabled = !this.isVideoEnabled;
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = this.isVideoEnabled;
            });
            
            const videoBtn = this.callWindow.querySelector('.video-btn');
            if (videoBtn) {
                videoBtn.textContent = this.isVideoEnabled ? '📹' : '📷';
                videoBtn.title = this.isVideoEnabled ? 'Отключить видео' : 'Включить видео';
            }
        }
    }

    checkScreenShareSupport() {
        return navigator.mediaDevices && 
               navigator.mediaDevices.getDisplayMedia &&
               typeof navigator.mediaDevices.getDisplayMedia === 'function';
    }

    async toggleScreenShare() {
        try {
            if (this.isScreenSharing) {
                await this.stopScreenShare();
            } else {
                await this.startScreenShare();
            }
        } catch (error) {
            console.error('Error toggling screen share:', error);
            this.showNotification('Ошибка трансляции экрана: ' + error.message, 'error');
        }
    }

    async startScreenShare() {
        if (!this.peerConnection || !this.currentCallId) {
            throw new Error('Нет активного звонка');
        }
        
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always",
                    displaySurface: "monitor"
                },
                audio: true
            });
            
            if (!this.cameraStream) {
                this.cameraStream = this.localStream;
            }
            
            // Добавляем видеотрек для трансляции экрана
            const videoSender = this.peerConnection.getSenders().find(sender => 
                sender.track && sender.track.kind === 'video'
            );
            
            if (videoSender) {
                const videoTrack = screenStream.getVideoTracks()[0];
                await videoSender.replaceTrack(videoTrack);
            } else {
                // Если видеосендера нет (аудиозвонок), добавляем новый
                screenStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, screenStream);
                });
            }
            
            // Останавливаем предыдущий видеотрек, если он был
            if (this.localStream && this.localStream !== this.cameraStream) {
                this.localStream.getVideoTracks().forEach(track => track.stop());
            }
            
            this.screenStream = screenStream;
            this.localStream = this.screenStream;
            this.isScreenSharing = true;
            
            const localVideo = this.callWindow.querySelector('#localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }
            
            this.updateScreenShareUI(true);
            
            window.socket.emit('screen-share-start', {
                to: this.currentChat,
                callId: this.currentCallId
            });
            
            this.showNotification('Трансляция экрана начата', 'success');
            this.showScreenShareWindow();
            
        } catch (error) {
            console.error('Error starting screen share:', error);
            throw error;
        }
    }

    async stopScreenShare() {
        if (!this.peerConnection || !this.cameraStream) {
            throw new Error('Нет активного звонка или сохраненного потока камеры');
        }
        
        try {
            // Возвращаемся к потоку камеры
            const videoSenders = this.peerConnection.getSenders().filter(sender => 
                sender.track && sender.track.kind === 'video'
            );
            
            if (videoSenders.length > 0 && this.cameraStream) {
                const videoTrack = this.cameraStream.getVideoTracks()[0];
                if (videoTrack) {
                    await videoSenders[0].replaceTrack(videoTrack);
                }
            }
            
            // Останавливаем поток с экрана
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => track.stop());
            }
            
            this.localStream = this.cameraStream;
            this.isScreenSharing = false;
            this.screenStream = null;
            
            const localVideo = this.callWindow.querySelector('#localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }
            
            this.updateScreenShareUI(false);
            
            window.socket.emit('screen-share-end', {
                to: this.currentChat,
                callId: this.currentCallId
            });
            
            this.showNotification('Трансляция экрана остановлена', 'success');
            this.hideScreenShareWindow();
            
        } catch (error) {
            console.error('Error stopping screen share:', error);
            throw error;
        }
    }

    updateScreenShareUI(isSharing) {
        const screenShareBtn = this.callWindow.querySelector('.screen-share-btn');
        if (screenShareBtn) {
            if (isSharing) {
                screenShareBtn.classList.add('active');
                screenShareBtn.innerHTML = '🖥️';
                screenShareBtn.title = 'Остановить трансляцию экрана';
            } else {
                screenShareBtn.classList.remove('active');
                screenShareBtn.innerHTML = '🖥️';
                screenShareBtn.title = 'Начать трансляцию экрана';
            }
        }
        
        this.toggleScreenShareIndicator(isSharing);
    }

    toggleScreenShareIndicator(show) {
        let indicator = document.getElementById('screenShareIndicator');
        
        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'screenShareIndicator';
                indicator.className = 'screen-share-indicator';
                indicator.innerHTML = '🖥️ Идет трансляция экрана';
                document.body.appendChild(indicator);
            }
            indicator.style.display = 'block';
        } else if (indicator) {
            indicator.style.display = 'none';
        }
    }

    showScreenShareWindow() {
        let screenWindow = document.getElementById('screenShareWindow');
        
        if (!screenWindow) {
            screenWindow = document.createElement('div');
            screenWindow.id = 'screenShareWindow';
            screenWindow.className = 'screen-view-window';
            screenWindow.innerHTML = `
                <div class="screen-view-header">
                    <h4>Трансляция экрана от ${this.currentChat}</h4>
                    <button class="close-screen-view">✕</button>
                </div>
                <div class="screen-view-container">
                    <video id="screenViewVideo" autoplay playsinline></video>
                </div>
                <div class="screen-view-controls">
                    <button class="screen-view-control fullscreen-btn" title="Полный экран">⛶</button>
                </div>
            `;
            
            document.body.appendChild(screenWindow);
            
            screenWindow.querySelector('.close-screen-view').addEventListener('click', () => {
                this.hideScreenShareWindow();
            });
            
            screenWindow.querySelector('.fullscreen-btn').addEventListener('click', () => {
                this.toggleFullscreen(screenWindow.querySelector('.screen-view-container'));
            });
        }
        
        const screenVideo = screenWindow.querySelector('#screenViewVideo');
        if (screenVideo && this.remoteStream) {
            screenVideo.srcObject = this.remoteStream;
        }
        
        screenWindow.style.display = 'block';
    }

    hideScreenShareWindow() {
        const screenWindow = document.getElementById('screenShareWindow');
        if (screenWindow) {
            screenWindow.style.display = 'none';
        }
    }

    toggleFullscreen(element) {
        if (!document.fullscreenElement) {
            element.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    startCallTimer() {
        this.callStartTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            
            const timerElement = this.callWindow.querySelector('.call-timer');
            if (timerElement) {
                timerElement.textContent = `${minutes}:${seconds}`;
            }
        }, 1000);
    }

    endCall() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        if (this.isScreenSharing) {
            this.stopScreenShare().catch(console.error);
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
        
        this.cameraStream = null;
        this.screenStream = null;
        this.isScreenSharing = false;
        
        this.toggleScreenShareIndicator(false);
        this.hideScreenShareWindow();
        
        // Скрываем кнопку трансляции экрана в UI чата
        const screenShareAudioBtn = document.querySelector('.screen-share-audio');
        if (screenShareAudioBtn) {
            screenShareAudioBtn.style.display = 'none';
        }
        
        if (this.callWindow) {
            this.callWindow.remove();
            this.callWindow = null;
        }
        
        if (this.currentCallId && this.currentChat) {
            window.socket.emit('end-call', {
                to: this.currentChat,
                callId: this.currentCallId
            });
        }
        
        this.currentCallId = null;
        this.isAudioCall = false;
    }

    async startScreenShareInAudioCall() {
        if (!this.isAudioCall || !this.peerConnection) {
            this.showNotification('Трансляция экрана доступна только в голосовых звонках', 'error');
            return;
        }

        try {
            if (this.isScreenSharing) {
                await this.stopScreenShare();
            } else {
                await this.startScreenShare();
            }
        } catch (error) {
            console.error('Error toggling screen share in audio call:', error);
            this.showNotification('Ошибка трансляции экрана: ' + error.message, 'error');
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
            padding: 10px 15px;
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            color: white;
            border-radius: 5px;
            z-index: 10000;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
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

// Генерация UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Инициализация
let privateChatInstance = null;

document.addEventListener('DOMContentLoaded', function() {
    try {
        privateChatInstance = new PrivateChat();
        window.privateChatInstance = privateChatInstance;
    } catch (error) {
        console.error('Failed to initialize PrivateChat:', error);
    }
});