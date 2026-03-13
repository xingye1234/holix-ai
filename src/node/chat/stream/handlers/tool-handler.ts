/**
 * Tools 节点处理器
 * 处理 tools 节点的更新（工具执行完毕）
 */

import type { ToolMessage } from '@langchain/core/messages'
import type { StreamContext, StreamState } from '../stream-state'
import { BaseStreamHandler } from './base-handler'
import { logger } from '../../../platform/logger'

/**
 * Tools 节点处理器
 *
 * 工具执行完毕，含 ToolMessage[]
 */
export class ToolHandler extends BaseStreamHandler {
  readonly name = 'ToolHandler'

  handle(nodeUpdate: any, state: StreamState, context: StreamContext): void {
    const toolMessages: ToolMessage[] = nodeUpdate?.messages ?? []

    for (const toolMsg of toolMessages) {
      this.recordToolResult(toolMsg, state, context)
    }

    // 触发数据库更新
    if (toolMessages.length > 0) {
      context.throttledDbUpdate.addItem({
        content: state.fullContent,
        segments: [...state.draftSegments],
      })
    }
  }

  /**
   * 记录工具结果
   */
  private recordToolResult(toolMsg: ToolMessage, state: StreamState, context: StreamContext): void {
    const content = typeof toolMsg.content === 'string'
      ? toolMsg.content
      : JSON.stringify(toolMsg.content)

    state.draftSegments.push({
      id: `${context.requestId}-tr-${toolMsg.tool_call_id ?? state.segmentIndex++}`,
      content,
      phase: 'tool',
      source: 'tool',
      delta: false,
      createdAt: this.now(),
      toolCallId: toolMsg.tool_call_id,
    })

    logger.info(
      `[${this.name}] Tool result received | tool_call_id=${toolMsg.tool_call_id} content_len=${content.length}`,
    )
  }
}
