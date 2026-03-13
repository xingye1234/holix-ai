/**
 * LLM 配置接口
 */
export interface LlmConfig {
  /** API Key */
  apiKey?: string
  /** Base URL for API endpoint */
  baseURL?: string
  /** Temperature (0-1) */
  temperature?: number
  /** Max tokens to generate */
  maxTokens?: number
  /** Enable streaming */
  streaming?: boolean
  /** Provider name (optional, will be inferred if not provided) */
  provider?: string
}

/**
 * 支持的 LLM 提供商
 */
export type LlmProvider =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'ollama'
  | 'zhipu'
  | '智谱ai'
  | 'deepseek'
  | 'moonshot'
  | 'qwen'
  | '阿里云百炼'
