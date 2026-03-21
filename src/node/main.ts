import { resolve } from 'node:path'
import process from 'node:process'
// 启用 source map 支持
import 'source-map-support/register'
import { createRouter } from '@holix/router'
import { createStaticMiddleware } from '@holix/static'
import { app, protocol, shell } from 'electron'
import { initChat } from './chat/init'
import { SCHEME } from './constant'
import { migrateDb } from './database/connect'
import { initAutoUpdater } from './platform/auto-update'
import { onChannelRouter } from './platform/channel'
import { onCommandForClient } from './platform/commands'
import { configStore } from './platform/config'
import { AppLifecycle, LifecyclePhase } from './platform/lifecycle'
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
// 生命周期管理器
// ============================================
const lifecycle = new AppLifecycle()
let window: AppWindow | null = null
let protocolRegistered = false
let creatingWindow = false
// ============================================
// 生命周期钩子
// ============================================
lifecycle.onPhase(LifecyclePhase.RUNNING, () => {
  logger.info('[Lifecycle Hook] Application is now running')
})

lifecycle.onPhase(LifecyclePhase.STOPPING, () => {
  logger.info('[Lifecycle Hook] Application is stopping')
})

lifecycle.onPhase(LifecyclePhase.ERROR, () => {
  logger.error('[Lifecycle Hook] Application entered error state')
})

async function starting() {
  if (creatingWindow)
    return
  creatingWindow = true
  // ============================================
  // 阶段 2: 启动应用
  // ============================================
  await lifecycle.setPhase(LifecyclePhase.STARTING)
  await lifecycle.executeTasks([
    {
      name: 'Create application window',
      execute: () => {
        if (!window) {
          window = new AppWindow()
          window.webContents.once('dom-ready', () => {
            markMainLogRendererReady()
          })
          window.on('closed', () => {
            window = null
          })
        }
      },
      critical: true,
    },
    {
      name: 'Register protocol handler',
      execute: () => {
        if (window && !protocolRegistered) {
          router.register(window.webContents.session.protocol)
          protocolRegistered = true
        }
      },
      critical: true,
    },
    {
      name: 'Register window router',
      execute: () => {
        if (window) {
          window.use(router)
        }
      },
      critical: true,
    },
    {
      name: 'Setup application tray',
      execute: () => {
        setupAppTray(window)
      },
      critical: false,
    },
    {
      name: 'Show application window',
      execute: async () => {
        if (window) {
          await window.showWhenReady()
        }
      },
      critical: true,
      timeout: 10000,
    },
  ])
  await lifecycle.setPhase(LifecyclePhase.RUNNING)
}

// ============================================
// 应用启动流程
// ============================================
async function bootstrap() {
  try {
    // ============================================
    // 阶段 1: 初始化系统
    // ============================================
    await lifecycle.setPhase(LifecyclePhase.INITIALIZING)
    await lifecycle.executeTasks([
      {
        name: 'Register custom protocol',
        execute: async () => {
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
        },
      },
      {
        name: 'Wait for Electron ready',
        execute: async () => {
          await app.whenReady()
          setupAppMenu()
        },
        critical: true,
        timeout: 10000,
      },
      {
        name: 'Migrate database',
        execute: () => migrateDb(),
        critical: true,
        timeout: 5000,
      },
      {
        name: 'Initialize chat module',
        execute: () => initChat(),
        critical: true,
      },
      {
        name: 'Initialize config store',
        execute: async () => {
          await configStore.init()
          // 应用开机自启动设置
          app.setLoginItemSettings({ openAtLogin: configStore.get('autoStart') })
        },
        critical: true,
        timeout: 3000,
      },
      {
        name: 'Initialize provider store',
        execute: () => providerStore.init(),
        critical: true,
        timeout: 3000,
      },
      {
        name: 'Initialize MCP store',
        execute: () => mcpStore.init(),
        critical: true,
        timeout: 3000,
      },
      {
        name: 'init autoUpdater',
        execute: () => {
          initAutoUpdater()
        },
        critical: false,
        timeout: 5000,
      },
    ])
    await starting()
    // 初始化自动更新（生产环境）
    try {
      initAutoUpdater()
    }
    catch (e) {
      logger.warn('[Main] initAutoUpdater failed', e)
    }
  }
  catch (error) {
    await lifecycle.setPhase(LifecyclePhase.ERROR)
    logger.error('[Bootstrap] Fatal error during startup:', error)
    logger.error('[Bootstrap] Error stack:', (error as Error).stack)
    // 打印错误时的性能报告摘要
    lifecycle.printPerformanceSummary()

    app.quit()
    throw error
  }
}

// ============================================
// 启动应用
// ============================================
logger.info('[Main] Starting Holix AI application...')
bootstrap().catch((err) => {
  logger.error('[Main] Bootstrap failed:', err)
  process.exit(1)
})

app.on('second-instance', () => {
  logger.info('Second instance detected. Bringing the main window to the front.')
  if (window?.isMinimized()) {
    window?.restore()
  }
  window?.focus()
})

app.on('window-all-closed', async () => {
  // macOS: 即使所有窗口关闭，应用也不退出（符合 macOS 应用习惯）
  if (process.platform === 'darwin') {
    return
  }

  // 其他平台：所有窗口关闭时退出应用
  await lifecycle.setPhase(LifecyclePhase.STOPPING)
  app.quit()
})

app.on('activate', () => {
  logger.info('[Main] Application activated', lifecycle.getPhase(), AppWindow.getAllWindows().length)

  if (lifecycle.getPhase() === LifecyclePhase.RUNNING) {
    // 如果有窗口但被隐藏了，显示它
    if (window && !window.isVisible()) {
      window.show()
      logger.info('[Main] Window was hidden, now showing.')
      return
    }

    // 如果没有窗口，创建新窗口
    if (AppWindow.getAllWindows().length === 0) {
      starting()
        .then(() => {
          logger.info('[Main] Application activated and window created.')
        })
        .catch((err) => {
          logger.error('[Main] Failed to activate application:', err)
        })
    }
  }
})

app.on('before-quit', async () => {
  setIsQuitting(true)
  await lifecycle.setPhase(LifecyclePhase.STOPPING)
  logger.info('[Main] Application is quitting...')
  lifecycle.printPerformanceSummary()
})

app.on('will-quit', async () => {
  await lifecycle.setPhase(LifecyclePhase.STOPPED)
  logger.info('[Main] Application stopped')
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
