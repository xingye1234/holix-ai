/**
 * LLM 模块主入口
 * 提供统一的 LLM 创建接口
 */

// 导出类型
export type { LlmConfig, LlmProvider } from './types'

// 导出工厂函数（主要 API）
export { createLlm } from './factory'

// 导出各个适配器（高级用法）
export {
  createAnthropicAdapter,
  createOpenAIAdapter,
  createGeminiAdapter,
  createOllamaAdapter,
} from './adapters'
