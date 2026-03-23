import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatContext } from '@/context/chat'
import { SettingsPanelProvider } from '@/context/settings-panel'
import useChat from '@/store/chat'

const mocks = vi.hoisted(() => ({
  chatUpdateMock: vi.fn(),
  workspaceQueryFilesMock: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/i18n/provider', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/lib/trpc-client', () => ({
  trpcClient: {
    chat: {
      update: mocks.chatUpdateMock,
    },
    workspace: {
      queryFiles: mocks.workspaceQueryFilesMock,
    },
  },
}))

vi.mock('@/lib/command', () => ({
  command: vi.fn(),
}))

vi.mock('@/components/editor/editor', async () => {
  const React = await import('react')

  const Editor = React.forwardRef((_props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      clear: vi.fn(),
      setText: vi.fn(),
    }))

    return <div data-testid="editor" />
  })

  Editor.displayName = 'MockEditor'

  return {
    Editor,
  }
})

vi.mock('@/components/message-selection', () => ({
  SelectionToggle: () => <div data-testid="selection-toggle" />,
}))

vi.mock('@/views/shared/agent-selector', () => ({
  AgentSelector: () => <div data-testid="agent-selector" />,
}))

vi.mock('@/views/shared/provider-model-selector', () => ({
  default: ({ onProviderChange, onModelChange }: { onProviderChange?: (provider: string) => void, onModelChange?: (model: string) => void }) => (
    <div>
      <button type="button" onClick={() => onProviderChange?.('anthropic')}>
        change-provider
      </button>
      <button type="button" onClick={() => onModelChange?.('claude-3-7')}>
        change-model
      </button>
    </div>
  ),
}))

vi.mock('@/views/main/drafts', () => ({
  default: () => null,
}))

import MainFooter from '../footer'

function makeChat(overrides = {}) {
  return {
    id: 1,
    uid: 'chat-1',
    title: 'Test Chat',
    provider: 'openai',
    model: 'gpt-4o',
    status: 'active' as const,
    pinned: false,
    archived: false,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    expiresAt: null,
    lastSeq: 0,
    lastMessagePreview: null,
    pendingMessages: null,
    prompts: [],
    workspace: null,
    contextSettings: {
      maxMessages: 10,
      timeWindowHours: 24,
      autoScrollToBottomOnSend: true,
    },
    ...overrides,
  }
}

function renderFooter(chat = makeChat()) {
  return render(
    <ChatContext.Provider
      value={{
        chat,
        chatId: chat.uid,
        pendingMessages: [],
        isAtBottom: true,
        setIsAtBottom: vi.fn(),
        scrollToBottomRef: { current: null },
      }}
    >
      <SettingsPanelProvider
        value={{
          isOpen: false,
          toggle: vi.fn(),
          open: vi.fn(),
          close: vi.fn(),
        }}
      >
        <MainFooter />
      </SettingsPanelProvider>
    </ChatContext.Provider>,
  )
}

describe('mainFooter provider/model sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useChat.setState({
      chats: [makeChat()],
      isLoading: false,
      initialized: true,
      searchQuery: '',
    })
  })

  it('keeps the latest model when provider/model updates resolve out of order', async () => {
    const user = userEvent.setup()
    const providerUpdate = Promise.withResolvers<any>()
    const modelUpdate = Promise.withResolvers<any>()

    mocks.chatUpdateMock.mockImplementation(({ provider, model }: { provider?: string, model?: string }) => {
      if (provider) {
        return providerUpdate.promise
      }
      if (model) {
        return modelUpdate.promise
      }
      throw new Error('unexpected update payload')
    })

    renderFooter()

    await user.click(screen.getByRole('button', { name: 'change-provider' }))
    await user.click(screen.getByRole('button', { name: 'change-model' }))

    await act(async () => {
      modelUpdate.resolve(makeChat({
        provider: 'anthropic',
        model: 'claude-3-7',
      }))
      await modelUpdate.promise
    })

    await waitFor(() => {
      const chat = useChat.getState().chats[0]
      expect(chat.provider).toBe('openai')
      expect(chat.model).toBe('claude-3-7')
    })

    await act(async () => {
      providerUpdate.resolve(makeChat({
        provider: 'anthropic',
        model: 'gpt-4o',
      }))
      await providerUpdate.promise
    })

    const chat = useChat.getState().chats[0]
    expect(chat.provider).toBe('anthropic')
    expect(chat.model).toBe('claude-3-7')
    expect(mocks.chatUpdateMock).toHaveBeenNthCalledWith(1, {
      uid: 'chat-1',
      provider: 'anthropic',
    })
    expect(mocks.chatUpdateMock).toHaveBeenNthCalledWith(2, {
      uid: 'chat-1',
      model: 'claude-3-7',
    })
  })
})
