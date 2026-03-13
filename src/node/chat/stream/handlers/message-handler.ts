/**
 * Messages 模式处理器
 * 处理 LangChain Agent stream 的 "messages" 模式
 */

import type { AIMessageChunk, ToolMessage } from '@langchain/core/messages'
import type { StreamContext, StreamState } from '../stream-state'
import { BaseStreamHandler } from './base-handler'
import { contentExtractor } from '../../message/content-extractor'
import { logger } from '../../../platform/logger'
import util from 'node:util'

/**
 * Messages 模式处理器
 *
 * 每个 chunk 格式为 [BaseMessageChunk, metadata]
 * - msgType='ai', content → AI 文本增量，累积并推送流式更新
 * - msgType='ai', tool_call_chunks → 工具调用参数增量 token，仅日志跟踪
 * - msgType='tool' → 工具结果（流式），仅日志跟踪
 */
export class MessageHandler extends BaseStreamHandler {
  readonly name = 'MessageHandler'

  handle(chunk: unknown, state: StreamState, context: StreamContext): void {
    const [msg, metadata] = (Array.isArray(chunk) ? chunk : [chunk, {}]) as [any, Record<string, any>]
    const nodeId: string = metadata?.langgraph_node ?? 'unknown'
    const msgType: string = msg?.getType?.() ?? ''

    logger.debug(
      `[${this.name}] messages | node=${nodeId} type=${msgType}`,
      util.inspect(msg, { depth: 3, colors: true }),
    )

    if (msgType === 'ai') {
      this.handleAIMessage(msg as AIMessageChunk, state, context)
    }
    else if (msgType === 'tool') {
      this.handleToolMessage(msg as ToolMessage, state, context)
    }
    else {
      logger.debug(`[${this.name}] Unexpected message type: ${msgType}`)
    }
  }

  /**
   * 处理 AI 消息
   */
  private handleAIMessage(aiChunk: AIMessageChunk, state: StreamState, context: StreamContext): void {
    // 处理工具调用参数的增量 token
    if (aiChunk.tool_call_chunks?.length) {
      for (const tc of aiChunk.tool_call_chunks) {
        logger.debug(
          `[${this.name}] tool_call_chunk | name=${tc.name ?? '?'} id=${tc.id ?? '?'} args_delta=${tc.args}`,
        )
      }
      return
    }

    // 处理文本内容
    if (aiChunk.content) {
      const textDelta = contentExtractor.extractTextDelta(aiChunk.content)
      if (textDelta) {
        this.applyTextDelta(textDelta, state, context)
      }
    }
  }

  /**
   * 处理工具消息
   */
  private handleToolMessage(toolMsg: ToolMessage, state: StreamState, context: StreamContext): void {
    const len = typeof toolMsg.content === 'string'
      ? toolMsg.content.length
      : JSON.stringify(toolMsg.content).length

    logger.debug(
      `[${this.name}] ToolMessage via messages | tool_call_id=${toolMsg.tool_call_id} content_len=${len}`,
    )
  }

  /**
   * 应用文本增量
   */
  private applyTextDelta(textDelta: string, state: StreamState, context: StreamContext): void {
    state.fullContent += textDelta
    state.draftSegments.push({
      id: this.generateSegmentId(context, state),
      content: textDelta,
      phase: 'answer',
      source: 'model',
      delta: true,
      createdAt: this.now(),
    })
  }
}
