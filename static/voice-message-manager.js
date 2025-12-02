class VoiceMessageManager {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingStartTime = 0;
        this.recordingTimer = null;
        this.recordedBlob = null;
        this.holdTimer = null;
        this.isHolding = false;
        this.maxRecordingTime = 60000;
        this.minRecordingTime = 1000;
        this.recordingIndicator = null;
        this.lockRecording = false;
        
        this.init();
    }

    init() {
        this.createRecordingIndicator();
        this.setupVoiceMessageButton();
        this.setupGlobalEventListeners();
    }

    setupVoiceMessageButton() {
        // Обработчик для кнопок голосовых сообщений
        document.addEventListener('click', (e) => {
            const voiceBtn = e.target.closest('.voice-message-btn') || 
                           e.target.closest('.group-voice-message-btn');
            if (voiceBtn) {
                e.preventDefault();
                e.stopPropagation();
                this.handleVoiceButtonClick(voiceBtn);
            }
        });
    }

    handleVoiceButtonClick(button) {
        if (this.isRecording) {
            this.stopRecording();
            return;
        }

        // Добавляем класс активации для визуальной обратной связи
        button.classList.add('voice-btn-active');
        
        // Начинаем слушать события мыши/тача
        this.startListeningForHold(button);
    }

    startListeningForHold(button) {
        const endHold = (e) => {
            // Предотвращаем стандартное поведение для тача
            if (e.type === 'touchend') {
                e.preventDefault();
            }
            this.endHold();
            button.classList.remove('voice-btn-active');
            this.removeHoldListeners();
        };

        const cancelHold = (e) => {
            if (this.isHolding && !this.isRecording) {
                this.showNotification('Запись отменена', 'info');
            }
            this.endHold();
            button.classList.remove('voice-btn-active');
            this.removeHoldListeners();
        };

        // Добавляем обработчики для удержания
        document.addEventListener('mouseup', endHold);
        document.addEventListener('touchend', endHold, { passive: false });
        document.addEventListener('mouseleave', cancelHold);
        document.addEventListener('touchcancel', cancelHold);

        // Сохраняем ссылки для удаления
        this.currentHoldListeners = { endHold, cancelHold };
        this.currentButton = button;

        // Начинаем отсчет удержания
        this.startHold();
    }

    removeHoldListeners() {
        if (this.currentHoldListeners) {
            document.removeEventListener('mouseup', this.currentHoldListeners.endHold);
            document.removeEventListener('touchend', this.currentHoldListeners.endHold);
            document.removeEventListener('mouseleave', this.currentHoldListeners.cancelHold);
            document.removeEventListener('touchcancel', this.currentHoldListeners.cancelHold);
            this.currentHoldListeners = null;
        }
        
        if (this.currentButton) {
            this.currentButton.classList.remove('voice-btn-active');
            this.currentButton = null;
        }
    }

    startHold() {
        if (this.isRecording) return;

        this.isHolding = true;
        
        // Задержка перед началом записи
        this.holdTimer = setTimeout(() => {
            if (this.isHolding) {
                this.startRecording();
            }
        }, 300);
    }

    endHold() {
        this.isHolding = false;
        
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }

        if (this.isRecording) {
            this.stopRecording();
        }
        
        this.removeHoldListeners();
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 44100
                } 
            });

            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.handleRecordingComplete();
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            this.showRecordingIndicator();
            this.startRecordingTimer();

            // Обновляем кнопку
            if (this.currentButton) {
                this.currentButton.classList.add('voice-recording');
                this.currentButton.classList.remove('voice-btn-active');
            }

        } catch (error) {
            console.error('Recording error:', error);
            this.showError('Ошибка доступа к микрофону');
            this.endHold();
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.stopRecordingTimer();
            this.hideRecordingIndicator();
            
            // Восстанавливаем кнопку
            if (this.currentButton) {
                this.currentButton.classList.remove('voice-recording');
            }
        }
    }

    createRecordingIndicator() {
        // Создаем индикатор записи в стиле Telegram
        this.recordingIndicator = document.createElement('div');
        this.recordingIndicator.className = 'voice-recording-indicator';
        this.recordingIndicator.innerHTML = `
            <div class="voice-recording-content">
                <div class="voice-recording-left">
                    <div class="recording-animation">
                        <div class="recording-dot"></div>
                        <div class="recording-bars">
                            <div class="bar"></div>
                            <div class="bar"></div>
                            <div class="bar"></div>
                            <div class="bar"></div>
                            <div class="bar"></div>
                        </div>
                    </div>
                    <div class="recording-info">
                        <div class="recording-title">Запись голосового сообщения</div>
                        <div class="recording-timer">0:00</div>
                    </div>
                </div>
                <div class="voice-recording-right">
                    <button class="send-voice-btn" title="Отправить">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                    <button class="cancel-voice-btn" title="Отменить">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.recordingIndicator);
        
        // Добавляем обработчики для кнопок
        this.setupRecordingControls();
    }

    setupRecordingControls() {
        const sendBtn = this.recordingIndicator.querySelector('.send-voice-btn');
        const cancelBtn = this.recordingIndicator.querySelector('.cancel-voice-btn');

        sendBtn?.addEventListener('click', () => {
            if (this.isRecording) {
                this.stopRecording();
            }
        });

        cancelBtn?.addEventListener('click', () => {
            this.cancelRecording();
        });
    }

    showRecordingIndicator() {
        if (this.recordingIndicator) {
            this.recordingIndicator.classList.add('active');
            this.updateRecordingTimer();
            
            // Позиционируем индикатор рядом с кнопкой если возможно
            this.positionIndicator();
        }
    }

    positionIndicator() {
        if (!this.currentButton || !this.recordingIndicator) return;

        const rect = this.currentButton.getBoundingClientRect();
        const indicator = this.recordingIndicator.querySelector('.voice-recording-content');
        
        // Позиционируем индикатор над кнопкой
        this.recordingIndicator.style.position = 'fixed';
        this.recordingIndicator.style.bottom = '100px';
        this.recordingIndicator.style.left = '50%';
        this.recordingIndicator.style.transform = 'translateX(-50%)';
    }

    hideRecordingIndicator() {
        if (this.recordingIndicator) {
            this.recordingIndicator.classList.remove('active');
        }
    }

    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            this.updateRecordingTimer();
            
            // Автоматическая остановка при достижении лимита
            const elapsed = Date.now() - this.recordingStartTime;
            if (elapsed >= this.maxRecordingTime) {
                this.stopRecording();
            }
        }, 1000);
    }

    updateRecordingTimer() {
        if (!this.recordingIndicator) return;
        
        const elapsed = Date.now() - this.recordingStartTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        const timerElement = this.recordingIndicator.querySelector('.recording-timer');
        if (timerElement) {
            timerElement.textContent = 
                `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    handleRecordingComplete() {
        const duration = Date.now() - this.recordingStartTime;
        
        if (duration >= this.minRecordingTime) {
            this.sendVoiceMessage();
        } else {
            this.showError('Запись слишком короткая');
        }
    }

    cancelRecording() {
        this.stopRecording();
        this.recordedBlob = null;
        this.showNotification('Запись отменена', 'info');
    }

    async sendVoiceMessage() {
        if (!this.recordedBlob) {
            this.showError('Нет записанного сообщения');
            return;
        }

        const duration = Date.now() - this.recordingStartTime;
        if (duration < this.minRecordingTime) {
            this.showError('Сообщение слишком короткое');
            return;
        }

        try {
            const formData = new FormData();
            const filename = `voice_message_${Date.now()}.webm`;
            
            const voiceFile = new File([this.recordedBlob], filename, {
                type: 'audio/webm'
            });
            
            formData.append('file', voiceFile);

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
            
            this.sendVoiceToChat(result.file, duration);
            this.showNotification('Голосовое сообщение отправлено', 'success');
            
        } catch (error) {
            console.error('Error sending voice message:', error);
            this.showError('Ошибка отправки голосового сообщения');
        }
    }

    sendVoiceToChat(fileData, duration) {
        const currentUser = document.getElementById('username')?.textContent;
        let targetChat = null;
        let isGroup = false;

        // Определяем тип чата
        if (window.privateChatInstance?.currentChat) {
            targetChat = window.privateChatInstance.currentChat;
            isGroup = false;
        } else if (window.groupChatManager?.currentGroup) {
            targetChat = window.groupChatManager.currentGroup.id;
            isGroup = true;
        }

        if (!currentUser || !targetChat) {
            this.showError('Не выбран чат для отправки');
            return;
        }

        const voiceMessageData = {
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
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        };

        // Добавляем получателя
        if (isGroup) {
            voiceMessageData.groupId = targetChat;
        } else {
            voiceMessageData.receiver = targetChat;
        }

        if (window.socket) {
            if (isGroup) {
                window.socket.emit('group_message', voiceMessageData);
            } else {
                window.socket.emit('private message', voiceMessageData);
            }
        } else {
            console.error('Socket not available');
            this.showError('Нет соединения с сервером');
            return;
        }

        // Отображаем сообщение локально
        if (!isGroup && window.privateChatInstance) {
            window.privateChatInstance.displayMessage(voiceMessageData, true);
        } else if (isGroup && window.groupChatManager) {
            window.groupChatManager.displayGroupMessage(voiceMessageData, true);
        }
    }

    setupGlobalEventListeners() {
        // Запрещаем контекстное меню на кнопках записи
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.voice-message-btn') || 
                e.target.closest('.group-voice-message-btn')) {
                e.preventDefault();
            }
        });

        // Останавливаем запись при потере фокуса
        window.addEventListener('blur', () => {
            if (this.isRecording) {
                this.stopRecording();
            }
        });

        // Обработка клавиши Escape для отмены записи
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isRecording) {
                this.cancelRecording();
            }
        });
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `voice-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    forceStopRecording() {
        if (this.isRecording) {
            this.stopRecording();
            this.showNotification('Запись остановлена', 'info');
        }
    }
}
// Добавляем CSS стили в стиле Telegram
function addVoiceMessageStyles() {
    if (!document.getElementById('voice-message-styles')) {
        const styles = document.createElement('style');
        styles.id = 'voice-message-styles';
        styles.textContent = `
            /* Стили для кнопки голосовых сообщений */
            .voice-message-btn, .group-voice-message-btn {
                transition: all 0.2s ease;
                position: relative;
                overflow: hidden;
                cursor: pointer;
                border: none;
                background: transparent;
                padding: 8px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .voice-message-btn:hover, 
            .group-voice-message-btn:hover {
                background: rgba(0, 0, 0, 0.05);
            }

            .voice-message-btn:active, 
            .group-voice-message-btn:active,
            .voice-btn-active {
                transform: scale(0.95);
                background: #0088cc !important;
                color: white !important;
            }

            .voice-recording {
                background: #ff3b30 !important;
                color: white !important;
                animation: pulse 1.5s ease-in-out infinite;
            }

            /* Индикатор записи в стиле Telegram */
            .voice-recording-indicator {
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: white;
                border-radius: 16px;
                padding: 12px 16px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                border: 1px solid #e0e0e0;
                min-width: 300px;
                max-width: 90vw;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 10000;
            }

            .voice-recording-indicator.active {
                opacity: 1;
                visibility: visible;
                transform: translateX(-50%) translateY(0);
            }

            .voice-recording-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }

            .voice-recording-left {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
            }

            .recording-animation {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .recording-dot {
                width: 12px;
                height: 12px;
                background: #ff3b30;
                border-radius: 50%;
                animation: recordingDot 1.5s ease-in-out infinite;
            }

            .recording-bars {
                display: flex;
                align-items: center;
                gap: 2px;
                height: 20px;
            }

            .recording-bars .bar {
                width: 3px;
                background: #0088cc;
                border-radius: 2px;
                animation: recordingBars 1.5s ease-in-out infinite;
            }

            .recording-bars .bar:nth-child(1) { animation-delay: 0.1s; height: 8px; }
            .recording-bars .bar:nth-child(2) { animation-delay: 0.2s; height: 12px; }
            .recording-bars .bar:nth-child(3) { animation-delay: 0.3s; height: 16px; }
            .recording-bars .bar:nth-child(4) { animation-delay: 0.4s; height: 12px; }
            .recording-bars .bar:nth-child(5) { animation-delay: 0.5s; height: 8px; }

            .recording-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .recording-title {
                font-size: 14px;
                color: #666;
                font-weight: 500;
            }

            .recording-timer {
                font-size: 16px;
                font-weight: 600;
                color: #333;
                font-family: 'Courier New', monospace;
            }

            .voice-recording-right {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .send-voice-btn, .cancel-voice-btn {
                background: transparent;
                border: none;
                padding: 8px;
                border-radius: 50%;
                cursor: pointer;
                color: #0088cc;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s ease;
            }

            .send-voice-btn:hover, .cancel-voice-btn:hover {
                background: rgba(0, 136, 204, 0.1);
            }

            .cancel-voice-btn {
                color: #ff3b30;
            }

            .cancel-voice-btn:hover {
                background: rgba(255, 59, 48, 0.1);
            }

            /* Уведомления */
            .voice-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10010;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                background: #333;
                max-width: 300px;
                word-wrap: break-word;
            }

            .voice-notification.error {
                background: #ff3b30;
            }

            .voice-notification.success {
                background: #4cd964;
            }

            .voice-notification.info {
                background: #007aff;
            }

            /* Анимации */
            @keyframes recordingDot {
                0%, 100% {
                    opacity: 1;
                    transform: scale(1);
                }
                50% {
                    opacity: 0.5;
                    transform: scale(0.8);
                }
            }

            @keyframes recordingBars {
                0%, 100% {
                    transform: scaleY(0.8);
                }
                50% {
                    transform: scaleY(1.2);
                }
            }

            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.7;
                }
            }

            /* Адаптивность для мобильных */
            @media (max-width: 768px) {
                .voice-recording-indicator {
                    bottom: 80px;
                    min-width: 280px;
                    padding: 10px 14px;
                }

                .voice-recording-content {
                    gap: 12px;
                }

                .recording-title {
                    font-size: 13px;
                }

                .recording-timer {
                    font-size: 15px;
                }
            }

            /* Темная тема */
            @media (prefers-color-scheme: dark) {
                .voice-recording-indicator {
                    background: #2c2c2e;
                    border-color: #3a3a3c;
                    color: white;
                }

                .recording-title {
                    color: #98989f;
                }

                .recording-timer {
                    color: white;
                }

                .voice-message-btn:hover, 
                .group-voice-message-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
            }
        `;
        document.head.appendChild(styles);
    }
}
document.addEventListener('DOMContentLoaded', function() {
    addVoiceMessageStyles();
    
    if (!window.voiceMessageManager) {
        window.voiceMessageManager = new VoiceMessageManager();
    }
});