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
        this.screenShareStream = null;
        this.screenShareConnection = null;
        this.isScreenSharing = false;
        this.screenShareId = null;
        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.loadConversations();
        this.setupCallHandlers();
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
                                <button type="button" class="call-btn screen-share" title="Трансляция экрана">
                                    🖥️
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
                    <button type="button" class="call-control screen-share-btn" onclick="privateChat.startScreenShare()">
                        🖥️
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

            <!-- Окно трансляции экрана -->
            <div id="screenShareWindow" class="screen-share-window" style="display: none;">
                <div class="screen-share-header">
                    <h4>Трансляция экрана пользователю: <span id="screenShareUser"></span></h4>
                    <div class="screen-share-status" id="screenShareStatus">
                        Запрос отправлен...
                    </div>
                </div>
                
                <div class="screen-share-controls">
                    <button type="button" class="screen-share-control stop-share-btn" onclick="privateChat.stopScreenShare()">
                        🖥️ Остановить трансляцию
                    </button>
                </div>
            </div>

            <!-- Окно входящей трансляции экрана -->
            <div id="incomingScreenShareWindow" class="incoming-screen-share-window" style="display: none;">
                <div class="incoming-screen-share-content">
                    <h4>Входящая трансляция экрана от: <span id="incomingScreenShareUser"></span></h4>
                    <div class="incoming-screen-share-buttons">
                        <button type="button" class="accept-screen-share-btn" onclick="privateChat.acceptScreenShare()">
                            🖥️ Принять
                        </button>
                        <button type="button" class="reject-screen-share-btn" onclick="privateChat.rejectScreenShare()">
                            ❌ Отклонить
                        </button>
                    </div>
                </div>
            </div>

            <!-- Окно просмотра трансляции экрана -->
            <div id="screenViewWindow" class="screen-view-window" style="display: none;">
                <div class="screen-view-header">
                    <h4>Трансляция экрана от: <span id="screenViewUser"></span></h4>
                    <button type="button" class="close-screen-view" onclick="privateChat.closeScreenView()">
                        ✕
                    </button>
                </div>
                
                <div class="screen-view-container">
                    <video id="screenViewVideo" autoplay playsinline></video>
                </div>
                
                <div class="screen-view-controls">
                    <button type="button" class="screen-view-control fullscreen-btn" onclick="privateChat.toggleScreenFullscreen()">
                        ⛶
                    </button>
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

        // Новые обработчики для кнопок звонка и трансляции
        document.querySelector('.video-call').addEventListener('click', () => {
            this.startCall(true);
        });

        document.querySelector('.voice-call').addEventListener('click', () => {
            this.startCall(false);
        });

        document.querySelector('.screen-share').addEventListener('click', () => {
            this.startScreenShare();
        });
    }

    setupCallHandlers() {
        this.callWindow = document.getElementById('callWindow');
        this.incomingCallWindow = document.getElementById('incomingCallWindow');
        this.screenShareWindow = document.getElementById('screenShareWindow');
        this.incomingScreenShareWindow = document.getElementById('incomingScreenShareWindow');
        this.screenViewWindow = document.getElementById('screenViewWindow');
    }

    // ========== ФУНКЦИОНАЛ ТРАНСЛЯЦИИ ЭКРАНА ==========

    async startScreenShare() {
        if (!this.currentChat) {
            alert('Выберите пользователя для трансляции экрана');
            return;
        }

        try {
            // Запрашиваем доступ к экрану :cite[1]:cite[4]:cite[7]
            this.screenShareStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always",
                    displaySurface: "monitor"
                },
                audio: true
            });

            // Создаем уникальный ID для сессии трансляции
            this.screenShareId = this.generateUUID();
            
            // Создаем peer connection для трансляции экрана
            await this.createScreenShareConnection();

            // Добавляем треки экрана в соединение
            this.screenShareStream.getTracks().forEach(track => {
                this.screenShareConnection.addTrack(track, this.screenShareStream);
            });

            // Создаем offer
            const offer = await this.screenShareConnection.createOffer();
            await this.screenShareConnection.setLocalDescription(offer);

            // Отправляем offer через Socket.io
            socket.emit('start-screen-share', {
                from: document.getElementById('username').textContent,
                to: this.currentChat,
                offer: offer,
                screenShareId: this.screenShareId
            });

            // Показываем окно управления трансляцией
            this.showScreenShareWindow();

            // Обработчик завершения трансляции пользователем
            this.screenShareStream.getTracks().forEach(track => {
                track.onended = () => {
                    this.stopScreenShare();
                };
            });

        } catch (error) {
            console.error('Error starting screen share:', error);
            if (error.name !== 'NotAllowedError') {
                alert('Ошибка при запуске трансляции экрана: ' + error.message);
            }
        }
    }

    async createScreenShareConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.screenShareConnection = new RTCPeerConnection(configuration);

        // Обработчики ICE кандидатов
        this.screenShareConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('screen-share-ice-candidate', {
                    screenShareId: this.screenShareId,
                    candidate: event.candidate,
                    targetUser: this.currentChat
                });
            }
        };

        // Обработчик удаленного потока
        this.screenShareConnection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                const screenViewVideo = document.getElementById('screenViewVideo');
                screenViewVideo.srcObject = event.streams[0];
                this.showScreenViewWindow();
            }
        };

        this.screenShareConnection.onconnectionstatechange = () => {
            const statusElement = document.getElementById('screenShareStatus');
            if (statusElement) {
                switch (this.screenShareConnection.connectionState) {
                    case 'connected':
                        statusElement.textContent = 'Трансляция активна';
                        break;
                    case 'disconnected':
                    case 'failed':
                        statusElement.textContent = 'Соединение прервано';
                        this.stopScreenShare();
                        break;
                }
            }
        };
    }

    async acceptScreenShare() {
        try {
            this.hideIncomingScreenShareWindow();
            
            // Создаем peer connection для приема трансляции
            await this.createScreenShareConnection();

            // Устанавливаем удаленное описание
            await this.screenShareConnection.setRemoteDescription(
                new RTCSessionDescription(this.incomingScreenShareOffer)
            );

            // Создаем answer
            const answer = await this.screenShareConnection.createAnswer();
            await this.screenShareConnection.setLocalDescription(answer);

            // Отправляем answer
            socket.emit('accept-screen-share', {
                screenShareId: this.screenShareId,
                answer: answer
            });

        } catch (error) {
            console.error('Error accepting screen share:', error);
            alert('Ошибка при принятии трансляции экрана');
        }
    }

    rejectScreenShare() {
        socket.emit('reject-screen-share', {
            screenShareId: this.screenShareId
        });
        this.hideIncomingScreenShareWindow();
        this.screenShareId = null;
    }

    async stopScreenShare() {
        if (this.screenShareConnection) {
            this.screenShareConnection.close();
            this.screenShareConnection = null;
        }

        if (this.screenShareStream) {
            this.screenShareStream.getTracks().forEach(track => track.stop());
            this.screenShareStream = null;
        }

        if (this.screenShareId) {
            socket.emit('end-screen-share', {
                screenShareId: this.screenShareId
            });
        }

        this.hideScreenShareWindow();
        this.hideScreenViewWindow();
        this.screenShareId = null;
        this.isScreenSharing = false;
    }

    closeScreenView() {
        this.hideScreenViewWindow();
    }

    // ========== ОТОБРАЖЕНИЕ ОКОН ТРАНСЛЯЦИИ ==========

    showScreenShareWindow() {
        document.getElementById('screenShareUser').textContent = this.currentChat;
        document.getElementById('screenShareWindow').style.display = 'block';
        this.isScreenSharing = true;
    }

    hideScreenShareWindow() {
        document.getElementById('screenShareWindow').style.display = 'none';
        this.isScreenSharing = false;
    }

    showIncomingScreenShareWindow(from) {
        document.getElementById('incomingScreenShareUser').textContent = from;
        document.getElementById('incomingScreenShareWindow').style.display = 'block';
    }

    hideIncomingScreenShareWindow() {
        document.getElementById('incomingScreenShareWindow').style.display = 'none';
    }

    showScreenViewWindow() {
        document.getElementById('screenViewUser').textContent = this.currentChat;
        document.getElementById('screenViewWindow').style.display = 'block';
    }

    hideScreenViewWindow() {
        const screenViewVideo = document.getElementById('screenViewVideo');
        if (screenViewVideo) {
            screenViewVideo.srcObject = null;
        }
        document.getElementById('screenViewWindow').style.display = 'none';
    }

    toggleScreenFullscreen() {
        const screenViewContainer = document.querySelector('.screen-view-container');
        if (screenViewContainer) {
            if (!document.fullscreenElement) {
                if (screenViewContainer.requestFullscreen) {
                    screenViewContainer.requestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        }
    }

    // ========== ОБРАБОТЧИКИ SOCKET.IO ДЛЯ ТРАНСЛЯЦИИ ==========

    setupSocketListeners() {
        socket.on('private message', (data) => this.handleIncomingMessage(data));
        socket.on('conversations updated', () => this.loadConversations());

        // Обработчики звонков
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

        // Новые обработчики для трансляции экрана
        socket.on('screen-share-offer', (data) => {
            this.screenShareId = data.screenShareId;
            this.incomingScreenShareOffer = data.offer;
            this.showIncomingScreenShareWindow(data.from);
        });

        socket.on('screen-share-accepted', async (data) => {
            await this.screenShareConnection.setRemoteDescription(
                new RTCSessionDescription(data.answer)
            );
        });

        socket.on('screen-share-rejected', (data) => {
            document.getElementById('screenShareStatus').textContent = 'Трансляция отклонена';
            setTimeout(() => this.stopScreenShare(), 2000);
        });

        socket.on('screen-share-ended', (data) => {
            if (this.isScreenSharing) {
                document.getElementById('screenShareStatus').textContent = 'Трансляция завершена';
                setTimeout(() => this.stopScreenShare(), 2000);
            } else {
                this.hideScreenViewWindow();
            }
        });

        socket.on('screen-share-ice-candidate', async (data) => {
            if (this.screenShareConnection) {
                try {
                    await this.screenShareConnection.addIceCandidate(
                        new RTCIceCandidate(data.candidate)
                    );
                } catch (error) {
                    console.error('Error adding screen share ICE candidate:', error);
                }
            }
        });

        socket.on('call-failed', (data) => {
            this.showCallStatus('Ошибка звонка: ' + data.reason);
            setTimeout(() => this.endCall(), 2000);
        });
    }

    // ... остальные существующие методы (scrollToBottom, isAtBottom, loadConversations, etc.) ...

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

const privateChat = new PrivateChat();