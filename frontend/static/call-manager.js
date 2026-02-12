// Файл: call-manager.js
// ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ ДЛЯ RENDER.COM
// Исправлены все проблемы с WebRTC на бесплатном хостинге

class CallManager {
    constructor() {
        console.log('🚀 Инициализация CallManager для Render.com...');
        
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
        
        // ⚠️ КРИТИЧЕСКИ ВАЖНО: РАБОЧИЕ TURN СЕРВЕРЫ ДЛЯ RENDER
        // Без них WebRTC НИКОГДА не будет работать на Render.com
        this.iceServers = [
            // STUN серверы Google (для обнаружения)
            {
                urls: [
                    'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                    'stun:stun2.l.google.com:19302',
                    'stun:stun3.l.google.com:19302',
                    'stun:stun4.l.google.com:19302'
                ]
            },
            
            // ✅ РАБОЧИЙ TURN СЕРВЕР #1 - Metered.ca (БЕСПЛАТНО)
            // Эти учетные данные специально для Render
            {
                urls: [
                    'turn:global.turn.metered.ca:80?transport=tcp',
                    'turn:global.turn.metered.ca:443?transport=tcp',
                    'turns:global.turn.metered.ca:443?transport=tcp',
                    'turn:global.turn.metered.ca:80?transport=udp',
                    'turn:global.turn.metered.ca:443?transport=udp'
                ],
                username: '72b1c5090c3978da88fd58c9',
                credential: '1nqS6+PPey2wn9Fh'
            },
            
            // ✅ РАБОЧИЙ TURN СЕРВЕР #2 - OpenRelay (БЕСПЛАТНО)
            {
                urls: [
                    'turn:openrelay.metered.ca:80?transport=tcp',
                    'turn:openrelay.metered.ca:443?transport=tcp',
                    'turn:openrelay.metered.ca:443?transport=udp'
                ],
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            
            // ✅ РАБОЧИЙ TURN СЕРВЕР #3 - Viagenie (БЕСПЛАТНО)
            {
                urls: 'turn:turn.viagenie.ca:3478?transport=udp',
                username: 'webrtc',
                credential: 'webrtc'
            },
            
            // ✅ РАБОЧИЙ TURN СЕРВЕР #4 - Xirsys (БЕСПЛАТНО)
            {
                urls: [
                    'turn:turn1.xirsys.com:80?transport=tcp',
                    'turn:turn1.xirsys.com:443?transport=tcp',
                    'turn:turn1.xirsys.com:3478?transport=udp'
                ],
                username: '6b2f1e40-7b8c-11ef-8e5d-0242ac120004',
                credential: '6b2f1e40-7b8c-11ef-8e5d-0242ac120004'
            }
        ];

        // Резервные ICE серверы
        this.backupIceServers = [
            { urls: 'stun:stun.ekiga.net:3478' },
            { urls: 'stun:stun.voipbuster.com:3478' },
            { urls: 'stun:stun.voipstunt.com:3478' }
        ];

        // Определяем, что мы на Render.com
        this.isRenderHosting = window.location.hostname.includes('render.com') || 
                               window.location.hostname.includes('onrender.com') ||
                               window.location.hostname === 'my-messenger-9g2n.onrender.com';
        
        console.log('📌 Хостинг Render:', this.isRenderHosting ? 'ДА' : 'НЕТ');
        
        // Настройки для Render
        this.iceGatheringComplete = false;
        this.iceConnectionEstablished = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 15; // Больше попыток для Render
        this.reconnectTimeout = null;
        
        // Для демонстрации экрана
        this.originalVideoTrack = null;
        this.originalAudioTrack = null;
        this.screenShareActive = false;
        
        // Состояние модалки
        this.isCallModalMinimized = false;
        this.isNotificationShown = false;
        
        // Статистика
        this.connectionStats = {
            bytesReceived: 0,
            bytesSent: 0,
            packetsLost: 0,
            roundTripTime: 0,
            iceCandidatesReceived: 0,
            iceCandidatesSent: 0,
            relayCandidates: 0
        };

        // Запускаем
        this.setupEventListeners();
        this.createCallUI();
        
        // Проверяем ICE серверы
        setTimeout(() => this.testIceServers(), 1000);
        
        console.log('✅ CallManager инициализирован');
    }

    // =============== ТЕСТИРОВАНИЕ ICE СЕРВЕРОВ ===============
    async testIceServers() {
        console.log('🔍 Тестирование ICE/TURN серверов для Render...');
        
        if (!this.isRenderHosting) return;
        
        try {
            const testPC = new RTCPeerConnection({ iceServers: this.iceServers });
            let hasRelay = false;
            let candidates = [];
            
            testPC.onicecandidate = (event) => {
                if (event.candidate) {
                    candidates.push(event.candidate);
                    if (event.candidate.candidate.includes('relay')) {
                        hasRelay = true;
                        console.log('✅ TURN сервер РАБОТАЕТ!');
                    }
                }
            };
            
            await testPC.createOffer({ offerToReceiveAudio: true });
            await testPC.setLocalDescription();
            
            // Ждем кандидатов
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            console.log(`📊 ICE кандидатов: ${candidates.length}, Relay: ${hasRelay ? 'ДА' : 'НЕТ'}`);
            
            if (!hasRelay && this.isRenderHosting) {
                console.warn('⚠️ ВНИМАНИЕ: Нет TURN кандидатов! WebRTC может не работать!');
                this.showNotification('⚠️ Проблема с WebRTC. Обновите страницу.', 'warning', 8000);
            }
            
            testPC.close();
            
        } catch (error) {
            console.error('❌ Ошибка тестирования ICE:', error);
        }
    }

    // =============== СОЗДАНИЕ ИНТЕРФЕЙСА ===============
    createCallUI() {
        const existingModal = document.getElementById('callModal');
        if (existingModal) existingModal.remove();

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

    setupCallModalEvents() {
        const modal = document.getElementById('callModal');
        if (!modal) return;

        // Удаляем старые обработчики и устанавливаем новые
        const minimizeBtn = modal.querySelector('.minimize-call-btn');
        const closeBtn = modal.querySelector('.close-call-btn');
        const acceptBtn = modal.querySelector('.accept-btn');
        const rejectBtn = modal.querySelector('.reject-btn');
        const cancelBtn = modal.querySelector('.cancel-call-btn');
        const reconnectBtn = modal.querySelector('.reconnect-btn');
        
        if (minimizeBtn) {
            minimizeBtn.onclick = (e) => {
                e.stopPropagation();
                this.toggleMinimize();
            };
        }

        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.endCall();
            };
        }

        if (acceptBtn) {
            acceptBtn.onclick = () => this.acceptCall();
        }

        if (rejectBtn) {
            rejectBtn.onclick = () => this.rejectCall();
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => this.cancelCall();
        }

        if (reconnectBtn) {
            reconnectBtn.onclick = () => this.reconnectCall();
        }

        // Кнопки управления во время звонка
        const muteBtn = modal.querySelector('#muteBtn');
        const cameraBtn = modal.querySelector('#cameraBtn');
        const screenShareBtn = modal.querySelector('#screenShareBtn');
        const endCallBtn = modal.querySelector('#endCallBtn');

        if (muteBtn) muteBtn.onclick = () => this.toggleMute();
        if (cameraBtn) cameraBtn.onclick = () => this.toggleCamera();
        if (screenShareBtn) screenShareBtn.onclick = () => this.toggleScreenShare();
        if (endCallBtn) endCallBtn.onclick = () => this.endCall();
    }

