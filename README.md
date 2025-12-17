# 宋女士你好 - 专属回忆录

一个温馨的个人回忆记录应用，支持照片和视频上传，专为宋女士定制。

## 🌟 功能特色

- 📸 **多媒体支持**：照片和视频上传
- ⏰ **时间线展示**：横向时间线，按日期排序
- 📱 **响应式设计**：适配手机和电脑
- 💾 **本地存储**：数据保存在浏览器本地
- 🔗 **分享功能**：一键分享给微信好友

## 🚀 部署到GitHub Pages（永久访问）

### 步骤1：创建GitHub仓库

1. 访问 [GitHub.com](https://github.com) 并登录
2. 点击右上角 "+" → "New repository"
3. 填写仓库信息：
   - Repository name: `song-memories`（或其他您喜欢的名称）
   - Description: "宋女士的专属回忆录"
   - 选择 "Public"（公开仓库才能免费使用Pages）
   - 勾选 "Add a README file"
4. 点击 "Create repository"

### 步骤2：上传代码到GitHub

1. 在本地项目目录执行以下命令：

```bash
# 添加所有文件到Git
cd "d:\Trae 文件\照片"
git add .

# 提交更改
git commit -m "初始化宋女士回忆录应用"

# 连接到GitHub仓库（替换yourusername为您的GitHub用户名）
git remote add origin https://github.com/yourusername/song-memories.git

# 推送代码
git branch -M main
git push -u origin main
```

### 步骤3：启用GitHub Pages

1. 在GitHub仓库页面，点击 "Settings" 选项卡
2. 左侧菜单找到 "Pages"
3. 在 "Source" 部分选择 "Deploy from a branch"
4. 选择 "main" 分支和 "/ (root)" 文件夹
5. 点击 "Save"

### 步骤4：获取永久访问链接

部署完成后，您的应用将在以下地址永久访问：
```
https://yourusername.github.io/song-memories
```

**请将 `yourusername` 替换为您的GitHub用户名**

## 📱 微信分享优化

应用已针对微信分享进行优化：

- **分享标题**：宋女士你好 - 专属回忆录
- **分享描述**：记录美好时光，珍藏每一刻回忆
- **分享图标**：自动生成的橙色背景图标

### 分享方法

1. **移动端**：点击"分享给好友"按钮，系统会自动调用分享功能
2. **电脑端**：点击"分享给好友"按钮，链接会自动复制到剪贴板

## 🔧 本地开发

如需在本地运行：

```bash
# 启动本地服务器
cd "d:\Trae 文件\照片"
python -m http.server 8000

# 然后在浏览器访问
# http://localhost:8000
```

## 📝 使用说明

1. **添加回忆**：点击"添加回忆"按钮，选择日期、添加描述、上传照片/视频
2. **查看回忆**：点击时间线上的节点查看对应回忆
3. **分享应用**：点击"分享给好友"按钮将应用分享给微信好友

## 🎨 设计特色

- **温馨配色**：橙色系暖色调，营造温馨氛围
- **苹果风格**：简洁现代的界面设计
- **流畅动画**：平滑的过渡效果和交互反馈

## 💡 注意事项

- **数据存储**：回忆数据保存在浏览器本地，清除浏览器数据会丢失回忆
- **文件大小**：建议上传的文件大小不超过10MB
- **浏览器支持**：建议使用Chrome、Safari、Edge等现代浏览器

---

**祝宋女士使用愉快！** 🎉