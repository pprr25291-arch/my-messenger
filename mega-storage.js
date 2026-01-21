// mega-storage.js - Модуль для синхронизации данных с MEGA.nz с заменой файлов
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class MegaStorage {
    constructor(email, password) {
        this.email = email;
        this.password = password;
        this.mega = null;
        this.storage = null;
        this.isInitialized = false;
        this.syncInterval = null;
        this.syncInProgress = false;
        this.lastSyncTime = null;
        this.fileHashes = new Map();
        this.fileLock = new Map(); // Блокировка файлов для предотвращения конфликтов
    }

    // Инициализация MEGA хранилища
    async initialize() {
        try {
            console.log('☁️ Initializing MEGA storage...');
            
            // Динамически импортируем библиотеку
            const mega = require('megajs');
            
            // Создаем хранилище с указанными учетными данными
            this.storage = new mega.Storage({
                email: this.email,
                password: this.password,
                autologin: true
            });
            
            // Ожидаем авторизации
            await new Promise((resolve, reject) => {
                this.storage.on('ready', () => {
                    console.log('✅ MEGA storage connected successfully');
                    this.isInitialized = true;
                    resolve();
                });
                
                this.storage.on('error', (error) => {
                    console.error('❌ MEGA storage error:', error.message);
                    reject(error);
                });
                
                this.storage.on('auth', () => {
                    console.log('🔐 MEGA authentication successful');
                });
            });
            
            // Получаем корневой каталог
            const root = this.storage.root;
            this.mega = root;
            
            // Загружаем информацию о существующих файлах
            await this.loadFileHashes();
            
            console.log('📁 MEGA root directory ready');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize MEGA storage:', error.message);
            this.isInitialized = false;
            return false;
        }
    }
async loadFileHashes() {
    if (!this.isInitialized) return;
    
    try {
        // Получаем дочерние элементы из корня
        const files = this.mega.children;
        
        for (const file of files) {
            if (!file.directory && file.name.endsWith('.json')) {
                const fileHash = await this.calculateRemoteFileHash(file);
                this.fileHashes.set(file.name, {
                    hash: fileHash,
                    remoteFile: file,
                    size: file.size,
                    modified: new Date(file.timestamp)
                });
            }
        }
        console.log(`📊 Loaded ${this.fileHashes.size} file hashes from MEGA`);
    } catch (error) {
        console.error('❌ Error loading file hashes:', error.message);
    }
}

    // Вычисление хеша локального файла
    async calculateFileHash(filePath) {
        try {
            const content = await fs.readFile(filePath);
            return crypto.createHash('md5').update(content).digest('hex');
        } catch (error) {
            console.error(`❌ Error calculating hash for ${filePath}:`, error.message);
            return null;
        }
    }

    // Вычисление хеша удаленного файла на MEGA
    async calculateRemoteFileHash(fileNode) {
        return new Promise((resolve) => {
            fileNode.download((error, data) => {
                if (error) {
                    console.error(`❌ Error downloading for hash calculation:`, error.message);
                    resolve(null);
                } else {
                    const hash = crypto.createHash('md5').update(data).digest('hex');
                    resolve(hash);
                }
            });
        });
    }

    // Вычисление хеша контента
    calculateContentHash(content) {
        return crypto.createHash('md5').update(content).digest('hex');
    }

async uploadFile(localPath, remoteFilename = null) {
    if (!this.isInitialized) {
        console.warn('⚠️ MEGA not initialized, skipping upload');
        return false;
    }

    const filename = remoteFilename || path.basename(localPath);
    
    // Проверяем блокировку
    if (this.fileLock.has(filename)) {
        console.log(`⏳ File ${filename} is locked, skipping upload`);
        return false;
    }

    try {
        // Устанавливаем блокировку
        this.fileLock.set(filename, true);
        
        const localHash = await this.calculateFileHash(localPath);
        
        if (!localHash) {
            console.warn(`⚠️ Cannot calculate hash for ${localPath}, skipping`);
            return false;
        }
        
        // Проверяем, есть ли уже такой файл на MEGA
        const existingFileInfo = this.fileHashes.get(filename);
        
        if (existingFileInfo) {
            // Если хеш совпадает, файл не изменился
            if (existingFileInfo.hash === localHash) {
                console.log(`⏭️ File ${filename} unchanged, skipping upload`);
                return {
                    uploaded: false,
                    message: 'File unchanged',
                    filename: filename
                };
            }
            
            // Файл изменился - обновляем
            console.log(`🔄 File ${filename} changed, updating...`);
            
            // Сначала удаляем старый файл
            await this.deleteFile(filename);
            
            // Удаляем из кэша
            this.fileHashes.delete(filename);
        }
        
        console.log(`📤 Uploading ${filename} to MEGA...`);
        
        // Читаем файл
        const fileBuffer = await fs.readFile(localPath);
        
        // Загружаем на MEGA (используем async/await с промисом)
        const uploadResult = await new Promise((resolve, reject) => {
            // Используем метод upload из Storage
            this.storage.upload(filename, fileBuffer, (error, file) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(file);
                }
            });
        });
        
        // Обновляем хеш в кэше
        this.fileHashes.set(filename, {
            hash: localHash,
            remoteFile: uploadResult,
            size: fileBuffer.length,
            modified: new Date()
        });
        
        console.log(`✅ ${existingFileInfo ? 'Updated' : 'Uploaded'} to MEGA: ${filename}`);
        
        return {
            uploaded: true,
            updated: !!existingFileInfo,
            filename: filename,
            file: uploadResult,
            size: fileBuffer.length
        };
        
    } catch (error) {
        console.error(`❌ Error uploading ${localPath} to MEGA:`, error.message);
        return false;
    } finally {
        // Снимаем блокировку
        this.fileLock.delete(filename);
    }
}


    // Загрузка файла с MEGA
    async downloadFile(remoteFilename, localPath) {
        if (!this.isInitialized) {
            console.warn('⚠️ MEGA not initialized, skipping download');
            return false;
        }

        // Проверяем блокировку
        if (this.fileLock.has(remoteFilename)) {
            console.log(`⏳ File ${remoteFilename} is locked, skipping download`);
            return false;
        }

        try {
            // Устанавливаем блокировку
            this.fileLock.set(remoteFilename, true);
            
            console.log(`📥 Downloading ${remoteFilename} from MEGA...`);
            
            // Находим файл на MEGA
            const file = await this.findFile(remoteFilename);
            if (!file) {
                console.log(`⚠️ File ${remoteFilename} not found on MEGA`);
                return false;
            }
            
            // Скачиваем файл
            const downloadResult = await new Promise((resolve, reject) => {
                file.download((error, data) => {
                    if (error) {
                        reject(error);
                    } else {
                        // Сохраняем локально
                        fs.writeFile(localPath, data)
                            .then(() => resolve(true))
                            .catch(reject);
                    }
                });
            });
            
            if (downloadResult) {
                // Обновляем локальный хеш
                const localHash = await this.calculateFileHash(localPath);
                this.fileHashes.set(remoteFilename, {
                    hash: localHash,
                    remoteFile: file,
                    size: (await fs.stat(localPath)).size,
                    modified: new Date()
                });
                
                console.log(`✅ Downloaded from MEGA: ${remoteFilename}`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error(`❌ Error downloading ${remoteFilename} from MEGA:`, error.message);
            return false;
        } finally {
            // Снимаем блокировку
            this.fileLock.delete(remoteFilename);
        }
    }
async findFile(filename) {
    if (!this.isInitialized) return null;
    
    try {
        // Ищем файл среди дочерних элементов
        const children = this.mega.children || [];
        const file = children.find(child => 
            !child.directory && child.name === filename
        );
        
        return file || null;
    } catch (error) {
        console.error(`❌ Error finding ${filename}:`, error.message);
        return null;
    }
}
async listFiles() {
    if (!this.isInitialized) return [];
    
    try {
        // Получаем дочерние элементы из корня
        const children = this.mega.children || [];
        
        return children.map(child => ({
            name: child.name,
            size: child.size,
            type: child.directory ? 'directory' : 'file',
            modified: new Date(child.timestamp),
            node: child
        }));
    } catch (error) {
        console.error('❌ Error listing files:', error.message);
        return [];
    }
}
  async deleteFile(filename) {
    if (!this.isInitialized) return false;
    
    // Проверяем блокировку
    if (this.fileLock.has(filename)) {
        console.log(`⏳ File ${filename} is locked, skipping delete`);
        return false;
    }

    try {
        // Устанавливаем блокировку
        this.fileLock.set(filename, true);
        
        const file = await this.findFile(filename);
        if (!file) return false;
        
        return new Promise((resolve) => {
            file.delete((error) => {
                if (error) {
                    console.error(`❌ Error deleting ${filename}:`, error.message);
                    resolve(false);
                } else {
                    // Удаляем из кэша хешей
                    this.fileHashes.delete(filename);
                    console.log(`🗑️ Deleted from MEGA: ${filename}`);
                    resolve(true);
                }
            });
        });
        
    } catch (error) {
        console.error(`❌ Error in deleteFile for ${filename}:`, error.message);
        return false;
    } finally {
        // Снимаем блокировку
        this.fileLock.delete(filename);
    }
}
    // Синхронизация всех данных на MEGA с умным обновлением
    async syncToMega(dataDir) {
        if (!this.isInitialized) {
            console.warn('⚠️ MEGA not initialized, skipping sync to MEGA');
            return {
                success: false,
                error: 'MEGA not initialized',
                uploaded: 0,
                updated: 0,
                skipped: 0,
                failed: 0
            };
        }

        if (this.syncInProgress) {
            console.log('⚠️ Sync already in progress, skipping');
            return {
                success: false,
                error: 'Sync already in progress',
                uploaded: 0,
                updated: 0,
                skipped: 0,
                failed: 0
            };
        }

        this.syncInProgress = true;
        
        try {
            console.log('🔄 Syncing data to MEGA...');
            
            // Получаем список файлов в data директории
            const files = await fs.readdir(dataDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            let uploadedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;
            let failedCount = 0;
            
            // Загружаем каждый файл
            for (const file of jsonFiles) {
                const localPath = path.join(dataDir, file);
                
                try {
                    // Проверяем размер файла
                    const stats = await fs.stat(localPath);
                    if (stats.size === 0) {
                        console.log(`⚠️ Skipping empty file: ${file}`);
                        failedCount++;
                        continue;
                    }
                    
                    // Проверяем, является ли файл валидным JSON
                    const content = await fs.readFile(localPath, 'utf8');
                    try {
                        JSON.parse(content);
                    } catch (e) {
                        console.error(`❌ Invalid JSON in ${file}:`, e.message);
                        failedCount++;
                        continue;
                    }
                    
                    // Загружаем на MEGA с проверкой изменений
                    const result = await this.uploadFile(localPath, file);
                    
                    if (result) {
                        if (result.uploaded) {
                            if (result.updated) {
                                updatedCount++;
                            } else {
                                uploadedCount++;
                            }
                        } else {
                            skippedCount++;
                        }
                    } else {
                        failedCount++;
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing ${file}:`, error.message);
                    failedCount++;
                }
            }
            
            this.lastSyncTime = new Date();
            console.log(`✅ Sync to MEGA complete:`);
            console.log(`   📤 Uploaded: ${uploadedCount} files`);
            console.log(`   🔄 Updated: ${updatedCount} files`);
            console.log(`   ⏭️ Skipped (unchanged): ${skippedCount} files`);
            console.log(`   ❌ Failed: ${failedCount} files`);
            
            return {
                success: true,
                uploaded: uploadedCount,
                updated: updatedCount,
                skipped: skippedCount,
                failed: failedCount
            };
            
        } catch (error) {
            console.error('❌ Error in syncToMega:', error.message);
            return {
                success: false,
                error: error.message,
                uploaded: 0,
                updated: 0,
                skipped: 0,
                failed: 0
            };
        } finally {
            this.syncInProgress = false;
        }
    }

    // Синхронизация с MEGA (загрузка данных с MEGA) с проверкой изменений
    async syncFromMega(dataDir) {
        if (!this.isInitialized) {
            console.warn('⚠️ MEGA not initialized, skipping sync from MEGA');
            return {
                success: false,
                error: 'MEGA not initialized',
                downloaded: 0,
                updated: 0,
                skipped: 0,
                failed: 0
            };
        }

        if (this.syncInProgress) {
            console.log('⚠️ Sync already in progress, skipping');
            return {
                success: false,
                error: 'Sync already in progress',
                downloaded: 0,
                updated: 0,
                skipped: 0,
                failed: 0
            };
        }

        this.syncInProgress = true;
        
        try {
            console.log('🔄 Syncing data from MEGA...');
            
            // Получаем список файлов на MEGA
            const remoteFiles = await this.listFiles();
            const jsonFiles = remoteFiles.filter(file => 
                file.type === 'file' && file.name.endsWith('.json')
            );
            
            let downloadedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;
            let failedCount = 0;
            
            // Скачиваем каждый файл
            for (const file of jsonFiles) {
                const remoteFilename = file.name;
                const localPath = path.join(dataDir, remoteFilename);
                
                try {
                    // Проверяем, существует ли локальный файл
                    let shouldDownload = true;
                    let updateReason = 'new file';
                    
                    try {
                        await fs.access(localPath);
                        // Файл существует, проверяем изменения
                        const localHash = await this.calculateFileHash(localPath);
                        const remoteHashInfo = this.fileHashes.get(remoteFilename);
                        
                        if (remoteHashInfo && localHash === remoteHashInfo.hash) {
                            shouldDownload = false;
                            updateReason = 'unchanged';
                        } else {
                            updateReason = 'changed';
                        }
                    } catch (error) {
                        // Локальный файл не существует
                        updateReason = 'new file';
                    }
                    
                    if (shouldDownload) {
                        // Скачиваем файл
                        const result = await this.downloadFile(remoteFilename, localPath);
                        if (result) {
                            downloadedCount++;
                            console.log(`✅ ${updateReason === 'changed' ? 'Updated' : 'Downloaded'} from MEGA: ${remoteFilename}`);
                            
                            if (updateReason === 'changed') {
                                updatedCount++;
                            }
                        } else {
                            failedCount++;
                        }
                    } else {
                        skippedCount++;
                        console.log(`⏭️ Skipping unchanged file: ${remoteFilename}`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Error downloading ${remoteFilename}:`, error.message);
                    failedCount++;
                }
            }
            
            console.log(`✅ Sync from MEGA complete:`);
            console.log(`   📥 Downloaded: ${downloadedCount - updatedCount} files`);
            console.log(`   🔄 Updated: ${updatedCount} files`);
            console.log(`   ⏭️ Skipped (unchanged): ${skippedCount} files`);
            console.log(`   ❌ Failed: ${failedCount} files`);
            
            return {
                success: true,
                downloaded: downloadedCount - updatedCount,
                updated: updatedCount,
                skipped: skippedCount,
                failed: failedCount
            };
            
        } catch (error) {
            console.error('❌ Error in syncFromMega:', error.message);
            return {
                success: false,
                error: error.message,
                downloaded: 0,
                updated: 0,
                skipped: 0,
                failed: 0
            };
        } finally {
            this.syncInProgress = false;
        }
    }

    // Запуск автоматической синхронизации с улучшенной логикой
    async startAutoSync(dataDir, intervalMinutes = 5) {
        if (!this.isInitialized) {
            console.warn('⚠️ MEGA not initialized, skipping auto sync');
            return null;
        }
        
        console.log(`🔄 Starting auto sync every ${intervalMinutes} minutes`);
        
        // Выполняем начальную синхронизацию
        await this.syncFromMega(dataDir);
        
        // Настраиваем интервал синхронизации
        this.syncInterval = setInterval(async () => {
            try {
                if (this.syncInProgress) {
                    console.log('⚠️ Sync already in progress, skipping');
                    return;
                }
                
                console.log(`\n⏰ Starting scheduled sync to MEGA...`);
                const result = await this.syncToMega(dataDir);
                
                if (result.success) {
                    console.log(`✅ Scheduled sync completed at ${new Date().toLocaleTimeString()}`);
                    
                    // Сохраняем информацию о последней синхронизации
                    this.lastSyncTime = new Date();
                } else {
                    console.error(`❌ Scheduled sync failed: ${result.error}`);
                }
            } catch (error) {
                console.error('❌ Error in auto sync:', error.message);
            }
        }, intervalMinutes * 60 * 1000);
        
        return this.syncInterval;
    }

    // Остановка автоматической синхронизации
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('🛑 Auto sync stopped');
        }
    }

    // Получение информации о хранилище
    async getStorageInfo() {
        if (!this.isInitialized) {
            return {
                status: 'not_initialized',
                message: 'MEGA storage not initialized'
            };
        }
        
        try {
            const accountInfo = this.storage.account;
            const files = await this.listFiles();
            
            return {
                status: 'connected',
                email: this.email,
                filesCount: files.length,
                trackedFiles: this.fileHashes.size,
                lastSync: this.lastSyncTime,
                syncInProgress: this.syncInProgress,
                accountInfo: {
                    spaceUsed: accountInfo.spaceUsed,
                    spaceTotal: accountInfo.spaceTotal,
                    spaceFree: accountInfo.spaceTotal - accountInfo.spaceUsed
                }
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: error.message
            };
        }
    }

    // Резервное копирование всей data директории с версионированием
    async backupData(dataDir, backupName = null) {
        if (!this.isInitialized) {
            console.warn('⚠️ MEGA not initialized, skipping backup');
            return false;
        }
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
        const backupFilename = backupName || `backup-${timestamp}.zip`;
        
        try {
            console.log(`💾 Creating backup: ${backupFilename}`);
            
            // Создаем архив с использованием внешней утилиты
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);
            
            const backupPath = path.join(__dirname, backupFilename);
            
            try {
                // Создаем zip архив
                await execPromise(`zip -r "${backupPath}" "${dataDir}"`);
                
                // Загружаем архив на MEGA
                const result = await this.uploadFile(backupPath, backupFilename);
                
                // Удаляем локальный архив
                await fs.unlink(backupPath);
                
                if (result) {
                    console.log(`✅ Backup created and uploaded: ${backupFilename}`);
                    
                    // Очищаем старые бэкапы (оставляем только последние 10)
                    await this.cleanupOldBackups();
                    
                    return true;
                } else {
                    console.error('❌ Failed to upload backup');
                    return false;
                }
            } catch (zipError) {
                console.error('❌ Error creating zip:', zipError.message);
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error creating backup:', error.message);
            return false;
        }
    }

    // Очистка старых бэкапов
    async cleanupOldBackups(keepCount = 10) {
        if (!this.isInitialized) return false;
        
        try {
            const files = await this.listFiles();
            const backupFiles = files
                .filter(file => file.name.startsWith('backup-') && file.name.endsWith('.zip'))
                .sort((a, b) => new Date(b.modified) - new Date(a.modified));
            
            // Удаляем старые бэкапы
            let deletedCount = 0;
            for (let i = keepCount; i < backupFiles.length; i++) {
                await this.deleteFile(backupFiles[i].name);
                deletedCount++;
                console.log(`🗑️ Deleted old backup: ${backupFiles[i].name}`);
            }
            
            if (deletedCount > 0) {
                console.log(`✅ Cleaned up ${deletedCount} old backups`);
            }
            
            return deletedCount;
            
        } catch (error) {
            console.error('❌ Error cleaning up old backups:', error.message);
            return 0;
        }
    }

    // Восстановление данных из бэкапа
    async restoreFromBackup(backupFilename, restoreDir) {
        if (!this.isInitialized) {
            console.warn('⚠️ MEGA not initialized, skipping restore');
            return false;
        }
        
        try {
            console.log(`🔄 Restoring from backup: ${backupFilename}`);
            
            // Скачиваем бэкап с MEGA
            const tempPath = path.join(__dirname, 'temp-backup.zip');
            await this.downloadFile(backupFilename, tempPath);
            
            // Распаковываем архив
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);
            
            // Создаем временную директорию для восстановления
            const tempRestoreDir = path.join(__dirname, 'temp-restore');
            await fs.mkdir(tempRestoreDir, { recursive: true });
            
            // Распаковываем архив во временную директорию
            await execPromise(`unzip -o "${tempPath}" -d "${tempRestoreDir}"`);
            
            // Копируем файлы в целевую директорию
            const files = await fs.readdir(tempRestoreDir);
            for (const file of files) {
                const sourcePath = path.join(tempRestoreDir, file);
                const destPath = path.join(restoreDir, file);
                await fs.copyFile(sourcePath, destPath);
            }
            
            // Удаляем временные файлы
            await fs.unlink(tempPath);
            await fs.rm(tempRestoreDir, { recursive: true, force: true });
            
            console.log(`✅ Restored from backup: ${backupFilename}`);
            return true;
            
        } catch (error) {
            console.error('❌ Error restoring from backup:', error.message);
            return false;
        }
    }

    // Закрытие соединения
    async close() {
        if (this.syncInterval) {
            this.stopAutoSync();
        }
        
        if (this.storage) {
            try {
                this.storage.close();
                console.log('🔒 MEGA storage closed');
            } catch (error) {
                console.error('❌ Error closing MEGA storage:', error.message);
            }
        }
        
        this.isInitialized = false;
        this.fileHashes.clear();
        this.fileLock.clear();
    }
}

module.exports = MegaStorage;