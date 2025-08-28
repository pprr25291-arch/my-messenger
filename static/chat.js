const socket = io();
const messages = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

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

socket.on('chat message', (data) => {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.innerHTML = `
        <strong>${data.username}</strong> 
        <span>(${data.timestamp})</span>: 
        ${data.message}
    `;
    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight;
});