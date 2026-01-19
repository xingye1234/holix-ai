import type { ConfigData } from '@/node/platform/config'
import { kyInstance } from './ky'

export async function getConfig() {
  return await kyInstance.get('config').json<ConfigData>()
}

export async function updateConfig<K extends keyof ConfigData>(key: K, value: ConfigData[K]) {
  return await kyInstance.post('config', { json: { key, value } }).json<ConfigData>()
}
