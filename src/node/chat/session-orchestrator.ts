/**
 * 会话编排器（Session Orchestrator）
 * 负责编排和管理多个并发的聊天会话生命周期
 *
 * 职责：
 * - 初始化 skills 系统
 * - 创建和管理 ChatSession 实例
 * - 协调会话的启动、运行和中止
 * - 跟踪活跃会话状态
 */

import type { Message, Workspace } from '../database/schema/chat'
import { logger } from '../platform/logger'
import { ChatSession } from './session/chat-session'
import type { SessionModelConfig } from './session/session-state'
import { skillManager } from '../skills'

/**
 * 会话启动参数
 */
export interface StartSessionParams {
  chatUid: string
  modelConfig: SessionModelConfig
  userMessageContent: string
  contextMessages?: Message[]
  systemMessages?: string[]
  workspace?: Workspace[]
}

/**
 * 会话编排器
 * 管理多个并发的聊天会话
 */
export class SessionOrchestrator {
  private sessions: Map<string, ChatSession> = new Map()

  constructor() {
    // 初始化 skills 系统并启动目录监听
    skillManager.initialize()
    skillManager.watch()
    logger.info(`[SessionOrchestrator] Skills initialized: ${skillManager.size} skill(s) loaded`)
  }

  /**
   * 启动一个新的聊天会话
   */
  async startSession(params: StartSessionParams): Promise<string> {
    const { chatUid, modelConfig, userMessageContent, contextMessages = [], systemMessages = [], workspace = [] } = params

    // 创建会话
    const session = await ChatSession.create({
      chatUid,
      modelConfig,
      userMessageContent,
      contextMessages,
      systemMessages,
      workspace,
    })

    const requestId = session.getConfig().requestId

    // 保存会话
    this.sessions.set(requestId, session)

    // 异步运行会话（不阻塞）
    session.run(userMessageContent, contextMessages)
      .catch((err) => {
        logger.error(`[SessionOrchestrator] Session ${requestId} failed:`, err)
      })
      .finally(() => {
        // 清理会话
        this.sessions.delete(requestId)
      })

    return requestId
  }

  /**
   * 中止指定会话
   */
  abortSession(requestId: string): boolean {
    const session = this.sessions.get(requestId)
    if (!session) {
      logger.warn(`[SessionOrchestrator] Session ${requestId} not found for abort`)
      return false
    }

    session.abort()
    logger.info(`[SessionOrchestrator] Aborting session ${requestId}`)
    return true
  }

  /**
   * 中止指定聊天的所有会话
   */
  abortChatSessions(chatUid: string): number {
    let count = 0
    for (const [_, session] of this.sessions.entries()) {
      if (session.getConfig().chatUid === chatUid) {
        session.abort()
        count++
      }
    }
    logger.info(`[SessionOrchestrator] Aborted ${count} sessions for chat ${chatUid}`)
    return count
  }

  /**
   * 获取活跃会话数量
   */
  getActiveSessionCount(): number {
    return this.sessions.size
  }

  /**
   * 获取指定聊天的活跃会话
   */
  getChatSessions(chatUid: string): ChatSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.getConfig().chatUid === chatUid,
    )
  }
}

// 导出单例
export const sessionOrchestrator = new SessionOrchestrator()
