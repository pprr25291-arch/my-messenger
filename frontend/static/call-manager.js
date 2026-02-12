// Файл: call-manager.js (ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ ДЛЯ ПРОДАКШЕНА)
// Полный переработанный CallManager с поддержкой HTTPS, TURN серверов и улучшенным ICE кандидатами

class CallManager {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.currentCall = null;
        this.isCaller = false;
        this.isInCall = false;
        this.callType = null;
        this.screenStream = null;
        this.isScreenSharing = false;
        this.isMuted = false;
        this.isCameraOff = false;
        this.callTimeout = null;
        this.callTimer = null;
        this.callStartTime = null;
        
        // Улучшенная конфигурация ICE для продакшена
        this.iceServers = [
            {
                urls: [
                    'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                    'stun:stun2.l.google.com:19302',
                    'stun:stun3.l.google.com:19302',
                    'stun:stun4.l.google.com:19302',
                    'stun:stun.ekiga.net:3478',
                    'stun:stun.voipbuster.com:3478',
                    'stun:stun.voipstunt.com:3478'
                ]
            }
        ];

        // Добавляем бесплатные TURN серверы для обхода NAT (критически важно для продакшена)
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            this.iceServers.push(
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            );
        }

        // Для демонстрации экрана
        this.originalVideoTrack = null;
        this.originalAudioTrack = null;
        this.screenShareActive = false;
        
        // Для переподключения
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
        
        // Для управления состоянием
        this.isCallModalMinimized = false;
        this.isNotificationShown = false;
        
        // Статистика соединения
        this.connectionStats = {
            bytesReceived: 0,
            bytesSent: 0,
            packetsLost: 0,
            roundTripTime: 0
        };
        
        this.setupEventListeners();
        this.createCallUI();
        
        console.log('✅ CallManager initialized for', window.location.hostname);
    }

    createCallUI() {
        const existingModal = document.getElementById('callModal');
        if (existingModal) {
            existingModal.remove();
        }

        const callModal = document.createElement('div');
        callModal.id = 'callModal';
        callModal.className = 'modal-overlay';
        callModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.95);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10010;
            color: #ffffff;
            user-select: none;
        `;

        callModal.innerHTML = `
            <div class="call-container" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #1a1a1a;">
                <!-- Шапка звонка -->
                <div class="call-header" style="padding: 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); background: #2d2d2d; position: relative;">
                    <div class="call-info" id="callInfo">
                        <h3 style="margin: 0; color: #ffffff;" id="callTitle">📞 Звонок...</h3>
                        <div id="callTimer" style="font-size: 14px; opacity: 0.8; color: #cccccc;">00:00</div>
                        <div id="connectionStatus" style="font-size: 12px; margin-top: 5px; color: #28a745;"></div>
                        <div id="iceConnectionType" style="font-size: 11px; margin-top: 3px; color: #6c757d;"></div>
                    </div>
                    <div class="call-header-buttons" style="position: absolute; top: 20px; right: 20px; display: flex; gap: 10px;">
                        <button class="minimize-call-btn" style="background: rgba(255,255,255,0.1); border: none; color: #ffffff; font-size: 20px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">➖</button>
                        <button class="close-call-btn" style="background: rgba(255,255,255,0.1); border: none; color: #ffffff; font-size: 20px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✕</button>
                    </div>
                </div>
                
                <!-- Основное содержимое -->
                <div class="call-content" id="callContent" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
                    <!-- Участники звонка -->
                    <div class="call-participants" style="display: flex; gap: 20px; width: 100%; max-width: 1200px; margin-bottom: 30px;">
                        <!-- Локальное видео/аудио -->
                        <div class="local-participant" style="flex: 1; position: relative;">
                            <div class="participant-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; color: #ffffff;">
                                <span style="font-weight: bold; color: #ffffff;">Вы</span>
                                <div class="status-indicators" style="display: flex; gap: 5px;">
                                    <span class="mute-indicator" id="muteIndicator" style="display: none; color: #dc3545;">🔇</span>
                                    <span class="camera-indicator" id="cameraIndicator" style="display: none; color: #dc3545;">📷❌</span>
                                    <span class="screen-indicator" id="screenIndicator" style="display: none; color: #28a745;">🖥️</span>
                                </div>
                            </div>
                            <div class="video-container" style="position: relative; background: #333333; border-radius: 10px; overflow: hidden; aspect-ratio: 16/9; border: 2px solid rgba(255,255,255,0.1);">
                                <video id="localVideo" autoplay muted playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                                <div class="video-placeholder" id="localVideoPlaceholder" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #ffffff;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 48px; margin-bottom: 10px; color: #666666;">🎥</div>
                                        <div style="color: #cccccc;">Ваша камера</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Удаленное видео/аудио -->
                        <div class="remote-participant" style="flex: 1; position: relative;">
                            <div class="participant-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; color: #ffffff;">
                                <span style="font-weight: bold; color: #ffffff;" id="remoteUserName">Собеседник</span>
                                <div class="remote-status" id="remoteStatus" style="font-size: 12px; opacity: 0.8; color: #cccccc;">подключение...</div>
                            </div>
                            <div class="video-container" style="position: relative; background: #333333; border-radius: 10px; overflow: hidden; aspect-ratio: 16/9; border: 2px solid rgba(255,255,255,0.1);">
                                <video id="remoteVideo" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                                <div class="video-placeholder" id="remoteVideoPlaceholder" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #ffffff;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 48px; margin-bottom: 10px; color: #666666;">👤</div>
                                        <div id="remotePlaceholderText" style="color: #cccccc;">Ожидание собеседника</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Состояние звонка -->
                    <div class="call-status" id="callStatus" style="text-align: center; margin-bottom: 30px; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 10px; max-width: 600px; border: 1px solid rgba(255,255,255,0.1);">
                        <div id="statusMessage" style="color: #ffffff;">Установка соединения...</div>
                        <div id="iceStatus" style="font-size: 12px; opacity: 0.7; margin-top: 5px; color: #cccccc;"></div>
                        <div id="connectionQuality" style="font-size: 11px; margin-top: 3px; color: #28a745;"></div>
                    </div>
                </div>
                
                <!-- Панель управления звонком -->
                <div class="call-controls" id="callControls" style="padding: 30px; border-top: 1px solid rgba(255,255,255,0.1); background: #2d2d2d; display: flex; justify-content: center; gap: 20px;">
                    <!-- Кнопки для принимающего -->
                    <div class="incoming-controls" id="incomingControls" style="display: none;">
                        <button class="call-btn accept-btn" style="padding: 15px 30px; background: linear-gradient(45deg, #28a745, #20c997); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 16px; display: flex; align-items: center; gap: 10px; font-weight: bold;">
                            <span>✅</span> Принять
                        </button>
                        <button class="call-btn reject-btn" style="padding: 15px 30px; background: linear-gradient(45deg, #dc3545, #c82333); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 16px; display: flex; align-items: center; gap: 10px; font-weight: bold;">
                            <span>❌</span> Отклонить
                        </button>
                    </div>
                    
                    <!-- Кнопки для звонящего (ожидание) -->
                    <div class="calling-controls" id="callingControls" style="display: none; text-align: center; padding: 20px;">
                        <div style="color: #ffffff;">
                            <div style="font-size: 48px; margin-bottom: 10px;">📞</div>
                            <div style="color: #ffffff;">Ожидание ответа...</div>
                            <button class="call-btn cancel-call-btn" style="margin-top: 20px; padding: 12px 24px; background: linear-gradient(45deg, #dc3545, #c82333); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">
                                ❌ Отменить звонок
                            </button>
                        </div>
                    </div>
                    
                    <!-- Основные кнопки управления во время звонка -->
                    <div class="active-call-controls" id="activeCallControls" style="display: none;">
                        <button class="control-btn mute-btn" id="muteBtn" style="width: 70px; height: 70px; border-radius: 50%; background: linear-gradient(45deg, #4a4a4a, #2d2d2d); border: 2px solid rgba(255,255,255,0.2); color: white; cursor: pointer; font-size: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                            🎤
                        </button>
                        <button class="control-btn camera-btn" id="cameraBtn" style="width: 70px; height: 70px; border-radius: 50%; background: linear-gradient(45deg, #4a4a4a, #2d2d2d); border: 2px solid rgba(255,255,255,0.2); color: white; cursor: pointer; font-size: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                            📹
                        </button>
                        <button class="control-btn screen-share-btn" id="screenShareBtn" style="width: 70px; height: 70px; border-radius: 50%; background: linear-gradient(45deg, #4a4a4a, #2d2d2d); border: 2px solid rgba(255,255,255,0.2); color: white; cursor: pointer; font-size: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                            🖥️
                        </button>
                        <button class="control-btn end-call-btn" id="endCallBtn" style="width: 70px; height: 70px; border-radius: 50%; background: linear-gradient(45deg, #dc3545, #c82333); border: 2px solid rgba(255,255,255,0.2); color: white; cursor: pointer; font-size: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                            📞
                        </button>
                    </div>
                    
                    <!-- Кнопки переподключения -->
                    <div class="reconnect-controls" id="reconnectControls" style="display: none; text-align: center; padding: 20px;">
                        <div style="color: #ffffff;">
                            <div style="font-size: 32px; margin-bottom: 10px;">⚠️</div>
                            <div style="color: #ffffff; margin-bottom: 10px;">Соединение прервано</div>
                            <button class="call-btn reconnect-btn" style="padding: 15px 30px; background: linear-gradient(45deg, #007bff, #0056b3); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 16px; font-weight: bold; display: flex; align-items: center; gap: 10px; margin: 0 auto;">
                                🔄 Переподключиться
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(callModal);
        this.setupCallModalEvents();
    }

    setupEventListeners() {
        if (!window.socket) {
            console.error('❌ Socket not available, retrying in 1s...');
            setTimeout(() => this.setupEventListeners(), 1000);
            return;
        }

        // Очищаем старые обработчики
        window.socket.off('incoming_call');
        window.socket.off('call_accepted');
        window.socket.off('call_rejected');
        window.socket.off('call_ended');
        window.socket.off('webrtc_offer');
        window.socket.off('webrtc_answer');
        window.socket.off('webrtc_ice_candidate');
        window.socket.off('screen_share_started');
        window.socket.off('screen_share_ended');

        // Устанавливаем новые обработчики
        window.socket.on('incoming_call', (data) => {
            this.handleIncomingCall(data);
        });

        window.socket.on('call_accepted', (data) => {
            this.handleCallAccepted(data);
        });

        window.socket.on('call_rejected', (data) => {
            this.handleCallRejected(data);
        });

        window.socket.on('call_ended', (data) => {
            this.handleCallEnded(data);
        });

        window.socket.on('webrtc_offer', (data) => {
            this.handleWebRTCOffer(data);
        });

        window.socket.on('webrtc_answer', (data) => {
            this.handleWebRTCAnswer(data);
        });

        window.socket.on('webrtc_ice_candidate', (data) => {
            this.handleWebRTCIceCandidate(data);
        });

        window.socket.on('screen_share_started', (data) => {
            this.handleRemoteScreenShareStarted(data);
        });

        window.socket.on('screen_share_ended', (data) => {
            this.handleRemoteScreenShareEnded(data);
        });

        console.log('✅ CallManager event listeners setup complete');
    }

    setupCallModalEvents() {
        const modal = document.getElementById('callModal');
        if (!modal) return;

        // Удаляем старые обработчики
        const oldMinimizeBtn = modal.querySelector('.minimize-call-btn');
        const oldCloseBtn = modal.querySelector('.close-call-btn');
        const oldAcceptBtn = modal.querySelector('.accept-btn');
        const oldRejectBtn = modal.querySelector('.reject-btn');
        const oldCancelBtn = modal.querySelector('.cancel-call-btn');
        
        if (oldMinimizeBtn) oldMinimizeBtn.replaceWith(oldMinimizeBtn.cloneNode(true));
        if (oldCloseBtn) oldCloseBtn.replaceWith(oldCloseBtn.cloneNode(true));
        if (oldAcceptBtn) oldAcceptBtn.replaceWith(oldAcceptBtn.cloneNode(true));
        if (oldRejectBtn) oldRejectBtn.replaceWith(oldRejectBtn.cloneNode(true));
        if (oldCancelBtn) oldCancelBtn.replaceWith(oldCancelBtn.cloneNode(true));

        // Устанавливаем новые обработчики
        modal.querySelector('.minimize-call-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMinimize();
        });

        modal.querySelector('.close-call-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.endCall();
        });

        modal.querySelector('.accept-btn')?.addEventListener('click', () => {
            this.acceptCall();
        });

        modal.querySelector('.reject-btn')?.addEventListener('click', () => {
            this.rejectCall();
        });

        modal.querySelector('.cancel-call-btn')?.addEventListener('click', () => {
            this.cancelCall();
        });

        // Кнопки управления во время звонка
        const muteBtn = modal.querySelector('#muteBtn');
        const cameraBtn = modal.querySelector('#cameraBtn');
        const screenShareBtn = modal.querySelector('#screenShareBtn');
        const endCallBtn = modal.querySelector('#endCallBtn');
        const reconnectBtn = modal.querySelector('.reconnect-btn');

        if (muteBtn) {
            muteBtn.addEventListener('click', () => this.toggleMute());
        }

        if (cameraBtn) {
            cameraBtn.addEventListener('click', () => this.toggleCamera());
        }

        if (screenShareBtn) {
            screenShareBtn.addEventListener('click', () => this.toggleScreenShare());
        }

        if (endCallBtn) {
            endCallBtn.addEventListener('click', () => this.endCall());
        }

        if (reconnectBtn) {
            reconnectBtn.addEventListener('click', () => this.reconnectCall());
        }
    }

    async initiateCall(targetUser, callType = 'video') {
        try {
            console.log(`📞 Initiating ${callType} call to ${targetUser} on ${window.location.hostname}`);
            
            if (!targetUser) {
                throw new Error('Target user is required');
            }

            // Проверяем поддержку WebRTC
            if (!this.checkWebRTCSupport()) {
                this.showNotification('Ваш браузер не поддерживает WebRTC', 'error');
                return;
            }

            // Проверяем наличие устройств
            const deviceCheck = await this.checkDevices(callType);
            
            if (!deviceCheck.canProceed) {
                this.showNotification(deviceCheck.warning || 'Невозможно совершить звонок', 'error');
                return;
            }

            if (deviceCheck.warning) {
                this.showNotification(deviceCheck.warning, 'warning');
                if (callType === 'video' && !deviceCheck.hasVideo && deviceCheck.hasAudio) {
                    callType = 'audio';
                    this.showNotification('Переключено на аудиозвонок', 'info');
                }
            }
            
            this.isNotificationShown = false;
            
            this.currentCall = {
                callId: 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                targetUser: targetUser,
                caller: window.USERNAME || document.getElementById('username')?.textContent || 'Unknown',
                type: callType,
                status: 'initiating'
            };
            
            this.isCaller = true;
            this.callType = callType;
            
            this.showCallModal();
            this.showCallingControls();
            this.updateCallInfo(`Звонок пользователю ${targetUser}...`);
            
            // Получаем локальный поток с принудительным аудио
            await this.getLocalStream();
            
            // Отправляем запрос на звонок
            if (window.socket) {
                window.socket.emit('initiate_call', {
                    callId: this.currentCall.callId,
                    caller: this.currentCall.caller,
                    targetUser: targetUser,
                    callType: callType
                });
                
                console.log(`📤 Call request sent to ${targetUser}`);
            } else {
                throw new Error('Socket connection not available');
            }
            
            // Увеличиваем таймаут для продакшена
            const timeoutTime = window.location.hostname === 'localhost' ? 30000 : 45000;
            
            this.callTimeout = setTimeout(() => {
                if (this.isInCall === false && this.currentCall?.status === 'initiating') {
                    this.showNotification(`${targetUser} не отвечает`, 'error');
                    this.endCall('Пользователь не отвечает');
                }
            }, timeoutTime);
            
        } catch (error) {
            console.error('❌ Error initiating call:', error);
            this.showNotification('Ошибка инициализации звонка: ' + error.message, 'error');
            this.endCall();
        }
    }

    checkWebRTCSupport() {
        const checks = {
            RTCPeerConnection: !!window.RTCPeerConnection,
            getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            RTCSessionDescription: !!window.RTCSessionDescription,
            RTCIceCandidate: !!window.RTCIceCandidate
        };
        
        console.log('🔧 WebRTC support check:', checks);
        
        return Object.values(checks).every(Boolean);
    }

    async getLocalStream() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Ваш браузер не поддерживает аудио/видео звонки');
            }

            // Проверяем наличие устройств
            let hasAudio = false;
            let hasVideo = false;
            
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                hasAudio = devices.some(device => device.kind === 'audioinput');
                hasVideo = devices.some(device => device.kind === 'videoinput');
                
                console.log('📱 Available devices:', {
                    audio: hasAudio,
                    video: hasVideo,
                    count: devices.length
                });
            } catch (devError) {
                console.warn('⚠️ Could not enumerate devices:', devError);
            }

            // Настройки для продакшена
            const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
            
            // Всегда запрашиваем аудио, даже если устройств нет
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    sampleSize: 16,
                    channelCount: 1
                },
                video: (this.callType === 'video' && hasVideo) ? {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 30 },
                    facingMode: 'user'
                } : false
            };

            // Для продакшена используем более мягкие constraints
            if (isProduction) {
                if (constraints.video) {
                    constraints.video.width = { ideal: 640, max: 1280 };
                    constraints.video.height = { ideal: 480, max: 720 };
                    constraints.video.frameRate = { ideal: 20, max: 30 };
                }
            }

            console.log('📋 Media constraints:', constraints);

            if (!hasAudio) {
                this.showNotification('Микрофон не найден. Вы не сможете говорить, но будете слышать собеседника.', 'warning');
            }

            if (this.callType === 'video' && !hasVideo) {
                this.showNotification('Камера не найдена. Звонок будет только аудио.', 'warning');
                this.callType = 'audio';
            }

            try {
                // Пробуем получить поток с заданными constraints
                this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('✅ Local stream obtained:', {
                    audio: this.localStream.getAudioTracks().length,
                    video: this.localStream.getVideoTracks().length
                });
                
                // Настраиваем аудио трек
                const audioTrack = this.localStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = true;
                    
                    // Дополнительные настройки для продакшена
                    if (isProduction && audioTrack.applyConstraints) {
                        try {
                            await audioTrack.applyConstraints({
                                echoCancellation: true,
                                noiseSuppression: true,
                                autoGainControl: true
                            });
                        } catch (e) {
                            console.warn('Could not apply audio constraints:', e);
                        }
                    }
                }
                
                this.showLocalVideo();
                return this.localStream;
                
            } catch (mediaError) {
                console.error('❌ Error getting media:', mediaError);
                
                let errorMessage = 'Не удалось получить доступ к камере/микрофону';
                
                if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
                    errorMessage = 'Камера или микрофон не найдены.';
                } else if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError') {
                    errorMessage = 'Устройство занято другим приложением.';
                } else if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
                    errorMessage = 'Доступ к камере/микрофону запрещен.';
                } else if (mediaError.name === 'OverconstrainedError') {
                    errorMessage = 'Запрошенные настройки не поддерживаются.';
                }
                
                this.showNotification(errorMessage, 'error');
                
                // Пробуем получить только аудио
                if (this.callType === 'video') {
                    this.showNotification('Пробуем аудиозвонок...', 'info');
                    this.callType = 'audio';
                    return this.getLocalStream();
                }
                
                // Создаем тихий аудиопоток как запасной вариант
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const destination = audioContext.createMediaStreamDestination();
                    
                    // Добавляем тихий источник
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 0.0001; // Почти тишина
                    oscillator.connect(gainNode);
                    gainNode.connect(destination);
                    oscillator.start();
                    
                    this.localStream = destination.stream;
                    this.showLocalVideoPlaceholder();
                    console.log('✅ Created silent audio stream as fallback');
                    return this.localStream;
                } catch (fallbackError) {
                    console.error('❌ Could not create fallback stream:', fallbackError);
                    throw mediaError;
                }
            }
            
        } catch (error) {
            console.error('❌ Fatal error in getLocalStream:', error);
            this.showNotification('Критическая ошибка доступа к медиа', 'error');
            throw error;
        }
    }

    async checkDevices(callType) {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                return { 
                    success: false, 
                    error: 'Ваш браузер не поддерживает аудио/видео звонки',
                    hasAudio: false,
                    hasVideo: false,
                    canProceed: false
                };
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasAudio = devices.some(device => device.kind === 'audioinput');
            const hasVideo = devices.some(device => device.kind === 'videoinput');

            let warning = null;
            let canProceed = true;

            if (callType === 'audio' && !hasAudio) {
                warning = 'Микрофон не найден. Вы не сможете говорить.';
                canProceed = true;
            }

            if (callType === 'video') {
                if (!hasVideo && !hasAudio) {
                    warning = 'Камера и микрофон не найдены.';
                    canProceed = false;
                } else if (!hasVideo) {
                    warning = 'Камера не найдена.';
                    canProceed = true;
                } else if (!hasAudio) {
                    warning = 'Микрофон не найден.';
                    canProceed = true;
                }
            }

            return {
                success: true,
                hasAudio,
                hasVideo,
                warning,
                canProceed
            };

        } catch (error) {
            console.error('❌ Error checking devices:', error);
            return {
                success: false,
                error: error.message,
                hasAudio: false,
                hasVideo: false,
                canProceed: false
            };
        }
    }

    showLocalVideo() {
        const localVideo = document.getElementById('localVideo');
        const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
        
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
            localVideo.style.display = 'block';
            
            // Не зеркалируем видео при трансляции экрана
            if (!this.isScreenSharing) {
                localVideo.style.transform = 'scaleX(-1)';
            } else {
                localVideo.style.transform = 'none';
            }
            
            if (localVideoPlaceholder) {
                localVideoPlaceholder.style.display = 'none';
            }
            
            localVideo.play().catch(e => console.warn('Video play failed:', e));
        }
    }

    showLocalVideoPlaceholder() {
        const localVideo = document.getElementById('localVideo');
        const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
        
        if (localVideo) {
            localVideo.srcObject = null;
            localVideo.style.display = 'none';
        }
        
        if (localVideoPlaceholder) {
            localVideoPlaceholder.style.display = 'flex';
            
            const placeholderText = localVideoPlaceholder.querySelector('div div:last-child');
            if (placeholderText) {
                if (this.callType === 'video') {
                    placeholderText.textContent = 'Камера не найдена';
                } else {
                    placeholderText.textContent = 'Аудиозвонок';
                }
            }
        }
    }

    handleIncomingCall(data) {
        console.log('📞 Incoming call received:', data);
        
        if (this.isInCall) {
            this.rejectIncomingCall(data, 'Занят другим звонком');
            return;
        }
        
        if (this.isNotificationShown) {
            console.log('⚠️ Notification already shown, ignoring duplicate call');
            return;
        }
        
        const callModal = document.getElementById('callModal');
        if (callModal && callModal.style.display !== 'none') {
            console.log('⚠️ Call modal already open, ignoring duplicate call');
            return;
        }
        
        this.currentCall = {
            callId: data.callId,
            caller: data.caller,
            targetUser: window.USERNAME || document.getElementById('username')?.textContent || 'User',
            type: data.callType,
            status: 'incoming'
        };
        
        this.isCaller = false;
        this.callType = data.callType;
        this.isNotificationShown = true;
        
        this.showIncomingCallNotification(data);
    }

    showIncomingCallNotification(data) {
        const existingNotification = document.getElementById('incomingCallNotification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const callModal = document.getElementById('callModal');
        if (callModal && callModal.style.display !== 'none') {
            console.log('⚠️ Call modal already open, not showing notification');
            return;
        }
        
        const notification = document.createElement('div');
        notification.id = 'incomingCallNotification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            z-index: 10020;
            min-width: 350px;
            animation: slideIn 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border: 1px solid rgba(255,255,255,0.1);
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                <div style="font-size: 36px; background: rgba(255,255,255,0.2); padding: 10px; border-radius: 50%;">📞</div>
                <div>
                    <div style="font-weight: bold; font-size: 18px; color: #ffffff;">Входящий ${data.callType === 'video' ? 'видео' : 'аудио'} звонок</div>
                    <div style="opacity: 0.9; color: #e6e6e6;">От: ${data.caller}</div>
                </div>
            </div>
            <div style="display: flex; gap: 15px;">
                <button class="accept-incoming-btn" style="flex: 1; padding: 12px; background: linear-gradient(45deg, #28a745, #20c997); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span>✅</span> Принять
                </button>
                <button class="reject-incoming-btn" style="flex: 1; padding: 12px; background: linear-gradient(45deg, #dc3545, #c82333); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span>❌</span> Отклонить
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        notification.querySelector('.accept-incoming-btn').addEventListener('click', () => {
            notification.remove();
            this.isNotificationShown = false;
            this.acceptCall();
        });

        notification.querySelector('.reject-incoming-btn').addEventListener('click', () => {
            notification.remove();
            this.isNotificationShown = false;
            this.rejectCall();
        });

        // Увеличиваем таймаут для продакшена
        const timeoutTime = window.location.hostname === 'localhost' ? 30000 : 45000;
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
                this.isNotificationShown = false;
                this.rejectCall();
            }
        }, timeoutTime);
    }

    async acceptCall() {
        try {
            console.log('✅ Accepting call...');
            
            await this.getLocalStream();
            
            this.showCallModal();
            this.showActiveCallControls();
            this.updateCallInfo(`Разговор с ${this.currentCall.caller}`);
            
            this.currentCall.status = 'active';
            this.isInCall = true;
            
            if (window.socket) {
                window.socket.emit('accept_call', {
                    callId: this.currentCall.callId,
                    caller: this.currentCall.caller,
                    acceptor: this.currentCall.targetUser
                });
                
                console.log('📤 Call acceptance sent');
            }
            
            await this.initiateWebRTC();
            
            this.startCallTimer();
            
        } catch (error) {
            console.error('❌ Error accepting call:', error);
            this.showNotification('Ошибка при принятии звонка', 'error');
            this.endCall();
        }
    }

    rejectCall(reason = 'Отклонен пользователем') {
        console.log('❌ Rejecting call...');
        
        this.isNotificationShown = false;
        
        if (window.socket && this.currentCall) {
            window.socket.emit('reject_call', {
                callId: this.currentCall.callId,
                caller: this.currentCall.caller,
                reason: reason
            });
        }
        
        this.cleanupCall();
        this.showNotification('Звонок отклонен', 'info');
    }

    rejectIncomingCall(data, reason) {
        if (window.socket) {
            window.socket.emit('reject_call', {
                callId: data.callId,
                caller: data.caller,
                reason: reason
            });
        }
    }

    cancelCall() {
        console.log('❌ Cancelling call...');
        
        if (window.socket && this.currentCall) {
            window.socket.emit('reject_call', {
                callId: this.currentCall.callId,
                caller: this.currentCall.caller,
                reason: 'Звонок отменен'
            });
        }
        
        this.cleanupCall();
    }

    async handleCallAccepted(data) {
        console.log('✅ Call accepted by:', data.acceptor);
        
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
            this.callTimeout = null;
        }
        
        this.currentCall.status = 'active';
        this.isInCall = true;
        
        this.showActiveCallControls();
        this.updateCallInfo(`Разговор с ${data.acceptor}`);
        
        await this.initiateWebRTC();
        
        this.startCallTimer();
    }

    handleCallRejected(data) {
        console.log('❌ Call rejected:', data.reason);
        
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
            this.callTimeout = null;
        }
        
        this.showNotification(data.reason, 'error');
        this.cleanupCall();
    }

    handleCallEnded(data) {
        console.log('📞 Call ended:', data.reason);
        
        if (data.endedBy !== this.currentCall?.caller && data.endedBy !== this.currentCall?.targetUser) {
            return;
        }
        
        this.showNotification(`Звонок завершен: ${data.reason}`, 'info');
        this.cleanupCall();
    }

    async endCall(reason = 'Завершен пользователем') {
        console.log('📞 Ending call...');
        
        if (window.socket && this.currentCall) {
            window.socket.emit('end_call', {
                callId: this.currentCall.callId,
                reason: reason,
                endedBy: window.USERNAME || document.getElementById('username')?.textContent
            });
        }
        
        this.cleanupCall();
        this.showNotification('Звонок завершен', 'info');
    }

    async initiateWebRTC() {
        try {
            console.log('🔗 Initializing WebRTC connection...');
            
            if (!this.currentCall) {
                throw new Error('No active call');
            }

            // Закрываем старое соединение если есть
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            const configuration = {
                iceServers: this.iceServers,
                iceCandidatePoolSize: 10,
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require',
                sdpSemantics: 'unified-plan'
            };

            // Дополнительные настройки для продакшена
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                configuration.iceTransportPolicy = 'relay'; // Принудительно используем TURN
                configuration.iceCandidatePoolSize = 20;
            }

            this.peerConnection = new RTCPeerConnection(configuration);
            
            this.setupPeerConnectionEvents();
            
            // Добавляем локальные треки
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    console.log(`➕ Adding local track: ${track.kind}`);
                    this.peerConnection.addTrack(track, this.localStream);
                });
            } else {
                console.warn('⚠️ No local stream available');
            }

            // Создаем и отправляем предложение если мы звонящий
            if (this.isCaller) {
                console.log('📤 Creating offer...');
                
                const offerOptions = {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: this.callType === 'video'
                };

                const offer = await this.peerConnection.createOffer(offerOptions);
                await this.peerConnection.setLocalDescription(offer);
                
                if (window.socket) {
                    window.socket.emit('webrtc_offer', {
                        callId: this.currentCall.callId,
                        targetUser: this.currentCall.targetUser,
                        offer: offer
                    });
                    
                    console.log('📤 WebRTC offer sent');
                }
            }
            
        } catch (error) {
            console.error('❌ WebRTC initialization error:', error);
            this.showNotification('Ошибка установки соединения: ' + error.message, 'error');
            
            // Пробуем переподключиться
            setTimeout(() => {
                if (this.isInCall) {
                    this.reconnectCall();
                }
            }, 2000);
        }
    }

    setupPeerConnectionEvents() {
        if (!this.peerConnection) return;

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && window.socket) {
                // Фильтруем кандидаты для продакшена
                if (window.location.hostname !== 'localhost' && 
                    window.location.hostname !== '127.0.0.1' &&
                    event.candidate.candidate.includes('typ relay')) {
                    console.log('📤 Sending TURN candidate');
                }
                
                window.socket.emit('webrtc_ice_candidate', {
                    callId: this.currentCall.callId,
                    targetUser: this.isCaller ? this.currentCall.targetUser : this.currentCall.caller,
                    candidate: event.candidate
                });
            }
        };

        this.peerConnection.ontrack = (event) => {
            console.log('✅ Remote track received:', event.track.kind);
            this.remoteStream = event.streams[0];
            
            this.showRemoteVideo();
            
            this.updateStatus('Соединение установлено');
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            console.log('ICE connection state:', state);
            
            this.updateICEConnectionType();
            
            switch(state) {
                case 'checking':
                    this.updateStatus('Установка соединения...');
                    this.updateICEStatus('Поиск оптимального маршрута...');
                    break;
                case 'connected':
                case 'completed':
                    this.updateStatus('Соединение установлено ✓');
                    this.updateICEStatus('Соединение активно');
                    this.reconnectAttempts = 0;
                    this.showActiveCallControls();
                    break;
                case 'disconnected':
                    this.updateStatus('Соединение прервано...');
                    this.updateICEStatus('Попытка переподключения...');
                    this.showReconnectControls();
                    
                    // Автоматическая попытка переподключения
                    if (!this.reconnectTimeout) {
                        this.reconnectTimeout = setTimeout(() => {
                            if (this.peerConnection?.iceConnectionState === 'disconnected') {
                                console.log('🔄 Attempting automatic reconnect...');
                                this.reconnectCall();
                            }
                            this.reconnectTimeout = null;
                        }, 3000);
                    }
                    break;
                case 'failed':
                    this.updateStatus('Ошибка соединения');
                    this.updateICEStatus('Не удалось установить соединение');
                    console.error('❌ WebRTC connection failed');
                    this.showReconnectControls();
                    break;
                case 'closed':
                    this.updateStatus('Соединение закрыто');
                    this.updateICEStatus('');
                    break;
            }
        };

        this.peerConnection.onicegatheringstatechange = () => {
            console.log('ICE gathering state:', this.peerConnection.iceGatheringState);
        };

        this.peerConnection.onicecandidateerror = (error) => {
            if (error.errorCode === 701 || error.errorCode === 0) {
                console.debug('ICE candidate error (ignored):', error.errorText);
                return;
            }
            
            console.warn('ICE candidate error:', {
                code: error.errorCode,
                text: error.errorText,
                url: error.url
            });
            
            this.updateICEStatus(`Сетевая ошибка (${error.errorCode})`);
        };
    }

    updateICEConnectionType() {
        const iceConnectionType = document.getElementById('iceConnectionType');
        if (!iceConnectionType) return;
        
        if (!this.peerConnection) return;
        
        try {
            const candidatePairs = this.peerConnection.getStats()
                .then(stats => {
                    stats.forEach(report => {
                        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                            const localCandidate = stats.get(report.localCandidateId);
                            const remoteCandidate = stats.get(report.remoteCandidateId);
                            
                            if (localCandidate && remoteCandidate) {
                                let type = 'unknown';
                                let icon = '🔌';
                                
                                if (localCandidate.candidateType === 'relay' || remoteCandidate.candidateType === 'relay') {
                                    type = 'TURN (релейный)';
                                    icon = '🔄';
                                } else if (localCandidate.candidateType === 'srflx' || remoteCandidate.candidateType === 'srflx') {
                                    type = 'STUN (публичный)';
                                    icon = '🌐';
                                } else {
                                    type = 'Host (локальный)';
                                    icon = '💻';
                                }
                                
                                iceConnectionType.innerHTML = `${icon} ${type}`;
                                iceConnectionType.style.color = '#6c757d';
                            }
                        }
                    });
                })
                .catch(e => console.warn('Could not get connection type:', e));
        } catch (e) {
            console.warn('Error updating connection type:', e);
        }
    }

    showRemoteVideo() {
        const remoteVideo = document.getElementById('remoteVideo');
        const remoteVideoPlaceholder = document.getElementById('remoteVideoPlaceholder');
        const remotePlaceholderText = document.getElementById('remotePlaceholderText');
        
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
            remoteVideo.style.display = 'block';
            
            if (remoteVideoPlaceholder) {
                remoteVideoPlaceholder.style.display = 'none';
            }
            
            remoteVideo.play().catch(e => console.warn('Remote video play failed:', e));
            
            // Обновляем статус
            const remoteStatus = document.getElementById('remoteStatus');
            if (remoteStatus) {
                remoteStatus.textContent = 'онлайн';
                remoteStatus.style.color = '#28a745';
            }
        }
    }

    async handleWebRTCOffer(data) {
        try {
            console.log('📥 Received WebRTC offer');
            
            if (!this.peerConnection) {
                await this.initiateWebRTC();
            }
            
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            if (window.socket) {
                window.socket.emit('webrtc_answer', {
                    callId: this.currentCall.callId,
                    targetUser: data.caller,
                    answer: answer
                });
                
                console.log('📤 WebRTC answer sent');
            }
            
        } catch (error) {
            console.error('❌ Error handling WebRTC offer:', error);
        }
    }

    async handleWebRTCAnswer(data) {
        try {
            console.log('📥 Received WebRTC answer');
            
            if (this.peerConnection) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                console.log('✅ Remote description set');
            }
            
        } catch (error) {
            console.error('❌ Error handling WebRTC answer:', error);
        }
    }

    async handleWebRTCIceCandidate(data) {
        try {
            console.log('📥 Received ICE candidate');
            
            if (this.peerConnection && data.candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('✅ ICE candidate added');
            }
            
        } catch (error) {
            console.error('❌ Error handling ICE candidate:', error);
            
            if (error.name === 'InvalidStateError') {
                console.log('⏳ Connection not ready, retrying...');
                setTimeout(() => this.handleWebRTCIceCandidate(data), 500);
            }
        }
    }

    async reconnectCall() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.showNotification('Не удалось восстановить соединение', 'error');
            this.endCall('Не удалось восстановить соединение');
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        this.updateStatus(`Переподключение... (попытка ${this.reconnectAttempts})`);
        
        try {
            // Закрываем старое соединение
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            // Создаем новое соединение
            await this.initiateWebRTC();
            
        } catch (error) {
            console.error('❌ Reconnect error:', error);
            
            const delay = Math.min(1000 * this.reconnectAttempts, 5000);
            setTimeout(() => this.reconnectCall(), delay);
        }
    }

    // =============== ДЕМОНСТРАЦИЯ ЭКРАНА ===============

    async toggleScreenShare() {
        try {
            if (this.isScreenSharing) {
                await this.stopScreenShare();
            } else {
                await this.startScreenShare();
            }
        } catch (error) {
            console.error('❌ Error toggling screen share:', error);
            
            let errorMessage = 'Ошибка демонстрации экрана';
            if (error.name === 'NotReadableError') {
                errorMessage = 'Не удалось получить доступ к экрану.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage = 'Доступ к демонстрации экрана запрещен.';
            }
            
            this.showNotification(errorMessage, 'error');
        }
    }

    async startScreenShare() {
        try {
            console.log('🖥️ Starting screen share...');
            
            this.updateStatus('Начинаю демонстрацию экрана...');
            
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => track.stop());
                this.screenStream = null;
            }
            
            // Опции для захвата экрана
            const constraints = {
                video: {
                    cursor: "always",
                    displaySurface: "monitor",
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: false // Не захватываем аудио системы
            };

            // Для Firefox нужны другие настройки
            if (navigator.userAgent.includes('Firefox')) {
                constraints.video.mediaSource = 'screen';
            }
            
            this.screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
            
            if (!this.screenStream || !this.screenStream.getVideoTracks().length) {
                throw new Error('Не удалось получить поток экрана');
            }
            
            console.log('✅ Screen stream obtained');
            
            // Сохраняем оригинальные треки
            if (this.localStream) {
                this.originalVideoTrack = this.localStream.getVideoTracks()[0];
                this.originalAudioTrack = this.localStream.getAudioTracks()[0];
            }
            
            // Заменяем видеотрек в PeerConnection
            await this.replaceVideoTrackWithScreen();
            
            // Обновляем локальное видео
            this.updateLocalVideoWithScreen();
            
            this.isScreenSharing = true;
            this.screenShareActive = true;
            
            this.updateScreenShareUI(true);
            
            this.notifyScreenShareStarted();
            
            // Обработчик остановки через UI браузера
            const screenVideoTrack = this.screenStream.getVideoTracks()[0];
            if (screenVideoTrack) {
                screenVideoTrack.onended = () => {
                    console.log('🖥️ Screen share ended by browser UI');
                    this.stopScreenShare();
                };
            }
            
            this.updateStatus('Демонстрация экрана активна');
            console.log('✅ Screen share started successfully');
            
        } catch (error) {
            console.error('❌ Error starting screen share:', error);
            
            if (error.name === 'NotAllowedError') {
                this.showNotification('Доступ к экрану запрещен', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showNotification('Нет доступных источников для демонстрации', 'error');
            } else {
                this.showNotification('Ошибка демонстрации экрана', 'error');
            }
            
            this.isScreenSharing = false;
            this.screenShareActive = false;
        }
    }

    async replaceVideoTrackWithScreen() {
        if (!this.peerConnection || !this.screenStream) {
            console.error('❌ No peer connection or screen stream');
            return false;
        }
        
        try {
            const senders = this.peerConnection.getSenders();
            console.log('📤 Available senders:', senders.length);
            
            const screenVideoTrack = this.screenStream.getVideoTracks()[0];
            
            if (!screenVideoTrack) {
                console.error('❌ No video track in screen stream');
                return false;
            }
            
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            
            if (videoSender) {
                console.log('🔄 Replacing video track...');
                await videoSender.replaceTrack(screenVideoTrack);
                console.log('✅ Video track replaced with screen share');
                return true;
            } else {
                console.log('⚠️ No video sender found, adding new track');
                this.peerConnection.addTrack(screenVideoTrack, this.screenStream);
                return true;
            }
            
        } catch (error) {
            console.error('❌ Error replacing video track:', error);
            return false;
        }
    }

    updateLocalVideoWithScreen() {
        const localVideo = document.getElementById('localVideo');
        const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
        
        if (localVideo && this.screenStream) {
            localVideo.srcObject = this.screenStream;
            localVideo.style.display = 'block';
            localVideo.style.transform = 'none'; // Не зеркалим экран
            
            if (localVideoPlaceholder) {
                localVideoPlaceholder.style.display = 'none';
            }
            
            localVideo.play().catch(e => console.warn('Video play failed:', e));
            
            console.log('✅ Local video updated with screen stream');
        }
    }

    async stopScreenShare() {
        try {
            console.log('🖥️ Stopping screen share...');
            
            if (!this.isScreenSharing) {
                return;
            }
            
            // Останавливаем поток экрана
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => {
                    track.stop();
                    console.log(`⏹️ Stopped screen track: ${track.kind}`);
                });
                this.screenStream = null;
            }
            
            // Восстанавливаем оригинальный видеотрек
            if (this.peerConnection) {
                await this.restoreOriginalVideoTrack();
            }
            
            // Восстанавливаем локальное видео
            this.restoreLocalVideo();
            
            this.isScreenSharing = false;
            this.screenShareActive = false;
            
            this.updateScreenShareUI(false);
            
            this.notifyScreenShareEnded();
            
            this.updateStatus('Демонстрация экрана завершена');
            console.log('✅ Screen share stopped successfully');
            
        } catch (error) {
            console.error('❌ Error stopping screen share:', error);
        }
    }

    async restoreOriginalVideoTrack() {
        if (!this.peerConnection) return;
        
        try {
            const senders = this.peerConnection.getSenders();
            
            if (this.originalVideoTrack && this.originalVideoTrack.readyState === 'live') {
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                
                if (videoSender) {
                    console.log('🔄 Restoring original video track...');
                    await videoSender.replaceTrack(this.originalVideoTrack);
                    console.log('✅ Original video track restored');
                }
            }
            
            // Восстанавливаем аудиотрек если был
            if (this.originalAudioTrack && this.originalAudioTrack.readyState === 'live') {
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                if (audioSender) {
                    await audioSender.replaceTrack(this.originalAudioTrack);
                }
            }
            
        } catch (error) {
            console.error('❌ Error restoring video track:', error);
        }
    }

    restoreLocalVideo() {
        const localVideo = document.getElementById('localVideo');
        const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
        
        if (!localVideo) return;
        
        if (this.localStream && !this.isCameraOff) {
            localVideo.srcObject = this.localStream;
            localVideo.style.display = 'block';
            localVideo.style.transform = 'scaleX(-1)'; // Зеркалим обратно
            
            if (localVideoPlaceholder) {
                localVideoPlaceholder.style.display = 'none';
            }
            
            localVideo.play().catch(e => console.warn('Video play failed:', e));
        } else {
            localVideo.srcObject = null;
            localVideo.style.display = 'none';
            
            if (localVideoPlaceholder) {
                localVideoPlaceholder.style.display = 'flex';
            }
        }
        
        console.log('✅ Local video restored');
    }

    updateScreenShareUI(isActive) {
        const screenIndicator = document.getElementById('screenIndicator');
        const screenShareBtn = document.getElementById('screenShareBtn');
        
        if (screenIndicator) {
            screenIndicator.style.display = isActive ? 'inline' : 'none';
        }
        
        if (screenShareBtn) {
            if (isActive) {
                screenShareBtn.innerHTML = '🖥️⏹️';
                screenShareBtn.style.background = 'linear-gradient(45deg, #dc3545, #c82333)';
                screenShareBtn.title = 'Остановить демонстрацию';
            } else {
                screenShareBtn.innerHTML = '🖥️';
                screenShareBtn.style.background = 'linear-gradient(45deg, #4a4a4a, #2d2d2d)';
                screenShareBtn.title = 'Демонстрация экрана';
            }
        }
    }

    notifyScreenShareStarted() {
        if (!window.socket || !this.currentCall) return;
        
        const targetUser = this.isCaller ? this.currentCall.targetUser : this.currentCall.caller;
        
        window.socket.emit('screen_share_started', {
            callId: this.currentCall.callId,
            sharer: window.USERNAME || document.getElementById('username')?.textContent || 'Пользователь',
            targetUser: targetUser
        });
        
        console.log('📤 Notified about screen share start');
    }

    notifyScreenShareEnded() {
        if (!window.socket || !this.currentCall) return;
        
        const targetUser = this.isCaller ? this.currentCall.targetUser : this.currentCall.caller;
        
        window.socket.emit('screen_share_ended', {
            callId: this.currentCall.callId,
            sharer: window.USERNAME || document.getElementById('username')?.textContent || 'Пользователь',
            targetUser: targetUser
        });
        
        console.log('📤 Notified about screen share stop');
    }

    handleRemoteScreenShareStarted(data) {
        console.log('🖥️ Remote screen share started by:', data.sharer);
        this.updateStatus(`${data.sharer} демонстрирует экран`);
        
        const remoteStatus = document.getElementById('remoteStatus');
        if (remoteStatus) {
            remoteStatus.textContent = 'демонстрация экрана';
            remoteStatus.style.color = '#28a745';
        }
        
        this.showNotification(`${data.sharer} начал демонстрацию экрана`, 'info');
    }

    handleRemoteScreenShareEnded(data) {
        console.log('🖥️ Remote screen share ended by:', data.sharer);
        this.updateStatus(`${data.sharer} завершил демонстрацию экрана`);
        
        const remoteStatus = document.getElementById('remoteStatus');
        if (remoteStatus) {
            remoteStatus.textContent = 'онлайн';
            remoteStatus.style.color = '#cccccc';
        }
        
        this.showNotification(`${data.sharer} завершил демонстрацию экрана`, 'info');
    }

    // =============== УПРАВЛЕНИЕ МИКРОФОНОМ И КАМЕРОЙ ===============

    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                this.isMuted = !this.isMuted;
                audioTrack.enabled = !this.isMuted;
                
                const muteIndicator = document.getElementById('muteIndicator');
                const muteBtn = document.getElementById('muteBtn');
                
                if (this.isMuted) {
                    if (muteIndicator) muteIndicator.style.display = 'inline';
                    if (muteBtn) {
                        muteBtn.innerHTML = '🎤❌';
                        muteBtn.style.background = 'linear-gradient(45deg, #dc3545, #c82333)';
                    }
                    this.updateStatus('Микрофон отключен');
                } else {
                    if (muteIndicator) muteIndicator.style.display = 'none';
                    if (muteBtn) {
                        muteBtn.innerHTML = '🎤';
                        muteBtn.style.background = 'linear-gradient(45deg, #4a4a4a, #2d2d2d)';
                    }
                    this.updateStatus('Микрофон включен');
                }
                
                console.log(`🔇 Microphone ${this.isMuted ? 'muted' : 'unmuted'}`);
            }
        }
    }

    toggleCamera() {
        if (this.localStream && this.callType === 'video') {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack && !this.isScreenSharing) {
                this.isCameraOff = !this.isCameraOff;
                videoTrack.enabled = !this.isCameraOff;
                
                const cameraIndicator = document.getElementById('cameraIndicator');
                const cameraBtn = document.getElementById('cameraBtn');
                const localVideo = document.getElementById('localVideo');
                const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
                
                if (this.isCameraOff) {
                    if (cameraIndicator) cameraIndicator.style.display = 'inline';
                    if (cameraBtn) {
                        cameraBtn.innerHTML = '📹❌';
                        cameraBtn.style.background = 'linear-gradient(45deg, #dc3545, #c82333)';
                    }
                    if (localVideo) localVideo.style.display = 'none';
                    if (localVideoPlaceholder) localVideoPlaceholder.style.display = 'flex';
                    this.updateStatus('Камера отключена');
                } else {
                    if (cameraIndicator) cameraIndicator.style.display = 'none';
                    if (cameraBtn) {
                        cameraBtn.innerHTML = '📹';
                        cameraBtn.style.background = 'linear-gradient(45deg, #4a4a4a, #2d2d2d)';
                    }
                    if (localVideo) localVideo.style.display = 'block';
                    if (localVideoPlaceholder) localVideoPlaceholder.style.display = 'none';
                    this.updateStatus('Камера включена');
                }
                
                console.log(`📷 Camera ${this.isCameraOff ? 'off' : 'on'}`);
            }
        }
    }

    // =============== УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ ===============

    showCallModal() {
        const modal = document.getElementById('callModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.borderRadius = '0';
            modal.style.cursor = '';
            modal.style.resize = '';
            
            this.isCallModalMinimized = false;
            
            const minimizeBtn = modal.querySelector('.minimize-call-btn');
            if (minimizeBtn) {
                minimizeBtn.textContent = '➖';
                minimizeBtn.title = 'Свернуть';
            }
            
            const remoteUserName = document.getElementById('remoteUserName');
            if (remoteUserName && this.currentCall) {
                remoteUserName.textContent = this.isCaller ? 
                    (this.currentCall.targetUser || 'Собеседник') : 
                    (this.currentCall.caller || 'Собеседник');
            }
            
            this.updateControlVisibility();
        }
    }

    hideCallModal() {
        const modal = document.getElementById('callModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    updateControlVisibility() {
        this.hideAllControls();
        
        if (this.isInCall) {
            this.showActiveCallControls();
        } else if (this.currentCall?.status === 'incoming') {
            this.showIncomingControls();
        } else if (this.currentCall?.status === 'calling') {
            this.showCallingControls();
        } else if (this.peerConnection?.iceConnectionState === 'disconnected' || 
                  this.peerConnection?.iceConnectionState === 'failed') {
            this.showReconnectControls();
        }
    }

    showCallingControls() {
        const callingControls = document.getElementById('callingControls');
        const incomingControls = document.getElementById('incomingControls');
        const activeCallControls = document.getElementById('activeCallControls');
        const reconnectControls = document.getElementById('reconnectControls');
        
        if (callingControls) callingControls.style.display = 'block';
        if (incomingControls) incomingControls.style.display = 'none';
        if (activeCallControls) activeCallControls.style.display = 'none';
        if (reconnectControls) reconnectControls.style.display = 'none';
    }

    showIncomingControls() {
        const callingControls = document.getElementById('callingControls');
        const incomingControls = document.getElementById('incomingControls');
        const activeCallControls = document.getElementById('activeCallControls');
        const reconnectControls = document.getElementById('reconnectControls');
        
        if (callingControls) callingControls.style.display = 'none';
        if (incomingControls) incomingControls.style.display = 'flex';
        if (activeCallControls) activeCallControls.style.display = 'none';
        if (reconnectControls) reconnectControls.style.display = 'none';
    }

    showActiveCallControls() {
        const callingControls = document.getElementById('callingControls');
        const incomingControls = document.getElementById('incomingControls');
        const activeCallControls = document.getElementById('activeCallControls');
        const reconnectControls = document.getElementById('reconnectControls');
        
        if (callingControls) callingControls.style.display = 'none';
        if (incomingControls) incomingControls.style.display = 'none';
        if (activeCallControls) activeCallControls.style.display = 'flex';
        if (reconnectControls) reconnectControls.style.display = 'none';
    }

    showReconnectControls() {
        const callingControls = document.getElementById('callingControls');
        const incomingControls = document.getElementById('incomingControls');
        const activeCallControls = document.getElementById('activeCallControls');
        const reconnectControls = document.getElementById('reconnectControls');
        
        if (callingControls) callingControls.style.display = 'none';
        if (incomingControls) incomingControls.style.display = 'none';
        if (activeCallControls) activeCallControls.style.display = 'none';
        if (reconnectControls) reconnectControls.style.display = 'block';
    }

    hideAllControls() {
        const callingControls = document.getElementById('callingControls');
        const incomingControls = document.getElementById('incomingControls');
        const activeCallControls = document.getElementById('activeCallControls');
        const reconnectControls = document.getElementById('reconnectControls');
        
        if (callingControls) callingControls.style.display = 'none';
        if (incomingControls) incomingControls.style.display = 'none';
        if (activeCallControls) activeCallControls.style.display = 'none';
        if (reconnectControls) reconnectControls.style.display = 'none';
    }

    updateCallInfo(text) {
        const callTitle = document.getElementById('callTitle');
        if (callTitle) {
            callTitle.textContent = text;
        }
    }

    updateStatus(text) {
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.textContent = text;
        }
    }

    updateICEStatus(text) {
        const iceStatus = document.getElementById('iceStatus');
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (iceStatus) {
            iceStatus.textContent = text;
        }
        
        if (connectionStatus) {
            connectionStatus.textContent = text;
            
            if (text.includes('активно') || text.includes('установлено')) {
                connectionStatus.style.color = '#28a745';
            } else if (text.includes('ошибка') || text.includes('не удалось')) {
                connectionStatus.style.color = '#dc3545';
            } else if (text.includes('переподключение')) {
                connectionStatus.style.color = '#ffc107';
            } else {
                connectionStatus.style.color = '#6c757d';
            }
        }
    }

    // =============== ТАЙМЕР ЗВОНКА ===============

    startCallTimer() {
        let seconds = 0;
        const timerElement = document.getElementById('callTimer');
        
        if (!timerElement) return;
        
        this.callStartTime = Date.now();
        
        if (this.callTimer) {
            clearInterval(this.callTimer);
        }
        
        this.callTimer = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            
            timerElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        
        this.callStartTime = null;
        
        const timerElement = document.getElementById('callTimer');
        if (timerElement) {
            timerElement.textContent = '00:00';
        }
    }

    // =============== МИНИМИЗАЦИЯ ===============

    toggleMinimize() {
        if (this.isCallModalMinimized) {
            this.restoreCallModal();
        } else {
            this.minimizeCallModal();
        }
    }

    minimizeCallModal() {
        const modal = document.getElementById('callModal');
        const callContent = document.getElementById('callContent');
        const callControls = document.getElementById('callControls');
        
        if (!modal) return;
        
        modal.style.width = '350px';
        modal.style.height = '120px';
        modal.style.minHeight = '120px';
        modal.style.maxHeight = '120px';
        modal.style.top = '20px';
        modal.style.right = '20px';
        modal.style.left = 'auto';
        modal.style.borderRadius = '12px';
        modal.style.overflow = 'hidden';
        modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        modal.style.resize = 'none';
        
        if (callContent) callContent.style.display = 'none';
        if (callControls) callControls.style.display = 'none';
        
        this.updateMinimizedView();
        
        this.isCallModalMinimized = true;
        
        const minimizeBtn = modal.querySelector('.minimize-call-btn');
        if (minimizeBtn) {
            minimizeBtn.textContent = '➕';
            minimizeBtn.title = 'Развернуть';
        }
    }

    restoreCallModal() {
        const modal = document.getElementById('callModal');
        const callContent = document.getElementById('callContent');
        const callControls = document.getElementById('callControls');
        
        if (!modal) return;
        
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.minHeight = '';
        modal.style.maxHeight = '';
        modal.style.top = '0';
        modal.style.right = 'auto';
        modal.style.left = '0';
        modal.style.borderRadius = '0';
        modal.style.overflow = '';
        modal.style.boxShadow = 'none';
        modal.style.cursor = '';
        modal.style.resize = '';
        
        if (callContent) callContent.style.display = 'flex';
        if (callControls) callControls.style.display = 'flex';
        
        this.isCallModalMinimized = false;
        
        const minimizeBtn = modal.querySelector('.minimize-call-btn');
        if (minimizeBtn) {
            minimizeBtn.textContent = '➖';
            minimizeBtn.title = 'Свернуть';
        }
        
        this.updateControlVisibility();
    }

    updateMinimizedView() {
        const modal = document.getElementById('callModal');
        if (!modal || !this.currentCall) return;
        
        let title = '';
        let status = '';
        let icon = '📞';
        
        if (this.currentCall.status === 'incoming') {
            title = `Входящий от ${this.currentCall.caller}`;
            status = 'Ожидание...';
            icon = '📥';
        } else if (this.currentCall.status === 'calling') {
            title = `Звонок ${this.currentCall.targetUser}`;
            status = 'Ожидание...';
            icon = '📤';
        } else if (this.currentCall.status === 'active') {
            title = this.isCaller ? 
                `Разговор с ${this.currentCall.targetUser}` : 
                `Разговор с ${this.currentCall.caller}`;
            
            const timer = document.getElementById('callTimer')?.textContent || '00:00';
            status = `Длительность: ${timer}`;
            icon = '🎙️';
        }
        
        const callHeader = modal.querySelector('.call-header');
        if (callHeader) {
            callHeader.innerHTML = `
                <div class="call-info" id="callInfo" style="width: 100%; padding: 10px; display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 24px; flex-shrink: 0;">${icon}</div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-weight: bold; color: #ffffff; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${title}</div>
                        <div style="font-size: 12px; opacity: 0.8; color: #cccccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${status}</div>
                    </div>
                    <div class="mini-controls" style="display: flex; gap: 5px; flex-shrink: 0;">
                        <button class="mini-end-btn" style="background: rgba(220,53,69,0.8); border: none; color: #ffffff; font-size: 16px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            📞
                        </button>
                    </div>
                </div>
                <div class="call-header-buttons" style="position: absolute; top: 5px; right: 5px; display: flex; gap: 5px;">
                    <button class="minimize-call-btn" style="background: rgba(255,255,255,0.1); border: none; color: #ffffff; font-size: 16px; cursor: pointer; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 0;">➕</button>
                    <button class="close-call-btn" style="background: rgba(255,255,255,0.1); border: none; color: #ffffff; font-size: 16px; cursor: pointer; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 0;">✕</button>
                </div>
            `;
            
            const endBtn = modal.querySelector('.mini-end-btn');
            if (endBtn) {
                endBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.endCall();
                });
            }
            
            const minimizeBtn = modal.querySelector('.minimize-call-btn');
            if (minimizeBtn) {
                minimizeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleMinimize();
                });
            }
            
            const closeBtn = modal.querySelector('.close-call-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.endCall();
                });
            }
        }
    }

    // =============== ОЧИСТКА ===============

    cleanupCall() {
        console.log('🧹 Cleaning up call...');
        
        this.isNotificationShown = false;
        
        this.stopCallTimer();
        
        if (this.isScreenSharing) {
            this.stopScreenShare();
        }
        
        this.stopAllMediaStreams();
        this.closePeerConnection();
        this.resetCallState();
        this.hideCallModal();
        this.resetVideoElements();
        this.resetUIButtons();
        
        const notification = document.getElementById('incomingCallNotification');
        if (notification) {
            notification.remove();
        }
        
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
            this.callTimeout = null;
        }
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        console.log('✅ Call cleanup completed');
    }

    stopAllMediaStreams() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log(`⏹️ Stopped local track: ${track.kind}`);
            });
            this.localStream = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
        
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
    }

    closePeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }

    resetCallState() {
        this.currentCall = null;
        this.isCaller = false;
        this.isInCall = false;
        this.callType = null;
        this.isScreenSharing = false;
        this.isMuted = false;
        this.isCameraOff = false;
        this.screenShareActive = false;
        this.originalVideoTrack = null;
        this.originalAudioTrack = null;
        this.reconnectAttempts = 0;
        this.isCallModalMinimized = false;
    }

    resetVideoElements() {
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
        const remoteVideoPlaceholder = document.getElementById('remoteVideoPlaceholder');
        const remotePlaceholderText = document.getElementById('remotePlaceholderText');
        
        if (localVideo) {
            localVideo.srcObject = null;
            localVideo.style.display = 'none';
            localVideo.style.transform = 'none';
        }
        if (remoteVideo) {
            remoteVideo.srcObject = null;
            remoteVideo.style.display = 'none';
        }
        if (localVideoPlaceholder) {
            localVideoPlaceholder.style.display = 'flex';
        }
        if (remoteVideoPlaceholder) {
            remoteVideoPlaceholder.style.display = 'flex';
        }
        if (remotePlaceholderText) {
            remotePlaceholderText.textContent = 'Ожидание собеседника';
        }
    }

    resetUIButtons() {
        const screenShareBtn = document.getElementById('screenShareBtn');
        if (screenShareBtn) {
            screenShareBtn.innerHTML = '🖥️';
            screenShareBtn.style.background = 'linear-gradient(45deg, #4a4a4a, #2d2d2d)';
        }
        
        const muteIndicator = document.getElementById('muteIndicator');
        const cameraIndicator = document.getElementById('cameraIndicator');
        const screenIndicator = document.getElementById('screenIndicator');
        const remoteStatus = document.getElementById('remoteStatus');
        const connectionStatus = document.getElementById('connectionStatus');
        const iceStatus = document.getElementById('iceStatus');
        const iceConnectionType = document.getElementById('iceConnectionType');
        
        if (muteIndicator) muteIndicator.style.display = 'none';
        if (cameraIndicator) cameraIndicator.style.display = 'none';
        if (screenIndicator) screenIndicator.style.display = 'none';
        if (remoteStatus) {
            remoteStatus.textContent = 'подключение...';
            remoteStatus.style.color = '#cccccc';
        }
        if (connectionStatus) connectionStatus.textContent = '';
        if (iceStatus) iceStatus.textContent = '';
        if (iceConnectionType) iceConnectionType.innerHTML = '';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 12px;
            color: white;
            font-weight: bold;
            z-index: 10010;
            box-shadow: 0 6px 20px rgba(0,0,0,0.2);
            background: ${type === 'error' ? 'linear-gradient(45deg, #dc3545, #c82333)' : type === 'success' ? 'linear-gradient(45deg, #28a745, #20c997)' : 'linear-gradient(45deg, #17a2b8, #138496)'};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            border: 1px solid rgba(255,255,255,0.1);
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }
}

