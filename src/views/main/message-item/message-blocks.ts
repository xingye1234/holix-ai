import type { Message } from '@/node/database/schema/chat'
import type { ToolApprovalRequest } from '@/store/tool-approval'
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
  skillName?: string
  command?: string
  reason?: string
  args?: Record<string, unknown>
  isLiveRequest?: boolean
}

export interface AgentBlock {
  id: string
  type: 'agent'
  status: 'done' | 'error' | 'suggest'
  title: string
  agentName?: string
  hook?: string
  description?: string
}

export interface CommandBlock {
  id: string
  type: 'command'
  status: 'running' | 'done' | 'error'
  toolName: string
  command: string
  exitCode?: number
  summary?: string
  rawOutput?: string
  output?: string
}

export interface TimelineItem {
  id: string
  at?: number
  kind: 'model_start' | 'tool_call' | 'approval_waiting' | 'command_done' | 'agent_run' | 'final_answer'
  title: string
  description?: string
  status: 'running' | 'done' | 'error'
}

export interface TimelineBlock {
  id: string
  type: 'timeline'
  items: TimelineItem[]
  totalDurationMs?: number
  totalEstimatedTokens?: number
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
  | AgentBlock
  | CommandBlock
  | TimelineBlock
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
  pendingApprovalRequest?: ToolApprovalRequest | null
}

function isCosmeticLifecycleAgentSegment(segment: Message['draftContent'][number]) {
  return segment.phase === 'agent'
    && (segment.agentId === 'builtin:title-generator'
      || segment.agentSuggestionType === 'title')
}

function parseCommandFromArgs(args?: Record<string, unknown>) {
  const command = args?.cmd
  return typeof command === 'string' ? command : undefined
}

function readResultText(pair: ToolCallPair) {
  return pair.result?.content?.trim() || undefined
}

