/**
 * Updates 模式处理器
 * 处理 LangChain Agent stream 的 "updates" 模式
 */

import type { StreamContext, StreamState } from '../stream-state'
import { BaseStreamHandler } from './base-handler'
import { AgentHandler } from './agent-handler'
import { ToolHandler } from './tool-handler'
import { logger } from '../../../platform/logger'
import util from 'node:util'

/**
 * Updates 模式处理器
 *
 * 每个 chunk 格式为 { [nodeName]: stateUpdate }
 * - 'agent' 节点 → AI 决策完毕，含完整 tool_calls
 * - 'tools' 节点 → 工具执行完毕，含 ToolMessage[]
 */
export class UpdateHandler extends BaseStreamHandler {
  readonly name = 'UpdateHandler'

  private agentHandler = new AgentHandler()
  private toolHandler = new ToolHandler()

  handle(chunk: unknown, state: StreamState, context: StreamContext): void {
    const updates = chunk as Record<string, any>

    for (const [nodeName, nodeUpdate] of Object.entries(updates)) {
      logger.debug(
        `[${this.name}] updates | node=${nodeName}`,
        util.inspect(nodeUpdate, { depth: 3, colors: true }),
      )

      if (nodeName === 'agent') {
        this.agentHandler.handle(nodeUpdate, state, context)
      }
      else if (nodeName === 'tools') {
        this.toolHandler.handle(nodeUpdate, state, context)
      }
      else {
        logger.debug(`[${this.name}] Unknown update node: ${nodeName}`)
      }
    }
  }
}
