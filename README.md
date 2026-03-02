# Holix AI

<p align="center">
  <img src="public/logo.png" alt="Holix AI Logo" width="120" />
</p>

Holix AI is a cross-platform Electron desktop application built with React, Vite and TypeScript. It integrates modern LLM tooling (LangChain adapters), local storage via LibSQL/drizzle, and a polished UI using Radix + Tailwind-style components.

## Features

- Local-first chat with LLM integrations (OpenAI, Anthropic, Ollama, Google GenAI)
- Electron desktop app for macOS and Windows
- Built-in database using LibSQL + Drizzle ORM
- Modular React + TypeScript UI with plugin-friendly architecture

## Prerequisites

- Node.js 18+ (recommended)
- pnpm (project uses `pnpm@10.19.0`)
- macOS / Windows toolchains if you want native installers

## Quick Start (Development)

1. Install dependencies:

	```bash
	pnpm install
	```

2. Run the renderer dev server:

	```bash
	pnpm run dev:vite
	```

3. Run the main process in dev mode (docs/tsx generator):

	```bash
	pnpm run dev:main
	```

4. Or run both concurrently:

	```bash
	pnpm run dev
	```

To start the app (after running the main dev task) open a separate terminal and run Electron:

```bash
pnpm run dev:app
```

## Build

Build renderer and main bundles:

```bash
pnpm run build
```

Create installers using electron-builder (configured in `electron-builder.json`):

```bash
pnpm run package
```

To build and package for release:

```bash
pnpm run release
```

Note: Packaging for macOS and Windows requires running on the corresponding platform (or using appropriate CI runners). Extra build settings are in `electron-builder.json`.

## Database

Drizzle is configured via `drizzle-kit`. Generate and manage migrations:

```bash
pnpm run gen:db
pnpm run studio
```

## Lint, Typecheck and Tests

```bash
pnpm run lint
pnpm run type-check
pnpm run test
```

## CI / Releases

This repository includes a GitHub Actions workflow at `.github/workflows/release.yml` that triggers when a tag starting with `v` is pushed. The workflow builds artifacts for macOS and Windows and creates a GitHub Release with those artifacts.

To create a test release tag locally and push:

```bash
git tag -a v0.0.0-test -m "test release"
git push origin v0.0.0-test
```

Ensure repository secrets (like `GITHUB_TOKEN`) are available in Actions.

## Contributing

Contributions are welcome. Please open issues or PRs, follow the coding style (ESLint/biome), and run tests locally.

## License

This project is licensed under the terms in `package.json` (license: ISC).
