const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, dialog, systemPreferences } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const isDev = process.env.NODE_ENV === 'development';

// Инициализация MEGA хранилища
const mega = require('megajs');

// Конфигурация MEGA
const MEGA_CONFIG = {
    email: process.env.MEGA_EMAIL || 'your-email@example.com',
    password: process.env.MEGA_PASSWORD || 'your-mega-password'
};

let mainWindow;
let tray = null;
let isQuitting = false;
let megaStorage = null;

// Константы для уведомлений
const NOTIFICATION_TYPES = {
    MESSAGE: 'message',
    GIFT: 'gift',
    CALL: 'call',
    SYSTEM: 'system'
};

// Создание главного окна
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'assets/icons/icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
            devTools: isDev
        },
        frame: true,
        titleBarStyle: 'default',
        show: false,
        backgroundColor: '#1a1a1a'
    });

    // Загружаем приложение
    const startUrl = isDev 
        ? 'http://localhost:3000' 
        : `file://${path.join(__dirname, 'build/index.html')}`;
    
    mainWindow.loadURL(startUrl);

    // Показать окно когда готово
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }
        
        // Проверить обновления после загрузки
        autoUpdater.checkForUpdatesAndNotify();
    });

    // События окна
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

    mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });

    // Восстановить позицию окна из памяти
    restoreWindowState();
}

// Восстановление состояния окна
function restoreWindowState() {
    const windowState = JSON.parse(localStorage.getItem('windowState') || '{}');
    
    if (windowState.maximized) {
        mainWindow.maximize();
    } else if (windowState.width && windowState.height) {
        mainWindow.setSize(windowState.width, windowState.height);
    }
    
    if (windowState.x && windowState.y) {
        mainWindow.setPosition(windowState.x, windowState.y);
    }
}

// Сохранение состояния окна
function saveWindowState() {
    const bounds = mainWindow.getBounds();
    const state = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        maximized: mainWindow.isMaximized()
    };
    
    localStorage.setItem('windowState', JSON.stringify(state));
}

// Создание иконки в трее
function createTray() {
    const iconPath = isDev
        ? path.join(__dirname, 'assets/icons/tray-icon.png')
        : path.join(__dirname, 'resources/icons/tray-icon.png');
    
    const trayIcon = nativeImage.createFromPath(iconPath);
    
    // Ресайзим иконку для разных систем
    trayIcon.resize({ width: 16, height: 16 });
    
    tray = new Tray(trayIcon);
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Показать приложение',
            click: () => {
                showMainWindow();
            }
        },
        {
            label: 'Новое сообщение',
            click: () => {
                showMainWindow();
                mainWindow.webContents.send('new-message');
            }
        },
        {
            label: 'Быстрый поиск',
            click: () => {
                showMainWindow();
                mainWindow.webContents.send('quick-search');
            }
        },
        { type: 'separator' },
        {
            label: 'Настройки',
            click: () => {
                showMainWindow();
                mainWindow.webContents.send('open-settings');
            }
        },
        { type: 'separator' },
        {
            label: 'Сделать бэкап в MEGA',
            click: async () => {
                await backupToMEGA();
            }
        },
        {
            label: 'Синхронизировать данные',
            click: async () => {
                await syncWithCloud();
            }
        },
        { type: 'separator' },
        {
            label: 'Обновить приложение',
            click: () => {
                autoUpdater.checkForUpdatesAndNotify();
            }
        },
        {
            label: 'Перезапустить',
            click: () => {
                app.relaunch();
                app.exit();
            }
        },
        { type: 'separator' },
        {
            label: 'Выход',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.setToolTip('My Messenger');
    
    // Клик по иконке в трее
    tray.on('click', () => {
        showMainWindow();
    });
    
    // Двойной клик
    tray.on('double-click', () => {
        showMainWindow();
    });
}

// Показать главное окно
function showMainWindow() {
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
    }
}

