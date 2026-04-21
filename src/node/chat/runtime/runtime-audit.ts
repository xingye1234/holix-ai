import { AsyncLocalStorage } from 'node:async_hooks'
import type { DraftSegment } from '../../database/schema/chat'
import { nanoid } from 'nanoid'
import { updateAwait } from '../../platform/update'

export interface RuntimeAuditApprovalRequest {
  toolName: string
  skillName: string
  description: string
  args: Record<string, unknown>
  messageUid?: string
}

export interface RuntimeAuditContext {
  assistantMessageUid: string
  chatUid: string
  requestId: string
  appendSegment: (segment: DraftSegment) => void
  updateSegment: (segmentId: string, patch: Partial<DraftSegment>) => void
  requestApproval: (payload: RuntimeAuditApprovalRequest) => Promise<boolean>
}

interface AuditedOperationOptions<T> {
  args: Record<string, unknown>
  description: string
  execute: () => Promise<T>
  formatResult: (result: T) => string
  onDenied: () => Promise<T> | T
  requireApproval?: boolean
  toolName: string
}

const runtimeAuditStorage = new AsyncLocalStorage<RuntimeAuditContext>()

export function runWithRuntimeAudit<T>(
  context: RuntimeAuditContext,
  callback: () => Promise<T>,
): Promise<T> {
  return runtimeAuditStorage.run(context, callback)
}

export function getRuntimeAuditContext() {
  return runtimeAuditStorage.getStore()
}

export async function auditedOperation<T>(
  options: AuditedOperationOptions<T>,
): Promise<T> {
  const context = getRuntimeAuditContext()
  if (!context) {
    return options.execute()
  }

  const toolCallId = `runtime-${nanoid(10)}`
  const requestSegmentId = `${context.requestId}-runtime-${nanoid(8)}`
  const requireApproval = options.requireApproval ?? false

  context.appendSegment({
    id: requestSegmentId,
    content: JSON.stringify({ name: options.toolName, args: options.args }),
    phase: 'tool',
    source: 'model',
    delta: false,
    createdAt: Date.now(),
    toolCallId,
    toolName: options.toolName,
    toolArgs: options.args,
    approvalStatus: requireApproval ? 'pending' : undefined,
  })

  if (requireApproval) {
    const approved = await context.requestApproval({
      toolName: options.toolName,
      skillName: 'runtime',
      description: options.description,
      args: options.args,
      messageUid: context.assistantMessageUid,
    })

    context.updateSegment(requestSegmentId, {
      approvalStatus: approved ? 'approved' : 'denied',
    })

    if (!approved) {
      const deniedResult = await options.onDenied()
      context.appendSegment({
        id: `${context.requestId}-runtime-result-${nanoid(8)}`,
        content: `[操作被拒绝：用户拒绝了 "${options.toolName}" 的执行请求。]`,
        phase: 'tool',
        source: 'tool',
        delta: false,
        createdAt: Date.now(),
        toolCallId,
        toolName: options.toolName,
      })
      return deniedResult
    }
  }

  try {
    const result = await options.execute()
    context.appendSegment({
      id: `${context.requestId}-runtime-result-${nanoid(8)}`,
      content: options.formatResult(result),
      phase: 'tool',
      source: 'tool',
      delta: false,
      createdAt: Date.now(),
      toolCallId,
      toolName: options.toolName,
    })
    return result
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    context.appendSegment({
      id: `${context.requestId}-runtime-result-${nanoid(8)}`,
      content: `[操作失败：${message}]`,
      phase: 'tool',
      source: 'tool',
      delta: false,
      createdAt: Date.now(),
      toolCallId,
      toolName: options.toolName,
    })
    throw error
  }
}

export function createRuntimeAuditApprovalRequester() {
  return async (payload: RuntimeAuditApprovalRequest) =>
    await updateAwait<boolean>('tool.approval.request', payload)
}
