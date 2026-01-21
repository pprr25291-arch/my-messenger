// Файл: call-manager.js (исправленная версия)

class CallManager {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.currentCall = null;
        this.isCaller = false;
        this.isInCall = false;
        this.callType = null; // 'audio' или 'video'
        this.screenStream = null;
        this.isScreenSharing = false;
        this.isMuted = false;
        this.isCameraOff = false;
        this.callTimeout = null;
        this.callTimer = null;
        
        // Для управления трансляцией экрана
        this.originalVideoTrack = null;
        this.originalAudioTrack = null;
        this.screenShareActive = false;
        
        // Для переподключения
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        
        // Для управления состоянием окна
        this.isCallModalMinimized = false;
        this.isNotificationShown = false;
        
        // Для перетаскивания окна
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        
        // Для изменения размера
        this.isResizing = false;
        this.resizeDirection = null;
        
        this.setupEventListeners();
        this.createCallUI();
        
        console.log('✅ CallManager initialized');
    }

    createCallUI() {
        // Создаем элементы интерфейса для звонков
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
                <div class="call-header" style="padding: 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); background: #2d2d2d; position: relative; cursor: move;">
                    <div class="call-info" id="callInfo">
                        <h3 style="margin: 0; color: #ffffff;" id="callTitle">📞 Звонок...</h3>
                        <div id="callTimer" style="font-size: 14px; opacity: 0.8; color: #cccccc;">00:00</div>
                        <div id="connectionStatus" style="font-size: 12px; margin-top: 5px; color: #28a745;"></div>
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
                                <video id="localVideo" autoplay muted playsinline style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
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
                
                <!-- Элементы для изменения размера (только в минимизированном режиме) -->
                <div class="resize-handles" style="display: none; position: absolute;">
                    <div class="resize-handle n" style="position: absolute; top: 0; left: 0; right: 0; height: 10px; cursor: n-resize;"></div>
                    <div class="resize-handle e" style="position: absolute; top: 0; right: 0; bottom: 0; width: 10px; cursor: e-resize;"></div>
                    <div class="resize-handle s" style="position: absolute; bottom: 0; left: 0; right: 0; height: 10px; cursor: s-resize;"></div>
                    <div class="resize-handle w" style="position: absolute; top: 0; left: 0; bottom: 0; width: 10px; cursor: w-resize;"></div>
                    <div class="resize-handle ne" style="position: absolute; top: 0; right: 0; width: 15px; height: 15px; cursor: ne-resize;"></div>
                    <div class="resize-handle nw" style="position: absolute; top: 0; left: 0; width: 15px; height: 15px; cursor: nw-resize;"></div>
                    <div class="resize-handle se" style="position: absolute; bottom: 0; right: 0; width: 15px; height: 15px; cursor: se-resize;"></div>
                    <div class="resize-handle sw" style="position: absolute; bottom: 0; left: 0; width: 15px; height: 15px; cursor: sw-resize;"></div>
                </div>
            </div>
        `;

        document.body.appendChild(callModal);
        this.setupCallModalEvents();
    }

    setupEventListeners() {
        // Обработка входящих звонков
        if (window.socket) {
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

            // WebRTC события
            window.socket.on('webrtc_offer', (data) => {
                this.handleWebRTCOffer(data);
            });

            window.socket.on('webrtc_answer', (data) => {
                this.handleWebRTCAnswer(data);
            });

            window.socket.on('webrtc_ice_candidate', (data) => {
                this.handleWebRTCIceCandidate(data);
            });

            // События трансляции экрана
            window.socket.on('screen_share_started', (data) => {
                this.handleRemoteScreenShareStarted(data);
            });

            window.socket.on('screen_share_ended', (data) => {
                this.handleRemoteScreenShareEnded(data);
            });
        }
    }

    setupCallModalEvents() {
        const modal = document.getElementById('callModal');
        if (!modal) return;

        // Кнопка сворачивания
        modal.querySelector('.minimize-call-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMinimize();
        });

        // Кнопка закрытия
        modal.querySelector('.close-call-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.endCall();
        });

        // Кнопки для принимающего
        modal.querySelector('.accept-btn')?.addEventListener('click', () => {
            this.acceptCall();
        });

        modal.querySelector('.reject-btn')?.addEventListener('click', () => {
            this.rejectCall();
        });

        // Кнопка отмены звонка
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
            console.log(`📞 Initiating ${callType} call to ${targetUser}`);
            
            // Сбрасываем флаг уведомления
            this.isNotificationShown = false;
            
            this.currentCall = {
                callId: 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                targetUser: targetUser,
                caller: document.getElementById('username')?.textContent || window.USERNAME || 'Unknown',
                type: callType,
                status: 'initiating'
            };
            
            this.isCaller = true;
            this.callType = callType;
            
            // Сначала показываем интерфейс звонка
            this.showCallModal();
            this.showCallingControls();
            this.updateCallInfo(`Звонок пользователю ${targetUser}...`);
            
            // Получаем локальный медиапоток
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
            }
            
            // Таймаут ожидания ответа
            this.callTimeout = setTimeout(() => {
                if (this.isInCall === false) {
                    this.showNotification(`${targetUser} не отвечает`, 'error');
                    this.endCall();
                }
            }, 30000); // 30 секунд
            
        } catch (error) {
            console.error('❌ Error initiating call:', error);
            this.showNotification('Ошибка инициализации звонка', 'error');
            this.endCall();
            throw error;
        }
    }

    async getLocalStream() {
        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: this.callType === 'video' ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                } : false
            };
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Показываем локальное видео
            const localVideo = document.getElementById('localVideo');
            const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
            
            if (localVideo && this.localStream) {
                localVideo.srcObject = this.localStream;
                localVideo.style.display = 'block';
                if (localVideoPlaceholder) {
                    localVideoPlaceholder.style.display = 'none';
                }
            }
            
            console.log('✅ Local stream obtained');
            return this.localStream;
            
        } catch (error) {
            console.error('❌ Error getting local stream:', error);
            
            let errorMessage = 'Не удалось получить доступ к камере/микрофону';
            if (error.name === 'NotFoundError') {
                errorMessage = 'Камера или микрофон не найдены';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Не удалось получить доступ к камере/микрофону. Проверьте настройки браузера.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage = 'Доступ к камере/микрофону запрещен. Разрешите доступ в настройках браузера.';
            }
            
            this.showNotification(errorMessage, 'error');
            throw error;
        }
    }

    handleIncomingCall(data) {
        console.log('📞 Incoming call received:', data);
        
        // Проверяем, не заняты ли мы уже в звонке
        if (this.isInCall) {
            this.rejectIncomingCall(data, 'Занят другим звонком');
            return;
        }
        
        // Проверяем, не показывается ли уже уведомление
        if (this.isNotificationShown) {
            console.log('⚠️ Notification already shown, ignoring duplicate call');
            return;
        }
        
        // Проверяем, не открыт ли уже звонок
        const callModal = document.getElementById('callModal');
        if (callModal && callModal.style.display !== 'none') {
            console.log('⚠️ Call modal already open, ignoring duplicate call');
            return;
        }
        
        this.currentCall = {
            callId: data.callId,
            caller: data.caller,
            targetUser: document.getElementById('username')?.textContent || window.USERNAME || 'User',
            type: data.callType,
            status: 'incoming'
        };
        
        this.isCaller = false;
        this.callType = data.callType;
        this.isNotificationShown = true; // Устанавливаем флаг, что уведомление показано
        
        // Показываем уведомление о входящем звонке
        this.showIncomingCallNotification(data);
    }

    showIncomingCallNotification(data) {
        // Сначала удаляем старое уведомление, если оно есть
        const existingNotification = document.getElementById('incomingCallNotification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Проверяем, не открыт ли уже звонок
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

        // Обработчики кнопок
        notification.querySelector('.accept-incoming-btn').addEventListener('click', () => {
            notification.remove();
            this.isNotificationShown = false; // Сбрасываем флаг
            this.acceptCall();
        });

        notification.querySelector('.reject-incoming-btn').addEventListener('click', () => {
            notification.remove();
            this.isNotificationShown = false; // Сбрасываем флаг
            this.rejectCall();
        });

        // Автоматическое отклонение через 30 секунд
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
                this.isNotificationShown = false; // Сбрасываем флаг
                this.rejectCall();
            }
        }, 30000);
    }

    async acceptCall() {
        try {
            console.log('✅ Accepting call...');
            
            // Получаем локальный поток
            await this.getLocalStream();
            
            // Показываем интерфейс звонка
            this.showCallModal();
            this.showActiveCallControls();
            this.updateCallInfo(`Разговор с ${this.currentCall.caller}`);
            
            // Устанавливаем статус звонка
            this.currentCall.status = 'active';
            this.isInCall = true;
            
            // Отправляем подтверждение звонка
            if (window.socket) {
                window.socket.emit('accept_call', {
                    callId: this.currentCall.callId,
                    caller: this.currentCall.caller,
                    acceptor: this.currentCall.targetUser
                });
                
                console.log('📤 Call acceptance sent');
            }
            
            // Инициализируем WebRTC соединение
            await this.initiateWebRTC();
            
            // Запускаем таймер звонка
            this.startCallTimer();
            
        } catch (error) {
            console.error('❌ Error accepting call:', error);
            this.showNotification('Ошибка при принятии звонка', 'error');
            this.endCall();
        }
    }

    rejectCall(reason = 'Отклонен пользователем') {
        console.log('❌ Rejecting call...');
        
        // Сбрасываем флаг уведомления
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
        }
        
        this.currentCall.status = 'active';
        this.isInCall = true;
        
        this.showActiveCallControls();
        this.updateCallInfo(`Разговор с ${data.acceptor}`);
        
        // Инициализируем WebRTC соединение
        await this.initiateWebRTC();
        
        // Запускаем таймер звонка
        this.startCallTimer();
    }

    handleCallRejected(data) {
        console.log('❌ Call rejected:', data.reason);
        
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
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
                reason: reason
            });
        }
        
        this.cleanupCall();
        this.showNotification('Звонок завершен', 'info');
    }

    async initiateWebRTC() {
        try {
            console.log('🔗 Initializing WebRTC connection...');
            
            // Создаем RTCPeerConnection с улучшенной конфигурацией
            const configuration = {
                iceServers: [
                    { 
                        urls: [
                            'stun:stun.l.google.com:19302',
                            'stun:stun1.l.google.com:19302',
                            'stun:stun2.l.google.com:19302',
                            'stun:stun3.l.google.com:19302',
                            'stun:stun4.l.google.com:19302'
                        ]
                    },
                    // Резервные STUN серверы
                    { urls: 'stun:stun.voipbuster.com:3478' },
                    { urls: 'stun:stun.voipstunt.com:3478' },
                    { urls: 'stun:stun.ekiga.net:3478' }
                ],
                iceCandidatePoolSize: 10,
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require',
                sdpSemantics: 'unified-plan'
            };
            
            this.peerConnection = new RTCPeerConnection(configuration);
            
            // Добавляем обработчики событий WebRTC
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate && window.socket) {
                    console.log('📤 ICE candidate:', event.candidate);
                    window.socket.emit('webrtc_ice_candidate', {
                        callId: this.currentCall.callId,
                        targetUser: this.isCaller ? this.currentCall.targetUser : this.currentCall.caller,
                        candidate: event.candidate
                    });
                } else if (!event.candidate) {
                    console.log('✅ All ICE candidates sent');
                }
            };
            
            this.peerConnection.ontrack = (event) => {
                console.log('✅ Remote track received:', event.track.kind);
                this.remoteStream = event.streams[0];
                
                // Показываем удаленное видео
                const remoteVideo = document.getElementById('remoteVideo');
                const remoteVideoPlaceholder = document.getElementById('remoteVideoPlaceholder');
                const remotePlaceholderText = document.getElementById('remotePlaceholderText');
                
                if (remoteVideo) {
                    remoteVideo.srcObject = this.remoteStream;
                    remoteVideo.style.display = 'block';
                    if (remoteVideoPlaceholder) {
                        remoteVideoPlaceholder.style.display = 'none';
                    }
                    
                    // Обработка аудио событий
                    remoteVideo.onloadedmetadata = () => {
                        console.log('✅ Remote video metadata loaded');
                        remoteVideo.play().catch(e => console.warn('Remote video play failed:', e));
                    };
                }
                
                this.updateStatus('Соединение установлено');
                this.updateICEStatus('Соединение активно');
            };
            
            this.peerConnection.oniceconnectionstatechange = () => {
                const state = this.peerConnection.iceConnectionState;
                console.log('ICE connection state:', state);
                
                switch(state) {
                    case 'checking':
                        this.updateStatus('Установка соединения...');
                        this.updateICEStatus('Поиск оптимального соединения...');
                        break;
                    case 'connected':
                        this.updateStatus('Соединение установлено ✓');
                        this.updateICEStatus('Соединение активно');
                        this.reconnectAttempts = 0;
                        this.showActiveCallControls();
                        break;
                    case 'completed':
                        this.updateStatus('Соединение установлено ✓');
                        this.updateICEStatus('Соединение активно');
                        break;
                    case 'disconnected':
                        this.updateStatus('Соединение прервано...');
                        this.updateICEStatus('Попытка переподключения...');
                        console.warn('⚠️ WebRTC disconnected');
                        // Показываем кнопку переподключения
                        this.showReconnectControls();
                        
                        // Автоматическая попытка переподключения
                        setTimeout(() => {
                            if (this.peerConnection && this.peerConnection.iceConnectionState === 'disconnected') {
                                console.log('🔄 Attempting automatic reconnect...');
                                this.reconnectCall();
                            }
                        }, 3000);
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
            
            // Улучшенная обработка ошибок ICE кандидатов
            this.peerConnection.onicecandidateerror = (error) => {
                // Игнорируем стандартные ошибки STUN серверов
                if (error.errorCode === 701 || error.errorCode === 0) {
                    console.debug('ICE candidate error (ignored):', error);
                    return;
                }
                
                if (error.errorCode) {
                    console.warn(`ICE Error ${error.errorCode}: ${error.errorText || error.message}`);
                } else {
                    console.warn('ICE candidate error:', error);
                }
                
                this.updateICEStatus(`Сетевая ошибка (код: ${error.errorCode || 'unknown'})`);
            };
            
            // Добавляем локальные треки
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    console.log(`➕ Adding local track: ${track.kind}`);
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }
            
            // Создаем и отправляем предложение (offer) если мы звонящий
            if (this.isCaller) {
                const offer = await this.peerConnection.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: this.callType === 'video'
                });
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
            this.showNotification('Ошибка установки соединения', 'error');
            this.endCall();
        }
    }

    async handleWebRTCOffer(data) {
        try {
            console.log('📥 Received WebRTC offer');
            
            if (!this.peerConnection) {
                await this.initiateWebRTC();
            }
            
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            // Создаем ответ (answer)
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
            }
            
        } catch (error) {
            console.error('❌ Error handling ICE candidate:', error);
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
            
            // Если мы звонящий, отправляем новый offer
            if (this.isCaller) {
                const offer = await this.peerConnection.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: this.callType === 'video'
                });
                await this.peerConnection.setLocalDescription(offer);
                
                if (window.socket) {
                    window.socket.emit('webrtc_offer', {
                        callId: this.currentCall.callId,
                        targetUser: this.currentCall.targetUser,
                        offer: offer
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Reconnect error:', error);
            setTimeout(() => this.reconnectCall(), 2000);
        }
    }

    // Функции для сворачивания/разворачивания окна
    toggleMinimize() {
        const modal = document.getElementById('callModal');
        const callContent = document.getElementById('callContent');
        const callControls = document.getElementById('callControls');
        
        if (!modal || !callContent || !callControls) return;
        
        if (this.isCallModalMinimized) {
            // Разворачиваем
            this.restoreCallModal();
        } else {
            // Сворачиваем
            this.minimizeCallModal();
        }
    }

    minimizeCallModal() {
        const modal = document.getElementById('callModal');
        const callContent = document.getElementById('callContent');
        const callControls = document.getElementById('callControls');
        
        if (!modal) return;
        
        // Сворачиваем
        modal.style.width = '350px';
        modal.style.height = '200px';
        modal.style.minHeight = '200px';
        modal.style.maxHeight = '200px';
        modal.style.top = '100px';
        modal.style.right = '30px';
        modal.style.left = 'auto';
        modal.style.borderRadius = '15px';
        modal.style.overflow = 'hidden';
        modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        modal.style.cursor = 'move';
        modal.style.resize = 'none';
        
        // Скрываем основное содержимое
        if (callContent) callContent.style.display = 'none';
        if (callControls) callControls.style.display = 'none';
        
        // Показываем только заголовок с информацией
        this.updateMinimizedView();
        
        this.isCallModalMinimized = true;
        
        // Обновляем кнопку
        const minimizeBtn = modal.querySelector('.minimize-call-btn');
        if (minimizeBtn) {
            minimizeBtn.textContent = '➕';
            minimizeBtn.title = 'Развернуть';
        }
        
        // Включаем возможность перетаскивания
        this.enableDragging();
        
        // Включаем возможность изменения размера
        this.enableResizing();
        
        // Добавляем возможность развернуть по двойному клику на заголовок
        const callHeader = modal.querySelector('.call-header');
        if (callHeader) {
            callHeader.style.cursor = 'pointer';
            callHeader.addEventListener('dblclick', () => {
                this.restoreCallModal();
            });
        }
    }

    restoreCallModal() {
        const modal = document.getElementById('callModal');
        const callContent = document.getElementById('callContent');
        const callControls = document.getElementById('callControls');
        
        if (!modal) return;
        
        // Разворачиваем
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
        
        // Восстанавливаем все содержимое
        if (callContent) callContent.style.display = 'flex';
        if (callControls) {
            // ВОССТАНАВЛИВАЕМ ПАНЕЛЬ УПРАВЛЕНИЯ В ЗАВИСИМОСТИ ОТ СОСТОЯНИЯ
            callControls.style.display = 'flex';
            
            // Определяем, какие кнопки показывать
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
        
        // Восстанавливаем оригинальную структуру заголовка
        const callHeader = modal.querySelector('.call-header');
        if (callHeader) {
            // Сохраняем текущие данные перед заменой
            const currentCallTitle = document.getElementById('callTitle')?.textContent || '📞 Звонок...';
            const currentCallTimer = document.getElementById('callTimer')?.textContent || '00:00';
            const currentConnectionStatus = document.getElementById('connectionStatus')?.textContent || '';
            
            callHeader.innerHTML = `
                <div class="call-info" id="callInfo">
                    <h3 style="margin: 0; color: #ffffff;" id="callTitle">${currentCallTitle}</h3>
                    <div id="callTimer" style="font-size: 14px; opacity: 0.8; color: #cccccc;">${currentCallTimer}</div>
                    <div id="connectionStatus" style="font-size: 12px; margin-top: 5px; color: #28a745;">${currentConnectionStatus}</div>
                </div>
                <div class="call-header-buttons" style="position: absolute; top: 20px; right: 20px; display: flex; gap: 10px;">
                    <button class="minimize-call-btn" style="background: rgba(255,255,255,0.1); border: none; color: #ffffff; font-size: 20px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">➖</button>
                    <button class="close-call-btn" style="background: rgba(255,255,255,0.1); border: none; color: #ffffff; font-size: 20px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>
            `;
            
            // Перепривязываем события
            this.setupCallModalEvents();
        }
        
        this.isCallModalMinimized = false;
        
        // Отключаем перетаскивание и изменение размера
        this.disableDragging();
        this.disableResizing();
        
        // Скрываем элементы изменения размера
        const resizeHandles = modal.querySelector('.resize-handles');
        if (resizeHandles) {
            resizeHandles.style.display = 'none';
        }
    }

    updateCallInfoBasedOnStatus() {
        if (!this.currentCall) return;
        
        if (this.currentCall.status === 'incoming') {
            this.updateCallInfo(`Входящий звонок от ${this.currentCall.caller}`);
        } else if (this.currentCall.status === 'calling') {
            this.updateCallInfo(`Звонок ${this.currentCall.targetUser}`);
        } else if (this.currentCall.status === 'active') {
            const otherUser = this.isCaller ? 
                this.currentCall.targetUser : 
                this.currentCall.caller;
            this.updateCallInfo(`Разговор с ${otherUser}`);
        }
    }

    updateMinimizedView() {
        const modal = document.getElementById('callModal');
        if (!modal || !this.currentCall) return;
        
        // Определяем, что показывать в свернутом виде
        let title = '';
        let status = '';
        let icon = '📞';
        
        if (this.currentCall.status === 'incoming') {
            title = `Входящий от ${this.currentCall.caller}`;
            status = 'Ожидание ответа...';
            icon = '📥';
        } else if (this.currentCall.status === 'calling') {
            title = `Звонок ${this.currentCall.targetUser}`;
            status = 'Ожидание ответа...';
            icon = '📤';
        } else if (this.currentCall.status === 'active') {
            title = this.isCaller ? 
                `Разговор с ${this.currentCall.targetUser}` : 
                `Разговор с ${this.currentCall.caller}`;
            
            const timer = document.getElementById('callTimer')?.textContent || '00:00';
            status = `Длительность: ${timer}`;
            icon = '🎙️';
        }
        
        // Обновляем заголовок
        const callHeader = modal.querySelector('.call-header');
        if (callHeader) {
            callHeader.innerHTML = `
                <div class="call-info" id="callInfo" style="width: 100%; padding: 15px; display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 24px; flex-shrink: 0;">${icon}</div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-weight: bold; color: #ffffff; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${title}</div>
                        <div style="font-size: 12px; opacity: 0.8; color: #cccccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${status}</div>
                        <div style="font-size: 10px; color: #28a745; margin-top: 2px;" id="miniConnectionStatus">${document.getElementById('connectionStatus')?.textContent || ''}</div>
                    </div>
                    <div class="mini-controls" style="display: flex; gap: 5px; flex-shrink: 0;">
                        <button class="mini-action-btn" data-action="mute" style="background: rgba(255,255,255,0.1); border: none; color: #ffffff; font-size: 16px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            ${this.isMuted ? '🎤❌' : '🎤'}
                        </button>
                        ${this.callType === 'video' ? `
                            <button class="mini-action-btn" data-action="camera" style="background: rgba(255,255,255,0.1); border: none; color: #ffffff; font-size: 16px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                ${this.isCameraOff ? '📹❌' : '📹'}
                            </button>
                        ` : ''}
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
            
            // Добавляем обработчики для мини-кнопок
            this.setupMiniControls();
        }
    }

    setupMiniControls() {
        const modal = document.getElementById('callModal');
        if (!modal) return;
        
        // Кнопка микрофона
        const muteBtn = modal.querySelector('.mini-action-btn[data-action="mute"]');
        if (muteBtn) {
            muteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMute();
                // Обновляем иконку
                muteBtn.innerHTML = this.isMuted ? '🎤❌' : '🎤';
            });
        }
        
        // Кнопка камеры
        const cameraBtn = modal.querySelector('.mini-action-btn[data-action="camera"]');
        if (cameraBtn) {
            cameraBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.callType === 'video') {
                    this.toggleCamera();
                    // Обновляем иконку
                    cameraBtn.innerHTML = this.isCameraOff ? '📹❌' : '📹';
                }
            });
        }
        
        // Кнопка завершения звонка
        const endBtn = modal.querySelector('.mini-end-btn');
        if (endBtn) {
            endBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.endCall();
            });
        }
        
        // Обновляем кнопки сворачивания/закрытия
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

    // Функции для перетаскивания окна
    enableDragging() {
        const modal = document.getElementById('callModal');
        if (!modal) return;
        
        const header = modal.querySelector('.call-header');
        if (!header) return;
        
        header.style.cursor = 'move';
        
        header.addEventListener('mousedown', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('mouseup', this.stopDrag.bind(this));
        
        // Для сенсорных устройств
        header.addEventListener('touchstart', this.startDragTouch.bind(this));
        document.addEventListener('touchmove', this.dragTouch.bind(this));
        document.addEventListener('touchend', this.stopDrag.bind(this));
    }

    disableDragging() {
        const modal = document.getElementById('callModal');
        if (!modal) return;
        
        const header = modal.querySelector('.call-header');
        if (!header) return;
        
        header.style.cursor = '';
        
        header.removeEventListener('mousedown', this.startDrag.bind(this));
        document.removeEventListener('mousemove', this.drag.bind(this));
        document.removeEventListener('mouseup', this.stopDrag.bind(this));
        
        header.removeEventListener('touchstart', this.startDragTouch.bind(this));
        document.removeEventListener('touchmove', this.dragTouch.bind(this));
        document.removeEventListener('touchend', this.stopDrag.bind(this));
    }

    startDrag(e) {
        e.preventDefault();
        const modal = document.getElementById('callModal');
        if (!modal) return;
        
        this.isDragging = true;
        const rect = modal.getBoundingClientRect();
        this.dragOffsetX = e.clientX - rect.left;
        this.dragOffsetY = e.clientY - rect.top;
        
        modal.style.transition = 'none';
    }

    startDragTouch(e) {
        e.preventDefault();
        const modal = document.getElementById('callModal');
        if (!modal || !e.touches[0]) return;
        
        this.isDragging = true;
        const touch = e.touches[0];
        const rect = modal.getBoundingClientRect();
        this.dragOffsetX = touch.clientX - rect.left;
        this.dragOffsetY = touch.clientY - rect.top;
        
        modal.style.transition = 'none';
    }

    drag(e) {
        if (!this.isDragging) return;
        
        const modal = document.getElementById('callModal');
        if (!modal) return;
        
        const x = e.clientX - this.dragOffsetX;
        const y = e.clientY - this.dragOffsetY;
        
        // Ограничиваем позицию в пределах окна
        const maxX = window.innerWidth - modal.offsetWidth;
        const maxY = window.innerHeight - modal.offsetHeight;
        
        modal.style.left = Math.min(Math.max(0, x), maxX) + 'px';
        modal.style.top = Math.min(Math.max(0, y), maxY) + 'px';
        modal.style.right = 'auto';
    }

    dragTouch(e) {
        if (!this.isDragging || !e.touches[0]) return;
        
        const modal = document.getElementById('callModal');
        if (!modal) return;
        
        const touch = e.touches[0];
        const x = touch.clientX - this.dragOffsetX;
        const y = touch.clientY - this.dragOffsetY;
        
        // Ограничиваем позицию в пределах окна
        const maxX = window.innerWidth - modal.offsetWidth;
        const maxY = window.innerHeight - modal.offsetHeight;
        
        modal.style.left = Math.min(Math.max(0, x), maxX) + 'px';
        modal.style.top = Math.min(Math.max(0, y), maxY) + 'px';
        modal.style.right = 'auto';
    }

    stopDrag() {
        this.isDragging = false;
        const modal = document.getElementById('callModal');
        if (modal) {
            modal.style.transition = 'all 0.3s ease';
        }
    }

    // Функции для изменения размера окна
    enableResizing() {
        const modal = document.getElementById('callModal');
        if (!modal) return;
        
        // Создаем и показываем элементы для изменения размера
        const resizeHandles = modal.querySelector('.resize-handles');
        if (resizeHandles) {
            resizeHandles.style.display = 'block';
            
            // Добавляем обработчики для всех сторон
            const handles = resizeHandles.querySelectorAll('.resize-handle');
            handles.forEach(handle => {
                handle.addEventListener('mousedown', (e) => this.startResize(e, handle.className));
                // Для сенсорных устройств
                handle.addEventListener('touchstart', (e) => this.startResizeTouch(e, handle.className));
            });
        }
        
        document.addEventListener('mousemove', this.resize.bind(this));
        document.addEventListener('mouseup', this.stopResize.bind(this));
        document.addEventListener('touchmove', this.resizeTouch.bind(this));
        document.addEventListener('touchend', this.stopResize.bind(this));
    }

    disableResizing() {
        const modal = document.getElementById('callModal');
        if (!modal) return;
        
        const resizeHandles = modal.querySelector('.resize-handles');
        if (resizeHandles) {
            resizeHandles.style.display = 'none';
            const handles = resizeHandles.querySelectorAll('.resize-handle');
            handles.forEach(handle => {
                handle.removeEventListener('mousedown', this.startResize);
                handle.removeEventListener('touchstart', this.startResizeTouch);
            });
        }
        
        document.removeEventListener('mousemove', this.resize.bind(this));
        document.removeEventListener('mouseup', this.stopResize.bind(this));
        document.removeEventListener('touchmove', this.resizeTouch.bind(this));
        document.removeEventListener('touchend', this.stopResize.bind(this));
    }

    startResize(e, direction) {
        e.preventDefault();
        e.stopPropagation();
        
        this.isResizing = true;
        this.resizeDirection = direction;
        
        const modal = document.getElementById('callModal');
        if (modal) {
            modal.style.transition = 'none';
        }
        
        // Сохраняем начальные размеры и позицию
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.startWidth = modal.offsetWidth;
        this.startHeight = modal.offsetHeight;
        this.startLeft = parseInt(modal.style.left) || modal.offsetLeft;
        this.startTop = parseInt(modal.style.top) || modal.offsetTop;
    }

    startResizeTouch(e, direction) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!e.touches[0]) return;
        
        this.isResizing = true;
        this.resizeDirection = direction;
        
        const modal = document.getElementById('callModal');
        if (modal) {
            modal.style.transition = 'none';
        }
        
        const touch = e.touches[0];
        // Сохраняем начальные размеры и позицию
        this.startX = touch.clientX;
        this.startY = touch.clientY;
        this.startWidth = modal.offsetWidth;
        this.startHeight = modal.offsetHeight;
        this.startLeft = parseInt(modal.style.left) || modal.offsetLeft;
        this.startTop = parseInt(modal.style.top) || modal.offsetTop;
    }

    resize(e) {
        if (!this.isResizing) return;
        
        const modal = document.getElementById('callModal');
        if (!modal) return;
        
        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;
        
        let newWidth = this.startWidth;
        let newHeight = this.startHeight;
        let newLeft = this.startLeft;
        let newTop = this.startTop;
        
        // Минимальные размеры
        const minWidth = 200;
        const minHeight = 120;
        
        // Изменяем размер в зависимости от направления
        if (this.resizeDirection.includes('e')) {
            newWidth = Math.max(minWidth, this.startWidth + dx);
        }
        if (this.resizeDirection.includes('w')) {
            const widthChange = Math.max(minWidth - this.startWidth, -dx);
            newWidth = this.startWidth - widthChange;
            newLeft = this.startLeft + widthChange;
        }
        if (this.resizeDirection.includes('s')) {
            newHeight = Math.max(minHeight, this.startHeight + dy);
        }
        if (this.resizeDirection.includes('n')) {
            const heightChange = Math.max(minHeight - this.startHeight, -dy);
            newHeight = this.startHeight - heightChange;
            newTop = this.startTop + heightChange;
        }
        
        // Максимальные размеры (80% от окна)
        const maxWidth = window.innerWidth * 0.8;
        const maxHeight = window.innerHeight * 0.8;
        
        newWidth = Math.min(newWidth, maxWidth);
        newHeight = Math.min(newHeight, maxHeight);
        
        // Применяем изменения
        modal.style.width = newWidth + 'px';
        modal.style.height = newHeight + 'px';
        modal.style.left = newLeft + 'px';
        modal.style.top = newTop + 'px';
        modal.style.right = 'auto';
    }

    resizeTouch(e) {
        if (!this.isResizing || !e.touches[0]) return;
        
        const modal = document.getElementById('callModal');
        if (!modal) return;
        
        const touch = e.touches[0];
        const dx = touch.clientX - this.startX;
        const dy = touch.clientY - this.startY;
        
        let newWidth = this.startWidth;
        let newHeight = this.startHeight;
        let newLeft = this.startLeft;
        let newTop = this.startTop;
        
        // Минимальные размеры
        const minWidth = 200;
        const minHeight = 120;
        
        // Изменяем размер в зависимости от направления
        if (this.resizeDirection.includes('e')) {
            newWidth = Math.max(minWidth, this.startWidth + dx);
        }
        if (this.resizeDirection.includes('w')) {
            const widthChange = Math.max(minWidth - this.startWidth, -dx);
            newWidth = this.startWidth - widthChange;
            newLeft = this.startLeft + widthChange;
        }
        if (this.resizeDirection.includes('s')) {
            newHeight = Math.max(minHeight, this.startHeight + dy);
        }
        if (this.resizeDirection.includes('n')) {
            const heightChange = Math.max(minHeight - this.startHeight, -dy);
            newHeight = this.startHeight - heightChange;
            newTop = this.startTop + heightChange;
        }
        
        // Максимальные размеры (80% от окна)
        const maxWidth = window.innerWidth * 0.8;
        const maxHeight = window.innerHeight * 0.8;
        
        newWidth = Math.min(newWidth, maxWidth);
        newHeight = Math.min(newHeight, maxHeight);
        
        // Применяем изменения
        modal.style.width = newWidth + 'px';
        modal.style.height = newHeight + 'px';
        modal.style.left = newLeft + 'px';
        modal.style.top = newTop + 'px';
        modal.style.right = 'auto';
    }

    stopResize() {
        this.isResizing = false;
        this.resizeDirection = null;
        
        const modal = document.getElementById('callModal');
        if (modal) {
            modal.style.transition = 'all 0.3s ease';
        }
    }

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
                errorMessage = 'Не удалось получить доступ к аудио/видео устройствам. Проверьте настройки браузера.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage = 'Доступ к демонстрации экрана запрещен. Разрешите доступ в настройках браузера.';
            }
            
            this.showNotification(errorMessage, 'error');
        }
    }

    async startScreenShare() {
        try {
            console.log('🖥️ Starting screen share...');
            
            this.updateStatus('Начинаю демонстрацию экрана...');
            
            // Останавливаем старую демонстрацию экрана, если она есть
            if (this.screenStream) {
                await this.stopScreenShare();
            }
            
            // Получаем поток экрана с аудио
            const constraints = {
                video: {
                    cursor: "always",
                    displaySurface: "monitor",
                    frameRate: { ideal: 30 }
                },
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };
            
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
            
            // Заменяем треки в PeerConnection
            await this.replaceMediaTracks();
            
            // Обновляем локальное видео
            this.updateLocalVideoWithScreen();
            
            // Устанавливаем флаги
            this.isScreenSharing = true;
            this.screenShareActive = true;
            
            // Обновляем UI
            this.updateScreenShareUI(true);
            
            // Отправляем уведомление о начале трансляции
            this.notifyScreenShareStarted();
            
            // Обработчик остановки демонстрации через UI браузера
            const screenVideoTrack = this.screenStream.getVideoTracks()[0];
            if (screenVideoTrack) {
                screenVideoTrack.addEventListener('ended', () => {
                    console.log('🖥️ Screen share ended by browser UI');
                    this.stopScreenShare();
                });
            }
            
            this.updateStatus('Демонстрация экрана активна');
            console.log('✅ Screen share started successfully');
            
        } catch (error) {
            console.error('❌ Error starting screen share:', error);
            
            if (error.name === 'NotAllowedError') {
                this.showNotification('Доступ к демонстрации экрана запрещен', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showNotification('Нет доступных источников для демонстрации', 'error');
            } else {
                this.showNotification('Ошибка демонстрации экрана: ' + error.message, 'error');
            }
            
            this.isScreenSharing = false;
            this.screenShareActive = false;
        }
    }

    async replaceMediaTracks() {
        if (!this.peerConnection) {
            console.error('❌ No peer connection available');
            return false;
        }
        
        try {
            const senders = this.peerConnection.getSenders();
            console.log('📤 Available senders:', senders.length);
            
            // Получаем треки экрана
            const screenVideoTrack = this.screenStream.getVideoTracks()[0];
            const screenAudioTrack = this.screenStream.getAudioTracks()[0];
            
            // Заменяем видеотрек
            if (screenVideoTrack) {
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    console.log('🔄 Replacing video track...');
                    await videoSender.replaceTrack(screenVideoTrack);
                    console.log('✅ Video track replaced');
                } else {
                    console.log('⚠️ No video sender found, adding new track');
                    this.peerConnection.addTrack(screenVideoTrack, this.screenStream);
                }
            }
            
            // Заменяем аудиотрек (если есть)
            if (screenAudioTrack) {
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                if (audioSender) {
                    console.log('🔄 Replacing audio track...');
                    await audioSender.replaceTrack(screenAudioTrack);
                    console.log('✅ Audio track replaced');
                }
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Error replacing media tracks:', error);
            return false;
        }
    }

    updateLocalVideoWithScreen() {
        const localVideo = document.getElementById('localVideo');
        const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
        
        if (localVideo && this.screenStream) {
            localVideo.srcObject = this.screenStream;
            localVideo.style.display = 'block';
            if (localVideoPlaceholder) {
                localVideoPlaceholder.style.display = 'none';
            }
            
            // Убедимся, что видео воспроизводится
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
            
            // Восстанавливаем оригинальные треки
            if (this.peerConnection && (this.originalVideoTrack || this.originalAudioTrack)) {
                await this.restoreOriginalTracks();
            }
            
            // Восстанавливаем локальное видео
            this.restoreLocalVideo();
            
            // Сбрасываем флаги
            this.isScreenSharing = false;
            this.screenShareActive = false;
            this.originalVideoTrack = null;
            this.originalAudioTrack = null;
            
            // Обновляем UI
            this.updateScreenShareUI(false);
            
            // Отправляем уведомление о завершении трансляции
            this.notifyScreenShareEnded();
            
            this.updateStatus('Демонстрация экрана завершена');
            console.log('✅ Screen share stopped successfully');
            
        } catch (error) {
            console.error('❌ Error stopping screen share:', error);
        }
    }

    async restoreOriginalTracks() {
        const senders = this.peerConnection.getSenders();
        
        // Восстанавливаем видеотрек
        if (this.originalVideoTrack) {
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            if (videoSender) {
                await videoSender.replaceTrack(this.originalVideoTrack);
                console.log('✅ Original video track restored');
            }
        }
        
        // Восстанавливаем аудиотрек
        if (this.originalAudioTrack) {
            const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
            if (audioSender) {
                await audioSender.replaceTrack(this.originalAudioTrack);
                console.log('✅ Original audio track restored');
            }
        }
    }

    restoreLocalVideo() {
        const localVideo = document.getElementById('localVideo');
        const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
        
        if (!localVideo || !localVideoPlaceholder) {
            return;
        }
        
        if (this.localStream && !this.isCameraOff) {
            localVideo.srcObject = this.localStream;
            localVideo.style.display = 'block';
            localVideoPlaceholder.style.display = 'none';
            
            // Убедимся, что видео воспроизводится
            localVideo.play().catch(e => console.warn('Video play failed:', e));
        } else {
            localVideo.srcObject = null;
            localVideo.style.display = 'none';
            localVideoPlaceholder.style.display = 'flex';
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
                screenShareBtn.style.borderColor = 'rgba(255,255,255,0.3)';
                screenShareBtn.title = 'Остановить демонстрацию экрана';
            } else {
                screenShareBtn.innerHTML = '🖥️';
                screenShareBtn.style.background = 'linear-gradient(45deg, #4a4a4a, #2d2d2d)';
                screenShareBtn.style.borderColor = 'rgba(255,255,255,0.2)';
                screenShareBtn.title = 'Начать демонстрацию экрана';
            }
        }
    }

    notifyScreenShareStarted() {
        if (!window.socket || !this.currentCall) {
            return;
        }
        
        const targetUser = this.isCaller ? 
            this.currentCall.targetUser : 
            this.currentCall.caller;
        
        window.socket.emit('screen_share_started', {
            callId: this.currentCall.callId,
            sharer: document.getElementById('username')?.textContent || 'Пользователь',
            targetUser: targetUser
        });
        
        console.log('📤 Notified about screen share start');
    }

    notifyScreenShareEnded() {
        if (!window.socket || !this.currentCall) {
            return;
        }
        
        const targetUser = this.isCaller ? 
            this.currentCall.targetUser : 
            this.currentCall.caller;
        
        window.socket.emit('screen_share_ended', {
            callId: this.currentCall.callId,
            sharer: document.getElementById('username')?.textContent || 'Пользователь',
            targetUser: targetUser
        });
        
        console.log('📤 Notified about screen share stop');
    }

    handleRemoteScreenShareStarted(data) {
        console.log('🖥️ Remote screen share started by:', data.sharer);
        this.updateStatus(`${data.sharer} начал демонстрацию экрана`);
        
        // Обновляем UI для удаленного пользователя
        const remoteStatus = document.getElementById('remoteStatus');
        if (remoteStatus) {
            remoteStatus.textContent = 'Демонстрирует экран';
            remoteStatus.style.color = '#28a745';
        }
        
        // Показываем уведомление
        this.showNotification(`${data.sharer} начал демонстрацию экрана`, 'info');
    }

    handleRemoteScreenShareEnded(data) {
        console.log('🖥️ Remote screen share ended by:', data.sharer);
        this.updateStatus(`${data.sharer} завершил демонстрацию экрана`);
        
        // Сбрасываем UI для удаленного пользователя
        const remoteStatus = document.getElementById('remoteStatus');
        if (remoteStatus) {
            remoteStatus.textContent = 'онлайн';
            remoteStatus.style.color = '#cccccc';
        }
        
        // Показываем уведомление
        this.showNotification(`${data.sharer} завершил демонстрацию экрана`, 'info');
    }

    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                this.isMuted = !this.isMuted;
                audioTrack.enabled = !this.isMuted;
                
                // Обновляем UI
                const muteIndicator = document.getElementById('muteIndicator');
                const muteBtn = document.getElementById('muteBtn');
                
                if (this.isMuted) {
                    muteIndicator.style.display = 'inline';
                    muteBtn.innerHTML = '🎤❌';
                    muteBtn.style.background = 'linear-gradient(45deg, #dc3545, #c82333)';
                    muteBtn.style.borderColor = 'rgba(255,255,255,0.3)';
                    this.updateStatus('Микрофон отключен');
                } else {
                    muteIndicator.style.display = 'none';
                    muteBtn.innerHTML = '🎤';
                    muteBtn.style.background = 'linear-gradient(45deg, #4a4a4a, #2d2d2d)';
                    muteBtn.style.borderColor = 'rgba(255,255,255,0.2)';
                    this.updateStatus('Микрофон включен');
                }
                
                console.log(`🔇 Microphone ${this.isMuted ? 'muted' : 'unmuted'}`);
            }
        }
    }

    toggleCamera() {
        if (this.localStream && this.callType === 'video') {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                this.isCameraOff = !this.isCameraOff;
                videoTrack.enabled = !this.isCameraOff;
                
                // Обновляем UI
                const cameraIndicator = document.getElementById('cameraIndicator');
                const cameraBtn = document.getElementById('cameraBtn');
                const localVideo = document.getElementById('localVideo');
                const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
                
                if (this.isCameraOff) {
                    cameraIndicator.style.display = 'inline';
                    cameraBtn.innerHTML = '📹❌';
                    cameraBtn.style.background = 'linear-gradient(45deg, #dc3545, #c82333)';
                    cameraBtn.style.borderColor = 'rgba(255,255,255,0.3)';
                    
                    if (localVideo) localVideo.style.display = 'none';
                    if (localVideoPlaceholder) localVideoPlaceholder.style.display = 'flex';
                    
                    this.updateStatus('Камера отключена');
                } else {
                    cameraIndicator.style.display = 'none';
                    cameraBtn.innerHTML = '📹';
                    cameraBtn.style.background = 'linear-gradient(45deg, #4a4a4a, #2d2d2d)';
                    cameraBtn.style.borderColor = 'rgba(255,255,255,0.2)';
                    
                    if (localVideo) localVideo.style.display = 'block';
                    if (localVideoPlaceholder) localVideoPlaceholder.style.display = 'none';
                    
                    this.updateStatus('Камера включена');
                }
                
                console.log(`📷 Camera ${this.isCameraOff ? 'off' : 'on'}`);
            }
        }
    }

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
            
            // Обновляем кнопку сворачивания
            const minimizeBtn = modal.querySelector('.minimize-call-btn');
            if (minimizeBtn) {
                minimizeBtn.textContent = '➖';
                minimizeBtn.title = 'Свернуть';
            }
            
            // Обновляем информацию о звонке с проверкой
            const remoteUserName = document.getElementById('remoteUserName');
            if (remoteUserName && this.currentCall) {
                remoteUserName.textContent = this.isCaller ? 
                    (this.currentCall.targetUser || 'Собеседник') : 
                    (this.currentCall.caller || 'Собеседник');
            }
            
            // Показываем нужные элементы управления
            this.updateControlVisibility();
        }
    }

    updateControlVisibility() {
        // Скрываем все элементы управления сначала
        this.hideAllControls();
        
        // Показываем нужные элементы управления в зависимости от состояния
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

    hideCallModal() {
        const modal = document.getElementById('callModal');
        if (modal) {
            modal.style.display = 'none';
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
        if (!text) return;
        
        const callTitle = document.getElementById('callTitle');
        if (callTitle) {
            callTitle.textContent = text;
            callTitle.style.color = '#ffffff';
        }
    }

    updateStatus(text) {
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.textContent = text;
            statusMessage.style.color = '#ffffff';
        }
    }

    updateICEStatus(text) {
        const iceStatus = document.getElementById('iceStatus');
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (iceStatus) {
            iceStatus.textContent = text;
            iceStatus.style.color = '#cccccc';
        }
        
        if (connectionStatus) {
            connectionStatus.textContent = text;
            
            // Цвет в зависимости от статуса
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

    startCallTimer() {
        let seconds = 0;
        const timerElement = document.getElementById('callTimer');
        
        if (!timerElement) return;
        
        this.callTimer = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            
            timerElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            timerElement.style.color = '#ffffff';
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        
        const timerElement = document.getElementById('callTimer');
        if (timerElement) {
            timerElement.textContent = '00:00';
            timerElement.style.color = '#cccccc';
        }
    }

    cleanupCall() {
        console.log('🧹 Cleaning up call...');
        
        // Сбрасываем флаг уведомления
        this.isNotificationShown = false;
        
        // Останавливаем таймер
        this.stopCallTimer();
        
        // Останавливаем демонстрацию экрана если активна
        if (this.isScreenSharing) {
            this.stopScreenShare();
        }
        
        // Останавливаем все медиапотоки
        this.stopAllMediaStreams();
        
        // Закрываем WebRTC соединение
        this.closePeerConnection();
        
        // Сбрасываем состояние
        this.resetCallState();
        
        // Скрываем модальное окно
        this.hideCallModal();
        
        // Удаляем уведомление о входящем звонке
        const notification = document.getElementById('incomingCallNotification');
        if (notification) {
            notification.remove();
        }
        
        // Сбрасываем элементы видео
        this.resetVideoElements();
        
        // Сбрасываем UI кнопок
        this.resetUIButtons();
        
        console.log('✅ Call cleanup completed');
    }

    stopAllMediaStreams() {
        // Локальный поток
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log(`⏹️ Stopped local track: ${track.kind}`);
            });
            this.localStream = null;
        }
        
        // Удаленный поток
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
        
        // Поток экрана
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
        this.currentCall = null; // Это обязательно
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
        this.isDragging = false;
        this.isResizing = false;
        
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
            this.callTimeout = null;
        }
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
        }
        if (remoteVideo) {
            remoteVideo.srcObject = null;
            remoteVideo.style.display = 'none';
        }
        if (localVideoPlaceholder) {
            localVideoPlaceholder.style.display = 'flex';
            localVideoPlaceholder.style.color = '#ffffff';
        }
        if (remoteVideoPlaceholder) {
            remoteVideoPlaceholder.style.display = 'flex';
            remoteVideoPlaceholder.style.color = '#ffffff';
        }
        if (remotePlaceholderText) {
            remotePlaceholderText.textContent = 'Ожидание собеседника';
            remotePlaceholderText.style.color = '#cccccc';
        }
    }

    resetUIButtons() {
        const screenShareBtn = document.getElementById('screenShareBtn');
        if (screenShareBtn) {
            screenShareBtn.innerHTML = '🖥️';
            screenShareBtn.style.background = 'linear-gradient(45deg, #4a4a4a, #2d2d2d)';
            screenShareBtn.style.borderColor = 'rgba(255,255,255,0.2)';
        }
        
        // Сбрасываем индикаторы
        const muteIndicator = document.getElementById('muteIndicator');
        const cameraIndicator = document.getElementById('cameraIndicator');
        const screenIndicator = document.getElementById('screenIndicator');
        const remoteStatus = document.getElementById('remoteStatus');
        const connectionStatus = document.getElementById('connectionStatus');
        const iceStatus = document.getElementById('iceStatus');
        
        if (muteIndicator) muteIndicator.style.display = 'none';
        if (cameraIndicator) cameraIndicator.style.display = 'none';
        if (screenIndicator) screenIndicator.style.display = 'none';
        if (remoteStatus) {
            remoteStatus.textContent = 'подключение...';
            remoteStatus.style.color = '#cccccc';
        }
        if (connectionStatus) {
            connectionStatus.textContent = '';
        }
        if (iceStatus) {
            iceStatus.textContent = '';
        }
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
        
        @keyframes glow {
            0%, 100% { box-shadow: 0 0 10px rgba(40,167,69,0.5); }
            50% { box-shadow: 0 0 20px rgba(40,167,69,0.8); }
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
            border-color: rgba(255,255,255,0.3);
        }
        
        #connectionStatus {
            transition: color 0.3s ease, opacity 0.3s ease;
        }
        
        .connected-state {
            animation: glow 2s infinite;
        }
        
        /* Стили для минимизированного окна */
        .modal-overlay[style*="width: 300px"] .call-header {
            padding: 15px;
            text-align: left;
        }
        
        .modal-overlay[style*="width: 300px"] .call-header-buttons {
            top: 15px;
            right: 15px;
        }
        
        .modal-overlay[style*="width: 300px"] #callTitle {
            font-size: 16px;
            margin-bottom: 5px;
        }
        
        .modal-overlay[style*="width: 300px"] #callTimer {
            font-size: 12px;
        }
        
        .modal-overlay[style*="width: 300px"] #connectionStatus {
            font-size: 10px;
        }
        
        /* Стили для резиновых границ */
        .resize-handles .resize-handle {
            position: absolute;
            z-index: 100;
            background: transparent;
        }
        
        .resize-handles .resize-handle.n {
            top: -5px;
            left: 5px;
            right: 5px;
            height: 10px;
            cursor: n-resize;
        }
        
        .resize-handles .resize-handle.e {
            top: 5px;
            right: -5px;
            bottom: 5px;
            width: 10px;
            cursor: e-resize;
        }
        
        .resize-handles .resize-handle.s {
            bottom: -5px;
            left: 5px;
            right: 5px;
            height: 10px;
            cursor: s-resize;
        }
        
        .resize-handles .resize-handle.w {
            top: 5px;
            left: -5px;
            bottom: 5px;
            width: 10px;
            cursor: w-resize;
        }
        
        .resize-handles .resize-handle.ne {
            top: -7px;
            right: -7px;
            width: 15px;
            height: 15px;
            cursor: ne-resize;
        }
        
        .resize-handles .resize-handle.nw {
            top: -7px;
            left: -7px;
            width: 15px;
            height: 15px;
            cursor: nw-resize;
        }
        
        .resize-handles .resize-handle.se {
            bottom: -7px;
            right: -7px;
            width: 15px;
            height: 15px;
            cursor: se-resize;
        }
        
        .resize-handles .resize-handle.sw {
            bottom: -7px;
            left: -7px;
            width: 15px;
            height: 15px;
            cursor: sw-resize;
        }
        
        /* Активное состояние для перетаскивания */
        .dragging {
            opacity: 0.9;
            cursor: move !important;
        }
        
        .resizing {
            opacity: 0.9;
        }
    `;
    document.head.appendChild(styles);
}

// Экспортируем класс для глобального использования
window.CallManager = CallManager;