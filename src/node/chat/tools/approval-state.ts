/**
 * Node 进程侧工具审批状态管理
 *
 * - "始终允许"：持久化到 ky 表（键: tool.approval.always_allow.{skillName}）
 *   应用重启后依然生效。
 * - "本次对话全部允许"：进程内存中的布尔开关，重启后清空。
 * - "本次对话允许该 Skill"：进程内存中的 Set，重启后清空。
 */

import { kvDelete, kvGet, kvSet } from '../../database/kv-operations'
import { logger } from '../../platform/logger'

const KV_PREFIX = 'tool.approval.always_allow'

function alwaysAllowKey(skillName: string): string {
  return `${KV_PREFIX}.${skillName}`
}

/** 本次进程内的"全部允许"开关（对话级，不持久化） */
let allowAllForSession = false

/** 本次进程内已单独允许的 skill 集合（对话级，不持久化） */
const sessionAllowedSkills = new Set<string>()

export const approvalState = {
  /**
   * 检查某 skill 的工具是否已被允许执行（无需再弹窗）。
   * 优先级：本次全部允许 > 本次对话已允许该 Skill > 始终允许（KV）
   */
  isApproved(skillName: string): boolean {
    if (allowAllForSession)
      return true
    if (sessionAllowedSkills.has(skillName))
      return true
    return kvGet<boolean>(alwaysAllowKey(skillName)) === true
  },

  /** 检查该 skill 是否在 KV 中被"始终允许" */
  isAlwaysAllowed(skillName: string): boolean {
    return kvGet<boolean>(alwaysAllowKey(skillName)) === true
  },

  /**
   * 设置"始终允许"某 skill（持久化到 KV）。
   * 通常由渲染进程通过 tRPC 在用户点击"始终允许"后调用。
   */
  setAlwaysAllow(skillName: string): void {
    kvSet(alwaysAllowKey(skillName), true)
    logger.info(`[ToolApproval] Skill "${skillName}" set to always allow (persisted to KV)`)
  },

  /** 移除"始终允许"（从 KV 删除） */
  removeAlwaysAllow(skillName: string): void {
    kvDelete(alwaysAllowKey(skillName))
    logger.info(`[ToolApproval] Skill "${skillName}" removed from always-allow list`)
  },

  /**
   * 开启本次对话全部允许（进程内存）。
   * 通常由渲染进程通过 tRPC 在用户点击"本次对话全部允许"后调用。
   */
  setSessionAllowAll(): void {
    allowAllForSession = true
    logger.info('[ToolApproval] Session-wide allow-all enabled')
  },

  /**
   * 本次对话允许某个 skill（进程内存）。
   * 通常由渲染进程通过 tRPC 在用户点击"始终允许此 Skill"后调用。
   */
  setSessionAllowSkill(skillName: string): void {
    sessionAllowedSkills.add(skillName)
    logger.info(`[ToolApproval] Skill "${skillName}" allowed for this session (in-memory)`)
  },

  /** 仅用于测试 */
  _reset(): void {
    allowAllForSession = false
    sessionAllowedSkills.clear()
  },
}
