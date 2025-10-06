class GroupChat {
    constructor() {
        this.groups = new Map();
        this.currentGroup = null;
        this.selectedUsers = new Set();
        this.init();
    }

    init() {
        this.createGroupUI();
        this.setupSocketListeners();
        this.loadGroups();
    }

    createGroupUI() {
        // Добавляем кнопку создания группы в приватный чат
        const privateChatSidebar = document.querySelector('.private-chat-sidebar');
        if (privateChatSidebar) {
            const createGroupBtn = document.createElement('button');
            createGroupBtn.className = 'create-group-btn';
            createGroupBtn.innerHTML = '👥 Создать группу';
            createGroupBtn.style.cssText = `
                margin: 10px;
                padding: 10px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                width: calc(100% - 20px);
                font-size: 14px;
                transition: all 0.3s ease;
            `;
            
            createGroupBtn.addEventListener('click', () => this.showCreateGroupModal());
            privateChatSidebar.insertBefore(createGroupBtn, privateChatSidebar.querySelector('.conversations-list'));
        }
    }



 setupGroupModalEvents(modal) {
    const closeBtn = modal.querySelector('.close-modal');
    const createBtn = modal.querySelector('#createGroupBtn');
    
    const closeModal = () => {
        modal.remove();
        this.selectedUsers.clear();
        document.removeEventListener('keydown', handleEscKey);
    };
    
    const handleEscKey = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    
    closeBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    createBtn.addEventListener('click', () => this.createGroup());
    
    document.addEventListener('keydown', handleEscKey);
}

    async loadAvailableUsers() {
    try {
        const response = await fetch('/api/users/all');
        if (!response.ok) throw new Error('Failed to load users');
        
        const users = await response.json();
        
        const container = document.getElementById('availableUsers');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (users.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Нет доступных пользователей</div>';
            return;
        }
        
        const currentUser = document.getElementById('username')?.textContent;
        
        users.forEach(user => {
            if (!user || !user.username || user.username === currentUser) return;
            
            const userElement = document.createElement('div');
            userElement.className = 'user-select-item';
            
            const isOnline = user.isOnline === true;
            const statusClass = isOnline ? 'online' : 'offline';
            const statusText = isOnline ? 'online' : 'offline';
            
            userElement.innerHTML = `
                <input type="checkbox" value="${user.username}">
                <span class="user-avatar">👤</span>
                <span class="user-name">${user.username}</span>
                <span class="user-status ${statusClass}">${statusText}</span>
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
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">Ошибка загрузки пользователей</div>';
        }
    }
}

    toggleUserSelection(username, selected) {
        const selectedContainer = document.getElementById('selectedUsers');
        if (!selectedContainer) return;
        
        if (selected) {
            this.selectedUsers.add(username);
            this.updateSelectedUsersDisplay();
        } else {
            this.removeUserSelection(username);
        }
    }

    removeUserSelection(username) {
        this.selectedUsers.delete(username);
        this.updateSelectedUsersDisplay();
        
        // Снимаем галочку с чекбокса
        const checkbox = document.querySelector(`input[value="${username}"]`);
        if (checkbox) {
            checkbox.checked = false;
        }
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
        badge.innerHTML = `
            👤 ${username}
            <span class="remove-user" data-username="${username}">✕</span>
        `;
        
        const removeBtn = badge.querySelector('.remove-user');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeUserSelection(username);
        });
        
        selectedContainer.appendChild(badge);
    });
}

    async createGroup() {
        const groupNameInput = document.getElementById('groupName');
        if (!groupNameInput) return;
        
        const groupName = groupNameInput.value.trim();

        if (!groupName) {
            this.showNotification('Введите название группы', 'error');
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
                if (result.success) {
                    document.querySelector('.modal-overlay')?.remove();
                    this.showNotification('Группа создана успешно!', 'success');
                    this.selectedUsers.clear();
                    
                    // Обновляем список групп
                    this.loadGroups();
                } else {
                    throw new Error(result.error || 'Failed to create group');
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

    async loadGroups() {
        try {
            const response = await fetch('/api/groups');
            if (!response.ok) throw new Error('Failed to load groups');
            
            const groups = await response.json();
            
            // Обновляем UI со списком групп
            this.displayGroups(groups);
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    }

    displayGroups(groups) {
        const conversationsList = document.getElementById('conversationsList');
        if (!conversationsList) return;

        // Удаляем существующие группы из списка
        const existingGroups = conversationsList.querySelectorAll('.group-item');
        existingGroups.forEach(group => group.remove());

        // Добавляем группы в список диалогов
        groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = `conversation-item group-item ${this.currentGroup?.id === group.id ? 'active' : ''}`;
            groupElement.style.cssText = `
                background: linear-gradient(45deg, #28a745, #20c997) !important;
                color: white !important;
                margin: 5px 0;
                border-radius: 8px;
            `;
            
            groupElement.innerHTML = `
                <div class="conv-info">
                    <div class="conv-name" style="color: white; font-weight: bold;">👥 ${group.name}</div>
                    <div class="conv-preview" style="color: rgba(255,255,255,0.8);">Участников: ${group.members ? group.members.length : 0}</div>
                </div>
            `;
            
            groupElement.addEventListener('click', () => this.openGroup(group));
            conversationsList.appendChild(groupElement);
        });
    }

    openGroup(group) {
        this.currentGroup = group;
        // Открываем групповой чат
        this.showGroupChat(group);
    }

    showGroupChat(group) {
        // Скрываем приватный чат и показываем групповой
        const privateChat = document.getElementById('activeChat');
        const noChatSelected = document.getElementById('noChatSelected');
        
        if (privateChat) privateChat.style.display = 'none';
        if (noChatSelected) noChatSelected.style.display = 'none';
        
        // Создаем или показываем интерфейс группового чата
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
                        <span class="user-status">Групповой чат • ${group.members ? group.members.length : 0} участников</span>
                    </div>
                </div>
                <div class="call-buttons">
                    <button class="close-chat" title="Закрыть чат">✕</button>
                </div>
            </div>
            
            <div class="chat-messages-container">
                <div id="groupMessages" class="private-messages">
                    <div class="no-messages">📝 Начните общение в группе!</div>
                </div>
            </div>
            
            <div class="message-input-area">
                <div class="message-input-container">
                    <input type="text" id="groupMessageInput" placeholder="Напишите сообщение в группу..." autocomplete="off">
                    <button type="button" class="attach-file" title="Прикрепить файл">📎</button>
                    <button type="button" class="send-button" onclick="window.groupChat.sendGroupMessage()">Отправить</button>
                </div>
            </div>
        `;
        
        // Добавляем обработчик закрытия
        const closeBtn = groupChatContainer.querySelector('.close-chat');
        closeBtn.addEventListener('click', () => this.closeGroupChat());
        
        // Добавляем обработчик отправки сообщения по Enter
        const messageInput = groupChatContainer.querySelector('#groupMessageInput');
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendGroupMessage();
        });
        
        // Загружаем историю сообщений группы
        this.loadGroupMessages(group.id);
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
            // Здесь должна быть загрузка сообщений группы
            console.log('Loading messages for group:', groupId);
        } catch (error) {
            console.error('Error loading group messages:', error);
        }
    }

    async sendGroupMessage() {
        if (!this.currentGroup) return;
        
        const messageInput = document.getElementById('groupMessageInput');
        if (!messageInput) return;
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        try {
            // Здесь должна быть отправка сообщения в группу
            console.log('Sending message to group:', this.currentGroup.id, message);
            
            // Очищаем поле ввода
            messageInput.value = '';
            
        } catch (error) {
            console.error('Error sending group message:', error);
            this.showNotification('Ошибка отправки сообщения', 'error');
        }
    }

    setupSocketListeners() {
        if (window.socket) {
            window.socket.on('group_message', (data) => {
                this.handleGroupMessage(data);
            });
            
            window.socket.on('group_created', (data) => {
                this.handleGroupCreated(data);
            });
            
            window.socket.on('group_updated', (data) => {
                this.handleGroupUpdated(data);
            });
        }
    }

    handleGroupMessage(data) {
        if (this.currentGroup && data.groupId === this.currentGroup.id) {
            this.displayGroupMessage(data);
        }
    }

    handleGroupCreated(data) {
        this.groups.set(data.group.id, data.group);
        this.loadGroups();
        this.showNotification(`Создана новая группа: ${data.group.name}`, 'success');
    }

    handleGroupUpdated(data) {
        this.loadGroups();
    }

    displayGroupMessage(data) {
        const container = document.getElementById('groupMessages');
        if (!container) return;
        
        const noMessages = container.querySelector('.no-messages');
        if (noMessages) noMessages.remove();
        
        const messageElement = document.createElement('div');
        messageElement.className = `private-message ${data.sender === document.getElementById('username')?.textContent ? 'own' : 'other'}`;
        
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <strong>${data.sender}</strong>
                    <span class="message-time">${data.timestamp}</span>
                </div>
                <div class="message-text">${data.message}</div>
            </div>
        `;
        
        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    }

    showNotification(message, type = 'info') {
        // Используем существующую функцию уведомлений из приватного чата
        if (window.privateChatInstance) {
            window.privateChatInstance.showNotification(message, type);
        } else {
            // Fallback уведомление
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
}

// Добавьте CSS стили
const groupChatStyles = `
    .group-item {
        background: linear-gradient(45deg, #28a745, #20c997) !important;
        color: white !important;
        border-left: 3px solid #28a745 !important;
    }
    
    .group-item .conv-name {
        color: white !important;
        font-weight: bold;
    }
    
    .group-item .conv-preview {
        color: rgba(255,255,255,0.8) !important;
    }
    
    .create-group-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
    }
    
    .selected-user-badge {
        transition: all 0.3s ease;
    }
    
    .selected-user-badge:hover {
        background: #dc3545 !important;
        transform: scale(1.05);
    }
    
    .user-select-item:hover {
        background-color: #f8f9fa !important;
    }
    
    .users-list {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 5px;
        background: white;
    }
    
    .users-list::-webkit-scrollbar {
        width: 6px;
    }
    
    .users-list::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }
    
    .users-list::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    .users-list::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }
    
    .selected-users {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        min-height: 50px;
        align-items: flex-start;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 5px;
        border: 1px dashed #dee2e6;
    }
`;

// Добавляем стили в документ
if (!document.getElementById('group-chat-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'group-chat-styles';
    styleElement.textContent = groupChatStyles;
    document.head.appendChild(styleElement);
}

// Инициализация групповых чатов
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (!window.groupChat) {
            window.groupChat = new GroupChat();
        }
    }, 2000);
});

// Глобальные методы для доступа из HTML
window.GroupChat = GroupChat;