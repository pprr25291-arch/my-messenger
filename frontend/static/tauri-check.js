// Проверяем, запущены ли мы в Tauri
window.isTauri = typeof window.__TAURI__ !== 'undefined';

// Функция для определения URL подключения
function getServerUrl() {
    if (window.isTauri) {
        // В Tauri используем Render URL
        return 'https://my-messenger-9g2n.onrender.com';
    } else {
        // В веб-версии используем текущий хост
        return window.location.origin;
    }
}

// Переопределяем функцию инициализации socket для Tauri
function initSocketForTauri() {
    const serverUrl = getServerUrl();
    
    try {
        socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            path: '/socket.io/'
        });

        console.log(`🚀 Connected to server: ${serverUrl}`);
        
        // Остальная логика остается как в оригинальном chat.js
        window.socket = socket;

        socket.on('connect', () => {
            console.log('✅ Connected to server via Tauri');
            // ... остальная логика подключения
        });

        // Все остальные обработчики событий остаются теми же
        return socket;
        
    } catch (error) {
        console.error('❌ Failed to initialize socket in Tauri:', error);
        return null;
    }
}

// Экспортируем функции
window.getServerUrl = getServerUrl;
window.initSocketForTauri = initSocketForTauri;