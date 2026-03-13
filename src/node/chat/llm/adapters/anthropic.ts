import process from 'node:process'
import { ChatAnthropic } from '@langchain/anthropic'
import type { LlmConfig } from '../types'

/**
 * 创建 Anthropic LLM 适配器
 */
export function createAnthropicAdapter(model: string, config?: LlmConfig) {
  return new ChatAnthropic({
    modelName: model,
    temperature: config?.temperature ?? 0.7,
    maxTokens: config?.maxTokens,
    apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
    clientOptions: {
      baseURL: config?.baseURL || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    },
  })
}
