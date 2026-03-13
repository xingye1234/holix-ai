/**
 * 流处理器基类
 * 定义所有处理器的通用接口
 */

import type { StreamContext, StreamState } from '../stream-state'

/**
 * 流处理器接口
 */
export interface StreamHandler {
  /**
   * 处理流数据块
   * @param chunk 流数据块
   * @param state 流状态（可变）
   * @param context 流上下文（只读）
   */
  handle(chunk: unknown, state: StreamState, context: StreamContext): void

  /**
   * 处理器名称（用于日志）
   */
  readonly name: string
}

/**
 * 抽象基类
 */
export abstract class BaseStreamHandler implements StreamHandler {
  abstract readonly name: string

  abstract handle(chunk: unknown, state: StreamState, context: StreamContext): void

  /**
   * 生成唯一的片段 ID
   */
  protected generateSegmentId(context: StreamContext, state: StreamState): string {
    return `${context.requestId}-${state.segmentIndex++}`
  }

  /**
   * 获取当前时间戳
   */
  protected now(): number {
    return Date.now()
  }
}
