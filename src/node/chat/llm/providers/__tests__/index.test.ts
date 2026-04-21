import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateKimiProvider = vi.hoisted(() => vi.fn(() => ({ kind: 'kimi-provider' })))
const mockIsKimiProvider = vi.hoisted(() => vi.fn(() => false))

vi.mock('../kimi', () => ({
  createKimiProvider: mockCreateKimiProvider,
  isKimiProvider: mockIsKimiProvider,
  KimiChatModel: class {},
}))

import { createCustomProviderModel } from '../index'

describe('custom provider registry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsKimiProvider.mockReturnValue(false)
  })

  it('returns null when no custom provider matches', () => {
    expect(createCustomProviderModel('gpt-4.1', { provider: 'openai' })).toBeNull()
    expect(mockCreateKimiProvider).not.toHaveBeenCalled()
  })

  it('delegates to kimi provider when matched', () => {
    mockIsKimiProvider.mockReturnValue(true)

    const model = createCustomProviderModel('kimi-k2.5', {
      provider: 'moonshot',
      baseURL: 'https://api.moonshot.cn/v1',
    })

    expect(model).toEqual({ kind: 'kimi-provider' })
    expect(mockCreateKimiProvider).toHaveBeenCalledWith('kimi-k2.5', {
      provider: 'moonshot',
      baseURL: 'https://api.moonshot.cn/v1',
    })
  })
})
