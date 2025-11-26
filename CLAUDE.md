# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Gemini nano banana api文档

https://ai.google.dev/gemini-api/docs/image-generation


## Project Overview

Aice PS is a web-based AI photo editor powered by Google Gemini API. It provides professional-grade image editing and creation capabilities through natural language prompts. The app leverages multiple Google AI models (gemini-2.5-flash-image, imagen-4.0-generate-001) for various image manipulation tasks.

**重要改动说明**：
- 本项目已从原版分支，部署在腾讯云 EdgeOne Pages（静态页面托管）
- 通过 URL 查询参数传递 API 配置（`?server=xxx&key=xxx`），适配 OneHub 等 API 平台的 Playground 嵌入使用
- 模板系统已重构，支持通过 URL hash 加载（`#?templateId=xxx`）
- 图片资源已迁移到远程 CDN

## Tech Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Key Libraries**:
  - `@google/genai` - Google Gemini API client
  - `framer-motion` - Animations
  - `react-image-crop` - Image cropping functionality
- **Deployment**:
  - 腾讯云 EdgeOne Pages（静态页面托管）
  - Docker + Nginx（可选，自托管）
  - Vite dev server（开发环境）

## Project Structure

The project uses a flat file structure (no `src/` directory):

```
/
├── App.tsx                    # Main app component with routing and state management
├── index.tsx                  # Entry point
├── types.ts                   # TypeScript type definitions
├── components/                # All React components
│   ├── *Page.tsx             # Page-level components (BeatSyncPage, PastForwardPage, etc.)
│   ├── *Panel.tsx            # Feature panels (FilterPanel, AdjustmentPanel, etc.)
│   ├── *Modal.tsx            # Modal dialogs
│   └── *.tsx                 # Utility components (Header, Spinner, icons, etc.)
├── services/
│   └── geminiService.ts      # All Google Gemini API interactions
├── lib/
│   └── albumUtils.ts         # Album/image processing utilities
├── public/
│   ├── templates.json        # Template library data
│   ├── prompt.md            # Prompt documentation
│   └── images/              # Template images and assets
└── vite.config.ts           # Environment variable injection for API keys
```

## Development Commands

### Local Development
```bash
npm run dev          # Start Vite dev server (default: http://localhost:5173)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build locally
```

### Docker Deployment
```bash
# Build Docker image
docker build -t aice-ps .

# Run with docker-compose (recommended)
docker-compose up -d

# Or run directly with docker
docker run -d -p 8080:80 --name aice-ps \
  -e API_KEY="your_gemini_api_key" \
  -e API_BASE_URL="https://your-custom-api-endpoint" \
  aice-ps
```

## Key Architecture Patterns

### API Key Management
The app supports multiple API key sources with fallback logic:
1. **URL 查询参数**（最高优先级）：`?server=xxx&key=xxx`
   - 应用启动时自动读取并保存到 localStorage
   - 保存后自动清理 URL 参数以保护敏感信息
   - 实现位置：[App.tsx](App.tsx) 的 `useEffect` hook（约 765-789 行）
2. User-provided key via localStorage (`gemini-api-key`)
3. Custom base URL via localStorage (`gemini-base-url`)
4. Environment variables injected at build time (`process.env.API_KEY`, `process.env.API_BASE_URL`)

**Location**: [services/geminiService.ts](services/geminiService.ts)
- `getApiKey()` - Retrieves API key from localStorage
- `getBaseUrl()` - Retrieves custom API endpoint
- `getGoogleAI()` - Singleton pattern for GoogleGenAI instance with auto-reinitialization

**典型使用场景**：
- 腾讯云 EdgeOne Pages 静态部署 + OneHub API 平台 Playground 嵌入
- URL: `https://your-domain.com?server=https://api.oneapi.com&key=sk-xxxxx`

### Image Processing Pipeline
All image operations follow this pattern:
1. Convert image to appropriate format (File, base64, or Blob)
2. Call corresponding service function in `geminiService.ts`
3. Service function constructs prompt and calls Gemini API
4. Response is converted back to displayable format
5. Update app state with new image

**Key Functions in geminiService.ts**:
- `generateEditedImage()` - Point-based local editing
- `generateFilteredImage()` - Apply artistic filters
- `generateAdjustedImage()` - Professional adjustments (blur, enhance, etc.)
- `generateFusedImage()` - Multi-image fusion (2-4 images)
- `generateTexturedImage()` - Apply textures
- `removeBackgroundImage()` - Background removal
- `generateStyledImage()` - Style transformation (used in BeatSync)

### Component State Management
The app uses React's built-in state management:
- [App.tsx](App.tsx) manages global state (current page, image history, crop state)
- Individual panels/pages manage their own local state
- No external state management library (Redux, Zustand, etc.)

### History/Undo System
Implemented in [App.tsx](App.tsx):
- `imageHistory` - Array of image data URLs
- `historyIndex` - Current position in history
- `undo()` / `redo()` - Navigate history
- `addToHistory()` - Add new state (auto-truncates forward history)

