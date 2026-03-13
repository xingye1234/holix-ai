/**
 * @deprecated This file is deprecated. Please import from './llm/index' instead.
 * This file is kept for backward compatibility.
 */

// Re-export everything from the new modular structure
export type { LlmConfig, LlmProvider } from './llm/types'
export { createLlm } from './llm/factory'
export {
  createAnthropicAdapter,
  createOpenAIAdapter,
  createGeminiAdapter,
  createOllamaAdapter,
} from './llm/adapters'
