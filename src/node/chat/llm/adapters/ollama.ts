import process from 'node:process'
import { ChatOllama } from '@langchain/ollama'
import type { LlmConfig } from '../types'

/**
 * 创建 Ollama LLM 适配器
 * Ollama 通常运行在本地
 */
export function createOllamaAdapter(model: string, config?: LlmConfig) {
  return new ChatOllama({
    model,
    temperature: config?.temperature ?? 0.7,
    numCtx: config?.maxTokens,
    baseUrl: config?.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  })
}
