/**
 * Tool Approval Store
 *
 * 管理工具调用审批的前端状态。
 * 当高风险 skill 的工具被 AI 调用时，服务端通过 SSE callback 向前端发起审批请求，
 * 前端弹出确认弹窗等待用户决策，再将结果返回给服务端。
 *
 * 注意：审批白名单状态（始终允许 / 本次对话允许）统一由 Node 主进程维护，
 * 通过 tRPC `approval.*` 接口读写，渲染进程无需在本地缓存这些状态。
 */

import { create } from 'zustand'
import { trpcClient } from '@/lib/trpc-client'

/** 服务端发来的审批请求载荷（与 approval.ts 的 ToolApprovalRequestPayload 一致） */
export interface ToolApprovalRequest {
  /** 内部 callback id（由 SSE 事件携带） */
  callbackId: string
  /** 工具名称 */
  toolName: string
  /** 所属 skill 名称 */
  skillName: string
  /** 工具描述 */
  description: string
  /** 所属消息 uid（可选，用于消息内审批卡片精准挂载） */
  messageUid?: string
  /** 本次调用的具体参数 */
  args: Record<string, unknown>
  /** resolve 函数，批准时调用 true，拒绝时调用 false */
  resolve: (approved: boolean) => void
}

interface ToolApprovalStore {
  /** 当前等待用户审批的请求，null 表示无待处理 */
  pendingRequest: ToolApprovalRequest | null
  /** 内部：设置待处理请求（由注册的 command handler 调用） */
  _setPendingRequest: (req: ToolApprovalRequest) => void
  /** 用户点击批准（仅本次） */
  approve: () => void
  /** 用户点击拒绝 */
  deny: () => void
  /** 批准并永久允许该 skill 的所有工具调用（持久化到 Node 侧 KV） */
  approveAlwaysForSkill: () => void
  /** 批准并允许本次对话所有工具调用（Node 侧进程内存） */
  approveAllForSession: () => void
}

export const useToolApprovalStore = create<ToolApprovalStore>((set, get) => ({
  pendingRequest: null,

  _setPendingRequest: (req) => {
    // 审批白名单由 Node 主进程维护，到达此处说明尚未在白名单中，直接展示弹窗
    set({ pendingRequest: req })
  },

  approve: () => {
    const req = get().pendingRequest
    if (req) {
      req.resolve(true)
      set({ pendingRequest: null })
    }
  },

  deny: () => {
    const req = get().pendingRequest
    if (req) {
      req.resolve(false)
      set({ pendingRequest: null })
    }
  },

  approveAlwaysForSkill: () => {
    const req = get().pendingRequest
    if (req) {
      // 先解除当前请求的阻塞，再异步通知 Node 更新 KV
      req.resolve(true)
      set({ pendingRequest: null })
      trpcClient.approval.setAlwaysAllow({ skillName: req.skillName }).catch(() => {})
    }
  },

  approveAllForSession: () => {
    const req = get().pendingRequest
    if (req) {
      // 先解除当前请求的阻塞，再异步通知 Node 更新进程内存
      req.resolve(true)
      set({ pendingRequest: null })
      trpcClient.approval.setSessionAllowAll().catch(() => {})
    }
  },
}))
