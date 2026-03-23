import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useChat from '@/store/chat'

const handlers = new Map<string, (payload: any) => void>()

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/command', () => ({
  onUpdate: vi.fn((name: string, handler: (payload: any) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  }),
}))

import { useChatUpdates } from '../chat'

function resetChatStore() {
  useChat.setState({
    chats: [],
    isLoading: false,
    initialized: true,
    searchQuery: '',
  })
}

describe('useChatUpdates', () => {
  beforeEach(() => {
    handlers.clear()
    resetChatStore()
  })

  it('applies chat.updated payloads shaped as { chatUid, updates }', () => {
    useChat.setState({
      chats: [{
        uid: 'chat-1',
        id: 1,
        title: 'Old Title',
        provider: 'openai',
        model: 'gpt-4o',
        status: 'active',
        pinned: false,
        archived: false,
        createdAt: 1,
        updatedAt: 1,
        expiresAt: null,
        lastSeq: 0,
        lastMessagePreview: null,
        pendingMessages: null,
        prompts: [],
        workspace: null,
        contextSettings: {
          maxMessages: 10,
          timeWindowHours: 24,
        },
      } as any],
    })

    renderHook(() => useChatUpdates())

    handlers.get('chat.updated')?.({
      chatUid: 'chat-1',
      updates: {
        title: 'New Title',
        lastMessagePreview: 'Updated preview',
      },
    })

    const updatedChat = useChat.getState().chats[0]
    expect(updatedChat.title).toBe('New Title')
    expect(updatedChat.lastMessagePreview).toBe('Updated preview')
  })

  it('removes chats on chat.deleted', () => {
    useChat.setState({
      chats: [
        { uid: 'chat-1', id: 1 } as any,
        { uid: 'chat-2', id: 2 } as any,
      ],
    })

    renderHook(() => useChatUpdates())

    handlers.get('chat.deleted')?.({ uid: 'chat-1' })

    expect(useChat.getState().chats).toEqual([
      { uid: 'chat-2', id: 2 },
    ])
  })
})
