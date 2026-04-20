import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInitChatModel = vi.hoisted(() => vi.fn(async () => ({ kind: 'universal-model' })))
const mockCompatibleChatOpenAI = vi.hoisted(() => vi.fn())

vi.mock('langchain/chat_models/universal', () => ({
  initChatModel: mockInitChatModel,
}))

vi.mock('../../llm/openai-compatible', () => ({
  CompatibleChatOpenAI: class CompatibleChatOpenAI {
    constructor(options: any) {
      mockCompatibleChatOpenAI(options)
      return {
        kind: 'compatible-openai-model',
        options,
      }
    }
  },
}))

import { buildSessionModel, shouldOmitTemperature, shouldUseCompatibleOpenAIModel } from '../session-builder-model'

describe('session-builder-model', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the provider-aware OpenAI compatible adapter for Moonshot', async () => {
    const model = await buildSessionModel({
      provider: 'moonshot',
      model: 'kimi-k2.5',
      apiKey: 'sk-moonshot',
      baseURL: 'https://api.moonshot.cn/v1',
      temperature: 1,
      maxTokens: 16000,
    })

    expect(model).toEqual(expect.objectContaining({ kind: 'compatible-openai-model' }))
    expect(mockCompatibleChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({
      model: 'kimi-k2.5',
      apiKey: 'sk-moonshot',
      configuration: { baseURL: 'https://api.moonshot.cn/v1' },
    }))
    expect(mockInitChatModel).not.toHaveBeenCalled()
  })

  it('uses the compatible adapter for custom OpenAI-format providers with non-OpenAI base URLs', () => {
    expect(shouldUseCompatibleOpenAIModel({
      provider: 'openai',
      model: 'MiniMax-M2.7',
      apiKey: 'sk-minimax',
      baseURL: 'https://api.minimaxi.com/v1',
      temperature: undefined,
      maxTokens: undefined,
    })).toBe(true)
  })

  it('keeps the universal OpenAI model for official OpenAI endpoints', () => {
    expect(shouldUseCompatibleOpenAIModel({
      provider: 'openai',
      model: 'gpt-4.1',
      apiKey: 'sk-openai',
      baseURL: 'https://api.openai.com/v1',
      temperature: undefined,
      maxTokens: undefined,
    })).toBe(false)
  })

  it('omits unsupported temperature overrides for deepseek-reasoner', () => {
    expect(shouldOmitTemperature({
      provider: 'deepseek',
      model: 'deepseek-reasoner',
      apiKey: 'sk-deepseek',
      baseURL: 'https://api.deepseek.com/v1',
      temperature: 0.3,
      maxTokens: 4096,
    })).toBe(true)
  })
})
