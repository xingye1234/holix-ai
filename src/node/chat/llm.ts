/**
 * @deprecated This file is deprecated. Please import from './llm/index' instead.
 * This file is kept for backward compatibility.
 */

export {
  createAnthropicAdapter,
  createGeminiAdapter,
  createOllamaAdapter,
  createOpenAIAdapter,
} from './llm/adapters'
export { createLlm } from './llm/factory'
// Re-export everything from the new modular structure
export type { LlmConfig, LlmProvider } from './llm/types'
