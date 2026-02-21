import type { AppWindow } from './window'
import { join } from 'node:path'
import process from 'node:process'
import { app, Menu, Tray } from 'electron'

let tray: Tray | null = null

export function setupAppTray(mainWindow: AppWindow | null) {
  if (tray)
    return

  const isMac = process.platform === 'darwin'

  // Determine the icon path based on the platform
  // On macOS, use tray.png (or trayTemplate.png if you want it to adapt to dark/light mode automatically)
  // On Windows/Linux, use logo.png
  const iconName = isMac ? 'iconTemplate.png' : 'logo.png'
  const iconPath = join(process.cwd(), 'public', iconName)

  tray = new Tray(iconPath)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          if (mainWindow.isMinimized())
            mainWindow.restore()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setToolTip(app.name)
  tray.setContextMenu(contextMenu)

  // Handle click events (especially for Windows)
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        if (mainWindow.isFocused()) {
          // Optional: minimize or hide if already focused
          // mainWindow.hide()
        }
        else {
          mainWindow.focus()
        }
      }
      else {
        mainWindow.show()
        if (mainWindow.isMinimized())
          mainWindow.restore()
        mainWindow.focus()
      }
    }
  })
}
