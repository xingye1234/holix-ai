import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../database/message-operations', () => ({
  commitDraftContent: vi.fn(),
  createMessage: vi.fn(),
  deleteMessage: vi.fn(),
  deleteMessages: vi.fn(),
  getLatestMessages: vi.fn(),
  getMessageByUid: vi.fn(),
  getMessagesByChatUid: vi.fn(),
  getNextSeq: vi.fn(),
  setMessageError: vi.fn(),
  updateMessage: vi.fn(),
  updateMessageContent: vi.fn(),
  updateMessageDraftContent: vi.fn(),
  updateMessageStatus: vi.fn(),
}))

vi.mock('../../database/chat-operations', () => ({
  getChatByUid: vi.fn(),
}))

vi.mock('../../database/message-search', () => ({
  searchMessagesBM25: vi.fn(),
}))

vi.mock('../../platform/update', () => ({
  update: vi.fn(),
}))

import * as chatOps from '../../database/chat-operations'
import * as messageOps from '../../database/message-operations'
import { update } from '../../platform/update'
import { messageRouter } from '../message'
import { createCaller } from '../trpc'

function makeMessage(overrides = {}) {
  return {
    id: 1,
    uid: 'msg-1',
    chatUid: 'chat-1',
    seq: 1,
    role: 'assistant' as const,
    kind: 'message',
    content: 'Hello',
    draftContent: null,
    toolCalls: null,
    status: 'done' as const,
    model: 'gpt-4o',
    searchable: true,
    searchIndexVersion: null,
    parentUid: 'user-1',
    requestId: null,
    streamId: null,
    toolName: null,
    toolPayload: null,
    error: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  }
}

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
    updatedAt: 1_700_000_000_100,
    expiresAt: null,
    lastSeq: 3,
    lastMessagePreview: 'latest preview',
    pendingMessages: null,
    prompts: [],
    workspace: null,
    contextSettings: {
      maxMessages: 10,
      timeWindowHours: 24,
    },
    ...overrides,
  }
}

describe('messageRouter', () => {
  let caller: ReturnType<typeof createCaller<typeof messageRouter>>

  beforeEach(() => {
    vi.clearAllMocks()
    caller = createCaller(messageRouter)
  })

  describe('delete', () => {
    it('emits message.deleted and chat.updated after deleting one message', async () => {
      vi.mocked(messageOps.deleteMessage).mockResolvedValue(makeMessage())
      vi.mocked(chatOps.getChatByUid).mockResolvedValue(makeChat() as any)

      const result = await caller.delete({ messageUid: 'msg-1' })

      expect(messageOps.deleteMessage).toHaveBeenCalledWith('msg-1')
      expect(update).toHaveBeenCalledWith('message.deleted', {
        chatUid: 'chat-1',
        messageUid: 'msg-1',
      })
      expect(update).toHaveBeenCalledWith('chat.updated', {
        chatUid: 'chat-1',
        updates: {
          lastMessagePreview: 'latest preview',
          lastSeq: 3,
          updatedAt: 1_700_000_000_100,
        },
      })
      expect(result).toEqual({ success: true, deletedCount: 1 })
    })

    it('returns deletedCount 0 when message does not exist', async () => {
      vi.mocked(messageOps.deleteMessage).mockResolvedValue(null)

      const result = await caller.delete({ messageUid: 'missing' })

      expect(result).toEqual({ success: true, deletedCount: 0 })
      expect(update).not.toHaveBeenCalled()
    })
  })

  describe('deleteMany', () => {
    it('emits one delete event per message and refreshes chat metadata', async () => {
      vi.mocked(messageOps.deleteMessages).mockResolvedValue([
        makeMessage({ uid: 'msg-1' }),
        makeMessage({ uid: 'msg-2', seq: 2 }),
      ] as any)
      vi.mocked(chatOps.getChatByUid).mockResolvedValue(makeChat({ lastSeq: 1, lastMessagePreview: 'remaining' }) as any)

      const result = await caller.deleteMany({
        chatUid: 'chat-1',
        messageUids: ['msg-1', 'msg-2'],
      })

      expect(messageOps.deleteMessages).toHaveBeenCalledWith(['msg-1', 'msg-2'])
      expect(update).toHaveBeenCalledWith('message.deleted', {
        chatUid: 'chat-1',
        messageUid: 'msg-1',
      })
      expect(update).toHaveBeenCalledWith('message.deleted', {
        chatUid: 'chat-1',
        messageUid: 'msg-2',
      })
      expect(update).toHaveBeenCalledWith('chat.updated', {
        chatUid: 'chat-1',
        updates: {
          lastMessagePreview: 'remaining',
          lastSeq: 1,
          updatedAt: 1_700_000_000_100,
        },
      })
      expect(result).toEqual({ success: true, deletedCount: 2 })
    })
  })
})