function extractExitCodeFromText(text?: string) {
  if (!text)
    return undefined

  const matched = text.match(/exit\s*code\s*[:=]?\s*(-?\d+)/i)
  if (!matched)
    return undefined

  const parsed = Number.parseInt(matched[1], 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function truncateText(text: string, max = 240) {
  if (text.length <= max)
    return text
  return `${text.slice(0, max)}…`
}

function parseCommandOutput(resultText?: string) {
  if (!resultText)
    return {
      exitCode: undefined as number | undefined,
      rawOutput: undefined as string | undefined,
      preview: undefined as string | undefined,
      summary: undefined as string | undefined,
    }

  let exitCode = extractExitCodeFromText(resultText)
  let rawOutput = resultText
  let summary = ''

  try {
    const parsed = JSON.parse(resultText) as Record<string, unknown>
    const parsedExitCode = parsed.exitCode
    if (typeof parsedExitCode === 'number') {
      exitCode = parsedExitCode
    }

    const chunks = [parsed.stdout, parsed.stderr, parsed.output]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map(part => part.trim())
    rawOutput = chunks.join('\n') || resultText
  }
  catch {
    // keep plain-text fallback
  }

  const firstLine = rawOutput
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0)

  if (exitCode !== undefined) {
    summary = exitCode === 0 ? '命令执行成功（exit code 0）' : `命令执行失败（exit code ${exitCode}）`
  }
  else {
    summary = firstLine ? truncateText(firstLine, 120) : '命令已完成'
  }

  return {
    exitCode,
    rawOutput,
    preview: truncateText(rawOutput, 240),
    summary,
  }
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
    const commandOutput = parseCommandOutput(readResultText(pair))
    const commandStatus: CommandBlock['status'] = !pair.result && isStreaming
      ? 'running'
      : pair.request.approvalStatus === 'denied' || (commandOutput.exitCode !== undefined && commandOutput.exitCode !== 0) || mapToolStatus(pair, isStreaming) === 'error'
          ? 'error'
          : 'done'

    return [
      {
        id: `${pair.request.id}-command`,
        type: 'command',
        status: commandStatus,
        toolName,
        command,
        exitCode: commandOutput.exitCode,
        summary: commandOutput.summary,
        output: commandOutput.preview,
        rawOutput: commandOutput.rawOutput,
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

function makeMarkdownBlock(id: string, content: string, isStreaming?: boolean): MarkdownBlock | null {
  if (!content)
    return null

  return {
    id,
    type: 'markdown',
    content,
    isStreaming,
  }
}

function buildOrderedContentBlocks({
  message,
  toolCallPairs,
  isStreaming,
}: Pick<BuildMessageBlocksOptions, 'message' | 'toolCallPairs' | 'isStreaming'>): MessageRenderBlock[] {
  if (!message.draftContent?.length)
    return []

  const blocks: MessageRenderBlock[] = []
  const segments = [...message.draftContent].sort((a, b) => a.createdAt - b.createdAt)
  const toolPairsById = new Map(
    toolCallPairs
      .map(pair => [pair.request.toolCallId, pair] as const)
      .filter((entry): entry is [string, ToolCallPair] => Boolean(entry[0])),
  )

  let markdownBuffer = ''
  let markdownIndex = 0
  const renderedToolCallIds = new Set<string>()

  const flushMarkdown = (streaming = false) => {
    const block = makeMarkdownBlock(
      `${message.uid}-markdown-${markdownIndex++}`,
      markdownBuffer,
      streaming && Boolean(markdownBuffer),
    )
    if (block) {
      blocks.push(block)
      markdownBuffer = ''
    }
  }

  for (const segment of segments) {
    if (segment.phase === 'agent') {
      if (isCosmeticLifecycleAgentSegment(segment))
        continue

      flushMarkdown(false)

      const agentStatus = segment.agentStatus === 'error'
        ? 'error'
        : segment.agentStatus === 'suggest'
          ? 'suggest'
          : 'done'

      blocks.push({
        id: `${segment.id}-agent`,
        type: 'agent',
        status: agentStatus,
        title: segment.agentName
          ? `${segment.agentName}${agentStatus === 'suggest' ? ' 给出建议' : ' 已执行'}`
          : 'Agent 已执行',
        agentName: segment.agentName,
        hook: segment.agentHook,
        description: segment.content,
      })
      continue
    }

    if ((segment.phase === 'answer' || segment.phase === 'partial') && segment.source !== 'tool') {
      markdownBuffer += segment.content
      continue
    }

    if (segment.phase !== 'tool' || segment.source !== 'model')
      continue

    flushMarkdown(false)

    if (segment.toolCallId && renderedToolCallIds.has(segment.toolCallId))
      continue

    const pair = segment.toolCallId ? toolPairsById.get(segment.toolCallId) : undefined
    if (pair) {
      blocks.push(...buildToolLikeBlocks(pair, isStreaming))
      if (segment.toolCallId)
        renderedToolCallIds.add(segment.toolCallId)
      continue
    }

    blocks.push({
      id: `${segment.id}-tool`,
      type: 'tool',
      status: !isStreaming ? 'done' : 'running',
      pair: {
        request: segment,
      },
    })
  }

  flushMarkdown(isStreaming)

  return blocks
}

function buildTimelineBlock({
  message,
  toolCallPairs,
  pendingApprovalRequest,
  content,
}: Pick<BuildMessageBlocksOptions, 'message' | 'toolCallPairs' | 'pendingApprovalRequest' | 'content'>): TimelineBlock | null {
  const items: TimelineItem[] = []
  const startedAt = message.telemetry?.execution?.startedAt ?? message.createdAt
  const lastRunStatus = message.telemetry?.execution?.lastRunStatus

  items.push({
    id: `${message.uid}-timeline-model-start`,
    kind: 'model_start',
    title: '模型开始生成',
    at: startedAt,
    status: 'done',
  })

  for (const pair of toolCallPairs) {
    const toolName = pair.request.toolName ?? 'tool'
    const command = parseCommandFromArgs(pair.request.toolArgs)
    const resultText = readResultText(pair)
    const commandOutput = parseCommandOutput(resultText)

    items.push({
      id: `${pair.request.id}-timeline-tool-call`,
      kind: 'tool_call',
      title: `工具调用：${toolName}`,
      description: command,
      at: pair.request.createdAt,
      status: pair.result ? 'done' : 'running',
    })

    if (pair.request.approvalStatus === 'pending') {
      items.push({
        id: `${pair.request.id}-timeline-approval`,
        kind: 'approval_waiting',
        title: '等待审批',
        description: toolName,
        at: pair.request.createdAt,
        status: 'running',
      })
    }

    if (command && pair.result) {
      items.push({
        id: `${pair.request.id}-timeline-command`,
        kind: 'command_done',
        title: '命令执行完成',
        description: commandOutput.summary,
        at: pair.result.createdAt,
        status: commandOutput.exitCode && commandOutput.exitCode !== 0 ? 'error' : 'done',
      })
    }
  }

  const agentSegments = [...(message.draftContent ?? [])]
    .filter(segment => segment.phase === 'agent')
    .filter(segment => !isCosmeticLifecycleAgentSegment(segment))
    .sort((a, b) => a.createdAt - b.createdAt)

  for (const segment of agentSegments) {
    items.push({
      id: `${segment.id}-timeline-agent`,
      kind: 'agent_run',
      title: segment.agentName ? `Agent 执行：${segment.agentName}` : 'Agent 执行',
      description: segment.content || segment.agentSuggestionContent,
      at: segment.createdAt,
      status: segment.agentStatus === 'error' ? 'error' : 'done',
    })
  }

  if (pendingApprovalRequest) {
    items.push({
      id: `${message.uid}-timeline-live-approval`,
      kind: 'approval_waiting',
      title: '等待审批',
      description: pendingApprovalRequest.toolName,
      status: 'running',
    })
  }

  if (content || message.status === 'done' || message.status === 'error' || message.status === 'aborted') {
    const isInterrupted = lastRunStatus === 'interrupted' || message.status === 'aborted'
    const isError = message.status === 'error' && !isInterrupted

    items.push({
      id: `${message.uid}-timeline-final`,
      kind: 'final_answer',
      title: isInterrupted
        ? '最终回答中断'
        : isError
          ? '最终回答失败'
          : '最终回答输出',
      description: isInterrupted
        ? message.telemetry?.execution?.lastRunError ?? '连接已中断，回答未完整输出。'
        : isError
          ? message.error ?? message.telemetry?.execution?.lastRunError
          : undefined,
      at: message.telemetry?.execution?.lastRunCompletedAt
        ?? message.telemetry?.execution?.completedAt
        ?? message.updatedAt,
      status: isInterrupted || isError ? 'error' : 'done',
    })
  }

  if (items.length <= 1) {
    return null
  }

  const hasMeaningfulNonTerminalStep = items.some(item =>
    item.kind !== 'model_start' && item.kind !== 'final_answer',
  )

  if (!hasMeaningfulNonTerminalStep) {
    return null
  }

  return {
    id: `${message.uid}-timeline`,
    type: 'timeline',
    items,
    totalDurationMs: (message.telemetry?.execution?.startedAt && message.telemetry?.execution?.completedAt)
      ? message.telemetry.execution.completedAt - message.telemetry.execution.startedAt
      : undefined,
    totalEstimatedTokens: message.telemetry?.usage?.totalEstimatedTokens,
  }
}

function buildAssistantStatusBlocks({
  message,
  generating,
  isPending,
  isToolRunning,
  runningTools,
}: Pick<BuildMessageBlocksOptions, 'message' | 'generating' | 'isPending' | 'isToolRunning' | 'runningTools'>) {
  const blocks: StatusBlock[] = []
  const lastRunStatus = message.telemetry?.execution?.lastRunStatus
  const lastRunError = message.telemetry?.execution?.lastRunError

  if (message.status === 'aborted' || lastRunStatus === 'aborted') {
    blocks.push({
      id: `${message.uid}-status-aborted`,
      type: 'status',
      status: 'error',
      title: '生成已中止',
      description: lastRunError ?? '当前回复在完成前被中止。',
    })
    return blocks
  }

  if (lastRunStatus === 'interrupted') {
    blocks.push({
      id: `${message.uid}-status-interrupted`,
      type: 'status',
      status: 'error',
      title: '生成过程中断',
      description: lastRunError ?? '连接中断，当前回复只输出了部分内容。',
    })
    return blocks
  }

  if (message.status === 'error') {
    blocks.push({
      id: `${message.uid}-status-error`,
      type: 'status',
      status: 'error',
      title: '生成失败',
      description: message.error ?? lastRunError ?? undefined,
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
  pendingApprovalRequest,
}: BuildMessageBlocksOptions): MessageRenderBlock[] {
  if (message.role === 'user') {
    return [{
      id: `${message.uid}-markdown`,
      type: 'markdown',
      content,
    }]
  }

  const timeline = buildTimelineBlock({ message, toolCallPairs, pendingApprovalRequest, content })
  const orderedContentBlocks = buildOrderedContentBlocks({
    message,
    toolCallPairs,
    isStreaming,
  })
  const fallbackBlocks = orderedContentBlocks.length > 0
    ? []
    : [
        ...buildAssistantStatusBlocks({
          message,
          generating,
          isPending,
          isToolRunning,
          runningTools,
        }),
        ...toolCallPairs.flatMap(pair => buildToolLikeBlocks(pair, isStreaming)),
      ]

  const blocks: MessageRenderBlock[] = [
    ...fallbackBlocks,
    ...orderedContentBlocks,
  ]

  if (pendingApprovalRequest) {
    const command = parseCommandFromArgs(pendingApprovalRequest.args)
    const hasPendingApproval = blocks.some(
      block => block.type === 'approval' && block.status === 'pending',
    )

    if (!hasPendingApproval) {
      const approvalBlock: ApprovalBlock = {
        id: `live-approval-${pendingApprovalRequest.toolName}`,
        type: 'approval',
        status: 'pending',
        title: '等待审批',
        toolName: pendingApprovalRequest.toolName,
        skillName: pendingApprovalRequest.skillName,
        command,
        args: pendingApprovalRequest.args,
        reason: pendingApprovalRequest.description,
        isLiveRequest: true,
      }

      if (orderedContentBlocks.length > 0) {
        blocks.push(approvalBlock)
      }
      else {
        blocks.unshift(approvalBlock)
      }
    }
  }

  const hasMarkdownBlock = blocks.some(block => block.type === 'markdown')
  const markdownContent = content || (isError ? (message.error ?? '') : '')
  if (markdownContent && !hasMarkdownBlock) {
    const markdownBlock = makeMarkdownBlock(
      `${message.uid}-markdown`,
      markdownContent,
      isStreaming && !!content,
    )
    if (markdownBlock)
      blocks.push(markdownBlock)
  }

  if (timeline) {
    blocks.push(timeline)
  }

  return blocks
}
