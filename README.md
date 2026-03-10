# Holix AI

<p align="center">
  <img src="public/logo.png" alt="Holix AI Logo" width="120" />
</p>

<p align="center">
  一个面向开发者与高频 AI 用户的桌面端 AI 工作台。<br />
  本地优先、可扩展、可审计，支持多模型与 Skills 工具生态。
</p>

---

## 📌 项目简介

**Holix AI** 是一个基于 **Electron + React + TypeScript** 的跨平台桌面应用，核心定位是：

- 把 AI 对话能力放进一个可长期使用的本地工作环境；
- 把模型能力（OpenAI / Anthropic / Google GenAI / Ollama）统一在一个界面中管理；
- 通过 Skills 机制，让 AI 从“聊天”升级为“可执行任务”的智能助手。

它不是一次性的网页聊天工具，而是更偏生产力型的 **AI 客户端基础设施**。

## ✨ 核心功能

### 1) 多 Provider / 多模型统一接入

- 内置 Provider 管理，可配置多个模型供应商与默认模型；
- 支持按会话选择模型，便于在“速度 / 成本 / 效果”之间切换；
- API Key 等配置本地存储，减少对外部平台的强绑定。

### 2) 本地优先的会话与数据管理

- 聊天数据持久化到本地数据库（LibSQL + Drizzle）；
- 支持数据库迁移与结构化管理，便于持续演进；
- 保留完整上下文，适合长期项目型对话。

### 3) Skills 技能系统（可扩展能力）

- 支持加载内置 Skills 与用户 Skills；
- 用户 Skill 可覆盖同名内置 Skill，适配团队/个人工作流；
- 支持多种工具类型：
  - JavaScript 工具（复杂逻辑）
  - 命令行工具（Command）
  - 外部脚本工具（Script）
- 支持监听技能目录变更并自动重载。

### 4) 工具调用审批机制（安全可控）

- 对高风险工具调用引入执行前审批；
- 支持“仅本次会话允许”与“始终允许”策略；
- 拒绝调用会被明确记录并反馈，提升可审计性。

### 5) 桌面端完整体验

- 系统托盘、窗口生命周期管理、单实例运行；
- 生产环境自动更新能力（electron-updater）；
- i18n 多语言支持（含中文）。

### 6) 工程化与可维护性

- 前端：React + TanStack Router + 组件化 UI；
- 后端（主进程）：模块化服务、路由与 tRPC；
- 具备单元测试体系（Vitest）与类型检查（TypeScript）。

## 🚀 为什么选择 Holix AI（优势）

- **本地掌控感强**：数据、配置、技能都在你的机器中可控；
- **扩展性强**：通过 Skill 就能注入新能力，而不是等待官方功能排期；
- **安全边界更清晰**：高风险工具审批 + 调用记录，适合真实生产环境；
- **模型中立**：不绑定单一大模型供应商，方便策略切换和成本优化；
- **桌面端稳定体验**：更适合长时间工作流，而不是浏览器短会话。

## 🧱 技术栈

- **Desktop**: Electron
- **Frontend**: React 19, TypeScript, Vite, TanStack Router
- **AI / LLM**: LangChain + 多 Provider 适配
- **Data**: LibSQL, Drizzle ORM
- **State / Utilities**: Zustand, i18next, ky
- **Testing**: Vitest, Testing Library

## 📂 项目结构（简要）

```txt
src/
├─ node/                 # Electron 主进程：生命周期、服务、数据库、聊天与技能执行
├─ routes/               # 页面路由（首页、聊天、设置、技能等）
├─ components/           # UI 组件与编辑器能力
├─ store/                # 前端状态管理
├─ lib/                  # 客户端工具库
└─ i18n/                 # 国际化资源

skills/                  # 内置技能（示例：file-system / shell / web-search / code-reader）
drizzle/                 # 数据库迁移
docs/                    # 项目文档（生命周期、技能系统等）
```

## 🛠️ 开发环境要求

- Node.js 18+
- pnpm（项目使用 `pnpm@10.19.0`）
- 如需打包安装器，请在对应系统上构建（macOS / Windows）

## ⚡ 快速开始

安装依赖：

```bash
pnpm install
```

启动前端开发服务：

```bash
pnpm run dev:vite
```

启动主进程开发构建：

```bash
pnpm run dev:main
```

或一键并行启动：

```bash
pnpm run dev
```

在另一终端启动 Electron：

```bash
pnpm run dev:app
```

## 📦 构建与发布

构建主进程与前端：

```bash
pnpm run build
```

生成安装包（electron-builder）：

```bash
pnpm run package
```

完整发布流程：

```bash
pnpm run release
```

## 🗃️ 数据库相关

生成迁移：

```bash
pnpm run gen:db
```

打开 Drizzle Studio：

```bash
pnpm run studio
```

## ✅ 质量保障命令

```bash
pnpm run lint
pnpm run type-check
pnpm run test
pnpm run test:skills
```

## 🔌 Skills 使用说明

- 用户 Skills 目录：`~/.holixai/skills/`
- 详细格式与示例请见：`docs/SKILLS.md`
- 修改 skill 后可触发重载（或重启应用）

> 你可以把 Holix AI 理解为“可安装能力包的 AI 客户端”，Skills 就是它的能力插件系统。

## 📄 License

MIT
