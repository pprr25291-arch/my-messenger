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
        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.loadConversations();
        this.setupCallHandlers();
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
            
            <!-- Окно звонка -->
            <div id="callWindow" class="call-window" style="display: none;">
                <div class="call-header">
                    <h4>Звонок пользователю: <span id="callUserName"></span></h4>
                    <div class="call-timer" id="callTimer">00:00</div>
                </div>
                
                <div class="video-container">
                    <video id="localVideo" autoplay muted playsinline></video>
                    <video id="remoteVideo" autoplay playsinline></video>
                </div>
                
                <div class="call-controls">
                    <button type="button" class="call-control mute-btn" onclick="privateChat.toggleMute()">
                        🔇
                    </button>
                    <button type="button" class="call-control end-call-btn" onclick="privateChat.endCall()">
                        📞
                    </button>
                    <button type="button" class="call-control video-btn" onclick="privateChat.toggleVideo()">
                        📹
                    </button>
                    <button type="button" class="call-control fullscreen-btn" onclick="privateChat.toggleFullscreen()">
                        ⛶
                    </button>
                </div>
                
                <div class="call-status" id="callStatus">
                    Установка соединения...
                </div>
            </div>
            
            <!-- Окно входящего звонка -->
            <div id="incomingCallWindow" class="incoming-call-window" style="display: none;">
                <div class="incoming-call-content">
                    <h4>Входящий звонок от: <span id="incomingCallUser"></span></h4>
                    <div class="incoming-call-buttons">
                        <button type="button" class="accept-call-btn" onclick="privateChat.acceptCall()">
                            📞 Принять
                        </button>
                        <button type="button" class="reject-call-btn" onclick="privateChat.rejectCall()">
                            ❌ Отклонить
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('privateChat').innerHTML = privateChatHTML;
        
        const privateMessages = document.getElementById('privateMessages');
        if (privateMessages) {
            privateMessages.style.overflowY = 'scroll';
            privateMessages.style.height = '400px';
        }
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

        // Новые обработчики для кнопок звонка
        document.querySelector('.video-call').addEventListener('click', () => {
            this.startCall(true);
        });

        document.querySelector('.voice-call').addEventListener('click', () => {
            this.startCall(false);
        });
    }

    setupCallHandlers() {
        this.callWindow = document.getElementById('callWindow');
        this.incomingCallWindow = document.getElementById('incomingCallWindow');
    }

    async startCall(isVideoCall) {
        if (!this.currentChat) return;

        try {
            this.currentCallId = this.generateUUID();
            this.showCallWindow(isVideoCall);
            
            // Получаем медиапоток
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: isVideoCall,
                audio: true
            });

            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;

            // Создаем peer connection
            await this.createPeerConnection();

            // Добавляем локальный поток
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Создаем offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // Отправляем offer через Socket.io
            socket.emit('call-user', {
                from: document.getElementById('username').textContent,
                to: this.currentChat,
                offer: offer,
                callId: this.currentCallId
            });

        } catch (error) {
            console.error('Error starting call:', error);
            this.showCallStatus('Ошибка при запуске звонка');
        }
    }

    async createPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        // Обработчики ICE кандидатов
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    callId: this.currentCallId,
                    candidate: event.candidate,
                    targetUser: this.currentChat
                });
            }
        };

        // Обработчик удаленного потока
        this.peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById('remoteVideo');
            if (event.streams && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                this.remoteStream = event.streams[0];
                this.showCallStatus('Соединение установлено');
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            switch (this.peerConnection.connectionState) {
                case 'connected':
                    this.showCallStatus('Соединение установлено');
                    this.startCallTimer();
                    break;
                case 'disconnected':
                case 'failed':
                    this.showCallStatus('Соединение прервано');
                    this.endCall();
                    break;
            }
        };
    }

    showCallWindow(isVideoCall) {
        document.getElementById('callUserName').textContent = this.currentChat;
        this.callWindow.style.display = 'block';
        
        if (!isVideoCall) {
            document.querySelector('.video-container').style.display = 'none';
        }
    }

    hideCallWindow() {
        this.callWindow.style.display = 'none';
        document.querySelector('.video-container').style.display = 'block';
    }

    showIncomingCallWindow(from) {
        document.getElementById('incomingCallUser').textContent = from;
        this.incomingCallWindow.style.display = 'block';
    }

    hideIncomingCallWindow() {
        this.incomingCallWindow.style.display = 'none';
    }

    async acceptCall() {
        try {
            this.hideIncomingCallWindow();
            this.showCallWindow(true);
            
            // Получаем медиапоток
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;

            // Создаем peer connection
            await this.createPeerConnection();

            // Добавляем локальный поток
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Устанавливаем удаленное описание
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(this.incomingCallOffer)
            );

            // Создаем answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            // Отправляем answer
            socket.emit('accept-call', {
                callId: this.currentCallId,
                answer: answer
            });

        } catch (error) {
            console.error('Error accepting call:', error);
            this.showCallStatus('Ошибка при принятии звонка');
        }
    }

    rejectCall() {
        socket.emit('reject-call', {
            callId: this.currentCallId
        });
        this.hideIncomingCallWindow();
        this.currentCallId = null;
    }

    async endCall() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.currentCallId) {
            socket.emit('end-call', {
                callId: this.currentCallId
            });
        }

        this.hideCallWindow();
        this.stopCallTimer();
        this.currentCallId = null;
        this.isMuted = false;
        this.isVideoEnabled = true;
    }

    toggleMute() {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            this.isMuted = !this.isMuted;
            
            const muteBtn = document.querySelector('.mute-btn');
            muteBtn.textContent = this.isMuted ? '🔇' : '🔊';
        }
    }

    toggleVideo() {
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            this.isVideoEnabled = !this.isVideoEnabled;
            
            const videoBtn = document.querySelector('.video-btn');
            videoBtn.textContent = this.isVideoEnabled ? '📹' : '📷 off';
        }
    }

    toggleFullscreen() {
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            if (!document.fullscreenElement) {
                if (videoContainer.requestFullscreen) {
                    videoContainer.requestFullscreen();
                } else if (videoContainer.mozRequestFullScreen) {
                    videoContainer.mozRequestFullScreen();
                } else if (videoContainer.webkitRequestFullscreen) {
                    videoContainer.webkitRequestFullscreen();
                } else if (videoContainer.msRequestFullscreen) {
                    videoContainer.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        }
    }

    showCallStatus(status) {
        const statusElement = document.getElementById('callStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    startCallTimer() {
        this.callStartTime = new Date();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((new Date() - this.callStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            document.getElementById('callTimer').textContent = `${minutes}:${seconds}`;
        }, 1000);
    }

    stopCallTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        document.getElementById('callTimer').textContent = '00:00';
    }

    setupSocketListeners() {
        socket.on('private message', (data) => this.handleIncomingMessage(data));
        socket.on('conversations updated', () => this.loadConversations());

        // Новые обработчики звонков
        socket.on('incoming-call', (data) => {
            this.currentCallId = data.callId;
            this.incomingCallOffer = data.offer;
            this.showIncomingCallWindow(data.from);
        });

        socket.on('call-accepted', async (data) => {
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.answer)
            );
        });

        socket.on('call-rejected', (data) => {
            this.showCallStatus('Звонок отклонен');
            setTimeout(() => this.endCall(), 2000);
        });

        socket.on('call-ended', (data) => {
            this.showCallStatus('Собеседник завершил звонок');
            setTimeout(() => this.endCall(), 2000);
        });

        socket.on('ice-candidate', async (data) => {
            if (this.peerConnection) {
                try {
                    await this.peerConnection.addIceCandidate(
                        new RTCIceCandidate(data.candidate)
                    );
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            }
        });

        socket.on('call-failed', (data) => {
            this.showCallStatus('Ошибка звонка: ' + data.reason);
            setTimeout(() => this.endCall(), 2000);
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
        
        document.getElementById('privateMessageInput').focus();
        this.loadConversations();
    }

    closeCurrentChat() {
        this.currentChat = null;
        document.getElementById('chatHeader').style.display = 'block';
        document.getElementById('activeChat').style.display = 'none';
        
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
            socket.emit('private message', {
                sender: currentUser,
                receiver: this.currentChat,
                message: message
            });
            
            input.value = '';
            input.focus();
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

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

const privateChat = new PrivateChat();