// Добавляем CSS анимации
if (!document.getElementById('call-styles')) {
    const styles = document.createElement('style');
    styles.id = 'call-styles';
    styles.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        @keyframes reconnectPulse {
            0%, 100% { 
                transform: scale(1); 
                box-shadow: 0 0 20px rgba(0,123,255,0.5);
            }
            50% { 
                transform: scale(1.05); 
                box-shadow: 0 0 30px rgba(0,123,255,0.8);
            }
        }
        
        .calling-controls {
            animation: pulse 2s infinite;
        }
        
        .reconnect-controls {
            animation: reconnectPulse 2s infinite;
        }
        
        .control-btn {
            transition: all 0.3s ease;
        }
        
        .control-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 0 20px rgba(255,255,255,0.3);
        }
        
        .call-btn {
            transition: all 0.3s ease;
        }
        
        .call-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(0,0,0,0.3);
        }
        
        .video-container {
            transition: all 0.3s ease;
        }
        
        .video-container:hover {
            box-shadow: 0 0 25px rgba(255,255,255,0.15);
        }
        
        /* Стили для минимизированного окна */
        .modal-overlay[style*="width: 350px"] .call-header {
            padding: 10px !important;
        }
        
        .modal-overlay[style*="width: 350px"] .call-info {
            padding: 0 !important;
        }
        
        .modal-overlay[style*="width: 350px"] #callTitle {
            font-size: 14px !important;
            margin-bottom: 2px !important;
        }
        
        .modal-overlay[style*="width: 350px"] #callTimer {
            font-size: 11px !important;
        }
        
        .modal-overlay[style*="width: 350px"] .call-header-buttons {
            top: 5px !important;
            right: 5px !important;
            gap: 5px !important;
        }
    `;
    document.head.appendChild(styles);
}

// Экспортируем класс для глобального использования
window.CallManager = CallManager;