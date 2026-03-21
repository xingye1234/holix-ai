import type { UpdateInfo as ElectronUpdateInfo, ProgressInfo, UpdateDownloadedEvent } from 'electron-updater'
import { logger } from './logger'
import { update } from './update'

// eslint-disable-next-line ts/no-require-imports
const { autoUpdater }: typeof import('electron-updater') = require('electron-updater')

export function initAutoUpdater() {
  if (!import.meta.env.PROD) {
    logger.info('[AutoUpdate] Skipping init in non-PROD environment')
    return
  }

  try {
    // 配置 logger
    autoUpdater.logger = {
      info: (msg: any) => logger.info(`[autoUpdater] ${String(msg)}`),
      warn: (msg: any) => logger.warn(`[autoUpdater] ${String(msg)}`),
      error: (msg: any) => logger.error(`[autoUpdater] ${String(msg)}`),
    }

    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.autoDownload = true

    autoUpdater.on('checking-for-update', () => {
      logger.info('[AutoUpdate] Checking for updates...')
      update('update.checking-for-update', { info: {} })
    })

    autoUpdater.on('update-available', (info: ElectronUpdateInfo) => {
      update('update.available', { info })
    })

    autoUpdater.on('update-not-available', (info: any) => {
      update('update.not-available', { info })
    })

    autoUpdater.on('error', (err: any) => {
      update('update.error', { message: String(err) })
      logger.error('[AutoUpdate] error', err)
    })

    autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
      update('download.progress', { info: progressObj })
    })

    autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
      update('update.downloaded', { event })
    })

    logger.info('[AutoUpdate] Initialized')
  }
  catch (error) {
    logger.warn('[AutoUpdate] electron-updater not available or failed to init:', error)
  }
}

export function checkForUpdates() {
  autoUpdater.checkForUpdates()
}

export function installUpdateAndQuit() {
  autoUpdater.quitAndInstall()
}
