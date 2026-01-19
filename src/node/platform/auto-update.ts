import type { UpdateInfo as ElectronUpdateInfo, ProgressInfo } from 'electron-updater'
import { app } from 'electron'
import {
  autoUpdater,
} from 'electron-updater'
import { sendChannelMessage } from './channel'
import { logger } from './logger'

export async function initAutoUpdater() {
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

    autoUpdater.autoDownload = true

    autoUpdater.on('checking-for-update', () => {
      sendChannelMessage({ type: 'auto-update', event: 'checking-for-update' })
    })

    autoUpdater.on('update-available', (info: ElectronUpdateInfo) => {
      sendChannelMessage({ type: 'auto-update', event: 'update-available', info })
    })

    autoUpdater.on('update-not-available', (info: any) => {
      sendChannelMessage({ type: 'auto-update', event: 'update-not-available', info })
    })

    autoUpdater.on('error', (err: any) => {
      sendChannelMessage({ type: 'auto-update', event: 'error', message: String(err) })
      logger.error('[AutoUpdate] error', err)
    })

    autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
      sendChannelMessage({ type: 'auto-update', event: 'download-progress', progress: progressObj })
    })

    autoUpdater.on('update-downloaded', (info: any) => {
      sendChannelMessage({ type: 'auto-update', event: 'update-downloaded', info })
    })

    // 在启动时进行一次检查（非强制）
    setTimeout(() => {
      try {
        autoUpdater.checkForUpdates().catch((e: any) => logger.error('[AutoUpdate] check failed', e))
      }
      catch (e) {
        logger.error('[AutoUpdate] checkForUpdates error', e)
      }
    }, 5_000)

    logger.info('[AutoUpdate] Initialized')
  }
  catch (error) {
    logger.warn('[AutoUpdate] electron-updater not available or failed to init:', error)
  }
}

export async function checkForUpdates() {
  if (!autoUpdater)
    return
  try {
    await autoUpdater.checkForUpdates()
  }
  catch (e) {
    logger.error('[AutoUpdate] checkForUpdates failed', e)
  }
}

export async function installUpdateAndQuit() {
  if (!autoUpdater)
    return
  try {
    // quitAndInstall may throw in some environments
    await autoUpdater.quitAndInstall()
    app.quit()
  }
  catch (e) {
    logger.error('[AutoUpdate] quitAndInstall failed', e)
  }
}