// Инициализация MEGA хранилища
async function initMEGAStorage() {
    try {
        console.log('🔗 Initializing MEGA storage...');
        
        megaStorage = await new mega.Storage({
            email: MEGA_CONFIG.email,
            password: MEGA_CONFIG.password,
            autoload: true,
            autologin: true
        });
        
        console.log('✅ MEGA storage initialized');
        
        // Проверяем доступность
        const accountInfo = await megaStorage.getAccountInfo();
        console.log('📊 MEGA Account Info:', {
            spaceUsed: accountInfo.spaceUsed,
            spaceTotal: accountInfo.spaceTotal,
            email: accountInfo.email
        });
        
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize MEGA storage:', error.message);
        return false;
    }
}

// Бэкап в MEGA
async function backupToMEGA() {
    try {
        if (!megaStorage) {
            const initialized = await initMEGAStorage();
            if (!initialized) {
                throw new Error('MEGA storage not available');
            }
        }
        
        // Создаем папку для бэкапов
        const backupFolderName = `backup-${new Date().toISOString().split('T')[0]}`;
        const backupFolder = await megaStorage.mkdir(backupFolderName);
        
        // Файлы для бэкапа
        const backupFiles = [
            {
                name: 'user-data.json',
                path: path.join(app.getPath('userData'), 'user-data.json'),
                type: 'user-data'
            },
            {
                name: 'settings.json',
                path: path.join(app.getPath('userData'), 'settings.json'),
                type: 'settings'
            },
            {
                name: 'messages-backup.json',
                path: path.join(app.getPath('userData'), 'messages-backup.json'),
                type: 'messages'
            }
        ];
        
        let uploadedCount = 0;
        
        for (const file of backupFiles) {
            try {
                // Проверяем существование файла
                const fs = require('fs');
                if (fs.existsSync(file.path)) {
                    await backupFolder.upload(file.path, { name: file.name });
                    uploadedCount++;
                    console.log(`✅ Uploaded: ${file.name}`);
                }
            } catch (error) {
                console.error(`❌ Error uploading ${file.name}:`, error.message);
            }
        }
        
        // Отправляем уведомление
        if (mainWindow) {
            mainWindow.webContents.send('backup-completed', {
                success: uploadedCount > 0,
                filesUploaded: uploadedCount,
                totalFiles: backupFiles.length,
                backupPath: backupFolderName
            });
        }
        
        // Показываем системное уведомление
        if (uploadedCount > 0) {
            showNotification({
                title: 'Бэкап завершен',
                body: `Загружено ${uploadedCount} из ${backupFiles.length} файлов в MEGA`,
                type: NOTIFICATION_TYPES.SYSTEM
            });
        }
        
        return {
            success: true,
            uploaded: uploadedCount,
            total: backupFiles.length,
            folder: backupFolderName
        };
        
    } catch (error) {
        console.error('❌ Backup failed:', error);
        
        if (mainWindow) {
            mainWindow.webContents.send('backup-error', {
                error: error.message
            });
        }
        
        showNotification({
            title: 'Ошибка бэкапа',
            body: error.message,
            type: NOTIFICATION_TYPES.SYSTEM
        });
        
        return { success: false, error: error.message };
    }
}

