import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIProvider } from '@/types/provider'

vi.mock('@/lib/provider', () => ({
  getProviders: vi.fn(),
  getDefaultProvider: vi.fn(),
}))

import { getDefaultProvider, getProviders } from '@/lib/provider'
import ProviderModelSelector from '../provider-model-selector'

function makeProvider(overrides: Partial<AIProvider>): AIProvider {
  return {
    name: 'openai',
    baseUrl: 'https://example.com',
    apiKey: 'test-key',
    apiType: 'openai',
    models: ['gpt-4o'],
    enabled: true,
    avatar: 'O',
    ...overrides,
  }
}

describe('providerModelSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignores stale async initialization when chat props switch quickly', async () => {
    const providerList = [
      makeProvider({
        name: 'openai',
        models: ['gpt-4o'],
      }),
      makeProvider({
        name: 'anthropic',
        apiType: 'anthropic',
        models: ['claude-3-7'],
        avatar: 'A',
      }),
    ]

    const firstProviders = Promise.withResolvers<AIProvider[]>()
    const secondProviders = Promise.withResolvers<AIProvider[]>()
    const firstDefault = Promise.withResolvers<string>()
    const secondDefault = Promise.withResolvers<string>()

    vi.mocked(getProviders)
      .mockImplementationOnce(() => firstProviders.promise)
      .mockImplementationOnce(() => secondProviders.promise)
    vi.mocked(getDefaultProvider)
      .mockImplementationOnce(() => firstDefault.promise)
      .mockImplementationOnce(() => secondDefault.promise)

    const { rerender } = render(
      <ProviderModelSelector
        initialProvider="openai"
        initialModel="gpt-4o"
      />,
    )

    rerender(
      <ProviderModelSelector
        initialProvider="anthropic"
        initialModel="claude-3-7"
      />,
    )

    await act(async () => {
      secondProviders.resolve(providerList)
      secondDefault.resolve('openai')
      await Promise.all([secondProviders.promise, secondDefault.promise])
    })

    await waitFor(() => {
      const select = screen.getByRole('combobox')
      expect(select).toHaveTextContent('anthropic / claude-3-7')
    })

    await act(async () => {
      firstProviders.resolve(providerList)
      firstDefault.resolve('openai')
      await Promise.all([firstProviders.promise, firstDefault.promise])
    })

    const select = screen.getByRole('combobox')
    expect(select).toHaveTextContent('anthropic / claude-3-7')
  })

  it('matches settings by showing enabled providers with supported models', async () => {
    vi.mocked(getProviders).mockResolvedValue([
      makeProvider({
        name: 'openai',
        apiKey: '',
        models: ['gpt-4o'],
      }),
      makeProvider({
        name: 'anthropic',
        apiType: 'anthropic',
        apiKey: 'anthropic-key',
        models: [],
      }),
      makeProvider({
        name: 'deepseek',
        apiType: 'deepseek',
        enabled: false,
        apiKey: 'deepseek-key',
        models: ['deepseek-chat'],
      }),
    ])
    vi.mocked(getDefaultProvider).mockResolvedValue('openai')

    render(<ProviderModelSelector />)

    await waitFor(() => {
      const select = screen.getByRole('combobox')
      expect(select).toHaveTextContent('openai / gpt-4o')
    })
  })
})
