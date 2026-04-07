import type { LlmConfig } from '../types'
import process from 'node:process'
import { ChatOllama } from '@langchain/ollama'
import { buildOllamaHeaders, normalizeOllamaBaseUrl } from '../../../platform/ollama'

/**
 * 创建 Ollama LLM 适配器
 * Ollama 通常运行在本地
 */
export function createOllamaAdapter(model: string, config?: LlmConfig) {
  const headers = buildOllamaHeaders(config?.apiKey)

  return new ChatOllama({
    model,
    temperature: config?.temperature ?? 0.7,
    numCtx: config?.maxTokens,
    baseUrl: normalizeOllamaBaseUrl(config?.baseURL || process.env.OLLAMA_BASE_URL),
    ...(headers ? { headers } : {}),
  })
}
