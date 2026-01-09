import { resolve } from 'node:path'
import process from 'node:process'
import { createRouter } from '@holix/router'
import { createStaticMiddleware } from '@holix/static'
import { app, protocol } from 'electron'
import { initChat } from './chat/init'
import { SCHEME } from './constant'
import { migrateDb } from './database/connect'
import { createChannel } from './platform/channel'
import { onCommandForClient } from './platform/commands'
import { configStore } from './platform/config'
import { logger } from './platform/logger'
import { providerStore } from './platform/provider'
import { AppWindow } from './platform/window'
import { trpcRouter } from './server/handler'

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

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

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  logger.info(`Another instance is already running. Exiting this instance.`)
  app.quit()
}

const router = createRouter()
configStore.use(router)
providerStore.use(router)
onCommandForClient(router)
trpcRouter(router)
router.get('/channel', createChannel())

if (import.meta.env.PROD) {
  router.use(
    createStaticMiddleware({
      root: resolve(import.meta.dirname, '../client'),
      prefix: '/',
      ignorePaths: ['/api/**', '/channel/**', '/trpc/**', '/command/**', '/config/**', '/providers/**', '/window/**'],
    }),
  )
}

logger.info('Main application window created.')

let window: AppWindow | null = null

app.on('second-instance', () => {
  logger.info(
    'Second instance detected. Bringing the main window to the front.',
  )
  if (window?.isMinimized()) {
    window?.restore()
  }
  window?.focus()
})

async function bootstrap() {
  logger.info('Initializing application...')
  await app.whenReady()
  logger.info('App is ready.')
  initChat()
  logger.info('Chat module initialized.')
  await configStore.init()
  logger.info('Configuration store initialized.')
  await providerStore.init()
  logger.info('Provider store initialized.')

  logger.info('Creating application window...')
  try {
    window = new AppWindow()
    logger.info('Application window instance created.')
  }
  catch (err) {
    logger.error('Failed to create AppWindow:', err)
    throw err
  }

  logger.info('Registering protocol handler...')
  router.register(window.webContents.session.protocol)
  logger.info('Protocol handler registered.')

  logger.info('Registering window router...')
  window.use(router)
  logger.info('Window router registered.')

  logger.info('Showing window...')
  await window.showWhenReady()
  logger.info('Main window is shown.')
}

logger.info('Starting application...')
migrateDb().catch((err) => {
  logger.error('Database migration failed:', err)
  app.quit()
})
bootstrap().catch((err) => {
  logger.error('Failed to setup application:', err)
  logger.error('Error stack:', err.stack)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (AppWindow.getAllWindows().length === 0) {
    window = new AppWindow()
    window.use(router)
  }
})

app.on('before-quit', () => {
  logger.info('Application is quitting...')
})
