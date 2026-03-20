/**
 * ChatEventEmitter 单元测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock update function - must be hoisted
const mockUpdate = vi.hoisted(() => vi.fn())

vi.mock('../../../platform/update', () => ({
  update: mockUpdate,
}))

// Mock logger
vi.mock('../../../platform/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { chatEventEmitter } from '../chat-event-emitter'

describe('chatEventEmitter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('emitMessageCreated', () => {
    it('should emit message.created event', () => {
      const message = {
        uid: 'msg-123',
        role: 'user',
        content: 'Hello',
        kind: 'message',
        status: 'done',
        seq: 1,
        createdAt: Date.now(),
      } as any

      chatEventEmitter.emitMessageCreated('chat-123', message)

      expect(mockUpdate).toHaveBeenCalledWith('message.created', {
        chatUid: 'chat-123',
        message,
      })
    })
  })

  describe('emitMessageUpdated', () => {
    it('should emit message.updated event', () => {
      const event = {
        chatUid: 'chat-123',
        messageUid: 'msg-456',
        updates: { status: 'streaming', content: 'Hello' },
      }

      chatEventEmitter.emitMessageUpdated(event)

      expect(mockUpdate).toHaveBeenCalledWith('message.updated', event)
    })
  })

  describe('emitMessageStreaming', () => {
    it('should emit message.streaming event', () => {
      const event = {
        chatUid: 'chat-123',
        messageUid: 'msg-789',
        content: 'Hello world',
        delta: ' world',
        draftContent: [],
      } as any

      chatEventEmitter.emitMessageStreaming(event)

      expect(mockUpdate).toHaveBeenCalledWith('message.streaming', event)
    })
  })

  describe('emitMessageDeleted', () => {
    it('should emit message.deleted event', () => {
      chatEventEmitter.emitMessageDeleted('chat-123', 'msg-999')

      expect(mockUpdate).toHaveBeenCalledWith('message.deleted', {
        chatUid: 'chat-123',
        messageUid: 'msg-999',
      })
    })
  })

  describe('emitChatCreated', () => {
    it('should emit chat.created event', () => {
      chatEventEmitter.emitChatCreated('chat-456')

      expect(mockUpdate).toHaveBeenCalledWith('chat.created', {
        chatUid: 'chat-456',
      })
    })
  })

  describe('emitChatUpdated', () => {
    it('should emit chat.updated event', () => {
      const updates = { lastMessagePreview: 'Hello' }

      chatEventEmitter.emitChatUpdated('chat-789', updates)

      expect(mockUpdate).toHaveBeenCalledWith('chat.updated', {
        chatUid: 'chat-789',
        updates,
      })
    })
  })

  describe('emitChatDeleted', () => {
    it('should emit chat.deleted event', () => {
      chatEventEmitter.emitChatDeleted('chat-999')

      expect(mockUpdate).toHaveBeenCalledWith('chat.deleted', {
        uid: 'chat-999',
      })
    })
  })
})
