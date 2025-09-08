// Вспомогательные функции для WebRTC
class WebRTCManager {
    static async getLocalStream(video = true, audio = true) {
        try {
            return await navigator.mediaDevices.getUserMedia({
                video: video ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 24 }
                } : false,
                audio: audio ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } : false
            });
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw new Error('Не удалось получить доступ к камере/микрофону');
        }
    }

    static async getDisplayMedia(options = {}) {
        try {
            const defaultOptions = {
                video: {
                    cursor: "always",
                    displaySurface: "monitor"
                },
                audio: true
            };

            const mergedOptions = {
                video: { ...defaultOptions.video, ...options.video },
                audio: options.audio !== undefined ? options.audio : defaultOptions.audio
            };

            return await navigator.mediaDevices.getDisplayMedia(mergedOptions);
        } catch (error) {
            console.error('Error accessing display media:', error);
            throw new Error('Не удалось получить доступ к экрану');
        }
    }

    static createPeerConnection(iceServers = null) {
        const configuration = {
            iceServers: iceServers || [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };

        return new RTCPeerConnection(configuration);
    }

    static async createOffer(peerConnection) {
        try {
            const offer = await peerConnection.createOffer({
                offerToReceiveVideo: true,
                offerToReceiveAudio: true,
                voiceActivityDetection: true
            });
            await peerConnection.setLocalDescription(offer);
            return offer;
        } catch (error) {
            console.error('Error creating offer:', error);
            throw error;
        }
    }

    static async createAnswer(peerConnection, offer) {
        try {
            await peerConnection.setRemoteDescription(offer);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            return answer;
        } catch (error) {
            console.error('Error creating answer:', error);
            throw error;
        }
    }

    static async addIceCandidate(peerConnection, candidate) {
        try {
            await peerConnection.addIceCandidate(candidate);
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    static stopStream(stream) {
        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
        }
    }

    static async checkMediaPermissions() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideo = devices.some(device => device.kind === 'videoinput');
            const hasAudio = devices.some(device => device.kind === 'audioinput');
            
            return { hasVideo, hasAudio };
        } catch (error) {
            console.error('Error checking media devices:', error);
            return { hasVideo: false, hasAudio: false };
        }
    }

    static async checkScreenSharePermissions() {
        try {
            // Попытка запросить доступ к экрану (будет показан диалог выбора)
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: true,
                audio: false 
            });
            this.stopStream(stream);
            return true;
        } catch (error) {
            console.error('Screen share permission denied:', error);
            return false;
        }
    }

    static getScreenShareConstraints(quality = 'medium') {
        const qualityPresets = {
            low: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 15 },
                bitrate: 500000
            },
            medium: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 24 },
                bitrate: 1000000
            },
            high: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 },
                bitrate: 2500000
            },
            ultra: {
                width: { ideal: 3840 },
                height: { ideal: 2160 },
                frameRate: { ideal: 30 },
                bitrate: 5000000
            }
        };

        return qualityPresets[quality] || qualityPresets.medium;
    }

    static async getDisplayMediaWithQuality(quality = 'medium') {
        try {
            const constraints = this.getScreenShareConstraints(quality);
            return await navigator.mediaDevices.getDisplayMedia({
                video: constraints,
                audio: true
            });
        } catch (error) {
            console.error('Error accessing display media with quality:', error);
            throw error;
        }
    }

    static toggleTrack(stream, kind, enabled) {
        const tracks = stream.getTracks().filter(track => track.kind === kind);
        tracks.forEach(track => {
            track.enabled = enabled;
        });
        return enabled;
    }

    static replaceTrack(peerConnection, sender, newTrack) {
        if (sender && newTrack) {
            return sender.replaceTrack(newTrack);
        }
        return Promise.resolve();
    }

    static async captureScreenFrame(stream, format = 'image/png', quality = 0.92) {
        return new Promise((resolve, reject) => {
            try {
                const video = document.createElement('video');
                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    video.play();
                    
                    setTimeout(() => {
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        
                        const imageData = canvas.toDataURL(format, quality);
                        resolve(imageData);
                        
                        // Очистка
                        video.srcObject = null;
                    }, 100);
                };
                
                video.onerror = reject;
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Функции для полноэкранного режима 
class FullScreenManager {
    static requestFullscreen(element) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    static exitFullscreen() {
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

    static toggleFullscreen(element) {
        if (!document.fullscreenElement &&
            !document.mozFullScreenElement &&
            !document.webkitFullscreenElement &&
            !document.msFullscreenElement) {
            this.requestFullscreen(element);
        } else {
            this.exitFullscreen();
        }
    }

    static isFullscreen() {
        return !!(document.fullscreenElement ||
            document.mozFullScreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement);
    }

    static addFullscreenChangeListener(callback) {
        const events = [
            'fullscreenchange',
            'mozfullscreenchange',
            'webkitfullscreenchange',
            'msfullscreenchange'
        ];

        events.forEach(event => {
            document.addEventListener(event, callback);
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, callback);
            });
        };
    }
}

// Утилиты для работы со временем
class TimeUtils {
    static formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    static createTimer(callback, interval = 1000) {
        let startTime = Date.now();
        let timerId = null;

        const start = () => {
            timerId = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                callback(elapsed);
            }, interval);
        };

        const stop = () => {
            if (timerId) {
                clearInterval(timerId);
                timerId = null;
            }
        };

        const reset = () => {
            stop();
            startTime = Date.now();
        };

        return { start, stop, reset };
    }
}

// Генерация UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Обработка ошибок WebRTC
class WebRTCErrorHandler {
    static handleError(error, context = 'WebRTC operation') {
        console.error(`${context} failed:`, error);
        
        const errorMap = {
            'NotAllowedError': 'Доступ к камере/микрофону запрещен',
            'NotFoundError': 'Не удалось найти запрашиваемое медиаустройство',
            'NotReadableError': 'Не удалось получить доступ к медиаустройству',
            'OverconstrainedError': 'Ограничения не могут быть удовлетворены',
            'SecurityError': 'Доступ к медиаустройству заблокирован по соображениям безопасности',
            'TypeError': 'Недопустимые параметры',
            'AbortError': 'Операция прервана',
            'NotSupportedError': 'Операция не поддерживается'
        };

        const message = errorMap[error.name] || `Ошибка ${context}: ${error.message}`;
        
        return {
            success: false,
            error: message,
            originalError: error
        };
    }

    static isPermissionDenied(error) {
        return error.name === 'NotAllowedError';
    }

    static isDeviceNotFound(error) {
        return error.name === 'NotFoundError';
    }

    static isConstraintError(error) {
        return error.name === 'OverconstrainedError';
    }
}

// Экспорт классов для глобального использования
window.WebRTCManager = WebRTCManager;
window.FullScreenManager = FullScreenManager;
window.TimeUtils = TimeUtils;
window.WebRTCErrorHandler = WebRTCErrorHandler;
window.generateUUID = generateUUID;