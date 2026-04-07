import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/trpc-client', () => ({
  trpcClient: {
    dialog: {
      saveFile: vi.fn(),
    },
  },
}))

import type { Message } from '@/node/database/schema/chat'
import {
  filterExportableMessages,
  hasExportableMessageContent,
  toExportableMessage,
} from '../message-utils'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    uid: 'msg-1',
    seq: 1,
    chatUid: 'chat-1',
    role: 'assistant',
    kind: 'message',
    content: '',
    draftContent: [],
    toolCalls: [],
    status: 'done',
    toolStatus: undefined,
    model: 'gpt-4o',
    searchable: true,
    searchIndexVersion: 1,
    parentUid: null,
    requestId: null,
    streamId: null,
    toolName: null,
    toolPayload: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as Message
}

describe('message-utils exportability', () => {
  it('treats answer content as exportable', () => {
    const message = makeMessage({
      draftContent: [
        {
          id: 'seg-1',
          content: 'Hello world',
          phase: 'answer',
          source: 'model',
          createdAt: 1,
        },
      ],
    })

    expect(hasExportableMessageContent(message)).toBe(true)
    expect(toExportableMessage(message).content).toBe('Hello world')
  })

  it('treats error-only messages as not exportable', () => {
    const message = makeMessage({
      status: 'error',
      error: 'something went wrong',
      content: '',
      draftContent: [],
    })

    expect(hasExportableMessageContent(message)).toBe(false)
    expect(toExportableMessage(message).content).toBe('')
  })

  it('filters empty export payloads', () => {
    const messages = [
      { id: '1', role: 'assistant' as const, content: 'hello', createdAt: 1 },
      { id: '2', role: 'assistant' as const, content: '   ', createdAt: 2 },
      { id: '3', role: 'user' as const, content: '', createdAt: 3 },
    ]

    expect(filterExportableMessages(messages)).toEqual([
      { id: '1', role: 'assistant', content: 'hello', createdAt: 1 },
    ])
  })
})
