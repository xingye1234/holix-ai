/**
 * 工具调用追踪器
 * 负责构建和管理工具调用轨迹
 */

import type { DraftContent, ToolCallTrace } from '../../database/schema/chat'
import { logger } from '../../platform/logger'

/**
 * 工具调用追踪器
 */
export class ToolCallTracker {
  /**
   * 从草稿片段构建工具调用轨迹
   */
  buildToolCallTraces(draftSegments: DraftContent): ToolCallTrace[] {
    // 提取所有工具调用请求（source='model', phase='tool'）
    const requests = draftSegments
      .filter(s => s.phase === 'tool' && s.source === 'model')
      .sort((a, b) => a.createdAt - b.createdAt)

    // 构建工具结果映射（source='tool', phase='tool'）
    const resultMap = new Map<string, (typeof draftSegments)[number]>()
    for (const segment of draftSegments) {
      if (segment.phase === 'tool' && segment.source === 'tool' && segment.toolCallId) {
        resultMap.set(segment.toolCallId, segment)
      }
    }

    // 组合请求和结果
    const traces = requests.map((request) => {
      const result = request.toolCallId ? resultMap.get(request.toolCallId) : undefined

      return {
        id: request.id,
        toolCallId: request.toolCallId,
        toolName: request.toolName ?? 'tool',
        toolArgs: request.toolArgs,
        requestContent: request.content,
        resultContent: result?.content,
        status: result ? 'completed' : 'called',
        createdAt: request.createdAt,
        updatedAt: result?.createdAt ?? request.createdAt,
      } as ToolCallTrace
    })

    logger.debug(`[ToolCallTracker] Built ${traces.length} tool call traces`)

    return traces
  }

  /**
   * 提取工具调用统计信息
   */
  getToolCallStats(traces: ToolCallTrace[]): {
    total: number
    completed: number
    pending: number
    byTool: Record<string, number>
  } {
    const stats = {
      total: traces.length,
      completed: traces.filter(t => t.status === 'completed').length,
      pending: traces.filter(t => t.status === 'called').length,
      byTool: {} as Record<string, number>,
    }

    for (const trace of traces) {
      stats.byTool[trace.toolName] = (stats.byTool[trace.toolName] || 0) + 1
    }

    return stats
  }

  /**
   * 检查是否有待处理的工具调用
   */
  hasPendingToolCalls(traces: ToolCallTrace[]): boolean {
    return traces.some(t => t.status === 'called')
  }

  /**
   * 获取最后一个工具调用
   */
  getLastToolCall(traces: ToolCallTrace[]): ToolCallTrace | undefined {
    return traces[traces.length - 1]
  }
}

// 导出单例
export const toolCallTracker = new ToolCallTracker()
