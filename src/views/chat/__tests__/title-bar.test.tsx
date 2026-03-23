import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatContext } from '@/context/chat'
import useUI from '@/store/ui'
import { ChatTitleBar } from '../title-bar'

vi.mock('@/i18n/provider', () => ({
  useI18n: () => ({
    t: (key: string) => key,
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

function renderTitleBar(chat = makeChat()) {
  return render(
    <ChatContext.Provider
      value={{
        chat,
        chatId: chat.uid,
        pendingMessages: [],
        isAtBottom: true,
        setIsAtBottom: () => {},
        scrollToBottomRef: { current: null },
      }}
    >
      <ChatTitleBar />
    </ChatContext.Provider>,
  )
}

describe('chatTitleBar', () => {
  beforeEach(() => {
    useUI.setState({
      layoutMode: 'chat',
      sidebarCollapsed: false,
    })
  })

  it('renders the current chat title inside a drag region', () => {
    renderTitleBar()

    const titleBar = screen.getByTestId('chat-title-bar')

    expect(titleBar).toHaveClass('app-drag-region')
    expect(screen.getByText('优化 holix ai')).toBeInTheDocument()
  })

  it('falls back to a default title when the chat title is empty', () => {
    renderTitleBar(makeChat({ title: '   ' }))

    expect(screen.getByText('新对话')).toBeInTheDocument()
  })

  it('shows fallback controls in the title bar when the sidebar is collapsed', () => {
    useUI.setState({
      layoutMode: 'chat',
      sidebarCollapsed: true,
    })

    renderTitleBar()

    expect(screen.getByTestId('chat-title-bar-controls')).toBeInTheDocument()
    expect(screen.getByTitle('chat.sidebar.expand')).toBeInTheDocument()
    expect(screen.getByTitle('chat.sidebar.switchToArticle')).toBeInTheDocument()
  })
})