// Синхронизация с облаком
async function syncWithCloud() {
    try {
        if (!megaStorage) {
            const initialized = await initMEGAStorage();
            if (!initialized) {
                throw new Error('MEGA storage not available');
            }
        }
        
        // Ищем последний бэкап
        const root = await megaStorage.root;
        const folders = await root.getChildren();
        const backupFolders = folders.filter(f => f.name.startsWith('backup-'));
        
        if (backupFolders.length === 0) {
            console.log('ℹ️ No backups found in MEGA');
            
            showNotification({
                title: 'Синхронизация',
                body: 'Бэкапы не найдены в облаке',
                type: NOTIFICATION_TYPES.SYSTEM
            });
            
            return { success: false, message: 'No backups found' };
        }
        
        // Сортируем по дате (новые сначала)
        backupFolders.sort((a, b) => 
            new Date(b.name.replace('backup-', '')) - new Date(a.name.replace('backup-', ''))
        );
        
        const latestBackup = backupFolders[0];
        console.log(`🔄 Using latest backup: ${latestBackup.name}`);
        
        // Получаем файлы из бэкапа
        const backupFiles = await latestBackup.getChildren();
        
        // Скачиваем файлы
        const downloadPromises = backupFiles.map(async (file) => {
            const localPath = path.join(app.getPath('userData'), file.name);
            
            // Проверяем, нужно ли обновлять (по размеру файла или дате модификации)
            const fs = require('fs');
            if (fs.existsSync(localPath)) {
                const localStats = fs.statSync(localPath);
                if (localStats.size === file.size) {
                    console.log(`ℹ️ Skipping ${file.name} - already up to date`);
                    return { name: file.name, status: 'skipped' };
                }
            }
            
            try {
                await file.download(localPath);
                console.log(`✅ Downloaded: ${file.name}`);
                return { name: file.name, status: 'downloaded' };
            } catch (error) {
                console.error(`❌ Error downloading ${file.name}:`, error.message);
                return { name: file.name, status: 'error', error: error.message };
            }
        });
        
        const results = await Promise.all(downloadPromises);
        const downloaded = results.filter(r => r.status === 'downloaded').length;
        
        // Отправляем результат в рендерер
        if (mainWindow) {
            mainWindow.webContents.send('sync-completed', {
                success: downloaded > 0,
                filesDownloaded: downloaded,
                totalFiles: backupFiles.length,
                backupName: latestBackup.name,
                results: results
            });
        }
        
        // Показываем уведомление
        if (downloaded > 0) {
            showNotification({
                title: 'Синхронизация завершена',
                body: `Загружено ${downloaded} файлов из облака`,
                type: NOTIFICATION_TYPES.SYSTEM
            });
        }
        
        return {
            success: true,
            downloaded: downloaded,
            total: backupFiles.length,
            backupName: latestBackup.name,
            results: results
        };
        
    } catch (error) {
        console.error('❌ Sync failed:', error);
        
        if (mainWindow) {
            mainWindow.webContents.send('sync-error', {
                error: error.message
            });
        }
        
        showNotification({
            title: 'Ошибка синхронизации',
            body: error.message,
            type: NOTIFICATION_TYPES.SYSTEM
        });
        
        return { success: false, error: error.message };
    }
}

// Показать уведомление
function showNotification(notification) {
    if (!mainWindow || !mainWindow.webContents) return;
    
    mainWindow.webContents.send('show-notification', notification);
    
    // Также показываем системное уведомление если окно не активно
    if (!mainWindow.isFocused()) {
        const { Notification } = require('electron');
        
        const electronNotification = new Notification({
            title: notification.title,
            body: notification.body,
            silent: notification.type === NOTIFICATION_TYPES.MESSAGE,
            icon: path.join(__dirname, 'assets/icons/notification.png')
        });
        
        electronNotification.on('click', () => {
            showMainWindow();
            
            // Направляем пользователя к соответствующему разделу
            if (notification.type === NOTIFICATION_TYPES.MESSAGE && notification.sender) {
                mainWindow.webContents.send('focus-chat', { sender: notification.sender });
            } else if (notification.type === NOTIFICATION_TYPES.GIFT) {
                mainWindow.webContents.send('open-gifts');
            } else if (notification.type === NOTIFICATION_TYPES.CALL) {
                mainWindow.webContents.send('open-call', { callId: notification.callId });
            }
        });
        
        electronNotification.show();
    }
}

