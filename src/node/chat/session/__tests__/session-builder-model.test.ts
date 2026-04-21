import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInitChatModel = vi.hoisted(() => vi.fn(async () => ({ kind: 'universal-model' })))
const mockCreateCustomProviderModel = vi.hoisted(() => vi.fn(() => null))

vi.mock('langchain/chat_models/universal', () => ({
  initChatModel: mockInitChatModel,
}))

vi.mock('../../llm/providers', () => ({
  createCustomProviderModel: mockCreateCustomProviderModel,
}))

import { buildSessionModel, normalizeModelProvider } from '../session-builder-model'

describe('session-builder-model', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateCustomProviderModel.mockReturnValue(null)
  })

  it('uses a custom provider model when one is available', async () => {
    const customModel = { kind: 'kimi-model' }
    mockCreateCustomProviderModel.mockReturnValue(customModel)

    const model = await buildSessionModel({
      provider: 'moonshot',
      model: 'kimi-k2.5',
      apiKey: 'sk-moonshot',
      baseURL: 'https://api.moonshot.cn/v1',
      temperature: 1,
      maxTokens: 16000,
    })

    expect(model).toBe(customModel)
    expect(mockCreateCustomProviderModel).toHaveBeenCalledWith('kimi-k2.5', {
      provider: 'moonshot',
      apiKey: 'sk-moonshot',
      baseURL: 'https://api.moonshot.cn/v1',
      temperature: 1,
      maxTokens: 16000,
      streaming: true,
    })
    expect(mockInitChatModel).not.toHaveBeenCalled()
  })

  it('falls back to initChatModel for standard openai providers', async () => {
    await buildSessionModel({
      provider: 'openai',
      model: 'gpt-4.1',
      apiKey: 'sk-openai',
      baseURL: 'https://api.openai.com/v1',
      temperature: 0.2,
      maxTokens: 4096,
    })

    expect(mockInitChatModel).toHaveBeenCalledWith('openai:gpt-4.1', {
      apiKey: 'sk-openai',
      temperature: 0.2,
      maxTokens: 4096,
      configuration: { baseURL: 'https://api.openai.com/v1' },
      streaming: true,
    })
  })

  it('normalizes gemini provider names', () => {
    expect(normalizeModelProvider('gemini')).toBe('google-genai')
    expect(normalizeModelProvider('google-genai')).toBe('google-genai')
  })

  it('keeps anthropic and ollama provider names intact', () => {
    expect(normalizeModelProvider('anthropic')).toBe('anthropic')
    expect(normalizeModelProvider('ollama')).toBe('ollama')
  })
})
