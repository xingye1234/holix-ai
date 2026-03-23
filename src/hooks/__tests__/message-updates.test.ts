import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMessageStore } from '@/store/message'

const handlers = new Map<string, (payload: any) => void>()

vi.mock('@/lib/command', () => ({
  onUpdate: vi.fn((name: string, handler: (payload: any) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  }),
}))

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { useMessageUpdates } from '../message'

function resetMessageStore() {
  useMessageStore.setState({
    chatMessages: {},
    messages: {},
    initialLoaded: new Set(),
  })
}

describe('useMessageUpdates', () => {
  beforeEach(() => {
    handlers.clear()
    resetMessageStore()
  })

  it('removes the deleted message from the local store on message.deleted', () => {
    const appendMessage = useMessageStore.getState().appendMessage
    appendMessage('chat-1', {
      uid: 'msg-1',
      id: 1,
      chatUid: 'chat-1',
      seq: 1,
      role: 'assistant',
      kind: 'message',
      content: 'hello',
      draftContent: null,
      toolCalls: null,
      toolStatus: null,
      status: 'done',
      model: null,
      searchable: true,
      searchIndexVersion: null,
      parentUid: null,
      requestId: null,
      streamId: null,
      toolName: null,
      toolPayload: null,
      error: null,
      createdAt: 1,
      updatedAt: 1,
    } as any)

    renderHook(() => useMessageUpdates())

    handlers.get('message.deleted')?.({
      chatUid: 'chat-1',
      messageUid: 'msg-1',
    })

    expect(useMessageStore.getState().messages['msg-1']).toBeUndefined()
    expect(useMessageStore.getState().chatMessages['chat-1']).toEqual([])
  })
})
