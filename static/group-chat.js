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
// В классе GroupChatManager добавьте:
setupMobileGroupHandlers() {
    if (!isMobileDevice()) return;
    
    const originalOpenGroupChat = this.openGroupChat.bind(this);
    this.openGroupChat = async function(group) {
        await originalOpenGroupChat(group);
        
        // Для мобильных скрываем сайдбар и показываем чат
        const sidebar = document.querySelector('.private-chat-sidebar');
        const mainChat = document.querySelector('.private-chat-main');
        
        if (sidebar) sidebar.classList.add('hidden');
        if (mainChat) mainChat.classList.add('active');
        
        updateMobileNavActive('chat');
        
        // Добавляем кнопку "Назад" для группового чата
        this.addMobileGroupBackButton(group);
    };
}

addMobileGroupBackButton(group) {
    const chatTopBar = document.querySelector('.chat-top-bar');
    if (!chatTopBar) return;
    
    // Удаляем существующие кнопки "Назад"
    const existingBackBtn = chatTopBar.querySelector('.mobile-back-button, .back-to-groups');
    if (existingBackBtn) existingBackBtn.remove();
    
    const backButton = document.createElement('button');
    backButton.className = 'back-to-groups mobile-back-button';
    backButton.innerHTML = '←';
    backButton.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        margin-right: 10px;
        cursor: pointer;
        padding: 5px;
    `;
    
    backButton.addEventListener('click', () => {
        this.closeGroupChat();
        showMobileSection('groups');
    });
    
    chatTopBar.insertBefore(backButton, chatTopBar.firstChild);
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
    console.log('🎯 Opening create group modal...');
    
    try {
        // Закрываем другие модальные окна
        this.closeAllModals();
        
        let modal = document.getElementById('createGroupModal');
        
        if (modal) {
            console.log('✅ Using existing modal');
            modal.style.display = 'flex';
            this.modal = modal;
        } else {
            console.log('🔄 Creating new modal');
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
                    
                    <div class="modal-footer" style="display: flex; gap: 10px;">
                        <button id="cancelGroupBtn" class="btn-secondary" style="flex: 1; padding: 15px; background: #6c757d; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600;">Отмена</button>
                        <button id="createGroupBtn" class="btn-primary" style="flex: 1; padding: 15px; background: linear-gradient(45deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600;">Создать группу</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        }
        
        this.modal = modal;
        this.setupGroupModalEvents();
        this.loadAvailableUsers();
        
        // Фокусируемся на поле ввода
        setTimeout(() => {
            const groupNameInput = document.getElementById('groupName');
            if (groupNameInput) {
                groupNameInput.focus();
            }
        }, 100);
        
    } catch (error) {
        console.error('❌ Error opening create group modal:', error);
        this.showNotification('Ошибка открытия окна создания группы', 'error');
    }
}

// Добавьте вспомогательный метод для закрытия всех модальных окон
closeAllModals() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        if (modal.id !== 'createGroupModal') {
            modal.style.display = 'none';
        }
    });
}

 setupGroupModalEvents() {
    if (!this.modal) return;
    
    const closeBtn = this.modal.querySelector('.close-modal');
    const cancelBtn = this.modal.querySelector('#cancelGroupBtn');
    const createBtn = this.modal.querySelector('#createGroupBtn');
    const groupNameInput = this.modal.querySelector('#groupName');
    
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
    
    // Обработчики закрытия
    [closeBtn, cancelBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            });
        }
    });
    
    // Обработчик создания группы
    if (createBtn) {
        createBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.createGroup();
        });
    }
    
    // Закрытие по клику вне модального окна
    this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
            closeModal();
        }
    });
    
    // Предотвращаем закрытие при клике на контент
    const modalContent = this.modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // Обработка клавиши Enter в поле названия группы
    if (groupNameInput) {
        groupNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.createGroup();
            }
        });
    }
    
    document.addEventListener('keydown', handleEscKey);
    
    console.log('✅ Group modal events setup completed');
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
// Добавьте после класса GroupChatManager
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing GroupChatManager...');
    
    // Инициализируем GroupChatManager
    if (!window.groupChatManager) {
        window.groupChatManager = new GroupChatManager();
        console.log('✅ GroupChatManager initialized successfully');
    }
    
    // Настраиваем обработчик кнопки создания группы
    setupCreateGroupButton();
});

function setupCreateGroupButton() {
    // Используем делегирование событий для динамически создаваемых кнопок
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('create-group-btn') || 
            e.target.closest('.create-group-btn')) {
            console.log('🎯 Create group button clicked');
            e.preventDefault();
            e.stopPropagation();
            
            if (window.groupChatManager) {
                window.groupChatManager.showCreateGroupModal();
            } else {
                console.error('❌ GroupChatManager not available');
                // Создаем экземпляр, если его нет
                window.groupChatManager = new GroupChatManager();
                setTimeout(() => {
                    window.groupChatManager.showCreateGroupModal();
                }, 100);
            }
        }
    });
}
window.GroupChatManager = GroupChatManager;