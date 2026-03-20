/**
 * LLM Adapters 单元测试
 * 测试各个 LLM 适配器的配置和初始化逻辑
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================
// Mock LangChain modules
// ============================================

const mockChatAnthropic = vi.hoisted(() => vi.fn())
const mockChatOpenAI = vi.hoisted(() => vi.fn())
const mockChatGoogleGenerativeAI = vi.hoisted(() => vi.fn())
const mockChatOllama = vi.hoisted(() => vi.fn())

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: mockChatAnthropic,
}))

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: mockChatOpenAI,
}))

vi.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: mockChatGoogleGenerativeAI,
}))

vi.mock('@langchain/ollama', () => ({
  ChatOllama: mockChatOllama,
}))

// ============================================
// Setup environment mocks
// ============================================

const originalEnv = process.env

beforeEach(() => {
  vi.clearAllMocks()
  // Reset environment to a clean state
  process.env = { ...originalEnv }
})

// ============================================
// Import after mocks
// ============================================

import {
  createAnthropicAdapter,
  createGeminiAdapter,
  createOllamaAdapter,
  createOpenAIAdapter,
} from '../adapters'

describe('Anthropic Adapter', () => {
  describe('createAnthropicAdapter', () => {
    it('should create adapter with model name', () => {
      createAnthropicAdapter('claude-3-opus')

      expect(mockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'claude-3-opus',
        }),
      )
    })

    it('should use default temperature when not provided', () => {
      createAnthropicAdapter('claude-3-opus')

      expect(mockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        }),
      )
    })

    it('should use custom temperature when provided', () => {
      createAnthropicAdapter('claude-3-opus', { temperature: 0.5 })

      expect(mockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
        }),
      )
    })

    it('should pass maxTokens when provided', () => {
      createAnthropicAdapter('claude-3-opus', { maxTokens: 4000 })

      expect(mockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 4000,
        }),
      )
    })

    it('should use config.apiKey when provided', () => {
      createAnthropicAdapter('claude-3-opus', { apiKey: 'custom-key' })

      expect(mockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'custom-key',
        }),
      )
    })

    it('should use ANTHROPIC_API_KEY env when config.apiKey not provided', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key'

      createAnthropicAdapter('claude-3-opus')

      expect(mockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'env-key',
        }),
      )
    })

    it('should prefer config.apiKey over env', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key'

      createAnthropicAdapter('claude-3-opus', { apiKey: 'config-key' })

      expect(mockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'config-key',
        }),
      )
    })

    it('should use config.baseURL when provided', () => {
      createAnthropicAdapter('claude-3-opus', { baseURL: 'https://custom.api.com' })

      expect(mockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          clientOptions: expect.objectContaining({
            baseURL: 'https://custom.api.com',
          }),
        }),
      )
    })

    it('should use ANTHROPIC_BASE_URL env when config.baseURL not provided', () => {
      process.env.ANTHROPIC_BASE_URL = 'https://env.api.com'

      createAnthropicAdapter('claude-3-opus')

      expect(mockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          clientOptions: expect.objectContaining({
            baseURL: 'https://env.api.com',
          }),
        }),
      )
    })

    it('should use default baseURL when neither config nor env provided', () => {
      delete process.env.ANTHROPIC_BASE_URL

      createAnthropicAdapter('claude-3-opus')

      expect(mockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          clientOptions: expect.objectContaining({
            baseURL: 'https://api.anthropic.com',
          }),
        }),
      )
    })

    it('should prefer config.baseURL over env', () => {
      process.env.ANTHROPIC_BASE_URL = 'https://env.api.com'

      createAnthropicAdapter('claude-3-opus', { baseURL: 'https://config.api.com' })

      expect(mockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          clientOptions: expect.objectContaining({
            baseURL: 'https://config.api.com',
          }),
        }),
      )
    })

    it('should handle complete config', () => {
      const config = {
        apiKey: 'custom-key',
        temperature: 0.3,
        maxTokens: 8000,
        baseURL: 'https://custom.api.com',
      }

      createAnthropicAdapter('claude-3-opus', config)

      expect(mockChatAnthropic).toHaveBeenCalledWith({
        modelName: 'claude-3-opus',
        temperature: 0.3,
        maxTokens: 8000,
        apiKey: 'custom-key',
        clientOptions: {
          baseURL: 'https://custom.api.com',
        },
      })
    })
  })
})

describe('OpenAI Adapter', () => {
  describe('createOpenAIAdapter', () => {
    it('should create adapter with model name', () => {
      createOpenAIAdapter('gpt-4')

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'gpt-4',
        }),
      )
    })

    it('should use default temperature when not provided', () => {
      createOpenAIAdapter('gpt-4')

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        }),
      )
    })

    it('should use custom temperature when provided', () => {
      createOpenAIAdapter('gpt-4', { temperature: 0.2 })

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2,
        }),
      )
    })

    it('should pass maxTokens when provided', () => {
      createOpenAIAdapter('gpt-4', { maxTokens: 4000 })

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 4000,
        }),
      )
    })

    it('should enable streaming by default', () => {
      createOpenAIAdapter('gpt-4')

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          streaming: true,
        }),
      )
    })

    it('should use custom streaming setting when provided', () => {
      createOpenAIAdapter('gpt-4', { streaming: false })

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          streaming: false,
        }),
      )
    })

    it('should use config.apiKey when provided', () => {
      createOpenAIAdapter('gpt-4', { apiKey: 'custom-key' })

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'custom-key',
        }),
      )
    })

    it('should use OPENAI_API_KEY env when config.apiKey not provided', () => {
      process.env.OPENAI_API_KEY = 'env-key'

      createOpenAIAdapter('gpt-4')

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'env-key',
        }),
      )
    })

    it('should prefer config.apiKey over env', () => {
      process.env.OPENAI_API_KEY = 'env-key'

      createOpenAIAdapter('gpt-4', { apiKey: 'config-key' })

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'config-key',
        }),
      )
    })

    it('should use config.baseURL when provided', () => {
      createOpenAIAdapter('gpt-4', { baseURL: 'https://custom.api.com/v1' })

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: expect.objectContaining({
            baseURL: 'https://custom.api.com/v1',
          }),
        }),
      )
    })

    it('should use OPENAI_BASE_URL env when config.baseURL not provided', () => {
      process.env.OPENAI_BASE_URL = 'https://env.api.com/v1'

      createOpenAIAdapter('gpt-4')

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: expect.objectContaining({
            baseURL: 'https://env.api.com/v1',
          }),
        }),
      )
    })

    it('should use default baseURL when neither config nor env provided', () => {
      createOpenAIAdapter('gpt-4')

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: expect.objectContaining({
            baseURL: 'https://api.openai.com/v1',
          }),
        }),
      )
    })

    it('should prefer config.baseURL over env', () => {
      process.env.OPENAI_BASE_URL = 'https://env.api.com/v1'

      createOpenAIAdapter('gpt-4', { baseURL: 'https://config.api.com/v1' })

      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: expect.objectContaining({
            baseURL: 'https://config.api.com/v1',
          }),
        }),
      )
    })

    it('should handle complete config', () => {
      const config = {
        apiKey: 'custom-key',
        temperature: 0.5,
        maxTokens: 2000,
        streaming: false,
        baseURL: 'https://custom.api.com/v1',
      }

      createOpenAIAdapter('gpt-4', config)

      expect(mockChatOpenAI).toHaveBeenCalledWith({
        modelName: 'gpt-4',
        temperature: 0.5,
        maxTokens: 2000,
        streaming: false,
        apiKey: 'custom-key',
        configuration: {
          baseURL: 'https://custom.api.com/v1',
        },
      })
    })
  })
})

describe('Gemini Adapter', () => {
  describe('createGeminiAdapter', () => {
    it('should create adapter with model name', () => {
      createGeminiAdapter('gemini-1.5-pro')

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-1.5-pro',
        }),
      )
    })

    it('should use default temperature when not provided', () => {
      createGeminiAdapter('gemini-1.5-pro')

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        }),
      )
    })

    it('should use custom temperature when provided', () => {
      createGeminiAdapter('gemini-1.5-pro', { temperature: 0.8 })

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.8,
        }),
      )
    })

    it('should pass maxTokens when provided', () => {
      createGeminiAdapter('gemini-1.5-pro', { maxTokens: 4000 })

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          maxOutputTokens: 4000,
        }),
      )
    })

    it('should use config.apiKey when provided', () => {
      createGeminiAdapter('gemini-1.5-pro', { apiKey: 'custom-key' })

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'custom-key',
        }),
      )
    })

    it('should use GOOGLE_API_KEY env when config.apiKey not provided', () => {
      process.env.GOOGLE_API_KEY = 'env-key'

      createGeminiAdapter('gemini-1.5-pro')

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'env-key',
        }),
      )
    })

    it('should prefer config.apiKey over env', () => {
      process.env.GOOGLE_API_KEY = 'env-key'

      createGeminiAdapter('gemini-1.5-pro', { apiKey: 'config-key' })

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'config-key',
        }),
      )
    })

    it('should use config.baseURL when provided', () => {
      createGeminiAdapter('gemini-1.5-pro', { baseURL: 'https://custom.api.com' })

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://custom.api.com',
        }),
      )
    })

    it('should use GOOGLE_BASE_URL env when config.baseURL not provided', () => {
      process.env.GOOGLE_BASE_URL = 'https://env.api.com'

      createGeminiAdapter('gemini-1.5-pro')

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://env.api.com',
        }),
      )
    })

    it('should prefer config.baseURL over env', () => {
      process.env.GOOGLE_BASE_URL = 'https://env.api.com'

      createGeminiAdapter('gemini-1.5-pro', { baseURL: 'https://config.api.com' })

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://config.api.com',
        }),
      )
    })

    it('should handle complete config', () => {
      const config = {
        apiKey: 'custom-key',
        temperature: 0.6,
        maxTokens: 6000,
        baseURL: 'https://custom.api.com',
      }

      createGeminiAdapter('gemini-1.5-pro', config)

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith({
        model: 'gemini-1.5-pro',
        temperature: 0.6,
        maxOutputTokens: 6000,
        apiKey: 'custom-key',
        baseUrl: 'https://custom.api.com',
      })
    })
  })
})

describe('Ollama Adapter', () => {
  describe('createOllamaAdapter', () => {
    it('should create adapter with model name', () => {
      createOllamaAdapter('llama3')

      expect(mockChatOllama).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'llama3',
        }),
      )
    })

    it('should use default temperature when not provided', () => {
      createOllamaAdapter('llama3')

      expect(mockChatOllama).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        }),
      )
    })

    it('should use custom temperature when provided', () => {
      createOllamaAdapter('llama3', { temperature: 0.4 })

      expect(mockChatOllama).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.4,
        }),
      )
    })

    it('should pass maxTokens when provided', () => {
      createOllamaAdapter('llama3', { maxTokens: 4000 })

      expect(mockChatOllama).toHaveBeenCalledWith(
        expect.objectContaining({
          numCtx: 4000,
        }),
      )
    })

    it('should use config.baseURL when provided', () => {
      createOllamaAdapter('llama3', { baseURL: 'http://localhost:8080' })

      expect(mockChatOllama).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'http://localhost:8080',
        }),
      )
    })

    it('should use OLLAMA_BASE_URL env when config.baseURL not provided', () => {
      process.env.OLLAMA_BASE_URL = 'http://remote-host:11434'

      createOllamaAdapter('llama3')

      expect(mockChatOllama).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'http://remote-host:11434',
        }),
      )
    })

    it('should prefer config.baseURL over env', () => {
      process.env.OLLAMA_BASE_URL = 'http://env-host:11434'

      createOllamaAdapter('llama3', { baseURL: 'http://config-host:11434' })

      expect(mockChatOllama).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'http://config-host:11434',
        }),
      )
    })

    it('should use default baseURL when neither config nor env provided', () => {
      createOllamaAdapter('llama3')

      expect(mockChatOllama).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'http://localhost:11434',
        }),
      )
    })

    it('should handle complete config', () => {
      const config = {
        temperature: 0.5,
        maxTokens: 8000,
        baseURL: 'http://custom-host:9999',
      }

      createOllamaAdapter('llama3', config)

      expect(mockChatOllama).toHaveBeenCalledWith({
        model: 'llama3',
        temperature: 0.5,
        numCtx: 8000,
        baseUrl: 'http://custom-host:9999',
      })
    })
  })
})

describe('Adapter Comparison', () => {
  it('should use same default temperature across all adapters', () => {
    createAnthropicAdapter('claude-3-opus')
    createOpenAIAdapter('gpt-4')
    createGeminiAdapter('gemini-1.5-pro')
    createOllamaAdapter('llama3')

    expect(mockChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.7 }),
    )
    expect(mockChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.7 }),
    )
    expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.7 }),
    )
    expect(mockChatOllama).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.7 }),
    )
  })

  it('should handle maxTokens consistently (Anthropic/OpenAI/Gemini use maxTokens)', () => {
    createAnthropicAdapter('claude-3-opus', { maxTokens: 4000 })
    createOpenAIAdapter('gpt-4', { maxTokens: 4000 })
    createGeminiAdapter('gemini-1.5-pro', { maxTokens: 4000 })

    expect(mockChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 4000 }),
    )
    expect(mockChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 4000 }),
    )
    expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
      expect.objectContaining({ maxOutputTokens: 4000 }),
    )
  })

  it('should handle baseURL/.baseUrl correctly for each adapter', () => {
    createAnthropicAdapter('claude-3-opus', { baseURL: 'https://custom.api.com' })
    createOpenAIAdapter('gpt-4', { baseURL: 'https://custom.api.com' })
    createGeminiAdapter('gemini-1.5-pro', { baseURL: 'https://custom.api.com' })
    createOllamaAdapter('llama3', { baseURL: 'http://localhost:9999' })

    expect(mockChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        clientOptions: expect.objectContaining({ baseURL: 'https://custom.api.com' }),
      }),
    )
    expect(mockChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: expect.objectContaining({ baseURL: 'https://custom.api.com' }),
      }),
    )
    expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://custom.api.com' }),
    )
    expect(mockChatOllama).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'http://localhost:9999' }),
    )
  })
})