// IPC обработчики
function setupIPC() {
    // Сохранение настроек
    ipcMain.handle('save-settings', (event, settings) => {
        const fs = require('fs');
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        return { success: true };
    });
    
    // Загрузка настроек
    ipcMain.handle('load-settings', () => {
        const fs = require('fs');
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            return JSON.parse(data);
        }
        
        return {};
    });
    
    // Экспорт данных
    ipcMain.handle('export-data', async (event, data) => {
        const { dialog } = require('electron');
        const fs = require('fs');
        
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Экспорт данных',
            defaultPath: `messenger-backup-${Date.now()}.json`,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
            return { success: true, path: result.filePath };
        }
        
        return { success: false, canceled: true };
    });
    
    // Импорт данных
    ipcMain.handle('import-data', async () => {
        const { dialog } = require('electron');
        const fs = require('fs');
        
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Импорт данных',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            const data = fs.readFileSync(filePath, 'utf8');
            return { success: true, data: JSON.parse(data), path: filePath };
        }
        
        return { success: false, canceled: true };
    });
    
    // Открыть внешнюю ссылку
    ipcMain.on('open-external', (event, url) => {
        shell.openExternal(url);
    });
    
    // Показать диалог выбора папки
    ipcMain.handle('select-folder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Выберите папку для сохранения файлов',
            properties: ['openDirectory', 'createDirectory']
        });
        
        if (!result.canceled) {
            return { success: true, path: result.filePaths[0] };
        }
        
        return { success: false, canceled: true };
    });
    
    // Проверить разрешения
    ipcMain.handle('check-permissions', async () => {
        const permissions = {
            microphone: systemPreferences.getMediaAccessStatus('microphone') === 'granted',
            camera: systemPreferences.getMediaAccessStatus('camera') === 'granted',
            notifications: true // Уведомления обычно разрешены по умолчанию
        };
        
        return permissions;
    });
    
    // Запрос разрешений
    ipcMain.handle('request-permission', async (event, permission) => {
        if (permission === 'microphone') {
            const granted = await systemPreferences.askForMediaAccess('microphone');
            return { granted };
        } else if (permission === 'camera') {
            const granted = await systemPreferences.askForMediaAccess('camera');
            return { granted };
        }
        
        return { granted: false };
    });
    
    // Получить системную информацию
    ipcMain.handle('get-system-info', () => {
        const os = require('os');
        
        return {
            platform: process.platform,
            arch: process.arch,
            version: os.version(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpus: os.cpus().length,
            hostname: os.hostname(),
            userInfo: os.userInfo()
        };
    });
    
    // Управление окном
    ipcMain.on('window-control', (event, action) => {
        if (!mainWindow) return;
        
        switch (action) {
            case 'minimize':
                mainWindow.minimize();
                break;
            case 'maximize':
                if (mainWindow.isMaximized()) {
                    mainWindow.unmaximize();
                } else {
                    mainWindow.maximize();
                }
                break;
            case 'close':
                isQuitting = true;
                app.quit();
                break;
            case 'hide':
                mainWindow.hide();
                break;
            case 'show':
                showMainWindow();
                break;
            case 'reload':
                mainWindow.reload();
                break;
        }
    });
    
    // Запрос на бэкап
    ipcMain.handle('request-backup', async () => {
        return await backupToMEGA();
    });
    
    // Запрос на синхронизацию
    ipcMain.handle('request-sync', async () => {
        return await syncWithCloud();
    });
    
    // Получить версию приложения
    ipcMain.handle('get-app-version', () => {
        return app.getVersion();
    });
}

// Автообновление
function setupAutoUpdater() {
    if (isDev) {
        console.log('⚠️ Auto-updater disabled in development');
        return;
    }
    
    autoUpdater.logger = require('electron-log');
    autoUpdater.logger.transports.file.level = 'info';
    
    autoUpdater.on('checking-for-update', () => {
        console.log('🔄 Checking for updates...');
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'checking' });
        }
    });
    
    autoUpdater.on('update-available', (info) => {
        console.log('🎉 Update available:', info.version);
        
        if (mainWindow) {
            mainWindow.webContents.send('update-available', {
                version: info.version,
                releaseDate: info.releaseDate
            });
        }
        
        // Показываем уведомление
        showNotification({
            title: 'Доступно обновление',
            body: `Версия ${info.version} доступна для загрузки`,
            type: NOTIFICATION_TYPES.SYSTEM
        });
    });
    
    autoUpdater.on('update-not-available', () => {
        console.log('✅ No updates available');
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'up-to-date' });
        }
    });
    
    autoUpdater.on('download-progress', (progressObj) => {
        console.log(`⬇️ Downloading update: ${Math.round(progressObj.percent)}%`);
        
        if (mainWindow) {
            mainWindow.webContents.send('download-progress', {
                percent: progressObj.percent,
                bytesPerSecond: progressObj.bytesPerSecond,
                transferred: progressObj.transferred,
                total: progressObj.total
            });
        }
    });
    
    autoUpdater.on('update-downloaded', (info) => {
        console.log('✅ Update downloaded:', info.version);
        
        if (mainWindow) {
            mainWindow.webContents.send('update-downloaded', {
                version: info.version,
                releaseDate: info.releaseDate
            });
        }
        
        // Спрашиваем пользователя о перезапуске
        const { dialog } = require('electron');
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Обновление готово',
            message: `Обновление до версии ${info.version} загружено. Перезапустить приложение сейчас?`,
            buttons: ['Перезапустить', 'Позже'],
            defaultId: 0,
            cancelId: 1
        }).then(({ response }) => {
            if (response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });
    
    autoUpdater.on('error', (error) => {
        console.error('❌ Update error:', error);
        
        if (mainWindow) {
            mainWindow.webContents.send('update-error', {
                error: error.message
            });
        }
    });
}

