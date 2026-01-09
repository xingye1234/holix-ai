import type { HolixProtocolRouter } from '@holix/router'
import { join } from 'node:path'
import process from 'node:process'
import { BrowserWindow } from 'electron'
import { configStore } from './config'
import { logger } from './logger'
import { update } from './update'

const minWidth = 800
const minHeight = 540

const isMacOS = process.platform === 'darwin'

export class AppWindow extends BrowserWindow {
  constructor() {
    logger.info('AppWindow constructor started')
    logger.info('Getting window config from store...')
    const { width, height } = configStore.get('window')
    logger.info(`Window config retrieved: width=${width}, height=${height}`)

    // Get the logo path
    const logoPath = join(process.cwd(), 'public', 'logo.png')
    logger.info(`Logo path: ${logoPath}`)

    super({
      width,
      height,
      minWidth,
      minHeight,
      show: false,
      frame: import.meta.env.DEV,
      trafficLightPosition: { x: 10, y: 16 },
      icon: logoPath,
      titleBarStyle: isMacOS ? 'hiddenInset' : 'default',
    })

    this.on('resized', async () => {
      const [width, height] = this.getSize()
      await configStore.set('window', { width, height })
    })

    // Window state change events -> send updates to renderer via orchestrator.update
    this.on('minimize', () => {
      update('window.minimize', {})
    })

    this.on('maximize', () => {
      update('window.maximize', { maximized: true })
    })

    this.on('unmaximize', () => {
      update('window.maximize', { maximized: false })
    })

    this.on('close', () => {
      update('window.close', {})
    })

    logger.info('AppWindow constructor completed')
  }

  use(router: HolixProtocolRouter) {
    router.post('/window/:action', async (ctx, next) => {
      const action = ctx.params.action
      if (action === 'minimize') {
        this.minimize()
      }

      if (action === 'maximize') {
        if (this.isMaximized()) {
          this.unmaximize()
        }
        else {
          this.maximize()
        }
      }

      if (action === 'close') {
        this.close()
      }

      next()
    })
  }

  showWhenReady() {
    return new Promise<void>((resolve) => {
      // const currentChatId = configStore.get("currentChatId");

      const url = import.meta.env.DEV
        ? import.meta.env.BASE_URL
        : 'holix://app/'

      import.meta.env.DEV ? this.loadURL(url) : this.loadURL(url)

      this.webContents.openDevTools({ mode: 'right' })

      logger.info('Waiting for window to be ready to show...')

      this.once('ready-to-show', () => {
        logger.info('Window is ready to show. Displaying now.')
        this.show()
        resolve()
      })
    })
  }
}
