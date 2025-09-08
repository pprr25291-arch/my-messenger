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
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
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

    static async getDisplayMedia() {
        try {
            return await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always",
                    displaySurface: "application"
                },
                audio: true
            });
        } catch (error) {
            console.error('Error getting display media:', error);
            throw new Error('Не удалось получить доступ к экрану');
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
}

// Функции для полноэкранного режима :cite[2]:cite[7]:cite[8]
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
            'TypeError': 'Недопустимые параметры'
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
}

// Экспорт классов для глобального использования
window.WebRTCManager = WebRTCManager;
window.FullScreenManager = FullScreenManager;
window.TimeUtils = TimeUtils;
window.WebRTCErrorHandler = WebRTCErrorHandler;
window.generateUUID = generateUUID;