// Глобальные горячие клавиши
function registerGlobalShortcuts() {
    const { globalShortcut } = require('electron');
    
    try {
        // Быстрый доступ к приложению
        globalShortcut.register('CommandOrControl+Shift+M', () => {
            showMainWindow();
        });
        
        // Скриншот (только для окна приложения)
        globalShortcut.register('CommandOrControl+Shift+S', () => {
            if (mainWindow) {
                mainWindow.webContents.send('take-screenshot');
            }
        });
        
        // Быстрый поиск
        globalShortcut.register('CommandOrControl+K', () => {
            if (mainWindow) {
                mainWindow.webContents.send('quick-search');
            }
        });
        
        // Новая группа
        globalShortcut.register('CommandOrControl+Shift+N', () => {
            if (mainWindow) {
                mainWindow.webContents.send('new-group');
            }
        });
        
        console.log('✅ Global shortcuts registered');
    } catch (error) {
        console.error('❌ Error registering shortcuts:', error);
    }
}

// Убрать глобальные горячие клавиши
function unregisterGlobalShortcuts() {
    const { globalShortcut } = require('electron');
    globalShortcut.unregisterAll();
}

// Основной запуск приложения
app.whenReady().then(async () => {
    console.log('🚀 Starting My Messenger Desktop...');
    
    // Создаем окно
    createWindow();
    
    // Создаем иконку в трее
    createTray();
    
    // Настраиваем IPC
    setupIPC();
    
    // Настраиваем автообновление
    setupAutoUpdater();
    
    // Регистрируем глобальные горячие клавиши
    registerGlobalShortcuts();
    
    // Инициализируем MEGA хранилище (в фоне)
    if (MEGA_CONFIG.email && MEGA_CONFIG.password) {
        setTimeout(() => {
            initMEGAStorage().then(success => {
                if (success && mainWindow) {
                    mainWindow.webContents.send('mega-connected', { connected: true });
                }
            });
        }, 5000);
    }
    
    // Сохраняем состояние окна при изменении размера
    mainWindow.on('resize', saveWindowState);
    mainWindow.on('move', saveWindowState);
    mainWindow.on('maximize', saveWindowState);
    mainWindow.on('unmaximize', saveWindowState);
    
    // Обработка для macOS
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else {
            showMainWindow();
        }
    });
    
    // Принудительно выйти если все окна закрыты (кроме macOS)
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
});

// Очистка перед выходом
app.on('before-quit', () => {
    isQuitting = true;
    unregisterGlobalShortcuts();
    saveWindowState();
    
    // Сохраняем текущее состояние приложения
    if (mainWindow) {
        mainWindow.webContents.send('save-state');
    }
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    
    // Показываем пользователю сообщение об ошибке
    if (mainWindow) {
        const { dialog } = require('electron');
        dialog.showErrorBox(
            'Произошла ошибка',
            `Произошла непредвиденная ошибка:\n${error.message}\n\nПриложение будет перезапущено.`
        );
    }
    
    // Перезапускаем приложение
    app.relaunch();
    app.exit(1);
});

// Экспорт для тестирования
module.exports = { createWindow, showMainWindow, backupToMEGA };