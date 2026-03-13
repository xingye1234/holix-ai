/**
 * StreamProcessor 单元测试
 */

import type { DraftContent } from '../../../database/schema/chat'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StreamProcessor } from '../stream-processor'

// Mock dependencies
vi.mock('../../../platform/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../events/chat-event-emitter', () => ({
  chatEventEmitter: {
    emitMessageStreaming: vi.fn(),
  },
}))

vi.mock('../../tools/tool-call-tracker', () => ({
  toolCallTracker: {
    buildToolCallTraces: vi.fn(() => []),
  },
}))

describe('streamProcessor', () => {
  let processor: StreamProcessor
  let mockThrottledDbUpdate: any

  beforeEach(() => {
    mockThrottledDbUpdate = {
      addItem: vi.fn(),
    }

    processor = new StreamProcessor({
      chatUid: 'chat-123',
      requestId: 'req-456',
      assistantMessageUid: 'msg-789',
      throttledDbUpdate: mockThrottledDbUpdate,
    })
  })

  describe('processChunk', () => {
    it('should process messages mode chunk', () => {
      const chunk = [
        {
          getType: () => 'ai',
          content: 'Hello',
          tool_call_chunks: null,
        },
        { langgraph_node: 'agent' },
      ]

      processor.processChunk('messages', chunk)

      const state = processor.getFinalState()
      expect(state.content).toBe('Hello')
      expect(state.draftSegments).toHaveLength(1)
      expect(state.draftSegments[0].content).toBe('Hello')
      expect(state.draftSegments[0].phase).toBe('answer')
    })

    it('should process updates mode chunk', () => {
      const chunk = {
        agent: {
          messages: [
            {
              tool_calls: [
                {
                  id: 'call-1',
                  name: 'search',
                  args: { query: 'test' },
                },
              ],
            },
          ],
        },
      }

      processor.processChunk('updates', chunk)

      const state = processor.getFinalState()
      expect(state.draftSegments).toHaveLength(1)
      expect(state.draftSegments[0].toolName).toBe('search')
      expect(state.draftSegments[0].phase).toBe('tool')
    })

    it('should accumulate multiple text chunks', () => {
      const chunk1 = [
        { getType: () => 'ai', content: 'Hello', tool_call_chunks: null },
        {},
      ]
      const chunk2 = [
        { getType: () => 'ai', content: ' world', tool_call_chunks: null },
        {},
      ]

      processor.processChunk('messages', chunk1)
      processor.processChunk('messages', chunk2)

      const state = processor.getFinalState()
      expect(state.content).toBe('Hello world')
      expect(state.draftSegments).toHaveLength(2)
    })
  })

  describe('getFinalState', () => {
    it('should return final content and segments', () => {
      const chunk = [
        { getType: () => 'ai', content: 'Test', tool_call_chunks: null },
        {},
      ]

      processor.processChunk('messages', chunk)

      const state = processor.getFinalState()
      expect(state.content).toBe('Test')
      expect(state.draftSegments).toHaveLength(1)
    })
  })

  describe('getContext', () => {
    it('should return stream context', () => {
      const context = processor.getContext()

      expect(context.chatUid).toBe('chat-123')
      expect(context.requestId).toBe('req-456')
      expect(context.assistantMessageUid).toBe('msg-789')
      expect(context.throttledDbUpdate).toBe(mockThrottledDbUpdate)
    })
  })
})
