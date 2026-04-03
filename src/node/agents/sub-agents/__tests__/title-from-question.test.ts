import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvoke = vi.hoisted(() => vi.fn())
const mockCreateLlm = vi.hoisted(() => vi.fn())

vi.mock('@/node/chat/llm', () => ({
  createLlm: mockCreateLlm,
}))

import { fallbackTitleFromQuestion, titleFromQuestionSubAgent } from '../builtin/title-from-question'

describe('titleFromQuestionSubAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateLlm.mockReturnValue({
      invoke: mockInvoke,
    })
  })

  it('generates title from llm when model config is available', async () => {
    mockInvoke.mockResolvedValue({
      content: 'TypeScript 泛型入门',
    })

    const result = await titleFromQuestionSubAgent.run({
      question: 'TypeScript 泛型是什么，怎么快速理解？',
      modelConfig: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: 'test-key',
        baseURL: 'https://example.com/v1',
      },
    })

    expect(result).toEqual({
      title: 'TypeScript 泛型入门',
      source: 'llm',
    })
    expect(mockCreateLlm).toHaveBeenCalledWith('gpt-4o-mini', expect.objectContaining({
      provider: 'openai',
      apiKey: 'test-key',
      baseURL: 'https://example.com/v1',
      streaming: false,
    }))
  })

  it('falls back to heuristic title when llm generation fails', async () => {
    mockInvoke.mockRejectedValue(new Error('network-error'))

    const result = await titleFromQuestionSubAgent.run({
      question: '如何在 React 中正确使用 useEffect 和依赖数组',
      modelConfig: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: 'test-key',
      },
    })

    expect(result.source).toBe('fallback')
    expect(result.title).toBe('如何在 React 中正确使用 useEffect 和依赖数...')
  })

  it('returns default title when question is empty', () => {
    expect(fallbackTitleFromQuestion('   ')).toBe('新对话')
  })
})
