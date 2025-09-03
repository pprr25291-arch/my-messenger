const socket = io();

function switchToGlobal() {
    document.getElementById('globalChat').style.display = 'block';
    document.getElementById('privateChat').style.display = 'none';
    document.getElementById('globalBtn').classList.add('active');
    document.getElementById('privateBtn').classList.remove('active');
}

function switchToPrivate() {
    document.getElementById('globalChat').style.display = 'none';
    document.getElementById('privateChat').style.display = 'block';
    document.getElementById('globalBtn').classList.remove('active');
    document.getElementById('privateBtn').classList.add('active');
}

function logout() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => window.location.href = '/')
        .catch(() => window.location.href = '/');
}

// Глобальный чат
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messages = document.getElementById('messages');

if (messageForm) {
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (messageInput.value.trim()) {
            socket.emit('chat message', {
                username: document.getElementById('username').textContent,
                message: messageInput.value
            });
            messageInput.value = '';
        }
    });
}

socket.on('chat message', (data) => {
    if (data.type === 'global') {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        messageElement.innerHTML = `
            <strong>${data.username}</strong> 
            <span>(${data.timestamp})</span>: 
            ${data.message}
        `;
        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
    }
});

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    switchToGlobal();
});