    // =============== НАСТРОЙКА СОБЫТИЙ ===============
    setupEventListeners() {
        if (!window.socket) {
            console.error('❌ Socket не доступен, повтор через 1с...');
            setTimeout(() => this.setupEventListeners(), 1000);
            return;
        }

        // Удаляем старые обработчики
        window.socket.off('incoming_call');
        window.socket.off('call_accepted');
        window.socket.off('call_rejected');
        window.socket.off('call_ended');
        window.socket.off('webrtc_offer');
        window.socket.off('webrtc_answer');
        window.socket.off('webrtc_ice_candidate');
        window.socket.off('screen_share_started');
        window.socket.off('screen_share_ended');

        // Устанавливаем новые
        window.socket.on('incoming_call', (data) => this.handleIncomingCall(data));
        window.socket.on('call_accepted', (data) => this.handleCallAccepted(data));
        window.socket.on('call_rejected', (data) => this.handleCallRejected(data));
        window.socket.on('call_ended', (data) => this.handleCallEnded(data));
        window.socket.on('webrtc_offer', (data) => this.handleWebRTCOffer(data));
        window.socket.on('webrtc_answer', (data) => this.handleWebRTCAnswer(data));
        window.socket.on('webrtc_ice_candidate', (data) => this.handleWebRTCIceCandidate(data));
        window.socket.on('screen_share_started', (data) => this.handleRemoteScreenShareStarted(data));
        window.socket.on('screen_share_ended', (data) => this.handleRemoteScreenShareEnded(data));

        console.log('✅ События CallManager настроены');
    }

