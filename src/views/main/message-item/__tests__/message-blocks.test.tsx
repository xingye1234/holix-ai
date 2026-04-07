import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Message } from '@/node/database/schema/chat'
import type { ToolCallPair } from '../tool-call-card'
import { BlockRenderer } from '../block-renderer'
import { buildMessageRenderBlocks } from '../message-blocks'

vi.mock('../markdown', () => ({
  MessageMarkdown: ({ content }: { content: string }) => <div data-testid="markdown-block">{content}</div>,
}))

vi.mock('../tool-call-card', () => ({
  ToolCallCard: ({ pair }: { pair: ToolCallPair }) => <div data-testid="tool-block">{pair.request.toolName}</div>,
}))

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
    telemetry: null as any,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as Message
}

function makeToolPair(overrides: Partial<ToolCallPair> = {}): ToolCallPair {
  return {
    request: {
      id: 'tool-1',
      content: '{"name":"read_file"}',
      phase: 'tool',
      source: 'model',
      createdAt: 1,
      toolCallId: 'call-1',
      toolName: 'read_file',
      toolArgs: { path: 'README.md' },
    },
    result: {
      id: 'tool-1-result',
      content: 'done',
      phase: 'tool',
      source: 'tool',
      createdAt: 2,
      toolCallId: 'call-1',
    },
    ...overrides,
  }
}

describe('buildMessageRenderBlocks', () => {
  it('builds tool and markdown blocks for assistant replies', () => {
    const blocks = buildMessageRenderBlocks({
      message: makeMessage(),
      content: 'final answer',
      toolCallPairs: [makeToolPair()],
      isStreaming: false,
      isError: false,
      isPending: false,
      generating: false,
      isToolRunning: false,
      runningTools: [],
    })

    expect(blocks.map(block => block.type)).toEqual(['tool', 'markdown'])
  })

  it('maps pending approval tool calls to approval blocks', () => {
    const blocks = buildMessageRenderBlocks({
      message: makeMessage({ status: 'streaming' }),
      content: '',
      toolCallPairs: [
        makeToolPair({
          request: {
            ...makeToolPair().request,
            id: 'tool-approval',
            toolName: 'exec_command',
            toolArgs: { cmd: 'rg --files' },
            approvalStatus: 'pending',
          },
          result: undefined,
        }),
      ],
      isStreaming: true,
      isError: false,
      isPending: false,
      generating: true,
      isToolRunning: false,
      runningTools: [],
    })

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'approval',
      status: 'pending',
      command: 'rg --files',
    })
  })

  it('maps exec_command tool calls to command blocks', () => {
    const blocks = buildMessageRenderBlocks({
      message: makeMessage(),
      content: 'done',
      toolCallPairs: [
        makeToolPair({
          request: {
            ...makeToolPair().request,
            toolName: 'exec_command',
            toolArgs: { cmd: 'pnpm type-check' },
          },
          result: {
            ...makeToolPair().result!,
            content: 'All good',
          },
        }),
      ],
      isStreaming: false,
      isError: false,
      isPending: false,
      generating: false,
      isToolRunning: false,
      runningTools: [],
    })

    expect(blocks.map(block => block.type)).toEqual(['command', 'markdown'])
    expect(blocks[0]).toMatchObject({
      type: 'command',
      command: 'pnpm type-check',
      output: 'All good',
    })
  })

  it('prepends status blocks when tools are running', () => {
    const blocks = buildMessageRenderBlocks({
      message: makeMessage({ status: 'streaming' }),
      content: '',
      toolCallPairs: [],
      isStreaming: true,
      isError: false,
      isPending: false,
      generating: true,
      isToolRunning: true,
      runningTools: ['read_file', 'search_code'],
    })

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'status',
      status: 'running',
      title: '正在执行工具',
      description: 'read_file、search_code',
    })
  })
})

describe('BlockRenderer', () => {
  it('renders blocks in content order', () => {
    const blocks = buildMessageRenderBlocks({
      message: makeMessage(),
      content: 'final answer',
      toolCallPairs: [makeToolPair()],
      isStreaming: false,
      isError: false,
      isPending: false,
      generating: false,
      isToolRunning: false,
      runningTools: [],
    })

    render(<BlockRenderer blocks={blocks} isUser={false} />)

    const tool = screen.getByTestId('tool-block')
    const markdown = screen.getByTestId('markdown-block')

    expect(tool).toBeInTheDocument()
    expect(markdown).toBeInTheDocument()
    expect(tool.compareDocumentPosition(markdown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
