import type { LlmConfig } from '../types'
import process from 'node:process'
import { ChatOpenAI } from '@langchain/openai'

/**
 * 创建 OpenAI LLM 适配器
 * 默认用于官方 OpenAI 以及标准兼容接口
 */
export function createOpenAIAdapter(model: string, config?: LlmConfig) {
  return new ChatOpenAI({
    modelName: model,
    temperature: config?.temperature ?? 0.7,
    maxTokens: config?.maxTokens,
    streaming: config?.streaming ?? true,
    apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: config?.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    },
  })
}
