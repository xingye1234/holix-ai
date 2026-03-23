import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (payload: any) => void>()

const currentChat = {
  uid: 'chat-1',
  contextSettings: {
    autoScrollToBottomOnSend: true,
  },
}

const messageStoreState = {
  messages: {
    'assistant-1': {
      uid: 'assistant-1',
      role: 'assistant',
      status: 'pending',
    },
  } as Record<string, any>,
  deleteMessage: vi.fn(),
}

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/context/chat', () => ({
  useChatContext: () => ({
    chat: currentChat,
  }),
}))

vi.mock('@/hooks/message', () => ({
  useChatMessages: vi.fn(() => ['assistant-1']),
  useInitialMessageLoad: vi.fn(),
  useLoadMoreMessages: vi.fn(() => vi.fn()),
}))

vi.mock('@/hooks/update', () => ({
  default: vi.fn((name: string, handler: (payload: any) => void) => {
    handlers.set(name, handler)
  }),
}))

vi.mock('@/store/message', () => {
  const useMessageStore = ((selector: (state: typeof messageStoreState) => any) => selector(messageStoreState)) as any
  useMessageStore.getState = () => messageStoreState

  return {
    useMessageStore,
  }
})

import { useChatVirtualList } from '../chat-virtual-list'

describe('useChatVirtualList', () => {
  beforeEach(() => {
    handlers.clear()
    messageStoreState.messages['assistant-1'] = {
      uid: 'assistant-1',
      role: 'assistant',
      status: 'pending',
    }
    messageStoreState.deleteMessage.mockReset()
  })

  it('scrolls to bottom when an assistant message finishes streaming while user is at bottom', () => {
    const { result } = renderHook(() => useChatVirtualList())
    const scrollToBottom = vi.fn()

    result.current.listRef.current = {
      scrollToIndex: vi.fn(),
      scrollToBottom,
      scrollToTop: vi.fn(),
      getScrollElement: vi.fn(),
      isAtBottom: vi.fn(() => true),
      isAtTop: vi.fn(() => false),
    }

    act(() => {
      result.current.onAtBottomStateChange(true)
      handlers.get('message.created')?.({
        chatUid: 'chat-1',
        message: {
          uid: 'assistant-1',
          role: 'assistant',
        },
      })
    })

    act(() => {
      messageStoreState.messages['assistant-1'] = {
        ...messageStoreState.messages['assistant-1'],
        status: 'done',
      }
      handlers.get('message.updated')?.({
        chatUid: 'chat-1',
        messageUid: 'assistant-1',
        updates: {
          status: 'done',
        },
      })
    })

    expect(scrollToBottom).toHaveBeenCalledWith('smooth')
  })
})
