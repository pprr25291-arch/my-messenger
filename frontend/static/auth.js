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
    
    // Валидация
    const username = formData.get('username');
    const password = formData.get('password');
    const avatarFile = formData.get('avatar');

    if (username.length < 3) {
        showError('Имя пользователя должно быть не менее 3 символов');
        return;
    }

    if (password.length < 6) {
        showError('Пароль должен быть не менее 6 символов');
        return;
    }

    // Создаем FormData для отправки
    const sendFormData = new FormData();
    sendFormData.append('username', username);
    sendFormData.append('password', password);
    
    // Добавляем файл аватара если есть
    if (avatarFile && avatarFile.size > 0) {
        sendFormData.append('avatar', avatarFile);
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            body: sendFormData
            // НЕ добавляем Content-Type - браузер установит его автоматически
        });

        const result = await response.json();

        if (response.ok && result.success) {
            localStorage.setItem('authToken', result.token);
            localStorage.setItem('username', username);
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

// Обработчики для страницы регистрации
document.addEventListener('DOMContentLoaded', function() {
    initializeAvatarUpload();
    
    // Обработчик для формы регистрации
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleRegister(); // Исправлено: вызываем существующую функцию
        });
    }
    
    // Обработчик для формы логина (если есть на странице)
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });
    }
});

function initializeAvatarUpload() {
    const avatarInput = document.getElementById('avatarInput');
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const avatarPreview = document.getElementById('avatarPreview');
    const avatarOverlay = document.querySelector('.avatar-overlay');

    if (!avatarInput || !changeAvatarBtn) return;

    // Обработчик клика на кнопку "Изменить аватар"
    changeAvatarBtn.addEventListener('click', function(e) {
        e.preventDefault();
        avatarInput.click();
    });

    // Обработчик клика на область предпросмотра аватара
    if (avatarPreview && avatarOverlay) {
        avatarPreview.addEventListener('click', function(e) {
            e.preventDefault();
            avatarInput.click();
        });

        avatarOverlay.addEventListener('click', function(e) {
            e.preventDefault();
            avatarInput.click();
        });
    }

    // Обработчик выбора файла
    avatarInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Проверяем тип файла
            if (!file.type.match('image.*')) {
                alert('Пожалуйста, выберите файл изображения (JPEG, PNG, GIF и т.д.)');
                return;
            }

            // Проверяем размер файла (максимум 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('Размер файла не должен превышать 5MB');
                return;
            }

            // Показываем превью выбранного изображения
            const reader = new FileReader();
            reader.onload = function(e) {
                if (avatarPreview) {
                    avatarPreview.src = e.target.result;
                    avatarPreview.style.display = 'block';
                }
                
                // Скрываем overlay после выбора изображения
                if (avatarOverlay) {
                    avatarOverlay.style.display = 'none';
                }
            };
            reader.readAsDataURL(file);
        }
    });

    // Добавляем стили для hover эффекта
    if (avatarPreview) {
        avatarPreview.style.cursor = 'pointer';
        avatarPreview.style.transition = 'opacity 0.3s ease';
        
        avatarPreview.addEventListener('mouseenter', function() {
            if (avatarOverlay) {
                avatarOverlay.style.display = 'flex';
            }
        });

        avatarPreview.addEventListener('mouseleave', function() {
            // Не скрываем overlay если уже выбрано изображение
            if (avatarInput.files.length === 0 && avatarOverlay) {
                avatarOverlay.style.display = 'flex';
            }
        });
    }
}

// Экспортируем функции в глобальную область видимости
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.checkAuthForChat = checkAuthForChat;
window.getTokenFromCookie = getTokenFromCookie;