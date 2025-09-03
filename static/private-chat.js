class PrivateChat {
    constructor() {
        this.currentChat = null;
        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
        this.setupSocketListeners();
    }

    createUI() {
        const privateChatHTML = `
            <div class="private-chat-container">
                <div class="private-chat-sidebar">
                    <div class="search-container">
                        <input type="text" id="userSearch" placeholder="Поиск по имени, тегу или интересам...">
                        <div id="searchResults"></div>
                    </div>
                    <div id="chatList" class="chat-list">
                        <div class="chat-item">Начните поиск чтобы найти пользователей</div>
                    </div>
                </div>
                <div class="private-chat-main">
                    <div id="privateHeader" class="private-header">
                        <h3>Выберите чат</h3>
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
            if ((data.receiver === document.getElementById('username').textContent && data.sender === this.currentChat) ||
                (data.sender === document.getElementById('username').textContent && data.receiver === this.currentChat)) {
                this.displayPrivateMessage(data);
            }
        });
    }

    async searchUsers() {
        const query = document.getElementById('userSearch').value.trim();
        if (query.length < 2) {
            document.getElementById('searchResults').innerHTML = '';
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

        if (users.length === 0) {
            resultsContainer.innerHTML = '<div class="search-result">Пользователи не найдены</div>';
            return;
        }

        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'search-result';
            userElement.innerHTML = `
                <span>${user.username} ${user.tag}</span>
                <button onclick="privateChat.startChat('${user.username}')">Чат</button>
            `;
            resultsContainer.appendChild(userElement);
        });
    }

    async startChat(username) {
        this.currentChat = username;
        
        document.getElementById('privateHeader').innerHTML = `
            <h3>Чат с ${username}</h3>
            <button class="header-btn" onclick="privateChat.closeChat()">✕</button>
        `;
        
        document.getElementById('privateMessageForm').style.display = 'flex';
        document.getElementById('userSearch').value = '';
        document.getElementById('searchResults').innerHTML = '';
        
        try {
            const response = await fetch(`/api/messages/private/${username}`);
            const messages = await response.json();
            this.displayMessageHistory(messages);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    closeChat() {
        this.currentChat = null;
        document.getElementById('privateHeader').innerHTML = '<h3>Выберите чат</h3>';
        document.getElementById('privateMessageForm').style.display = 'none';
        document.getElementById('privateMessages').innerHTML = '';
    }

    displayMessageHistory(messages) {
        const container = document.getElementById('privateMessages');
        container.innerHTML = '';
        
        messages.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        messages.forEach(message => {
            this.displayPrivateMessage(message);
        });
        
        container.scrollTop = container.scrollHeight;
    }

    displayPrivateMessage(data) {
        const container = document.getElementById('privateMessages');
        const messageElement = document.createElement('div');
        const isOwn = data.sender === document.getElementById('username').textContent;
        
        messageElement.className = `private-message ${isOwn ? 'own' : ''}`;
        messageElement.innerHTML = `
            <strong>${data.sender}</strong> 
            <span>(${data.timestamp})</span>: 
            ${data.message}
        `;
        
        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    }

    sendPrivateMessage() {
        const input = document.getElementById('privateMessageInput');
        const message = input.value.trim();
        
        if (message && this.currentChat) {
            socket.emit('private message', {
                sender: document.getElementById('username').textContent,
                receiver: this.currentChat,
                message: message
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

// Инициализируем приватный чат
const privateChat = new PrivateChat();