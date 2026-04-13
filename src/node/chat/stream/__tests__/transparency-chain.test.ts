import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StreamProcessor } from '../stream-processor'

const mockEmitMessageStreaming = vi.hoisted(() => vi.fn())

vi.mock('../../events/chat-event-emitter', () => ({
  chatEventEmitter: {
    emitMessageStreaming: (...args: unknown[]) => mockEmitMessageStreaming(...args),
  },
}))

describe('Stream transparency chain', () => {
  let processor: StreamProcessor
  let throttledDbUpdate: { addItem: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()

    throttledDbUpdate = {
      addItem: vi.fn(),
    }

    processor = new StreamProcessor({
      chatUid: 'chat-transparency',
      requestId: 'req-transparency',
      assistantMessageUid: 'msg-transparency',
      throttledDbUpdate,
    })
  })

  it('emits a pending tool trace when the model requests a tool but no result exists yet', () => {
    processor.processChunk('updates', {
      agent: {
        messages: [
          {
            tool_calls: [
              {
                id: 'call-weather',
                name: 'weather_lookup',
                args: { city: 'Shanghai' },
              },
            ],
          },
        ],
      },
    })

    const state = processor.getFinalState()

    expect(state.draftSegments).toHaveLength(1)
    expect(state.draftSegments[0]).toEqual(expect.objectContaining({
      phase: 'tool',
      source: 'model',
      toolCallId: 'call-weather',
      toolName: 'weather_lookup',
      toolArgs: { city: 'Shanghai' },
    }))

    expect(mockEmitMessageStreaming).toHaveBeenCalledWith(expect.objectContaining({
      toolCalls: [
        expect.objectContaining({
          toolCallId: 'call-weather',
          toolName: 'weather_lookup',
          status: 'called',
          resultContent: undefined,
        }),
      ],
      toolStatus: {
        running: true,
        tools: ['weather_lookup'],
      },
    }))
  })

  it('pairs tool requests and results into a completed tool trace', () => {
    processor.processChunk('updates', {
      agent: {
        messages: [
          {
            tool_calls: [
              {
                id: 'call-search',
                name: 'docs_search',
                args: { query: 'aimock truncateAfterChunks' },
              },
            ],
          },
        ],
      },
    })

    processor.processChunk('updates', {
      tools: {
        messages: [
          {
            tool_call_id: 'call-search',
            content: 'Found the chaos-testing docs.',
          },
        ],
      },
    })

    const lastStreamingEvent = mockEmitMessageStreaming.mock.calls.at(-1)?.[0]
    const state = processor.getFinalState()

    expect(state.draftSegments).toHaveLength(2)
    expect(state.draftSegments[1]).toEqual(expect.objectContaining({
      phase: 'tool',
      source: 'tool',
      toolCallId: 'call-search',
      content: 'Found the chaos-testing docs.',
    }))

    expect(lastStreamingEvent).toEqual(expect.objectContaining({
      toolCalls: [
        expect.objectContaining({
          toolCallId: 'call-search',
          toolName: 'docs_search',
          status: 'completed',
          resultContent: 'Found the chaos-testing docs.',
        }),
      ],
      toolStatus: {
        running: false,
        tools: [],
      },
    }))

    expect(throttledDbUpdate.addItem).toHaveBeenCalled()
  })
})
