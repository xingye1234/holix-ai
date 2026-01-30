import { Store } from './store'

export interface ConfigData {
  window: {
    width: number
    height: number
  }
  theme: string
  currentChatId?: string
  context7ApiKey?: string
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
      },
    })
  }
}

export const configStore = new Config()
