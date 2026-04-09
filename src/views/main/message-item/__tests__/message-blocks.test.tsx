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

    expect(blocks.map(block => block.type)).toEqual(['timeline', 'tool', 'markdown'])
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

    expect(blocks).toHaveLength(2)
    expect(blocks[1]).toMatchObject({
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
            content: JSON.stringify({ exitCode: 1, stdout: 'lint failed', stderr: 'error details' }),
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

    expect(blocks.map(block => block.type)).toEqual(['timeline', 'command', 'markdown'])
    expect(blocks[1]).toMatchObject({
      type: 'command',
      command: 'pnpm type-check',
      status: 'error',
      exitCode: 1,
      output: 'lint failed\nerror details',
    })
  })

  it('renders assistant markdown and command blocks in draft stream order', () => {
    const blocks = buildMessageRenderBlocks({
      message: makeMessage({
        status: 'streaming',
        draftContent: [
          {
            id: 'seg-1',
            content: '先检查一下环境。\n',
            phase: 'answer',
            source: 'model',
            createdAt: 1,
          },
          {
            id: 'seg-2',
            content: '{"name":"exec_command"}',
            phase: 'tool',
            source: 'model',
            createdAt: 2,
            toolCallId: 'call-2',
            toolName: 'exec_command',
            toolArgs: { cmd: 'pnpm type-check' },
          },
          {
            id: 'seg-3',
            content: '检查完成，接下来我会修复类型问题。',
            phase: 'answer',
            source: 'model',
            createdAt: 3,
          },
        ],
      }),
      content: '先检查一下环境。\n检查完成，接下来我会修复类型问题。',
      toolCallPairs: [
        makeToolPair({
          request: {
            ...makeToolPair().request,
            id: 'tool-2',
            toolCallId: 'call-2',
            toolName: 'exec_command',
            toolArgs: { cmd: 'pnpm type-check' },
            createdAt: 2,
          },
          result: {
            ...makeToolPair().result!,
            toolCallId: 'call-2',
            content: JSON.stringify({ exitCode: 0, stdout: 'all good' }),
            createdAt: 4,
          },
        }),
      ],
      isStreaming: true,
      isError: false,
      isPending: false,
      generating: true,
      isToolRunning: false,
      runningTools: [],
    })

    expect(blocks.map(block => block.type)).toEqual(['timeline', 'markdown', 'command', 'markdown'])
    expect(blocks[1]).toMatchObject({
      type: 'markdown',
      content: '先检查一下环境。\n',
    })
    expect(blocks[2]).toMatchObject({
      type: 'command',
      command: 'pnpm type-check',
    })
    expect(blocks[3]).toMatchObject({
      type: 'markdown',
      content: '检查完成，接下来我会修复类型问题。',
      isStreaming: true,
    })
  })

  it('renders assistant markdown and live approval blocks in draft stream order', () => {
    const blocks = buildMessageRenderBlocks({
      message: makeMessage({
        status: 'streaming',
        draftContent: [
          {
            id: 'seg-1',
            content: '我准备执行一个命令来确认当前状态。\n',
            phase: 'answer',
            source: 'model',
            createdAt: 1,
          },
        ],
      }),
      content: '我准备执行一个命令来确认当前状态。\n',
      toolCallPairs: [],
      isStreaming: true,
      isError: false,
      isPending: false,
      generating: true,
      isToolRunning: false,
      runningTools: [],
      pendingApprovalRequest: {
        callbackId: 'cb-1',
        toolName: 'exec_command',
        skillName: 'shell',
        description: 'run command',
        messageUid: 'msg-1',
        args: { cmd: 'pnpm test' },
        resolve: vi.fn(),
      },
    })

    expect(blocks.map(block => block.type)).toEqual(['timeline', 'markdown', 'approval'])
    expect(blocks[1]).toMatchObject({
      type: 'markdown',
      content: '我准备执行一个命令来确认当前状态。\n',
    })
    expect(blocks[2]).toMatchObject({
      type: 'approval',
      status: 'pending',
      command: 'pnpm test',
      isLiveRequest: true,
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

  it('maps live tool approval request to approval block', () => {
    const blocks = buildMessageRenderBlocks({
      message: makeMessage({ status: 'streaming' }),
      content: '',
      toolCallPairs: [],
      isStreaming: true,
      isError: false,
      isPending: false,
      generating: true,
      isToolRunning: false,
      runningTools: [],
      pendingApprovalRequest: {
        callbackId: 'cb-1',
        toolName: 'exec_command',
        skillName: 'shell',
        description: 'run command',
        args: { cmd: 'pnpm test' },
        resolve: vi.fn(),
      },
    })

    const approvalBlock = blocks.find(block => block.type === 'approval')
    expect(approvalBlock).toMatchObject({
      type: 'approval',
      status: 'pending',
      toolName: 'exec_command',
      skillName: 'shell',
      command: 'pnpm test',
      isLiveRequest: true,
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
