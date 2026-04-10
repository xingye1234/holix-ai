import { resolve } from 'node:path'
import process from 'node:process'
// 启用 source map 支持
import 'source-map-support/register'
import { createRouter } from '@holix/router'
import { createStaticMiddleware } from '@holix/static'
import { Effect } from 'effect'
import { app, protocol, shell } from 'electron'
import { agents } from './agents'
import { initializeLifecycleAgents } from './agents/lifecycle/bootstrap'
import { initChat } from './chat/init'
import { SCHEME } from './constant'
import { migrateDb } from './database/connect'
import { initAutoUpdater } from './platform/auto-update'
import { onChannelRouter } from './platform/channel'
import { onCommandForClient } from './platform/commands'
import { configStore } from './platform/config'
import type { LifecycleTask } from './platform/lifecycle-effect'
import { LifecyclePhase, LifecycleTag, LifecycleLayer } from './platform/lifecycle-effect'
import { logger } from './platform/logger'
import { markMainLogRendererReady } from './platform/main-log-forwarder'
import { mcpStore } from './platform/mcp'
import { setupAppMenu } from './platform/menu'
import { providerStore } from './platform/provider'
import { setupAppTray } from './platform/tray'
import { onUpdateWaitResponse } from './platform/update'
import { AppWindow, setIsQuitting } from './platform/window'
import { trpcRouter } from './server/handler'

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  logger.info('Another instance is already running. Exiting this instance.')
  app.quit()
}

// 路由器配置
const router = createRouter()
configStore.use(router)
providerStore.use(router)
mcpStore.use(router)
onCommandForClient(router)
onUpdateWaitResponse(router)
onChannelRouter(router)
trpcRouter(router)

// 生产环境静态文件服务
if (import.meta.env.PROD) {
  router.use(
    createStaticMiddleware({
      root: resolve(import.meta.dirname, '../client'),
      prefix: '/',
      ignorePaths: ['/api/**', '/channel/**', '/trpc/**', '/command/**', '/config/**', '/providers/**', '/mcp/**', '/window/**'],
    }),
  )
}

// ============================================
// 状态管理
// ============================================
let window: AppWindow | null = null
let protocolRegistered = false
let creatingWindow = false

// ============================================
// 生命周期钩子（在 Layer 外注册）
// ============================================

function registerLifecycleHooks(lifecycle: typeof LifecycleTag.Service) {
  Effect.runPromise(
    Effect.gen(function* () {
      yield* lifecycle.onPhase(LifecyclePhase.RUNNING, () => {
        logger.info('[Lifecycle Hook] Application is now running')
      })
      yield* lifecycle.onPhase(LifecyclePhase.STOPPING, () => {
        logger.info('[Lifecycle Hook] Application is stopping')
      })
      yield* lifecycle.onPhase(LifecyclePhase.ERROR, () => {
        logger.error('[Lifecycle Hook] Application entered error state')
      })
    }),
  )
}

// ============================================
// 应用启动任务定义
// ============================================

function createInitTasks(): LifecycleTask[] {
  return [
    {
      name: 'Register custom protocol',
      execute: () => Effect.gen(function* () {
        protocol.registerSchemesAsPrivileged([
          {
            scheme: SCHEME,
            privileges: {
              standard: true,
              secure: true,
              supportFetchAPI: true,
              corsEnabled: true,
              allowServiceWorkers: true,
            },
          },
        ])
        logger.info('[Main] Custom protocol registered successfully.')
      }),
    },
    {
      name: 'Wait for Electron ready',
      execute: () => Effect.gen(function* () {
        yield* Effect.promise(() => app.whenReady())
        setupAppMenu()
      }),
      timeout: '10 seconds',
    },
    {
      name: 'Migrate database',
      execute: () => Effect.tryPromise({
        try: () => migrateDb(),
        catch: e => e,
      }),
      timeout: '5 seconds',
    },
    {
      name: 'Initialize chat module',
      execute: () => Effect.sync(() => initChat()),
    },
    {
      name: 'Initialize config store',
      execute: () => Effect.gen(function* () {
        yield* Effect.promise(() => configStore.init())
        app.setLoginItemSettings({ openAtLogin: configStore.get('autoStart') })
      }),
      timeout: '3 seconds',
    },
    {
      name: 'Initialize provider store',
      execute: () => Effect.tryPromise({
        try: () => providerStore.init(),
        catch: e => e,
      }),
      timeout: '3 seconds',
    },
    {
      name: 'Initialize MCP store',
      execute: () => Effect.tryPromise({
        try: () => mcpStore.init(),
        catch: e => e,
      }),
      timeout: '3 seconds',
    },
    {
      name: 'Initialize agents',
      execute: () => Effect.tryPromise({
        try: () => agents.init(),
        catch: e => e,
      }),
      timeout: '3 seconds',
    },
    {
      name: 'Initialize lifecycle agents',
      execute: () => Effect.sync(() => initializeLifecycleAgents()),
    },
  ]
}

