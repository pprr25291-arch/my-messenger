class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.userSettings = {};
        this.defaultSettings = {
            theme: 'auto',
            accentColor: '#007bff',
            compactMode: false,
            showAvatars: true,
            animations: true,
            showOnlineStatus: true,
            allowGroupInvites: true,
            allowPrivateMessages: true,
            notifyMessages: true,
            notifyCalls: true,
            notifyMentions: true,
            soundEnabled: true,
            notificationSound: 'default',
            userStatus: 'online'
        };
        
        this.init();
    }

    init() {
        this.currentUser = document.getElementById('username')?.textContent;
        this.loadUserSettings();
        this.setupEventListeners();
        this.applySettings();
        console.log('✅ SettingsManager initialized');
    }

    loadUserSettings() {
        try {
            const savedSettings = localStorage.getItem(`userSettings_${this.currentUser}`);
            if (savedSettings) {
                this.userSettings = { ...this.defaultSettings, ...JSON.parse(savedSettings) };
            } else {
                this.userSettings = { ...this.defaultSettings };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.userSettings = { ...this.defaultSettings };
        }
    }

    saveUserSettings() {
        try {
            localStorage.setItem(`userSettings_${this.currentUser}`, JSON.stringify(this.userSettings));
            console.log('💾 Settings saved');
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    setupEventListeners() {
        // Кнопка открытия настроек
        document.addEventListener('click', (e) => {
            if (e.target.id === 'settingsBtn' || e.target.closest('#settingsBtn')) {
                this.openSettings();
            }
        });

        // Закрытие модальных окон
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-modal') || e.target.closest('.close-modal')) {
                e.target.closest('.modal-overlay').style.display = 'none';
            }
        });

        // Клик вне модального окна
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.style.display = 'none';
            }
        });

        // Переключение вкладок
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('settings-tab')) {
                this.switchTab(e.target.getAttribute('data-tab'));
            }
        });

        // Загрузка аватара
        document.addEventListener('click', (e) => {
            if (e.target.id === 'uploadAvatarBtnSettings' || e.target.closest('#uploadAvatarBtnSettings')) {
                document.getElementById('avatarInputSettings').click();
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.id === 'avatarInputSettings') {
                this.handleAvatarUpload(e.target.files[0]);
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.id === 'avatarPreviewLarge' || e.target.closest('#avatarPreviewLarge')) {
                document.getElementById('avatarInputSettings').click();
            }
        });

        // Удаление аватара
        document.addEventListener('click', (e) => {
            if (e.target.id === 'removeAvatarBtn' || e.target.closest('#removeAvatarBtn')) {
                this.removeAvatar();
            }
        });

        // Выбор темы
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('theme-option') || e.target.closest('.theme-option')) {
                const option = e.target.classList.contains('theme-option') ? e.target : e.target.closest('.theme-option');
                this.selectTheme(option.getAttribute('data-theme'));
            }
        });

        // Выбор цвета акцента - ИСПРАВЛЕНО
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-option') || e.target.closest('.color-option')) {
                const option = e.target.classList.contains('color-option') ? e.target : e.target.closest('.color-option');
                const color = option.getAttribute('data-color');
                this.selectAccentColor(color);
            }
        });

        // Чекбоксы
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('checkbox-input')) {
                this.handleCheckboxChange(e.target.id, e.target.checked);
            }
        });

        // Смена пароля
        document.addEventListener('click', (e) => {
            if (e.target.id === 'changePasswordBtn' || e.target.closest('#changePasswordBtn')) {
                this.openChangePasswordModal();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.id === 'confirmPasswordChange' || e.target.closest('#confirmPasswordChange')) {
                this.changePassword();
            }
        });

        // Выход со всех устройств
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logoutAllBtn' || e.target.closest('#logoutAllBtn')) {
                this.logoutAllDevices();
            }
        });

        // Тест звука
        document.addEventListener('click', (e) => {
            if (e.target.id === 'testSoundBtn' || e.target.closest('#testSoundBtn')) {
                this.testNotificationSound();
            }
        });

        // Сохранение настроек
        document.addEventListener('click', (e) => {
            if (e.target.id === 'saveSettings' || e.target.closest('#saveSettings')) {
                this.saveSettings();
            }
        });

        // Сброс настроек
        document.addEventListener('click', (e) => {
            if (e.target.id === 'resetSettings' || e.target.closest('#resetSettings')) {
                this.resetSettings();
            }
        });

        // Выход
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logoutBtn' || e.target.closest('#logoutBtn')) {
                this.logout();
            }
        });

        // Отслеживание силы пароля
        document.addEventListener('input', (e) => {
            if (e.target.id === 'newPassword') {
                this.checkPasswordStrength(e.target.value);
            }
        });

        // Инициализация модального окна настроек
        this.createSettingsModal();
        
        // Добавляем слушатель для изменения темы через системные настройки
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (this.userSettings.theme === 'auto') {
                this.applyTheme();
            }
        });
    }

    createSettingsModal() {
        if (document.getElementById('settingsModal')) return;

        const modal = document.createElement('div');
        modal.id = 'settingsModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 0;
                border-radius: 15px;
                width: 900px;
                max-width: 95%;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            ">
                <!-- Боковая панель с вкладками -->
                <div class="settings-sidebar" style="
                    width: 250px;
                    background: #f8f9fa;
                    padding: 20px;
                    border-right: 1px solid #e9ecef;
                    overflow-y: auto;
                ">
                    <div class="sidebar-header" style="margin-bottom: 30px;">
                        <h3 style="margin: 0 0 10px 0; color: #333;">⚙️ Настройки</h3>
                        <div style="font-size: 12px; color: #6c757d;">${this.currentUser || 'Пользователь'}</div>
                    </div>
                    
                    <div class="settings-tabs" style="display: flex; flex-direction: column; gap: 5px;">
                        <button class="settings-tab active" data-tab="profile" style="
                            padding: 12px 15px;
                            border: none;
                            background: #007bff;
                            color: white;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            👤 Профиль
                        </button>
                        <button class="settings-tab" data-tab="appearance" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🎨 Внешний вид
                        </button>
                        <button class="settings-tab" data-tab="notifications" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🔔 Уведомления
                        </button>
                        <button class="settings-tab" data-tab="privacy" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🔒 Приватность
                        </button>
                        <button class="settings-tab" data-tab="gifts" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🎁 Мои подарки
                        </button>
                        <button class="settings-tab" data-tab="currency" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🪙 Валюта
                        </button>
                        <button class="settings-tab" data-tab="security" style="
                            padding: 12px 15px;
                            border: none;
                            background: transparent;
                            color: #333;
                            border-radius: 8px;
                            cursor: pointer;
                            text-align: left;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.3s ease;
                        ">
                            🛡️ Безопасность
                        </button>
                    </div>
                    
                    <div class="sidebar-footer" style="margin-top: auto; padding-top: 20px; border-top: 1px solid #e9ecef;">
                        <button id="saveSettings" class="btn-primary" style="
                            width: 100%;
                            padding: 12px;
                            background: #28a745;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            margin-bottom: 10px;
                            font-weight: 600;
                        ">💾 Сохранить</button>
                        <button id="resetSettings" class="btn-secondary" style="
                            width: 100%;
                            padding: 10px;
                            background: #6c757d;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                        ">🔄 Сбросить</button>
                    </div>
                </div>
                
                <!-- Основное содержимое -->
                <div class="settings-main" style="
                    flex: 1;
                    padding: 25px;
                    overflow-y: auto;
                    max-height: 80vh;
                ">
                    <div class="settings-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                        <h3 style="margin: 0; color: #333;" id="settingsTitle">Настройки профиля</h3>
                        <button class="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 5px;">✕</button>
                    </div>
                    
                    <div class="settings-content">
                        <!-- Вкладка профиля -->
                        <div id="tab-profile" class="settings-tab-content active">
                            <div class="profile-settings">
                                <div class="avatar-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🖼️ Аватар</h4>
                                    <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                                        <div id="avatarPreviewLarge" style="
                                            width: 100px;
                                            height: 100px;
                                            border-radius: 50%;
                                            border: 3px solid ${this.userSettings.accentColor || '#007bff'};
                                            overflow: hidden;
                                            cursor: pointer;
                                            background: #f8f9fa;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            transition: border-color 0.3s ease;
                                        ">
                                            <img id="avatarPreviewImgLarge" src="/static/default-avatar.png" alt="Аватар" style="width: 100%; height: 100%; object-fit: cover;">
                                        </div>
                                        <div>
                                            <button id="uploadAvatarBtnSettings" class="btn-primary" style="
                                                padding: 8px 16px;
                                                background: ${this.userSettings.accentColor || '#007bff'};
                                                color: white;
                                                border: none;
                                                border-radius: 5px;
                                                cursor: pointer;
                                                font-size: 14px;
                                                margin-bottom: 5px;
                                                display: block;
                                                transition: background 0.3s ease;
                                            ">📁 Загрузить новый</button>
                                            <button id="removeAvatarBtn" class="btn-secondary" style="
                                                padding: 6px 12px;
                                                background: #dc3545;
                                                color: white;
                                                border: none;
                                                border-radius: 5px;
                                                cursor: pointer;
                                                font-size: 12px;
                                            ">🗑️ Удалить</button>
                                            <input type="file" id="avatarInputSettings" accept="image/*" style="display: none;">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="profile-info-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">👤 Информация профиля</h4>
                                    <div class="form-group" style="margin-bottom: 15px;">
                                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Имя пользователя</label>
                                        <input type="text" id="usernameDisplay" class="form-control" readonly style="
                                            width: 100%;
                                            padding: 10px;
                                            border: 1px solid #ced4da;
                                            border-radius: 5px;
                                            background: #f8f9fa;
                                        ">
                                    </div>
                                    <div class="form-group">
                                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Статус</label>
                                        <select id="userStatus" class="form-control" style="
                                            width: 100%;
                                            padding: 10px;
                                            border: 1px solid #ced4da;
                                            border-radius: 5px;
                                        ">
                                            <option value="online">🟢 В сети</option>
                                            <option value="away">🟡 Отошел</option>
                                            <option value="dnd">🔴 Не беспокоить</option>
                                            <option value="offline">⚫ Не в сети</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка внешнего вида - ИСПРАВЛЕНО, добавлены акценты -->
                        <div id="tab-appearance" class="settings-tab-content">
                            <div class="appearance-settings">
                                <div class="theme-section" style="margin-bottom: 30px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🌙 Тема оформления</h4>
                                    <div class="theme-options" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                                        <div class="theme-option ${this.userSettings.theme === 'auto' ? 'active' : ''}" data-theme="auto" style="
                                            border: 2px solid ${this.userSettings.theme === 'auto' ? this.userSettings.accentColor : '#dee2e6'};
                                            border-radius: 10px;
                                            padding: 15px;
                                            text-align: center;
                                            cursor: pointer;
                                            background: linear-gradient(45deg, #f8f9fa 50%, #343a40 50%);
                                            transition: all 0.3s ease;
                                        ">
                                            <div style="font-size: 24px;">🌓</div>
                                            <div style="font-size: 12px; margin-top: 5px;">Авто</div>
                                        </div>
                                        <div class="theme-option ${this.userSettings.theme === 'light' ? 'active' : ''}" data-theme="light" style="
                                            border: 2px solid ${this.userSettings.theme === 'light' ? this.userSettings.accentColor : '#dee2e6'};
                                            border-radius: 10px;
                                            padding: 15px;
                                            text-align: center;
                                            cursor: pointer;
                                            background: #f8f9fa;
                                            transition: all 0.3s ease;
                                        ">
                                            <div style="font-size: 24px;">☀️</div>
                                            <div style="font-size: 12px; margin-top: 5px;">Светлая</div>
                                        </div>
                                        <div class="theme-option ${this.userSettings.theme === 'dark' ? 'active' : ''}" data-theme="dark" style="
                                            border: 2px solid ${this.userSettings.theme === 'dark' ? this.userSettings.accentColor : '#dee2e6'};
                                            border-radius: 10px;
                                            padding: 15px;
                                            text-align: center;
                                            cursor: pointer;
                                            background: #343a40;
                                            color: white;
                                            transition: all 0.3s ease;
                                        ">
                                            <div style="font-size: 24px;">🌙</div>
                                            <div style="font-size: 12px; margin-top: 5px;">Темная</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Акцентный цвет - ИСПРАВЛЕНО, теперь работает -->
                                <div class="accent-color-section" style="margin-bottom: 30px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🎨 Акцентный цвет</h4>
                                    <p style="font-size: 12px; color: #6c757d; margin-bottom: 15px;">
                                        Выберите основной цвет интерфейса. Акцентный цвет используется для кнопок, выделения и элементов навигации.
                                    </p>
                                    <div class="color-options" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;">
                                        <div class="color-option ${this.userSettings.accentColor === '#007bff' ? 'active' : ''}" data-color="#007bff" style="
                                            width: 45px;
                                            height: 45px;
                                            border-radius: 50%;
                                            background: #007bff;
                                            cursor: pointer;
                                            border: 3px solid ${this.userSettings.accentColor === '#007bff' ? '#007bff' : 'white'};
                                            box-shadow: ${this.userSettings.accentColor === '#007bff' ? '0 0 0 2px rgba(0,123,255,0.3)' : 'none'};
                                            transition: all 0.3s ease;
                                            margin: 0 auto;
                                        " title="Синий"></div>
                                        <div class="color-option ${this.userSettings.accentColor === '#28a745' ? 'active' : ''}" data-color="#28a745" style="
                                            width: 45px;
                                            height: 45px;
                                            border-radius: 50%;
                                            background: #28a745;
                                            cursor: pointer;
                                            border: 3px solid ${this.userSettings.accentColor === '#28a745' ? '#28a745' : 'white'};
                                            box-shadow: ${this.userSettings.accentColor === '#28a745' ? '0 0 0 2px rgba(40,167,69,0.3)' : 'none'};
                                            transition: all 0.3s ease;
                                            margin: 0 auto;
                                        " title="Зеленый"></div>
                                        <div class="color-option ${this.userSettings.accentColor === '#dc3545' ? 'active' : ''}" data-color="#dc3545" style="
                                            width: 45px;
                                            height: 45px;
                                            border-radius: 50%;
                                            background: #dc3545;
                                            cursor: pointer;
                                            border: 3px solid ${this.userSettings.accentColor === '#dc3545' ? '#dc3545' : 'white'};
                                            box-shadow: ${this.userSettings.accentColor === '#dc3545' ? '0 0 0 2px rgba(220,53,69,0.3)' : 'none'};
                                            transition: all 0.3s ease;
                                            margin: 0 auto;
                                        " title="Красный"></div>
                                        <div class="color-option ${this.userSettings.accentColor === '#ffc107' ? 'active' : ''}" data-color="#ffc107" style="
                                            width: 45px;
                                            height: 45px;
                                            border-radius: 50%;
                                            background: #ffc107;
                                            cursor: pointer;
                                            border: 3px solid ${this.userSettings.accentColor === '#ffc107' ? '#ffc107' : 'white'};
                                            box-shadow: ${this.userSettings.accentColor === '#ffc107' ? '0 0 0 2px rgba(255,193,7,0.3)' : 'none'};
                                            transition: all 0.3s ease;
                                            margin: 0 auto;
                                        " title="Желтый"></div>
                                        <div class="color-option ${this.userSettings.accentColor === '#6f42c1' ? 'active' : ''}" data-color="#6f42c1" style="
                                            width: 45px;
                                            height: 45px;
                                            border-radius: 50%;
                                            background: #6f42c1;
                                            cursor: pointer;
                                            border: 3px solid ${this.userSettings.accentColor === '#6f42c1' ? '#6f42c1' : 'white'};
                                            box-shadow: ${this.userSettings.accentColor === '#6f42c1' ? '0 0 0 2px rgba(111,66,193,0.3)' : 'none'};
                                            transition: all 0.3s ease;
                                            margin: 0 auto;
                                        " title="Фиолетовый"></div>
                                        <div class="color-option ${this.userSettings.accentColor === '#fd7e14' ? 'active' : ''}" data-color="#fd7e14" style="
                                            width: 45px;
                                            height: 45px;
                                            border-radius: 50%;
                                            background: #fd7e14;
                                            cursor: pointer;
                                            border: 3px solid ${this.userSettings.accentColor === '#fd7e14' ? '#fd7e14' : 'white'};
                                            box-shadow: ${this.userSettings.accentColor === '#fd7e14' ? '0 0 0 2px rgba(253,126,20,0.3)' : 'none'};
                                            transition: all 0.3s ease;
                                            margin: 0 auto;
                                        " title="Оранжевый"></div>
                                    </div>
                                    
                                    <!-- Пользовательский цвет -->
                                    <div style="margin-top: 20px; display: flex; align-items: center; gap: 15px;">
                                        <label style="font-size: 13px; color: #495057;">Свой цвет:</label>
                                        <input type="color" id="customColorPicker" value="${this.userSettings.accentColor}" style="
                                            width: 50px;
                                            height: 50px;
                                            border: 2px solid #dee2e6;
                                            border-radius: 8px;
                                            cursor: pointer;
                                            padding: 0;
                                        ">
                                        <span style="font-size: 12px; color: #6c757d;" id="customColorValue">${this.userSettings.accentColor}</span>
                                    </div>
                                </div>
                                
                                <div class="layout-section">
                                    <h4 style="margin-bottom: 15px; color: #495057;">📐 Оформление</h4>
                                    <div class="checkbox-group" style="display: flex; flex-direction: column; gap: 15px;">
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="compactMode" class="checkbox-input" ${this.userSettings.compactMode ? 'checked' : ''} style="transform: scale(1.2);">
                                            <span>Компактный режим</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="showAvatars" class="checkbox-input" ${this.userSettings.showAvatars ? 'checked' : ''} style="transform: scale(1.2);">
                                            <span>Показывать аватары</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="animations" class="checkbox-input" ${this.userSettings.animations ? 'checked' : ''} style="transform: scale(1.2);">
                                            <span>Анимации</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка уведомлений -->
                        <div id="tab-notifications" class="settings-tab-content">
                            <div class="notifications-settings">
                                <div class="notifications-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🔔 Уведомления</h4>
                                    <div class="checkbox-group" style="display: flex; flex-direction: column; gap: 15px;">
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="notifyMessages" class="checkbox-input" ${this.userSettings.notifyMessages ? 'checked' : ''} style="transform: scale(1.2);">
                                            <span>Новые сообщения</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="notifyCalls" class="checkbox-input" ${this.userSettings.notifyCalls ? 'checked' : ''} style="transform: scale(1.2);">
                                            <span>Входящие звонки</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="notifyMentions" class="checkbox-input" ${this.userSettings.notifyMentions ? 'checked' : ''} style="transform: scale(1.2);">
                                            <span>Упоминания</span>
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="sound-section">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🔊 Звук</h4>
                                    <div class="checkbox-group" style="display: flex; flex-direction: column; gap: 15px;">
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="soundEnabled" class="checkbox-input" ${this.userSettings.soundEnabled ? 'checked' : ''} style="transform: scale(1.2);">
                                            <span>Включить звук</span>
                                        </label>
                                        <div class="form-group">
                                            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Звук уведомления</label>
                                            <select id="notificationSound" class="form-control" style="
                                                width: 100%;
                                                padding: 10px;
                                                border: 1px solid #ced4da;
                                                border-radius: 5px;
                                                background: white;
                                            ">
                                                <option value="default" ${this.userSettings.notificationSound === 'default' ? 'selected' : ''}>🔔 По умолчанию</option>
                                                <option value="chime" ${this.userSettings.notificationSound === 'chime' ? 'selected' : ''}>🎵 Мелодия</option>
                                                <option value="bell" ${this.userSettings.notificationSound === 'bell' ? 'selected' : ''}>🔔 Колокольчик</option>
                                                <option value="pop" ${this.userSettings.notificationSound === 'pop' ? 'selected' : ''}>💥 Хлопок</option>
                                            </select>
                                        </div>
                                        <button id="testSoundBtn" class="btn-secondary" style="
                                            padding: 8px 16px;
                                            background: ${this.userSettings.accentColor || '#6c757d'};
                                            color: white;
                                            border: none;
                                            border-radius: 5px;
                                            cursor: pointer;
                                            font-size: 14px;
                                            align-self: flex-start;
                                            transition: background 0.3s ease;
                                        ">🎵 Тест звука</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка приватности -->
                        <div id="tab-privacy" class="settings-tab-content">
                            <div class="privacy-settings">
                                <div class="privacy-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">👥 Видимость</h4>
                                    <div class="checkbox-group" style="display: flex; flex-direction: column; gap: 15px;">
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="showOnlineStatus" class="checkbox-input" ${this.userSettings.showOnlineStatus ? 'checked' : ''} style="transform: scale(1.2);">
                                            <span>Показывать статус "В сети"</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="allowGroupInvites" class="checkbox-input" ${this.userSettings.allowGroupInvites ? 'checked' : ''} style="transform: scale(1.2);">
                                            <span>Разрешить приглашения в группы</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="allowPrivateMessages" class="checkbox-input" ${this.userSettings.allowPrivateMessages ? 'checked' : ''} style="transform: scale(1.2);">
                                            <span>Разрешить личные сообщения</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка подарков -->
                        <div id="tab-gifts" class="settings-tab-content">
                            <div class="gifts-management">
                                <h4 style="margin-bottom: 20px; color: #495057;">🎁 Управление подарками</h4>
                                
                                <div class="equipped-gifts-section" style="margin-bottom: 25px;">
                                    <h5 style="margin-bottom: 15px; color: #495057;">🎽 Надетые подарки</h5>
                                    <div id="equippedGiftsList" class="equipped-gifts-list" style="
                                        display: grid;
                                        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                                        gap: 15px;
                                        margin-bottom: 20px;
                                    ">
                                        <!-- Список надетых подарков -->
                                    </div>
                                </div>
                                
                                <div class="all-gifts-section">
                                    <h5 style="margin-bottom: 15px; color: #495057;">📦 Все подарки</h5>
                                    <div id="userGiftsManagementList" class="user-gifts-management-list" style="
                                        display: grid;
                                        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                                        gap: 10px;
                                        max-height: 400px;
                                        overflow-y: auto;
                                        padding: 15px;
                                        background: #f8f9fa;
                                        border-radius: 8px;
                                    ">
                                        <!-- Список всех подарков -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка валюты -->
                        <div id="tab-currency" class="settings-tab-content">
                            <div class="currency-settings">
                                <div class="currency-balance-section" style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px;">
                                    <div style="font-size: 14px; opacity: 0.9;">Ваш баланс</div>
                                    <div style="font-size: 32px; font-weight: bold;" id="userBalance">0</div>
                                    <div style="font-size: 12px; margin-top: 5px;">Ежедневная серия: <span id="dailyStreak">0</span> дней</div>
                                </div>
                                
                                <div class="daily-reward-section" style="margin-bottom: 25px;">
                                    <h5 style="margin-bottom: 10px; color: #495057;">🎁 Ежедневная награда</h5>
                                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                                        <div style="font-size: 14px; color: #6c757d; margin-bottom: 10px;">
                                            Следующая награда: <span id="nextRewardTime">Доступно сейчас!</span>
                                        </div>
                                        <button id="dailyRewardBtn" class="btn-primary" style="
                                            width: 100%;
                                            padding: 12px;
                                            background: linear-gradient(45deg, #28a745, #20c997);
                                            color: white;
                                            border: none;
                                            border-radius: 8px;
                                            cursor: pointer;
                                            font-size: 16px;
                                            font-weight: bold;
                                            transition: transform 0.2s ease;
                                        ">🎁 Получить ежедневную награду</button>
                                    </div>
                                </div>
                                
                                <div class="currency-history-section">
                                    <h5 style="margin-bottom: 15px; color: #495057;">📊 История операций</h5>
                                    <div id="currencyHistory" class="currency-history" style="
                                        max-height: 200px;
                                        overflow-y: auto;
                                        background: #f8f9fa;
                                        border-radius: 8px;
                                        padding: 15px;
                                    ">
                                        <!-- История операций -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка безопасности -->
                        <div id="tab-security" class="settings-tab-content">
                            <div class="security-settings">
                                <div class="password-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🔐 Безопасность</h4>
                                    <button id="changePasswordBtn" class="btn-primary" style="
                                        padding: 10px 20px;
                                        background: ${this.userSettings.accentColor || '#007bff'};
                                        color: white;
                                        border: none;
                                        border-radius: 5px;
                                        cursor: pointer;
                                        font-size: 14px;
                                        transition: background 0.3s ease;
                                    ">🔑 Сменить пароль</button>
                                </div>
                                
                                <div class="sessions-section" style="margin-bottom: 25px;">
                                    <h5 style="margin-bottom: 10px; color: #495057;">🌐 Активные сессии</h5>
                                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                                        <div style="font-size: 14px; color: #6c757d;">
                                            Вы вошли с этого устройства
                                        </div>
                                        <div style="font-size: 12px; color: #495057; margin-top: 5px;">
                                            ${new Date().toLocaleString()}
                                        </div>
                                    </div>
                                    <button id="logoutAllBtn" class="btn-secondary" style="
                                        padding: 8px 16px;
                                        background: #dc3545;
                                        color: white;
                                        border: none;
                                        border-radius: 5px;
                                        cursor: pointer;
                                        font-size: 14px;
                                    ">🚪 Выйти со всех устройств</button>
                                </div>
                                
                                <div class="logout-section">
                                    <button id="logoutBtn" class="btn-secondary" style="
                                        padding: 10px 20px;
                                        background: #6c757d;
                                        color: white;
                                        border: none;
                                        border-radius: 5px;
                                        cursor: pointer;
                                        font-size: 14px;
                                    ">🚪 Выйти</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Добавляем обработчик для кастомного выбора цвета
        setTimeout(() => {
            const colorPicker = document.getElementById('customColorPicker');
            if (colorPicker) {
                colorPicker.addEventListener('input', (e) => {
                    const color = e.target.value;
                    document.getElementById('customColorValue').textContent = color;
                });
                
                colorPicker.addEventListener('change', (e) => {
                    const color = e.target.value;
                    this.selectAccentColor(color);
                    document.getElementById('customColorValue').textContent = color;
                });
            }
        }, 100);

        // Создаем модальные окна для смены пароля
        this.createChangePasswordModal();
    }

    createChangePasswordModal() {
        if (document.getElementById('changePasswordModal')) return;

        const modal = document.createElement('div');
        modal.id = 'changePasswordModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 25px;
                border-radius: 15px;
                width: 400px;
                max-width: 95%;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            ">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                    <h3 style="margin: 0; color: #333;">🔑 Смена пароля</h3>
                    <button class="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 5px;">✕</button>
                </div>
                
                <div class="password-form">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Текущий пароль</label>
                        <input type="password" id="currentPassword" class="form-control" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ced4da;
                            border-radius: 5px;
                            font-size: 14px;
                        ">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Новый пароль</label>
                        <input type="password" id="newPassword" class="form-control" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ced4da;
                            border-radius: 5px;
                            font-size: 14px;
                        ">
                        <div class="password-strength" style="margin-top: 5px;">
                            <div class="strength-bar" style="
                                height: 5px;
                                background: #e9ecef;
                                border-radius: 3px;
                                overflow: hidden;
                                margin-bottom: 5px;
                            ">
                                <div style="height: 100%; background: #dc3545; width: 0%; transition: width 0.3s ease;"></div>
                            </div>
                            <div class="strength-text" style="font-size: 12px; color: #6c757d;">Надежность пароля: Слабый</div>
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Подтвердите новый пароль</label>
                        <input type="password" id="confirmPassword" class="form-control" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ced4da;
                            border-radius: 5px;
                            font-size: 14px;
                        ">
                    </div>
                    
                    <button id="confirmPasswordChange" class="btn-primary" style="
                        width: 100%;
                        padding: 12px;
                        background: ${this.userSettings.accentColor || '#28a745'};
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                        transition: background 0.3s ease;
                    ">💾 Сохранить пароль</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    openSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            this.loadCurrentSettings();
            modal.style.display = 'flex';
            this.switchTab('profile');
        } else {
            console.error('Settings modal not found');
            this.createSettingsModal();
            setTimeout(() => this.openSettings(), 100);
        }
    }

    switchTab(tabName) {
        // Деактивируем все вкладки
        document.querySelectorAll('.settings-tab').forEach(tab => {
            if (tab) {
                tab.classList.remove('active');
                tab.style.background = 'transparent';
                tab.style.color = '#333';
            }
        });
        
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            if (content) {
                content.classList.remove('active');
                content.style.display = 'none';
            }
        });

        // Активируем выбранную вкладку
        const activeTab = document.querySelector(`.settings-tab[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(`tab-${tabName}`);
        
        if (activeTab && activeContent) {
            activeTab.classList.add('active');
            activeTab.style.background = this.userSettings.accentColor || '#007bff';
            activeTab.style.color = 'white';
            activeContent.classList.add('active');
            activeContent.style.display = 'block';
            
            // Обновляем заголовок
            const titleElement = document.getElementById('settingsTitle');
            if (titleElement) {
                const titles = {
                    'profile': 'Настройки профиля',
                    'appearance': 'Внешний вид',
                    'notifications': 'Уведомления',
                    'privacy': 'Приватность',
                    'gifts': 'Мои подарки',
                    'currency': 'Валюта и награды',
                    'security': 'Безопасность'
                };
                
                titleElement.textContent = titles[tabName] || 'Настройки';
            }
            
            // Загружаем данные для соответствующих вкладок
            if (tabName === 'gifts' && window.giftManager) {
                setTimeout(() => this.loadGiftsManagement(), 100);
            }
            
            if (tabName === 'currency' && window.currencyManager) {
                setTimeout(() => this.loadCurrencyData(), 100);
            }
        }
    }

    loadCurrentSettings() {
        // Загружаем текущие настройки в форму
        const usernameInput = document.getElementById('usernameDisplay');
        if (usernameInput) usernameInput.value = this.currentUser;
        
        const userStatus = document.getElementById('userStatus');
        if (userStatus) userStatus.value = this.userSettings.userStatus;

        // Тема
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            option.style.borderColor = '#dee2e6';
        });
        
        const activeTheme = document.querySelector(`.theme-option[data-theme="${this.userSettings.theme}"]`);
        if (activeTheme) {
            activeTheme.classList.add('active');
            activeTheme.style.borderColor = this.userSettings.accentColor;
        }

        // Цвет акцента - ИСПРАВЛЕНО
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
            option.style.borderColor = 'white';
            option.style.boxShadow = 'none';
        });
        
        const activeColor = document.querySelector(`.color-option[data-color="${this.userSettings.accentColor}"]`);
        if (activeColor) {
            activeColor.classList.add('active');
            activeColor.style.borderColor = this.userSettings.accentColor;
            activeColor.style.boxShadow = `0 0 0 2px ${this.userSettings.accentColor}40`;
        }

        // Обновляем кастомный цвет
        const customColorPicker = document.getElementById('customColorPicker');
        const customColorValue = document.getElementById('customColorValue');
        if (customColorPicker) customColorPicker.value = this.userSettings.accentColor;
        if (customColorValue) customColorValue.textContent = this.userSettings.accentColor;

        // Чекбоксы
        const compactMode = document.getElementById('compactMode');
        if (compactMode) compactMode.checked = this.userSettings.compactMode;
        
        const showAvatars = document.getElementById('showAvatars');
        if (showAvatars) showAvatars.checked = this.userSettings.showAvatars;
        
        const animations = document.getElementById('animations');
        if (animations) animations.checked = this.userSettings.animations;
        
        const showOnlineStatus = document.getElementById('showOnlineStatus');
        if (showOnlineStatus) showOnlineStatus.checked = this.userSettings.showOnlineStatus;
        
        const allowGroupInvites = document.getElementById('allowGroupInvites');
        if (allowGroupInvites) allowGroupInvites.checked = this.userSettings.allowGroupInvites;
        
        const allowPrivateMessages = document.getElementById('allowPrivateMessages');
        if (allowPrivateMessages) allowPrivateMessages.checked = this.userSettings.allowPrivateMessages;
        
        const notifyMessages = document.getElementById('notifyMessages');
        if (notifyMessages) notifyMessages.checked = this.userSettings.notifyMessages;
        
        const notifyCalls = document.getElementById('notifyCalls');
        if (notifyCalls) notifyCalls.checked = this.userSettings.notifyCalls;
        
        const notifyMentions = document.getElementById('notifyMentions');
        if (notifyMentions) notifyMentions.checked = this.userSettings.notifyMentions;
        
        const soundEnabled = document.getElementById('soundEnabled');
        if (soundEnabled) soundEnabled.checked = this.userSettings.soundEnabled;

        // Звук уведомлений
        const notificationSound = document.getElementById('notificationSound');
        if (notificationSound) notificationSound.value = this.userSettings.notificationSound;

        // Загружаем аватар
        this.loadUserAvatar();
    }

    async loadUserAvatar() {
        try {
            const response = await fetch(`/api/user/${this.currentUser}`);
            if (response.ok) {
                const userData = await response.json();
                const avatarUrl = userData.avatar || '/static/default-avatar.png';
                const avatarImg = document.getElementById('avatarPreviewImgLarge');
                if (avatarImg) avatarImg.src = avatarUrl;
            }
        } catch (error) {
            console.error('Error loading user avatar:', error);
        }
    }

    async handleAvatarUpload(file) {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showNotification('Пожалуйста, выберите изображение', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Размер файла не должен превышать 5MB', 'error');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await fetch('/api/user/avatar', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                const avatarImg = document.getElementById('avatarPreviewImgLarge');
                if (avatarImg) avatarImg.src = result.avatar;
                this.showNotification('Аватар успешно обновлен', 'success');
                
                // Обновляем аватар во всем приложении
                if (window.privateChatInstance) {
                    window.privateChatInstance.updateUserAvatar(this.currentUser);
                }
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            this.showNotification('Ошибка загрузки аватара', 'error');
        }
    }

    async removeAvatar() {
        try {
            const response = await fetch('/api/user/avatar', {
                method: 'DELETE'
            });

            if (response.ok) {
                const avatarImg = document.getElementById('avatarPreviewImgLarge');
                if (avatarImg) avatarImg.src = '/static/default-avatar.png';
                this.showNotification('Аватар удален', 'success');
            } else {
                throw new Error('Delete failed');
            }
        } catch (error) {
            console.error('Error removing avatar:', error);
            this.showNotification('Ошибка удаления аватара', 'error');
        }
    }

    selectTheme(theme) {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            option.style.borderColor = '#dee2e6';
        });
        
        const selectedTheme = document.querySelector(`.theme-option[data-theme="${theme}"]`);
        if (selectedTheme) {
            selectedTheme.classList.add('active');
            selectedTheme.style.borderColor = this.userSettings.accentColor;
        }
        
        this.userSettings.theme = theme;
        this.applyTheme();
    }

    selectAccentColor(color) {
        // Обновляем в настройках
        this.userSettings.accentColor = color;
        
        // Обновляем UI цветовых опций
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
            option.style.borderColor = 'white';
            option.style.boxShadow = 'none';
        });
        
        const selectedColor = document.querySelector(`.color-option[data-color="${color}"]`);
        if (selectedColor) {
            selectedColor.classList.add('active');
            selectedColor.style.borderColor = color;
            selectedColor.style.boxShadow = `0 0 0 2px ${color}40`;
        }
        
        // Обновляем кастомный цвет
        const customColorPicker = document.getElementById('customColorPicker');
        const customColorValue = document.getElementById('customColorValue');
        if (customColorPicker) customColorPicker.value = color;
        if (customColorValue) customColorValue.textContent = color;
        
        // Обновляем акцентный цвет в интерфейсе
        this.applyAccentColor();
        
        // Обновляем цвета кнопок и элементов
        this.updateUIAccentColors(color);
    }

    updateUIAccentColors(color) {
        // Обновляем активную вкладку
        const activeTab = document.querySelector('.settings-tab.active');
        if (activeTab) {
            activeTab.style.background = color;
        }
        
        // Обновляем кнопки с классом btn-primary
        document.querySelectorAll('.btn-primary:not(#dailyRewardBtn)').forEach(btn => {
            btn.style.background = color;
        });
        
        // Обновляем рамку аватара
        const avatarPreview = document.getElementById('avatarPreviewLarge');
        if (avatarPreview) {
            avatarPreview.style.borderColor = color;
        }
        
        // Обновляем активные опции темы
        document.querySelectorAll('.theme-option.active').forEach(option => {
            option.style.borderColor = color;
        });
    }

    handleCheckboxChange(setting, value) {
        this.userSettings[setting] = value;
        
        // Немедленно применяем некоторые настройки
        if (setting === 'compactMode' || setting === 'showAvatars' || setting === 'animations') {
            this.applySettings();
        }
    }

    applySettings() {
        this.applyTheme();
        this.applyAccentColor();
        this.applyLayoutSettings();
    }

    applyTheme() {
        const theme = this.userSettings.theme;
        let actualTheme = theme;

        if (theme === 'auto') {
            actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        document.documentElement.setAttribute('data-theme', actualTheme);
        document.body.className = `${actualTheme}-theme`;
        
        // Сохраняем тему в localStorage для других компонентов
        localStorage.setItem('currentTheme', actualTheme);
    }

    applyAccentColor() {
        const color = this.userSettings.accentColor;
        
        // Применяем CSS переменные
        document.documentElement.style.setProperty('--accent-color', color);
        document.documentElement.style.setProperty('--accent-color-rgb', this.hexToRgb(color));
        document.documentElement.style.setProperty('--accent-color-dark', this.darkenColor(color, 20));
        document.documentElement.style.setProperty('--accent-color-light', this.lightenColor(color, 20));
        
        // Сохраняем в localStorage
        localStorage.setItem('accentColor', color);
        
        // Генерируем событие изменения цвета
        window.dispatchEvent(new CustomEvent('accentColorChanged', { 
            detail: { color: color } 
        }));
    }

    hexToRgb(hex) {
        // Конвертируем HEX в RGB
        let r = 0, g = 0, b = 0;
        
        if (hex.startsWith('#')) {
            hex = hex.substring(1);
            
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else if (hex.length === 6) {
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
            }
        }
        
        return `${r}, ${g}, ${b}`;
    }

    darkenColor(color, percent) {
        // Упрощенная функция затемнения цвета
        // В реальном проекте лучше использовать библиотеку или более сложную логику
        if (color.startsWith('#')) {
            let r = parseInt(color.substring(1, 3), 16);
            let g = parseInt(color.substring(3, 5), 16);
            let b = parseInt(color.substring(5, 7), 16);
            
            r = Math.max(0, r - (r * percent / 100));
            g = Math.max(0, g - (g * percent / 100));
            b = Math.max(0, b - (b * percent / 100));
            
            return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
        }
        return color;
    }

    lightenColor(color, percent) {
        // Упрощенная функция осветления цвета
        if (color.startsWith('#')) {
            let r = parseInt(color.substring(1, 3), 16);
            let g = parseInt(color.substring(3, 5), 16);
            let b = parseInt(color.substring(5, 7), 16);
            
            r = Math.min(255, r + ((255 - r) * percent / 100));
            g = Math.min(255, g + ((255 - g) * percent / 100));
            b = Math.min(255, b + ((255 - b) * percent / 100));
            
            return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
        }
        return color;
    }

    applyLayoutSettings() {
        if (this.userSettings.compactMode) {
            document.body.classList.add('compact-mode');
        } else {
            document.body.classList.remove('compact-mode');
        }

        if (!this.userSettings.showAvatars) {
            document.body.classList.add('hide-avatars');
        } else {
            document.body.classList.remove('hide-avatars');
        }

        if (!this.userSettings.animations) {
            document.body.classList.add('no-animations');
        } else {
            document.body.classList.remove('no-animations');
        }
    }

    openChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.style.display = 'flex';
            
            // Очищаем поля
            const currentPass = document.getElementById('currentPassword');
            const newPass = document.getElementById('newPassword');
            const confirmPass = document.getElementById('confirmPassword');
            
            if (currentPass) currentPass.value = '';
            if (newPass) newPass.value = '';
            if (confirmPass) confirmPass.value = '';
            
            // Сбрасываем индикатор силы пароля
            const strengthBar = document.querySelector('.strength-bar div');
            const strengthText = document.querySelector('.strength-text');
            if (strengthBar) {
                strengthBar.style.width = '0%';
                strengthBar.style.background = '#dc3545';
            }
            if (strengthText) {
                strengthText.textContent = 'Надежность пароля: Слабый';
                strengthText.style.color = '#6c757d';
            }
        }
    }

    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('Пароли не совпадают', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showNotification('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        try {
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            if (response.ok) {
                this.showNotification('Пароль успешно изменен', 'success');
                document.getElementById('changePasswordModal').style.display = 'none';
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Password change failed');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            this.showNotification(error.message || 'Ошибка смены пароля', 'error');
        }
    }

    checkPasswordStrength(password) {
        const strengthBar = document.querySelector('.strength-bar div');
        const strengthText = document.querySelector('.strength-text');
        
        if (!strengthBar || !strengthText) return;

        let strength = 0;
        let text = 'Слабый';
        let color = '#dc3545';

        if (password.length >= 8) strength += 25;
        if (/[A-Z]/.test(password)) strength += 25;
        if (/[0-9]/.test(password)) strength += 25;
        if (/[^A-Za-z0-9]/.test(password)) strength += 25;

        if (strength >= 75) {
            text = 'Сильный';
            color = '#28a745';
        } else if (strength >= 50) {
            text = 'Средний';
            color = '#ffc107';
        }

        strengthBar.style.width = `${strength}%`;
        strengthBar.style.background = color;
        strengthText.textContent = `Надежность пароля: ${text}`;
        strengthText.style.color = color;
    }

    async logoutAllDevices() {
        if (confirm('Вы уверены, что хотите выйти со всех устройств? Это завершит все активные сессии.')) {
            try {
                const response = await fetch('/api/user/logout-all', {
                    method: 'POST'
                });

                if (response.ok) {
                    this.showNotification('Все сессии завершены', 'success');
                    setTimeout(() => {
                        this.logout();
                    }, 2000);
                } else {
                    throw new Error('Logout all failed');
                }
            } catch (error) {
                console.error('Error logging out from all devices:', error);
                this.showNotification('Ошибка выхода со всех устройств', 'error');
            }
        }
    }

    testNotificationSound() {
        // Проигрываем тестовый звук
        const audio = new Audio('/sounds/notification.mp3');
        audio.play().catch(e => {
            console.log('Audio play failed:', e);
            this.showNotification('Не удалось воспроизвести звук', 'warning');
        });
        
        this.showNotification('Тестовый звук воспроизведен', 'info');
    }

    saveSettings() {
        // Сохраняем выбранный статус
        this.userSettings.userStatus = document.getElementById('userStatus').value;
        
        // Сохраняем чекбоксы
        this.userSettings.compactMode = document.getElementById('compactMode').checked;
        this.userSettings.showAvatars = document.getElementById('showAvatars').checked;
        this.userSettings.animations = document.getElementById('animations').checked;
        this.userSettings.showOnlineStatus = document.getElementById('showOnlineStatus').checked;
        this.userSettings.allowGroupInvites = document.getElementById('allowGroupInvites').checked;
        this.userSettings.allowPrivateMessages = document.getElementById('allowPrivateMessages').checked;
        this.userSettings.notifyMessages = document.getElementById('notifyMessages').checked;
        this.userSettings.notifyCalls = document.getElementById('notifyCalls').checked;
        this.userSettings.notifyMentions = document.getElementById('notifyMentions').checked;
        this.userSettings.soundEnabled = document.getElementById('soundEnabled').checked;
        this.userSettings.notificationSound = document.getElementById('notificationSound').value;

        this.saveUserSettings();
        this.applySettings();
        this.showNotification('Настройки сохранены', 'success');

        // Обновляем статус пользователя
        this.updateUserStatus();
    }

    resetSettings() {
        if (confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
            this.userSettings = { ...this.defaultSettings };
            this.saveUserSettings();
            this.applySettings();
            this.loadCurrentSettings();
            this.showNotification('Настройки сброшены', 'success');
        }
    }

    logout() {
        fetch('/api/logout', { method: 'POST' })
            .then(() => window.location.href = '/')
            .catch(() => window.location.href = '/');
    }

    updateUserStatus() {
        if (window.socket && this.userSettings.userStatus) {
            window.socket.emit('user_status_change', {
                username: this.currentUser,
                status: this.userSettings.userStatus
            });
        }
    }

    // Методы для управления подарками
    loadGiftsManagement() {
        const currentUser = document.getElementById('username')?.textContent;
        if (!currentUser || !window.giftManager) return;

        const userGifts = window.giftManager.userGifts.get(currentUser) || [];
        const equippedGifts = window.giftManager.getEquippedGifts(currentUser);
        
        this.updateEquippedGiftsList(equippedGifts, userGifts);
        this.updateUserGiftsManagementList(userGifts, currentUser);
    }

    updateEquippedGiftsList(equippedGifts, userGifts) {
        const equippedList = document.getElementById('equippedGiftsList');
        if (!equippedList) return;

        const slots = {
            head: 'Голова',
            badge: 'Значок', 
            background: 'Фон',
            effect: 'Эффект'
        };

        equippedList.innerHTML = Object.entries(slots).map(([slot, name]) => {
            const giftId = equippedGifts[slot];
            const gift = giftId ? userGifts.find(g => g.id === giftId) : null;
            
            return `
                <div class="equipped-slot-item" style="
                    border: 2px dashed ${gift ? this.userSettings.accentColor : '#dee2e6'};
                    border-radius: 10px;
                    padding: 15px;
                    text-align: center;
                    background: ${gift ? '#f8fff9' : '#f8f9fa'};
                    transition: border-color 0.3s ease;
                ">
                    <div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">${name}</div>
                    ${gift ? `
                        <div style="font-size: 24px; margin-bottom: 8px;">${gift.name.split(' ')[0]}</div>
                        <div style="font-size: 11px; color: #495057; margin-bottom: 10px;">${gift.name}</div>
                        <button class="unequip-gift-btn" data-slot="${slot}" data-gift-id="${gift.id}" style="
                            padding: 5px 10px;
                            background: #dc3545;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 11px;
                            transition: background 0.3s ease;
                        ">Снять</button>
                    ` : `
                        <div style="font-size: 20px; color: #6c757d; margin-bottom: 8px;">┄</div>
                        <div style="font-size: 11px; color: #6c757d;">Пусто</div>
                    `}
                </div>
            `;
        }).join('');

        // Обработчики для кнопок снятия
        equippedList.querySelectorAll('.unequip-gift-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const slot = e.target.getAttribute('data-slot');
                const giftId = e.target.getAttribute('data-gift-id');
                const currentUser = document.getElementById('username')?.textContent;
                
                try {
                    await window.giftManager.toggleGiftEquip(currentUser, giftId, slot);
                    this.showNotification('Подарок снят', 'success');
                    this.loadGiftsManagement();
                } catch (error) {
                    this.showNotification(error.message, 'error');
                }
            });
        });
    }

    updateUserGiftsManagementList(userGifts, currentUser) {
        const giftsList = document.getElementById('userGiftsManagementList');
        if (!giftsList) return;

        if (userGifts.length === 0) {
            giftsList.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🎁</div>
                    <div>У вас пока нет подарков</div>
                    <button class="open-gift-shop-btn" style="margin-top: 15px; padding: 8px 16px; background: ${this.userSettings.accentColor || '#ffc107'}; color: white; border: none; border-radius: 5px; cursor: pointer; transition: background 0.3s ease;">
                        🛒 Перейти в магазин
                    </button>
                </div>
            `;
            
            giftsList.querySelector('.open-gift-shop-btn')?.addEventListener('click', () => {
                if (window.currencyManager) {
                    window.currencyManager.openGiftShop();
                }
            });
            
            return;
        }

        giftsList.innerHTML = userGifts.map(gift => {
            const isEquipped = window.giftManager.isGiftEquipped(currentUser, gift.id);
            const canEquip = gift.wearable && !isEquipped;
            
            return `
                <div class="management-gift-item ${isEquipped ? 'equipped' : ''}" style="
                    border: 1px solid ${isEquipped ? this.userSettings.accentColor : '#dee2e6'};
                    border-radius: 8px;
                    padding: 10px;
                    text-align: center;
                    background: ${isEquipped ? `${this.userSettings.accentColor}10` : 'white'};
                    position: relative;
                    transition: all 0.3s ease;
                " data-gift-id="${gift.id}">
                    ${isEquipped ? `<div style="position: absolute; top: 5px; right: 5px; color: ${this.userSettings.accentColor}; font-size: 12px;">✓</div>` : ''}
                    <div style="font-size: 20px; margin-bottom: 5px;">${gift.name.split(' ')[0]}</div>
                    <div style="font-size: 10px; color: #6c757d; margin-bottom: 8px; height: 30px; overflow: hidden;">${gift.name}</div>
                    
                    ${gift.from ? `
                        <div style="font-size: 9px; color: #28a745; margin-bottom: 5px;">
                            от ${gift.from}
                        </div>
                    ` : ''}
                    
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        ${canEquip ? `
                            <button class="equip-gift-management-btn" style="
                                padding: 3px 8px;
                                background: ${this.userSettings.accentColor};
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 10px;
                                transition: background 0.3s ease;
                            ">Надеть</button>
                        ` : isEquipped ? `
                            <button class="unequip-gift-management-btn" style="
                                padding: 3px 8px;
                                background: #dc3545;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 10px;
                            ">Снять</button>
                        ` : ''}
                        
                        ${!gift.wearable ? `
                            <div style="font-size: 9px; color: #6c757d; padding: 2px;">
                                📦 Коллекционный
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Обработчики для кнопок управления
        giftsList.querySelectorAll('.equip-gift-management-btn, .unequip-gift-management-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const giftItem = e.target.closest('.management-gift-item');
                const giftId = giftItem.getAttribute('data-gift-id');
                const gift = userGifts.find(g => g.id === giftId);
                
                if (gift && gift.wearable) {
                    try {
                        await window.giftManager.toggleGiftEquip(currentUser, giftId, gift.slot);
                        this.showNotification(
                            window.giftManager.isGiftEquipped(currentUser, giftId) 
                                ? 'Подарок надет!' 
                                : 'Подарок снят!', 
                            'success'
                        );
                        this.loadGiftsManagement();
                    } catch (error) {
                        this.showNotification(error.message, 'error');
                    }
                }
            });
        });
    }

    // Методы для валюты
    loadCurrencyData() {
        if (window.currencyManager) {
            const balanceElement = document.getElementById('userBalance');
            if (balanceElement) balanceElement.textContent = window.currencyManager.balance || 0;
            
            const streakElement = document.getElementById('dailyStreak');
            if (streakElement) streakElement.textContent = `${window.currencyManager.dailyStreak || 0} дней`;
            
            this.updateCurrencyHistory();
            
            // Обновляем информацию о следующей награде
            this.updateNextRewardTime();
        }
    }

    updateNextRewardTime() {
        const nextRewardElement = document.getElementById('nextRewardTime');
        if (!nextRewardElement || !window.currencyManager) return;
        
        const lastClaim = localStorage.getItem(`dailyReward_${this.currentUser}`);
        if (!lastClaim) {
            nextRewardElement.textContent = 'Доступно сейчас!';
            nextRewardElement.style.color = '#28a745';
            return;
        }
        
        const lastClaimTime = new Date(lastClaim).getTime();
        const now = Date.now();
        const timeSinceLastClaim = now - lastClaimTime;
        const hoursUntilNext = Math.max(0, 24 - Math.floor(timeSinceLastClaim / (1000 * 60 * 60)));
        
        if (hoursUntilNext <= 0) {
            nextRewardElement.textContent = 'Доступно сейчас!';
            nextRewardElement.style.color = '#28a745';
        } else {
            nextRewardElement.textContent = `через ${hoursUntilNext} ч.`;
            nextRewardElement.style.color = '#ffc107';
        }
    }

    updateCurrencyHistory() {
        const historyElement = document.getElementById('currencyHistory');
        if (!historyElement || !window.currencyManager) return;

        const history = window.currencyManager.transactionHistory || [];

        if (history.length === 0) {
            historyElement.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">История операций пуста</div>';
            return;
        }

        historyElement.innerHTML = history.slice(0, 10).map(transaction => `
            <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                <div style="flex: 1;">
                    <div style="font-size: 12px; color: #495057;">${transaction.description}</div>
                    <div style="font-size: 10px; color: #6c757d;">${new Date(transaction.timestamp).toLocaleString()}</div>
                </div>
                <div style="font-weight: bold; color: ${transaction.amount >= 0 ? '#28a745' : '#dc3545'};">
                    ${transaction.amount >= 0 ? '+' : ''}${transaction.amount}
                </div>
            </div>
        `).join('');
    }

    showNotification(message, type = 'info') {
        // Используем существующую систему уведомлений
        if (window.privateChatInstance && typeof window.privateChatInstance.showNotification === 'function') {
            window.privateChatInstance.showNotification(message, type);
        } else {
            // Простая реализация, если privateChatInstance недоступен
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: bold;
                z-index: 10010;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                animation: slideIn 0.3s ease;
                background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : this.userSettings.accentColor || '#17a2b8'};
            `;
            
            // Добавляем анимацию
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.animation = 'slideIn 0.3s ease reverse';
                    setTimeout(() => notification.remove(), 300);
                }
            }, 3000);
        }
    }
}

// Инициализация SettingsManager
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Starting application initialization...');
    
    // Инициализируем менеджеры
    if (!window.currencyManager) {
        window.currencyManager = new CurrencyManager();
        console.log('✅ CurrencyManager initialized');
    }
    
    if (!window.giftManager) {
        window.giftManager = new GiftManager();
        console.log('✅ GiftManager initialized');
    }

    // Инициализируем SettingsManager
    if (!window.settingsManager) {
        window.settingsManager = new SettingsManager();
        console.log('✅ SettingsManager initialized');
    }

    // Обработчик для кнопки настроек
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('⚙️ Settings button clicked');
            if (window.settingsManager) {
                window.settingsManager.openSettings();
            }
        });
    }

    // Обработчик для кнопки профиля в мобильной навигации
    const mobileProfileBtn = document.getElementById('mobileProfileBtn');
    if (mobileProfileBtn) {
        mobileProfileBtn.addEventListener('click', function() {
            if (window.settingsManager) {
                window.settingsManager.openSettings();
            }
        });
    }

    // Обработчик для закрытия модальных окон
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('close-modal') || e.target.closest('.close-modal')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) modal.style.display = 'none';
        }
    });

    // Обработчик для клика вне модального окна
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.style.display = 'none';
        }
    });
    
    // Добавляем CSS переменные в корневой элемент
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --accent-color: #007bff;
            --accent-color-dark: #0056b3;
            --accent-color-light: #3395ff;
            --accent-color-rgb: 0, 123, 255;
        }
        
        .compact-mode .chat-message {
            padding: 4px 8px !important;
            margin: 2px 0 !important;
        }
        
        .hide-avatars .user-avatar,
        .hide-avatars .conversation-avatar,
        .hide-avatars .message-avatar {
            display: none !important;
        }
        
        .no-animations * {
            animation: none !important;
            transition: none !important;
        }
        
        .btn-primary {
            transition: background 0.3s ease, transform 0.2s ease;
        }
        
        .btn-primary:hover {
            transform: translateY(-1px);
        }
        
        .btn-primary:active {
            transform: translateY(1px);
        }
        
        .theme-option, .color-option {
            transition: all 0.3s ease;
        }
        
        .color-option:hover {
            transform: scale(1.1);
        }
    `;
    document.head.appendChild(style);
});

window.SettingsManager = SettingsManager;