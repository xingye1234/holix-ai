/**
 * 单个聊天会话
 * 封装会话的完整生命周期
 */

import type { Message, Workspace } from '../../database/schema/chat'
import type { SessionConfig, SessionModelConfig, SessionStatus } from './session-state'
import { AsyncBatcher } from '@tanstack/pacer'
import { nanoid } from 'nanoid'
import { configStore } from '../../platform/config'
import { logger } from '../../platform/logger'
import { chatEventEmitter } from '../events/chat-event-emitter'
import { messagePersister } from '../message/message-persister'
import { StreamProcessor } from '../stream/stream-processor'
import { LangChainTelemetryHandler } from '../telemetry/langchain-telemetry-handler'
import { toolCallTracker } from '../tools/tool-call-tracker'
import { SessionBuilder } from './session-builder'

/**
 * 会话启动参数
 */
export interface SessionStartParams {
  chatUid: string
  modelConfig: SessionModelConfig
  userMessageContent: string
  contextMessages?: Message[]
  systemMessages?: string[]
  workspace?: Workspace[]
}

/**
 * 聊天会话类
 */
export class ChatSession {
  private config: SessionConfig
  private status: SessionStatus = 'running'
  private abortController: AbortController
  private startTime: number

  constructor(config: SessionConfig) {
    this.config = config
    this.abortController = new AbortController()
    this.startTime = Date.now()
  }

  /**
   * 创建新会话
   */
  static async create(params: SessionStartParams): Promise<ChatSession> {
    const requestId = nanoid()
    const streamId = nanoid()

    // 获取下一个序号
    const seq = await messagePersister.getNextSeq(params.chatUid)

    // 创建 Assistant 消息占位符
    const assistantMessage = await messagePersister.createMessage({
      chatUid: params.chatUid,
      seq,
      role: 'assistant',
      kind: 'message',
      content: '',
      status: 'pending',
      requestId,
      streamId,
    })

    // 创建会话配置
    const config: SessionConfig = {
      chatUid: params.chatUid,
      requestId,
      streamId,
      assistantMessageUid: assistantMessage.uid,
      modelConfig: params.modelConfig,
      systemMessages: params.systemMessages?.map(msg => ({ content: msg } as any)),
      workspace: params.workspace,
    }

    const session = new ChatSession(config)

    // 通知渲染进程：消息已创建
    chatEventEmitter.emitMessageCreated(params.chatUid, assistantMessage)

    return session
  }

  /**
   * 运行会话
   */
  async run(userMessageContent: string, contextMessages: Message[] = []): Promise<void> {
    const { chatUid, requestId, assistantMessageUid, modelConfig } = this.config

    // 创建节流的数据库更新器
    const throttledDbUpdate = this.createThrottledDbUpdater()

    try {
      // 更新状态为 streaming
      await messagePersister.updateStatus(assistantMessageUid, 'streaming')
      chatEventEmitter.emitMessageUpdated({
        chatUid,
        messageUid: assistantMessageUid,
        updates: { status: 'streaming' },
      })

      // 构建会话
      const builder = new SessionBuilder({
        modelConfig,
        systemMessages: this.config.systemMessages?.map(m => m.content as string),
        workspace: this.config.workspace,
      })

      // 构建 Agent 和消息
      const agent = await builder.buildAgent(chatUid)
      const messages = builder.buildMessages(contextMessages, userMessageContent)
      const context = builder.buildContext(chatUid)
      const telemetryHandler = new LangChainTelemetryHandler({
        provider: modelConfig.provider,
        model: modelConfig.model,
      })

      // 创建流处理器
      const streamProcessor = new StreamProcessor({
        chatUid,
        requestId,
        assistantMessageUid,
        throttledDbUpdate,
      })

      // 开始流式处理
      const stream = await agent.stream(
        { messages },
        {
          signal: this.abortController.signal,
          streamMode: ['messages', 'updates'],
          context,
          callbacks: [telemetryHandler],
        },
      )

      // 处理流数据
      for await (const [streamMode, chunk] of stream) {
        if (this.status === 'aborted') {
          logger.info(`[ChatSession] Session ${requestId} was aborted`)
          throttledDbUpdate.cancel()
          return
        }

        // 添加详细的调试日志
        logger.info(
          `[ChatSession] Stream chunk | mode=${streamMode} | keys=${chunk ? Object.keys(chunk).join(',') : 'null'}`,
        )

        streamProcessor.processChunk(streamMode as any, chunk)
      }

      // 获取最终状态
      const { content, draftSegments } = streamProcessor.getFinalState()

      logger.info(`[ChatSession] Stream completed for session ${requestId}`)

      // 等待所有待处理的更新完成
      await throttledDbUpdate.flush()

      // 构建工具调用轨迹
      const toolCalls = toolCallTracker.buildToolCallTraces(draftSegments)

      // 最终化消息
      await messagePersister.finalizeMessage(
        assistantMessageUid,
        content,
        draftSegments,
        toolCalls,
        telemetryHandler.snapshot(),
      )

      this.status = 'completed'

      // 通知渲染进程
      chatEventEmitter.emitMessageUpdated({
        chatUid,
        messageUid: assistantMessageUid,
        updates: {
          status: 'done',
          content,
          draftContent: draftSegments,
          toolCalls,
          telemetry: telemetryHandler.snapshot(),
        },
      })

      logger.info(
        `[ChatSession] Session ${requestId} completed with ${content.length} chars (${draftSegments.length} segments)`,
      )
    }
    catch (error: any) {
      await this.handleError(error, throttledDbUpdate)
    }
  }

