class PrivateChat {
    constructor() {
        this.currentChat = null;
        this.conversations = [];
        this.isScrolledToBottom = true;
        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.loadConversations();
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

    createUI() {
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
                            <button type="button" class="close-chat">✕</button>
                        </div>
                        
                        <div class="chat-messages-wrapper">
                            <div id="privateMessages" class="private-messages">
                                <div class="no-messages">📝 Начните общение первым!</div>
                            </div>
                            <div class="scroll-indicator" id="scrollIndicator" style="display: none;">
                                <button type="button" onclick="privateChat.scrollToBottom()">
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

        document.getElementById('privateChat').innerHTML = privateChatHTML;
    }

    setupEventListeners() {
        const userSearch = document.getElementById('userSearch');
        userSearch.addEventListener('input', this.debounce(this.searchUsers.bind(this), 300));

        const messageInput = document.getElementById('privateMessageInput');
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendPrivateMessage();
        });

        document.querySelector('.send-button').addEventListener('click', () => this.sendPrivateMessage());
        document.querySelector('.close-chat').addEventListener('click', () => this.closeCurrentChat());

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.getElementById('searchResults').style.display = 'none';
            }
        });

        const messagesContainer = document.getElementById('privateMessages');
        if (messagesContainer) {
            messagesContainer.addEventListener('scroll', () => {
                this.handleScroll();
            });
        }
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
        socket.on('private message', (data) => this.handleIncomingMessage(data));
        socket.on('conversations updated', () => this.loadConversations());
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

    async searchUsers() {
        const query = document.getElementById('userSearch').value.trim();
        const resultsContainer = document.getElementById('searchResults');
        
        if (query.length < 2) {
            resultsContainer.style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`);
            const users = await response.json();
            this.displaySearchResults(users);
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    displaySearchResults(users) {
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'block';

        if (users.length === 0) {
            resultsContainer.innerHTML = '<div class="search-result">😢 Никого не найдено</div>';
            return;
        }

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

    async startChat(username) {
        this.currentChat = username;
        
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('userSearch').value = '';
        
        document.getElementById('chatHeader').style.display = 'none';
        document.getElementById('activeChat').style.display = 'flex';
        document.getElementById('currentChatUser').textContent = username;
        
        try {
            const response = await fetch(`/api/messages/private/${username}`);
            const messages = await response.json();
            this.displayMessageHistory(messages);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
        
        // Принудительно включаем скроллбар
        this.forceScrollbarVisibility();
        
        // Фокус на поле ввода
        document.getElementById('privateMessageInput').focus();
        this.loadConversations();
    }

    // Принудительно показываем скроллбар
    forceScrollbarVisibility() {
        const messagesContainer = document.getElementById('privateMessages');
        if (messagesContainer) {
            messagesContainer.style.overflowY = 'scroll';
            messagesContainer.style.height = '400px';
        }
    }

    closeCurrentChat() {
        this.currentChat = null;
        document.getElementById('chatHeader').style.display = 'block';
        document.getElementById('activeChat').style.display = 'none';
        
        // Сохраняем поле ввода, только очищаем сообщения
        const privateMessages = document.getElementById('privateMessages');
        privateMessages.innerHTML = '<div class="no-messages">📝 Начните общение первым!</div>';
        
        document.getElementById('privateMessageInput').value = '';
        this.hideScrollIndicator();
        
        this.loadConversations();
    }

    displayMessageHistory(messages) {
        const container = document.getElementById('privateMessages');
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
        
        const noMessagesElement = container.querySelector('.no-messages');
        if (noMessagesElement) {
            noMessagesElement.remove();
        }
        
        const messageElement = document.createElement('div');
        const isOwn = message.sender === document.getElementById('username').textContent;
        
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

    handleIncomingMessage(data) {
        if (this.currentChat && 
            ((data.sender === this.currentChat && data.receiver === document.getElementById('username').textContent) ||
             (data.receiver === this.currentChat && data.sender === document.getElementById('username').textContent))) {
            this.displayMessage(data, true);
        }
        
        this.loadConversations();
    }

    sendPrivateMessage() {
        const input = document.getElementById('privateMessageInput');
        const message = input.value.trim();
        const currentUser = document.getElementById('username').textContent;
        
        if (message && this.currentChat) {
            // Сохраняем сообщение перед отправкой
            const tempMessage = message;
            
            socket.emit('private message', {
                sender: currentUser,
                receiver: this.currentChat,
                message: tempMessage
            });
            
            // Очищаем поле ввода но сохраняем фокус
            input.value = '';
            
            // Гарантируем что поле ввода остается видимым
            this.ensureInputVisibility();
            
            // Возвращаем фокус
            input.focus();
        }
    }

    // Гарантируем видимость поля ввода
    ensureInputVisibility() {
        const inputContainer = document.querySelector('.message-input-container');
        const privateChat = document.getElementById('privateChat');
        const activeChat = document.getElementById('activeChat');
        
        if (inputContainer) {
            inputContainer.style.display = 'flex';
            inputContainer.style.visibility = 'visible';
            inputContainer.style.opacity = '1';
        }
        
        if (privateChat) {
            privateChat.style.display = 'block';
        }
        
        if (activeChat) {
            activeChat.style.display = 'flex';
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
}

const privateChat = new PrivateChat();