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

        // Выбор цвета
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-option') || e.target.closest('.color-option')) {
                const option = e.target.classList.contains('color-option') ? e.target : e.target.closest('.color-option');
                this.selectAccentColor(option.getAttribute('data-color'));
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
                        <div style="font-size: 12px; color: #6c757d;">${this.currentUser}</div>
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
                        <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
                    </div>
                    
                    <div class="settings-content">
                        <!-- Вкладка профиля -->
                        <div id="tab-profile" class="settings-tab-content active">
                            <div class="profile-settings">
                                <div class="avatar-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🖼️ Аватар</h4>
                                    <div style="display: flex; align-items: center; gap: 20px;">
                                        <div id="avatarPreviewLarge" style="
                                            width: 100px;
                                            height: 100px;
                                            border-radius: 50%;
                                            border: 3px solid #007bff;
                                            overflow: hidden;
                                            cursor: pointer;
                                            background: #f8f9fa;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                        ">
                                            <img id="avatarPreviewImgLarge" src="/default-avatar.png" alt="Аватар" style="width: 100%; height: 100%; object-fit: cover;">
                                        </div>
                                        <div>
                                            <button id="uploadAvatarBtnSettings" class="btn-primary" style="
                                                padding: 8px 16px;
                                                background: #007bff;
                                                color: white;
                                                border: none;
                                                border-radius: 5px;
                                                cursor: pointer;
                                                font-size: 14px;
                                                margin-bottom: 5px;
                                                display: block;
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
                        
                        <!-- Вкладка внешнего вида -->
                        <div id="tab-appearance" class="settings-tab-content">
                            <div class="appearance-settings">
                                <div class="theme-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🌙 Тема</h4>
                                    <div class="theme-options" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                                        <div class="theme-option active" data-theme="auto" style="
                                            border: 2px solid #007bff;
                                            border-radius: 10px;
                                            padding: 15px;
                                            text-align: center;
                                            cursor: pointer;
                                            background: linear-gradient(45deg, #f8f9fa 50%, #343a40 50%);
                                        ">
                                            <div style="font-size: 24px;">🌓</div>
                                            <div style="font-size: 12px; margin-top: 5px;">Авто</div>
                                        </div>
                                        <div class="theme-option" data-theme="light" style="
                                            border: 1px solid #dee2e6;
                                            border-radius: 10px;
                                            padding: 15px;
                                            text-align: center;
                                            cursor: pointer;
                                            background: #f8f9fa;
                                        ">
                                            <div style="font-size: 24px;">☀️</div>
                                            <div style="font-size: 12px; margin-top: 5px;">Светлая</div>
                                        </div>
                                        <div class="theme-option" data-theme="dark" style="
                                            border: 1px solid #dee2e6;
                                            border-radius: 10px;
                                            padding: 15px;
                                            text-align: center;
                                            cursor: pointer;
                                            background: #343a40;
                                            color: white;
                                        ">
                                            <div style="font-size: 24px;">🌙</div>
                                            <div style="font-size: 12px; margin-top: 5px;">Темная</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="color-section" style="margin-bottom: 25px;">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🎨 Акцентный цвет</h4>
                                    <div class="color-options" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;">
                                        <div class="color-option active" data-color="#007bff" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #007bff;
                                            cursor: pointer;
                                            border: 3px solid #007bff;
                                        "></div>
                                        <div class="color-option" data-color="#28a745" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #28a745;
                                            cursor: pointer;
                                            border: 3px solid white;
                                        "></div>
                                        <div class="color-option" data-color="#dc3545" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #dc3545;
                                            cursor: pointer;
                                            border: 3px solid white;
                                        "></div>
                                        <div class="color-option" data-color="#ffc107" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #ffc107;
                                            cursor: pointer;
                                            border: 3px solid white;
                                        "></div>
                                        <div class="color-option" data-color="#6f42c1" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #6f42c1;
                                            cursor: pointer;
                                            border: 3px solid white;
                                        "></div>
                                        <div class="color-option" data-color="#fd7e14" style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background: #fd7e14;
                                            cursor: pointer;
                                            border: 3px solid white;
                                        "></div>
                                    </div>
                                </div>
                                
                                <div class="layout-section">
                                    <h4 style="margin-bottom: 15px; color: #495057;">📐 Оформление</h4>
                                    <div class="checkbox-group" style="display: flex; flex-direction: column; gap: 15px;">
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="compactMode" class="checkbox-input" style="transform: scale(1.2);">
                                            <span>Компактный режим</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="showAvatars" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Показывать аватары</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="animations" class="checkbox-input" style="transform: scale(1.2);" checked>
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
                                            <input type="checkbox" id="notifyMessages" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Новые сообщения</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="notifyCalls" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Входящие звонки</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="notifyMentions" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Упоминания</span>
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="sound-section">
                                    <h4 style="margin-bottom: 15px; color: #495057;">🔊 Звук</h4>
                                    <div class="checkbox-group" style="display: flex; flex-direction: column; gap: 15px;">
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="soundEnabled" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Включить звук</span>
                                        </label>
                                        <div class="form-group">
                                            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Звук уведомления</label>
                                            <select id="notificationSound" class="form-control" style="
                                                width: 100%;
                                                padding: 10px;
                                                border: 1px solid #ced4da;
                                                border-radius: 5px;
                                            ">
                                                <option value="default">🔔 По умолчанию</option>
                                                <option value="chime">🎵 Мелодия</option>
                                                <option value="bell">🔔 Колокольчик</option>
                                                <option value="pop">💥 Хлопок</option>
                                            </select>
                                        </div>
                                        <button id="testSoundBtn" class="btn-secondary" style="
                                            padding: 8px 16px;
                                            background: #6c757d;
                                            color: white;
                                            border: none;
                                            border-radius: 5px;
                                            cursor: pointer;
                                            font-size: 14px;
                                            align-self: flex-start;
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
                                            <input type="checkbox" id="showOnlineStatus" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Показывать статус "В сети"</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="allowGroupInvites" class="checkbox-input" style="transform: scale(1.2);" checked>
                                            <span>Разрешить приглашения в группы</span>
                                        </label>
                                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <input type="checkbox" id="allowPrivateMessages" class="checkbox-input" style="transform: scale(1.2);" checked>
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
                                        background: #007bff;
                                        color: white;
                                        border: none;
                                        border-radius: 5px;
                                        cursor: pointer;
                                        font-size: 14px;
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
            ">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                    <h3 style="margin: 0; color: #333;">🔑 Смена пароля</h3>
                    <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
                </div>
                
                <div class="password-form">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Текущий пароль</label>
                        <input type="password" id="currentPassword" class="form-control" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ced4da;
                            border-radius: 5px;
                        ">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #495057;">Новый пароль</label>
                        <input type="password" id="newPassword" class="form-control" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ced4da;
                            border-radius: 5px;
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
                        ">
                    </div>
                    
                    <button id="confirmPasswordChange" class="btn-primary" style="
                        width: 100%;
                        padding: 12px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
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
        this.createSettingsModal(); // Создаем модальное окно если его нет
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
        activeTab.style.background = '#007bff';
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
    }
}

    loadCurrentSettings() {
        // Загружаем текущие настройки в форму
        document.getElementById('usernameDisplay').value = this.currentUser;
        document.getElementById('userStatus').value = this.userSettings.userStatus;

        // Тема
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            option.style.borderColor = '#dee2e6';
        });
        
        const activeTheme = document.querySelector(`.theme-option[data-theme="${this.userSettings.theme}"]`);
        if (activeTheme) {
            activeTheme.classList.add('active');
            activeTheme.style.borderColor = '#007bff';
        }

        // Цвет
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
            option.style.borderColor = 'white';
        });
        
        const activeColor = document.querySelector(`.color-option[data-color="${this.userSettings.accentColor}"]`);
        if (activeColor) {
            activeColor.classList.add('active');
            activeColor.style.borderColor = activeColor.getAttribute('data-color');
        }

        // Чекбоксы
        document.getElementById('compactMode').checked = this.userSettings.compactMode;
        document.getElementById('showAvatars').checked = this.userSettings.showAvatars;
        document.getElementById('animations').checked = this.userSettings.animations;
        document.getElementById('showOnlineStatus').checked = this.userSettings.showOnlineStatus;
        document.getElementById('allowGroupInvites').checked = this.userSettings.allowGroupInvites;
        document.getElementById('allowPrivateMessages').checked = this.userSettings.allowPrivateMessages;
        document.getElementById('notifyMessages').checked = this.userSettings.notifyMessages;
        document.getElementById('notifyCalls').checked = this.userSettings.notifyCalls;
        document.getElementById('notifyMentions').checked = this.userSettings.notifyMentions;
        document.getElementById('soundEnabled').checked = this.userSettings.soundEnabled;

        // Звук уведомлений
        document.getElementById('notificationSound').value = this.userSettings.notificationSound;

        // Загружаем аватар
        this.loadUserAvatar();
    }

    async loadUserAvatar() {
        try {
            const response = await fetch(`/api/user/${this.currentUser}`);
            if (response.ok) {
                const userData = await response.json();
                const avatarUrl = userData.avatar || '/default-avatar.png';
                document.getElementById('avatarPreviewImgLarge').src = avatarUrl;
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
                document.getElementById('avatarPreviewImgLarge').src = result.avatar;
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
            // Здесь должна быть логика удаления аватара на сервере
            // Пока просто сбрасываем на дефолтный
            document.getElementById('avatarPreviewImgLarge').src = '/default-avatar.png';
            this.showNotification('Аватар удален', 'success');
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
            selectedTheme.style.borderColor = '#007bff';
        }
        
        this.userSettings.theme = theme;
        this.applyTheme();
    }

    selectAccentColor(color) {
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
            option.style.borderColor = 'white';
        });
        
        const selectedColor = document.querySelector(`.color-option[data-color="${color}"]`);
        if (selectedColor) {
            selectedColor.classList.add('active');
            selectedColor.style.borderColor = color;
        }
        
        this.userSettings.accentColor = color;
        this.applyAccentColor();
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
    }

    applyAccentColor() {
        const color = this.userSettings.accentColor;
        document.documentElement.style.setProperty('--accent-color', color);
        document.documentElement.style.setProperty('--accent-color-dark', this.darkenColor(color, 20));
        document.documentElement.style.setProperty('--accent-color-light', this.lightenColor(color, 20));
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

    darkenColor(color, percent) {
        // Упрощенная функция затемнения цвета
        return color;
    }

    lightenColor(color, percent) {
        // Упрощенная функция осветления цвета
        return color;
    }

    openChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
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
            // Здесь должна быть логика смены пароля на сервере
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
                throw new Error('Password change failed');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            this.showNotification('Ошибка смены пароля', 'error');
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
        audio.play().catch(e => console.log('Audio play failed:', e));
        this.showNotification('Тестовый звук воспроизведен', 'info');
    }

    saveSettings() {
        // Сохраняем выбранный статус
        this.userSettings.userStatus = document.getElementById('userStatus').value;

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
                    border: 2px dashed ${gift ? '#28a745' : '#dee2e6'};
                    border-radius: 10px;
                    padding: 15px;
                    text-align: center;
                    background: ${gift ? '#f8fff9' : '#f8f9fa'};
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
                    <button class="open-gift-shop-btn" style="margin-top: 15px; padding: 8px 16px; background: #ffc107; color: #212529; border: none; border-radius: 5px; cursor: pointer;">
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
                    border: 1px solid ${isEquipped ? '#007bff' : '#dee2e6'};
                    border-radius: 8px;
                    padding: 10px;
                    text-align: center;
                    background: ${isEquipped ? '#e7f3ff' : 'white'};
                    position: relative;
                " data-gift-id="${gift.id}">
                    ${isEquipped ? '<div style="position: absolute; top: 5px; right: 5px; color: #007bff; font-size: 12px;">✓</div>' : ''}
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
                                background: #28a745;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 10px;
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
            document.getElementById('userBalance').textContent = window.currencyManager.balance;
            document.getElementById('dailyStreak').textContent = `${window.currencyManager.dailyStreak} дней`;
            this.updateCurrencyHistory();
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
                    <div style="font-size: 10px; color: #6c757d;">${new Date(transaction.timestamp).toLocaleDateString()}</div>
                </div>
                <div style="font-weight: bold; color: ${transaction.amount >= 0 ? '#28a745' : '#dc3545'};">
                    ${transaction.amount >= 0 ? '+' : ''}${transaction.amount}
                </div>
            </div>
        `).join('');
    }

    showNotification(message, type = 'info') {
        // Используем существующую систему уведомлений
        if (window.privateChatInstance) {
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
                background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
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

    // Обработчик для кнопки настроек (дублируем для надежности)
    document.getElementById('settingsBtn')?.addEventListener('click', function() {
        console.log('⚙️ Settings button clicked');
        if (window.settingsManager) {
            window.settingsManager.openSettings();
        } else {
            // Fallback: открываем модальное окно напрямую
            const modal = document.getElementById('settingsModal');
            if (modal) {
                modal.style.display = 'flex';
                console.log('✅ Settings modal opened directly');
            } else {
                console.error('❌ Settings modal not found');
            }
        }
    });

    // Обработчик для закрытия модальных окон
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal-overlay').style.display = 'none';
        });
    });

    // Обработчик для клика вне модального окна
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    });
});
window.SettingsManager = SettingsManager;