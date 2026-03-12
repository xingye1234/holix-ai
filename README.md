<div align="center">

[English](README.md) | [简体中文](README.zh-CN.md)

</div>

<div align="center">
  <img src="public/logo.png" alt="Holix AI Logo" width="120" />

  <h1>Holix AI</h1>

  <p>A desktop AI workbench for developers and power AI users.<br />Local-first, extensible, auditable, with multi-model support and Skills ecosystem.</p>

  <p>
    <img src="https://img.shields.io/badge/version-0.0.2-blue.svg" alt="Version" />
    <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
    <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg" alt="Platform" />
  </p>

  <p>
    <a href="https://github.com/zhaogongchengsi/holix-ai/releases">
      <img src="https://img.shields.io/badge/Download-Latest%20Release-brightgreen.svg?style=for-the-badge" alt="Download" />
    </a>
  </p>

</div>

---

## 📌 Overview

**Holix AI** is a cross-platform desktop application built with **Electron + React + TypeScript**, designed to:

- Provide a long-term, local AI conversation environment
- Unify multiple model providers (OpenAI / Anthropic / Google GenAI / Ollama) in a single interface
- Transform AI from "chat" to "executable tasks" through the Skills mechanism

It's not a one-time web chat tool, but a productivity-focused **AI client infrastructure**.

## ✨ Core Features

### 1) Multi-Provider / Multi-Model Integration

- Built-in provider management with support for multiple model vendors and default models
- Per-session model selection for easy switching between speed / cost / quality
- Local storage of API keys and configurations, reducing dependency on external platforms

### 2) Local-First Session & Data Management

- Chat data persisted to local database (LibSQL + Drizzle)
- Database migration and structured management for continuous evolution
- Complete context retention, suitable for long-term project conversations

### 3) Skills System (Extensible Capabilities)

- Support for loading built-in Skills and user Skills
- User Skills can override built-in Skills with the same name, adapting to team/personal workflows
- Support for multiple tool types:
  - JavaScript tools (complex logic)
  - Command-line tools (Command)
  - External script tools (Script)
- Support for monitoring skill directory changes and automatic reloading

### 4) Tool Invocation Approval Mechanism (Secure & Controllable)

- Pre-execution approval for high-risk tool invocations
- Support for "allow for this session only" and "always allow" policies
- Rejected invocations are explicitly recorded and reported, improving auditability

### 5) Complete Desktop Experience

- System tray, window lifecycle management, single-instance execution
- Production auto-update capability (electron-updater)
- i18n multi-language support (including Chinese)

### 6) Engineering & Maintainability

- Frontend: React + TanStack Router + component-based UI
- Backend (main process): modular services, routing, and tRPC
- Unit testing framework (Vitest) and type checking (TypeScript)

## 🚀 Why Choose Holix AI (Advantages)

- **Strong local control**: Data, configurations, and skills are all controllable on your machine
- **High extensibility**: Inject new capabilities through Skills without waiting for official feature releases
- **Clear security boundaries**: High-risk tool approval + invocation records, suitable for real production environments
- **Model-agnostic**: Not tied to a single LLM provider, facilitating strategy switching and cost optimization
- **Stable desktop experience**: Better suited for long-term workflows than browser-based short sessions

## 🧱 Tech Stack

- **Desktop**: Electron
- **Frontend**: React 19, TypeScript, Vite, TanStack Router
- **AI / LLM**: LangChain + multi-provider adapters
- **Data**: LibSQL, Drizzle ORM
- **State / Utilities**: Zustand, i18next, ky
- **Testing**: Vitest, Testing Library

## 📂 Project Structure (Brief)

```txt
src/
├─ node/                 # Electron main process: lifecycle, services, database, chat & skill execution
├─ routes/               # Page routes (home, chat, settings, skills, etc.)
├─ components/           # UI components and editor capabilities
├─ store/                # Frontend state management
├─ lib/                  # Client utility libraries
└─ i18n/                 # Internationalization resources

skills/                  # Built-in skills (examples: file-system / shell / web-search / code-reader)
drizzle/                 # Database migrations
docs/                    # Project documentation (lifecycle, skills system, etc.)
```

## 🛠️ Development Requirements

- Node.js 18+
- pnpm (project uses `pnpm@10.19.0`)
- For building installers, build on the corresponding system (macOS / Windows)

## ⚡ Quick Start

Install dependencies:

```bash
pnpm install
```

Start frontend development server:

```bash
pnpm run dev:vite
```

Start main process development build:

```bash
pnpm run dev:main
```

Or start both in parallel:

```bash
pnpm run dev
```

In another terminal, start Electron:

```bash
pnpm run dev:app
```

## 📦 Build & Release

Build main process and frontend:

```bash
pnpm run build
```

Generate installer (electron-builder):

```bash
pnpm run package
```

Complete release process:

```bash
pnpm run release
```

## 🗃️ Database Commands

Generate migration:

```bash
pnpm run gen:db
```

Open Drizzle Studio:

```bash
pnpm run studio
```

## ✅ Quality Assurance Commands

```bash
pnpm run lint
pnpm run type-check
pnpm run test
pnpm run test:skills
```

## 🔌 Skills Usage Guide

- User Skills directory: `~/.holixai/skills/`
- For detailed format and examples, see: `docs/SKILLS.md`
- Skill modifications can trigger reload (or restart the app)

> You can think of Holix AI as an "AI client with installable capability packages" — Skills are its capability plugin system.

## 📄 License

MIT
