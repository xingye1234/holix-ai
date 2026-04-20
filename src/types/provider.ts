import type { ProviderType } from '@/share/models'

export interface AIProvider {
  name: string
  baseUrl: string
  apiKey: string
  apiType: ProviderType
  models: string[]
  temperature?: number
  maxTokens?: number
  enabled: boolean
  avatar: string
}
