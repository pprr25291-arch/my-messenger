class ProfileManager {
    constructor() {
        this.currentProfile = null;
        this.userProfiles = new Map();
        this.isModalOpen = false;
        this.init();
    }

    async init() {
        this.setupProfileViewer();
        this.setupEventListeners();
        this.setupGlobalHandlers();
        console.log('✅ ProfileManager initialized');
    }

    setupProfileViewer() {
        console.log('🔄 Setting up profile viewer...');
        // Создаем модальное окно для профиля
        this.createProfileModal();
    }

    setupGlobalHandlers() {
        // Глобальный обработчик для аватаров
        document.addEventListener('click', (e) => {
            const avatar = e.target.closest('.user-avatar, .avatar, [data-username]');
            if (avatar) {
                const username = avatar.dataset.username || avatar.alt || avatar.textContent.trim();
                if (username && username !== 'undefined') {
                    this.viewProfile(username);
                }
            }
        });

        // Закрытие модального окна по клику вне его
        document.addEventListener('click', (e) => {
            if (this.isModalOpen && e.target.classList.contains('profile-modal')) {
                this.closeProfile();
            }
        });

        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (this.isModalOpen && e.key === 'Escape') {
                this.closeProfile();
            }
        });
    }

    setupEventListeners() {
        // Дополнительные обработчики событий
        document.addEventListener('user_avatar_updated', (e) => {
            if (this.currentProfile && this.currentProfile.username === e.detail.username) {
                this.refreshProfile();
            }
        });
    }

    // Создание модального окна для профиля
    createProfileModal() {
        if (document.getElementById('profileModal')) return;

        const modal = document.createElement('div');
        modal.id = 'profileModal';
        modal.className = 'profile-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            overflow-y: auto;
            padding: 20px;
            box-sizing: border-box;
        `;

        modal.innerHTML = `
            <div class="profile-modal-content" style="
                max-width: 500px;
                margin: 20px auto;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                position: relative;
                animation: profileSlideIn 0.3s ease-out;
            ">
                <div class="profile-modal-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 25px 0;
                    border-bottom: 1px solid #e9ecef;
                ">
                    <h3 style="margin: 0; color: #333; font-size: 1.4rem;">Профиль пользователя</h3>
                    <button class="close-profile-btn" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #6c757d;
                        padding: 5px;
                        border-radius: 50%;
                        width: 36px;
                        height: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">&times;</button>
                </div>
                <div class="profile-modal-body" style="padding: 25px; max-height: 80vh; overflow-y: auto;">
                    <div id="profileContent"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчик закрытия
        modal.querySelector('.close-profile-btn').addEventListener('click', () => {
            this.closeProfile();
        });

        // Анимация
        this.addProfileStyles();
    }

    addProfileStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes profileSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-50px) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            .profile-modal-content {
                scrollbar-width: thin;
                scrollbar-color: #c1c1c1 transparent;
            }

            .profile-modal-content::-webkit-scrollbar {
                width: 6px;
            }

            .profile-modal-content::-webkit-scrollbar-track {
                background: transparent;
            }

            .profile-modal-content::-webkit-scrollbar-thumb {
                background-color: #c1c1c1;
                border-radius: 3px;
            }

            .gift-item-profile {
                transition: all 0.2s ease;
                cursor: pointer;
            }

            .gift-item-profile:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .gift-item-profile.equipped {
                border-color: #007bff;
                background: linear-gradient(135deg, #e7f3ff, #d4e7ff);
            }

            .profile-action-btn {
                transition: all 0.2s ease;
            }

            .profile-action-btn:hover {
                transform: translateY(-1px);
                filter: brightness(1.1);
            }

            .stat-item {
                transition: transform 0.2s ease;
            }

            .stat-item:hover {
                transform: scale(1.05);
            }
        `;
        document.head.appendChild(style);
    }

    // Основной метод отображения профиля
    displayProfile(profileData) {
        const profileContent = document.getElementById('profileContent');
        if (!profileContent) {
            this.createProfileModal();
            setTimeout(() => this.displayProfile(profileData), 100);
            return;
        }

        const currentUser = this.getCurrentUser();
        const isOwnProfile = currentUser === profileData.username;
        const equippedGifts = window.giftManager ? window.giftManager.getEquippedGifts(profileData.username) : {};
        const userGifts = window.giftManager ? window.giftManager.getUserGifts(profileData.username) || [] : [];

        profileContent.innerHTML = `
            <div class="profile-header" style="text-align: center; margin-bottom: 25px; position: relative;">
                <!-- Отображение надетых подарков -->
                <div class="equipped-gifts-overlay" style="position: relative; display: inline-block; margin-bottom: 15px;">
                    ${this.renderEquippedGifts(equippedGifts, profileData.username)}
                    <div class="profile-avatar-container" style="position: relative; display: inline-block;">
                        <img src="${profileData.avatar}" 
                             alt="${profileData.username}" 
                             class="profile-avatar-img"
                             style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid #007bff; object-fit: cover;"
                             onerror="this.src='/default-avatar.png'">
                        ${this.getStatusIndicator(profileData.status)}
                        ${isOwnProfile ? `
                            <button class="change-avatar-btn" style="
                                position: absolute;
                                bottom: 5px;
                                left: 5px;
                                background: #28a745;
                                color: white;
                                border: none;
                                border-radius: 50%;
                                width: 30px;
                                height: 30px;
                                cursor: pointer;
                                font-size: 14px;
                            ">📷</button>
                        ` : ''}
                    </div>
                </div>
                
                <h4 style="margin: 15px 0 5px 0; color: #333; font-size: 1.3rem;">${profileData.username}</h4>
                
                <div class="profile-meta" style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 15px; flex-wrap: wrap;">
                    <div class="profile-status" style="color: #6c757d; display: flex; align-items: center; gap: 5px;">
                        ${this.getStatusText(profileData.status)}
                    </div>
                    <div class="profile-balance" style="background: #e7f3ff; padding: 4px 12px; border-radius: 20px; color: #007bff; font-weight: bold; font-size: 0.9rem;">
                        💰 ${profileData.balance || 0} монет
                    </div>
                </div>

                ${isOwnProfile ? `
                    <button class="edit-profile-btn profile-action-btn" style="
                        padding: 10px 20px; 
                        background: linear-gradient(135deg, #007bff, #0056b3); 
                        color: white; 
                        border: none; 
                        border-radius: 25px; 
                        cursor: pointer; 
                        font-size: 14px;
                        font-weight: 600;
                        margin: 5px;
                    ">✏️ Редактировать профиль</button>
                ` : `
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button class="start-chat-profile-btn profile-action-btn" style="
                            padding: 10px 20px; 
                            background: linear-gradient(135deg, #007bff, #0056b3); 
                            color: white; 
                            border: none; 
                            border-radius: 25px; 
                            cursor: pointer; 
                            font-size: 14px;
                            font-weight: 600;
                        ">💬 Написать сообщение</button>
                        <button class="send-gift-profile-btn profile-action-btn" style="
                            padding: 10px 20px; 
                            background: linear-gradient(135deg, #28a745, #1e7e34); 
                            color: white; 
                            border: none; 
                            border-radius: 25px; 
                            cursor: pointer; 
                            font-size: 14px;
                            font-weight: 600;
                        ">🎁 Отправить подарок</button>
                    </div>
                `}
            </div>

            <div class="profile-info" style="margin-bottom: 25px;">
                <div class="info-section">
                    <h5 style="margin-bottom: 15px; color: #495057; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                        📊 Статистика
                    </h5>
                    <div class="stats-grid" style="
                        display: grid; 
                        grid-template-columns: repeat(3, 1fr); 
                        gap: 15px; 
                        text-align: center;
                    ">
                        <div class="stat-item" style="
                            padding: 15px 10px; 
                            background: #f8f9fa; 
                            border-radius: 10px; 
                            border: 2px solid #e9ecef;
                        ">
                            <div style="font-size: 11px; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px;">Сообщения</div>
                            <div style="font-weight: bold; font-size: 20px; color: #007bff;">${profileData.stats?.messagesSent || 0}</div>
                        </div>
                        <div class="stat-item" style="
                            padding: 15px 10px; 
                            background: #f8f9fa; 
                            border-radius: 10px; 
                            border: 2px solid #e9ecef;
                        ">
                            <div style="font-size: 11px; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px;">Группы</div>
                            <div style="font-weight: bold; font-size: 20px; color: #28a745;">${profileData.stats?.groupsCreated || 0}</div>
                        </div>
                        <div class="stat-item" style="
                            padding: 15px 10px; 
                            background: #f8f9fa; 
                            border-radius: 10px; 
                            border: 2px solid #e9ecef;
                        ">
                            <div style="font-size: 11px; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px;">Дни</div>
                            <div style="font-weight: bold; font-size: 20px; color: #ffc107;">${profileData.stats?.daysActive || 1}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="profile-bio" style="
                margin-bottom: 25px; 
                padding: 20px; 
                background: linear-gradient(135deg, #f8f9fa, #e9ecef); 
                border-radius: 12px;
                border-left: 4px solid #007bff;
            ">
                <h5 style="margin-bottom: 12px; color: #495057; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                    📝 О себе
                </h5>
                <div class="bio-text" style="color: #333; line-height: 1.6; font-size: 14px; min-height: 20px;">
                    ${profileData.bio || 'Пользователь еще не добавил информацию о себе.'}
                </div>
                ${isOwnProfile ? `
                    <button class="edit-bio-btn profile-action-btn" style="
                        margin-top: 15px; 
                        padding: 8px 16px; 
                        background: #28a745; 
                        color: white; 
                        border: none; 
                        border-radius: 20px; 
                        cursor: pointer; 
                        font-size: 13px;
                        font-weight: 600;
                    ">${profileData.bio ? '✏️ Редактировать' : '+ Добавить описание'}</button>
                ` : ''}
            </div>

            <div class="profile-gifts">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h5 style="margin: 0; color: #495057; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                        🎁 Подарки 
                        <span style="background: #007bff; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                            ${userGifts.length}
                        </span>
                    </h5>
                    ${isOwnProfile ? `
                        <div>
                            <button class="open-gift-shop-btn profile-action-btn" style="
                                padding: 8px 16px; 
                                background: linear-gradient(135deg, #ffc107, #e0a800); 
                                color: #212529; 
                                border: none; 
                                border-radius: 20px; 
                                cursor: pointer; 
                                font-size: 13px;
                                font-weight: 600;
                            ">🛒 Магазин подарков</button>
                        </div>
                    ` : ''}
                </div>
                
                ${userGifts.length > 0 ? `
                    <div class="gifts-display" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
                        gap: 12px;
                        padding: 20px;
                        background: white;
                        border: 2px solid #e9ecef;
                        border-radius: 12px;
                        max-height: 400px;
                        overflow-y: auto;
                    ">
                        ${userGifts.map(gift => this.renderGiftItem(gift, profileData.username, isOwnProfile)).join('')}
                    </div>
                ` : `
                    <div style="
                        text-align: center; 
                        padding: 40px 20px; 
                        color: #6c757d; 
                        background: linear-gradient(135deg, #f8f9fa, #e9ecef); 
                        border-radius: 12px;
                        border: 2px dashed #dee2e6;
                    ">
                        <div style="font-size: 48px; margin-bottom: 15px;">🎁</div>
                        <div style="font-size: 16px; margin-bottom: 10px; font-weight: 600;">
                            ${isOwnProfile ? 'У вас пока нет подарков' : 'У пользователя пока нет подарков'}
                        </div>
                        <div style="font-size: 14px; margin-bottom: 20px; color: #8a8a8a;">
                            ${isOwnProfile ? 'Приобретите подарки в магазине или получите их от друзей' : 'Отправьте пользователю подарок, чтобы порадовать его!'}
                        </div>
                        ${isOwnProfile ? `
                            <button class="open-gift-shop-btn profile-action-btn" style="
                                padding: 12px 24px; 
                                background: linear-gradient(135deg, #ffc107, #e0a800); 
                                color: #212529; 
                                border: none; 
                                border-radius: 25px; 
                                cursor: pointer; 
                                font-size: 14px;
                                font-weight: 600;
                            ">🛒 Посмотреть магазин</button>
                        ` : `
                            <button class="send-gift-profile-btn profile-action-btn" style="
                                padding: 12px 24px; 
                                background: linear-gradient(135deg, #28a745, #1e7e34); 
                                color: white; 
                                border: none; 
                                border-radius: 25px; 
                                cursor: pointer; 
                                font-size: 14px;
                                font-weight: 600;
                            ">🎁 Отправить подарок</button>
                        `}
                    </div>
                `}
            </div>

            ${isOwnProfile ? `
                <div class="profile-actions" style="
                    margin-top: 30px; 
                    padding-top: 25px; 
                    border-top: 2px solid #e9ecef;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                ">
                    <button class="open-gift-shop-main profile-action-btn" style="
                        width: 100%; 
                        padding: 15px; 
                        background: linear-gradient(135deg, #ffc107, #e0a800); 
                        color: #212529; 
                        border: none; 
                        border-radius: 12px; 
                        cursor: pointer; 
                        font-size: 15px;
                        font-weight: 600;
                    ">🛒 Магазин подарков</button>
                    <button class="open-settings profile-action-btn" style="
                        width: 100%; 
                        padding: 15px; 
                        background: linear-gradient(135deg, #6c757d, #5a6268); 
                        color: white; 
                        border: none; 
                        border-radius: 12px; 
                        cursor: pointer; 
                        font-size: 15px;
                        font-weight: 600;
                    ">⚙️ Настройки профиля</button>
                </div>
            ` : ''}
        `;

        // Добавляем обработчики событий
        this.setupProfileEventHandlers(isOwnProfile, profileData.username);
    }

    // Рендер надетых подарков
    renderEquippedGifts(equippedGifts, username) {
        let html = '';
        const userGifts = window.giftManager ? window.giftManager.getUserGifts(username) || [] : [];
        
        Object.entries(equippedGifts).forEach(([slot, giftId]) => {
            if (giftId) {
                const gift = userGifts.find(g => g.id === giftId);
                if (gift) {
                    const positions = {
                        head: 'top: -25px; left: 50%; transform: translateX(-50%); font-size: 28px;',
                        badge: 'bottom: 15px; right: 15px; font-size: 20px;',
                        background: 'top: -10px; left: -10px; width: 120px; height: 120px; font-size: 16px; background: rgba(0,123,255,0.1); border-radius: 50%;',
                        effect: 'top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px;'
                    };
                    
                    html += `<div class="equipped-gift ${slot}" style="
                        position: absolute; 
                        ${positions[slot] || ''}
                        z-index: ${slot === 'background' ? 1 : 10};
                        pointer-events: none;
                    ">${gift.emoji || gift.name.split(' ')[0]}</div>`;
                }
            }
        });
        
        return html;
    }

    renderGiftItem(gift, username, isOwnProfile) {
        const isEquipped = window.giftManager ? window.giftManager.isGiftEquipped(username, gift.id) : false;
        const canEquip = gift.wearable && isOwnProfile;
        const isFromSomeone = gift.from && gift.from !== username;
        
        return `
            <div class="gift-item-profile ${isEquipped ? 'equipped' : ''}" 
                 style="
                    text-align: center; 
                    padding: 15px 8px; 
                    background: ${isEquipped ? 'linear-gradient(135deg, #e7f3ff, #d4e7ff)' : 'white'}; 
                    border-radius: 10px; 
                    border: 2px solid ${isEquipped ? '#007bff' : '#e9ecef'}; 
                    position: relative;
                    transition: all 0.3s ease;
                 "
                 data-gift-id="${gift.id}"
                 title="${gift.name}">
                ${isEquipped ? `
                    <div style="
                        position: absolute; 
                        top: 5px; 
                        right: 5px; 
                        background: #007bff; 
                        color: white; 
                        border-radius: 50%; 
                        width: 20px; 
                        height: 20px; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        font-size: 12px;
                    ">✓</div>
                ` : ''}
                <div style="font-size: 32px; margin-bottom: 8px; height: 40px; display: flex; align-items: center; justify-content: center;">
                    ${gift.emoji || gift.name.split(' ')[0]}
                </div>
                <div style="font-size: 11px; color: #495057; margin-bottom: 10px; height: 30px; overflow: hidden; line-height: 1.3;">
                    ${gift.name}
                </div>
                ${isFromSomeone ? `
                    <div style="
                        font-size: 9px; 
                        color: #28a745; 
                        margin-bottom: 8px; 
                        background: #d4edda; 
                        padding: 3px 6px; 
                        border-radius: 8px;
                        font-weight: 600;
                    ">
                        от ${gift.from}
                    </div>
                ` : ''}
                ${canEquip ? `
                    <button class="equip-gift-btn profile-action-btn" style="
                        padding: 6px 12px; 
                        background: ${isEquipped ? 'linear-gradient(135deg, #dc3545, #c82333)' : 'linear-gradient(135deg, #28a745, #1e7e34)'}; 
                        color: white; 
                        border: none; 
                        border-radius: 15px; 
                        cursor: pointer; 
                        font-size: 10px;
                        font-weight: 600;
                        width: 100%;
                    ">
                        ${isEquipped ? 'Снять' : 'Надеть'}
                    </button>
                ` : ''}
                ${!isOwnProfile && gift.wearable ? `
                    <div style="font-size: 9px; color: #6c757d; margin-top: 5px;">
                        🎽 Можно надеть
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Настройка обработчиков событий профиля
    setupProfileEventHandlers(isOwnProfile, username) {
        if (isOwnProfile) {
            // Обработчики для собственного профиля
            const editBtn = document.querySelector('.edit-profile-btn');
            const editBioBtn = document.querySelector('.edit-bio-btn');
            const giftShopBtns = document.querySelectorAll('.open-gift-shop-btn, .open-gift-shop-main');
            const settingsBtn = document.querySelector('.open-settings');
            const changeAvatarBtn = document.querySelector('.change-avatar-btn');

            editBtn?.addEventListener('click', () => {
                this.openEditProfile();
            });

            editBioBtn?.addEventListener('click', () => {
                this.editBio();
            });

            giftShopBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (window.currencyManager) {
                        window.currencyManager.openGiftShop();
                        this.closeProfile();
                    }
                });
            });

            settingsBtn?.addEventListener('click', () => {
                this.openSettings();
            });

            changeAvatarBtn?.addEventListener('click', () => {
                this.changeAvatar();
            });

        } else {
            // Обработчики для чужого профиля
            const chatBtn = document.querySelector('.start-chat-profile-btn');
            const giftBtn = document.querySelectorAll('.send-gift-profile-btn');

            chatBtn?.addEventListener('click', () => {
                this.startChatWithUser(username);
            });

            giftBtn.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.openSendGiftModal(username);
                });
            });
        }

        // Обработчики для кнопок надевания/снятия подарков
        document.querySelectorAll('.equip-gift-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const giftItem = e.target.closest('.gift-item-profile');
                const giftId = giftItem.getAttribute('data-gift-id');
                
                try {
                    await window.giftManager.toggleGiftEquip(username, giftId);
                    this.showNotification(
                        window.giftManager.isGiftEquipped(username, giftId) 
                            ? 'Подарок надет!' 
                            : 'Подарок снят!', 
                        'success'
                    );
                    // Обновляем отображение профиля
                    this.viewProfile(username);
                } catch (error) {
                    this.showNotification(error.message, 'error');
                }
            });
        });
    }

    // Метод для просмотра профиля
    async viewProfile(username) {
        try {
            console.log('👤 Loading profile for:', username);
            
            // Показываем индикатор загрузки
            this.showLoadingProfile();

            // Открываем модальное окно
            this.openProfileModal();

            // Загружаем данные профиля
            const [profileResponse, currencyResponse] = await Promise.allSettled([
                fetch(`/api/user/${username}/profile`),
                fetch(`/api/user/${username}/currency`)
            ]);

            let profileData = {
                username: username,
                avatar: '/default-avatar.png',
                status: 'offline',
                stats: {
                    messagesSent: 0,
                    groupsCreated: 0,
                    daysActive: 1
                },
                bio: '',
                balance: 0
            };

            // Обрабатываем данные профиля
            if (profileResponse.status === 'fulfilled' && profileResponse.value.ok) {
                const userProfile = await profileResponse.value.json();
                Object.assign(profileData, userProfile);
            }

            // Обрабатываем баланс
            if (currencyResponse.status === 'fulfilled' && currencyResponse.value.ok) {
                const currencyData = await currencyResponse.value.json();
                profileData.balance = currencyData.balance || 0;
            }

            // Проверяем онлайн статус
            if (window.privateChatInstance && window.privateChatInstance.onlineUsers) {
                profileData.status = window.privateChatInstance.onlineUsers.has(username) ? 'online' : 'offline';
            }

            // Обновляем аватар
            if (window.privateChatInstance) {
                profileData.avatar = await window.privateChatInstance.loadUserAvatarSafe(username);
            }

            this.currentProfile = profileData;
            this.displayProfile(profileData);

        } catch (error) {
            console.error('❌ Error loading profile:', error);
            this.showNotification('Ошибка загрузки профиля', 'error');
            this.closeProfile();
        }
    }

    // Открытие модального окна профиля
    openProfileModal() {
        const modal = document.getElementById('profileModal');
        if (modal) {
            modal.style.display = 'flex';
            this.isModalOpen = true;
            document.body.style.overflow = 'hidden';
        }
    }

    // Закрытие модального окна профиля
    closeProfile() {
        const modal = document.getElementById('profileModal');
        if (modal) {
            modal.style.display = 'none';
            this.isModalOpen = false;
            document.body.style.overflow = '';
            this.currentProfile = null;
        }
    }

    showLoadingProfile() {
        const profileContent = document.getElementById('profileContent');
        if (!profileContent) return;

        profileContent.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">👤</div>
                <div style="color: #6c757d; font-size: 16px; margin-bottom: 10px;">Загрузка профиля...</div>
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto;
                "></div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
    }

    // Открытие модального окна отправки подарка
    openSendGiftModal(receiverUsername) {
        if (!window.privateChatInstance) {
            this.showNotification('Система подарков недоступна', 'error');
            return;
        }
        window.privateChatInstance.openGiftSelectionModal(receiverUsername);
        this.closeProfile();
    }

    // Начать чат с пользователем
    startChatWithUser(username) {
        if (window.privateChatInstance) {
            window.privateChatInstance.startChat(username);
            this.closeProfile();
            this.showNotification(`Чат с ${username} открыт`, 'success');
        }
    }

    // Редактирование профиля
    openEditProfile() {
        this.showAdvancedEditModal();
    }

    // Расширенное модальное окно редактирования
    showAdvancedEditModal() {
        const modal = document.createElement('div');
        modal.className = 'edit-profile-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
            ">
                <h3 style="margin-top: 0; color: #333;">Редактирование профиля</h3>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Аватар</label>
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <img src="${this.currentProfile.avatar}" 
                             alt="Аватар" 
                             style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
                        <div>
                            <button onclick="profileManager.uploadNewAvatar()" style="
                                padding: 8px 16px;
                                background: #007bff;
                                color: white;
                                border: none;
                                border-radius: 5px;
                                cursor: pointer;
                                margin-bottom: 5px;
                                display: block;
                            ">📁 Загрузить новый</button>
                            <button onclick="profileManager.removeAvatar()" style="
                                padding: 8px 16px;
                                background: #dc3545;
                                color: white;
                                border: none;
                                border-radius: 5px;
                                cursor: pointer;
                                display: block;
                            ">🗑️ Удалить</button>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">О себе</label>
                    <textarea id="editBioText" style="
                        width: 100%;
                        height: 100px;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        resize: vertical;
                    ">${this.currentProfile.bio || ''}</textarea>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="this.closest('.edit-profile-modal').remove()" style="
                        padding: 10px 20px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Отмена</button>
                    <button onclick="profileManager.saveProfileChanges()" style="
                        padding: 10px 20px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Сохранить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Закрытие по клику вне окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async uploadNewAvatar() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const formData = new FormData();
                    formData.append('avatar', file);

                    const response = await fetch('/api/user/avatar', {
                        method: 'POST',
                        body: formData
                    });

                    if (response.ok) {
                        const result = await response.json();
                        this.showNotification('Аватар успешно обновлен', 'success');
                        this.refreshProfile();
                        // Закрываем модальное окно редактирования
                        document.querySelector('.edit-profile-modal')?.remove();
                    } else {
                        throw new Error('Upload failed');
                    }
                } catch (error) {
                    this.showNotification('Ошибка загрузки аватара', 'error');
                }
            }
        };
        
        input.click();
    }

    async removeAvatar() {
        if (confirm('Удалить текущий аватар?')) {
            try {
                // Здесь должна быть логика удаления аватара
                this.showNotification('Функция удаления аватара будет добавлена', 'info');
            } catch (error) {
                this.showNotification('Ошибка удаления аватара', 'error');
            }
        }
    }

    async saveProfileChanges() {
        const newBio = document.getElementById('editBioText').value;
        await this.updateBio(newBio);
        document.querySelector('.edit-profile-modal')?.remove();
    }

    // Редактирование био
    editBio() {
        const currentBio = this.currentProfile?.bio || '';
        const newBio = prompt('Введите информацию о себе:', currentBio);
        if (newBio !== null) {
            this.updateBio(newBio);
        }
    }

    async updateBio(newBio) {
        try {
            const response = await fetch('/api/user/profile/bio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: this.getCurrentUser(),
                    bio: newBio
                })
            });

            if (response.ok) {
                this.showNotification('Информация обновлена', 'success');
                if (this.currentProfile) {
                    this.currentProfile.bio = newBio;
                    this.displayProfile(this.currentProfile);
                }
            } else {
                throw new Error('Failed to update bio');
            }
        } catch (error) {
            console.error('Error updating bio:', error);
            this.showNotification('Ошибка обновления информации', 'error');
        }
    }

    // Смена аватара
    changeAvatar() {
        this.uploadNewAvatar();
    }

    // Открытие настроек
    openSettings() {
        if (window.settingsManager) {
            window.settingsManager.openSettings();
            this.closeProfile();
        } else {
            this.showNotification('Менеджер настроек недоступен', 'error');
        }
    }

    // Вспомогательные методы
    getCurrentUser() {
        return document.getElementById('username')?.textContent || 'anonymous';
    }

    showNotification(message, type = 'info') {
        // Удаляем старые уведомления
        const oldNotifications = document.querySelectorAll('.profile-notification');
        oldNotifications.forEach(notif => notif.remove());

        const notification = document.createElement('div');
        notification.className = `profile-notification ${type}`;
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
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            animation: notificationSlideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'notificationSlideOut 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);

        // Добавляем анимации
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes notificationSlideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes notificationSlideOut {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    getStatusIndicator(status) {
        const indicators = {
            online: '<span style="position: absolute; bottom: 8px; right: 8px; width: 16px; height: 16px; background: #28a745; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>',
            offline: '<span style="position: absolute; bottom: 8px; right: 8px; width: 16px; height: 16px; background: #6c757d; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>',
            away: '<span style="position: absolute; bottom: 8px; right: 8px; width: 16px; height: 16px; background: #ffc107; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>'
        };
        return indicators[status] || indicators.offline;
    }

    getStatusText(status) {
        const statusTexts = {
            online: '🟢 В сети',
            offline: '🔴 Не в сети', 
            away: '🟡 Отошел',
            busy: '🔴 Занят'
        };
        return statusTexts[status] || statusTexts.offline;
    }

    // Обновление профиля при изменении данных
    refreshProfile() {
        if (this.currentProfile) {
            this.viewProfile(this.currentProfile.username);
        }
    }

    // Обработка получения подарка
    handleGiftReceived(giftData) {
        if (this.currentProfile && this.currentProfile.username === giftData.receiver) {
            this.showNotification(`🎁 Вы получили подарок "${giftData.gift.name}" от ${giftData.sender}`, 'success');
            this.refreshProfile();
        }
    }

    // Публичный метод для открытия профиля извне
    openUserProfile(username) {
        this.viewProfile(username);
    }
}

// Создаем глобальный экземпляр
window.profileManager = new ProfileManager();
window.ProfileManager = ProfileManager;