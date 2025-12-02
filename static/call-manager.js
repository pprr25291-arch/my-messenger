class CallManager {
    constructor() {
        this.currentCall = null;
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.isInitiator = false;
        this.callStartTime = null;
        this.callTimer = null;
        this.screenStream = null;
        this.isScreenSharing = false;
        this.pendingIceCandidates = [];
        this.outgoingCallStartTime = null;
        this.outgoingCallTimer = null;
        this.currentGroupAudio = null;
        this.cameraStream = null;
        
        console.log('🎯 CallManager constructor called');
        
        this.setupSocketListeners();
        this.setupCallButtons();
    }

    setupCallButtons() {
        console.log('🎯 Setting up call buttons...');
        
        // Используем делегирование событий для динамически создаваемых кнопок
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('video-call-btn')) {
                const targetUser = this.getCurrentChatUser();
                if (targetUser) {
                    this.initiateCall(targetUser, 'video');
                }
            } else if (e.target.classList.contains('audio-call-btn')) {
                const targetUser = this.getCurrentChatUser();
                if (targetUser) {
                    this.initiateCall(targetUser, 'audio');
                }
            }
        });
    }

    getCurrentChatUser() {
        const currentChatUser = document.getElementById('currentChatUser');
        if (currentChatUser && currentChatUser.textContent) {
            return currentChatUser.textContent;
        }
        
        const groupChatContainer = document.getElementById('groupChatContainer');
        if (groupChatContainer && groupChatContainer.style.display !== 'none') {
            const groupName = document.querySelector('#groupChatContainer .user-details h4');
            if (groupName) {
                return groupName.textContent;
            }
        }
        
        this.showNotification('Выберите чат для звонка', 'error');
        return null;
    }

    setupSocketListeners() {
        if (!window.socket) {
            console.log('⚠️ Socket not available for CallManager');
            return;
        }
        
        console.log('🎯 Setting up CallManager socket listeners...');
        
        // Обработчики для звонков
        window.socket.on('incoming_call', (data) => {
            console.log('📞 Incoming call received:', data);
            this.handleIncomingCall(data);
        });

        window.socket.on('call_accepted', (data) => {
            console.log('✅ Call accepted:', data);
            this.handleCallAccepted(data);
        });

        window.socket.on('call_rejected', (data) => {
            console.log('❌ Call rejected:', data);
            this.handleCallRejected(data);
        });

        window.socket.on('call_ended', (data) => {
            console.log('📞 Call ended:', data);
            this.handleCallEnded(data);
        });

        window.socket.on('webrtc_offer', (data) => {
            console.log('📡 WebRTC offer received:', data);
            this.handleOffer(data);
        });

        window.socket.on('webrtc_answer', (data) => {
            console.log('📡 WebRTC answer received:', data);
            this.handleAnswer(data);
        });

        window.socket.on('webrtc_ice_candidate', (data) => {
            console.log('🧊 ICE candidate received:', data);
            this.handleIceCandidate(data);
        });

        // Обработчики для трансляции экрана
        window.socket.on('screen_share_started', (data) => {
            console.log('🖥️ Screen share started by:', data.sharer);
            this.showNotification(`${data.sharer} начал трансляцию экрана`, 'info');
            
            // Обновляем интерфейс если мы в активном звонке
            if (this.currentCall && 
                ((this.isInitiator && this.currentCall.targetUser === data.sharer) ||
                 (!this.isInitiator && this.currentCall.caller === data.sharer))) {
                this.showRemoteScreenShare(data);
            }
        });

        window.socket.on('screen_share_ended', (data) => {
            console.log('🖥️ Screen share ended by:', data.sharer);
            this.showNotification(`${data.sharer} остановил трансляцию экрана`, 'info');
            
            // Обновляем интерфейс если мы в активном звонке
            if (this.currentCall && 
                ((this.isInitiator && this.currentCall.targetUser === data.sharer) ||
                 (!this.isInitiator && this.currentCall.caller === data.sharer))) {
                this.hideRemoteScreenShare(data);
            }
        });

        // Обработчик ошибок
        window.socket.on('error', (data) => {
            console.error('❌ Socket error:', data);
            this.showNotification(data.message || 'Произошла ошибка', 'error');
        });

        console.log('✅ CallManager socket listeners setup completed');
    }

    showRemoteScreenShare(data) {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        // Для видеозвонков показываем индикатор
        if (this.currentCall && this.currentCall.type === 'video') {
            let indicator = modal.querySelector('.remote-screen-share-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'remote-screen-share-indicator';
                indicator.style.cssText = `
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(255, 107, 107, 0.9);
                    color: white;
                    padding: 8px 15px;
                    border-radius: 15px;
                    font-size: 12px;
                    font-weight: bold;
                    z-index: 10;
                `;
                indicator.textContent = `🖥️ ${data.sharer} транслирует экран`;
                modal.querySelector('.call-content').appendChild(indicator);
            }
        }
    }

    hideRemoteScreenShare(data) {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        const indicator = modal.querySelector('.remote-screen-share-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    handleIncomingCall(data) {
        console.log('📞 Incoming call:', data);
        
        if (this.currentCall) {
            console.log('❌ Already in call, rejecting incoming call');
            if (window.socket) {
                window.socket.emit('reject_call', {
                    callId: data.callId,
                    reason: 'User is busy'
                });
            }
            return;
        }

        this.currentCall = {
            id: data.callId,
            caller: data.caller,
            type: data.callType,
            status: 'incoming',
            isInitiator: false
        };

        this.isInitiator = false;
        this.showIncomingCallInterface(data);
    }

    showIncomingCallInterface(data) {
        console.log('🔄 Creating incoming call modal...');
        
        // Удаляем существующее модальное окно если есть
        const existingModal = document.getElementById('incomingCallModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'incomingCallModal';
        modal.className = 'incoming-call-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;

        const callTypeIcon = data.callType === 'video' ? '📹' : '📞';
        const callTypeText = data.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок';

        modal.innerHTML = `
            <div class="incoming-call-container" style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                max-width: 400px;
                width: 90%;
                border: 3px solid #667eea;
            ">
                <div class="call-header" style="margin-bottom: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 22px;">${callTypeIcon} Входящий звонок</h3>
                    <div style="font-size: 16px; color: #6c757d;">${data.caller} вызывает вас</div>
                </div>
                
                <div class="caller-info" style="
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 15px;
                    color: white;
                ">
                    <div class="caller-avatar" style="
                        font-size: 48px;
                        width: 80px;
                        height: 80px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    ">👤</div>
                    <div class="caller-details" style="text-align: left; flex: 1;">
                        <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">${data.caller}</div>
                        <div style="font-size: 14px; opacity: 0.9;">${callTypeText}</div>
                    </div>
                </div>
                
                <div class="call-buttons" style="display: flex; gap: 15px; justify-content: center;">
                    <button class="accept-call-btn" style="
                        padding: 15px 30px;
                        border: none;
                        border-radius: 50px;
                        cursor: pointer;
                        font-weight: bold;
                        transition: all 0.3s ease;
                        font-size: 16px;
                        min-width: 120px;
                        flex: 1;
                        background: linear-gradient(45deg, #28a745, #20c997);
                        color: white;
                        box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
                    ">📞 Принять</button>
                    <button class="reject-call-btn" style="
                        padding: 15px 30px;
                        border: none;
                        border-radius: 50px;
                        cursor: pointer;
                        font-weight: bold;
                        transition: all 0.3s ease;
                        font-size: 16px;
                        min-width: 120px;
                        flex: 1;
                        background: linear-gradient(45deg, #dc3545, #c82333);
                        color: white;
                        box-shadow: 0 4px 15px rgba(220, 53, 69, 0.4);
                    ">❌ Отклонить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        console.log('✅ Incoming call modal created');

        // Добавляем обработчики событий
        const acceptBtn = modal.querySelector('.accept-call-btn');
        const rejectBtn = modal.querySelector('.reject-call-btn');

        acceptBtn.addEventListener('click', (e) => {
            console.log('✅ Accept call button clicked');
            e.stopPropagation();
            this.acceptCall();
        });

        rejectBtn.addEventListener('click', (e) => {
            console.log('❌ Reject call button clicked');
            e.stopPropagation();
            this.rejectCall();
        });

        // Закрытие по клику на фон
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('🔄 Modal background clicked, rejecting call');
                this.rejectCall();
            }
        });

        // Добавляем анимацию появления
        setTimeout(() => {
            const container = modal.querySelector('.incoming-call-container');
            if (container) {
                container.style.transform = 'scale(1)';
                container.style.opacity = '1';
            }
        }, 10);
    }

    acceptCall() {
        console.log('🎯 Accepting call...');
        
        if (!this.currentCall) {
            console.error('❌ No current call to accept');
            return;
        }

        try {
            const constraints = {
                video: this.currentCall.type === 'video' ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                } : false,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000
                }
            };

            console.log('🎯 Requesting media permissions for accepting call...');
            
            navigator.mediaDevices.getUserMedia(constraints)
                .then(stream => {
                    console.log('✅ Media stream obtained for accepting call');
                    
                    // Проверяем аудио треки
                    const audioTracks = stream.getAudioTracks();
                    console.log('🎵 Audio tracks for accepting:', audioTracks.length);
                    audioTracks.forEach(track => {
                        console.log('🎵 Audio track settings (accepting):', track.getSettings());
                        console.log('🎵 Audio track enabled (accepting):', track.enabled);
                    });

                    this.localStream = stream;
                    this.currentCall.status = 'active';
                    
                    if (window.socket) {
                        console.log('🎯 Sending call acceptance via socket...');
                        window.socket.emit('accept_call', {
                            callId: this.currentCall.id,
                            caller: this.currentCall.caller,
                            acceptor: document.getElementById('username')?.textContent || 'user'
                        });
                    }

                    const incomingModal = document.getElementById('incomingCallModal');
                    if (incomingModal) {
                        console.log('✅ Removing incoming call modal');
                        incomingModal.remove();
                    }

                    console.log('🎯 Showing active call interface...');
                    this.showActiveCallInterface();
                    this.createPeerConnection();
                })
                .catch(error => {
                    console.error('❌ Error accessing media devices:', error);
                    this.showNotification('Ошибка доступа к камере/микрофону', 'error');
                    
                    const incomingModal = document.getElementById('incomingCallModal');
                    if (incomingModal) {
                        incomingModal.remove();
                    }
                    
                    this.endCall();
                });

        } catch (error) {
            console.error('❌ Error accepting call:', error);
            this.showNotification('Ошибка принятия звонка', 'error');
            
            const incomingModal = document.getElementById('incomingCallModal');
            if (incomingModal) {
                incomingModal.remove();
            }
            
            this.endCall();
        }
    }

    rejectCall() {
        console.log('🎯 Rejecting call...');
        
        if (!this.currentCall) {
            console.error('❌ No current call to reject');
            return;
        }

        if (window.socket) {
            console.log('🎯 Sending call rejection via socket...');
            window.socket.emit('reject_call', {
                callId: this.currentCall.id,
                caller: this.currentCall.caller,
                reason: 'Call rejected by user'
            });
        }

        this.cleanupCall();
        
        // Закрываем модальное окно
        const incomingModal = document.getElementById('incomingCallModal');
        if (incomingModal) {
            console.log('✅ Removing incoming call modal');
            incomingModal.remove();
        }
        
        this.showNotification('Звонок отклонен', 'info');
    }

    async startScreenShare() {
        try {
            console.log('🖥️ Starting screen share...');

            // Останавливаем текущую трансляцию если есть
            if (this.isScreenSharing) {
                await this.stopScreenShare();
                return;
            }

            // Сохраняем текущий поток камеры перед началом трансляции
            this.cameraStream = this.localStream;
            
            // Показываем уведомление о начале процесса
            this.showNotification('Запрашиваем разрешение на трансляцию экрана...', 'info');

            // Получаем поток экрана с улучшенной обработкой ошибок
            let screenStream;
            try {
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: 'always',
                        displaySurface: 'window',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30 }
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100
                    }
                });
            } catch (error) {
                console.error('❌ Screen share permission denied:', error);
                
                // Специфичная обработка разных типов ошибок
                if (error.name === 'NotAllowedError') {
                    this.showNotification(
                        'Разрешение на трансляцию экрана отклонено. ' +
                        'Чтобы поделиться экраном, нажмите "Разрешить" в диалоговом окне браузера.', 
                        'error'
                    );
                } else if (error.name === 'NotFoundError' || error.name === 'NotSupportedError') {
                    this.showNotification(
                        'Ваш браузер не поддерживает трансляцию экрана или не найдены доступные источники.', 
                        'error'
                    );
                } else if (error.name === 'AbortError') {
                    this.showNotification('Процесс выбора экрана был прерван.', 'warning');
                } else {
                    this.showNotification('Ошибка трансляции экрана: ' + error.message, 'error');
                }
                
                this.isScreenSharing = false;
                this.screenStream = null;
                this.cameraStream = null;
                return;
            }

            // Проверяем, был ли выбран источник (пользователь мог закрыть диалог без выбора)
            if (!screenStream || screenStream.getTracks().length === 0) {
                console.log('🖥️ User canceled screen share selection');
                this.showNotification('Выбор экрана отменен', 'info');
                this.isScreenSharing = false;
                this.screenStream = null;
                this.cameraStream = null;
                return;
            }

            console.log('🖥️ Screen stream obtained:', screenStream.getTracks());

            // Обработчик остановки трансляции пользователем
            const videoTrack = screenStream.getVideoTracks()[0];
            videoTrack.onended = () => {
                console.log('🖥️ Screen share ended by user');
                this.stopScreenShare();
            };

            // Обработчик ошибок трека
            videoTrack.onerror = (error) => {
                console.error('🖥️ Screen track error:', error);
                this.showNotification('Ошибка трансляции экрана', 'error');
                this.stopScreenShare();
            };

            this.screenStream = screenStream;
            this.isScreenSharing = true;

            // Обновляем peer connection для трансляции
            await this.setupScreenShareStream(screenStream);

            // Обновляем интерфейс для отображения трансляции
            this.updateCallInterfaceForScreenShare(screenStream);

            // Уведомляем собеседника о начале трансляции
            if (window.socket) {
                window.socket.emit('screen_share_started', {
                    callId: this.currentCall.id,
                    sharer: document.getElementById('username')?.textContent,
                    targetUser: this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller
                });
            }

            this.showNotification('Трансляция экрана начата', 'success');
            console.log('✅ Screen share started successfully');

        } catch (error) {
            console.error('❌ Error starting screen share:', error);
            
            // Общая обработка непредвиденных ошибок
            this.showNotification('Не удалось начать трансляцию экрана: ' + error.message, 'error');
            this.isScreenSharing = false;
            this.screenStream = null;
            this.cameraStream = null;
            
            // Восстанавливаем обычный интерфейс
            this.updateCallInterface();
        }
    }

    async setupScreenShareStream(screenStream) {
        if (!this.peerConnection) {
            console.error('❌ No peer connection for screen share');
            return;
        }

        try {
            // Получаем все senders
            const senders = this.peerConnection.getSenders();
            
            // Ищем video sender
            const videoSender = senders.find(sender => 
                sender.track && sender.track.kind === 'video'
            );

            if (videoSender) {
                console.log('🔄 Replacing video track with screen share');
                const screenVideoTrack = screenStream.getVideoTracks()[0];
                
                if (screenVideoTrack) {
                    await videoSender.replaceTrack(screenVideoTrack);
                    console.log('✅ Video track replaced with screen share');
                    
                    // Отправляем событие переnegoitation
                    if (this.isInitiator) {
                        await this.createOffer();
                    }
                }
            } else {
                // Если нет video sender, добавляем новый трек
                console.log('🔄 Adding new screen share track');
                screenStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, screenStream);
                });
                
                if (this.isInitiator) {
                    await this.createOffer();
                }
            }

        } catch (error) {
            console.error('❌ Error setting up screen share stream:', error);
            throw error;
        }
    }

    updateCallInterfaceForScreenShare(screenStream) {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        const isVideoCall = this.currentCall.type === 'video';
        
        if (isVideoCall) {
            this.setupVideoCallWithScreenShare(screenStream);
        } else {
            this.setupAudioCallWithScreenShare(screenStream);
        }
        
        // Обновляем кнопки управления
        this.updateControlButtons();
    }

    updateControlButtons() {
        const controlsContainer = document.querySelector('.call-controls');
        if (!controlsContainer) return;

        controlsContainer.innerHTML = ''; // Очищаем старые кнопки

        const buttons = [
            {
                class: 'mute-btn call-control',
                icon: '🎤',
                title: 'Выключить микрофон',
                onClick: () => this.toggleMute()
            },
            {
                class: 'video-btn call-control',
                icon: '📹', 
                title: 'Выключить камеру',
                onClick: () => this.toggleVideo(),
                show: this.currentCall.type === 'video' && !this.isScreenSharing
            },
            {
                class: `screen-share-btn call-control ${this.isScreenSharing ? 'sharing' : ''}`,
                icon: '🖥️',
                title: this.isScreenSharing ? 'Остановить трансляцию' : 'Начать трансляцию экрана',
                onClick: () => this.toggleScreenShare()
            },
            {
                class: 'end-call-btn call-control',
                icon: '📞',
                title: 'Завершить звонок',
                onClick: () => this.endCall()
            }
        ];

        buttons.forEach(button => {
            if (button.show === false) return;
            
            const btn = document.createElement('button');
            btn.className = button.class;
            btn.innerHTML = button.icon;
            btn.title = button.title;
            btn.onclick = button.onClick;
            
            controlsContainer.appendChild(btn);
        });

        // Добавляем кнопку полноэкранного режима
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'fullscreen-btn call-control';
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.title = 'Полный экран';
        fullscreenBtn.onclick = () => this.toggleFullscreen();
        controlsContainer.appendChild(fullscreenBtn);
    }

    setupVideoCallWithScreenShare(screenStream) {
        const callContent = document.querySelector('.call-content');
        if (!callContent) return;

        // Создаем контейнер для трансляции
        callContent.innerHTML = `
            <div class="video-call-with-screen-share">
                <div class="remote-video-container">
                    <video id="remoteVideo" autoplay playsinline></video>
                    <div class="remote-screen-share-badge">🖥️ Трансляция экрана</div>
                </div>
                <div class="local-video-container screen-share-active">
                    <video id="localScreenShare" autoplay playsinline muted></video>
                    <div class="screen-share-badge">🖥️ Ваш экран</div>
                </div>
            </div>
        `;

        // Устанавливаем поток трансляции
        const localScreenShare = document.getElementById('localScreenShare');
        if (localScreenShare) {
            localScreenShare.srcObject = screenStream;
            localScreenShare.play().catch(e => console.error('Screen share video play error:', e));
        }

        // Обновляем удаленное видео если есть
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
            remoteVideo.play().catch(e => console.error('Remote video play error:', e));
        }
    }

    setupAudioCallWithScreenShare(screenStream) {
        const callContent = document.querySelector('.call-content');
        if (!callContent) return;

        callContent.innerHTML = `
            <div class="audio-call-with-screen-share">
                <div class="audio-user-section">
                    <div class="audio-icon">🖥️</div>
                    <div class="audio-user-name">${this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller}</div>
                    <div class="audio-call-status">Идет трансляция вашего экрана</div>
                    <audio id="remoteAudio" autoplay style="display: none;"></audio>
                </div>
                <div class="screen-share-section">
                    <video id="localScreenShare" autoplay playsinline muted class="screen-share-video"></video>
                    <div class="screen-share-badge">🖥️ Ваш экран</div>
                </div>
            </div>
        `;

        // Устанавливаем поток трансляции
        const localScreenShare = document.getElementById('localScreenShare');
        if (localScreenShare) {
            localScreenShare.srcObject = screenStream;
            localScreenShare.play().catch(e => console.error('Screen share video play error:', e));
        }

        // Устанавливаем аудио
        const remoteAudio = document.getElementById('remoteAudio');
        if (remoteAudio && this.remoteStream) {
            remoteAudio.srcObject = this.remoteStream;
        }
    }

    async stopScreenShare() {
        if (!this.isScreenSharing) return;

        try {
            console.log('🖥️ Stopping screen share...');

            // Восстанавливаем камеру если она была
            if (this.cameraStream) {
                const videoTrack = this.cameraStream.getVideoTracks()[0];
                const senders = this.peerConnection.getSenders();
                
                if (videoTrack) {
                    const videoSender = senders.find(s => 
                        s.track && s.track.kind === 'video'
                    );
                    
                    if (videoSender) {
                        console.log('🔄 Restoring camera video track');
                        await videoSender.replaceTrack(videoTrack);
                        console.log('✅ Camera video track restored');
                    }
                }

                // Восстанавливаем локальное видео с камеры
                const localVideo = document.getElementById('localVideo');
                if (localVideo && this.cameraStream) {
                    localVideo.srcObject = this.cameraStream;
                    localVideo.play().catch(e => console.error('Local camera video play error:', e));
                    console.log('✅ Local video restored to camera');
                }
            } else {
                console.log('⚠️ No camera stream to restore');
            }

            // Останавливаем screen stream
            if (this.screenStream) {
                this.safeStopMediaTracks(this.screenStream);
                this.screenStream = null;
            }

            this.isScreenSharing = false;
            this.cameraStream = null;

            // Уведомляем собеседника об остановке трансляции
            if (window.socket) {
                window.socket.emit('screen_share_ended', {
                    callId: this.currentCall.id,
                    sharer: document.getElementById('username')?.textContent,
                    targetUser: this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller
                });
            }

            // Обновляем интерфейс
            this.updateCallInterface();

            this.showNotification('Трансляция экрана остановлена', 'info');
            console.log('✅ Screen share stopped successfully');

        } catch (error) {
            console.error('❌ Error stopping screen share:', error);
            this.showNotification('Ошибка остановки трансляции', 'error');
            
            // Принудительно сбрасываем состояние
            this.isScreenSharing = false;
            this.screenStream = null;
            this.cameraStream = null;
            this.updateCallInterface();
        }
    }

    toggleScreenShare() {
        try {
            // Проверяем поддержку браузера
            if (!this.checkScreenShareSupport()) {
                return;
            }

            if (!this.isScreenSharing) {
                this.startScreenShare();
            } else {
                this.stopScreenShare();
            }
        } catch (error) {
            console.error('❌ Error toggling screen share:', error);
            this.showNotification('Ошибка управления трансляцией экрана: ' + error.message, 'error');
        }
    }

    checkScreenShareSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            this.showNotification(
                'Трансляция экрана не поддерживается вашим браузером. ' +
                'Пожалуйста, используйте современный браузер (Chrome, Firefox, Edge).', 
                'error'
            );
            return false;
        }
        return true;
    }

    async initiateCall(targetUser, callType = 'video') {
        console.log('🎯 Initiate call started to:', targetUser, 'Type:', callType);
        
        if (this.currentCall) {
            this.showNotification('Уже есть активный звонок', 'error');
            return;
        }

        if (!targetUser) {
            this.showNotification('Выберите пользователя для звонка', 'error');
            return;
        }

        try {
            console.log('🎯 Requesting media permissions...');
            const constraints = {
                video: callType === 'video' ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                } : false,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000
                }
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Media stream obtained');
            
            // Проверяем аудио треки
            const audioTracks = this.localStream.getAudioTracks();
            console.log('🎵 Audio tracks:', audioTracks.length);
            audioTracks.forEach(track => {
                console.log('🎵 Audio track settings:', track.getSettings());
                console.log('🎵 Audio track enabled:', track.enabled);
            });

            // Проверяем видео треки
            const videoTracks = this.localStream.getVideoTracks();
            console.log('🎥 Video tracks:', videoTracks.length);
            
            const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            this.currentCall = {
                id: callId,
                targetUser: targetUser,
                type: callType,
                status: 'calling',
                isInitiator: true
            };

            this.isInitiator = true;
            console.log('🎯 Showing outgoing call interface...');
            this.showOutgoingCallInterface();

            if (window.socket) {
                console.log('🎯 Sending call request via socket...');
                window.socket.emit('initiate_call', {
                    callId: callId,
                    targetUser: targetUser,
                    caller: document.getElementById('username')?.textContent || 'user',
                    callType: callType,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.error('❌ Socket not connected');
                throw new Error('Socket not connected');
            }

        } catch (error) {
            console.error('❌ Error initiating call:', error);
            this.showNotification('Ошибка доступа к камере/микрофону: ' + error.message, 'error');
            this.cleanupCall();
        }
    }

    showOutgoingCallInterface() {
        console.log('🔄 Creating outgoing call modal...');
        
        const existingModal = document.getElementById('outgoingCallModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'outgoingCallModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;

        const callTypeIcon = this.currentCall.type === 'video' ? '📹' : '📞';
        const callTypeText = this.currentCall.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок';

        modal.innerHTML = `
            <div class="outgoing-call-window" style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                max-width: 400px;
                width: 90%;
            ">
                <div class="caller-info" style="margin-bottom: 25px;">
                    <div class="caller-avatar" style="
                        font-size: 60px;
                        margin-bottom: 15px;
                    ">👤</div>
                    <div class="caller-details">
                        <h4 style="margin: 0 0 10px 0; font-size: 24px;">${this.currentCall.targetUser}</h4>
                        <p style="margin: 0 0 5px 0; color: #666; font-size: 16px;">${callTypeText}</p>
                        <div class="call-status" style="color: #17a2b8; font-weight: bold; margin-bottom: 20px;">Звонок...</div>
                        <div class="call-timer" id="outgoingCallTimer" style="font-size: 18px; color: #667eea; font-weight: bold; font-family: 'Courier New', monospace;">00:00</div>
                    </div>
                </div>
                <div class="call-dialog-buttons">
                    <button class="cancel-call-btn" style="
                        padding: 15px 25px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        width: 100%;
                        transition: all 0.3s ease;
                    ">📞 Сбросить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        console.log('✅ Outgoing call modal created');

        // Запускаем таймер для исходящего звонка
        this.startOutgoingCallTimer();

        const cancelCallBtn = modal.querySelector('.cancel-call-btn');
        cancelCallBtn.addEventListener('click', () => {
            console.log('🎯 Cancel call button clicked');
            this.endCall();
        });
    }

    startOutgoingCallTimer() {
        this.outgoingCallStartTime = Date.now();
        this.outgoingCallTimer = setInterval(() => {
            const elapsed = Date.now() - this.outgoingCallStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            const timerElement = document.getElementById('outgoingCallTimer');
            if (timerElement) {
                timerElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    stopOutgoingCallTimer() {
        if (this.outgoingCallTimer) {
            clearInterval(this.outgoingCallTimer);
            this.outgoingCallTimer = null;
        }
    }

 async createPeerConnection() {
    if (!this.currentCall) return;

    try {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };

        this.peerConnection = new RTCPeerConnection(configuration);
        this.pendingIceCandidates = [];

        // Улучшенные обработчики состояния
        this.peerConnection.onconnectionstatechange = () => {
            console.log('🔗 Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                console.log('✅ Peer connection established successfully');
            } else if (this.peerConnection.connectionState === 'failed') {
                console.error('❌ Peer connection failed');
                this.showNotification('Ошибка соединения', 'error');
                this.endCall();
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
            if (this.peerConnection.iceConnectionState === 'failed') {
                console.error('❌ ICE connection failed');
                this.showNotification('Ошибка сетевого соединения', 'error');
            }
        };

        this.peerConnection.onsignalingstatechange = () => {
            console.log('📡 Signaling state:', this.peerConnection.signalingState);
        };

        // Обработчик входящих потоков
        this.peerConnection.ontrack = (event) => {
            console.log('📹 Remote track received:', event.track.kind, event.track.label);
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                
                // Для аудио
                if (event.track.kind === 'audio') {
                    console.log('🎵 Remote audio track received');
                    const remoteAudio = document.getElementById('remoteAudio');
                    if (remoteAudio) {
                        remoteAudio.srcObject = this.remoteStream;
                        remoteAudio.play().catch(e => console.error('Audio play error:', e));
                    }
                }
                
                // Для видео
                if (event.track.kind === 'video') {
                    console.log('🎥 Remote video track received');
                    const remoteVideo = document.getElementById('remoteVideo');
                    if (remoteVideo) {
                        remoteVideo.srcObject = this.remoteStream;
                        remoteVideo.play().catch(e => console.error('Video play error:', e));
                    }
                }
            }
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && window.socket) {
                console.log('📤 Sending ICE candidate');
                window.socket.emit('webrtc_ice_candidate', {
                    callId: this.currentCall.id,
                    candidate: event.candidate,
                    targetUser: this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller
                });
            } else if (!event.candidate) {
                console.log('✅ All ICE candidates sent');
            }
        };

        // Добавляем локальные треки
        if (this.localStream) {
            console.log('🎯 Adding local tracks to peer connection');
            this.localStream.getTracks().forEach(track => {
                console.log('🎯 Adding local track:', track.kind, track.label);
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        if (this.isInitiator) {
            await this.createOffer();
        }

    } catch (error) {
        console.error('❌ Error creating peer connection:', error);
        this.showNotification('Ошибка соединения', 'error');
        this.endCall();
    }
}

    async createOffer() {
        if (!this.peerConnection) return;

        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            if (window.socket) {
                window.socket.emit('webrtc_offer', {
                    callId: this.currentCall.id,
                    offer: offer,
                    targetUser: this.currentCall.targetUser
                });
            }
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    async handleOffer(data) {
        if (!this.peerConnection || !this.currentCall) return;

        try {
            console.log('✅ Setting remote description from offer');
            await this.peerConnection.setRemoteDescription(data.offer);
            
            // Добавляем отложенные ICE кандидаты
            if (this.pendingIceCandidates && this.pendingIceCandidates.length > 0) {
                console.log(`🔄 Adding ${this.pendingIceCandidates.length} pending ICE candidates`);
                for (const candidate of this.pendingIceCandidates) {
                    try {
                        await this.peerConnection.addIceCandidate(candidate);
                    } catch (candidateError) {
                        console.warn('⚠️ Failed to add pending ICE candidate:', candidateError);
                    }
                }
                this.pendingIceCandidates = [];
            }
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            if (window.socket) {
                console.log('📤 Sending answer');
                window.socket.emit('webrtc_answer', {
                    callId: this.currentCall.id,
                    answer: answer,
                    targetUser: data.targetUser || data.caller
                });
            }
        } catch (error) {
            console.error('❌ Error handling offer:', error);
        }
    }

   async handleAnswer(data) {
    if (!this.peerConnection) {
        console.error('❌ No peer connection for answer');
        return;
    }

    try {
        console.log('✅ Setting remote description from answer');
        await this.peerConnection.setRemoteDescription(data.answer);
        
        // Добавляем отложенные ICE кандидаты после установки remote description
        if (this.pendingIceCandidates && this.pendingIceCandidates.length > 0) {
            console.log(`🔄 Adding ${this.pendingIceCandidates.length} pending ICE candidates`);
            for (const candidate of this.pendingIceCandidates) {
                try {
                    await this.peerConnection.addIceCandidate(candidate);
                } catch (candidateError) {
                    console.warn('⚠️ Failed to add pending ICE candidate:', candidateError);
                }
            }
            this.pendingIceCandidates = [];
        }
        
    } catch (error) {
        console.error('❌ Error handling answer:', error);
    }
}

 async handleIceCandidate(data) {
    try {
        if (!this.peerConnection) {
            console.log('⚠️ No peer connection yet, caching ICE candidate');
            if (!this.pendingIceCandidates) {
                this.pendingIceCandidates = [];
            }
            this.pendingIceCandidates.push(data.candidate);
            return;
        }

        // Проверяем, установлено ли удаленное описание
        if (this.peerConnection.remoteDescription) {
            console.log('✅ Adding ICE candidate:', data.candidate);
            await this.peerConnection.addIceCandidate(data.candidate);
        } else {
            console.log('⚠️ Remote description not set yet, caching ICE candidate');
            if (!this.pendingIceCandidates) {
                this.pendingIceCandidates = [];
            }
            this.pendingIceCandidates.push(data.candidate);
        }
        
    } catch (error) {
        console.error('❌ Error handling ICE candidate:', error);
    }
}

    handleCallAccepted(data) {
        console.log('✅ Call accepted:', data);
        
        if (this.currentCall && this.currentCall.id === data.callId) {
            this.currentCall.status = 'active';
            
            const outgoingModal = document.getElementById('outgoingCallModal');
            if (outgoingModal) {
                outgoingModal.remove();
            }
            
            this.showActiveCallInterface();
            this.createPeerConnection();
        }
    }

    handleCallRejected(data) {
        console.log('❌ Call rejected:', data);
        
        this.cleanupCall();
        
        const outgoingModal = document.getElementById('outgoingCallModal');
        if (outgoingModal) {
            outgoingModal.remove();
        }
        
        this.showNotification('Звонок отклонен', 'error');
    }

    handleCallEnded(data) {
        console.log('📞 Call ended:', data);
        
        this.cleanupCall();
        
        const activeModal = document.getElementById('activeCallModal');
        const outgoingModal = document.getElementById('outgoingCallModal');
        const incomingModal = document.getElementById('incomingCallModal');
        
        if (activeModal) activeModal.remove();
        if (outgoingModal) outgoingModal.remove();
        if (incomingModal) incomingModal.remove();
        
        this.showNotification('Звонок завершен', 'info');
    }

    showActiveCallInterface() {
        const modal = document.createElement('div');
        modal.id = 'activeCallModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            z-index: 10001;
        `;

        const isVideoCall = this.currentCall.type === 'video';
        const remoteUser = this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller;

        modal.innerHTML = `
            <div class="call-header" style="padding: 20px; background: rgba(0,0,0,0.7); color: white; display: flex; justify-content: space-between; align-items: center;">
                <div class="call-info">
                    <h3 style="margin: 0;">${isVideoCall ? '📹' : '📞'} ${remoteUser}</h3>
                    <div class="call-timer" id="callTimer">00:00</div>
                </div>
                <div class="call-header-controls">
                    <button class="minimize-call-btn" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; margin-right: 10px;" title="Свернуть">➖</button>
                    <button class="fullscreen-call-btn" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-right: 10px;" title="Полный экран">⛶</button>
                </div>
            </div>
            
            <div class="call-content" style="flex: 1; position: relative;">
                ${this.getCallContentHTML(isVideoCall, remoteUser)}
            </div>
            
            <div class="call-controls" style="
                padding: 20px;
                background: rgba(0,0,0,0.7);
                display: flex;
                justify-content: center;
                gap: 15px;
            ">
                <!-- Кнопки будут добавлены через updateControlButtons -->
            </div>
        `;

        document.body.appendChild(modal);

        // Инициализируем кнопки управления
        this.updateControlButtons();

        this.startCallTimer();
        this.setupCallMedia();
        this.setupCallModalHandlers();
    }

    setupCallMedia() {
        console.log('🎯 Setting up call media...');
        
        const isVideoCall = this.currentCall.type === 'video';
        
        // Устанавливаем локальное видео для видеозвонков
        if (isVideoCall) {
            const localVideo = document.getElementById('localVideo');
            if (localVideo && this.localStream) {
                localVideo.srcObject = this.localStream;
                localVideo.play().catch(e => console.error('Local video play error:', e));
                console.log('✅ Local video set up');
            }
        }

        // Устанавливаем локальный аудио
        const localAudio = document.getElementById('localAudio');
        if (localAudio && this.localStream) {
            localAudio.srcObject = this.localStream;
            console.log('✅ Local audio set up');
        }

        // Устанавливаем удаленное аудио
        const remoteAudio = document.getElementById('remoteAudio');
        if (remoteAudio && this.remoteStream) {
            remoteAudio.srcObject = this.remoteStream;
            remoteAudio.play().catch(e => console.error('Remote audio play error:', e));
            console.log('✅ Remote audio set up');
        }

        // Устанавливаем удаленное видео
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
            remoteVideo.play().catch(e => console.error('Remote video play error:', e));
            console.log('✅ Remote video set up');
        }
    }

    getCallContentHTML(isVideoCall, remoteUser) {
        if (this.isScreenSharing) {
            if (isVideoCall) {
                return `
                    <div class="video-call-with-screen-share">
                        <div class="remote-video-container">
                            <video id="remoteVideo" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                            <div class="remote-screen-share-badge">🖥️ Трансляция экрана</div>
                        </div>
                        <div class="local-video-container screen-share-active">
                            <video id="localScreenShare" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
                            <div class="screen-share-badge">🖥️ Ваш экран</div>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="audio-call-with-screen-share">
                        <div class="audio-user-section">
                            <div class="audio-icon">🖥️</div>
                            <div class="audio-user-name">${remoteUser}</div>
                            <div class="audio-call-status">Идет трансляция вашего экрана</div>
                            <audio id="remoteAudio" autoplay style="display: none;"></audio>
                        </div>
                        <div class="screen-share-section">
                            <video id="localScreenShare" autoplay playsinline muted class="screen-share-video"></video>
                            <div class="screen-share-badge">🖥️ Ваш экран</div>
                        </div>
                    </div>
                `;
            }
        } else {
            if (isVideoCall) {
                return `
                    <video id="remoteVideo" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                    <video id="localVideo" autoplay playsinline muted style="
                        position: absolute;
                        bottom: 20px;
                        right: 20px;
                        width: 200px;
                        height: 150px;
                        border: 2px solid white;
                        border-radius: 10px;
                        object-fit: cover;
                    "></video>
                `;
            } else {
                return `
                    <div class="audio-call-container" style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                        height: 100%;
                        color: white;
                    ">
                        <div class="audio-icon" style="font-size: 80px; margin-bottom: 20px;">
                            📞
                        </div>
                        <div class="audio-user-name" style="font-size: 24px; margin-bottom: 10px;">${remoteUser}</div>
                        <div class="audio-call-status" style="font-size: 16px; opacity: 0.8;">
                            Идет разговор...
                        </div>
                        <audio id="remoteAudio" autoplay style="display: none;"></audio>
                    </div>
                `;
            }
        }
    }

    setupCallModalHandlers() {
        const modal = document.getElementById('activeCallModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('mute-btn')) {
                    this.toggleMute();
                } else if (e.target.classList.contains('video-btn')) {
                    this.toggleVideo();
                } else if (e.target.classList.contains('screen-share-btn')) {
                    this.toggleScreenShare();
                } else if (e.target.classList.contains('end-call-btn')) {
                    this.endCall();
                } else if (e.target.classList.contains('minimize-call-btn')) {
                    this.minimizeCall();
                } else if (e.target.classList.contains('fullscreen-call-btn')) {
                    this.toggleFullscreen();
                }
            });
        }
    }

    toggleFullscreen() {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        if (!document.fullscreenElement) {
            if (modal.requestFullscreen) {
                modal.requestFullscreen();
            } else if (modal.webkitRequestFullscreen) {
                modal.webkitRequestFullscreen();
            } else if (modal.msRequestFullscreen) {
                modal.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    endCall() {
        if (!this.currentCall) return;

        if (window.socket) {
            window.socket.emit('end_call', {
                callId: this.currentCall.id,
                reason: 'Call ended by user'
            });
        }

        this.cleanupCall();
        
        const activeModal = document.getElementById('activeCallModal');
        const outgoingModal = document.getElementById('outgoingCallModal');
        const incomingModal = document.getElementById('incomingCallModal');
        
        if (activeModal) activeModal.remove();
        if (outgoingModal) outgoingModal.remove();
        if (incomingModal) incomingModal.remove();
        
        this.showNotification('Звонок завершен', 'info');
    }

    minimizeCall() {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        // Создаем минимизированное окно если его нет
        let minimizedWindow = document.getElementById('minimizedCallWindow');
        
        if (!minimizedWindow) {
            minimizedWindow = document.createElement('div');
            minimizedWindow.id = 'minimizedCallWindow';
            minimizedWindow.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 300px;
                height: 120px;
                background: rgba(0, 0, 0, 0.9);
                border: 2px solid #007bff;
                border-radius: 15px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                color: white;
                overflow: hidden;
                cursor: pointer;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            `;

            const remoteUser = this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller;
            const callType = this.currentCall.type === 'video' ? '📹' : '📞';

            minimizedWindow.innerHTML = `
                <div style="padding: 10px; background: rgba(0,123,255,0.3); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: bold; font-size: 14px;">${callType} ${remoteUser}</div>
                    <div style="display: flex; gap: 5px;">
                        <button class="expand-call-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;" title="Развернуть">⛶</button>
                        <button class="end-call-minimized" style="background: none; border: none; color: #dc3545; cursor: pointer; font-size: 16px;" title="Завершить">✕</button>
                    </div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px;">
                    <div style="font-size: 24px; margin-bottom: 5px;">${callType}</div>
                    <div class="minimized-timer" style="font-size: 16px; font-family: 'Courier New', monospace;">${document.getElementById('callTimer')?.textContent || '00:00'}</div>
                    <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">Нажмите для разворачивания</div>
                </div>
            `;

            document.body.appendChild(minimizedWindow);

            // Обработчики для минимизированного окна
            minimizedWindow.addEventListener('click', (e) => {
                if (!e.target.classList.contains('end-call-minimized') && 
                    !e.target.classList.contains('expand-call-btn')) {
                    this.expandCall();
                }
            });

            const expandBtn = minimizedWindow.querySelector('.expand-call-btn');
            const endBtn = minimizedWindow.querySelector('.end-call-minimized');

            if (expandBtn) {
                expandBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.expandCall();
                });
            }

            if (endBtn) {
                endBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.endCall();
                });
            }
        }

        // Скрываем основное окно
        modal.style.display = 'none';
        
        // Обновляем таймер в минимизированном окне
        this.updateMinimizedTimer();
    }

    expandCall() {
        const modal = document.getElementById('activeCallModal');
        const minimizedWindow = document.getElementById('minimizedCallWindow');
        
        if (modal) {
            modal.style.display = 'flex';
        }
        
        if (minimizedWindow) {
            minimizedWindow.remove();
        }
    }

    updateMinimizedTimer() {
        const minimizedTimer = document.querySelector('.minimized-timer');
        if (minimizedTimer) {
            const mainTimer = document.getElementById('callTimer');
            if (mainTimer) {
                minimizedTimer.textContent = mainTimer.textContent;
            }
        }
    }

    toggleMute() {
        if (!this.localStream) return;

        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const isMuted = !audioTracks[0].enabled;
            audioTracks[0].enabled = isMuted;
            
            const muteBtn = document.querySelector('.mute-btn');
            if (muteBtn) {
                muteBtn.textContent = isMuted ? '🎤' : '🔇';
                muteBtn.style.background = isMuted ? '#6c757d' : '#dc3545';
            }
            
            this.showNotification(isMuted ? 'Микрофон включен' : 'Микрофон выключен', 'info');
        }
    }

    toggleVideo() {
        if (!this.localStream) return;

        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            const isVideoOn = !videoTracks[0].enabled;
            videoTracks[0].enabled = isVideoOn;
            
            const videoBtn = document.querySelector('.video-btn');
            if (videoBtn) {
                videoBtn.textContent = isVideoOn ? '📹' : '📷';
                videoBtn.style.background = isVideoOn ? '#6c757d' : '#dc3545';
            }
            
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.style.display = isVideoOn ? 'block' : 'none';
            }
            
            this.showNotification(isVideoOn ? 'Камера включена' : 'Камера выключена', 'info');
        }
    }

    updateCallInterface() {
        const modal = document.getElementById('activeCallModal');
        if (!modal) return;

        const isVideoCall = this.currentCall.type === 'video';
        const remoteUser = this.isInitiator ? this.currentCall.targetUser : this.currentCall.caller;
        
        // Обновляем заголовок
        const callInfo = modal.querySelector('.call-info');
        if (callInfo) {
            const statusElement = callInfo.querySelector('.screen-share-status');
            if (this.isScreenSharing) {
                if (!statusElement) {
                    const statusDiv = document.createElement('div');
                    statusDiv.style.cssText = 'font-size: 14px; color: #ff6b6b; margin-top: 5px;';
                    statusDiv.className = 'screen-share-status';
                    statusDiv.textContent = '🖥️ Вы транслируете экран';
                    callInfo.appendChild(statusDiv);
                }
            } else if (statusElement) {
                statusElement.remove();
            }
        }

        // Обновляем иконку и статус для аудиозвонков
        if (!isVideoCall) {
            const audioIcon = modal.querySelector('.audio-icon');
            const audioStatus = modal.querySelector('.audio-call-status');
            
            if (audioIcon) {
                audioIcon.textContent = this.isScreenSharing ? '🖥️' : '📞';
            }
            
            if (audioStatus) {
                audioStatus.textContent = this.isScreenSharing ? '🖥️ Идет трансляция экрана...' : 'Идет разговор...';
            }
        }

        // Обновляем кнопку трансляции
        const screenShareBtn = modal.querySelector('.screen-share-btn');
        if (screenShareBtn) {
            if (this.isScreenSharing) {
                screenShareBtn.style.background = '#ff6b6b';
                screenShareBtn.innerHTML = '🖥️';
                screenShareBtn.title = 'Остановить трансляцию';
                screenShareBtn.classList.add('sharing');
            } else {
                screenShareBtn.style.background = '#6f42c1';
                screenShareBtn.innerHTML = '🖥️';
                screenShareBtn.title = 'Начать трансляцию экрана';
                screenShareBtn.classList.remove('sharing');
            }
        }

        console.log('✅ Call interface updated, screen sharing:', this.isScreenSharing);
    }

    startCallTimer() {
        this.callStartTime = Date.now();
        this.callTimer = setInterval(() => {
            const elapsed = Date.now() - this.callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            const timerElement = document.getElementById('callTimer');
            if (timerElement) {
                timerElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            
            // Обновляем таймер в минимизированном окне
            this.updateMinimizedTimer();
            
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }

    cleanupCall() {
        console.log('🧹 Cleaning up call resources');
        
        this.stopCallTimer();
        this.stopOutgoingCallTimer();

        // Останавливаем трансляцию экрана если активна
        if (this.isScreenSharing) {
            this.stopScreenShare();
        }

        // Останавливаем все медиа-потоки с обработкой ошибок
        this.safeStopMediaTracks(this.localStream);
        this.safeStopMediaTracks(this.remoteStream);
        this.safeStopMediaTracks(this.screenStream);
        this.safeStopMediaTracks(this.cameraStream);

        this.localStream = null;
        this.remoteStream = null;
        this.screenStream = null;
        this.cameraStream = null;

        if (this.peerConnection) {
            try {
                this.peerConnection.close();
            } catch (error) {
                console.warn('⚠️ Error closing peer connection:', error);
            }
            this.peerConnection = null;
        }

        this.pendingIceCandidates = [];
        this.isScreenSharing = false;

        // Удаляем модальные окна
        const modals = [
            'incomingCallModal',
            'outgoingCallModal', 
            'activeCallModal'
        ];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.remove();
            }
        });

        this.currentCall = null;
        this.isInitiator = false;
    }

    // Добавляем метод для безопасной остановки устройств
    safeStopMediaTracks(stream) {
        if (!stream) return;
        
        stream.getTracks().forEach(track => {
            try {
                if (track.readyState === 'live') {
                    track.stop();
                }
            } catch (error) {
                console.warn('Error stopping track:', error);
            }
        });
    }
