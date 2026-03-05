/**
 * Tool Approval Store
 *
 * 管理工具调用审批的前端状态。
 * 当高风险 skill 的工具被 AI 调用时，服务端通过 SSE callback 向前端发起审批请求，
 * 前端弹出确认弹窗等待用户决策，再将结果返回给服务端。
 */

import { create } from 'zustand'

const ALLOWED_SKILLS_KEY = 'tool-approval:allowed-skills'

function loadAllowedSkills(): Set<string> {
  try {
    const raw = localStorage.getItem(ALLOWED_SKILLS_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr))
        return new Set<string>(arr)
    }
  }
  catch {}
  return new Set()
}

function saveAllowedSkills(skills: Set<string>) {
  try {
    localStorage.setItem(ALLOWED_SKILLS_KEY, JSON.stringify([...skills]))
  }
  catch {}
}

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
  /** 本次调用的具体参数 */
  args: Record<string, unknown>
  /** resolve 函数，批准时调用 true，拒绝时调用 false */
  resolve: (approved: boolean) => void
}

interface ToolApprovalStore {
  /** 当前等待用户审批的请求，null 表示无待处理 */
  pendingRequest: ToolApprovalRequest | null
  /** 本次会话中已永久允许的 skill 名称集合 */
  allowedSkills: Set<string>
  /** 是否已对本次对话全部允许 */
  allowAllForSession: boolean
  /** 内部：设置待处理请求（由注册的 command handler 调用） */
  _setPendingRequest: (req: ToolApprovalRequest) => void
  /** 用户点击批准（仅本次） */
  approve: () => void
  /** 用户点击拒绝 */
  deny: () => void
  /** 批准并永久允许该 skill 的所有工具调用 */
  approveAlwaysForSkill: () => void
  /** 批准并允许本次对话所有工具调用 */
  approveAllForSession: () => void
}

export const useToolApprovalStore = create<ToolApprovalStore>((set, get) => ({
  pendingRequest: null,
  allowedSkills: loadAllowedSkills(),
  allowAllForSession: false,

  _setPendingRequest: (req) => {
    const { allowAllForSession, allowedSkills } = get()
    // 已设置全部允许或该 skill 已在白名单中，直接静默批准
    if (allowAllForSession || allowedSkills.has(req.skillName)) {
      req.resolve(true)
      return
    }
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
      const newAllowedSkills = new Set(get().allowedSkills)
      newAllowedSkills.add(req.skillName)
      saveAllowedSkills(newAllowedSkills)
      req.resolve(true)
      set({ pendingRequest: null, allowedSkills: newAllowedSkills })
    }
  },

  approveAllForSession: () => {
    const req = get().pendingRequest
    if (req) {
      req.resolve(true)
      set({ pendingRequest: null, allowAllForSession: true })
    }
  },
}))