  /**
   * 中止会话
   */
  abort(): void {
    this.status = 'aborted'
    this.abortController.abort()
    logger.info(`[ChatSession] Aborting session ${this.config.requestId}`)
  }

  /**
   * 获取会话状态
   */
  getStatus(): SessionStatus {
    return this.status
  }

  /**
   * 获取会话配置
   */
  getConfig(): SessionConfig {
    return this.config
  }

  /**
   * 创建节流的数据库更新器
   */
  private createThrottledDbUpdater() {
    return new AsyncBatcher<{ content: string, segments: any[] }>(
      async (items) => {
        const latest = items[items.length - 1]
        try {
          await messagePersister.updateContentAndDraft(
            this.config.assistantMessageUid,
            latest.content,
            latest.segments,
          )
        }
        catch (error) {
          logger.error(
            `[ChatSession] Failed to update message ${this.config.assistantMessageUid}:`,
            error,
          )
        }
      },
      {
        maxSize: 100,
        wait: 300,
      },
    )
  }

  /**
   * 处理错误
   */
  private async handleError(error: any, throttledDbUpdate: any): Promise<void> {
    const { chatUid, requestId, assistantMessageUid } = this.config

    // 取消节流队列
    try {
      throttledDbUpdate?.cancel()
    }
    catch (e) {
      logger.warn(`[ChatSession] Failed to cancel throttledDbUpdate: ${String(e)}`)
    }

    // 确保流被中止
    if (!this.abortController.signal.aborted) {
      try {
        this.abortController.abort()
      }
      catch {
        /* ignore */
      }
    }

    // 区分用户中止和实际错误
    const isAbort = error?.name === 'AbortError' || this.status === 'aborted'

    if (isAbort) {
      await messagePersister.markAsAborted(assistantMessageUid)
      this.status = 'aborted'
      chatEventEmitter.emitMessageUpdated({
        chatUid,
        messageUid: assistantMessageUid,
        updates: { status: 'aborted' },
      })
      logger.info(`[ChatSession] Session ${requestId} was aborted by user`)
      return
    }

    // 真实错误处理
    const errMsg = error?.message ?? String(error ?? 'Unknown error')
    await messagePersister.markAsError(assistantMessageUid, errMsg)
    this.status = 'error'
    chatEventEmitter.emitMessageUpdated({
      chatUid,
      messageUid: assistantMessageUid,
      updates: { status: 'error', error: errMsg },
    })

    logger.error(`[ChatSession] Session ${requestId} encountered error:`, error)
  }
}
