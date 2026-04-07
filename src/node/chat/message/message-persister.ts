/**
 * 消息持久化服务
 * 负责消息的数据库操作
 */

import type { DraftContent, Message, MessageTelemetry, ToolCallTrace } from '../../database/schema/chat'
import type { MessageStatus } from './message-types'
import {
  createMessage,
  getLatestMessages,
  updateMessage,
} from '../../database/message-operations'
import { logger } from '../../platform/logger'

/**
 * 消息持久化服务
 */
export class MessagePersister {
  /**
   * 创建新消息
   */
  async createMessage(params: {
    chatUid: string
    seq: number
    role: 'user' | 'assistant' | 'system' | 'tool'
    kind: string
    content?: string
    status?: MessageStatus
    requestId?: string
    streamId?: string
    telemetry?: MessageTelemetry
  }): Promise<Message> {
    logger.debug(`[MessagePersister] Creating message | chatUid=${params.chatUid} seq=${params.seq}`)

    return await createMessage({
      chatUid: params.chatUid,
      seq: params.seq,
      role: params.role,
      kind: params.kind,
      content: params.content || '',
      status: params.status || 'pending',
      requestId: params.requestId,
      streamId: params.streamId,
      telemetry: params.telemetry,
    })
  }

  /**
   * 更新消息状态
   */
  async updateStatus(messageUid: string, status: MessageStatus): Promise<void> {
    logger.debug(`[MessagePersister] Updating status | messageUid=${messageUid} status=${status}`)

    await updateMessage(messageUid, { status })
  }

  /**
   * 更新消息内容和草稿
   */
  async updateContentAndDraft(
    messageUid: string,
    content: string,
    draftContent: DraftContent,
  ): Promise<void> {
    logger.debug(`[MessagePersister] Updating content | messageUid=${messageUid} content_len=${content.length}`)

    await updateMessage(messageUid, {
      content,
      draftContent,
    })
  }

  /**
   * 最终化消息（流式完成后）
   */
  async finalizeMessage(
    messageUid: string,
    content: string,
    draftSegments: DraftContent,
    toolCalls: ToolCallTrace[],
    telemetry?: MessageTelemetry,
  ): Promise<void> {
    logger.info(`[MessagePersister] Finalizing message | messageUid=${messageUid} content_len=${content.length}`)

    await updateMessage(messageUid, {
      content,
      status: 'done',
      draftContent: draftSegments.map(s => ({ ...s, committed: true })),
      toolCalls,
      telemetry,
    })
  }

  /**
   * 标记消息为错误
   */
  async markAsError(messageUid: string, error: string): Promise<void> {
    logger.error(`[MessagePersister] Marking as error | messageUid=${messageUid} error=${error}`)

    await updateMessage(messageUid, {
      status: 'error',
      error,
    })
  }

  /**
   * 标记消息为已中止
   */
  async markAsAborted(messageUid: string): Promise<void> {
    logger.info(`[MessagePersister] Marking as aborted | messageUid=${messageUid}`)

    await updateMessage(messageUid, {
      status: 'aborted',
    })
  }

  /**
   * 获取下一个序号
   */
  async getNextSeq(chatUid: string): Promise<number> {
    const messages = await getLatestMessages(chatUid, 1)
    return messages.length > 0 ? messages[0].seq + 1 : 1
  }
}

// 导出单例
export const messagePersister = new MessagePersister()
