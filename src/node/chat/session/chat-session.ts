/**
 * 单个聊天会话
 * 封装会话的完整生命周期
 */

import type { Message, Workspace } from '../../database/schema/chat'
import type { AgentHook, AgentResult } from '../../agents/lifecycle'
import type { SessionConfig, SessionModelConfig, SessionStatus } from './session-state'
import { AsyncBatcher } from '@tanstack/pacer'
import { nanoid } from 'nanoid'
import { getOrchestrator } from '../../agents/lifecycle'
import { updateChatTitle } from '../../database/chat-operations'
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
    let streamProcessor: StreamProcessor | null = null
    const telemetryHandler = new LangChainTelemetryHandler({
      provider: modelConfig.provider,
      model: modelConfig.model,
    })

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
      // 创建流处理器
      streamProcessor = new StreamProcessor({
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
      const lifecycleResults = await this.runLifecycleHook('onMessageCompleted')
      const lifecycleSegments = this.buildLifecycleDraftSegments(lifecycleResults, 'onMessageCompleted')

      if (lifecycleSegments.length > 0) {
        draftSegments.push(...lifecycleSegments)
      }

      await this.applyLifecycleSuggestions(lifecycleResults)

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
      await this.handleError(error, throttledDbUpdate, streamProcessor, telemetryHandler)
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
  private async handleError(
    error: any,
    throttledDbUpdate: any,
    streamProcessor?: StreamProcessor | null,
    telemetryHandler?: LangChainTelemetryHandler,
  ): Promise<void> {
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
      telemetryHandler?.markAborted(error?.message ?? 'aborted')
      await messagePersister.markAsAborted(assistantMessageUid, telemetryHandler?.snapshot())
      this.status = 'aborted'
      chatEventEmitter.emitMessageUpdated({
        chatUid,
        messageUid: assistantMessageUid,
        updates: {
          status: 'aborted',
          telemetry: telemetryHandler?.snapshot(),
        },
      })
      logger.info(`[ChatSession] Session ${requestId} was aborted by user`)
      return
    }

    // 真实错误处理
    const errMsg = error?.message ?? String(error ?? 'Unknown error')
    const interrupted = /terminated|disconnect|aborted/i.test(errMsg)
    if (interrupted) {
      telemetryHandler?.markInterrupted(errMsg)
    }
    else {
      telemetryHandler?.markError(errMsg)
    }
    const draftSegments = streamProcessor?.getFinalState().draftSegments ?? []
    const lifecycleResults = await this.runLifecycleHook('onMessageError', { error: errMsg })
    const lifecycleSegments = this.buildLifecycleDraftSegments(lifecycleResults, 'onMessageError')
    const nextDraftSegments = lifecycleSegments.length > 0 ? [...draftSegments, ...lifecycleSegments] : draftSegments

    if (nextDraftSegments.length > 0) {
      await messagePersister.updateContentAndDraft(assistantMessageUid, '', nextDraftSegments)
    }

    await messagePersister.markAsError(assistantMessageUid, errMsg, telemetryHandler?.snapshot())
    this.status = 'error'
    chatEventEmitter.emitMessageUpdated({
      chatUid,
      messageUid: assistantMessageUid,
      updates: {
        status: 'error',
        error: errMsg,
        draftContent: nextDraftSegments.length > 0 ? nextDraftSegments : undefined,
        telemetry: telemetryHandler?.snapshot(),
      },
    })

    logger.error(`[ChatSession] Session ${requestId} encountered error:`, error)
  }

  private async runLifecycleHook(hook: AgentHook, data?: unknown) {
    const orchestrator = getOrchestrator()
    if (!orchestrator)
      return []

    try {
      return await orchestrator.triggerHook(hook, this.config.chatUid, data)
    }
    catch (error) {
      logger.warn(`[ChatSession] Failed to trigger lifecycle hook ${hook}:`, error)
      return []
    }
  }

  private buildLifecycleDraftSegments(results: AgentResult[], hook: AgentHook) {
    const createdAt = Date.now()

    return results.map((result, index) => {
      const agentName = humanizeAgentName(result.agentId)
      const suggestion = result.suggestion
      const content = suggestion?.content
        ? `${agentName}: ${this.describeAgentSuggestion(suggestion.type, suggestion.content)}`
        : result.status === 'error'
          ? `${agentName}: 执行失败${result.error ? ` - ${result.error}` : ''}`
          : `${agentName}: 已完成`

      return {
        id: `${this.config.requestId}-agent-${hook}-${index}`,
        content,
        phase: 'agent' as const,
        source: 'system' as const,
        delta: false,
        createdAt: createdAt + index,
        agentId: result.agentId,
        agentName,
        agentHook: hook,
        agentStatus: result.status,
        agentSuggestionType: suggestion?.type,
        agentSuggestionContent: suggestion?.content,
      }
    })
  }

  private describeAgentSuggestion(type: NonNullable<AgentResult['suggestion']>['type'], content: string) {
    if (type === 'title')
      return `建议将标题更新为「${content}」`
    return content
  }

  private async applyLifecycleSuggestions(results: AgentResult[]) {
    for (const result of results) {
      if (result.status !== 'suggest' || !result.suggestion)
        continue

      if (result.suggestion.type === 'title') {
        await updateChatTitle(this.config.chatUid, result.suggestion.content)
        chatEventEmitter.emitChatUpdated(this.config.chatUid, {
          title: result.suggestion.content,
        })
      }
    }
  }
}

function humanizeAgentName(agentId: string) {
  return agentId
    .split(':')
    .pop()
    ?.split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    ?? agentId
}
