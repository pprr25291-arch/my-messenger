document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleLogin();
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleRegister();
        });
    }
});

async function handleLogin() {
    const form = document.getElementById('loginForm');
    const formData = new FormData(form);
    const data = {
        username: formData.get('username'),
        password: formData.get('password')
    };

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.status === 401) {
            showError('Неверные учетные данные');
            return;
        }

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('authToken', result.token);
            localStorage.setItem('username', data.username);
            document.cookie = `token=${result.token}; path=/; max-age=86400`;
            window.location.href = '/chat';
        } else {
            showError(result.error || 'Ошибка входа');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Ошибка подключения к серверу');
    }
}

async function handleRegister() {
    const form = document.getElementById('registerForm');
    const formData = new FormData(form);
    const data = {
        username: formData.get('username'),
        password: formData.get('password')
    };

    if (data.username.length < 3) {
        showError('Имя пользователя должно быть не менее 3 символов');
    }

    if (data.password.length < 6) {
        showError('Пароль должен быть не менее 6 символов');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('authToken', result.token);
            localStorage.setItem('username', data.username);
            document.cookie = `token=${result.token}; path=/; max-age=86400`;
            window.location.href = '/chat';
        } else {
            showError(result.error || 'Ошибка регистрации');
        }
    } catch (error) {
        console.error('Register error:', error);
        showError('Ошибка подключения к серверу');
    }
}

function showError(message) {
    const oldError = document.querySelector('.error-message');
    if (oldError) {
        oldError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        color: #dc3545;
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        padding: 10px;
        border-radius: 5px;
        margin: 10px 0;
        text-align: center;
    `;
    errorDiv.textContent = message;

    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(errorDiv, container.firstChild);
    }

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function checkAuthForChat() {
    const token = getTokenFromCookie() || localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    
    if (!token || !username) {
        if (window.location.pathname === '/chat') {
            window.location.href = '/login';
        }
    } else {
        if (window.location.pathname === '/' || 
            window.location.pathname === '/login' || 
            window.location.pathname === '/register') {
            window.location.href = '/chat';
        }
        
        window.USERNAME = username;
    }
}

function getTokenFromCookie() {
    const cookies = document.cookie.split('; ');
    const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
    return tokenCookie ? tokenCookie.split('=')[1] : null;
}

window.checkAuthForChat = checkAuthForChat;
window.getTokenFromCookie = getTokenFromCookie;