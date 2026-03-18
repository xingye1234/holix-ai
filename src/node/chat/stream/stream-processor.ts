/**
 * 流处理器
 * 协调所有流处理逻辑
 */

import type { DraftContent } from '../../database/schema/chat'
import type { StreamContext, StreamMode, StreamState } from './stream-state'
import { logger } from '../../platform/logger'
import { chatEventEmitter } from '../events/chat-event-emitter'
import { toolCallTracker } from '../tools/tool-call-tracker'
import { MessageHandler } from './handlers/message-handler'
import { UpdateHandler } from './handlers/update-handler'

/**
 * 流处理器配置
 */
export interface StreamProcessorConfig {
  chatUid: string
  requestId: string
  assistantMessageUid: string
  throttledDbUpdate: StreamContext['throttledDbUpdate']
}

/**
 * 流处理器
 */
export class StreamProcessor {
  private context: StreamContext
  private state: StreamState
  private messageHandler = new MessageHandler()
  private updateHandler = new UpdateHandler()

  constructor(config: StreamProcessorConfig) {
    this.context = {
      chatUid: config.chatUid,
      requestId: config.requestId,
      assistantMessageUid: config.assistantMessageUid,
      throttledDbUpdate: config.throttledDbUpdate,
    }

    this.state = {
      fullContent: '',
      segmentIndex: 0,
      draftSegments: [],
      toolStatus: {
        running: false,
        tools: [],
      },
    }
  }

  /**
   * 处理流数据块
   */
  processChunk(streamMode: StreamMode, chunk: unknown): void {
    if (streamMode === 'messages') {
      this.messageHandler.handle(chunk, this.state, this.context)
      this.pushStreamingUpdate()
    }
    else if (streamMode === 'updates') {
      this.updateHandler.handle(chunk, this.state, this.context)
      // updates 模式下，handler 内部会触发 throttledDbUpdate
      // 这里只需要推送流式更新事件
      this.pushStreamingUpdate()
    }
    else {
      logger.warn(`[StreamProcessor] Unknown stream mode: ${streamMode}`)
    }
  }

  /**
   * 推送流式更新事件
   */
  private pushStreamingUpdate(): void {
    // 只有当有新内容时才推送
    if (this.state.draftSegments.length === 0) {
      return
    }

    // 获取最后一个片段作为 delta
    const lastSegment = this.state.draftSegments[this.state.draftSegments.length - 1]
    const delta = lastSegment.delta ? lastSegment.content : ''

    // 构建工具调用轨迹
    const toolCalls = toolCallTracker.buildToolCallTraces(this.state.draftSegments)

    // 发射流式更新事件
    chatEventEmitter.emitMessageStreaming({
      chatUid: this.context.chatUid,
      messageUid: this.context.assistantMessageUid,
      content: this.state.fullContent,
      delta,
      draftContent: [...this.state.draftSegments],
      toolCalls,
      toolStatus: this.state.toolStatus,
    })
  }

  /**
   * 获取最终状态
   */
  getFinalState(): { content: string, draftSegments: DraftContent } {
    return {
      content: this.state.fullContent,
      draftSegments: this.state.draftSegments,
    }
  }

  /**
   * 获取上下文
   */
  getContext(): StreamContext {
    return this.context
  }
}
