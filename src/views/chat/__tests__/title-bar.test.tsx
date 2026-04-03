import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPanelProvider } from '@/context/settings-panel'
import useChat from '@/store/chat'
import { ChatTitleBar } from '../title-bar'

const mocks = vi.hoisted(() => ({
  pathname: '/chat/chat-1',
}))

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: mocks.pathname } }),
}))

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/trpc-client', () => ({
  trpcClient: {
    chat: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/i18n/provider', () => ({
  useI18n: () => ({
    t: (key: string) => {
      if (key === 'chat.titleBar.newChat')
        return '新对话'
      if (key === 'chat.titleBar.openSettings')
        return '打开聊天设置'
      if (key === 'chat.titleBar.closeSettings')
        return '关闭聊天设置'
      return key
    },
  }),
}))

function makeChat(overrides = {}) {
  return {
    id: 1,
    uid: 'chat-1',
    title: '优化 holix ai',
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

function renderTitleBar() {
  return render(
    <SettingsPanelProvider
      value={{
        isOpen: false,
        toggle: vi.fn(),
        open: vi.fn(),
        close: vi.fn(),
      }}
    >
      <ChatTitleBar />
    </SettingsPanelProvider>,
  )
}

describe('chatTitleBar', () => {
  beforeEach(() => {
    mocks.pathname = '/chat/chat-1'
    useChat.setState({
      chats: [makeChat()],
      isLoading: false,
      initialized: true,
      searchQuery: '',
    })
  })

  it('renders the current chat title for the active route', () => {
    renderTitleBar()

    const titleBar = screen.getByTestId('chat-title-bar')

    expect(titleBar).toHaveClass('flex')
    expect(screen.getByText('优化 holix ai')).toBeInTheDocument()
    expect(screen.getByTestId('chat-title-bar-controls')).toBeInTheDocument()
    expect(screen.getByTestId('chat-title-bar-settings')).toBeInTheDocument()
  })

  it('falls back to a default title when the chat title is empty', () => {
    useChat.setState({
      chats: [makeChat({ title: '   ' })],
      isLoading: false,
      initialized: true,
      searchQuery: '',
    })
    renderTitleBar()

    expect(screen.getByText('新对话')).toBeInTheDocument()
  })

  it('falls back to the app title and hides chat controls outside chat routes', () => {
    mocks.pathname = '/skills'

    renderTitleBar()

    expect(screen.getByText('Holix AI')).toBeInTheDocument()
    expect(screen.getByTestId('chat-title-bar-controls')).toBeInTheDocument()
    expect(screen.queryByTestId('chat-title-bar-settings')).not.toBeInTheDocument()
  })
})