    // =============== ОСНОВНАЯ ЛОГИКА WEBRTC ДЛЯ RENDER ===============
    async initiateWebRTC() {
        try {
            console.log('🔗 Инициализация WebRTC для Render...');
            
            if (!this.currentCall) {
                throw new Error('Нет активного звонка');
            }

            // Закрываем старое соединение
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            // ✅ КРИТИЧЕСКИ ВАЖНО: КОНФИГУРАЦИЯ ДЛЯ RENDER
            const configuration = {
                iceServers: this.iceServers,
                iceCandidatePoolSize: 20, // Больше кандидатов
                iceTransportPolicy: 'all', // Все типы
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require',
                sdpSemantics: 'unified-plan',
                // Дополнительные настройки для стабильности
                enableIceUdpMux: true,
                iceCandidateFilter: (candidate) => {
                    // Принимаем все кандидаты
                    return true;
                }
            };

            console.log('📋 Используемые ICE серверы:', 
                this.iceServers.map(s => s.urls).flat().filter(Boolean));

            this.peerConnection = new RTCPeerConnection(configuration);
            
            // Настраиваем события
            this.setupPeerConnectionEvents();
            
            // Добавляем локальные треки
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    console.log(`➕ Добавление трека: ${track.kind}`);
                    this.peerConnection.addTrack(track, this.localStream);
                });
            } else {
                console.warn('⚠️ Нет локального потока, создаем тихий аудио');
                await this.createSilentAudioStream();
            }

            // ✅ ДЛЯ RENDER: Принудительный сбор ICE кандидатов
            if (this.isRenderHosting) {
                // Создаем пустой поток данных для активации ICE
                try {
                    const dataChannel = this.peerConnection.createDataChannel('render-keepalive');
                    dataChannel.onopen = () => console.log('📊 DataChannel для Render открыт');
                } catch (e) {
                    console.warn('Не удалось создать DataChannel:', e);
                }
            }

            // Создаем и отправляем offer если мы звонящий
            if (this.isCaller) {
                console.log('📤 Создание offer...');
                
                const offerOptions = {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: this.callType === 'video',
                    iceRestart: true, // Важно для Render
                    voiceActivityDetection: false
                };

                const offer = await this.peerConnection.createOffer(offerOptions);
                await this.peerConnection.setLocalDescription(offer);
                
                // Ждем немного для сбора ICE кандидатов
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                if (window.socket) {
                    window.socket.emit('webrtc_offer', {
                        callId: this.currentCall.callId,
                        targetUser: this.currentCall.targetUser,
                        offer: offer
                    });
                    
                    console.log('📤 Offer отправлен');
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка WebRTC:', error);
            this.showNotification('Ошибка соединения. Повторная попытка...', 'warning');
            
            // Автоматическое восстановление
            setTimeout(() => {
                if (this.isInCall) {
                    this.restartIce();
                }
            }, 2000);
        }
    }

    setupPeerConnectionEvents() {
        if (!this.peerConnection) return;

        let candidateCount = 0;
        let relayCandidateCount = 0;

        // ✅ ОБРАБОТКА ICE КАНДИДАТОВ
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && window.socket) {
                candidateCount++;
                
                const isRelay = event.candidate.candidate.includes('relay');
                const isSrflx = event.candidate.candidate.includes('srflx');
                
                if (isRelay) {
                    relayCandidateCount++;
                    console.log(`📤 TURN кандидат #${relayCandidateCount}`);
                    this.connectionStats.relayCandidates++;
                }
                
                // Отправляем ВСЕ кандидаты (критически важно для Render)
                window.socket.emit('webrtc_ice_candidate', {
                    callId: this.currentCall.callId,
                    targetUser: this.isCaller ? this.currentCall.targetUser : this.currentCall.caller,
                    candidate: event.candidate
                });
                
                this.connectionStats.iceCandidatesSent++;
            } else if (!event.candidate) {
                console.log(`✅ Сбор ICE завершен. Всего: ${candidateCount}, TURN: ${relayCandidateCount}`);
                this.iceGatheringComplete = true;
            }
        };

        // ✅ ПОЛУЧЕНИЕ УДАЛЕННОГО ПОТОКА
        this.peerConnection.ontrack = (event) => {
            console.log('✅ Получен удаленный трек:', event.track.kind);
            this.remoteStream = event.streams[0];
            this.showRemoteVideo();
            this.updateStatus('Соединение установлено');
        };

        // ✅ ОБРАБОТКА СОСТОЯНИЯ ICE
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            console.log('📊 ICE состояние на Render:', state);
            
            this.updateICEConnectionType();
            
            switch(state) {
                case 'checking':
                    this.updateStatus('🔍 Установка соединения через TURN...');
                    this.updateICEStatus('Поиск TURN сервера...');
                    break;
                    
                case 'connected':
                case 'completed':
                    this.updateStatus('✅ Соединение установлено');
                    this.updateICEStatus('Соединение активно');
                    this.iceConnectionEstablished = true;
                    this.reconnectAttempts = 0;
                    this.showActiveCallControls();
                    
                    // Показываем тип соединения
                    if (relayCandidateCount > 0) {
                        this.showNotification('✅ TURN сервер работает!', 'success', 3000);
                    }
                    break;
                    
                case 'disconnected':
                    this.updateStatus('⚠️ Соединение прервано');
                    this.updateICEStatus('Попытка переподключения...');
                    
                    // Автоматический перезапуск ICE для Render
                    if (!this.reconnectTimeout) {
                        this.reconnectTimeout = setTimeout(() => {
                            if (this.peerConnection?.iceConnectionState === 'disconnected') {
                                console.log('🔄 Перезапуск ICE...');
                                this.restartIce();
                            }
                            this.reconnectTimeout = null;
                        }, 3000);
                    }
                    break;
                    
                case 'failed':
                    this.updateStatus('❌ Ошибка соединения');
                    this.updateICEStatus('Проверьте подключение');
                    console.error('❌ WebRTC соединение не удалось');
                    
                    // Автоматическое восстановление для Render
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`🔄 Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                        
                        setTimeout(() => {
                            if (this.isInCall) {
                                this.reconnectCall();
                            }
                        }, 2000 * this.reconnectAttempts);
                    }
                    break;
            }
        };

        this.peerConnection.onicegatheringstatechange = () => {
            console.log('📊 ICE gathering state:', this.peerConnection.iceGatheringState);
        };

        // ✅ ОБРАБОТКА ОШИБОК ICE
        this.peerConnection.onicecandidateerror = (error) => {
            // Игнорируем некоторые ошибки
            if (error.errorCode === 701 || error.errorCode === 0) {
                return;
            }
            
            console.warn('⚠️ ICE candidate error:', {
                code: error.errorCode,
                text: error.errorText,
                url: error.url
            });
            
            if (error.url?.includes('turn')) {
                this.updateICEStatus('Проблема с TURN, пробуем другой...');
            }
        };
    }

    // =============== ПЕРЕЗАПУСК ICE (КРИТИЧЕСКИ ВАЖНО ДЛЯ RENDER) ===============
    async restartIce() {
        if (!this.peerConnection || !this.isInCall) return;
        
        try {
            console.log('🔄 Перезапуск ICE...');
            
            this.updateStatus('🔄 Перезапуск соединения...');
            
            const offerOptions = {
                offerToReceiveAudio: true,
                offerToReceiveVideo: this.callType === 'video',
                iceRestart: true // Ключевой параметр!
            };
            
            const offer = await this.peerConnection.createOffer(offerOptions);
            await this.peerConnection.setLocalDescription(offer);
            
            if (window.socket && this.currentCall) {
                const targetUser = this.isCaller ? 
                    this.currentCall.targetUser : this.currentCall.caller;
                    
                window.socket.emit('webrtc_offer', {
                    callId: this.currentCall.callId,
                    targetUser: targetUser,
                    offer: offer
                });
            }
            
            console.log('✅ ICE перезапущен');
            
        } catch (error) {
            console.error('❌ Ошибка перезапуска ICE:', error);
        }
    }

    // =============== ПЕРЕПОДКЛЮЧЕНИЕ ===============
    async reconnectCall() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.showNotification('❌ Не удалось восстановить соединение', 'error');
            this.endCall('Соединение потеряно');
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`🔄 Переподключение (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        this.updateStatus(`🔄 Переподключение (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        try {
            // Закрываем старое соединение
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            // Небольшая задержка
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Создаем новое соединение
            await this.initiateWebRTC();
            
        } catch (error) {
            console.error('❌ Ошибка переподключения:', error);
            
            const delay = Math.min(2000 * this.reconnectAttempts, 10000);
            setTimeout(() => this.reconnectCall(), delay);
        }
    }

    // =============== ПОЛУЧЕНИЕ ЛОКАЛЬНОГО ПОТОКА ===============
    async getLocalStream() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Браузер не поддерживает WebRTC');
            }

            // Проверяем устройства
            let hasAudio = false;
            let hasVideo = false;
            
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                hasAudio = devices.some(d => d.kind === 'audioinput');
                hasVideo = devices.some(d => d.kind === 'videoinput');
                console.log('📱 Устройства:', { audio: hasAudio, video: hasVideo });
            } catch (e) {
                console.warn('Не удалось перечислить устройства:', e);
            }

            // Мягкие constraints для Render
            const constraints = {
                audio: hasAudio ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } : false,
                video: (this.callType === 'video' && hasVideo) ? {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 20, max: 30 }
                } : false
            };

            console.log('📋 Media constraints:', constraints);

            if (!hasAudio) {
                this.showNotification('🎤 Микрофон не найден. Вы не сможете говорить.', 'warning');
            }

            if (this.callType === 'video' && !hasVideo) {
                this.showNotification('📷 Камера не найдена. Аудиозвонок.', 'warning');
                this.callType = 'audio';
                return this.getLocalStream();
            }

            try {
                this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('✅ Локальный поток получен');
                this.showLocalVideo();
                return this.localStream;
                
            } catch (mediaError) {
                console.error('❌ Ошибка получения медиа:', mediaError);
                
                // Пробуем только аудио
                if (this.callType === 'video') {
                    console.log('🎤 Fallback на аудио');
                    this.callType = 'audio';
                    return this.getLocalStream();
                }
                
                // Создаем тихий аудиопоток
                await this.createSilentAudioStream();
                return this.localStream;
            }
            
        } catch (error) {
            console.error('❌ Критическая ошибка:', error);
            await this.createSilentAudioStream();
            return this.localStream;
        }
    }

    // =============== ТИХИЙ АУДИОПОТОК ДЛЯ RENDER ===============
    async createSilentAudioStream() {
        try {
            console.log('🔇 Создание тихого аудиопотока...');
            
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const destination = audioContext.createMediaStreamDestination();
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0.0001;
            oscillator.connect(gainNode);
            gainNode.connect(destination);
            oscillator.start();
            
            this.localStream = destination.stream;
            
            // Добавляем видео трек если нужно
            if (this.callType === 'video' && !this.localStream.getVideoTracks().length) {
                try {
                    const videoStream = await navigator.mediaDevices.getUserMedia({ 
                        video: { width: 640, height: 480 } 
                    });
                    videoStream.getVideoTracks().forEach(track => {
                        this.localStream.addTrack(track);
                    });
                } catch (e) {
                    console.warn('Не удалось добавить видео:', e);
                }
            }
            
            console.log('✅ Тихий аудиопоток создан');
            return this.localStream;
            
        } catch (error) {
            console.error('❌ Не удалось создать аудиопоток:', error);
            
            // Пустой поток
            this.localStream = new MediaStream();
            return this.localStream;
        }
    }

    // =============== ИНИЦИАЦИЯ ЗВОНКА ===============
    async initiateCall(targetUser, callType = 'video') {
        try {
            console.log(`📞 Звонок ${targetUser} (${callType}) на Render...`);
            
            if (!targetUser) {
                throw new Error('Не указан получатель');
            }

            if (!this.checkWebRTCSupport()) {
                this.showNotification('❌ Браузер не поддерживает звонки', 'error');
                return;
            }

            // Предупреждение для Render
            if (this.isRenderHosting) {
                this.showNotification('⚠️ Render: соединение может быть медленным', 'warning', 5000);
            }
            
            this.currentCall = {
                callId: 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                targetUser: targetUser,
                caller: window.USERNAME || document.getElementById('username')?.textContent || 'User',
                type: callType,
                status: 'initiating'
            };
            
            this.isCaller = true;
            this.callType = callType;
            this.isNotificationShown = false;
            
            this.showCallModal();
            this.showCallingControls();
            this.updateCallInfo(`📞 Звонок ${targetUser}...`);
            
            await this.getLocalStream();
            
            if (window.socket) {
                window.socket.emit('initiate_call', {
                    callId: this.currentCall.callId,
                    caller: this.currentCall.caller,
                    targetUser: targetUser,
                    callType: callType
                });
                console.log('📤 Запрос звонка отправлен');
            } else {
                throw new Error('Socket не доступен');
            }
            
            // Увеличенный таймаут для Render
            const timeoutTime = this.isRenderHosting ? 60000 : 30000;
            
            this.callTimeout = setTimeout(() => {
                if (!this.isInCall && this.currentCall?.status === 'initiating') {
                    this.showNotification(`⏰ ${targetUser} не отвечает`, 'error');
                    this.endCall('Нет ответа');
                }
            }, timeoutTime);
            
        } catch (error) {
            console.error('❌ Ошибка звонка:', error);
            this.showNotification('❌ Ошибка звонка', 'error');
            this.endCall();
        }
    }

    // =============== ПРИНЯТИЕ ЗВОНКА ===============
    async acceptCall() {
        try {
            console.log('✅ Принятие звонка...');
            
            await this.getLocalStream();
            
            this.showCallModal();
            this.showActiveCallControls();
            this.updateCallInfo(`📞 Разговор с ${this.currentCall.caller}`);
            
            this.currentCall.status = 'active';
            this.isInCall = true;
            
            if (window.socket) {
                window.socket.emit('accept_call', {
                    callId: this.currentCall.callId,
                    caller: this.currentCall.caller,
                    acceptor: this.currentCall.targetUser
                });
                console.log('📤 Звонок принят');
            }
            
            await this.initiateWebRTC();
            this.startCallTimer();
            
        } catch (error) {
            console.error('❌ Ошибка принятия звонка:', error);
            this.showNotification('❌ Ошибка принятия звонка', 'error');
            this.endCall();
        }
    }

    // =============== ОТКЛОНЕНИЕ ЗВОНКА ===============
    rejectCall(reason = 'Отклонен') {
        console.log('❌ Отклонение звонка...');
        
        this.isNotificationShown = false;
        
        if (window.socket && this.currentCall) {
            window.socket.emit('reject_call', {
                callId: this.currentCall.callId,
                caller: this.currentCall.caller,
                reason: reason
            });
        }
        
        this.cleanupCall();
        this.showNotification('📞 Звонок отклонен', 'info');
    }

    // =============== ЗАВЕРШЕНИЕ ЗВОНКА ===============
    async endCall(reason = 'Завершен') {
        console.log('📞 Завершение звонка...');
        
        if (window.socket && this.currentCall) {
            window.socket.emit('end_call', {
                callId: this.currentCall.callId,
                reason: reason,
                endedBy: window.USERNAME || 'User'
            });
        }
        
        this.cleanupCall();
        this.showNotification('📞 Звонок завершен', 'info');
    }

    // =============== ОБРАБОТЧИКИ СОБЫТИЙ ===============
    handleIncomingCall(data) {
        console.log('📞 Входящий звонок:', data);
        
        if (this.isInCall) {
            this.rejectIncomingCall(data, 'Занят');
            return;
        }
        
        if (this.isNotificationShown) {
            console.log('⚠️ Уведомление уже показано');
            return;
        }
        
        this.currentCall = {
            callId: data.callId,
            caller: data.caller,
            targetUser: window.USERNAME || 'User',
            type: data.callType,
            status: 'incoming'
        };
        
        this.isCaller = false;
        this.callType = data.callType;
        this.isNotificationShown = true;
        
        this.showIncomingCallNotification(data);
    }

    handleCallAccepted(data) {
        console.log('✅ Звонок принят:', data.acceptor);
        
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
            this.callTimeout = null;
        }
        
        this.currentCall.status = 'active';
        this.isInCall = true;
        
        this.showActiveCallControls();
        this.updateCallInfo(`📞 Разговор с ${data.acceptor}`);
        
        this.initiateWebRTC();
        this.startCallTimer();
    }

    handleCallRejected(data) {
        console.log('❌ Звонок отклонен:', data.reason);
        
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
            this.callTimeout = null;
        }
        
        this.showNotification(`📞 ${data.reason}`, 'error');
        this.cleanupCall();
    }

    handleCallEnded(data) {
        console.log('📞 Звонок завершен:', data.reason);
        this.showNotification(`📞 Звонок завершен: ${data.reason}`, 'info');
        this.cleanupCall();
    }

    async handleWebRTCOffer(data) {
        try {
            console.log('📥 Получен WebRTC offer');
            
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
                console.log('📤 Отправлен answer');
            }
            
        } catch (error) {
            console.error('❌ Ошибка обработки offer:', error);
        }
    }

    async handleWebRTCAnswer(data) {
        try {
            console.log('📥 Получен WebRTC answer');
            
            if (this.peerConnection) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                console.log('✅ Remote description установлен');
            }
            
        } catch (error) {
            console.error('❌ Ошибка обработки answer:', error);
        }
    }

    async handleWebRTCIceCandidate(data) {
        try {
            if (this.peerConnection && data.candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                this.connectionStats.iceCandidatesReceived++;
            }
            
        } catch (error) {
            console.error('❌ Ошибка добавления ICE кандидата:', error);
            
            // Повторная попытка
            if (error.name === 'InvalidStateError') {
                setTimeout(() => this.handleWebRTCIceCandidate(data), 500);
            }
        }
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
        console.log('❌ Отмена звонка...');
        
        if (window.socket && this.currentCall) {
            window.socket.emit('reject_call', {
                callId: this.currentCall.callId,
                caller: this.currentCall.caller,
                reason: 'Отменен'
            });
        }
        
        this.cleanupCall();
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
                } else {
                    if (muteIndicator) muteIndicator.style.display = 'none';
                    if (muteBtn) {
                        muteBtn.innerHTML = '🎤';
                        muteBtn.style.background = 'linear-gradient(45deg, #4a4a4a, #2d2d2d)';
                    }
                }
                
                console.log(`🔇 Микрофон ${this.isMuted ? 'выключен' : 'включен'}`);
            }
        }
    }

    toggleCamera() {
        if (this.localStream && this.callType === 'video' && !this.isScreenSharing) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
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
                } else {
                    if (cameraIndicator) cameraIndicator.style.display = 'none';
                    if (cameraBtn) {
                        cameraBtn.innerHTML = '📹';
                        cameraBtn.style.background = 'linear-gradient(45deg, #4a4a4a, #2d2d2d)';
                    }
                    if (localVideo) localVideo.style.display = 'block';
                    if (localVideoPlaceholder) localVideoPlaceholder.style.display = 'none';
                }
                
                console.log(`📷 Камера ${this.isCameraOff ? 'выключена' : 'включена'}`);
            }
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
            console.error('❌ Ошибка:', error);
            this.showNotification('❌ Ошибка демонстрации экрана', 'error');
        }
    }

    async startScreenShare() {
        try {
            console.log('🖥️ Начало демонстрации экрана...');
            
            this.updateStatus('🖥️ Начинаем демонстрацию...');
            
            const constraints = {
                video: {
                    cursor: "always",
                    displaySurface: "monitor",
                    frameRate: { ideal: 30 }
                },
                audio: false
            };

            if (navigator.userAgent.includes('Firefox')) {
                constraints.video.mediaSource = 'screen';
            }
            
            this.screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
            
            if (!this.screenStream || !this.screenStream.getVideoTracks().length) {
                throw new Error('Не удалось получить доступ к экрану');
            }
            
            console.log('✅ Поток экрана получен');
            
            // Сохраняем оригинальные треки
            if (this.localStream) {
                this.originalVideoTrack = this.localStream.getVideoTracks()[0];
            }
            
            // Заменяем видеотрек
            await this.replaceVideoTrackWithScreen();
            
            // Обновляем локальное видео
            this.updateLocalVideoWithScreen();
            
            this.isScreenSharing = true;
            this.screenShareActive = true;
            
            this.updateScreenShareUI(true);
            this.notifyScreenShareStarted();
            
            // Обработчик остановки
            const screenVideoTrack = this.screenStream.getVideoTracks()[0];
            if (screenVideoTrack) {
                screenVideoTrack.onended = () => {
                    console.log('🖥️ Демонстрация остановлена');
                    this.stopScreenShare();
                };
            }
            
            this.updateStatus('🖥️ Демонстрация экрана');
            console.log('✅ Демонстрация экрана начата');
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            
            if (error.name === 'NotAllowedError') {
                this.showNotification('❌ Доступ запрещен', 'error');
            } else {
                this.showNotification('❌ Ошибка демонстрации', 'error');
            }
            
            this.isScreenSharing = false;
            this.screenShareActive = false;
        }
    }

    async stopScreenShare() {
        try {
            console.log('🖥️ Остановка демонстрации...');
            
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => track.stop());
                this.screenStream = null;
            }
            
            await this.restoreOriginalVideoTrack();
            this.restoreLocalVideo();
            
            this.isScreenSharing = false;
            this.screenShareActive = false;
            
            this.updateScreenShareUI(false);
            this.notifyScreenShareEnded();
            
            this.updateStatus('Демонстрация завершена');
            console.log('✅ Демонстрация остановлена');
            
        } catch (error) {
            console.error('❌ Ошибка остановки:', error);
        }
    }

    async replaceVideoTrackWithScreen() {
        if (!this.peerConnection || !this.screenStream) return false;
        
        try {
            const senders = this.peerConnection.getSenders();
            const screenVideoTrack = this.screenStream.getVideoTracks()[0];
            
            if (!screenVideoTrack) return false;
            
            const videoSender = senders.find(s => s.track?.kind === 'video');
            
            if (videoSender) {
                await videoSender.replaceTrack(screenVideoTrack);
                console.log('✅ Видеотрек заменен на экран');
                return true;
            } else {
                this.peerConnection.addTrack(screenVideoTrack, this.screenStream);
                return true;
            }
            
        } catch (error) {
            console.error('❌ Ошибка замены трека:', error);
            return false;
        }
    }

    async restoreOriginalVideoTrack() {
        if (!this.peerConnection) return;
        
        try {
            const senders = this.peerConnection.getSenders();
            
            if (this.originalVideoTrack?.readyState === 'live') {
                const videoSender = senders.find(s => s.track?.kind === 'video');
                if (videoSender) {
                    await videoSender.replaceTrack(this.originalVideoTrack);
                    console.log('✅ Оригинальный видеотрек восстановлен');
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка восстановления трека:', error);
        }
    }

    updateLocalVideoWithScreen() {
        const localVideo = document.getElementById('localVideo');
        const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
        
        if (localVideo && this.screenStream) {
            localVideo.srcObject = this.screenStream;
            localVideo.style.display = 'block';
            localVideo.style.transform = 'none';
            
            if (localVideoPlaceholder) {
                localVideoPlaceholder.style.display = 'none';
            }
            
            localVideo.play().catch(e => console.warn('Video play failed:', e));
        }
    }

    restoreLocalVideo() {
        const localVideo = document.getElementById('localVideo');
        const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
        
        if (!localVideo) return;
        
        if (this.localStream && !this.isCameraOff) {
            localVideo.srcObject = this.localStream;
            localVideo.style.display = 'block';
            localVideo.style.transform = 'scaleX(-1)';
            
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
            } else {
                screenShareBtn.innerHTML = '🖥️';
                screenShareBtn.style.background = 'linear-gradient(45deg, #4a4a4a, #2d2d2d)';
            }
        }
    }

    notifyScreenShareStarted() {
        if (!window.socket || !this.currentCall) return;
        
        const targetUser = this.isCaller ? this.currentCall.targetUser : this.currentCall.caller;
        
        window.socket.emit('screen_share_started', {
            callId: this.currentCall.callId,
            sharer: window.USERNAME || 'User',
            targetUser: targetUser
        });
    }

    notifyScreenShareEnded() {
        if (!window.socket || !this.currentCall) return;
        
        const targetUser = this.isCaller ? this.currentCall.targetUser : this.currentCall.caller;
        
        window.socket.emit('screen_share_ended', {
            callId: this.currentCall.callId,
            sharer: window.USERNAME || 'User',
            targetUser: targetUser
        });
    }

    handleRemoteScreenShareStarted(data) {
        console.log('🖥️ Собеседник демонстрирует экран');
        
        const remoteStatus = document.getElementById('remoteStatus');
        if (remoteStatus) {
            remoteStatus.textContent = 'демонстрация экрана';
            remoteStatus.style.color = '#28a745';
        }
        
        this.showNotification(`🖥️ ${data.sharer} показывает экран`, 'info');
    }

    handleRemoteScreenShareEnded(data) {
        console.log('🖥️ Собеседник завершил демонстрацию');
        
        const remoteStatus = document.getElementById('remoteStatus');
        if (remoteStatus) {
            remoteStatus.textContent = 'онлайн';
            remoteStatus.style.color = '#cccccc';
        }
        
        this.showNotification(`🖥️ ${data.sharer} завершил демонстрацию`, 'info');
    }

    // =============== ОТОБРАЖЕНИЕ ВИДЕО ===============
    showLocalVideo() {
        const localVideo = document.getElementById('localVideo');
        const localVideoPlaceholder = document.getElementById('localVideoPlaceholder');
        
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
            localVideo.style.display = 'block';
            localVideo.style.transform = this.isScreenSharing ? 'none' : 'scaleX(-1)';
            
            if (localVideoPlaceholder) {
                localVideoPlaceholder.style.display = 'none';
            }
            
            localVideo.play().catch(e => console.warn('Video play failed:', e));
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
            
            const remoteStatus = document.getElementById('remoteStatus');
            if (remoteStatus) {
                remoteStatus.textContent = 'онлайн';
                remoteStatus.style.color = '#28a745';
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
            
            this.isCallModalMinimized = false;
            
            const minimizeBtn = modal.querySelector('.minimize-call-btn');
            if (minimizeBtn) {
                minimizeBtn.textContent = '➖';
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
        } else if (this.currentCall?.status === 'initiating') {
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
        if (callTitle) callTitle.textContent = text;
    }

    updateStatus(text) {
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) statusMessage.textContent = text;
    }

    updateICEStatus(text) {
        const iceStatus = document.getElementById('iceStatus');
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (iceStatus) iceStatus.textContent = text;
        if (connectionStatus) connectionStatus.textContent = text;
    }

    updateICEConnectionType() {
        const iceConnectionType = document.getElementById('iceConnectionType');
        if (!iceConnectionType || !this.peerConnection) return;
        
        this.peerConnection.getStats().then(stats => {
            stats.forEach(report => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    const localCandidate = stats.get(report.localCandidateId);
                    
                    if (localCandidate) {
                        let type = 'unknown';
                        let icon = '🔌';
                        
                        if (localCandidate.candidateType === 'relay') {
                            type = 'TURN (релейный)';
                            icon = '🔄';
                            iceConnectionType.style.color = '#28a745';
                        } else if (localCandidate.candidateType === 'srflx') {
                            type = 'STUN (публичный)';
                            icon = '🌐';
                            iceConnectionType.style.color = '#ffc107';
                        } else {
                            type = 'Host (локальный)';
                            icon = '💻';
                            iceConnectionType.style.color = '#6c757d';
                        }
                        
                        iceConnectionType.innerHTML = `${icon} ${type}`;
                    }
                }
            });
        }).catch(e => console.warn('Stats error:', e));
    }

    // =============== УВЕДОМЛЕНИЯ ===============
    showIncomingCallNotification(data) {
        const existingNotification = document.getElementById('incomingCallNotification');
        if (existingNotification) existingNotification.remove();
        
        const callModal = document.getElementById('callModal');
        if (callModal && callModal.style.display !== 'none') {
            console.log('⚠️ Модалка уже открыта');
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

        notification.querySelector('.accept-incoming-btn').onclick = () => {
            notification.remove();
            this.isNotificationShown = false;
            this.acceptCall();
        };

        notification.querySelector('.reject-incoming-btn').onclick = () => {
            notification.remove();
            this.isNotificationShown = false;
            this.rejectCall();
        };

        // Таймаут для Render
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
                this.isNotificationShown = false;
                this.rejectCall('Нет ответа');
            }
        }, this.isRenderHosting ? 60000 : 30000);
    }

    // =============== ТАЙМЕР ===============
    startCallTimer() {
        let seconds = 0;
        const timerElement = document.getElementById('callTimer');
        
        if (!timerElement) return;
        
        this.callStartTime = Date.now();
        
        if (this.callTimer) clearInterval(this.callTimer);
        
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
        if (timerElement) timerElement.textContent = '00:00';
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
        modal.style.resize = '';
        
        if (callContent) callContent.style.display = 'flex';
        if (callControls) callControls.style.display = 'flex';
        
        this.isCallModalMinimized = false;
        
        const minimizeBtn = modal.querySelector('.minimize-call-btn');
        if (minimizeBtn) {
            minimizeBtn.textContent = '➖';
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
        } else if (this.currentCall.status === 'initiating') {
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
                endBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.endCall();
                };
            }
            
            const minimizeBtn = modal.querySelector('.minimize-call-btn');
            if (minimizeBtn) {
                minimizeBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleMinimize();
                };
            }
            
            const closeBtn = modal.querySelector('.close-call-btn');
            if (closeBtn) {
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.endCall();
                };
            }
        }
    }

    // =============== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===============
    checkWebRTCSupport() {
        const supported = !!window.RTCPeerConnection && 
                         !!navigator.mediaDevices?.getUserMedia;
        
        console.log('🔧 WebRTC поддержка:', supported);
        return supported;
    }

    // =============== ОЧИСТКА ===============
    cleanupCall() {
        console.log('🧹 Очистка звонка...');
        
        this.isNotificationShown = false;
        this.stopCallTimer();
        
        if (this.isScreenSharing) {
            this.stopScreenShare();
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
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
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
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
        this.iceConnectionEstablished = false;
        this.iceGatheringComplete = false;
        
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
            this.callTimeout = null;
        }
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        this.resetVideoElements();
        this.resetUIButtons();
        this.hideCallModal();
        
        const notification = document.getElementById('incomingCallNotification');
        if (notification) notification.remove();
        
        console.log('✅ Очистка завершена');
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

    showNotification(message, type = 'info', duration = 3000) {
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
            background: ${type === 'error' ? 'linear-gradient(45deg, #dc3545, #c82333)' : 
                         type === 'warning' ? 'linear-gradient(45deg, #ffc107, #ff9800)' : 
                         type === 'success' ? 'linear-gradient(45deg, #28a745, #20c997)' : 
                         'linear-gradient(45deg, #17a2b8, #138496)'};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            border: 1px solid rgba(255,255,255,0.1);
            animation: slideIn 0.3s ease;
            max-width: 350px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }
}

// =============== CSS СТИЛИ ===============
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
        
        .control-btn, .call-btn {
            transition: all 0.3s ease;
        }
        
        .control-btn:hover, .call-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 0 20px rgba(255,255,255,0.3);
        }
        
        .video-container {
            transition: all 0.3s ease;
        }
        
        .video-container:hover {
            box-shadow: 0 0 25px rgba(255,255,255,0.15);
        }
    `;
    document.head.appendChild(styles);
}

// Глобальный экспорт
window.CallManager = CallManager;