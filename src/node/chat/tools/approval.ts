/**
 * Tool Approval Interceptor
 *
 * 对标记为高风险（dangerous: true）的 skill 工具，在执行前通过 SSE callback
 * 机制向前端发起审批请求，等待用户批准或拒绝后再决定是否真正执行工具。
 */

import type { DynamicStructuredTool } from '@langchain/core/tools'
import { DynamicStructuredTool as DynamicStructuredToolImpl } from '@langchain/core/tools'
import { logger } from '../../platform/logger'
import { updateAwait } from '../../platform/update'
import { approvalState } from './approval-state'

/** 发送给前端的审批请求载荷 */
export interface ToolApprovalRequestPayload {
  /** LangChain tool_call_id（可选，由 agent 层传递） */
  toolCallId?: string
  /** 工具名称 */
  toolName: string
  /** 所属 skill 名称 */
  skillName: string
  /** 工具描述 */
  description: string
  /** 本次调用的具体参数 */
  args: Record<string, unknown>
}

/**
 * 将一个 DynamicStructuredTool 包装为需要用户审批的版本。
 *
 * 包装后的工具在被 agent 调用时会先暂停，向前端发送 callback 事件，
 * 等待用户点击"批准"或"拒绝"后再决定是否继续执行。
 *
 * @param tool      原始工具
 * @param skillName 归属的 skill 名称（用于 UI 展示）
 */
export function wrapWithApproval(tool: DynamicStructuredTool, skillName: string): DynamicStructuredTool {
  const originalFunc = (tool as any).func as (...args: any[]) => Promise<string>

  const wrapped = new DynamicStructuredToolImpl({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    func: async (input: Record<string, unknown>) => {
      // ① Node 侧先检查审批状态，无需渲染进程交互
      if (approvalState.isApproved(skillName)) {
        const reason = approvalState.isAlwaysAllowed(skillName) ? '始终允许' : '本次对话已允许'
        logger.info(
          `[ToolApproval] "${tool.name}" (skill: ${skillName}) auto-approved [${reason}], executing directly`,
        )
        return originalFunc(input)
      }

      // ② 未在允许列表，向渲染进程发起弹窗审批
      const payload: ToolApprovalRequestPayload = {
        toolName: tool.name,
        skillName,
        description: tool.description,
        args: input,
      }

      logger.info(
        `[ToolApproval] Requesting user approval for "${tool.name}" (skill: ${skillName})`,
      )

      let approved = false
      try {
        approved = await updateAwait<boolean>('tool.approval.request', payload)
      }
      catch (err) {
        logger.warn(
          `[ToolApproval] Approval request failed for "${tool.name}": ${String(err)}`,
        )
        approved = false
      }

      if (!approved) {
        logger.info(`[ToolApproval] Tool "${tool.name}" denied by user`)
        return `[操作被拒绝：用户拒绝了工具 "${tool.name}" 的执行请求。请告知用户可以手动执行此操作，或者使用其他不需要高权限的替代方式完成任务。]`
      }

      logger.info(`[ToolApproval] Tool "${tool.name}" approved, proceeding with execution`)
      return originalFunc(input)
    },
  })

  return wrapped
}
