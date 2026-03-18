import type { LlmConfig } from '../types'
import process from 'node:process'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'

/**
 * 创建 Google Gemini LLM 适配器
 */
export function createGeminiAdapter(model: string, config?: LlmConfig) {
  return new ChatGoogleGenerativeAI({
    model,
    temperature: config?.temperature ?? 0.7,
    maxOutputTokens: config?.maxTokens,
    apiKey: config?.apiKey || process.env.GOOGLE_API_KEY,
    baseUrl: config?.baseURL || process.env.GOOGLE_BASE_URL,
  })
}
