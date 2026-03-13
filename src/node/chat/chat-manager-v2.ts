/**
 * 简化版 ChatManager
 * 只负责会话生命周期管理，具体逻辑委托给 ChatSession
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { Message, Workspace } from '../database/schema/chat'
import { ChatSession } from './session/chat-session'
import { skillManager } from './skills'
import { logger } from '../platform/logger'

/**
 * 会话启动参数
 */
export interface StartSessionParams {
  chatUid: string
  llm: BaseChatModel
  userMessageContent: string
  contextMessages?: Message[]
  systemMessages?: string[]
  workspace?: Workspace[]
}

/**
 * ChatManager（简化版）
 * 管理多个并发的聊天会话
 */
export class SimplifiedChatManager {
  private sessions: Map<string, ChatSession> = new Map()

  constructor() {
    // 初始化 skills 系统并启动目录监听
    skillManager.initialize()
    skillManager.watch()
    logger.info(`[SimplifiedChatManager] Skills initialized: ${skillManager.size} skill(s) loaded`)
  }

  /**
   * 启动一个新的聊天会话
   */
  async startSession(params: StartSessionParams): Promise<string> {
    const { chatUid, llm, userMessageContent, contextMessages = [], systemMessages = [], workspace = [] } = params

    // 创建会话
    const session = await ChatSession.create({
      chatUid,
      llm,
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
        logger.error(`[SimplifiedChatManager] Session ${requestId} failed:`, err)
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
      logger.warn(`[SimplifiedChatManager] Session ${requestId} not found for abort`)
      return false
    }

    session.abort()
    logger.info(`[SimplifiedChatManager] Aborting session ${requestId}`)
    return true
  }

  /**
   * 中止指定聊天的所有会话
   */
  abortChatSessions(chatUid: string): number {
    let count = 0
    for (const [requestId, session] of this.sessions.entries()) {
      if (session.getConfig().chatUid === chatUid) {
        session.abort()
        count++
      }
    }
    logger.info(`[SimplifiedChatManager] Aborted ${count} sessions for chat ${chatUid}`)
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
export const simplifiedChatManager = new SimplifiedChatManager()