openUserProfile(username) {
    if (!username || username === this.currentUser) return;
    
    console.log('👤 Opening profile for:', username);
    
    // Создаем модальное окно профиля
    const modal = document.createElement('div');
    modal.id = 'userProfileModal';
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
            width: 400px;
            max-width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                <h3 style="margin: 0;">👤 Профиль пользователя</h3>
                <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
            </div>
            
            <div class="profile-content">
                <div class="profile-header" style="text-align: center; margin-bottom: 20px;">
                    <div class="profile-avatar" style="width: 100px; height: 100px; border-radius: 50%; overflow: hidden; margin: 0 auto 15px; border: 3px solid #007bff;">
                        <img id="profileAvatarImg" src="/default-avatar.png" alt="${username}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <h4 style="margin: 0 0 5px 0; color: #333;">${username}</h4>
                    <div class="user-status" id="profileUserStatus" style="color: #6c757d;">Загрузка...</div>
                </div>
                
                <div class="profile-actions" style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <button class="btn-primary" onclick="window.privateChatInstance.startChat('${username}')" style="flex: 1; padding: 10px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        💬 Написать сообщение
                    </button>
                    <button class="btn-secondary" onclick="window.privateChatInstance.openGiftForUser('${username}')" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        🎁 Отправить подарок
                    </button>
                </div>
                
                <div class="profile-info">
                    <div class="info-section" style="margin-bottom: 15px;">
                        <h5 style="margin-bottom: 10px; color: #495057;">📊 Статистика</h5>
                        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div class="stat-item" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 12px; color: #6c757d;">В сети</div>
                                <div id="profileOnlineStatus" style="font-weight: bold; color: #28a745;">Проверка...</div>
                            </div>
                            <div class="stat-item" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 12px; color: #6c757d;">Баланс</div>
                                <div id="profileBalance" style="font-weight: bold;">🪙 ...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Загружаем данные профиля
    this.loadProfileData(username);

    // Обработчики закрытия
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Метод для загрузки данных профиля
async loadProfileData(username) {
    try {
        const response = await fetch(`/api/user/${username}`);
        if (response.ok) {
            const userData = await response.json();
            
            // Обновляем аватар
            const avatarImg = document.getElementById('profileAvatarImg');
            if (avatarImg && userData.avatar) {
                avatarImg.src = userData.avatar;
            }
            
            // Обновляем статус онлайн
            const onlineStatus = document.getElementById('profileOnlineStatus');
            const userStatus = document.getElementById('profileUserStatus');
            if (onlineStatus && userStatus) {
                const isOnline = this.onlineUsers.has(username);
                onlineStatus.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
                onlineStatus.style.color = isOnline ? '#28a745' : '#dc3545';
                userStatus.textContent = isOnline ? 'В сети' : 'Не в сети';
            }
            
            // Загружаем баланс
            await this.loadUserBalance(username);
            
        } else {
            throw new Error('User not found');
        }
    } catch (error) {
        console.error('Error loading profile data:', error);
        this.showNotification('Ошибка загрузки профиля', 'error');
    }
}

// Метод для загрузки баланса пользователя
async loadUserBalance(username) {
    try {
        const response = await fetch(`/api/user/${username}/currency`);
        if (response.ok) {
            const currencyData = await response.json();
            const balanceElement = document.getElementById('profileBalance');
            if (balanceElement) {
                balanceElement.textContent = `🪙 ${currencyData.balance || 0}`;
            }
        }
    } catch (error) {
        console.log('Balance not available for user:', username);
        const balanceElement = document.getElementById('profileBalance');
        if (balanceElement) {
            balanceElement.textContent = '🪙 0';
        }
    }
}

// Метод для открытия отправки подарка пользователю
openGiftForUser(username) {
    if (!window.currencyManager) {
        this.showNotification('Система подарков недоступна', 'error');
        return;
    }
    
    // Закрываем профиль
    const profileModal = document.getElementById('userProfileModal');
    if (profileModal) {
        profileModal.remove();
    }
    
    // Открываем магазин подарков с выбранным пользователем
    window.currencyManager.openGiftShop(username);
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
}
window.CallManager = CallManager;