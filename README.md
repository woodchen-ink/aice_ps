# Aice PS - AI 图片编辑器

Aice PS 是一款功能强大的网页版 AI 照片编辑器，利用 Google Gemini API 的先进能力，让专业级的图像编辑和创作变得简单直观。用户可以通过简单的文本提示对图像进行修饰、应用创意滤镜、进行专业调整，甚至从零开始生成全新的图像。

![Aice PS 界面截图](public/images/show.jpg)

## 与原项目的不同

1. 纯静态部署, 通过查询参数设置 API 地址和 Key
2. 支持通过 URL hash 加载模板, 更改了模板的使用方式
3. 新增支持图片分辨率"1K""2K" "4K"
4. 增加模板
5. 模板页改成无限加载




## 导入更多模板方法

```
# 下载最新 README
curl -L "https://raw.githubusercontent.com/PicoTrex/Awesome-Nano-Banana-images/refs/heads/main/README.md" -o scripts/nano-banana-readme.md

# 运行导入
node scripts/import-all-chinese.js
```



## 🚀 部署方式

本项目已部署在**腾讯云 EdgeOne Pages**（静态页面托管），支持通过 URL 参数配置 API：

```
https://your-domain.com?server=https://api.example.com&key=sk-xxxxx
```

### 典型使用场景
- ✅ 静态页面托管（EdgeOne Pages / Vercel / Netlify）
- ✅ API 平台 Playground 嵌入（如 OneHub）
- ✅ 自托管 Docker 部署

## 注意事项

⚠️ **调用 Gemini API 是需要收费的**


## ✨ 主要功能

Aice PS 结合了多种尖端 AI 能力，为您提供一站式的创意图片与视频解决方案：

-   **🚀 AI 图像生成**: 输入任意文本描述，即可由 `Imagen 4` 模型创造出细节丰富、富有创意的高质量图片，并支持多种宽高比。
-   **✍️ 智能修饰 (局部编辑)**: 在图片上轻松点击指定位置，通过简单的文字指令（如“移除这个物体”、“把衬衫变成红色”）进行精准、无缝的局部修改。
-   **🎨 创意滤镜与专业调整**: 一键应用动漫、合成波、Lomo 等多种艺术风格滤镜，或进行背景虚化、增强细节、调整光效等专业级图像调整。
-   **💡 AI 灵感建议**: 不确定从何下手？AI 会智能分析您的图片，并为您量身推荐最合适的滤镜、调整和纹理效果，激发您的创作灵感。
-   **🧩 智能合成**: 上传多张图片，通过一句话描述，即可将不同元素（如人物、背景、风格）无缝地融合在一起，创造出全新的合成图像。
-   **🧱 纹理叠加**: 为图片添加各种逼真的创意纹理，如裂纹漆、木纹、金属拉丝等，瞬间提升画面质感。
-   **✂️ 一键抠图**: 强大的人工智能可自动识别并移除图片背景，一键生成带透明通道的 PNG 图像，非常适合设计和合成。
-   **🕰️ Past Forward (时空穿越)**: 上传一张肖像照，AI 将带您穿越时空，生成您在 1950s 至 2000s 各个年代的逼真样貌。
-   **🎵 音画志 (BeatSync)**: 上传一张图片和一段音乐，AI 会自动生成多种风格化图集，并根据音乐节拍一键生成带有酷炫转场效果的视频短片。
-   **📚 NB 提示词库**: 内置一个可搜索、分页的模板库，提供丰富的创意起点。点击模板即可加载预设图片和提示词，轻松开始您的创作之旅。
-   **🛠️ 基础编辑套件**: 提供无限制的裁剪、撤销/重做、实时对比原图、保存和下载等基础功能，满足您的日常编辑需求。

## 🛠️ 技术栈

- **前端**: React 19
- **语言**: TypeScript
- **AI 模型**: Google Gemini API (`gemini-2.5-flash-image`, `imagen-4.0-generate-001`, `gemini-2.5-flash`)
- **样式**: Tailwind CSS
- **组件库**: `react-image-crop`, `framer-motion`
- **部署**: Docker & Nginx

## 📦 部署指南

### 静态页面托管（推荐）

