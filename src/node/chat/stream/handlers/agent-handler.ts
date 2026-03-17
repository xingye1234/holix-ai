/**
 * Agent 节点处理器
 * 处理 agent 节点的更新（AI 决定调用工具）
 */

import type { AIMessage } from '@langchain/core/messages'
import type { StreamContext, StreamState } from '../stream-state'
import { logger } from '../../../platform/logger'
import { BaseStreamHandler } from './base-handler'

/**
 * Agent 节点处理器
 *
 * AI 决策完毕，含完整 tool_calls
 */
export class AgentHandler extends BaseStreamHandler {
  readonly name = 'AgentHandler'

  handle(nodeUpdate: any, state: StreamState, context: StreamContext): void {
    const agentMessages: AIMessage[] = nodeUpdate?.messages ?? []

    for (const agentMsg of agentMessages) {
      const calls = agentMsg.tool_calls ?? []
      if (!calls.length)
        continue

      for (const call of calls) {
        this.recordToolCall(call, state, context)
      }
    }

    // 触发数据库更新
    if (agentMessages.length > 0) {
      context.throttledDbUpdate.addItem({
        content: state.fullContent,
        segments: [...state.draftSegments],
      })
    }
  }

  /**
   * 记录工具调用
   */
  private recordToolCall(call: any, state: StreamState, context: StreamContext): void {
    state.draftSegments.push({
      id: `${context.requestId}-tc-${call.id ?? state.segmentIndex++}`,
      content: JSON.stringify({ name: call.name, args: call.args }),
      phase: 'tool',
      source: 'model',
      delta: false,
      createdAt: this.now(),
      toolCallId: call.id,
      toolName: call.name,
      toolArgs: call.args,
    })

    // 更新工具调用状态
    state.toolStatus = {
      running: true,
      tools: [call.name],
    }

    logger.info(
      `[${this.name}] Tool call dispatched | name=${call.name} id=${call.id} args=${JSON.stringify(call.args)}`,
    )
  }
}
