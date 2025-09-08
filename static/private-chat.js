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
        
        // Отложенная инициализация
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
                        </div>
                    </div>
                </div>
            </div>
        `;

        privateChatContainer.innerHTML = privateChatHTML;
    }

    setupEventListeners() {
        setTimeout(() => {
            // Поиск пользователей
            const userSearch = document.getElementById('userSearch');
            if (userSearch) {
                userSearch.addEventListener('input', this.debounce(() => {
                    this.searchUsers();
                }, 300));
            }

            // Отправка сообщений
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

            // Закрытие чата
            const closeChat = document.querySelector('.close-chat');
            if (closeChat) {
                closeChat.addEventListener('click', () => this.closeCurrentChat());
            }

            // Кнопки звонка
            const videoCallBtn = document.querySelector('.video-call');
            if (videoCallBtn) {
                videoCallBtn.addEventListener('click', () => this.startCall(true));
            }

            const voiceCallBtn = document.querySelector('.voice-call');
            if (voiceCallBtn) {
                voiceCallBtn.addEventListener('click', () => this.startCall(false));
            }

            // Клик вне области поиска
            document.addEventListener('click', (e) => {
                const searchContainer = document.querySelector('.search-container');
                if (searchContainer && !e.target.closest('.search-container')) {
                    const resultsContainer = document.getElementById('searchResults');
                    if (resultsContainer) {
                        resultsContainer.style.display = 'none';
                    }
                }
            });

            // Скролл сообщений
            const messagesContainer = document.getElementById('privateMessages');
            if (messagesContainer) {
                messagesContainer.addEventListener('scroll', () => {
                    this.handleScroll();
                });
            }

        }, 200);
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
            console.log('Searching for:', query);
            const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const users = await response.json();
            console.log('Found users:', users);
            
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
            const preview = lastMsg ? (lastMsg.isOwn ? `Вы: ${lastMsg.text}` : lastMsg.text) : 'Нет сообщений';
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
        
        const messageElement = document.createElement('div');
        const currentUsername = document.getElementById('username')?.textContent;
        const isOwn = message.sender === currentUsername;
        
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
                    message: message
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
    }

    handleIncomingMessage(data) {
        if (this.currentChat && 
            ((data.sender === this.currentChat && data.receiver === document.getElementById('username')?.textContent) ||
             (data.receiver === this.currentChat && data.sender === document.getElementById('username')?.textContent))) {
            this.displayMessage(data, true);
        }
        
        this.loadConversations();
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

    // Методы для звонков (упрощенные)
    async startCall(isVideoCall) {
        console.log('Starting call:', isVideoCall);
        // Реализация звонков будет здесь
    }
}

// Глобальная переменная для доступа к экземпляру
let privateChatInstance = null;

// Инициализация после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    try {
        privateChatInstance = new PrivateChat();
        window.privateChatInstance = privateChatInstance;
    } catch (error) {
        console.error('Failed to initialize PrivateChat:', error);
    }
});