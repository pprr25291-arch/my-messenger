// telegram-storage.js - Модуль для хранения медиафайлов в Telegram
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

class TelegramStorage {
    constructor(botToken, chatId) {
        this.botToken = botToken || '8501177708:AAETyTKHluPQOCeYBdvKvJ-YVr7cDwPQC6g';
        this.chatId = chatId || '5324471398';
        this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
        this.mediaMap = new Map(); // Соответствие localPath -> telegram file_id
        this.isInitialized = false;
        this.maxFileSize = 50 * 1024 * 1024; // 50MB
    }

    // Инициализация
    async initialize() {
        try {
            console.log('📱 Initializing Telegram storage...');
            
            // Проверяем доступность бота
            const response = await axios.get(`${this.baseUrl}/getMe`);
            
            if (response.data.ok) {
                this.isInitialized = true;
                console.log('✅ Telegram bot connected:', response.data.result.username);
                console.log(`📁 Chat ID: ${this.chatId}`);
                
                // Загружаем кэш медиафайлов
                await this.loadMediaMap();
                return true;
            } else {
                throw new Error('Bot not available');
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize Telegram storage:', error.message);
            this.isInitialized = false;
            return false;
        }
    }

    // Загрузка медиафайла в Telegram
    async uploadFile(localPath, customCaption = '') {
        if (!this.isInitialized) {
            console.warn('⚠️ Telegram storage not initialized');
            return null;
        }

        try {
            // Проверяем размер файла
            const stats = await fs.stat(localPath);
            if (stats.size > this.maxFileSize) {
                throw new Error(`File too large: ${stats.size} bytes (max ${this.maxFileSize} bytes)`);
            }

            const filename = path.basename(localPath);
            const ext = path.extname(filename).toLowerCase();
            const mimeType = this.getMimeType(ext);
            
            console.log(`📤 Uploading to Telegram: ${filename} (${this.formatFileSize(stats.size)})`);

            // Создаем FormData
            const formData = new FormData();
            formData.append('chat_id', this.chatId);
            formData.append('disable_notification', 'true');
            
            // Добавляем файл
            const fileStream = await fs.readFile(localPath);
            formData.append('document', fileStream, {
                filename: filename,
                contentType: mimeType
            });

            // Добавляем caption если есть
            if (customCaption) {
                formData.append('caption', customCaption);
            }

            // Отправляем файл
            const response = await axios.post(`${this.baseUrl}/sendDocument`, formData, {
                headers: formData.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (response.data.ok) {
                const fileId = response.data.result.document.file_id;
                
                // Сохраняем в кэш
                await this.saveToMediaMap(localPath, {
                    file_id: fileId,
                    message_id: response.data.result.message_id,
                    date: response.data.result.date,
                    size: stats.size,
                    filename: filename,
                    mime_type: mimeType
                });
                
                console.log(`✅ Uploaded to Telegram: ${filename} (ID: ${fileId})`);
                
                return {
                    success: true,
                    file_id: fileId,
                    message_id: response.data.result.message_id,
                    filename: filename,
                    size: stats.size,
                    mime_type: mimeType,
                    telegram_url: this.getTelegramFileUrl(fileId)
                };
            } else {
                throw new Error(response.data.description || 'Upload failed');
            }

        } catch (error) {
            console.error(`❌ Error uploading ${localPath} to Telegram:`, error.message);
            
            // Пробуем альтернативный метод для фото/видео
            try {
                return await this.uploadMediaAlternative(localPath, customCaption);
            } catch (altError) {
                console.error('❌ Alternative upload also failed:', altError.message);
                return null;
            }
        }
    }

    // Альтернативный метод загрузки для фото/видео
    async uploadMediaAlternative(localPath, caption = '') {
        const filename = path.basename(localPath);
        const ext = path.extname(filename).toLowerCase();
        const mimeType = this.getMimeType(ext);
        
        let method = 'sendDocument';
        let fieldName = 'document';
        
        // Определяем тип медиа
        if (mimeType.startsWith('image/')) {
            method = 'sendPhoto';
            fieldName = 'photo';
        } else if (mimeType.startsWith('video/')) {
            method = 'sendVideo';
            fieldName = 'video';
        } else if (mimeType.startsWith('audio/')) {
            method = 'sendAudio';
            fieldName = 'audio';
        }

        console.log(`📤 Uploading as ${method}: ${filename}`);

        const formData = new FormData();
        formData.append('chat_id', this.chatId);
        formData.append('disable_notification', 'true');
        
        const fileStream = await fs.readFile(localPath);
        formData.append(fieldName, fileStream, {
            filename: filename,
            contentType: mimeType
        });

        if (caption) {
            formData.append('caption', caption);
        }

        const response = await axios.post(`${this.baseUrl}/${method}`, formData, {
            headers: formData.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        if (response.data.ok) {
            let fileId;
            let mediaType;
            
            // Получаем file_id в зависимости от типа медиа
            if (method === 'sendPhoto') {
                fileId = response.data.result.photo[response.data.result.photo.length - 1].file_id;
                mediaType = 'photo';
            } else if (method === 'sendVideo') {
                fileId = response.data.result.video.file_id;
                mediaType = 'video';
            } else if (method === 'sendAudio') {
                fileId = response.data.result.audio.file_id;
                mediaType = 'audio';
            } else {
                fileId = response.data.result.document.file_id;
                mediaType = 'document';
            }

            await this.saveToMediaMap(localPath, {
                file_id: fileId,
                message_id: response.data.result.message_id,
                date: response.data.result.date,
                media_type: mediaType,
                filename: filename,
                mime_type: mimeType
            });

            console.log(`✅ Uploaded as ${mediaType}: ${filename}`);
            
            return {
                success: true,
                file_id: fileId,
                message_id: response.data.result.message_id,
                media_type: mediaType,
                filename: filename,
                mime_type: mimeType,
                telegram_url: this.getTelegramFileUrl(fileId)
            };
        }

        throw new Error('Upload failed');
    }

    // Получение ссылки на файл
    async getFileUrl(fileId) {
        try {
            const response = await axios.get(`${this.baseUrl}/getFile?file_id=${fileId}`);
            
            if (response.data.ok) {
                const filePath = response.data.result.file_path;
                return `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
            }
        } catch (error) {
            console.error('❌ Error getting file URL:', error.message);
        }
        
        return null;
    }

    // Скачивание файла из Telegram
    async downloadFile(fileId, localPath) {
        try {
            console.log(`📥 Downloading from Telegram: ${fileId}`);
            
            // Получаем информацию о файле
            const fileInfo = await axios.get(`${this.baseUrl}/getFile?file_id=${fileId}`);
            
            if (fileInfo.data.ok) {
                const filePath = fileInfo.data.result.file_path;
                const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
                
                // Скачиваем файл
                const response = await axios({
                    method: 'GET',
                    url: fileUrl,
                    responseType: 'stream'
                });
                
                const writer = fs.createWriteStream(localPath);
                response.data.pipe(writer);
                
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                
                console.log(`✅ Downloaded from Telegram: ${localPath}`);
                return true;
            }
            
        } catch (error) {
            console.error(`❌ Error downloading file ${fileId}:`, error.message);
        }
        
        return false;
    }

    // Удаление сообщения с файлом
    async deleteFile(fileId) {
        try {
            // Нужно знать message_id для удаления
            const mediaEntry = this.findMediaEntryByFileId(fileId);
            if (!mediaEntry) {
                console.warn(`⚠️ Message ID not found for file_id: ${fileId}`);
                return false;
            }
            
            const response = await axios.post(`${this.baseUrl}/deleteMessage`, {
                chat_id: this.chatId,
                message_id: mediaEntry.message_id
            });
            
            if (response.data.ok) {
                console.log(`🗑️ Deleted from Telegram: ${fileId}`);
                
                // Удаляем из кэша
                await this.removeFromMediaMap(fileId);
                return true;
            }
            
        } catch (error) {
            console.error(`❌ Error deleting file ${fileId}:`, error.message);
        }
        
        return false;
    }

    // Получение информации о файле
    async getFileInfo(fileId) {
        try {
            const response = await axios.get(`${this.baseUrl}/getFile?file_id=${fileId}`);
            
            if (response.data.ok) {
                return response.data.result;
            }
        } catch (error) {
            console.error('❌ Error getting file info:', error.message);
        }
        
        return null;
    }

    // Сохранение в кэш
    async saveToMediaMap(localPath, telegramData) {
        this.mediaMap.set(localPath, telegramData);
        await this.saveMediaMap();
        return telegramData;
    }

    // Удаление из кэша
    async removeFromMediaMap(fileId) {
        for (const [localPath, data] of this.mediaMap.entries()) {
            if (data.file_id === fileId) {
                this.mediaMap.delete(localPath);
                await this.saveMediaMap();
                return true;
            }
        }
        return false;
    }

    // Поиск по file_id
    findMediaEntryByFileId(fileId) {
        for (const data of this.mediaMap.values()) {
            if (data.file_id === fileId) {
                return data;
            }
        }
        return null;
    }

    // Поиск по localPath
    findMediaEntryByLocalPath(localPath) {
        return this.mediaMap.get(localPath) || null;
    }

    // Сохранение кэша на диск
    async saveMediaMap() {
        try {
            const mapArray = Array.from(this.mediaMap.entries());
            await fs.writeFile(
                path.join(__dirname, 'telegram-media-cache.json'),
                JSON.stringify(mapArray, null, 2)
            );
        } catch (error) {
            console.error('❌ Error saving media cache:', error.message);
        }
    }

    // Загрузка кэша с диска
    async loadMediaMap() {
        try {
            const cachePath = path.join(__dirname, 'telegram-media-cache.json');
            const data = await fs.readFile(cachePath, 'utf8');
            const mapArray = JSON.parse(data);
            this.mediaMap = new Map(mapArray);
            console.log(`📖 Loaded media cache: ${this.mediaMap.size} entries`);
        } catch (error) {
            console.log('⚠️ No media cache found, starting fresh');
            this.mediaMap = new Map();
        }
    }

    // Получение MIME типа по расширению
    getMimeType(ext) {
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.mkv': 'video/x-matroska',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip',
            '.txt': 'text/plain',
            '.json': 'application/json'
        };
        
        return mimeTypes[ext] || 'application/octet-stream';
    }

    // Форматирование размера файла
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Получение URL для скачивания файла из Telegram
    getTelegramFileUrl(fileId) {
        return `${this.baseUrl}/getFile?file_id=${fileId}`;
    }

    // Получение прямого URL к файлу
    async getDirectFileUrl(fileId) {
        const info = await this.getFileInfo(fileId);
        if (info && info.file_path) {
            return `https://api.telegram.org/file/bot${this.botToken}/${info.file_path}`;
        }
        return null;
    }

    // Получение информации о хранилище
    async getStorageInfo() {
        if (!this.isInitialized) {
            return {
                status: 'not_initialized',
                message: 'Telegram storage not initialized'
            };
        }
        
        try {
            // Получаем информацию о чате
            const chatResponse = await axios.get(`${this.baseUrl}/getChat?chat_id=${this.chatId}`);
            
            return {
                status: 'connected',
                bot_username: chatResponse.data.result.username || 'N/A',
                chat_title: chatResponse.data.result.title || 'Private Chat',
                chat_type: chatResponse.data.result.type,
                media_count: this.mediaMap.size,
                last_sync: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: error.message
            };
        }
    }

    // Очистка старых файлов
    async cleanupOldFiles(daysOld = 30) {
        if (!this.isInitialized) return { deleted: 0, error: 'Storage not initialized' };
        
        try {
            const cutoffTime = Date.now() / 1000 - (daysOld * 24 * 60 * 60);
            let deletedCount = 0;
            
            for (const [localPath, data] of this.mediaMap.entries()) {
                if (data.date < cutoffTime) {
                    await this.deleteFile(data.file_id);
                    deletedCount++;
                }
            }
            
            console.log(`🧹 Cleaned up ${deletedCount} old files (older than ${daysOld} days)`);
            return { deleted: deletedCount, success: true };
            
        } catch (error) {
            console.error('❌ Error cleaning up old files:', error.message);
            return { deleted: 0, error: error.message };
        }
    }

    // Закрытие соединения
    async close() {
        await this.saveMediaMap();
        console.log('🔒 Telegram storage closed');
    }
}

module.exports = TelegramStorage;