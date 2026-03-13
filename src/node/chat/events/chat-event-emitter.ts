/**
 * 聊天事件发射器
 * 解耦消息更新和事件推送逻辑
 */

import type { Message } from '../../database/schema/chat'
import type { MessageStreamingEvent, MessageUpdateEvent } from '../message/message-types'
import { update } from '../../platform/update'
import { logger } from '../../platform/logger'

/**
 * 聊天事件类型
 */
export type ChatEventType =
  | 'message.created'
  | 'message.updated'
  | 'message.streaming'
  | 'message.deleted'
  | 'chat.created'
  | 'chat.updated'
  | 'chat.deleted'

/**
 * 聊天事件数据
 */
export type ChatEventData =
  | { type: 'message.created', chatUid: string, message: Message }
  | { type: 'message.updated', data: MessageUpdateEvent }
  | { type: 'message.streaming', data: MessageStreamingEvent }
  | { type: 'message.deleted', chatUid: string, messageUid: string }
  | { type: 'chat.created', chatUid: string }
  | { type: 'chat.updated', chatUid: string, updates: Record<string, any> }
  | { type: 'chat.deleted', uid: string }

/**
 * 聊天事件发射器
 */
export class ChatEventEmitter {
  /**
   * 发射消息创建事件
   */
  emitMessageCreated(chatUid: string, message: Message): void {
    logger.debug(`[ChatEventEmitter] message.created | chatUid=${chatUid} messageUid=${message.uid}`)
    update('message.created', { chatUid, message })
  }

  /**
   * 发射消息更新事件
   */
  emitMessageUpdated(event: MessageUpdateEvent): void {
    logger.debug(`[ChatEventEmitter] message.updated | chatUid=${event.chatUid} messageUid=${event.messageUid}`)
    update('message.updated', event)
  }

  /**
   * 发射消息流式更新事件
   */
  emitMessageStreaming(event: MessageStreamingEvent): void {
    // 流式更新频繁，使用 debug 级别
    logger.debug(`[ChatEventEmitter] message.streaming | chatUid=${event.chatUid} delta_len=${event.delta.length}`)
    update('message.streaming', event)
  }

  /**
   * 发射消息删除事件
   */
  emitMessageDeleted(chatUid: string, messageUid: string): void {
    logger.debug(`[ChatEventEmitter] message.deleted | chatUid=${chatUid} messageUid=${messageUid}`)
    update('message.deleted', { chatUid, messageUid })
  }

  /**
   * 发射会话创建事件
   */
  emitChatCreated(chatUid: string): void {
    logger.debug(`[ChatEventEmitter] chat.created | chatUid=${chatUid}`)
    update('chat.created', { chatUid })
  }

  /**
   * 发射会话更新事件
   */
  emitChatUpdated(chatUid: string, updates: Record<string, any>): void {
    logger.debug(`[ChatEventEmitter] chat.updated | chatUid=${chatUid}`)
    update('chat.updated', { chatUid, updates })
  }

  /**
   * 发射会话删除事件
   */
  emitChatDeleted(uid: string): void {
    logger.debug(`[ChatEventEmitter] chat.deleted | uid=${uid}`)
    update('chat.deleted', { uid })
  }
}

// 导出单例
export const chatEventEmitter = new ChatEventEmitter()
