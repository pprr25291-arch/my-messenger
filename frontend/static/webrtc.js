// Файл: webRTC-manager.js
// Расширенный менеджер WebRTC соединений

class WebRTCManager {
    constructor(callManager) {
        this.callManager = callManager;
        this.peerConnections = new Map(); // Несколько соединений для конференц-звонков
        this.dataChannels = new Map(); // Каналы данных для текстовых сообщений в звонке
     this.iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // БЕСПЛАТНЫЙ TURN ОТ METERED.CA (работает отлично)
    {
        urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
];
        console.log('✅ WebRTCManager initialized');
    }

    // Создание нового PeerConnection
    createPeerConnection(callId, targetUser) {
        try {
            const configuration = {
                iceServers: this.iceServers,
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            };
            
            const peerConnection = new RTCPeerConnection(configuration);
            
            // Настройка обработчиков событий
            this.setupPeerConnectionEvents(peerConnection, callId, targetUser);
            
            // Сохраняем соединение
            this.peerConnections.set(callId + '_' + targetUser, {
                connection: peerConnection,
                targetUser: targetUser,
                callId: callId
            });
            
            console.log(`✅ PeerConnection created for ${targetUser}`);
            return peerConnection;
            
        } catch (error) {
            console.error('❌ Error creating PeerConnection:', error);
            throw error;
        }
    }

