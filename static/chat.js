const socket = io();

function switchToGlobal() {
    document.getElementById('globalChat').style.display = 'block';
    document.getElementById('privateChat').style.display = 'none';
    document.getElementById('globalBtn').classList.add('active');
    document.getElementById('privateBtn').classList.remove('active');
    scrollToBottom('messages');
}

function switchToPrivate() {
    document.getElementById('globalChat').style.display = 'none';
    document.getElementById('privateChat').style.display = 'block';
    document.getElementById('globalBtn').classList.remove('active');
    document.getElementById('privateBtn').classList.add('active');
    if (privateChat && privateChat.currentChat) {
        privateChat.scrollToBottom();
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

document.addEventListener('DOMContentLoaded', function() {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const messages = document.getElementById('messages');

    setTimeout(() => {
        loadMessageHistory();
        scrollToBottom('messages');
    }, 300);

    if (messageForm) {
        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const messageText = messageInput.value.trim();
            if (messageText) {
                socket.emit('chat message', {
                    username: document.getElementById('username').textContent,
                    message: messageText
                });
                
                messageInput.value = '';
                messageInput.focus();
            }
        });
    }

    function loadMessageHistory() {
        fetch('/api/messages/global')
            .then(response => response.json())
            .then(messagesData => {
                messages.innerHTML = '';
                messagesData.forEach(message => displayMessage(message, false));
                scrollToBottom('messages');
            })
            .catch(error => console.error('Error loading message history:', error));
    }

    function displayMessage(data, isNew = false) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        
        if (data.username === document.getElementById('username').textContent) {
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
        
        messages.appendChild(messageElement);
        
        if (isAtBottom(messages) || isNew) {
            setTimeout(() => scrollToBottom('messages'), 50);
        }
    }

    socket.on('chat message', (data) => {
        if (data.type === 'global') displayMessage(data, true);
    });

    const username = document.getElementById('username').textContent;
    if (username) socket.emit('user authenticated', username);

    document.getElementById('globalBtn').addEventListener('click', switchToGlobal);
    document.getElementById('privateBtn').addEventListener('click', switchToPrivate);

    messageInput.focus();
    switchToGlobal();
});