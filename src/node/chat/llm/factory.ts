import type { LlmConfig, LlmProvider } from './types'
import { inferProvider } from '../../../share/models'
import {
  createAnthropicAdapter,
  createGeminiAdapter,
  createOllamaAdapter,
  createOpenAIAdapter,
} from './adapters'
import { createCustomProviderModel } from './providers'

/**
 * 创建 LLM 实例的工厂函数
 * 根据模型名称和配置自动选择合适的适配器
 */
export function createLlm(model: string, config?: LlmConfig) {
  const provider = (config?.provider?.toLowerCase() || inferProvider(model)) as LlmProvider

  if (!provider) {
    throw new Error(`Cannot infer provider for model: ${model}`)
  }

  // Anthropic
  if (provider === 'anthropic') {
    return createAnthropicAdapter(model, config)
  }

  // Google Gemini
  if (provider === 'gemini') {
    return createGeminiAdapter(model, config)
  }

  // Ollama (本地)
  if (provider === 'ollama') {
    return createOllamaAdapter(model, config)
  }

  const customProviderModel = createCustomProviderModel(model, {
    ...config,
    provider,
  })

  if (customProviderModel) {
    return customProviderModel
  }

  // OpenAI 兼容接口（智谱AI、DeepSeek、Moonshot、Qwen 等）
  if (
    provider === 'zhipu'
    || provider === 'deepseek'
    || provider === 'moonshot'
    || provider === 'qwen'
    || provider === 'openai'
  ) {
    return createOpenAIAdapter(model, config)
  }

  // 默认使用 OpenAI 适配器
  return createOpenAIAdapter(model, config)
}