    // Настройка обработчиков событий PeerConnection
    setupPeerConnectionEvents(peerConnection, callId, targetUser) {
        // ICE кандидаты
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && window.socket) {
                window.socket.emit('webrtc_ice_candidate', {
                    callId: callId,
                    targetUser: targetUser,
                    candidate: event.candidate
                });
            }
        };
        
        // Удаленные треки
        peerConnection.ontrack = (event) => {
            console.log('✅ Remote track received from', targetUser);
            
            const remoteStream = event.streams[0];
            
            // Обработка удаленного потока
            this.callManager.handleRemoteStream(remoteStream, targetUser);
        };
        
        // Изменение состояния ICE соединения
        peerConnection.oniceconnectionstatechange = () => {
            const state = peerConnection.iceConnectionState;
            console.log(`ICE connection state (${targetUser}):`, state);
            
            this.callManager.handleIceStateChange(state, targetUser);
            
            if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                // Попытка восстановления соединения
                setTimeout(() => {
                    if (peerConnection.iceConnectionState === 'disconnected') {
                        console.log(`🔄 Attempting to reconnect to ${targetUser}...`);
                        this.reconnectPeer(callId, targetUser);
                    }
                }, 2000);
            }
        };
        
        // Изменение состояния сигнализации
        peerConnection.onsignalingstatechange = () => {
            console.log(`Signaling state (${targetUser}):`, peerConnection.signalingState);
        };
        
        // Изменение состояния соединения
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state (${targetUser}):`, peerConnection.connectionState);
        };
        
        // Negotiation needed (нужно пересогласование)
        peerConnection.onnegotiationneeded = async () => {
            try {
                console.log(`🔄 Negotiation needed for ${targetUser}`);
                
                if (this.callManager.isCaller) {
                    const offer = await peerConnection.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: this.callManager.callType === 'video'
                    });
                    
                    await peerConnection.setLocalDescription(offer);
                    
                    if (window.socket) {
                        window.socket.emit('webrtc_offer', {
                            callId: callId,
                            targetUser: targetUser,
                            offer: offer
                        });
                    }
                }
            } catch (error) {
                console.error('❌ Error during negotiation:', error);
            }
        };
        
        // Создание канала данных для текстовых сообщений
        this.setupDataChannel(peerConnection, callId, targetUser);
    }

    // Создание канала данных
    setupDataChannel(peerConnection, callId, targetUser) {
        let dataChannel;
        
        if (this.callManager.isCaller) {
            // Создаем канал если мы инициатор
            dataChannel = peerConnection.createDataChannel('chat', {
                ordered: true,
                maxPacketLifeTime: 3000
            });
            
            this.setupDataChannelEvents(dataChannel, targetUser);
        } else {
            // Ожидаем канал от удаленной стороны
            peerConnection.ondatachannel = (event) => {
                dataChannel = event.channel;
                this.setupDataChannelEvents(dataChannel, targetUser);
            };
        }
        
        this.dataChannels.set(targetUser, dataChannel);
    }

    // Настройка обработчиков событий канала данных
    setupDataChannelEvents(dataChannel, targetUser) {
        dataChannel.onopen = () => {
            console.log(`✅ Data channel opened with ${targetUser}`);
            this.callManager.handleDataChannelOpen(targetUser);
        };
        
        dataChannel.onclose = () => {
            console.log(`❌ Data channel closed with ${targetUser}`);
            this.dataChannels.delete(targetUser);
        };
        
        dataChannel.onerror = (error) => {
            console.error(`❌ Data channel error with ${targetUser}:`, error);
        };
        
        dataChannel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.callManager.handleDataChannelMessage(targetUser, data);
            } catch (error) {
                console.error('❌ Error parsing data channel message:', error);
            }
        };
    }

    // Отправка сообщения через канал данных
    sendDataMessage(targetUser, message) {
        const dataChannel = this.dataChannels.get(targetUser);
        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                dataChannel.send(JSON.stringify({
                    type: 'chat_message',
                    message: message,
                    timestamp: new Date().toISOString(),
                    sender: document.getElementById('username')?.textContent
                }));
                return true;
            } catch (error) {
                console.error('❌ Error sending data message:', error);
                return false;
            }
        }
        return false;
    }

    // Добавление локального медиапотока в соединение
    async addLocalStreamToConnection(peerConnection, localStream) {
        if (!localStream) return;
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        console.log('✅ Local stream added to PeerConnection');
    }

    // Обработка WebRTC предложения (offer)
    async handleOffer(callId, fromUser, offer) {
        try {
            let peerConnection = this.peerConnections.get(callId + '_' + fromUser)?.connection;
            
            if (!peerConnection) {
                peerConnection = this.createPeerConnection(callId, fromUser);
                
                // Добавляем локальный поток
                if (this.callManager.localStream) {
                    await this.addLocalStreamToConnection(peerConnection, this.callManager.localStream);
                }
            }
            
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Создаем ответ
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            if (window.socket) {
                window.socket.emit('webrtc_answer', {
                    callId: callId,
                    targetUser: fromUser,
                    answer: answer
                });
            }
            
            console.log(`✅ Answer sent to ${fromUser}`);
            
        } catch (error) {
            console.error('❌ Error handling offer:', error);
            throw error;
        }
    }

    // Обработка WebRTC ответа (answer)
    async handleAnswer(callId, fromUser, answer) {
        try {
            const peerConnection = this.peerConnections.get(callId + '_' + fromUser)?.connection;
            
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log(`✅ Answer processed from ${fromUser}`);
            }
            
        } catch (error) {
            console.error('❌ Error handling answer:', error);
        }
    }

    // Обработка ICE кандидата
    async handleIceCandidate(callId, fromUser, candidate) {
        try {
            const peerConnection = this.peerConnections.get(callId + '_' + fromUser)?.connection;
            
            if (peerConnection && candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
            
        } catch (error) {
            console.error('❌ Error handling ICE candidate:', error);
        }
    }

    // Переподключение при обрыве соединения
    async reconnectPeer(callId, targetUser) {
        try {
            const peerData = this.peerConnections.get(callId + '_' + targetUser);
            if (!peerData) return;
            
            const { connection: oldConnection } = peerData;
            
            // Создаем новое соединение
            const newConnection = this.createPeerConnection(callId, targetUser);
            
            // Добавляем локальный поток
            if (this.callManager.localStream) {
                await this.addLocalStreamToConnection(newConnection, this.callManager.localStream);
            }
            
            // Если мы инициатор, создаем новое предложение
            if (this.callManager.isCaller) {
                const offer = await newConnection.createOffer();
                await newConnection.setLocalDescription(offer);
                
                if (window.socket) {
                    window.socket.emit('webrtc_offer', {
                        callId: callId,
                        targetUser: targetUser,
                        offer: offer
                    });
                }
            }
            
            // Закрываем старое соединение
            oldConnection.close();
            
            console.log(`✅ Reconnection attempt for ${targetUser}`);
            
        } catch (error) {
            console.error('❌ Error reconnecting peer:', error);
        }
    }

    // Замена видеотрека (для демонстрации экрана)
    async replaceVideoTrack(targetUser, newTrack) {
        try {
            const peerData = this.peerConnections.get(this.callManager.currentCall.callId + '_' + targetUser);
            if (!peerData) return;
            
            const { connection: peerConnection } = peerData;
            const senders = peerConnection.getSenders();
            const videoSender = senders.find(sender => sender.track?.kind === 'video');
            
            if (videoSender) {
                await videoSender.replaceTrack(newTrack);
                console.log(`✅ Video track replaced for ${targetUser}`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ Error replacing video track:', error);
            return false;
        }
    }

    // Получение статистики соединения
    async getConnectionStats(targetUser) {
        try {
            const peerData = this.peerConnections.get(this.callManager.currentCall.callId + '_' + targetUser);
            if (!peerData) return null;
            
            const { connection: peerConnection } = peerData;
            const stats = await peerConnection.getStats();
            
            const connectionStats = {
                timestamp: new Date().toISOString(),
                inbound: {},
                outbound: {}
            };
            
            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
                    connectionStats.inbound.video = {
                        bytesReceived: report.bytesReceived,
                        packetsReceived: report.packetsReceived,
                        packetsLost: report.packetsLost,
                        jitter: report.jitter,
                        frameWidth: report.frameWidth,
                        frameHeight: report.frameHeight,
                        framesPerSecond: report.framesPerSecond
                    };
                } else if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
                    connectionStats.outbound.video = {
                        bytesSent: report.bytesSent,
                        packetsSent: report.packetsSent
                    };
                } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    connectionStats.candidatePair = {
                        currentRoundTripTime: report.currentRoundTripTime,
                        availableOutgoingBitrate: report.availableOutgoingBitrate,
                        availableIncomingBitrate: report.availableIncomingBitrate
                    };
                }
            });
            
            return connectionStats;
            
        } catch (error) {
            console.error('❌ Error getting connection stats:', error);
            return null;
        }
    }

    // Очистка всех соединений
    cleanup() {
        // Закрываем все PeerConnection
        this.peerConnections.forEach((peerData, key) => {
            if (peerData.connection) {
                peerData.connection.close();
            }
        });
        
        // Очищаем карты
        this.peerConnections.clear();
        this.dataChannels.clear();
        
        console.log('✅ WebRTCManager cleanup completed');
    }
}

// Экспортируем класс для глобального использования
window.WebRTCManager = WebRTCManager;