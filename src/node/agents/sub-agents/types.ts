import type { ProviderType } from '@/share/models'

export interface BuiltinSubAgentModelConfig {
  provider: ProviderType
  model: string
  apiKey?: string
  baseURL?: string
}

export interface TitleFromQuestionInput {
  question: string
  modelConfig?: BuiltinSubAgentModelConfig
}

export interface TitleFromQuestionResult {
  title: string
  source: 'llm' | 'fallback'
}

export interface BuiltinSubAgentInputMap {
  'title-from-question': TitleFromQuestionInput
}

export interface BuiltinSubAgentOutputMap {
  'title-from-question': TitleFromQuestionResult
}

export type BuiltinSubAgentId = keyof BuiltinSubAgentInputMap

export interface BuiltinSubAgent<TId extends BuiltinSubAgentId = BuiltinSubAgentId> {
  id: TId
  description: string
  run: (input: BuiltinSubAgentInputMap[TId]) => Promise<BuiltinSubAgentOutputMap[TId]>
}

