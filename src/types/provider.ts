import type { ProviderType } from '@/share/models'

export interface AIProvider {
  name: string
  baseUrl: string
  apiKey: string
  apiType: ProviderType
  models: string[]
  enabled: boolean
  avatar: string
}
