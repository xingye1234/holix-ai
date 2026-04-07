import type { Message } from '@/node/database/schema/chat'
import type { ToolCallPair } from './tool-call-card'

export interface MarkdownBlock {
  id: string
  type: 'markdown'
  content: string
  isStreaming?: boolean
}

export interface ApprovalBlock {
  id: string
  type: 'approval'
  status: 'pending' | 'approved' | 'denied'
  title: string
  toolName?: string
  command?: string
  reason?: string
  args?: Record<string, unknown>
}

export interface CommandBlock {
  id: string
  type: 'command'
  status: 'running' | 'done' | 'error'
  toolName: string
  command: string
  output?: string
}

export interface ToolBlock {
  id: string
  type: 'tool'
  status: 'running' | 'done' | 'error'
  pair: ToolCallPair
}

export interface StatusBlock {
  id: string
  type: 'status'
  status: 'info' | 'running' | 'done' | 'error'
  title: string
  description?: string
}

export type MessageRenderBlock =
  | MarkdownBlock
  | ApprovalBlock
  | CommandBlock
  | ToolBlock
  | StatusBlock

interface BuildMessageBlocksOptions {
  message: Message
  content: string
  toolCallPairs: ToolCallPair[]
  isStreaming: boolean
  isError: boolean
  isPending: boolean
  generating: boolean
  isToolRunning: boolean
  runningTools: string[]
}

function parseCommandFromArgs(args?: Record<string, unknown>) {
  const command = args?.cmd
  return typeof command === 'string' ? command : undefined
}

function readResultText(pair: ToolCallPair) {
  return pair.result?.content?.trim() || undefined
}

function mapToolStatus(pair: ToolCallPair, isStreaming: boolean): ToolBlock['status'] {
  if (pair.request.approvalStatus === 'denied')
    return 'error'

  const resultText = readResultText(pair)
  if (resultText?.startsWith('[操作被拒绝'))
    return 'error'

  if (!pair.result && isStreaming)
    return 'running'

  return 'done'
}

function buildToolLikeBlocks(pair: ToolCallPair, isStreaming: boolean): MessageRenderBlock[] {
  const toolName = pair.request.toolName ?? 'tool'
  const command = parseCommandFromArgs(pair.request.toolArgs)
  const approvalStatus = pair.request.approvalStatus

  if (approvalStatus) {
    return [
      {
        id: `${pair.request.id}-approval`,
        type: 'approval',
        status: approvalStatus,
        title: approvalStatus === 'pending'
          ? '等待审批'
          : approvalStatus === 'approved'
            ? '审批通过'
            : '审批已拒绝',
        toolName,
        command,
        args: pair.request.toolArgs,
      },
    ]
  }

  if (command) {
    return [
      {
        id: `${pair.request.id}-command`,
        type: 'command',
        status: mapToolStatus(pair, isStreaming),
        toolName,
        command,
        output: readResultText(pair),
      },
    ]
  }

  return [
    {
      id: `${pair.request.id}-tool`,
      type: 'tool',
      status: mapToolStatus(pair, isStreaming),
      pair,
    },
  ]
}

function buildAssistantStatusBlocks({
  message,
  generating,
  isPending,
  isToolRunning,
  runningTools,
}: Pick<BuildMessageBlocksOptions, 'message' | 'generating' | 'isPending' | 'isToolRunning' | 'runningTools'>) {
  const blocks: StatusBlock[] = []

  if (message.status === 'error') {
    blocks.push({
      id: `${message.uid}-status-error`,
      type: 'status',
      status: 'error',
      title: '生成失败',
      description: message.error ?? undefined,
    })
    return blocks
  }

  if (isPending) {
    blocks.push({
      id: `${message.uid}-status-pending`,
      type: 'status',
      status: 'running',
      title: '正在准备回复',
    })
  }

  if (generating && isToolRunning) {
    blocks.push({
      id: `${message.uid}-status-tools`,
      type: 'status',
      status: 'running',
      title: '正在执行工具',
      description: runningTools.join('、') || undefined,
    })
  }

  return blocks
}

export function buildMessageRenderBlocks({
  message,
  content,
  toolCallPairs,
  isStreaming,
  isError,
  isPending,
  generating,
  isToolRunning,
  runningTools,
}: BuildMessageBlocksOptions): MessageRenderBlock[] {
  if (message.role === 'user') {
    return [{
      id: `${message.uid}-markdown`,
      type: 'markdown',
      content,
    }]
  }

  const blocks: MessageRenderBlock[] = [
    ...buildAssistantStatusBlocks({
      message,
      generating,
      isPending,
      isToolRunning,
      runningTools,
    }),
    ...toolCallPairs.flatMap(pair => buildToolLikeBlocks(pair, isStreaming)),
  ]

  const markdownContent = content || (isError ? (message.error ?? '') : '')
  if (markdownContent) {
    blocks.push({
      id: `${message.uid}-markdown`,
      type: 'markdown',
      content: markdownContent,
      isStreaming: isStreaming && !!content,
    })
  }

  return blocks
}
