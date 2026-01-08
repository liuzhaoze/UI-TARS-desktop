# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UI-TARS Desktop is a cross-platform GUI Agent application built with Electron, React, and TypeScript. It enables natural language control of computers using Vision-Language Models (VLMs). The project is a monorepo managed by pnpm with Turborepo for build orchestration.

**Tech Stack:**
- Electron 34.x for desktop application framework
- React 18 with TypeScript 5.7 for frontend
- Vite and electron-vite for build tooling
- Zustand for state management, ElectronStore for persistent settings
- Tailwind CSS 4.x for styling
- Vitest for unit tests, Playwright for E2E tests

**Prerequisites:** Node.js >= 20.x, pnpm >= 9

## Development Commands

### Root Level (from repository root)
```bash
pnpm bootstrap              # Install all dependencies
pnpm dev:ui-tars            # Start UI-TARS Desktop in development mode
pnpm run dev:w              # Start with main process hot-reload (default: renderer only)
pnpm test                   # Run Vitest unit tests
pnpm run test:bench         # Run benchmark tests
pnpm coverage               # Generate test coverage reports
pnpm lint                   # Run ESLint with auto-fix
pnpm format                 # Format code with Prettier
```

### In apps/ui-tars (Desktop App)
```bash
npm run dev                 # Development mode (renderer HMR only)
npm run dev:w               # Development with main process hot-reload
npm run debug               # Debug mode with sourcemaps on port 9222
npm run build               # Production build + create installers
npm run build:dist          # Build dist files only
npm run package             # Electron Forge packaging
npm run make                # Create installers
npm run typecheck           # TypeScript type checking
npm run test:e2e            # Run Playwright E2E tests
```

## Architecture

### Monorepo Structure
- **apps/ui-tars/** - Main Electron desktop application
  - `src/main/` - Electron main process (app lifecycle, IPC, services)
  - `src/renderer/` - React frontend application
  - `src/preload/` - Preload scripts for IPC bridge
- **packages/ui-tars/** - Core UI-TARS packages
  - `@ui-tars/electron-ipc` - Type-safe IPC communication layer
  - `@ui-tars/sdk` - Cross-platform GUI automation SDK
  - `@ui-tars/shared` - Shared utilities and types
  - `@ui-tars/action-parser` - VLM action parsing engine
  - `@ui-tars/operator-*` - Computer and browser operators
  - `@ui-tars/utio` - Universal target interaction objects
- **packages/agent-infra/** - Agent infrastructure (MCP servers, search tools)
- **packages/common/** - Shared configurations (ESLint, TypeScript)

### Key Architectural Patterns

**Type-Safe IPC:** Uses `@ui-tars/electron-ipc` for end-to-end typed communication between main and renderer processes. Routes are defined in `apps/ui-tars/src/main/ipcRoutes/` and registered with `registerIpcMain()`.

**Operator Pattern:** The `@ui-tars/sdk` defines abstract `Operator` and `Model` classes. Operators handle screenshot/execute actions, Models handle VLM inference. Concrete implementations:
- `@ui-tars/operator-nut-js` - Local computer control via nut.js
- `@ui-tars/operator-browser` - Browser automation via Playwright

**Action Parsing:** The `@ui-tars/action-parser` converts VLM responses into structured actions (click, drag, type, etc.) with coordinate mapping.

**State Management:**
- Renderer: Zustand stores for runtime state
- Main: ElectronStore for persistent user settings (see `store/setting.ts`)

**HTTP API:** Built-in HTTP server (default port 9527) for remote control via REST API. See `services/httpServer.ts` for endpoints. Controlled by settings: `httpServerEnabled`, `httpServerPort`, `httpServerHost`, `httpServerApiKey`.

**Routes:** Main app routes are `/` (home), `/local` (local computer), `/free-remote` (remote operator), `/widget` (widget interface)

### Security Notes

- Private key protection via bytecode compilation (see `electron.vite.config.ts` - the `app_private` chunk alias)
- All files must include the copyright header: `Copyright (c) 2025 Bytedance, Inc. and its affiliates. SPDX-License-Identifier: Apache-2.0`

## File Naming Conventions

- `*.main.ts` - Main process specific files
- `*.renderer.tsx` - Renderer specific files
- `*.preload.ts` - Preload scripts
- Use `@main/`, `@renderer/`, `@preload/` path aliases for imports

## Testing

**Unit Tests:** Run `pnpm test` from root or `npm run test` in package directories. Coverage tracked via Vitest with Istanbul.

**E2E Tests:** Run `npm run test:e2e` in `apps/ui-tars`. Requires `npm run build:e2e` first.

## Build Outputs

- `dist/` - Vite build output (main, preload, renderer)
- `out/` - Electron Forge packaged application

## macOS Permissions

When running in development on macOS, ensure your terminal (iTerm2, Terminal) has these permissions:
- System Settings → Privacy & Security → Accessibility
- System Settings → Privacy & Security → Screen Recording

## HTTP API

The desktop app includes an HTTP server for remote control. Enable it via settings (`httpServerEnabled: true`).

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check, returns agent status |
| GET | `/status` | Get current agent state and message count |
| POST | `/run` | Start agent with instructions |
| POST | `/stop` | Stop running agent |

**Example usage:**
```bash
# Execute instruction
curl -X POST http://127.0.0.1:9527/run \
  -H "Content-Type: application/json" \
  -d '{"instructions": "Open Calculator app"}'

# With API key authentication
curl -X POST http://127.0.0.1:9527/run \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{"instructions": "Open Calculator app"}'
```
