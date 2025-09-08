let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function initSocket() {
    try {
        // Явно указываем транспорты и настройки
        socket = io({
            transports: ['websocket', 'polling'],
            upgrade: true,
            reconnection: true,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });

        window.socket = socket;

        // Обработчики событий socket.io
        socket.on('connect', () => {
            console.log('Connected to server');
            reconnectAttempts = 0;
            
            const username = document.getElementById('username')?.textContent;
            if (username) {
                socket.emit('user authenticated', username);
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            showConnectionStatus('Отключено от сервера', 'error');
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            reconnectAttempts++;
            
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                showConnectionStatus('Не удалось подключиться к серверу', 'error');
            } else {
                showConnectionStatus(`Переподключение... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, 'warning');
            }
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log('Reconnected after', attemptNumber, 'attempts');
            showConnectionStatus('Подключено', 'success');
        });

        socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('Reconnection attempt:', attemptNumber);
        });

        socket.on('reconnect_error', (error) => {
            console.error('Reconnection error:', error);
        });

        socket.on('reconnect_failed', () => {
            console.error('Reconnection failed');
            showConnectionStatus('Не удалось восстановить соединение', 'error');
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
            showConnectionStatus('Ошибка соединения', 'error');
        });

        // Обработка сообщений
        socket.on('chat message', (data) => {
            if (data.type === 'global') {
                displayMessage(data, true);
            }
        });

    } catch (error) {
        console.error('Failed to initialize socket:', error);
        showConnectionStatus('Ошибка инициализации соединения', 'error');
    }
}

function showConnectionStatus(message, type = 'info') {
    // Создаем или обновляем элемент статуса
    let statusElement = document.getElementById('connectionStatus');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'connectionStatus';
        statusElement.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px 15px;
            border-radius: 5px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            max-width: 300px;
            text-align: center;
        `;
        document.body.appendChild(statusElement);
    }

    const colors = {
        error: '#dc3545',
        warning: '#ffc107',
        success: '#28a745',
        info: '#17a2b8'
    };

    statusElement.textContent = message;
    statusElement.style.background = colors[type] || colors.info;
    
    // Автоматически скрываем через 5 секунд, если не ошибка
    if (type !== 'error') {
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }
}

function switchToGlobal() {
    const globalChat = document.getElementById('globalChat');
    const privateChat = document.getElementById('privateChat');
    const globalBtn = document.getElementById('globalBtn');
    const privateBtn = document.getElementById('privateBtn');
    
    if (globalChat) globalChat.style.display = 'block';
    if (privateChat) privateChat.style.display = 'none';
    if (globalBtn) globalBtn.classList.add('active');
    if (privateBtn) privateBtn.classList.remove('active');
    
    scrollToBottom('messages');
}

function switchToPrivate() {
    const globalChat = document.getElementById('globalChat');
    const privateChat = document.getElementById('privateChat');
    const globalBtn = document.getElementById('globalBtn');
    const privateBtn = document.getElementById('privateBtn');
    
    if (globalChat) globalChat.style.display = 'none';
    if (privateChat) privateChat.style.display = 'block';
    if (globalBtn) globalBtn.classList.remove('active');
    if (privateBtn) privateBtn.classList.add('active');
    
    if (window.privateChatInstance && window.privateChatInstance.currentChat) {
        window.privateChatInstance.scrollToBottom();
    }
}

function logout() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => window.location.href = '/')
        .catch(() => window.location.href = '/');
}

function scrollToBottom(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function isAtBottom(container) {
    if (!container) return false;
    return container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
}

function formatMessageText(text) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach(word => {
        if ((currentLine + word).length > 20) {
            if (currentLine) {
                lines.push(currentLine);
            }
            currentLine = word;
        } else {
            currentLine = currentLine ? currentLine + ' ' + word : word;
        }
    });

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.join('<br>');
}

function loadMessageHistory() {
    fetch('/api/messages/global')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load messages');
            }
            return response.json();
        })
        .then(messagesData => {
            const messagesContainer = document.getElementById('messages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
                messagesData.forEach(message => displayMessage(message, false));
                scrollToBottom('messages');
            }
        })
        .catch(error => {
            console.error('Error loading message history:', error);
            showConnectionStatus('Ошибка загрузки сообщений', 'error');
        });
}

function displayMessage(data, isNew = false) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    
    const username = document.getElementById('username')?.textContent;
    if (data.username === username) {
        messageElement.classList.add('own');
    }
    
    const formattedMessage = formatMessageText(data.message);
    
    messageElement.innerHTML = `
        <div class="message-header">
            <strong>${data.username}</strong>
            <span class="message-time">${data.timestamp}</span>
        </div>
        <div class="message-text">${formattedMessage}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
    
    if (isAtBottom(messagesContainer) || isNew) {
        setTimeout(() => scrollToBottom('messages'), 50);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');

    // Инициализируем socket.io
    initSocket();

    // Загружаем историю сообщений
    setTimeout(() => {
        loadMessageHistory();
        scrollToBottom('messages');
    }, 300);

    // Обработка отправки сообщений
    if (messageForm) {
        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!messageInput) return;
            
            const messageText = messageInput.value.trim();
            const username = document.getElementById('username')?.textContent;
            
            if (messageText && username && socket && socket.connected) {
                socket.emit('chat message', {
                    username: username,
                    message: messageText
                });
                
                messageInput.value = '';
                messageInput.focus();
            } else if (!socket || !socket.connected) {
                showConnectionStatus('Нет соединения с сервером', 'error');
            }
        });
    }

    // Инициализация кнопок переключения
    const globalBtn = document.getElementById('globalBtn');
    const privateBtn = document.getElementById('privateBtn');
    
    if (globalBtn) {
        globalBtn.addEventListener('click', switchToGlobal);
    }
    
    if (privateBtn) {
        privateBtn.addEventListener('click', switchToPrivate);
    }

    // Фокус на поле ввода
    if (messageInput) {
        messageInput.focus();
    }
    
    // По умолчанию показываем общий чат
    switchToGlobal();

    // Периодическая проверка соединения
    setInterval(() => {
        if (socket && !socket.connected) {
            showConnectionStatus('Потеряно соединение с сервером', 'error');
        }
    }, 30000);
});