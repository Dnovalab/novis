# Novis（诺维斯）

开源的、本地优先的、图形化 AI 编程平台。集 Claude Code / Codex CLI / 腾讯 Marvis 三家之长。

**自由选择模型 · 透明成本控制 · 看得见的 Agent 流程 · 为中国开发者打造**

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 打包
npm run dist
```

## 技术栈

- **桌面壳**: Electron 30+
- **前端**: React 18 + TypeScript 5 + Tailwind CSS 3
- **设计系统**: shadcn/ui
- **编辑器**: Monaco Editor
- **状态管理**: zustand
- **测试**: Vitest + Testing Library + Playwright

## 项目结构

```
novis/
├── electron/          # Electron 主进程
│   ├── main.ts        # 入口 + 窗口管理
│   └── preload.ts     # 安全桥接 API
├── src/               # 渲染进程 (React)
│   ├── components/    # 组件
│   │   ├── ui/        # shadcn/ui 基础组件
│   │   └── layout/    # 布局组件
│   ├── stores/        # zustand 状态管理
│   ├── hooks/         # 自定义 Hooks
│   ├── lib/           # 工具函数
│   └── styles/        # 全局样式
├── tests/             # 测试
└── resources/         # 资源文件
```

## 核心特性

- **多模型自由切换** — DeepSeek / Qwen / GLM / 混元 / Ollama 本地模型，想用哪个用哪个
- **智能省钱路由** — 简单任务走本地免费模型，复杂任务走大厂 API，月费 ¥0-30
- **透明计费** — 每次 AI 回复旁显示花费，月度预算上限
- **多 Agent 协作** — PM Agent 拆解任务，Coder/Review/Tester 子 Agent 并行工作
- **隐私模式** — 100% 本地运行，断网可用，数据不上云
- **可视化任务编排** — 任务流程图展示，支持拖拽调整
- **多模型 PK** — 同一问题让两个模型同时回答，左右对比

## 开发路线

### Phase 1 — MVP 核心链路
- 模型网关（Ollama + DeepSeek / Qwen / GLM / 混元）
- Monaco 编辑器 + 文件树
- AI 对话面板（流式输出 + Markdown 渲染）
- 模型配置页面

### Phase 2 — 多模型 + 省钱体系
- 智能路由（本地 ↔ API）
- 透明计费（显示每次花费）
- 上下文瘦身 + 对话摘要
- 响应缓存 + 多模型 PK

### Phase 3 — 多 Agent + 可视化
- PM Agent 主控调度器
- Coder / File / Terminal Agent
- 子任务流程图 + 拖拽调整
- Checkpoint 回滚

### Phase 4 — 生态
- 技能/插件市场
- 提示词工坊
- Git 面板 + 定时任务
- 跨会话记忆系统

## License

MIT
