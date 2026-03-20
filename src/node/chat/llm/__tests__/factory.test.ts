/* eslint-disable import/first */
/**
 * LLM Factory 单元测试
 * 测试 createLlm 工厂函数的提供商选择和适配器创建逻辑
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================
// Hoisted Mocks (must be before imports)
// ============================================

const mockCreateAnthropicAdapter = vi.hoisted(() => vi.fn())
const mockCreateGeminiAdapter = vi.hoisted(() => vi.fn())
const mockCreateOllamaAdapter = vi.hoisted(() => vi.fn())
const mockCreateOpenAIAdapter = vi.hoisted(() => vi.fn())

// ============================================
// Module Mocks (must be before imports)
// ============================================

vi.mock('../adapters', () => ({
  createAnthropicAdapter: mockCreateAnthropicAdapter,
  createGeminiAdapter: mockCreateGeminiAdapter,
  createOllamaAdapter: mockCreateOllamaAdapter,
  createOpenAIAdapter: mockCreateOpenAIAdapter,
}))

// Mock LangChain classes to avoid actual API calls
vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => ({
    _modelType: 'anthropic',
  })),
}))

vi.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    _modelType: 'gemini',
  })),
}))

vi.mock('@langchain/ollama', () => ({
  ChatOllama: vi.fn().mockImplementation(() => ({
    _modelType: 'ollama',
  })),
}))

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    _modelType: 'openai',
  })),
}))

// ============================================
// Import after mocks
// ============================================

import { createLlm } from '../factory'

describe('createLmm', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock implementations
    mockCreateAnthropicAdapter.mockImplementation((model: string) => ({
      _modelType: 'anthropic',
      modelName: model,
    }))
    mockCreateGeminiAdapter.mockImplementation((model: string) => ({
      _modelType: 'gemini',
      modelName: model,
    }))
    mockCreateOllamaAdapter.mockImplementation((model: string) => ({
      _modelType: 'ollama',
      modelName: model,
    }))
    mockCreateOpenAIAdapter.mockImplementation((model: string) => ({
      _modelType: 'openai',
      modelName: model,
    }))
  })

  describe('Anthropic Provider', () => {
    it('should create Anthropic adapter for claude-3-opus', () => {
      const result = createLlm('claude-3-opus')
      expect(result._modelType).toBe('anthropic')
      expect(mockCreateAnthropicAdapter).toHaveBeenCalledWith('claude-3-opus', undefined)
    })

    it('should create Anthropic adapter for claude-3.5-sonnet', () => {
      const result = createLlm('claude-3.5-sonnet')
      expect(result._modelType).toBe('anthropic')
      expect(mockCreateAnthropicAdapter).toHaveBeenCalledWith('claude-3.5-sonnet', undefined)
    })

    it('should create Anthropic adapter with explicit provider config', () => {
      const config = { apiKey: 'test-key', provider: 'anthropic' }
      const result = createLlm('claude-3-opus', config)
      expect(result._modelType).toBe('anthropic')
      expect(mockCreateAnthropicAdapter).toHaveBeenCalledWith('claude-3-opus', config)
    })

    it('should handle case-insensitive provider name', () => {
      const result = createLlm('claude-3-opus', { provider: 'ANTHROPIC' })
      expect(result._modelType).toBe('anthropic')
      expect(mockCreateAnthropicAdapter).toHaveBeenCalled()
    })
  })

  describe('OpenAI Provider', () => {
    it('should create OpenAI adapter for gpt-4', () => {
      const result = createLlm('gpt-4')
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalledWith('gpt-4', undefined)
    })

    it('should create OpenAI adapter for gpt-3.5-turbo', () => {
      const result = createLlm('gpt-3.5-turbo')
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalledWith('gpt-3.5-turbo', undefined)
    })

    it('should create OpenAI adapter for o1 models', () => {
      const result = createLlm('o1-preview')
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalledWith('o1-preview', undefined)
    })

    it('should create OpenAI adapter with explicit provider config', () => {
      const config = { apiKey: 'test-key', provider: 'openai' }
      const result = createLlm('gpt-4', config)
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalledWith('gpt-4', config)
    })
  })

  describe('Gemini Provider', () => {
    it('should create Gemini adapter for gemini-1.5-pro', () => {
      const result = createLlm('gemini-1.5-pro')
      expect(result._modelType).toBe('gemini')
      expect(mockCreateGeminiAdapter).toHaveBeenCalledWith('gemini-1.5-pro', undefined)
    })

    it('should create Gemini adapter for gemini-2.0-flash', () => {
      const result = createLlm('gemini-2.0-flash')
      expect(result._modelType).toBe('gemini')
      expect(mockCreateGeminiAdapter).toHaveBeenCalledWith('gemini-2.0-flash', undefined)
    })

    it('should create Gemini adapter with explicit provider config', () => {
      const config = { apiKey: 'test-key', provider: 'gemini' }
      const result = createLlm('gemini-1.5-pro', config)
      expect(result._modelType).toBe('gemini')
      expect(mockCreateGeminiAdapter).toHaveBeenCalledWith('gemini-1.5-pro', config)
    })
  })

  describe('Ollama Provider', () => {
    it('should create Ollama adapter for llama3', () => {
      const result = createLlm('llama3', { provider: 'ollama' })
      expect(result._modelType).toBe('ollama')
      expect(mockCreateOllamaAdapter).toHaveBeenCalledWith('llama3', { provider: 'ollama' })
    })

    it('should create Ollama adapter for mistral', () => {
      const result = createLlm('mistral')
      expect(result._modelType).toBe('ollama')
      expect(mockCreateOllamaAdapter).toHaveBeenCalledWith('mistral', undefined)
    })

    it('should create Ollama adapter with explicit provider config', () => {
      const config = { baseURL: 'http://localhost:11434', provider: 'ollama' }
      const result = createLlm('llama3', config)
      expect(result._modelType).toBe('ollama')
      expect(mockCreateOllamaAdapter).toHaveBeenCalledWith('llama3', config)
    })
  })

  describe('OpenAI-Compatible Providers', () => {
    it('should create OpenAI adapter for zhipu models', () => {
      const result = createLlm('glm-4')
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalledWith('glm-4', undefined)
    })

    it('should create OpenAI adapter for deepseek models', () => {
      const result = createLlm('deepseek-chat')
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalledWith('deepseek-chat', undefined)
    })

    it('should create OpenAI adapter for moonshot models', () => {
      const result = createLlm('moonshot-v1-8k')
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalledWith('moonshot-v1-8k', undefined)
    })

    it('should create OpenAI adapter for qwen models', () => {
      const result = createLlm('qwen-turbo')
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalledWith('qwen-turbo', undefined)
    })
  })

  describe('Config Handling', () => {
    it('should pass config to adapter', () => {
      const config = {
        apiKey: 'test-api-key',
        temperature: 0.5,
        maxTokens: 2000,
        baseURL: 'https://custom.api.com',
      }
      const result = createLlm('gpt-4', config)
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalledWith('gpt-4', config)
    })

    it('should handle empty config', () => {
      const result = createLlm('claude-3-opus', {})
      expect(result._modelType).toBe('anthropic')
      expect(mockCreateAnthropicAdapter).toHaveBeenCalledWith('claude-3-opus', {})
    })

    it('should handle undefined config', () => {
      const result = createLlm('claude-3-opus', undefined)
      expect(result._modelType).toBe('anthropic')
      expect(mockCreateAnthropicAdapter).toHaveBeenCalledWith('claude-3-opus', undefined)
    })
  })

  describe('Error Handling', () => {
    it('should throw error for unknown model without provider', () => {
      expect(() => createLlm('unknown-model')).toThrowError(
        'Cannot infer provider for model: unknown-model',
      )
    })

    it('should not throw error when provider is explicitly set', () => {
      const result = createLlm('unknown-model', { provider: 'openai' })
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalledWith('unknown-model', { provider: 'openai' })
    })

    it('should use explicit provider over inferred provider', () => {
      // gemini-1.5-pro would normally be inferred as gemini
      const result = createLlm('gemini-1.5-pro', { provider: 'openai' })
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalled()
      expect(mockCreateGeminiAdapter).not.toHaveBeenCalled()
    })
  })

  describe('Fallback Behavior', () => {
    it('should default to OpenAI adapter for unhandled provider', () => {
      // This test ensures that if a provider is added to inferProvider but
      // not handled in createLlm, it falls back to OpenAI adapter
      const result = createLlm('some-model', { provider: 'unknown-provider' as any })
      expect(result._modelType).toBe('openai')
      expect(mockCreateOpenAIAdapter).toHaveBeenCalledWith('some-model', { provider: 'unknown-provider' })
    })
  })
})
