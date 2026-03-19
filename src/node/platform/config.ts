import { app } from 'electron'
import { Store } from './store'

export interface ConfigData {
  window: {
    width: number
    height: number
  }
  theme: string
  currentChatId?: string
  context7ApiKey?: string
  autoStart: boolean
  minimizeToTray: boolean
  closeToTray: boolean
  skillsContextStrategy: 'eager' | 'lazy'
  disabledSkills: string[]
}

export class Config extends Store<ConfigData> {
  constructor() {
    super({
      name: 'config',
      defaultData: {
        window: {
          width: 1280,
          height: 800,
        },
        theme: 'system',
        currentChatId: undefined,
        context7ApiKey: '',
        autoStart: false,
        minimizeToTray: true,
        closeToTray: true,
        skillsContextStrategy: 'eager',
        disabledSkills: [],
      },
    })
  }

  mutate<K extends keyof ConfigData>(key: K, value: ConfigData[K]) {
    const result = super.mutate(key, value)
    if (key === 'autoStart') {
      app.setLoginItemSettings({ openAtLogin: value as boolean })
    }
    return result
  }
}

export const configStore = new Config()
