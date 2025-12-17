class TimelineApp {
    constructor() {
        this.memories = [];
        this.currentSlideIndex = 0;
        this.currentMemory = null;
        this.videoPlayers = new Map();
        this.db = null;
        this.isMusicPlaying = false;
        this.musicSourceSet = false;
        this.init();
    }

    async init() {
        await this.initIndexedDB();
        await this.loadMemories();
        this.bindEvents();
        this.renderTimeline();
        this.setCurrentDate();
    }

    initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TimelineMemoriesDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                // 在数据库打开后迁移数据
                this.migrateFromLocalStorage();
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('memories')) {
                    const store = db.createObjectStore('memories', { keyPath: 'id' });
                    store.createIndex('date', 'date', { unique: false });
                }
            };
        });
    }

    async migrateFromLocalStorage() {
        const localStorageData = localStorage.getItem('timelineMemories');
        if (localStorageData && this.db) {
            try {
                const memories = JSON.parse(localStorageData);
                
                // 使用新的数据库连接进行迁移
                const transaction = this.db.transaction(['memories'], 'readwrite');
                const store = transaction.objectStore('memories');
                
                // 先检查是否已经有数据，避免重复迁移
                const countRequest = store.count();
                countRequest.onsuccess = () => {
                    if (countRequest.result === 0) {
                        // 只有数据库为空时才迁移
                        memories.forEach(memory => {
                            store.put(memory);
                        });
                        
                        transaction.oncomplete = () => {
                            // 迁移完成后清理localStorage
                            localStorage.removeItem('timelineMemories');
                            console.log(`成功迁移 ${memories.length} 个回忆到IndexedDB`);
                        };
                    } else {
                        console.log('IndexedDB中已有数据，跳过迁移');
                    }
                };
                
            } catch (error) {
                console.error('数据迁移失败:', error);
            }
        }
    }

    async loadMemories() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
            }
            
            const transaction = this.db.transaction(['memories'], 'readonly');
            const store = transaction.objectStore('memories');
            const request = store.getAll();
            
            request.onsuccess = () => {
                this.memories = request.result.sort((a, b) => new Date(a.date) - new Date(b.date));
                resolve(this.memories);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    

    bindEvents() {
        const addMemoryBtn = document.getElementById('addMemoryBtn');
        const shareBtn = document.getElementById('shareBtn');
        const cleanupBtn = document.getElementById('cleanupBtn');
        const closeModal = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelBtn');
        const memoryForm = document.getElementById('memoryForm');
        const fileUploadArea = document.getElementById('fileUploadArea');
        const memoryMedia = document.getElementById('memoryMedia');
        const closeMediaModal = document.getElementById('closeMediaModal');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const memoryDesc = document.getElementById('memoryDesc');

        addMemoryBtn.addEventListener('click', () => this.openModal());
        shareBtn.addEventListener('click', () => this.shareApp());
        closeModal.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        memoryForm.addEventListener('submit', (e) => this.saveMemory(e));
        closeMediaModal.addEventListener('click', () => this.closeMediaModal());
        prevBtn.addEventListener('click', () => this.prevSlide());
        nextBtn.addEventListener('click', () => this.nextSlide());

        fileUploadArea.addEventListener('click', () => memoryMedia.click());
        fileUploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        fileUploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        fileUploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        memoryMedia.addEventListener('change', (e) => this.handleFileSelect(e));
        memoryDesc.addEventListener('input', () => this.updateCharCount());

        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // 背景音乐控制
        const musicToggleBtn = document.getElementById('musicToggleBtn');
        const backgroundMusic = document.getElementById('backgroundMusic');
        
        musicToggleBtn.addEventListener('click', () => this.toggleMusic());
        
        // 设置音乐音量（避免太大声）
        backgroundMusic.volume = 0.3;
        
        // 设置自动播放本地音乐
        this.setupAutoPlay();
    }

    setCurrentDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('memoryDate').value = today;
    }

    updateCharCount() {
        const textarea = document.getElementById('memoryDesc');
        const charCount = document.querySelector('.char-count');
        const count = textarea.value.length;
        charCount.textContent = `${count}/100`;
        
        if (count > 100) {
            charCount.style.color = '#e74c3c';
        } else {
            charCount.style.color = '#a8a8a8';
        }
    }

    openModal(memoryId = null) {
        document.getElementById('modalOverlay').classList.add('active');
        
        if (memoryId) {
            // 编辑模式
            this.currentEditMemoryId = memoryId;
            document.querySelector('.modal-title').textContent = '编辑回忆';
            document.getElementById('saveMemoryBtn').textContent = '更新回忆';
            this.loadMemoryData(memoryId);
        } else {
            // 创建模式
            this.currentEditMemoryId = null;
            document.querySelector('.modal-title').textContent = '添加回忆';
            document.getElementById('saveMemoryBtn').textContent = '保存回忆';
            this.setCurrentDate();
            this.updateCharCount();
        }
    }

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
        this.resetForm();
    }

    resetForm() {
        document.getElementById('memoryForm').reset();
        document.getElementById('previewContainer').innerHTML = '';
        this.currentEditMemoryId = null;
        this.updateCharCount();
    }

    // 背景音乐控制方法
    toggleMusic() {
        const musicToggleBtn = document.getElementById('musicToggleBtn');
        const backgroundMusic = document.getElementById('backgroundMusic');
        
        if (this.isMusicPlaying) {
            this.pauseMusic();
        } else {
            this.playMusic();
        }
    }

    playMusic() {
        const musicToggleBtn = document.getElementById('musicToggleBtn');
        const backgroundMusic = document.getElementById('backgroundMusic');
        
        // 使用本地音乐文件，无需动态设置音乐源
        
        // 确保音频已加载
        if (backgroundMusic.readyState < 3) {
            backgroundMusic.load();
        }
        
        // 重置音频到开始位置
        backgroundMusic.currentTime = 0;
        
        backgroundMusic.play().then(() => {
            this.isMusicPlaying = true;
            musicToggleBtn.classList.add('playing');
            musicToggleBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
                </svg>
            `;
            console.log('背景音乐开始播放');
        }).catch(error => {
            console.error('音乐播放失败:', error);
            
            // 检查是否是因为自动播放策略限制
            if (error.name === 'NotAllowedError') {
                // 显示更友好的错误提示，并引导用户手动点击播放
                const userAction = confirm('背景音乐播放失败，浏览器阻止了自动播放。\n\n请点击页面任意位置后，再点击音乐按钮手动播放。\n\n是否现在重新尝试？');
                if (userAction) {
                    // 用户同意后，先等待用户交互，然后再次尝试播放
                    const handleUserInteraction = () => {
                        document.removeEventListener('click', handleUserInteraction);
                        setTimeout(() => this.playMusic(), 500);
                    };
                    document.addEventListener('click', handleUserInteraction, { once: true });
                }
            } else {
                // 其他错误，提供友好的提示
                console.error('音乐播放遇到其他错误:', error);
                alert('背景音乐播放失败，请检查音乐文件是否存在或刷新页面重试。');
            }
        });
    }

    pauseMusic() {
        const musicToggleBtn = document.getElementById('musicToggleBtn');
        const backgroundMusic = document.getElementById('backgroundMusic');
        
        backgroundMusic.pause();
        this.isMusicPlaying = false;
        musicToggleBtn.classList.remove('playing');
        console.log('背景音乐已暂停');
    }
    
    // 设置自动播放
    setupAutoPlay() {
        const backgroundMusic = document.getElementById('backgroundMusic');
        
        // 等待页面加载完成后尝试自动播放
        window.addEventListener('load', () => {
            setTimeout(() => {
                console.log('尝试自动播放背景音乐...');
                this.playMusic().catch(error => {
                    console.log('自动播放失败，等待用户交互');
                    // 自动播放失败时，设置用户交互后自动播放
                    const handleUserInteraction = () => {
                        document.removeEventListener('click', handleUserInteraction);
                        setTimeout(() => this.playMusic(), 100);
                    };
                    document.addEventListener('click', handleUserInteraction, { once: true });
                });
            }, 1000);
        });
    }
    


    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = e.dataTransfer.files;
        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = e.target.files;
        this.processFiles(files);
    }

    async processFiles(files) {
        const previewContainer = document.getElementById('previewContainer');
        
        // 清空文件输入，避免重复添加
        document.getElementById('memoryMedia').value = '';
        
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
                alert('请选择图片或视频文件');
                continue;
            }

            // 检查文件大小：图片限制20MB，视频限制200MB
            if (file.type.startsWith('image/') && file.size > 20 * 1024 * 1024) {
                alert(`图片文件 ${file.name} 太大（${(file.size/1024/1024).toFixed(1)}MB），请选择小于20MB的图片`);
                continue;
            }
            if (file.type.startsWith('video/') && file.size > 200 * 1024 * 1024) {
                alert(`视频文件 ${file.name} 太大（${(file.size/1024/1024).toFixed(1)}MB），请选择小于200MB的视频`);
                continue;
            }

            try {
                let processedDataUrl;
                
                if (file.type.startsWith('image/')) {
                    // 压缩图片
                    processedDataUrl = await this.compressImage(file);
                } else {
                    // 视频文件压缩处理
                    processedDataUrl = await this.compressVideo(file);
                }

                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                previewItem.setAttribute('data-file-index', Date.now());
                
                if (file.type.startsWith('image/')) {
                    previewItem.innerHTML = `
                        <img src="${processedDataUrl}" alt="预览图片">
                        <span class="file-type">图片</span>
                        <button class="remove-preview" type="button">×</button>
                    `;
                } else if (file.type.startsWith('video/')) {
                    // 所有视频文件都显示为视频元素
                    previewItem.innerHTML = `
                        <video src="${processedDataUrl}" muted></video>
                        <span class="file-type">视频</span>
                        <button class="remove-preview" type="button">×</button>
                    `;
                }
                
                previewItem.querySelector('.remove-preview').addEventListener('click', () => {
                    previewItem.remove();
                    this.showFileCount();
                });
                
                previewContainer.appendChild(previewItem);
            } catch (error) {
                console.error('文件处理失败:', error);
                if (error.message !== '文件太大') {
                    alert(`文件 ${file.name} 处理失败，请重试`);
                }
            }
        }
        
        // 显示上传的文件数量
        if (files.length > 0) {
            console.log(`成功添加了 ${files.length} 个文件`);
            this.showFileCount();
        }
    }

    compressImage(file) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // 计算压缩尺寸（最大宽度800px）
                const maxWidth = 800;
                const scale = maxWidth / img.width;
                const width = img.width > maxWidth ? maxWidth : img.width;
                const height = img.height * scale;
                
                canvas.width = width;
                canvas.height = height;
                
                // 绘制压缩后的图片
                ctx.drawImage(img, 0, 0, width, height);
                
                // 压缩质量（0.7 = 70%）
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(compressedDataUrl);
            };
            
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    compressVideo(file) {
        return new Promise((resolve, reject) => {
            // 对于视频文件，我们使用智能处理策略
            // 1. 检查文件大小，如果小于200MB，直接使用
            // 2. 如果大于200MB，提示用户选择较小的文件
            
            if (file.size <= 200 * 1024 * 1024) {
                // 所有小于200MB的视频文件都直接读取为Base64
                this.readFileAsDataURL(file).then(resolve).catch(reject);
            } else {
                // 大文件提示用户
                alert(`视频文件 ${file.name} 太大（${(file.size/1024/1024).toFixed(1)}MB），请选择小于200MB的视频文件`);
                reject(new Error('文件太大'));
            }
        });
    }

    optimizeVideo(file) {
        return new Promise((resolve, reject) => {
            // 对于中等大小的视频文件，我们使用canvas截取关键帧作为预览
            // 这样可以大大减少存储空间占用
            
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            video.onloadedmetadata = () => {
                // 设置压缩后的尺寸（最大宽度480px）
                const maxWidth = 480;
                const scale = maxWidth / video.videoWidth;
                const width = video.videoWidth > maxWidth ? maxWidth : video.videoWidth;
                const height = video.videoHeight * scale;
                
                canvas.width = width;
                canvas.height = height;
                
                // 截取第一帧作为预览
                video.currentTime = 0.1; // 稍微延迟避免黑帧
                
                video.onseeked = () => {
                    ctx.drawImage(video, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    
                    // 对于大视频，我们保存第一帧作为预览，并标记为视频类型
                    resolve(compressedDataUrl);
                };
            };
            
            video.onerror = reject;
            video.src = URL.createObjectURL(file);
        });
    }

    async saveMemory(e) {
        e.preventDefault();
        
        const date = document.getElementById('memoryDate').value;
        const desc = document.getElementById('memoryDesc').value;
        const previewItems = document.querySelectorAll('.preview-item');
        
        if (!date) {
            alert('请选择日期');
            return;
        }
        
        if (previewItems.length === 0) {
            alert('请至少上传一张照片或一个视频');
            return;
        }
        
        const media = [];
        for (const item of Array.from(previewItems)) {
            const img = item.querySelector('img');
            const video = item.querySelector('video');
            const fileType = item.querySelector('.file-type').textContent;
            
            if (img && fileType === '图片') {
                media.push({
                    type: 'image',
                    src: img.src
                });
            } else if (video && fileType === '视频') {
                // 对于视频文件，我们需要确保保存的是Base64数据而不是临时Blob URL
                const videoSrc = video.src;
                if (videoSrc.startsWith('blob:')) {
                    // 如果是临时Blob URL，需要转换为Base64
                    try {
                        const response = await fetch(videoSrc);
                        const blob = await response.blob();
                        const base64Data = await this.blobToBase64(blob);
                        media.push({
                            type: 'video',
                            src: base64Data
                        });
                    } catch (error) {
                        console.error('视频数据转换失败:', error);
                        // 如果转换失败，仍然保存原始URL
                        media.push({
                            type: 'video',
                            src: videoSrc
                        });
                    }
                } else {
                    // 已经是Base64数据，直接保存
                    media.push({
                        type: 'video',
                        src: videoSrc
                    });
                }
            }
        }
        
        try {
            if (this.currentEditMemoryId) {
                // 编辑模式：更新现有回忆
                const memoryIndex = this.memories.findIndex(m => m.id === this.currentEditMemoryId);
                if (memoryIndex !== -1) {
                    this.memories[memoryIndex] = {
                        id: this.currentEditMemoryId,
                        date: date,
                        desc: desc,
                        media: media
                    };
                    
                    this.memories.sort((a, b) => new Date(a.date) - new Date(b.date));
                    
                    // 保存到IndexedDB
                    await this.saveToStorage();
                    
                    this.renderTimeline();
                    this.closeModal();
                    
                    this.showNotification('回忆已成功更新！');
                }
            } else {
                // 创建模式：添加新回忆
                const memory = {
                    id: Date.now(),
                    date: date,
                    desc: desc,
                    media: media
                };
                
                this.memories.push(memory);
                this.memories.sort((a, b) => new Date(a.date) - new Date(b.date));
                
                // 保存到IndexedDB
                await this.saveToStorage();
                
                this.renderTimeline();
                this.closeModal();
                
                this.showNotification('回忆已成功保存！');
            }
        } catch (error) {
            console.error('保存失败:', error);
            this.handleStorageError(error);
        }
    }

    async saveToStorage() {
        if (!this.db) {
            throw new Error('数据库未初始化');
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['memories'], 'readwrite');
            const store = transaction.objectStore('memories');
            
            // 清空现有数据
            store.clear();
            
            // 保存所有回忆
            this.memories.forEach(memory => {
                store.put(memory);
            });
            
            transaction.oncomplete = () => {
                console.log('回忆数据已保存到IndexedDB');
                resolve();
            };
            
            transaction.onerror = () => reject(transaction.error);
        });
    }

    cleanupOldMemories() {
        // 如果存储空间不足，清理最旧的回忆
        if (this.memories.length > 1) {
            const removedMemory = this.memories.shift(); // 移除最旧的回忆
            console.log('由于存储空间不足，已移除最旧的回忆:', removedMemory.date);
            
            // 显示通知让用户知道
            this.showNotification('存储空间不足，已自动清理最旧的回忆');
        }
    }

    handleStorageError(error) {
        if (error.name === 'QuotaExceededError') {
            alert('存储空间不足！建议：\n1. 清理浏览器缓存\n2. 减少上传的图片数量\n3. 使用较低分辨率的图片\n4. 点击"清理空间"按钮删除旧回忆');
        } else {
            alert('保存失败，请重试：' + error.message);
        }
    }

    // 清理功能已移除，避免误删数据

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e8b4b8;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1001;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    renderTimeline() {
        const timelineNodes = document.getElementById('timelineNodes');
        timelineNodes.innerHTML = '';
        
        if (this.memories.length === 0) {
            timelineNodes.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p>还没有任何回忆，点击"添加回忆"开始记录吧！</p>
                </div>
            `;
            return;
        }
        
        this.memories.forEach(memory => {
            const node = document.createElement('div');
            node.className = 'timeline-node';
            
            const imageCount = memory.media.filter(m => m.type === 'image').length;
            const videoCount = memory.media.filter(m => m.type === 'video').length;
            
            node.innerHTML = `
                <div class="node-dot"></div>
                <div class="node-content">
                    <div class="node-header">
                        <div class="node-date">${this.formatDate(memory.date)}</div>
                        <button class="edit-memory-btn" data-memory-id="${memory.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="node-desc">${memory.desc || '美好的回忆'}</div>
                    <div class="node-media-info">
                        ${imageCount > 0 ? `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>${imageCount}</span>` : ''}
                        ${videoCount > 0 ? `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>${videoCount}</span>` : ''}
                    </div>
                </div>
            `;
            
            node.addEventListener('click', (e) => {
                // 防止点击编辑按钮时触发显示回忆
                if (!e.target.closest('.edit-memory-btn')) {
                    this.showMemoryMedia(memory);
                }
            });
            
            // 绑定编辑按钮事件
            const editBtn = node.querySelector('.edit-memory-btn');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editMemory(memory.id);
            });
            
            timelineNodes.appendChild(node);
        });
    }

    editMemory(memoryId) {
        this.openModal(memoryId);
    }

    loadMemoryData(memoryId) {
        const memory = this.memories.find(m => m.id === memoryId);
        if (!memory) {
            console.error('未找到回忆数据:', memoryId);
            return;
        }

        // 填充表单数据
        document.getElementById('memoryDate').value = memory.date;
        document.getElementById('memoryDesc').value = memory.desc || '';
        this.updateCharCount();

        // 清空预览区域
        const previewContainer = document.getElementById('previewContainer');
        previewContainer.innerHTML = '';

        // 加载已有的媒体文件
        memory.media.forEach((media, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            previewItem.setAttribute('data-file-index', index);
            
            if (media.type === 'image') {
                previewItem.innerHTML = `
                    <img src="${media.src}" alt="预览图片">
                    <span class="file-type">图片</span>
                    <button class="remove-preview" type="button">×</button>
                `;
            } else if (media.type === 'video') {
                previewItem.innerHTML = `
                    <video src="${media.src}" muted></video>
                    <span class="file-type">视频</span>
                    <button class="remove-preview" type="button">×</button>
                `;
            }
            
            previewItem.querySelector('.remove-preview').addEventListener('click', () => {
                previewItem.remove();
                this.showFileCount();
            });
            
            previewContainer.appendChild(previewItem);
        });

        this.showFileCount();
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return '昨天';
        } else if (diffDays === 2) {
            return '前天';
        } else if (diffDays <= 7) {
            return `${diffDays}天前`;
        } else {
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }

    showMemoryMedia(memory) {
        this.currentMemory = memory;
        this.currentSlideIndex = 0;
        
        document.getElementById('mediaDate').textContent = this.formatDetailedDate(memory.date);
        document.getElementById('mediaDesc').textContent = memory.desc || '美好的回忆';
        
        const mediaSlider = document.getElementById('mediaSlider');
        mediaSlider.innerHTML = '';
        
        memory.media.forEach((media, index) => {
            const slide = document.createElement('div');
            slide.className = `media-slide ${index === 0 ? 'active' : ''}`;
            
            if (media.type === 'image') {
                slide.innerHTML = `<img src="${media.src}" alt="回忆照片">`;
            } else if (media.type === 'video') {
                // 确保视频数据正确加载，无论是Base64还是URL
                const videoSrc = media.src;
                slide.innerHTML = `
                    <video src="${videoSrc}"></video>
                    <button class="center-play-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 4v16l14-8z"/>
                        </svg>
                    </button>
                    <div class="video-controls">
                        <button class="play-pause-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
                            </svg>
                        </button>
                        <button class="mute-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                            </svg>
                        </button>
                        <span class="video-time">00:00 / 00:00</span>
                    </div>
                `;
            }
            
            mediaSlider.appendChild(slide);
        });
        
        this.updateSlideCounter();
        
        // 延迟设置视频控制，确保DOM已完全渲染
        setTimeout(() => {
            this.setupVideoControls(); // 设置视频控制
        }, 100);
        
        document.getElementById('mediaModal').classList.add('active');
    }

    // 新增视频控制设置方法
    setupVideoControls() {
        const videos = document.querySelectorAll('.media-slide video');
        console.log('找到视频元素数量:', videos.length);
        
        videos.forEach((video, index) => {
            console.log('设置视频控制:', index, '视频源:', video.src ? video.src.substring(0, 50) + '...' : '无源');
            const slide = video.closest('.media-slide');
            const centerPlayBtn = slide.querySelector('.center-play-btn');
            const playBtn = slide.querySelector('.play-pause-btn');
            const muteBtn = slide.querySelector('.mute-btn');
            const timeDisplay = slide.querySelector('.video-time');
            
            // 存储播放器实例
            this.videoPlayers.set(index, video);
            
            // 添加视频加载事件处理
            video.addEventListener('loadeddata', () => {
                console.log('视频数据已加载，视频时长:', video.duration);
            });
            
            video.addEventListener('error', (e) => {
                console.error('视频加载错误:', e);
                console.error('视频错误详情:', video.error);
            });
            
            // 中心播放按钮点击事件
            centerPlayBtn.addEventListener('click', () => {
                console.log('点击中心播放按钮');
                if (video.paused) {
                    video.play().then(() => {
                        console.log('视频播放成功');
                        // 添加播放状态类
                        slide.classList.add('playing');
                        // 更新底部控制按钮状态
                        playBtn.innerHTML = `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
                            </svg>
                        `;
                    }).catch(error => {
                        console.error('视频播放失败:', error);
                        alert('视频播放失败，请检查视频文件是否损坏或重新上传');
                    });
                }
            });
            
            // 播放/暂停控制
            playBtn.addEventListener('click', () => {
                console.log('点击播放按钮，视频状态:', video.paused, 'readyState:', video.readyState, '网络状态:', video.networkState);
                if (video.paused) {
                    video.play().then(() => {
                        console.log('视频播放成功');
                        // 添加播放状态类
                        slide.classList.add('playing');
                    }).catch(error => {
                        console.error('视频播放失败:', error);
                        // 显示错误信息给用户
                        alert('视频播放失败，请检查视频文件是否损坏或重新上传');
                    });
                    playBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
                        </svg>
                    `;
                } else {
                    video.pause();
                    // 移除播放状态类
                    slide.classList.remove('playing');
                    playBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 4v16l14-8z"/>
                        </svg>
                    `;
                }
            });
            
            // 静音控制
            muteBtn.addEventListener('click', () => {
                video.muted = !video.muted;
                muteBtn.innerHTML = video.muted ? 
                    `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                            <path d="M17 9l6 6m0-6l-6 6"/>
                        </svg>
                    ` : 
                    `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                        </svg>
                    `;
            });
            
            // 时间显示更新
            video.addEventListener('timeupdate', () => {
                const currentTime = this.formatTime(video.currentTime);
                const duration = this.formatTime(video.duration);
                timeDisplay.textContent = `${currentTime} / ${duration}`;
            });
            
            // 视频结束时重置播放按钮和状态
            video.addEventListener('ended', () => {
                playBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 4v16l14-8z"/>
                    </svg>
                `;
                // 移除播放状态类，显示中心播放按钮
                slide.classList.remove('playing');
            });
            
            // 视频暂停时显示中心播放按钮
            video.addEventListener('pause', () => {
                slide.classList.remove('playing');
            });
            
            // 视频播放时隐藏中心播放按钮
            video.addEventListener('play', () => {
                slide.classList.add('playing');
            });
        });
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 将Blob转换为Base64
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    formatDetailedDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    }

    closeMediaModal() {
        // 暂停所有视频播放
        this.videoPlayers.forEach(video => {
            video.pause();
        });
        this.videoPlayers.clear();
        
        document.getElementById('mediaModal').classList.remove('active');
        this.currentMemory = null;
        this.currentSlideIndex = 0;
    }

    shareApp() {
        const shareData = {
            title: '宋女士你好 - 专属回忆录',
            text: '记录美好时光，珍藏每一刻回忆',
            url: window.location.href
        };

        if (navigator.share) {
            // 使用Web Share API（移动端支持）
            navigator.share(shareData)
                .then(() => console.log('分享成功'))
                .catch((error) => {
                    console.log('分享失败:', error);
                    this.fallbackShare();
                });
        } else {
            // 降级方案：复制链接到剪贴板
            this.fallbackShare();
        }
    }

    fallbackShare() {
        const url = window.location.href;
        
        // 复制链接到剪贴板
        navigator.clipboard.writeText(url)
            .then(() => {
                alert('链接已复制到剪贴板！\n\n您可以粘贴到微信中分享给好友。\n\n链接：' + url);
            })
            .catch(() => {
                // 如果剪贴板API不可用，显示链接让用户手动复制
                const shareUrl = prompt('请复制以下链接分享给好友：', url);
                if (shareUrl) {
                    alert('链接已准备好，请粘贴到微信中分享！');
                }
            });
    }

    showFileCount() {
        const previewItems = document.querySelectorAll('.preview-item');
        const fileCount = previewItems.length;
        
        // 移除之前的计数显示
        const existingCount = document.querySelector('.file-count-display');
        if (existingCount) {
            existingCount.remove();
        }
        
        if (fileCount > 0) {
            const countDisplay = document.createElement('div');
            countDisplay.className = 'file-count-display';
            countDisplay.textContent = `已选择 ${fileCount} 个文件`;
            countDisplay.style.cssText = `
                margin-top: 10px;
                padding: 8px 12px;
                background: #e67e22;
                color: white;
                border-radius: 6px;
                font-size: 0.9rem;
                text-align: center;
                display: inline-block;
            `;
            
            const previewContainer = document.getElementById('previewContainer');
            previewContainer.parentNode.insertBefore(countDisplay, previewContainer.nextSibling);
        }
    }

    prevSlide() {
        if (this.currentMemory && this.currentMemory.media.length > 1) {
            // 暂停当前视频
            const currentVideo = this.videoPlayers.get(this.currentSlideIndex);
            if (currentVideo) {
                currentVideo.pause();
            }
            
            this.currentSlideIndex = (this.currentSlideIndex - 1 + this.currentMemory.media.length) % this.currentMemory.media.length;
            this.updateSlides();
        }
    }

    nextSlide() {
        if (this.currentMemory && this.currentMemory.media.length > 1) {
            // 暂停当前视频
            const currentVideo = this.videoPlayers.get(this.currentSlideIndex);
            if (currentVideo) {
                currentVideo.pause();
            }
            
            this.currentSlideIndex = (this.currentSlideIndex + 1) % this.currentMemory.media.length;
            this.updateSlides();
        }
    }

    updateSlides() {
        const slides = document.querySelectorAll('.media-slide');
        slides.forEach((slide, index) => {
            slide.classList.toggle('active', index === this.currentSlideIndex);
        });
        this.updateSlideCounter();
    }

    updateSlideCounter() {
        const counter = document.getElementById('slideCounter');
        if (this.currentMemory) {
            counter.textContent = `${this.currentSlideIndex + 1}/${this.currentMemory.media.length}`;
        }
    }

    handleKeydown(e) {
        if (document.getElementById('mediaModal').classList.contains('active')) {
            switch(e.key) {
                case 'ArrowLeft':
                    this.prevSlide();
                    break;
                case 'ArrowRight':
                    this.nextSlide();
                    break;
                case 'Escape':
                    this.closeMediaModal();
                    break;
                case ' ':
                    e.preventDefault();
                    const currentVideo = this.videoPlayers.get(this.currentSlideIndex);
                    if (currentVideo) {
                        if (currentVideo.paused) {
                            currentVideo.play();
                        } else {
                            currentVideo.pause();
                        }
                    }
                    break;
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TimelineApp();
});

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #a8a8a8;
    }
    
    .empty-state svg {
        width: 64px;
        height: 64px;
        margin-bottom: 20px;
        opacity: 0.5;
    }
    
    .empty-state p {
        font-size: 1rem;
        line-height: 1.5;
    }
    
    .node-media-info {
        margin-top: 8px;
        display: flex;
        gap: 10px;
        font-size: 0.8rem;
        color: #a8a8a8;
    }
    
    .node-media-info span {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    .node-media-info svg {
        width: 14px;
        height: 14px;
    }
`;
document.head.appendChild(style);