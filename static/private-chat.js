class PrivateChat {
    constructor() {
        this.currentChat = null;
        this.conversations = [];
        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.loadConversations();
        
        const username = document.getElementById('username').textContent;
        socket.emit('user connected', username);
    }

    createUI() {
        const privateChatHTML = `
            <div class="private-chat-container">
                <div class="private-chat-sidebar">
                    <div class="search-container">
                        <input type="text" id="userSearch" placeholder="Поиск пользователей...">
                        <div id="searchResults" class="search-results"></div>
                    </div>
                    <div class="conversations-header">
                        <h4>Диалоги</h4>
                    </div>
                    <div id="conversationsList" class="conversations-list"></div>
                </div>
                <div class="private-chat-main">
                    <div id="privateHeader" class="private-header">
                        <h3>Выберите диалог</h3>
                    </div>
                    <div id="privateMessages" class="private-messages"></div>
                    <form id="privateMessageForm" class="private-form" style="display: none;">
                        <input type="text" id="privateMessageInput" placeholder="Введите сообщение..." autocomplete="off">
                        <button type="submit">Отправить</button>
                    </form>
                </div>
            </div>
        `;

        const privateChatSection = document.getElementById('privateChat');
        privateChatSection.innerHTML = privateChatHTML;
    }

    setupEventListeners() {
        const userSearch = document.getElementById('userSearch');
        userSearch.addEventListener('input', this.debounce(this.searchUsers.bind(this), 300));

        const privateMessageForm = document.getElementById('privateMessageForm');
        if (privateMessageForm) {
            privateMessageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendPrivateMessage();
            });
        }
    }

    setupSocketListeners() {
        socket.on('private message', (data) => {
            this.handleIncomingMessage(data);
        });

        socket.on('conversations updated', () => {
            this.loadConversations();
        });
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
            container.innerHTML = '<div class="no-conversations">Нет диалогов</div>';
            return;
        }

        this.conversations.forEach(conversation => {
            const conversationElement = document.createElement('div');
            conversationElement.className = `conversation-item ${conversation.username === this.currentChat ? 'active' : ''}`;
            
            let lastMessageText = 'Нет сообщений';
            if (conversation.lastMessage) {
                lastMessageText = conversation.lastMessage.isOwn ? 
                    `Вы: ${conversation.lastMessage.text}` : 
                    conversation.lastMessage.text;
            }

            conversationElement.innerHTML = `
                <div class="conversation-info">
                    <div class="conversation-header">
                        <span class="username">${conversation.username}</span>
                        <span class="tag">${conversation.tag}</span>
                        ${conversation.isOnline ? '<span class="online-dot"></span>' : ''}
                    </div>
                    <div class="last-message">${lastMessageText}</div>
                    ${conversation.lastMessage ? 
                        `<div class="message-time">${conversation.lastMessage.timestamp}</div>` : ''}
                </div>
                ${conversation.unreadCount > 0 ? 
                    `<span class="unread-count">${conversation.unreadCount}</span>` : ''}
            `;

            conversationElement.addEventListener('click', () => {
                this.startChat(conversation.username);
            });

            container.appendChild(conversationElement);
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
            resultsContainer.innerHTML = '<div class="search-result">Пользователи не найдены</div>';
            return;
        }

        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'search-result';
            userElement.innerHTML = `
                <div class="user-info">
                    <span class="username">${user.username}</span>
                    <span class="tag">${user.tag}</span>
                </div>
                <button onclick="privateChat.startChat('${user.username}')">Написать</button>
            `;
            resultsContainer.appendChild(userElement);
        });

        document.addEventListener('click', (e) => {
            if (!resultsContainer.contains(e.target) && e.target.id !== 'userSearch') {
                resultsContainer.style.display = 'none';
            }
        });
    }

    async startChat(username) {
        this.currentChat = username;
        
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('userSearch').value = '';
        
        document.getElementById('privateHeader').innerHTML = `
            <div class="chat-header-info">
                <h3>${username}</h3>
                <span class="user-status">В сети</span>
            </div>
            <button class="close-chat-btn" onclick="privateChat.closeChat()">✕</button>
        `;
        
        document.getElementById('privateMessageForm').style.display = 'flex';
        
        try {
            const response = await fetch(`/api/messages/private/${username}`);
            const messages = await response.json();
            this.displayMessageHistory(messages);
            this.loadConversations();
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    closeChat() {
        this.currentChat = null;
        document.getElementById('privateHeader').innerHTML = '<h3>Выберите диалог</h3>';
        document.getElementById('privateMessageForm').style.display = 'none';
        document.getElementById('privateMessages').innerHTML = '';
        this.loadConversations();
    }

    displayMessageHistory(messages) {
        const container = document.getElementById('privateMessages');
        container.innerHTML = '';
        
        messages.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        messages.forEach(message => {
            this.displayMessage(message);
        });
        
        container.scrollTop = container.scrollHeight;
    }

    displayMessage(message) {
        const container = document.getElementById('privateMessages');
        const messageElement = document.createElement('div');
        const isOwn = message.sender === document.getElementById('username').textContent;
        
        messageElement.className = `private-message ${isOwn ? 'own' : ''}`;
        messageElement.innerHTML = `
            <div class="message-sender">${message.sender}</div>
            <div class="message-text">${message.message}</div>
            <div class="message-time">${message.timestamp}</div>
        `;
        
        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    }

    handleIncomingMessage(data) {
        if (this.currentChat && 
            ((data.sender === this.currentChat && data.receiver === document.getElementById('username').textContent) ||
             (data.receiver === this.currentChat && data.sender === document.getElementById('username').textContent))) {
            this.displayMessage(data);
        }
        this.loadConversations();
    }

    sendPrivateMessage() {
        const input = document.getElementById('privateMessageInput');
        const message = input.value.trim();
        const currentUser = document.getElementById('username').textContent;
        
        if (message && this.currentChat) {
            socket.emit('private message', {
                sender: currentUser,
                receiver: this.currentChat,
                message: message
            });
            
            this.displayMessage({
                sender: currentUser,
                receiver: this.currentChat,
                message: message,
                timestamp: new Date().toLocaleTimeString()
            });
            
            input.value = '';
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