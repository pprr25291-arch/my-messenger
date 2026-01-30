class VerificationManager {
    constructor() {
        this.verifiedUsers = new Set();
        this.currentUser = null;
        this.isAdmin = false;
        this.badgesMap = new Map();
        this.updateTimeout = null;
        this.observer = null;
        this.init();
    }

    async init() {
        console.log('✅ Initializing VerificationManager...');
        
        this.currentUser = document.getElementById('username')?.textContent || window.USERNAME;
        this.isAdmin = this.currentUser === 'admin';
        
        if (!this.isAdmin) {
            console.log('⚠️ User is not admin, VerificationManager initialized in read-only mode');
        } else {
            console.log('👑 VerificationManager initialized for admin');
        }
        
        await this.loadVerifiedUsers();
        this.addVerificationStyles();
        this.setupEventListeners();
        this.startDOMObserver();
        
        setTimeout(() => this.updateAllVerificationBadges(), 100);
    }

    startDOMObserver() {
        if (this.observer) {
            this.observer.disconnect();
        }
        
        this.observer = new MutationObserver((mutations) => {
            let needsUpdate = false;
            
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.matches && (
                                node.matches('.conversation-item') ||
                                node.matches('.search-result') ||
                                node.matches('.chat-top-bar') ||
                                node.querySelector('.username-text') ||
                                node.querySelector('.search-username') ||
                                node.querySelector('#currentChatUser') ||
                                node.querySelector('.conv-name')
                            )) {
                                needsUpdate = true;
                            }
                        }
                    });
                }
                
                if (mutation.type === 'characterData' || mutation.type === 'childList') {
                    const target = mutation.target;
                    if (target && target.nodeType === 3) {
                        const parent = target.parentElement;
                        if (parent && (
                            parent.classList.contains('username-text') ||
                            parent.classList.contains('search-username') ||
                            parent.id === 'currentChatUser' ||
                            parent.classList.contains('.conv-name')
                        )) {
                            needsUpdate = true;
                        }
                    }
                }
            });
            
            if (needsUpdate) {
                clearTimeout(this.updateTimeout);
                this.updateTimeout = setTimeout(() => {
                    this.updateAllVerificationBadges();
                }, 50);
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        console.log('👀 DOM Observer started for verification badges');
    }

    addVerificationStyles() {
        if (!document.getElementById('verification-styles')) {
            const style = document.createElement('style');
            style.id = 'verification-styles';
            style.textContent = `
                /* ОЧЕНЬ БОЛЬШАЯ галочка верификации перед именем пользователя */
                .verification-badge {
                    display: inline-flex !important;
                    align-items: center;
                    margin-right: 12px !important;
                    vertical-align: middle;
                    position: relative;
                    order: -1; /* Помещаем галочку перед текстом */
                }
                
                .verification-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent !important;
                    border: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    cursor: help;
                    position: relative;
                }
                
                /* ОЧЕНЬ БОЛЬШАЯ иконка галочки */
                .verification-icon img {
                    width: 32px !important; /* ОЧЕНЬ БОЛЬШОЙ размер */
                    height: 32px !important;
                    border-radius: 0;
                    object-fit: contain;
                    display: block;
                    filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3));
                    transition: all 0.3s ease;
                    min-width: 32px;
                    min-height: 32px;
                }
                
                .verification-icon:hover img {
                    transform: scale(1.15);
                    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
                }
                
                /* Позиционирование для разных контейнеров */
                .username-text,
                .search-username,
                #currentChatUser,
                .conv-name,
                .user-details h4,
                .conv-name,
                .conversation-item .conv-name,
                .chat-top-bar .user-details h4 {
                    display: flex !important;
                    align-items: center !important;
                    flex-wrap: wrap !important;
                    gap: 12px !important;
                }
                
                /* Галочка всегда первая и очень заметная */
                .username-text .verification-badge,
                .search-username .verification-badge,
                #currentChatUser .verification-badge,
                .conv-name .verification-badge,
                .user-details h4 .verification-badge,
                .conv-name .verification-badge,
                .conversation-item .conv-name .verification-badge {
                    order: -999 !important; /* Галочка ВСЕГДА первая */
                    margin-right: 12px !important;
                    margin-left: 0 !important;
                    flex-shrink: 0;
                }
                
                /* Убедимся что имя пользователя отображается правильно */
                .username-text span:not(.verification-badge),
                .search-username span:not(.verification-badge),
                #currentChatUser span:not(.verification-badge),
                .conv-name span:not(.verification-badge) {
                    display: inline !important;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                /* Стиль для подсказки */
                .verification-tooltip {
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.95);
                    color: white;
                    padding: 10px 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    white-space: nowrap;
                    z-index: 10000;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s, visibility 0.3s;
                    margin-bottom: 10px;
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    min-width: 180px;
                    text-align: center;
                }
                
                .verification-tooltip::before {
                    content: '✅ ';
                    margin-right: 5px;
                }
                
                .verification-icon:hover .verification-tooltip {
                    opacity: 1;
                    visibility: visible;
                }
                
                .verification-tooltip::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border-width: 8px;
                    border-style: solid;
                    border-color: rgba(0, 0, 0, 0.95) transparent transparent transparent;
                }
                
                /* Убираем все дополнительные галочки */
                .username-text .verification-badge ~ .verification-badge,
                .search-username .verification-badge ~ .verification-badge,
                #currentChatUser .verification-badge ~ .verification-badge,
                .conv-name .verification-badge ~ .verification-badge,
                .verified::after,
                .verified-username::after,
                .conversation-verified::after,
                .search-verified::after {
                    display: none !important;
                    content: none !important;
                }
                
                /* Скрываем дубликаты */
                [class*="verified"] .verification-badge ~ span {
                    display: none !important;
                }
                
                /* Адаптивность для мобильных */
                @media (max-width: 768px) {
                    .verification-icon img {
                        width: 28px !important;
                        height: 28px !important;
                        min-width: 28px;
                        min-height: 28px;
                    }
                    
                    .verification-badge {
                        margin-right: 10px !important;
                    }
                    
                    .verification-tooltip {
                        font-size: 13px;
                        min-width: 160px;
                        padding: 8px 12px;
                    }
                }
                
                /* Для очень маленьких экранов */
                @media (max-width: 480px) {
                    .verification-icon img {
                        width: 24px !important;
                        height: 24px !important;
                        min-width: 24px;
                        min-height: 24px;
                    }
                    
                    .verification-badge {
                        margin-right: 8px !important;
                    }
                }
                
                /* Стили для админ-панели верификации */
                .verification-user-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    border-bottom: 1px solid #e9ecef;
                    transition: background-color 0.2s;
                }
                
                .verification-user-item:hover {
                    background-color: #f8f9fa;
                }
                
                .verification-user-info {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                
                .verification-user-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 2px solid #dee2e6;
                }
                
                .username-display {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 16px;
                    font-weight: 500;
                }
                
                .username-display .verification-badge {
                    margin-right: 8px;
                }
                
                .username-display .verification-badge img {
                    width: 20px !important;
                    height: 20px !important;
                }
                
                .verification-user-status {
                    font-size: 13px;
                    margin-top: 3px;
                    font-weight: 500;
                }
                
                .verification-user-status.verified {
                    color: #28a745;
                }
                
                .verification-user-status.unverified {
                    color: #dc3545;
                }
                
                .verification-actions {
                    display: flex;
                    gap: 8px;
                }
                
                .verification-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                }
                
                .verification-btn.verify {
                    background: #28a745;
                    color: white;
                }
                
                .verification-btn.verify:hover {
                    background: #218838;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
                }
                
                .verification-btn.unverify {
                    background: #dc3545;
                    color: white;
                }
                
                .verification-btn.unverify:hover {
                    background: #c82333;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
                }
                
                .verification-btn:disabled {
                    background: #6c757d;
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                
                .loading, .empty, .error {
                    text-align: center;
                    padding: 30px;
                    color: #6c757d;
                    font-size: 16px;
                }
                
                /* Специальные стили для заголовка чата */
                .chat-top-bar .user-details h4 {
                    font-size: 20px !important;
                    font-weight: 700 !important;
                }
                
                .chat-top-bar .verification-icon img {
                    width: 36px !important;
                    height: 36px !important;
                    min-width: 36px;
                    min-height: 36px;
                }
                
                /* Стили для списка бесед */
                .conversation-item .conv-name {
                    font-size: 16px;
                    font-weight: 600;
                }
                
                .conversation-item .verification-icon img {
                    width: 28px !important;
                    height: 28px !important;
                    min-width: 28px;
                    min-height: 28px;
                }
                
                /* Стили для результатов поиска */
                .search-result .search-username {
                    font-size: 16px;
                    font-weight: 600;
                }
                
                .search-result .verification-icon img {
                    width: 28px !important;
                    height: 28px !important;
                    min-width: 28px;
                    min-height: 28px;
                }
                
                /* Принудительное применение стилей */
                .verified-username {
                    display: flex !important;
                    align-items: center !important;
                    gap: 12px !important;
                }
                
                .verified-username::before {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    async loadVerifiedUsers() {
        try {
            console.log('🔄 Loading verified users...');
            
            const endpoints = [
                '/api/verified-users',
                '/api/verified-users/auth',
                '/api/users/verified'
            ];
            
            let success = false;
            
            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        let verifiedUsers = [];
                        
                        if (Array.isArray(data)) {
                            verifiedUsers = data;
                        } else if (data && Array.isArray(data.users)) {
                            verifiedUsers = data.users.map(u => u.username);
                        }
                        
                        if (verifiedUsers.length > 0) {
                            this.verifiedUsers = new Set(verifiedUsers);
                            console.log(`✅ Loaded ${verifiedUsers.length} verified users from ${endpoint}`);
                            success = true;
                            break;
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Endpoint ${endpoint} failed:`, error.message);
                    continue;
                }
            }
            
            if (!success) {
                await this.loadVerifiedUsersViaSocket();
            }
            
            this.verifiedUsers.add('admin');
            
        } catch (error) {
            console.error('❌ Error loading verified users:', error);
            await this.loadVerifiedUsersViaSocket();
        }
    }

    async loadVerifiedUsersViaSocket() {
        return new Promise((resolve) => {
            if (window.socket && typeof window.socket.emit === 'function') {
                console.log('🔄 Trying to load verified users via socket...');
                
                window.socket.emit('get_verified_users', (verifiedUsers) => {
                    if (verifiedUsers && Array.isArray(verifiedUsers)) {
                        this.verifiedUsers = new Set(verifiedUsers);
                        console.log(`✅ Loaded ${verifiedUsers.length} verified users via socket`);
                    } else {
                        this.verifiedUsers = new Set(['admin']);
                        console.log('⚠️ Socket returned invalid data, using default list');
                    }
                    resolve();
                });
                
                setTimeout(() => {
                    if (this.verifiedUsers.size === 0) {
                        this.verifiedUsers = new Set(['admin']);
                        console.log('⚠️ Socket timeout, using default list');
                    }
                    resolve();
                }, 3000);
            } else {
                this.verifiedUsers = new Set(['admin']);
                console.log('⚠️ No socket available, using default list');
                resolve();
            }
        });
    }

    updateAllVerificationBadges() {
        console.log('🔍 Updating verification badges...');
        
        this.clearAllBadges();
        this.updateUsernameElements();
        
        console.log('✅ Verification badges updated');
    }

    clearAllBadges() {
        const badges = document.querySelectorAll('.verification-badge, .verification-icon');
        badges.forEach(badge => {
            if (badge.parentNode) {
                badge.parentNode.removeChild(badge);
            }
        });
        
        this.badgesMap.clear();
    }

    updateUsernameElements() {
        this.updateConversationsBadges();
        this.updateSearchResultsBadges();
        this.updateActiveChatBadges();
        this.updateChatHeadersBadges();
    }

    updateConversationsBadges() {
        const elements = document.querySelectorAll('.conversation-item .username-text, .conversation-item .conv-name');
        elements.forEach(el => {
            const username = this.extractUsernameFromElement(el);
            if (username && this.verifiedUsers.has(username)) {
                this.addSingleBadge(el, username);
            }
        });
    }

    updateSearchResultsBadges() {
        const elements = document.querySelectorAll('.search-username, .search-user-details .search-username');
        elements.forEach(el => {
            const username = this.extractUsernameFromElement(el);
            if (username && this.verifiedUsers.has(username)) {
                this.addSingleBadge(el, username);
            }
        });
    }

    updateActiveChatBadges() {
        const element = document.getElementById('currentChatUser');
        if (element) {
            const username = this.extractUsernameFromElement(element);
            if (username && this.verifiedUsers.has(username)) {
                this.addSingleBadge(element, username);
            }
        }
    }

    updateChatHeadersBadges() {
        const elements = document.querySelectorAll('.chat-top-bar h4, .user-details h4');
        elements.forEach(el => {
            const username = this.extractUsernameFromElement(el);
            if (username && this.verifiedUsers.has(username)) {
                this.addSingleBadge(el, username);
            }
        });
    }

    extractUsernameFromElement(element) {
        if (!element) return null;
        
        let username = '';
        username = element.textContent || '';
        username = username.replace('✓', '').trim();
        username = username.replace(/[^a-zA-Z0-9_]/g, '');
        
        if (!username) {
            username = element.getAttribute('data-username') || '';
        }
        
        if (this.isGroupName(username) || username.includes('👥')) {
            return null;
        }
        
        return username || null;
    }

    isGroupName(username) {
        if (!username) return true;
        return username.includes('группа') || username.includes('Group') || username.startsWith('group_');
    }

    hasBadge(element) {
        if (!element) return true;
        return element.querySelector('.verification-badge') !== null;
    }

    createVerificationBadge(username) {
        const badge = document.createElement('span');
        badge.className = 'verification-badge';
        badge.innerHTML = `
            <span class="verification-icon" title="Верифицированный пользователь">
                <img src="/static/galka.png" alt="✓">
                <span class="verification-tooltip">Верифицированный пользователь</span>
            </span>
        `;
        
        badge.style.cssText = `
            display: inline-flex !important;
            align-items: center !important;
            margin-right: 12px !important;
            order: -999 !important;
            flex-shrink: 0;
        `;
        
        return badge;
    }

    addSingleBadge(element, username) {
        if (!element || this.hasBadge(element)) return;
        
        const badgeKey = `${username}_${element.tagName}_${Array.from(element.classList).join('_')}`;
        
        if (this.badgesMap.has(badgeKey)) return;
        
        const badge = this.createVerificationBadge(username);
        
        // Принудительно применяем стили к элементу
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.gap = '12px';
        element.style.flexWrap = 'wrap';
        
        // Вставляем галочку в самое начало элемента
        if (element.firstChild) {
            element.insertBefore(badge, element.firstChild);
        } else {
            element.appendChild(badge);
        }
        
        this.badgesMap.set(badgeKey, badge);
        element.classList.add('verified-username');
        
        console.log(`✅ Added verification badge for ${username}`);
    }

    async displayUsersVerificationList() {
        const container = document.getElementById('usersVerificationList');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Загрузка пользователей...</div>';
        
        try {
            const token = this.getAuthToken();
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch('/api/users/all', {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load users');
            }
            
            const users = await response.json();
            
            if (users.length === 0) {
                container.innerHTML = '<div class="empty">Нет пользователей</div>';
                return;
            }
            
            users.sort((a, b) => {
                const aVerified = this.verifiedUsers.has(a.username);
                const bVerified = this.verifiedUsers.has(b.username);
                if (aVerified && !bVerified) return -1;
                if (!aVerified && bVerified) return 1;
                return a.username.localeCompare(b.username);
            });
            
            let html = '';
            users.forEach(user => {
                const isVerified = this.verifiedUsers.has(user.username);
                const isCurrentUser = user.username === this.currentUser;
                
                html += `
                    <div class="verification-user-item" data-username="${user.username}">
                        <div class="verification-user-info">
                            <img src="${user.avatar || '/static/default-avatar.png'}" 
                                 class="verification-user-avatar" 
                                 alt="${user.username}"
                                 onerror="this.src='/static/default-avatar.png'">
                            <div>
                                <div class="username-display">
                                    ${isVerified ? '<span class="verification-badge" style="margin-right: 8px;"><img src="/static/galka.png" style="width: 20px; height: 20px; background: transparent;"></span>' : ''}
                                    ${user.username}
                                </div>
                                <div class="verification-user-status ${isVerified ? 'verified' : 'unverified'}">
                                    ${isVerified ? '✅ Верифицирован' : '❌ Не верифицирован'}
                                </div>
                            </div>
                        </div>
                        <div class="verification-actions">
                            ${!isVerified ? `
                                <button class="verification-btn verify" onclick="window.verificationManager.verifyUser('${user.username}')" ${isCurrentUser ? 'disabled' : ''}>
                                    Выдать
                                </button>
                            ` : `
                                <button class="verification-btn unverify" onclick="window.verificationManager.unverifyUser('${user.username}')" ${isCurrentUser ? 'disabled' : ''}>
                                    Отозвать
                                </button>
                            `}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            
            const searchInput = document.getElementById('verificationSearch');
            if (searchInput) {
                searchInput.addEventListener('input', this.debounce(() => {
                    this.filterUsersList(searchInput.value.trim());
                }, 300));
            }
            
        } catch (error) {
            console.error('❌ Error loading users list:', error);
            container.innerHTML = '<div class="error">Ошибка загрузки пользователей</div>';
        }
    }

    filterUsersList(searchTerm) {
        const items = document.querySelectorAll('.verification-user-item');
        if (!searchTerm) {
            items.forEach(item => item.style.display = 'flex');
            return;
        }
        
        const searchLower = searchTerm.toLowerCase();
        items.forEach(item => {
            const username = item.getAttribute('data-username').toLowerCase();
            const display = username.includes(searchLower) ? 'flex' : 'none';
            item.style.display = display;
        });
    }

    async verifyUser(username = null) {
        if (!this.isAdmin) {
            this.showNotification('Недостаточно прав', 'error');
            return false;
        }
        
        const targetUser = username || document.getElementById('verificationTargetUser')?.value.trim();
        const reason = document.getElementById('verificationReason')?.value.trim();
        
        if (!targetUser) {
            this.showNotification('Введите имя пользователя', 'error');
            return false;
        }
        
        if (targetUser === this.currentUser) {
            this.showNotification('Нельзя изменить свою собственную верификацию', 'error');
            return false;
        }
        
        try {
            const token = this.getAuthToken();
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch('/api/verify-user', {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify({
                    targetUser: targetUser,
                    reason: reason,
                    admin: this.currentUser
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                this.verifiedUsers.add(targetUser);
                this.updateAllVerificationBadges();
                
                if (document.getElementById('adminPanel')?.style.display === 'flex') {
                    this.displayUsersVerificationList();
                }
                
                if (window.socket) {
                    window.socket.emit('user_verification_changed', {
                        username: targetUser,
                        verified: true,
                        by: this.currentUser,
                        reason: reason
                    });
                }
                
                this.showNotification(result.message || `Пользователь ${targetUser} верифицирован`, 'success');
                
                if (!username) {
                    const targetInput = document.getElementById('verificationTargetUser');
                    const reasonInput = document.getElementById('verificationReason');
                    if (targetInput) targetInput.value = '';
                    if (reasonInput) reasonInput.value = '';
                }
                
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка сервера');
            }
        } catch (error) {
            console.error('❌ Verification error:', error);
            this.showNotification(error.message, 'error');
            return false;
        }
    }

    async unverifyUser(username = null) {
        if (!this.isAdmin) {
            this.showNotification('Недостаточно прав', 'error');
            return false;
        }
        
        const targetUser = username || document.getElementById('verificationTargetUser')?.value.trim();
        const reason = document.getElementById('verificationReason')?.value.trim();
        
        if (!targetUser) {
            this.showNotification('Введите имя пользователя', 'error');
            return false;
        }
        
        if (targetUser === this.currentUser) {
            this.showNotification('Нельзя изменить свою собственную верификацию', 'error');
            return false;
        }
        
        try {
            const token = this.getAuthToken();
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch('/api/unverify-user', {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify({
                    targetUser: targetUser,
                    reason: reason,
                    admin: this.currentUser
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                this.verifiedUsers.delete(targetUser);
                this.updateAllVerificationBadges();
                
                if (document.getElementById('adminPanel')?.style.display === 'flex') {
                    this.displayUsersVerificationList();
                }
                
                if (window.socket) {
                    window.socket.emit('user_verification_changed', {
                        username: targetUser,
                        verified: false,
                        by: this.currentUser,
                        reason: reason
                    });
                }
                
                this.showNotification(result.message || `Верификация пользователя ${targetUser} отозвана`, 'success');
                
                if (!username) {
                    const targetInput = document.getElementById('verificationTargetUser');
                    const reasonInput = document.getElementById('verificationReason');
                    if (targetInput) targetInput.value = '';
                    if (reasonInput) reasonInput.value = '';
                }
                
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка сервера');
            }
        } catch (error) {
            console.error('❌ Unverification error:', error);
            this.showNotification(error.message, 'error');
            return false;
        }
    }

    setupEventListeners() {
        if (window.socket) {
            window.socket.on('user_verification_changed', (data) => {
                console.log('✅ Verification status changed:', data);
                
                if (data.verified) {
                    this.verifiedUsers.add(data.username);
                } else {
                    this.verifiedUsers.delete(data.username);
                }
                
                this.updateAllVerificationBadges();
                
                if (data.by !== this.currentUser) {
                    const action = data.verified ? 'верифицирован' : 'лишен верификации';
                    const message = `Пользователь ${data.username} ${action} администратором ${data.by}`;
                    this.showNotification(message, 'info');
                }
            });
            
            window.socket.on('get_verified_users', (data) => {
                if (data && Array.isArray(data)) {
                    this.verifiedUsers = new Set(data);
                    this.updateAllVerificationBadges();
                }
            });
        }
        
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('admin-tab-btn')) {
                const tabName = e.target.getAttribute('data-tab');
                if (tabName === 'verification') {
                    setTimeout(() => {
                        this.displayUsersVerificationList();
                    }, 100);
                }
            }
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.conversation-item') || 
                e.target.closest('.search-result') ||
                e.target.closest('.start-chat-btn')) {
                setTimeout(() => this.updateAllVerificationBadges(), 300);
            }
        });
        
        setInterval(() => {
            this.loadVerifiedUsers();
        }, 60000);
    }

    showNotification(message, type = 'info') {
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
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    getAuthToken() {
        try {
            if (window.localStorage) {
                const token = localStorage.getItem('token') || localStorage.getItem('authToken');
                if (token) return token;
            }
            
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.startsWith('token=')) {
                    return cookie.substring(6);
                }
                if (cookie.startsWith('authToken=')) {
                    return cookie.substring(10);
                }
            }
            
            if (window.authToken) {
                return window.authToken;
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            const tokenParam = urlParams.get('token') || urlParams.get('authToken');
            if (tokenParam) {
                return tokenParam;
            }
            
            return null;
        } catch (error) {
            console.error('Error getting auth token:', error);
            return null;
        }
    }

    isUserVerified(username) {
        return this.verifiedUsers.has(username);
    }

    addVerificationBadgeToElement(element, username) {
        if (!element || this.hasBadge(element) || !this.isUserVerified(username)) return;
        this.addSingleBadge(element, username);
    }

    forceUpdate() {
        this.updateAllVerificationBadges();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (!window.verificationManager) {
        console.log('✅ Creating VerificationManager instance...');
        window.verificationManager = new VerificationManager();
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VerificationManager;
}