### Template System
Templates are defined in [public/templates.json](public/templates.json):
```json
{
  "id": "unique-id",
  "name": "Display Name",
  "iconUrl": "https://cdn.example.com/thumbnail.jpg",
  "baseUrl": "https://cdn.example.com/full-image.jpg",
  "description": "Description text",
  "prompt": "Full prompt text for Gemini"
}
```

**重要变更**：
- 图片 URL 已从本地相对路径（`./images/`）迁移到远程 CDN
- 支持通过 URL hash 直接加载模板：`#?templateId=template-figurine-design`
  - 实现位置：[App.tsx](App.tsx) 的 EditorView 组件（约 180-246 行）
  - 自动提取 templateId，加载对应图片和 prompt
  - 加载完成后自动清理 URL hash
- 模板库界面：[TemplateLibraryPage.tsx](components/TemplateLibraryPage.tsx) 支持分页和搜索
- 模板详情页：[TemplateDisplayPage.tsx](components/TemplateDisplayPage.tsx) 提供预览和"在编辑器中使用"功能

### Feature Pages
The app has multiple "pages" managed by state in App.tsx:
- `editor` - Main editing interface (default)
- `past-forward` - Age progression/regression feature
- `template-library` - Browse and select templates
- `template-display` - View single template details
- `beat-sync` - Music-synced video generation

Page switching is handled via `currentPage` state and conditional rendering in App.tsx.

## Important Implementation Notes

### Image Format Handling
- Internal format: base64 data URLs stored in `imageHistory`
- API calls: Convert to File objects using `dataURLtoFile()`
- Gemini API requires specific MIME types and proper file structure
- Always validate image format before API calls

### Error Handling
All Gemini API calls include error handling:
- Display user-friendly error messages
- Log technical details to console
- Fallback to previous image state on failure
- Check API key availability before making calls

### Performance Considerations
- Images are stored as base64 strings in memory (can be memory-intensive)
- History is unlimited (consider adding max limit for production)
- No image compression before API calls (Gemini handles this)
- Concurrent API calls are not limited (consider rate limiting for production)

### Path Aliases
TypeScript path alias configured in [tsconfig.json](tsconfig.json):
```json
"paths": {
  "@/*": ["./*"]
}
```
Use `@/` to reference files from root (though not heavily used in this codebase).

## Common Development Tasks

### Adding a New AI Feature
1. Add function to [services/geminiService.ts](services/geminiService.ts)
2. Create UI panel/component in `components/`
3. Import and integrate in [App.tsx](App.tsx)
4. Add to toolbar if needed in [Toolbar.tsx](components/Toolbar.tsx)

### Adding New Templates
1. 上传图片到 CDN（推荐使用远程 URL）
2. 在 [public/templates.json](public/templates.json) 中添加条目
3. 模板在应用启动时自动加载
4. 本地开发时也可使用本地图片（`./images/`），但生产环境推荐使用 CDN

### Modifying API Behavior
All API interactions are centralized in [services/geminiService.ts](services/geminiService.ts). Modify prompt construction or API call parameters there.

## Environment Variables

Set these for custom API configuration:
- `API_KEY` - Gemini API key (injected by Vite at build time)
- `API_BASE_URL` - Custom API endpoint (for proxy/alternative providers)

These are defined in [vite.config.ts](vite.config.ts) and injected as `process.env.*` in the build.

## Testing Notes

- No test framework currently configured
- Manual testing required for all features
- Test with different image formats (JPG, PNG, WebP)
- Test API key fallback scenarios
- Verify error handling with invalid API keys

## Dependencies to Know

### @google/genai
Official Google Generative AI SDK. Key classes:
- `GoogleGenAI` - Main client
- `Modality` - Input/output type definitions
- `Type` - Schema type definitions for structured output

### framer-motion
Used for page transitions and animations. All page-level components wrapped in `<motion.div>` with `AnimatePresence`.

### react-image-crop
Handles the cropping UI. Returns crop data as `PixelCrop` which is converted to cropped image via canvas manipulation in `getCroppedImg()` helper.

## Recent Major Changes (2025-11)

1. **布局优化**（最新）
   - 修复编辑页面浮动按钮与侧边栏重叠问题
   - 侧边栏宽度从 `w-80` (320px) 增加到 `w-96` (384px)
   - 标签按钮从 flex-wrap 改为 grid-cols-4，避免按钮被挤压
   - 画布容器添加 `relative` 定位，确保浮动按钮正确定位

2. **模板系统重构**（5a1120d）
   - 支持通过 URL hash 直接加载模板
   - 图片资源迁移到远程 CDN
   - 添加图片替换功能和"在编辑器中使用"功能

3. **批量处理功能**（594d226）
   - 添加 BatchResultModal 和 BatchSelector 组件
   - 支持生成多张候选图片供用户选择
   - UI 全面改进，优化交互体验

4. **静态资源优化**（251d967, 3d40494）
   - prompt.md 和 templates.json 移动到 public 目录
   - 图片 URL 全部更新为远程地址
   - 背景样式从 HTML 移到 CSS

## Known Issues & TODOs

From [README.md](README.md):
- [ ] 持续增加提示词模板中 (进行中)
- [ ] 芝士香蕉功能-计划中
- [ ] 接入第三方平台API

## License

Apache-2.0 (see file headers)
