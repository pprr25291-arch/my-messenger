class CurrencyManager {
    constructor() {
        this.balance = 0;
        this.dailyStreak = 0;
        this.lastDailyReward = null;
        this.transactionHistory = [];
        this.isAdmin = false;
        
        this.init();
    }

 async init() {
        this.currentUser = document.getElementById('username')?.textContent;
        this.isAdmin = this.currentUser === 'admin';
        
        // Сначала пробуем загрузить с сервера, потом локально
        await this.loadUserData();
        await this.loadLocalData(); // Загружаем локальные данные как резерв
        
        this.setupEventListeners();
        this.updateDisplay();
        
        console.log('✅ CurrencyManager initialized');
    }
 setupGiftShopInSettings() {
        this.loadGiftsToSettingsShop();
        this.setupGiftShopEventsInSettings();
    }

loadGiftsToSettingsShop() {
    const giftsGrid = document.getElementById('giftsGrid');
    if (!giftsGrid) {
        console.error('Gifts grid not found');
        return;
    }

    giftsGrid.innerHTML = '';

    if (!window.giftManager) {
        giftsGrid.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">Магазин подарков загружается...</div>';
        return;
    }

    window.giftManager.gifts.forEach(gift => {
        const giftElement = document.createElement('div');
        giftElement.className = `gift-item ${gift.type}`;
        
        const isOwned = window.giftManager.isGiftOwned(gift.id);
        const canAfford = this.balance >= gift.price;
        
        giftElement.innerHTML = `
            <div class="gift-icon">${gift.name.split(' ')[0]}</div>
            <div class="gift-name">${gift.name}</div>
            <div class="gift-price">${gift.price} 🪙</div>
            <div class="gift-type">
                ${this.getGiftTypeBadge(gift.type)}
            </div>
            <button class="buy-gift-btn ${isOwned ? 'owned' : ''}" 
                    data-gift-id="${gift.id}"
                    ${isOwned ? 'disabled' : !canAfford ? 'disabled' : ''}>
                ${isOwned ? '✅ Куплен' : !canAfford ? '💸 Не хватает' : '🛒 Купить'}
            </button>
        `;

        if (!isOwned && canAfford) {
            const buyBtn = giftElement.querySelector('.buy-gift-btn');
            buyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.buyGiftFromSettings(gift);
            });
        }

        giftsGrid.appendChild(giftElement);
    });

    this.updateGiftShopInSettings();
}
  async saveUserData() {
        try {
            const endpoints = [
                '/api/currency/save',
                '/api/currency/user/save',
                '/api/user/currency/save'
            ];
            
            let success = false;
            
            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            username: this.currentUser,
                            balance: this.balance,
                            dailyStreak: this.dailyStreak,
                            lastDailyReward: this.lastDailyReward,
                            transactionHistory: this.transactionHistory
                        })
                    });

                    if (response.ok) {
                        console.log('✅ Currency data saved to server');
                        success = true;
                        break;
                    }
                } catch (error) {
                    console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                    continue;
                }
            }

            if (!success) {
                // Сохраняем локально если сервер недоступен
                this.saveLocalData();
            }

            return true;
        } catch (error) {
            console.error('❌ Error saving currency data:', error);
            this.saveLocalData(); // Всегда сохраняем локально при ошибке
            return false;
        }
    }

    saveLocalData() {
        try {
            const data = {
                balance: this.balance,
                dailyStreak: this.dailyStreak,
                lastDailyReward: this.lastDailyReward,
                transactionHistory: this.transactionHistory
            };
            localStorage.setItem(`currency_${this.currentUser}`, JSON.stringify(data));
            console.log('💾 Currency data saved locally');
        } catch (error) {
            console.error('❌ Error saving local currency data:', error);
        }
    }

    async loadLocalData() {
        try {
            const data = JSON.parse(localStorage.getItem(`currency_${this.currentUser}`) || '{}');
            this.balance = data.balance || 0;
            this.dailyStreak = data.dailyStreak || 0;
            this.lastDailyReward = data.lastDailyReward;
            this.transactionHistory = data.transactionHistory || [];
            console.log('📦 Loaded local currency data');
        } catch (error) {
            console.log('⚠️ No local currency data found');
        }
    }

    getGiftTypeBadge(type) {
        const badges = {
            'common': '<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Обычный</span>',
            'rare': '<span style="background: #007bff; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Редкий</span>',
            'epic': '<span style="background: #6f42c1; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Эпический</span>',
            'legendary': '<span style="background: #fd7e14; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Легендарный</span>'
        };
        return badges[type] || badges.common;
    }

    setupGiftShopEventsInSettings() {
        const categoryBtns = document.querySelectorAll('#tab-currency .category-btn');
        const giftsGrid = document.getElementById('giftsGrid');

        categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                categoryBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterGiftsInSettings(btn.dataset.category);
            });
        });

        // Обновляем магазин при переключении на вкладку валюты
        const currencyTab = document.querySelector('.settings-tab[data-tab="currency"]');
        if (currencyTab) {
            currencyTab.addEventListener('click', () => {
                setTimeout(() => {
                    this.loadGiftsToSettingsShop();
                }, 100);
            });
        }
    }

    filterGiftsInSettings(category) {
        if (!window.giftManager) return;

        const giftItems = document.querySelectorAll('#giftsGrid .gift-item');
        giftItems.forEach(item => {
            const giftName = item.querySelector('.gift-name').textContent;
            const gift = window.giftManager.gifts.find(g => g.name === giftName);
            
            if (category === 'all' || gift.category === category) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }
async saveUserData() {
    try {
        const currentUser = this.currentUser;
        if (!currentUser) {
            console.error('❌ No current user for saving currency data');
            return false;
        }

        const dataToSave = {
            username: currentUser,
            balance: this.balance,
            dailyStreak: this.dailyStreak,
            lastDailyReward: this.lastDailyReward,
            transactionHistory: this.transactionHistory
        };

        console.log('💾 Attempting to save currency data for:', currentUser);
        console.log('📦 Data to save:', dataToSave);

        // Пробуем разные эндпоинты
        const endpoints = [
            '/api/currency/save',
            '/api/currency/user/save', 
            '/api/user/currency/save'
        ];
        
        let success = false;
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Trying to save to: ${endpoint}`);
                
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(dataToSave)
                });

                console.log(`📨 Response from ${endpoint}:`, response.status);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Currency data saved successfully via:', endpoint, result);
                    success = true;
                    break;
                } else {
                    console.log(`❌ ${endpoint} returned ${response.status}`);
                    // Пробуем прочитать текст ошибки
                    try {
                        const errorText = await response.text();
                        console.log(`❌ Error response: ${errorText}`);
                    } catch (e) {
                        console.log('❌ Could not read error response');
                    }
                }
            } catch (error) {
                console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                continue;
            }
        }

        if (!success) {
            // Сохраняем локально если сервер недоступен
            console.log('💾 All endpoints failed, saving locally');
            this.saveLocalData();
        } else {
            // Также сохраняем локально для резерва
            this.saveLocalData();
        }

        return true;
    } catch (error) {
        console.error('❌ Error saving currency data:', error);
        this.saveLocalData(); // Всегда сохраняем локально при ошибке
        return false;
    }
}
    async buyGiftFromSettings(gift) {
        if (!window.giftManager) {
            this.showNotification('Магазин подарков недоступен', 'error');
            return;
        }

        try {
            await window.giftManager.buyGift(gift);
            this.loadGiftsToSettingsShop();
            this.updateDisplay();
            this.showNotification(`Подарок "${gift.name}" успешно куплен!`, 'success');
        } catch (error) {
            console.error('Error buying gift from settings:', error);
            this.showNotification(error.message, 'error');
        }
    }
    updateGiftShopInSettings() {
        this.updateGiftShopBalanceInSettings();
        this.updateUserGiftsListInSettings();
    }

    updateGiftShopBalanceInSettings() {
        const balanceElement = document.getElementById('userBalance');
        if (balanceElement) {
            balanceElement.textContent = this.balance;
        }

        const ownedCountElement = document.getElementById('ownedGiftsCount');
        if (ownedCountElement && window.giftManager) {
            const currentUser = document.getElementById('username')?.textContent;
            const ownedCount = window.giftManager.userGifts.get(currentUser)?.length || 0;
            ownedCountElement.textContent = ownedCount;
        }
    }

    updateUserGiftsListInSettings() {
        const userGiftsList = document.getElementById('userGiftsList');
        if (!userGiftsList || !window.giftManager) return;

        const currentUser = document.getElementById('username')?.textContent;
        const userGifts = window.giftManager.userGifts.get(currentUser) || [];

        if (userGifts.length === 0) {
            userGiftsList.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 10px; font-size: 11px;">Пока нет подарков</div>';
            return;
        }

        userGiftsList.innerHTML = userGifts.map(gift => `
            <div class="owned-gift-item" title="${gift.name} (куплен ${new Date(gift.purchaseDate).toLocaleDateString()})">
                <div class="owned-gift-icon">${gift.name.split(' ')[0]}</div>
                <div class="owned-gift-name">${gift.name.split(' ').slice(1).join(' ')}</div>
            </div>
        `).join('');
    }

    updateDisplay() {
    // Обновляем баланс во всех местах
    const balance = this.balance;
    
    // Основной баланс в настройках
    const balanceElement = document.getElementById('userBalance');
    if (balanceElement) {
        balanceElement.textContent = balance;
    }

    // Баланс в сайдбаре
    const sidebarBalance = document.getElementById('sidebarBalance');
    if (sidebarBalance) {
        sidebarBalance.textContent = balance;
    }

    // Баланс в заголовке
    const headerBalance = document.getElementById('headerBalance');
    if (headerBalance) {
        headerBalance.textContent = balance;
    }

    // Баланс в магазине подарков
    const giftShopBalance = document.getElementById('giftShopBalance');
    if (giftShopBalance) {
        giftShopBalance.textContent = balance;
    }

    // Баланс в модальном окне валюты
    const modalBalance = document.getElementById('modalBalance');
    if (modalBalance) {
        modalBalance.textContent = balance;
    }

    // Обновляем серию
    const streakElement = document.getElementById('dailyStreak');
    if (streakElement) {
        streakElement.textContent = `${this.dailyStreak} дней`;
    }

    // Обновляем историю
    this.updateHistoryDisplay();

    // Обновляем магазин подарков в настройках
    this.updateGiftShopInSettings();
    
    console.log('💰 Balance updated:', balance);
}
    async loadUserData() {
        try {
            console.log('🔄 Loading currency data for:', this.currentUser);
            
            // Пробуем разные эндпоинты для валюты
            const endpoints = [
                `/api/user/${this.currentUser}/currency`,
                `/api/currency/user/${this.currentUser}`,
                `/api/currency/${this.currentUser}`
            ];
            
            let success = false;
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`🔍 Trying currency endpoint: ${endpoint}`);
                    const response = await fetch(endpoint);
                    
                    if (response.ok) {
                        const data = await response.json();
                        this.balance = data.balance || 0;
                        this.dailyStreak = data.dailyStreak || 0;
                        this.lastDailyReward = data.lastDailyReward;
                        this.transactionHistory = data.transactionHistory || [];
                        
                        console.log('✅ Currency data loaded from:', endpoint, {
                            balance: this.balance,
                            streak: this.dailyStreak,
                            lastReward: this.lastDailyReward
                        });
                        
                        success = true;
                        break;
                    }
                } catch (error) {
                    console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                    continue;
                }
            }
            
            if (!success) {
                console.log('⚠️ All currency endpoints failed, using default data');
                this.useDefaultCurrencyData();
            }
            
        } catch (error) {
            console.error('❌ Error loading currency data:', error);
            this.useDefaultCurrencyData();
        }
    }

    useDefaultCurrencyData() {
        this.balance = 100;
        this.dailyStreak = 0;
        this.lastDailyReward = null;
        this.transactionHistory = [];
        
        console.log('✅ Using default currency data');
    }

    setupEventListeners() {
        // Кнопка ежедневной награды
        document.getElementById('dailyRewardBtn')?.addEventListener('click', () => {
            this.claimDailyReward();
        });

        // Обновляем таймер следующей награды
        this.updateNextRewardTimer();
        setInterval(() => this.updateNextRewardTimer(), 60000); // Обновляем каждую минуту
    }

    updateDisplay() {
        // Обновляем баланс
        const balanceElement = document.getElementById('userBalance');
        if (balanceElement) {
            balanceElement.textContent = this.balance;
        }

        // Обновляем серию
        const streakElement = document.getElementById('dailyStreak');
        if (streakElement) {
            streakElement.textContent = `${this.dailyStreak} дней`;
        }

        // Обновляем историю
        this.updateHistoryDisplay();
    }

    canClaimDailyReward() {
        if (!this.lastDailyReward) {
            console.log('✅ No previous reward - can claim');
            return true;
        }

        const lastClaim = new Date(this.lastDailyReward);
        const now = new Date();
        
        // Награда доступна раз в 23 часа
        const timeSinceLastReward = now - lastClaim;
        const hoursSinceLastReward = timeSinceLastReward / (1000 * 60 * 60);
        
        console.log('⏰ Time since last reward:', {
            lastClaim: lastClaim.toISOString(),
            now: now.toISOString(),
            hoursSinceLastReward: hoursSinceLastReward.toFixed(2),
            canClaim: hoursSinceLastReward >= 23
        });
        
        return hoursSinceLastReward >= 23;
    }

    updateNextRewardTimer() {
        const nextRewardElement = document.getElementById('nextRewardTime');
        if (!nextRewardElement) return;

        const canClaim = this.canClaimDailyReward();

        if (canClaim) {
            nextRewardElement.textContent = 'Доступно сейчас!';
            nextRewardElement.style.color = '#28a745';
        } else {
            // Исправленная логика расчета времени до следующей награды
            const now = new Date();
            const lastClaim = new Date(this.lastDailyReward);
            
            // Время следующей награды = время последней награды + 23 часа
            const nextRewardTime = new Date(lastClaim.getTime() + (23 * 60 * 60 * 1000));
            
            // Если следующая награда уже прошла, показываем "Доступно сейчас"
            if (nextRewardTime <= now) {
                nextRewardElement.textContent = 'Доступно сейчас!';
                nextRewardElement.style.color = '#28a745';
                return;
            }
            
            // Рассчитываем оставшееся время
            const timeUntilReward = nextRewardTime - now;
            const hours = Math.floor(timeUntilReward / (1000 * 60 * 60));
            const minutes = Math.floor((timeUntilReward % (1000 * 60 * 60)) / (1000 * 60));

            nextRewardElement.textContent = `Через ${hours}ч ${minutes}м`;
            nextRewardElement.style.color = '#6c757d';
            
            console.log('⏳ Next reward countdown:', {
                nextRewardTime: nextRewardTime.toISOString(),
                hoursRemaining: hours,
                minutesRemaining: minutes
            });
        }

        // Обновляем состояние кнопки
        const rewardBtn = document.getElementById('dailyRewardBtn');
        if (rewardBtn) {
            rewardBtn.disabled = !canClaim;
            if (canClaim) {
                rewardBtn.innerHTML = '🎁 Получить ежедневную награду';
                rewardBtn.style.background = 'linear-gradient(45deg, #28a745, #20c997)';
            } else {
                rewardBtn.innerHTML = '⏳ Награда скоро будет доступна';
                rewardBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            }
        }
    }
async claimDailyReward() {
    try {
        console.log('🎁 Starting daily reward claim process...');
        
        const currentUser = this.currentUser;
        if (!currentUser) {
            this.showNotification('Пользователь не определен', 'error');
            return;
        }

        // Проверяем возможность получения награды
        if (!this.canClaimDailyReward()) {
            this.showNotification('Вы уже получали награду сегодня. Попробуйте позже.', 'error');
            return;
        }

        console.log('🎁 User can claim reward, proceeding...');

        // Пробуем разные эндпоинты для получения награды
        const endpoints = [
            '/api/currency/daily-reward',
            '/api/currency/reward/daily', 
            '/api/daily-reward'
        ];
        
        let success = false;
        let result = null;
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Trying reward endpoint: ${endpoint}`);
                
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: currentUser
                    })
                });

                console.log(`📨 Response status from ${endpoint}:`, response.status);
                
                if (response.ok) {
                    result = await response.json();
                    console.log('✅ Reward claimed successfully from:', endpoint, result);
                    success = true;
                    break;
                } else {
                    const errorText = await response.text();
                    console.log(`❌ ${endpoint} returned ${response.status}:`, errorText);
                }
            } catch (error) {
                console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                continue;
            }
        }

        if (!success) {
            // Если все эндпоинты не сработали, используем локальную логику
            console.log('⚠️ All reward endpoints failed, using local logic');
            result = this.calculateLocalReward();
            success = true; // Локальная логика всегда успешна для демо
        }

        if (success && result) {
            // Обновляем локальные данные
            this.balance = result.newBalance || this.balance + (result.rewardAmount || 50);
            this.dailyStreak = result.streak || this.dailyStreak + 1;
            this.lastDailyReward = new Date().toISOString();
            
            // Добавляем в историю
            this.addTransaction({
                type: 'daily_reward',
                amount: result.rewardAmount || 50,
                description: `Ежедневная награда (серия: ${this.dailyStreak} дней)`,
                timestamp: new Date().toISOString()
            });

            // Сохраняем данные
            await this.saveUserData();
            
            this.updateDisplay();
            this.showRewardNotification(result.rewardAmount || 50, this.dailyStreak);
            
            console.log('✅ Daily reward claimed successfully', {
                newBalance: this.balance,
                newStreak: this.dailyStreak,
                lastReward: this.lastDailyReward
            });
            
        } else {
            throw new Error(result?.error || 'Failed to claim reward');
        }
    } catch (error) {
        console.error('❌ Error claiming daily reward:', error);
        this.showNotification('Ошибка получения награды: ' + error.message, 'error');
    }
}
async loadUserData() {
    try {
        console.log('🔄 Loading currency data for:', this.currentUser);
        
        const endpoints = [
            `/api/user/${this.currentUser}/currency`,
            `/api/currency/user/${this.currentUser}`,
            `/api/currency/${this.currentUser}`
        ];
        
        let success = false;
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Trying currency endpoint: ${endpoint}`);
                const response = await fetch(endpoint);
                
                if (response.ok) {
                    const data = await response.json();
                    this.balance = data.balance || 0;
                    this.dailyStreak = data.dailyStreak || 0;
                    this.lastDailyReward = data.lastDailyReward;
                    this.transactionHistory = data.transactionHistory || [];
                    
                    console.log('✅ Currency data loaded from:', endpoint);
                    success = true;
                    break;
                } else if (response.status === 403) {
                    console.log('⚠️ No permission to access currency data');
                    // Используем локальные данные
                    await this.loadLocalData();
                    success = true;
                    break;
                }
            } catch (error) {
                console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                continue;
            }
        }
        
        if (!success) {
            console.log('⚠️ All currency endpoints failed, using local data');
            await this.loadLocalData();
        }
        
    } catch (error) {
        console.error('❌ Error loading currency data:', error);
        await this.loadLocalData();
    }
}
// Добавьте метод для расчета локальной награды
calculateLocalReward() {
    const baseReward = 50;
    const streakBonus = Math.min(this.dailyStreak * 5, 100);
    const totalReward = baseReward + streakBonus;
    
    return {
        success: true,
        rewardAmount: totalReward,
        newBalance: this.balance + totalReward,
        streak: this.dailyStreak + 1
    };
}
async loadUsersCurrencyList() {
    try {
        const usersList = document.getElementById('usersCurrencyList');
        if (!usersList) return;

        usersList.innerHTML = '<div class="loading">Загрузка пользователей...</div>';

        // Получаем список пользователей
        const response = await fetch('/api/users/all');
        if (!response.ok) throw new Error('Failed to load users');

        const users = await response.json();
        
        let html = '';
        for (const user of users) {
            try {
                const currencyResponse = await fetch(`/api/user/${user.username}/currency`);
                const currencyData = currencyResponse.ok ? await currencyResponse.json() : { balance: 0 };
                
                html += `
                    <div class="user-currency-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                        <div class="user-info" style="display: flex; align-items: center; gap: 10px;">
                            <img src="${user.avatar || '/default-avatar.png'}" style="width: 30px; height: 30px; border-radius: 50%;" alt="${user.username}">
                            <span>${user.username}</span>
                            ${user.isOnline ? '<span style="color: #28a745; font-size: 12px;">🟢</span>' : '<span style="color: #dc3545; font-size: 12px;">🔴</span>'}
                        </div>
                        <div class="currency-info" style="font-weight: bold; color: #28a745;">
                            🪙 ${currencyData.balance || 0}
                        </div>
                    </div>
                `;
            } catch (error) {
                console.log(`Error loading currency for ${user.username}:`, error);
            }
        }

        usersList.innerHTML = html || '<div class="empty">Пользователи не найдены</div>';

    } catch (error) {
        console.error('Error loading users currency list:', error);
        const usersList = document.getElementById('usersCurrencyList');
        if (usersList) {
            usersList.innerHTML = '<div class="error">Ошибка загрузки пользователей</div>';
        }
    }
}

    addTransaction(transaction) {
        this.transactionHistory.unshift(transaction);
        if (this.transactionHistory.length > 50) {
            this.transactionHistory = this.transactionHistory.slice(0, 50);
        }
    }

    updateHistoryDisplay() {
        const historyElement = document.getElementById('currencyHistory');
        if (!historyElement) return;

        if (this.transactionHistory.length === 0) {
            historyElement.innerHTML = '<div class="history-empty">История операций пуста</div>';
            return;
        }

        historyElement.innerHTML = this.transactionHistory.map(transaction => `
            <div class="history-item">
                <div class="history-info">
                    <div class="history-description">${transaction.description}</div>
                    <div class="history-date">${this.formatDate(transaction.timestamp)}</div>
                </div>
                <div class="history-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}">
                    ${transaction.amount >= 0 ? '+' : ''}${transaction.amount}
                </div>
            </div>
        `).join('');
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showRewardNotification(amount, streak) {
        const notification = document.createElement('div');
        notification.className = 'reward-notification';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="font-size: 24px;">🪙</div>
                <div>
                    <div>🎉 Вы получили ${amount} монет!</div>
                    ${streak > 1 ? `<div style="font-size: 12px; opacity: 0.9;">Серия: ${streak} дней подряд!</div>` : ''}
                </div>
            </div>
        `;
        
        // Добавляем анимацию к иконке валюты в балансе
        const currencyIcon = document.querySelector('.currency-icon');
        if (currencyIcon) {
            currencyIcon.classList.add('coin-animation');
            setTimeout(() => {
                currencyIcon.classList.remove('coin-animation');
            }, 800);
        }

        // Вставляем уведомление
        const balanceDisplay = document.querySelector('.currency-balance');
        if (balanceDisplay) {
            balanceDisplay.parentNode.insertBefore(notification, balanceDisplay);
            
            // Убираем уведомление через 3 секунды
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateY(-20px)';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.remove();
                        }
                    }, 300);
                }
            }, 3000);
        }
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
async addCurrencyToUser(username, amount, reason = '') {
    if (!this.isAdmin) {
        this.showNotification('Недостаточно прав', 'error');
        return false;
    }

    try {
        // Если это текущий пользователь, обновляем мгновенно
        if (username === this.currentUser) {
            return await this.addCurrency(amount, reason);
        }

        // Для других пользователей используем API
        const endpoints = [
            '/api/currency/add',
            '/api/currency/admin/add',
            '/api/admin/currency/add'
        ];
        
        let success = false;
        let responseData = null;
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Trying to add currency via: ${endpoint}`);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        targetUser: username,
                        amount: amount,
                        reason: reason,
                        admin: this.currentUser
                    })
                });

                if (response.ok) {
                    responseData = await response.json();
                    console.log('✅ Currency added successfully:', responseData);
                    
                    // Используем данные из ответа сервера
                    const addedAmount = responseData.amount || amount;
                    const message = responseData.message || `Добавлено ${addedAmount} монет пользователю ${username}`;
                    
                    this.showNotification(message, 'success');
                    success = true;
                    break;
                } else {
                    console.log(`❌ ${endpoint} returned ${response.status}`);
                    const errorText = await response.text();
                    console.log(`❌ Error response: ${errorText}`);
                }
            } catch (error) {
                console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                continue;
            }
        }

        if (!success) {
            // Локальная логика для демонстрации
            console.log('💾 All endpoints failed, using local logic');
            const message = `[ДЕМО] Добавлено ${amount} монет пользователю ${username}`;
            this.showNotification(message, 'info');
            success = true;
        }

        // Обновляем список пользователей если открыта админ-панель
        if (document.getElementById('adminPanel')?.style.display === 'flex') {
            this.loadUsersCurrencyList();
        }

        return success;
    } catch (error) {
        console.error('Error adding currency:', error);
        this.showNotification('Ошибка добавления валюты: ' + error.message, 'error');
        return false;
    }
}   
 async addCurrencyToUser(username, amount, reason = '') {
        if (!this.isAdmin) {
            this.showNotification('Недостаточно прав', 'error');
            return false;
        }

        try {
            // Если это текущий пользователь, обновляем мгновенно
            if (username === this.currentUser) {
                return await this.addCurrency(amount, reason);
            }

            // Для других пользователей используем API
            const endpoints = [
                '/api/currency/add',
                '/api/currency/admin/add',
                '/api/admin/currency/add'
            ];
            
            let success = false;
            let responseData = null;
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`🔍 Trying to add currency via: ${endpoint}`);
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            targetUser: username,
                            amount: amount,
                            reason: reason,
                            admin: this.currentUser
                        })
                    });

                    if (response.ok) {
                        responseData = await response.json();
                        console.log('✅ Currency added successfully:', responseData);
                        
                        const addedAmount = responseData.amount || amount;
                        const message = responseData.message || `Добавлено ${addedAmount} монет пользователю ${username}`;
                        
                        this.showNotification(message, 'success');
                        success = true;
                        break;
                    }
                } catch (error) {
                    console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                    continue;
                }
            }

            if (!success) {
                // Локальная логика для демонстрации
                console.log('💾 All endpoints failed, using local logic');
                const message = `[ДЕМО] Добавлено ${amount} монет пользователю ${username}`;
                this.showNotification(message, 'info');
                success = true;
            }

            // Обновляем список пользователей если открыта админ-панель
            if (document.getElementById('adminPanel')?.style.display === 'flex') {
                this.loadUsersCurrencyList();
            }

            return success;
        } catch (error) {
            console.error('Error adding currency:', error);
            this.showNotification('Ошибка добавления валюты: ' + error.message, 'error');
            return false;
        }
    }
async updateBalance(newBalance) {
    const oldBalance = this.balance;
    this.balance = newBalance;
    
    console.log('💰 Balance update:', {
        user: this.currentUser,
        oldBalance: oldBalance,
        newBalance: newBalance,
        difference: newBalance - oldBalance
    });
    
    this.updateDisplay();
    
    // Сохраняем данные
    try {
        await this.saveUserData();
        console.log('✅ Balance saved successfully');
    } catch (error) {
        console.error('❌ Error saving balance:', error);
    }
}
async forceSaveAllData() {
    console.log('💾 Force saving all currency data...');
    await this.saveUserData();
}
debugCurrency() {
    return {
        currentUser: this.currentUser,
        balance: this.balance,
        dailyStreak: this.dailyStreak,
        lastDailyReward: this.lastDailyReward,
        transactionHistory: this.transactionHistory,
        isAdmin: this.isAdmin
    };
}
addBalance(amount, reason = '') {
    const newBalance = this.balance + amount;
    this.updateBalance(newBalance);
    
    // Добавляем в историю
    this.addTransaction({
        type: 'balance_add',
        amount: amount,
        description: reason || 'Пополнение баланса',
        timestamp: new Date().toISOString()
    });
    
    this.showNotification(`Баланс пополнен на ${amount} монет`, 'success');
}
subtractBalance(amount, reason = '') {
    if (this.balance < amount) {
        this.showNotification('Недостаточно средств', 'error');
        return false;
    }
    
    const newBalance = this.balance - amount;
    this.updateBalance(newBalance);
    
    // Добавляем в историю
    this.addTransaction({
        type: 'balance_subtract',
        amount: -amount,
        description: reason || 'Списание с баланса',
        timestamp: new Date().toISOString()
    });
    
    this.showNotification(`Списано ${amount} монет`, 'info');
    return true;
}
setupSocketListeners() {
    if (!window.socket) return;
    
    // Слушаем обновления баланса от сервера
    window.socket.on('currency_balance_updated', (data) => {
        if (data.username === this.currentUser) {
            console.log('💰 Balance update received from server:', data.balance);
            this.updateBalance(data.balance);
        }
    });
    
    // Слушаем транзакции
    window.socket.on('currency_transaction', (data) => {
        if (data.username === this.currentUser) {
            this.addTransaction(data.transaction);
            this.updateHistoryDisplay();
        }
    });
}

// Вызываем этот метод в init()
async init() {
    this.currentUser = document.getElementById('username')?.textContent;
    this.isAdmin = this.currentUser === 'admin';
    
    await this.loadUserData();
    await this.loadLocalData();
    
    this.setupEventListeners();
    this.setupSocketListeners(); // Добавляем слушатели сокетов
    this.updateDisplay();
    
    console.log('✅ CurrencyManager initialized');
}
 async removeCurrencyFromUser(username, amount, reason = '') {
    if (!this.isAdmin) {
        this.showNotification('Недостаточно прав', 'error');
        return false;
    }

    try {
        // Если это текущий пользователь, обновляем мгновенно
        if (username === this.currentUser) {
            return await this.removeCurrency(amount, reason);
        }

        // Для других пользователей используем API
        const endpoints = [
            '/api/currency/remove',
            '/api/currency/admin/remove',
            '/api/admin/currency/remove'
        ];
        
        let success = false;
        let responseData = null;
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Trying to remove currency via: ${endpoint}`);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        targetUser: username,
                        amount: amount,
                        reason: reason,
                        admin: this.currentUser
                    })
                });

                if (response.ok) {
                    responseData = await response.json();
                    console.log('✅ Currency removed successfully:', responseData);
                    
                    // Используем данные из ответа сервера
                    const removedAmount = responseData.amount || amount;
                    const message = responseData.message || `Списано ${removedAmount} монет у пользователя ${username}`;
                    
                    this.showNotification(message, 'success');
                    success = true;
                    break;
                }
            } catch (error) {
                console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
                continue;
            }
        }

        if (!success) {
            // Локальная логика для демонстрации
            const message = `[ДЕМО] Списано ${amount} монет у пользователя ${username}`;
            this.showNotification(message, 'info');
            success = true;
        }

        // Обновляем список пользователей если открыта админ-панель
        if (document.getElementById('adminPanel')?.style.display === 'flex') {
            this.loadUsersCurrencyList();
        }

        return success;
    } catch (error) {
        console.error('Error removing currency:', error);
        this.showNotification('Ошибка списания валюты', 'error');
        return false;
    }
}
openGiftShop(targetUser = null) {
        console.log('🎁 Opening gift shop for user:', targetUser);
        
        const modal = document.createElement('div');
        modal.id = 'giftShopModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 25px;
                border-radius: 15px;
                width: 800px;
                max-width: 95%;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            ">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                    <h3 style="margin: 0; color: #333;">🛒 Магазин подарков</h3>
                    <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">✕</button>
                </div>
                
                <div class="gift-shop-content" style="flex: 1; overflow-y: auto;">
                    <div class="gift-shop-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div class="user-balance" style="font-size: 18px; font-weight: bold; color: #28a745;">
                            Ваш баланс: <span id="giftShopBalance">${this.balance}</span> 🪙
                        </div>
                        ${targetUser ? `
                            <div class="gift-target" style="font-size: 14px; color: #666;">
                                Получатель: <strong>${targetUser}</strong>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div id="giftsGrid" class="gifts-grid" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                        gap: 15px;
                        padding: 10px;
                    ">
                        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6c757d;">
                            Загрузка подарков...
                        </div>
                    </div>
                </div>
                
                <div class="gift-shop-footer" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e9ecef;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 14px; color: #6c757d;">
                            ${targetUser ? `Выберите подарок для ${targetUser}` : 'Выберите подарок для покупки'}
                        </div>
                        <button class="close-gift-shop btn-secondary" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.loadGiftsToShop(modal, targetUser);
        this.setupGiftShopEvents(modal, targetUser);
    }

    loadGiftsToShop(modal, targetUser = null) {
        const giftsGrid = modal.querySelector('#giftsGrid');
        if (!giftsGrid) return;

        if (!window.giftManager) {
            giftsGrid.innerHTML = '<div style="text-align: center; color: #dc3545; padding: 20px;">Магазин подарков недоступен</div>';
            return;
        }

        giftsGrid.innerHTML = '';

        const availableGifts = window.giftManager.getAvailableGifts();
        
        if (availableGifts.length === 0) {
            giftsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🎁</div>
                    <div>Все подарки уже куплены!</div>
                </div>
            `;
            return;
        }

        availableGifts.forEach(gift => {
            const giftElement = document.createElement('div');
            giftElement.className = `gift-item ${gift.type}`;
            giftElement.style.cssText = `
                border: 1px solid #dee2e6;
                border-radius: 10px;
                padding: 15px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                background: white;
            `;

            const canAfford = this.balance >= gift.price;
            
            giftElement.innerHTML = `
                <div class="gift-icon" style="font-size: 40px; margin-bottom: 10px;">${gift.name.split(' ')[0]}</div>
                <div class="gift-name" style="font-weight: bold; margin-bottom: 5px; font-size: 14px;">${gift.name}</div>
                <div class="gift-price" style="color: #28a745; font-weight: bold; margin-bottom: 10px;">${gift.price} 🪙</div>
                <div class="gift-description" style="font-size: 11px; color: #6c757d; margin-bottom: 10px; height: 40px; overflow: hidden;">
                    ${gift.description}
                </div>
                <div class="gift-type-badge" style="margin-bottom: 10px;">
                    ${window.giftManager.getGiftTypeBadge(gift.type)}
                </div>
                <button class="buy-gift-btn" 
                        style="width: 100%; padding: 8px; border: none; border-radius: 5px; cursor: ${canAfford ? 'pointer' : 'not-allowed'}; 
                               background: ${canAfford ? '#007bff' : '#6c757d'}; color: white;"
                        ${!canAfford ? 'disabled' : ''}>
                    ${canAfford ? '🛒 Купить' : '💸 Не хватает'}
                </button>
            `;

            if (canAfford) {
                giftElement.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('buy-gift-btn')) {
                        this.handleGiftPurchase(gift, targetUser, modal);
                    }
                });

                const buyBtn = giftElement.querySelector('.buy-gift-btn');
                buyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleGiftPurchase(gift, targetUser, modal);
                });
            }

            giftsGrid.appendChild(giftElement);
        });
    }

    async handleGiftPurchase(gift, targetUser, modal) {
        try {
            if (targetUser) {
                // Покупка и отправка подарка другому пользователю
                await this.buyAndSendGift(gift, targetUser);
            } else {
                // Покупка подарка для себя
                await window.giftManager.buyGift(gift);
                this.showNotification(`Подарок "${gift.name}" успешно куплен!`, 'success');
            }
            
            // Обновляем отображение магазина
            this.loadGiftsToShop(modal, targetUser);
            this.updateGiftShopBalance();
            
        } catch (error) {
            console.error('Error handling gift purchase:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async buyAndSendGift(gift, targetUser) {
        const currentUser = this.getCurrentUser();
        
        if (!window.giftManager) {
            throw new Error('Система подарков недоступна');
        }

        // Покупаем подарок
        await window.giftManager.buyGift(gift);
        
        // Немедленно отправляем его целевому пользователю
        await window.giftManager.sendGiftFromInventory(currentUser, targetUser, gift.id);
        
        this.showNotification(`Подарок "${gift.name}" куплен и отправлен пользователю ${targetUser}!`, 'success');
    }

    setupGiftShopEvents(modal, targetUser) {
        const closeBtn = modal.querySelector('.close-modal');
        const closeGiftShopBtn = modal.querySelector('.close-gift-shop');
        
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        closeGiftShopBtn.addEventListener('click', closeModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    updateGiftShopBalance() {
        const balanceElement = document.getElementById('giftShopBalance');
        if (balanceElement) {
            balanceElement.textContent = this.balance;
        }
    }

    getCurrentUser() {
        return document.getElementById('username')?.textContent || 'anonymous';
    }
async handleGiftSelection(gift, targetUser = null) {
    try {
        if (targetUser) {
            // Покупка подарка для другого пользователя
            await this.buyGiftForUser(gift, targetUser);
        } else {
            // Покупка подарка для себя
            await window.giftManager.buyGift(gift);
            this.showNotification(`Подарок "${gift.name}" успешно куплен!`, 'success');
        }
        
        // Обновляем отображение магазина
        const modal = document.getElementById('giftShopModal');
        if (modal) {
            this.loadGiftsToShop(modal, targetUser);
            this.updateGiftShopBalance();
        }
        
    } catch (error) {
        console.error('Error handling gift selection:', error);
        this.showNotification(error.message, 'error');
    }
}

async buyGiftForUser(gift, targetUser) {
    if (!window.giftManager) {
        throw new Error('Система подарков недоступна');
    }

    // Сначала покупаем подарок для себя
    await window.giftManager.buyGift(gift);
    
    // Затем отправляем его целевому пользователю
    const currentUser = this.getCurrentUser();
    await window.giftManager.sendGift(currentUser, targetUser, gift.id);
    
    this.showNotification(`Подарок "${gift.name}" отправлен пользователю ${targetUser}!`, 'success');
}

updateGiftShopBalance() {
    const balanceElement = document.getElementById('giftShopBalance');
    if (balanceElement) {
        balanceElement.textContent = this.balance;
    }
}

getCurrentUser() {
    return document.getElementById('username')?.textContent || 'anonymous';
}
async addCurrency(amount, reason = '') {
    if (!this.isAdmin) {
        this.showNotification('Недостаточно прав', 'error');
        return false;
    }

    try {
        const newBalance = this.balance + amount;
        await this.updateBalance(newBalance);
        
        this.addTransaction({
            type: 'admin_add',
            amount: amount,
            description: reason || 'Пополнение баланса администратором',
            timestamp: new Date().toISOString()
        });
        
        // Показываем корректное сообщение
        this.showNotification(`Добавлено ${amount} монет`, 'success');
        return true;
    } catch (error) {
        console.error('Error adding currency:', error);
        this.showNotification('Ошибка добавления валюты', 'error');
        return false;
    }
}
    // Метод для удаления валюты (админ)
    async removeCurrency(amount, reason = '') {
        if (!this.isAdmin) {
            this.showNotification('Недостаточно прав', 'error');
            return false;
        }

        if (this.balance < amount) {
            this.showNotification('Недостаточно средств', 'error');
            return false;
        }

        const newBalance = this.balance - amount;
        await this.updateBalance(newBalance);
        
        this.addTransaction({
            type: 'admin_remove',
            amount: -amount,
            description: reason || 'Списание баланса администратором',
            timestamp: new Date().toISOString()
        });
        
        this.showNotification(`Списано ${amount} монет`, 'info');
        return true;
    }

}
class GiftManager {
    constructor() {
        this.gifts = [
            { 
                id: 'gift_1', 
                name: '🎈 Воздушный шарик', 
                price: 10, 
                type: 'common', 
                category: 'decor', 
                wearable: true, 
                slot: 'background',
                description: 'Веселый воздушный шарик для украшения профиля'
            },
            { 
                id: 'gift_2', 
                name: '🎁 Подарок', 
                price: 25, 
                type: 'common', 
                category: 'gift', 
                wearable: false,
                description: 'Тайный подарок для друзей'
            },
            { 
                id: 'gift_3', 
                name: '🏆 Кубок', 
                price: 50, 
                type: 'rare', 
                category: 'achievement', 
                wearable: true, 
                slot: 'badge',
                description: 'Кубок победителя для лучших пользователей'
            },
            { 
                id: 'gift_4', 
                name: '👑 Корона', 
                price: 100, 
                type: 'epic', 
                category: 'premium', 
                wearable: true, 
                slot: 'head',
                description: 'Корона для настоящих королей чата'
            },
            { 
                id: 'gift_5', 
                name: '⭐ Звезда', 
                price: 30, 
                type: 'common', 
                category: 'decor', 
                wearable: true, 
                slot: 'badge',
                description: 'Сияющая звезда успеха'
            },
            { 
                id: 'gift_6', 
                name: '💖 Сердце', 
                price: 40, 
                type: 'common', 
                category: 'emotion', 
                wearable: true, 
                slot: 'effect',
                description: 'Сердце, полное любви и заботы'
            },
            { 
                id: 'gift_7', 
                name: '🚀 Ракета', 
                price: 75, 
                type: 'rare', 
                category: 'premium', 
                wearable: true, 
                slot: 'background',
                description: 'Ракета для стремительного роста'
            },
            { 
                id: 'gift_8', 
                name: '🎨 Палитра', 
                price: 35, 
                type: 'common', 
                category: 'creativity', 
                wearable: true, 
                slot: 'badge',
                description: 'Палитра для творческих личностей'
            },
            { 
                id: 'gift_9', 
                name: '🏅 Медаль', 
                price: 60, 
                type: 'rare', 
                category: 'achievement', 
                wearable: true, 
                slot: 'badge',
                description: 'Медаль за достижения'
            },
            { 
                id: 'gift_10', 
                name: '💎 Алмаз', 
                price: 150, 
                type: 'legendary', 
                category: 'premium', 
                wearable: true, 
                slot: 'effect',
                description: 'Редкий алмаз для избранных'
            },
            { 
                id: 'gift_11', 
                name: '🎭 Маска', 
                price: 45, 
                type: 'common', 
                category: 'mystery', 
                wearable: true, 
                slot: 'head',
                description: 'Таинственная маска'
            },
            { 
                id: 'gift_12', 
                name: '🛡️ Щит', 
                price: 80, 
                type: 'rare', 
                category: 'protection', 
                wearable: true, 
                slot: 'badge',
                description: 'Щит для защиты вашего профиля'
            }
        ];
        
        this.userGifts = new Map();
        this.userProfiles = new Map();
        this.equippedGifts = new Map();
        this.giftCategories = ['all', 'decor', 'achievement', 'premium', 'emotion', 'creativity', 'mystery', 'protection'];
        
        this.init();
    }

    async init() {
        console.log('🔄 Initializing GiftManager...');
        await this.loadUserGifts();
        await this.loadUserProfiles();
        await this.loadEquippedGifts();
        this.setupDefaultGifts();
        console.log('✅ GiftManager initialized');
    }

    // Загрузка данных пользователей
    async loadUserGifts() {
        try {
            const savedGifts = JSON.parse(localStorage.getItem('userGifts') || '{}');
            this.userGifts = new Map(Object.entries(savedGifts));
            console.log('📦 Loaded user gifts:', this.userGifts.size);
        } catch (error) {
            console.log('⚠️ Using empty user gifts data');
            this.userGifts = new Map();
        }
    }

    async loadUserProfiles() {
        try {
            const savedProfiles = JSON.parse(localStorage.getItem('userProfiles') || '{}');
            this.userProfiles = new Map(Object.entries(savedProfiles));
            console.log('👤 Loaded user profiles:', this.userProfiles.size);
        } catch (error) {
            console.log('⚠️ Using empty user profiles data');
            this.userProfiles = new Map();
        }
    }

    async loadEquippedGifts() {
        try {
            const equippedData = JSON.parse(localStorage.getItem('equippedGifts') || '{}');
            this.equippedGifts = new Map(Object.entries(equippedData));
            console.log('🎽 Loaded equipped gifts:', this.equippedGifts.size);
        } catch (error) {
            console.log('⚠️ Using empty equipped gifts data');
            this.equippedGifts = new Map();
        }
    }

    // Сохранение данных
    async saveUserGifts() {
        try {
            const data = Object.fromEntries(this.userGifts);
            localStorage.setItem('userGifts', JSON.stringify(data));
            console.log('💾 Saved user gifts');
        } catch (error) {
            console.error('❌ Error saving user gifts:', error);
        }
    }

    async saveEquippedGifts() {
        try {
            const data = Object.fromEntries(this.equippedGifts);
            localStorage.setItem('equippedGifts', JSON.stringify(data));
            console.log('💾 Saved equipped gifts');
        } catch (error) {
            console.error('❌ Error saving equipped gifts:', error);
        }
    }

    // Настройка подарков по умолчанию для новых пользователей
    setupDefaultGifts() {
        const currentUser = this.getCurrentUser();
        if (currentUser && !this.userGifts.has(currentUser)) {
            // Дарим бесплатный подарок новым пользователям
            const welcomeGift = {
                ...this.gifts.find(g => g.id === 'gift_1'),
                purchaseDate: new Date().toISOString(),
                isFree: true
            };
            
            this.userGifts.set(currentUser, [welcomeGift]);
            this.saveUserGifts();
            console.log('🎁 Added welcome gift for new user:', currentUser);
        }
    }

    // Основные методы работы с подарками
    getCurrentUser() {
        return document.getElementById('username')?.textContent || 'anonymous';
    }

    isGiftOwned(giftId, username = null) {
        const user = username || this.getCurrentUser();
        const userGifts = this.userGifts.get(user) || [];
        return userGifts.some(gift => gift.id === giftId);
    }

    getUserGifts(username = null) {
        const user = username || this.getCurrentUser();
        return this.userGifts.get(user) || [];
    }

    getUserGift(username, giftId) {
        const userGifts = this.getUserGifts(username);
        return userGifts.find(gift => gift.id === giftId);
    }

    getGiftById(giftId) {
        return this.gifts.find(gift => gift.id === giftId);
    }

    async buyGift(gift) {
        const currentUser = this.getCurrentUser();
        if (!currentUser || currentUser === 'anonymous') {
            throw new Error('Пользователь не найден');
        }

        if (this.isGiftOwned(gift.id)) {
            throw new Error('У вас уже есть этот подарок');
        }

        if (!window.currencyManager) {
            throw new Error('Система валюты недоступна');
        }

        if (window.currencyManager.balance < gift.price) {
            throw new Error(`Недостаточно монет. Нужно: ${gift.price} 🪙, у вас: ${window.currencyManager.balance} 🪙`);
        }

        try {
            // Списываем монеты
            window.currencyManager.balance -= gift.price;
            
            // Добавляем подарок пользователю
            const userGifts = this.getUserGifts();
            userGifts.push({
                ...gift,
                purchaseDate: new Date().toISOString(),
                from: 'purchase'
            });
            
            this.userGifts.set(currentUser, userGifts);

            // Сохраняем изменения
            await this.saveUserGifts();
            
            // Сохраняем данные валюты
            if (window.currencyManager.saveUserData) {
                await window.currencyManager.saveUserData();
            } else {
                window.currencyManager.saveLocalData();
            }

            // Добавляем запись в историю транзакций
            window.currencyManager.addTransaction({
                type: 'gift_purchase',
                amount: -gift.price,
                description: `Покупка подарка: ${gift.name}`,
                timestamp: new Date().toISOString()
            });

            console.log('✅ Gift purchased:', gift.name, 'by', currentUser);
            return true;
            
        } catch (error) {
            console.error('❌ Error buying gift:', error);
            
            // Откатываем изменения при ошибке
            window.currencyManager.balance += gift.price;
            
            throw new Error('Ошибка покупки подарка: ' + error.message);
        }
    }
// Получение подарков, которые были подарены пользователю
getReceivedGifts(username) {
    if (!this.giftsData[username]) {
        return [];
    }
    
    return this.giftsData[username].received || [];
}

// Отметить подарки как прочитанные
markGiftsAsRead(username) {
    if (this.giftsData[username] && this.giftsData[username].received) {
        this.giftsData[username].received.forEach(gift => {
            gift.isNew = false;
        });
        this.saveGiftsData();
    }
}
    // Отправка подарка другому пользователю из инвентаря
    async sendGiftFromInventory(sender, receiver, giftId) {
        if (!sender || !receiver) {
            throw new Error('Не указан отправитель или получатель');
        }

        if (sender === receiver) {
            throw new Error('Нельзя отправить подарок самому себе');
        }

        // Проверяем, есть ли подарок у отправителя
        if (!this.isGiftOwned(giftId, sender)) {
            throw new Error('У вас нет этого подарка');
        }

        try {
            const gift = this.getUserGift(sender, giftId);
            if (!gift) {
                throw new Error('Подарок не найден');
            }

            // Удаляем подарок у отправителя
            const senderGifts = this.getUserGifts(sender);
            const giftIndex = senderGifts.findIndex(g => g.id === giftId);
            if (giftIndex === -1) {
                throw new Error('Подарок не найден у отправителя');
            }

            const [sentGift] = senderGifts.splice(giftIndex, 1);
            this.userGifts.set(sender, senderGifts);

            // Добавляем подарок получателю
            const receiverGifts = this.getUserGifts(receiver);
            receiverGifts.push({
                ...sentGift,
                from: sender,
                receivedDate: new Date().toISOString(),
                originalPurchaseDate: sentGift.purchaseDate,
                isSentGift: true
            });

            this.userGifts.set(receiver, receiverGifts);

            // Сохраняем изменения
            await this.saveUserGifts();

            // Отправляем уведомление через сокет
            if (window.socket) {
                window.socket.emit('gift_sent', {
                    sender: sender,
                    receiver: receiver,
                    gift: sentGift,
                    timestamp: new Date().toISOString()
                });
            }

            // Показываем уведомление
            this.showNotification(`Подарок "${sentGift.name}" отправлен пользователю ${receiver}`, 'success');

            console.log('✅ Gift sent from inventory:', sentGift.name, 'from', sender, 'to', receiver);
            return true;

        } catch (error) {
            console.error('❌ Error sending gift from inventory:', error);
            throw error;
        }
    }

    // Покупка и мгновенная отправка подарка
    async buyAndSendGift(gift, receiver) {
        const sender = this.getCurrentUser();
        
        if (!sender || !receiver) {
            throw new Error('Не указан отправитель или получатель');
        }

        if (sender === receiver) {
            throw new Error('Нельзя отправить подарок самому себе');
        }

        try {
            // Покупаем подарок
            await this.buyGift(gift);
            
            // Немедленно отправляем его
            await this.sendGiftFromInventory(sender, receiver, gift.id);
            
            this.showNotification(`Подарок "${gift.name}" куплен и отправлен пользователю ${receiver}!`, 'success');
            return true;
            
        } catch (error) {
            console.error('❌ Error buying and sending gift:', error);
            throw error;
        }
    }

    // Управление надетыми подарками
    getEquippedGifts(username = null) {
        const user = username || this.getCurrentUser();
        return this.equippedGifts.get(user) || {};
    }

    isGiftEquipped(username, giftId) {
        const equipped = this.getEquippedGifts(username);
        return Object.values(equipped).includes(giftId);
    }

    async toggleGiftEquip(username, giftId, slot) {
        const user = username || this.getCurrentUser();
        
        if (!user) {
            throw new Error('Пользователь не найден');
        }

        try {
            if (!this.equippedGifts.has(user)) {
                this.equippedGifts.set(user, {});
            }

            const userEquipped = this.equippedGifts.get(user);
            const gift = this.getUserGift(user, giftId);

            if (!gift) {
                throw new Error('Подарок не найден');
            }

            if (!gift.wearable) {
                throw new Error('Этот подарок нельзя надеть');
            }

            if (gift.slot !== slot) {
                throw new Error(`Этот подарок можно надеть только в слот: ${gift.slot}`);
            }

            const isCurrentlyEquipped = userEquipped[slot] === giftId;
            let action;

            if (isCurrentlyEquipped) {
                // Снимаем подарок
                userEquipped[slot] = null;
                action = 'снят';
            } else {
                // Надеваем подарок (снимаем предыдущий если был)
                userEquipped[slot] = giftId;
                action = 'надет';
            }

            this.equippedGifts.set(user, userEquipped);
            await this.saveEquippedGifts();

            // Обновляем отображение профиля
            this.updateProfileDisplay(user);

            this.showNotification(`Подарок "${gift.name}" ${action}!`, 'success');
            console.log(`✅ Gift ${action}:`, gift.name, 'for user:', user);

            return !isCurrentlyEquipped; // возвращаем true если надели, false если сняли
            
        } catch (error) {
            console.error('❌ Error toggling gift equip:', error);
            this.showNotification(error.message, 'error');
            throw error;
        }
    }

    // Снятие всех подарков
    async unequipAllGifts(username = null) {
        const user = username || this.getCurrentUser();
        
        if (this.equippedGifts.has(user)) {
            this.equippedGifts.set(user, {});
            await this.saveEquippedGifts();
            this.updateProfileDisplay(user);
            this.showNotification('Все подарки сняты', 'info');
        }
    }

    // Получение статистики подарков
    getUserGiftStats(username = null) {
        const user = username || this.getCurrentUser();
        const userGifts = this.getUserGifts(user);
        const equippedGifts = this.getEquippedGifts(user);

        return {
            totalGifts: userGifts.length,
            equippedGifts: Object.values(equippedGifts).filter(Boolean).length,
            wearableGifts: userGifts.filter(g => g.wearable).length,
            collectedGifts: userGifts.filter(g => !g.wearable).length,
            byType: this.groupGiftsByType(userGifts),
            byCategory: this.groupGiftsByCategory(userGifts)
        };
    }

    groupGiftsByType(gifts) {
        return gifts.reduce((acc, gift) => {
            acc[gift.type] = (acc[gift.type] || 0) + 1;
            return acc;
        }, {});
    }

    groupGiftsByCategory(gifts) {
        return gifts.reduce((acc, gift) => {
            acc[gift.category] = (acc[gift.category] || 0) + 1;
            return acc;
        }, {});
    }

    // Поиск и фильтрация подарков
    searchGifts(query, category = 'all') {
        let filteredGifts = this.gifts;

        if (category !== 'all') {
            filteredGifts = filteredGifts.filter(gift => gift.category === category);
        }

        if (query) {
            const searchQuery = query.toLowerCase();
            filteredGifts = filteredGifts.filter(gift => 
                gift.name.toLowerCase().includes(searchQuery) ||
                gift.description.toLowerCase().includes(searchQuery)
            );
        }

        return filteredGifts;
    }

    getGiftsByCategory(category) {
        if (category === 'all') return this.gifts;
        return this.gifts.filter(gift => gift.category === category);
    }

    getGiftsByType(type) {
        return this.gifts.filter(gift => gift.type === type);
    }

    // Получение доступных для покупки подарков
    getAvailableGifts(username = null) {
        const user = username || this.getCurrentUser();
        return this.gifts.filter(gift => !this.isGiftOwned(gift.id, user));
    }

    // Получение редких подарков
    getRareGifts() {
        return this.gifts.filter(gift => gift.type === 'rare' || gift.type === 'epic' || gift.type === 'legendary');
    }

    // Восстановление подарков (для админа)
    async adminAddGift(username, giftId, from = 'admin') {
        const gift = this.getGiftById(giftId);
        if (!gift) {
            throw new Error('Подарок не найден');
        }

        const userGifts = this.getUserGifts(username);
        userGifts.push({
            ...gift,
            from: from,
            receivedDate: new Date().toISOString(),
            isAdminGift: true
        });

        this.userGifts.set(username, userGifts);
        await this.saveUserGifts();

        console.log(`✅ Admin added gift: ${gift.name} to user: ${username}`);
        return true;
    }

    // Удаление подарка (для админа)
    async adminRemoveGift(username, giftId) {
        const userGifts = this.getUserGifts(username);
        const filteredGifts = userGifts.filter(gift => gift.id !== giftId);
        
        this.userGifts.set(username, filteredGifts);
        await this.saveUserGifts();

        // Снимаем подарок если он был надет
        const equipped = this.getEquippedGifts(username);
        Object.keys(equipped).forEach(slot => {
            if (equipped[slot] === giftId) {
                equipped[slot] = null;
            }
        });
        this.equippedGifts.set(username, equipped);
        await this.saveEquippedGifts();

        console.log(`✅ Admin removed gift: ${giftId} from user: ${username}`);
        return true;
    }

    // Обновление отображения профиля
    updateProfileDisplay(username) {
        if (window.profileManager && window.profileManager.currentProfile?.username === username) {
            window.profileManager.displayProfile(window.profileManager.currentProfile);
        }

        // Обновляем отображение в настройках если открыто
        if (window.settingsManager && username === this.getCurrentUser()) {
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal && settingsModal.style.display === 'flex') {
                const activeTab = document.querySelector('.settings-tab.active');
                if (activeTab && activeTab.getAttribute('data-tab') === 'gifts') {
                    window.settingsManager.loadGiftsManagement();
                }
            }
        }
    }
async sendGift(sender, receiver, giftId) {
    if (!sender || !receiver) {
        throw new Error('Не указан отправитель или получатель');
    }

    if (sender === receiver) {
        throw new Error('Нельзя отправить подарок самому себе');
    }

    // Проверяем, есть ли подарок у отправителя
    if (!this.isGiftOwned(giftId, sender)) {
        throw new Error('У вас нет этого подарка');
    }

    try {
        const gift = this.getUserGift(sender, giftId);
        if (!gift) {
            throw new Error('Подарок не найден');
        }

        // Удаляем подарок у отправителя
        const senderGifts = this.getUserGifts(sender);
        const giftIndex = senderGifts.findIndex(g => g.id === giftId);
        if (giftIndex === -1) {
            throw new Error('Подарок не найден у отправителя');
        }

        const [sentGift] = senderGifts.splice(giftIndex, 1);
        this.userGifts.set(sender, senderGifts);

        // Добавляем подарок получателю
        const receiverGifts = this.getUserGifts(receiver);
        receiverGifts.push({
            ...sentGift,
            from: sender,
            receivedDate: new Date().toISOString(),
            originalPurchaseDate: sentGift.purchaseDate,
            isSentGift: true
        });

        this.userGifts.set(receiver, receiverGifts);

        // Сохраняем изменения
        await this.saveUserGifts();

        // Отправляем уведомление через сокет
        if (window.socket) {
            window.socket.emit('gift_sent', {
                sender: sender,
                receiver: receiver,
                gift: sentGift,
                timestamp: new Date().toISOString()
            });

            // Также отправляем событие получения
            window.socket.emit('gift_received', {
                sender: sender,
                receiver: receiver,
                gift: sentGift,
                timestamp: new Date().toISOString()
            });
        }

        console.log('✅ Gift sent:', sentGift.name, 'from', sender, 'to', receiver);
        return true;

    } catch (error) {
        console.error('❌ Error sending gift:', error);
        throw error;
    }
}

// Обновите метод sendGiftFromInventory
async sendGiftFromInventory(sender, receiver, giftId) {
    return await this.sendGift(sender, receiver, giftId);
}
    // Получение информации о подарке для отображения
    getGiftDisplayInfo(gift) {
        return {
            id: gift.id,
            name: gift.name,
            icon: gift.name.split(' ')[0],
            description: gift.description,
            price: gift.price,
            type: gift.type,
            category: gift.category,
            wearable: gift.wearable,
            slot: gift.slot,
            isNew: !gift.purchaseDate,
            from: gift.from
        };
    }

    // Получение бейджа типа подарка
    getGiftTypeBadge(type) {
        const badges = {
            'common': '<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Обычный</span>',
            'rare': '<span style="background: #007bff; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Редкий</span>',
            'epic': '<span style="background: #6f42c1; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Эпический</span>',
            'legendary': '<span style="background: #fd7e14; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px;">Легендарный</span>'
        };
        return badges[type] || badges.common;
    }

    // Экспорт данных пользователя (для бэкапа)
    exportUserData(username = null) {
        const user = username || this.getCurrentUser();
        const userGifts = this.getUserGifts(user);
        const equippedGifts = this.getEquippedGifts(user);

        return {
            username: user,
            exportDate: new Date().toISOString(),
            gifts: userGifts,
            equippedGifts: equippedGifts,
            stats: this.getUserGiftStats(user)
        };
    }

    // Импорт данных пользователя (для восстановления)
    async importUserData(data) {
        if (!data || !data.username || !data.gifts) {
            throw new Error('Некорректные данные для импорта');
        }

        this.userGifts.set(data.username, data.gifts);
        
        if (data.equippedGifts) {
            this.equippedGifts.set(data.username, data.equippedGifts);
        }

        await this.saveUserGifts();
        await this.saveEquippedGifts();

        this.showNotification('Данные подарков успешно импортированы', 'success');
        return true;
    }

    // Очистка данных пользователя (для тестирования)
    async clearUserData(username = null) {
        const user = username || this.getCurrentUser();
        
        this.userGifts.delete(user);
        this.equippedGifts.delete(user);
        
        await this.saveUserGifts();
        await this.saveEquippedGifts();

        this.showNotification('Данные подарков очищены', 'info');
        return true;
    }

    // Получение случайного подарка (для событий, наград)
    getRandomGift(rarity = 'common') {
        const giftsByRarity = this.gifts.filter(gift => gift.type === rarity);
        if (giftsByRarity.length === 0) {
            // Если нет подарков указанной редкости, возвращаем любой обычный
            return this.gifts.find(gift => gift.type === 'common') || this.gifts[0];
        }
        
        const randomIndex = Math.floor(Math.random() * giftsByRarity.length);
        return giftsByRifts[randomIndex];
    }

    // Проверка, можно ли надеть подарок
    canEquipGift(username, giftId) {
        const gift = this.getUserGift(username, giftId);
        if (!gift) return false;
        
        return gift.wearable && !this.isGiftEquipped(username, giftId);
    }

    // Получение свободных слотов
    getFreeSlots(username = null) {
        const user = username || this.getCurrentUser();
        const equipped = this.getEquippedGifts(user);
        const userGifts = this.getUserGifts(user);
        
        const freeSlots = {
            head: true,
            badge: true,
            background: true,
            effect: true
        };
        
        // Отмечаем занятые слоты
        Object.keys(equipped).forEach(slot => {
            if (equipped[slot]) {
                freeSlots[slot] = false;
            }
        });
        
        return freeSlots;
    }

    // Получение рекомендованных подарков (на основе уже имеющихся)
    getRecommendedGifts(username = null) {
        const user = username || this.getCurrentUser();
        const userGifts = this.getUserGifts(user);
        const userCategories = new Set(userGifts.map(gift => gift.category));
        
        // Рекомендуем подарки из категорий, которых у пользователя нет
        const recommended = this.gifts.filter(gift => 
            !userCategories.has(gift.category) && 
            !this.isGiftOwned(gift.id, user)
        );
        
        // Если таких нет, рекомендуем редкие подарки
        if (recommended.length === 0) {
            return this.getRareGifts().filter(gift => !this.isGiftOwned(gift.id, user));
        }
        
        return recommended;
    }

    // Вспомогательные методы
    showNotification(message, type = 'info') {
        if (window.privateChatInstance) {
            window.privateChatInstance.showNotification(message, type);
        } else {
            // Простая реализация уведомления
            const notification = document.createElement('div');
            notification.className = `gift-notification ${type}`;
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

    // Отладочные методы
    debugUserGifts(username = null) {
        const user = username || this.getCurrentUser();
        const userGifts = this.getUserGifts(user);
        const equipped = this.getEquippedGifts(user);
        
        return {
            username: user,
            totalGifts: userGifts.length,
            gifts: userGifts,
            equipped: equipped,
            stats: this.getUserGiftStats(user)
        };
    }

    // Сброс кэша (для разработки)
    clearCache() {
        this.userGifts.clear();
        this.equippedGifts.clear();
        localStorage.removeItem('userGifts');
        localStorage.removeItem('equippedGifts');
        console.log('🗑️ Gift cache cleared');
    }
}
window.CurrencyManager = CurrencyManager;
window.GiftManager = GiftManager;