function createStartingTasks(): LifecycleTask[] {
  return [
    {
      name: 'Create application window',
      execute: () => Effect.gen(function* () {
        if (!window) {
          window = new AppWindow()
          window.webContents.once('dom-ready', () => {
            markMainLogRendererReady()
          })
          window.on('closed', () => {
            window = null
          })
        }
      }),
    },
    {
      name: 'Register protocol handler',
      execute: () => Effect.sync(() => {
        if (window && !protocolRegistered) {
          router.register(window.webContents.session.protocol)
          protocolRegistered = true
        }
      }),
    },
    {
      name: 'Register window router',
      execute: () => Effect.sync(() => {
        if (window) {
          window.use(router)
        }
      }),
    },
    {
      name: 'Setup application tray',
      execute: () => Effect.sync(() => setupAppTray(window)),
    },
    {
      name: 'Show application window',
      execute: () => Effect.gen(function* () {
        if (window) {
          yield* Effect.promise(() => window!.showWhenReady())
        }
      }),
      timeout: '10 seconds',
    },
  ]
}

// ============================================
// 启动流程 (STARTING phase — 可重入，用于 activate)
// ============================================

async function starting(lifecycle: typeof LifecycleTag.Service) {
  if (creatingWindow)
    return
  creatingWindow = true

  try {
    await Effect.runPromise(
      lifecycle.executeTasks(createStartingTasks()).pipe(
        Effect.tap(() => lifecycle.setPhase(LifecyclePhase.RUNNING)),
      ),
    )
  }
  finally {
    creatingWindow = false
  }
}

// ============================================
// Bootstrap Effect
// ============================================

const bootstrap = Effect.gen(function* () {
  const lifecycle = yield* LifecycleTag

  // 注册生命周期钩子
  registerLifecycleHooks(lifecycle)

  // Phase 1: INITIALIZING
  yield* lifecycle.setPhase(LifecyclePhase.INITIALIZING)
  yield* lifecycle.executeTasks(createInitTasks())

  // 非关键任务: autoUpdater
  yield* Effect.sync(() => initAutoUpdater()).pipe(
    Effect.catchAll(() => Effect.sync(() => {
      logger.warn('[Bootstrap] AutoUpdater init skipped')
    })),
  )

  // Phase 2: STARTING
  yield* lifecycle.setPhase(LifecyclePhase.STARTING)
  yield* lifecycle.executeTasks(createStartingTasks())

  yield* lifecycle.setPhase(LifecyclePhase.RUNNING)

  return lifecycle
}).pipe(
  Effect.tapError(error =>
    Effect.gen(function* () {
      const lifecycle = yield* LifecycleTag
      yield* lifecycle.setPhase(LifecyclePhase.ERROR)
      logger.error('[Bootstrap] Fatal error during startup:', error)
      logger.error('[Bootstrap] Error stack:', error instanceof Error ? error.stack : String(error))
      yield* lifecycle.printPerformanceSummary()
      app.quit()
    }),
  ),
  Effect.provide(LifecycleLayer),
)

// ============================================
// 启动应用
// ============================================
logger.info('[Main] Starting Holix AI application...')

const lifecyclePromise = Effect.runPromise(bootstrap).catch((err) => {
  logger.error('[Main] Bootstrap failed:', err)
  process.exit(1)
})

// ============================================
// Electron 事件
// ============================================

app.on('second-instance', () => {
  logger.info('Second instance detected. Bringing the main window to the front.')
  if (window?.isMinimized()) {
    window?.restore()
  }
  window?.focus()
})

app.on('window-all-closed', async () => {
  if (process.platform === 'darwin') {
    return
  }
  const lifecycle = await lifecyclePromise
  await Effect.runPromise(lifecycle.setPhase(LifecyclePhase.STOPPING))
  app.quit()
})

app.on('activate', async () => {
  const lifecycle = await lifecyclePromise
  const phase = await Effect.runPromise(lifecycle.getPhase())
  logger.info('[Main] Application activated', phase, AppWindow.getAllWindows().length)

  if (phase === LifecyclePhase.RUNNING) {
    // 优先信任内部 window 引用，避免 getAllWindows() 在某些情况下返回 0 导致误判
    if (window && !window.isDestroyed()) {
      if (!window.isVisible()) {
        window.show()
        logger.info('[Main] Window was hidden, now showing.')
      }
      else {
        window.focus()
        logger.info('[Main] Window is already visible, focusing.')
      }
      return
    }

    // 只有窗口真正不存在时才重建
    starting(lifecycle)
      .then(() => {
        logger.info('[Main] Application activated and window created.')
      })
      .catch((err) => {
        logger.error('[Main] Failed to activate application:', err)
      })
  }
})

app.on('before-quit', async () => {
  setIsQuitting(true)
  try {
    const lifecycle = await lifecyclePromise
    await Effect.runPromise(lifecycle.setPhase(LifecyclePhase.STOPPING))
    logger.info('[Main] Application is quitting...')
    await Effect.runPromise(lifecycle.printPerformanceSummary())
  }
  catch {
    // lifecycle may not have been created if bootstrap failed
  }
})

app.on('will-quit', async () => {
  try {
    const lifecycle = await lifecyclePromise
    await Effect.runPromise(lifecycle.setPhase(LifecyclePhase.STOPPED))
    logger.info('[Main] Application stopped')
  }
  catch {
    // ignore
  }
})

if (import.meta.env.PROD) {
  app.on('web-contents-created', (_, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http')) {
        shell.openExternal(url)
        return { action: 'deny' }
      }
      return { action: 'allow' }
    })

    contents.on('will-navigate', (event, url) => {
      if (url.startsWith('http') || url.startsWith('https')) {
        event.preventDefault()
        shell.openExternal(url)
      }
    })
  })
}

process.on('uncaughtException', (error) => {
  logger.error('[Main] Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason) => {
  logger.error('[Main] Unhandled Rejection:', reason)
})