本项目支持部署到任何静态页面托管平台：

1. **腾讯云 EdgeOne Pages**
   ```bash
   npm run build
   # 上传 dist/ 目录到 EdgeOne Pages
   ```

2. **Vercel / Netlify**
   ```bash
   npm run build
   # 自动部署或上传 dist/ 目录
   ```

3. **使用 URL 参数配置 API**
   ```
   https://your-domain.com?server=https://api.example.com&key=sk-xxxxx
   ```
   - 参数会自动保存到 localStorage
   - 保存后 URL 会自动清理参数以保护安全

### 🐳 Docker 自托管部署

如需自托管，可使用 Docker：

#### 1. 构建镜像

```bash
docker build -t aice-ps .
```

#### 2. 运行容器

```bash
docker run -d -p 8080:80 --name aice-ps \
  -e API_KEY="your_gemini_api_key" \
  -e API_BASE_URL="https://your-custom-api-endpoint" \
  aice-ps
```

或使用 `docker-compose`：

```bash
# 创建 .env 文件
echo "API_KEY=your_gemini_api_key" > .env
echo "API_BASE_URL=https://your-custom-api-endpoint" >> .env

# 启动服务
docker-compose up -d
```

访问 `http://localhost:8080` 即可使用。

## 🎨 核心 AI 模型介绍

Aice PS 的强大功能由 Google 最先进的一系列生成式 AI 模型驱动，每个模型都在特定任务中发挥着关键作用。

### Gemini 2.5 Flash Image (`gemini-2.5-flash-image`)

这款模型是 Aice PS 所有核心**图像编辑功能**的引擎，也被称为 "Nano Banana"。它不仅仅是一个图像生成器，更是一个上下文编辑器，能够深度理解图像内容并根据自然语言指令进行精确操作。

其主要优势包括：

-   **高级推理与上下文理解**: 模型能像人类一样“思考”用户的编辑意图。
-   **卓越的角色与场景一致性**: 在进行多次编辑或生成系列图片时，能够保持主体角色和场景风格的高度一致性。
-   **精确的局部编辑**: 用户可以在图像上指定一个点，然后用自然语言描述修改内容。
-   **文本与细节处理**: 能够识别并修改图像中的文字，同时保持原始字体和风格。
-   **多图像融合**: 模型可以理解并融合多张输入图片。

## ⚠️ API 配置说明

### 方式 1: URL 参数（推荐，用于嵌入式场景）
```
https://your-domain.com?server=https://api.example.com&key=sk-xxxxx
```
- 适用于 API 平台 Playground 嵌入
- 参数会自动保存到浏览器本地存储
- 保存后 URL 自动清理参数

### 方式 2: 设置面板
- 在应用内打开设置面板手动配置
- API Key 和 Base URL 保存在 localStorage

### 方式 3: 环境变量（Docker 部署）
```bash
API_KEY=your_gemini_api_key
API_BASE_URL=https://your-custom-api-endpoint
```

⚠️ **费用提醒**：使用自己的 API Key 会产生费用，请谨慎配置。

## 🎯 开发路线

### 已完成
- [x] Google Aistudio APP，免费使用 Nano Banana
- [x] 多图融合（2-4 张图片）
- [x] Past Forward - 年龄穿越功能
- [x] 音画志 - 音乐节拍视频生成
- [x] 粘贴上传图片
- [x] NB 提示词库（模板系统）
- [x] Gemini API 支持
- [x] Docker 部署支持
- [x] **URL 参数配置 API（适配 OneHub 等平台）**
- [x] **模板 URL hash 加载**
- [x] **图片资源 CDN 迁移**
- [x] **批量生成候选图片**
- [x] **布局优化（侧边栏加宽，按钮网格布局）**

### 进行中
- [ ] 持续增加提示词模板
- [ ] 芝士香蕉功能
- [ ] 接入第三方平台 API

### 相关链接
- [【视频教程】](https://www.bilibili.com/video/BV1hwahzNEhC/)
- [【交流群】](https://cnb.cool/fuliai/comfyui/-/issues/11) 

## 📄 许可证

本项目采用 [Apache-2.0](./LICENSE) 许可证。
