import type { trpcClient } from '@/lib/trpc-client'

export interface SkillConfigField {
  key: string
  type: 'string' | 'number' | 'boolean' | 'password' | 'select'
  label: string
  description?: string
  default?: unknown
  required?: boolean
  secret?: boolean
  options?: Array<{ value: string, label: string }>
}

export type Skill = Awaited<ReturnType<typeof trpcClient.skill.list>>[number]
export type ExternalSkillSource = Awaited<ReturnType<typeof trpcClient.skill.externalSources>>[number]
export type ConfigData = Awaited<ReturnType<typeof import('@/lib/config').getConfig>>

export interface StoreSkillItem {
  id: string
  name: string
  desc: string
  category: string
}
