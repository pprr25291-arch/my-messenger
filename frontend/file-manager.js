class FileManager {
    constructor() {
        this.dbName = 'messenger_files';
        this.storeName = 'files';
        this.db = null;
        this.init();
    }

    async init() {
        try {
            this.db = await this.openDatabase();
            console.log('File manager initialized');
        } catch (error) {
            console.error('Failed to initialize file manager:', error);
        }
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('conversation', 'conversation', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    async saveFile(fileData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const fileRecord = {
                id: fileData.id || Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                filename: fileData.filename,
                originalName: fileData.originalName,
                type: fileData.type,
                size: fileData.size,
                data: fileData.data,
                conversation: fileData.conversation,
                sender: fileData.sender,
                timestamp: fileData.timestamp || Date.now(),
                thumbnail: fileData.thumbnail
            };

            const request = store.add(fileRecord);

            request.onsuccess = () => resolve(fileRecord);
            request.onerror = () => reject(request.error);
        });
    }

    async getFile(fileId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(fileId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getConversationFiles(conversationId, type = null) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('conversation');
            const request = index.getAll(conversationId);

            request.onsuccess = () => {
                let files = request.result;
                if (type) {
                    files = files.filter(file => file.type === type);
                }
                files.sort((a, b) => b.timestamp - a.timestamp);
                resolve(files);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFile(fileId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(fileId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async clearOldFiles(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 дней
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('timestamp');
            const cutoff = Date.now() - maxAge;

            const request = index.openCursor(IDBKeyRange.upperBound(cutoff));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve(true);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Сохранение файла из URL (для загруженных на сервер файлов)
    async saveFileFromUrl(url, fileData) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            
            const reader = new FileReader();
            return new Promise((resolve, reject) => {
                reader.onload = async () => {
                    fileData.data = reader.result;
                    const savedFile = await this.saveFile(fileData);
                    resolve(savedFile);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Error saving file from URL:', error);
            throw error;
        }
    }

    // Создание миниатюры для изображения
    async createImageThumbnail(file, maxWidth = 200, maxHeight = 200) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                resolve(null);
                return;
            }

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Calculate new dimensions
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };

            img.onerror = reject;
            
            if (file instanceof File) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            } else if (typeof file === 'string') {
                img.src = file;
            } else {
                reject(new Error('Invalid file type'));
            }
        });
    }

    // Получение размера файла в читаемом формате
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Проверка поддержки IndexedDB
    isSupported() {
        return 'indexedDB' in window;
    }

    // Резервное копирование в localStorage если IndexedDB не поддерживается
    async saveToLocalStorageFallback(fileData) {
        const key = `file_${fileData.id}`;
        try {
            localStorage.setItem(key, JSON.stringify(fileData));
            return fileData;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            throw error;
        }
    }

    async getFromLocalStorageFallback(fileId) {
        const key = `file_${fileId}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }
}

// Глобальный экземпляр менеджера файлов
window.fileManager = new FileManager();