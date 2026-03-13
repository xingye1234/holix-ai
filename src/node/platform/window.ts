import type { HolixProtocolRouter } from '@holix/router'
import { join } from 'node:path'
import process from 'node:process'
import { app, BrowserWindow, shell } from 'electron'
import { checkForUpdates, installUpdateAndQuit } from './auto-update'
import { configStore } from './config'
import { logger } from './logger'
import { update } from './update'

// 标记是否正在退出（用于区分关闭到托盘和真正退出）
export let isQuitting = false
export function setIsQuitting(val: boolean) {
  isQuitting = val
}

const minWidth = 800
const minHeight = 540

const isMacOS = process.platform === 'darwin'

export class AppWindow extends BrowserWindow {
  constructor() {
    const { width, height } = configStore.get('window')

    // Get the logo path
    const logoPath = join(process.cwd(), 'public', 'logo.png')

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
      if (configStore.get('minimizeToTray')) {
        this.hide()
        return
      }
      update('window.minimize', {})
    })

    this.on('maximize', () => {
      update('window.maximize', { maximized: true })
    })

    this.on('unmaximize', () => {
      update('window.maximize', { maximized: false })
    })

    this.on('close', (event) => {
      // macOS: 红色按钮只关闭窗口，不退出应用
      if (isMacOS && !isQuitting) {
        event.preventDefault()
        this.hide()
        return
      }

      // 其他平台：根据 closeToTray 配置决定行为
      if (!isQuitting && configStore.get('closeToTray')) {
        event.preventDefault()
        this.hide()
        return
      }
      update('window.close', {})
    })
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

      if (action === 'devtools') {
        if (this.webContents.isDevToolsOpened()) {
          this.webContents.closeDevTools()
        }
        else {
          this.webContents.openDevTools()
        }
      }

      if (action === 'check-update') {
        checkForUpdates()
      }

      if (action === 'install-update') {
        installUpdateAndQuit()
      }

      if (action === 'open-external') {
        const body = await ctx.req.json().catch(() => null)
        if (body?.url) {
          shell.openExternal(body.url)
        }
      }

      next()
    })

    router.get('/window/version', async (ctx, next) => {
      ctx.json({ version: app.getVersion() })
      next()
    })
  }

  showWhenReady() {
    return new Promise<void>((resolve) => {
      const url = import.meta.env.DEV
        ? import.meta.env.BASE_URL
        : 'holix://app/'

      import.meta.env.DEV ? this.loadURL(url) : this.loadURL(url)

      this.once('ready-to-show', () => {
        logger.info('[Window] Ready to show, displaying now')
        this.show()
        resolve()
      })
    })
  }
}
