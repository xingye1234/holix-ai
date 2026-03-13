import process from 'node:process'
import { ChatOpenAI } from '@langchain/openai'
import type { LlmConfig } from '../types'

/**
 * 创建 OpenAI LLM 适配器
 * 也支持 OpenAI 兼容的 API（智谱AI、DeepSeek、Moonshot、Qwen 等）
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
