// biome-ignore assist/source/organizeImports: <explanation>
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { AIMessage, AIMessageChunk, ToolMessage } from '@langchain/core/messages'
import type { DraftContent, Message } from '../database/schema/chat'
import type { ChatContext } from './context'
import util from 'node:util'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { AsyncBatcher } from '@tanstack/pacer'
import { createAgent } from 'langchain'
import { nanoid } from 'nanoid'
import {
  createMessage,
  getLatestMessages,
  updateMessage,
} from '../database/message-operations'
import { configStore } from '../platform/config'
import { logger } from '../platform/logger'
import { update } from '../platform/update'
import builtinMessages from './builtin/messages'
import { contextSchema } from './context'
import { chatKeywordSearchTool, chatTimeSearchTool } from './tools/chat'
import { context7Tool } from './tools/context7'
import { systemEnvTool, systemPlatformTool, systemTimeTool, systemTimezoneTool } from './tools/system'
/** 流处理时传递给各 handler 的只读会话上下文 */
interface StreamSessionCtx {
  chatUid: string
  requestId: string
  assistantMessageUid: string
  throttledDbUpdate: AsyncBatcher<{ content: string, segments: DraftContent }>
}

/** 流处理时共享的可变状态——以对象传递，各 handler 可直接修改 */
interface StreamState {
  fullContent: string
  segmentIndex: number
  draftSegments: DraftContent
}

/**
 * 单个聊天会话的状态
 */
interface ChatSession {
  chatUid: string
  requestId: string
  streamId: string
  assistantMessageUid: string
  llm: BaseChatModel
  abortController: AbortController
  status: 'running' | 'completed' | 'aborted' | 'error'
  systemMessages?: SystemMessage[]
}

/**
 * ChatManager - 管理多个并发的聊天会话
 * 每个会话独立处理，互不影响
 */
class ChatManager {
  private sessions: Map<string, ChatSession> = new Map()

  /**
   * 启动一个新的聊天会话
   */
  async startSession(params: {
    chatUid: string
    llm: BaseChatModel
    userMessageContent: string
    contextMessages?: Message[]
    systemMessages?: string[]
  }): Promise<string> {
    const { chatUid, llm, userMessageContent, contextMessages = [], systemMessages = [] } = params

    // 生成唯一 ID
    const requestId = nanoid()
    const streamId = nanoid()

    // 创建 Assistant 消息占位符
    const assistantMessage = await createMessage({
      chatUid,
      seq: await this.getNextSeq(chatUid),
      role: 'assistant',
      kind: 'message',
      content: '',
      status: 'pending',
      requestId,
      streamId,
    })

    // 创建 AbortController 用于取消
    const abortController = new AbortController()

    // 保存会话状态
    const session: ChatSession = {
      chatUid,
      requestId,
      streamId,
      assistantMessageUid: assistantMessage.uid,
      llm,
      abortController,
      status: 'running',
      systemMessages: systemMessages.map(msg => new SystemMessage(msg)),
    }

    this.sessions.set(requestId, session)

    // 通知渲染进程：消息已创建
    update('message.created', {
      chatUid,
      message: assistantMessage,
    })

    // 异步处理（不阻塞主进程）
    this.processSession(session, userMessageContent, contextMessages).catch(
      (err) => {
        logger.error(`[ChatManager] Session ${requestId} failed:`, err)
      },
    )

    return requestId
  }

  /**
   * 处理会话的实际逻辑
   */
  private async processSession(
    session: ChatSession,
    userMessageContent: string,
    contextMessages: Message[],
  ): Promise<void> {
    const { chatUid, requestId, assistantMessageUid, llm, abortController }
      = session

    // 创建节流的数据库更新方法（每300ms最多更新一次）
    const throttledDbUpdate = this.createThrottledDbUpdater(assistantMessageUid)

    try {
      // 更新状态为 streaming
      await updateMessage(assistantMessageUid, { status: 'streaming' })
      update('message.updated', {
        chatUid,
        messageUid: assistantMessageUid,
        updates: { status: 'streaming' },
      })

      // 构建消息历史
      const messages = this.buildMessages(contextMessages, userMessageContent)

      // 创建 Agent
      const agent = createAgent({
        model: llm,
        signal: abortController.signal,
        systemPrompt: new SystemMessage({
          content: [
            {
              type: 'text',
              text: builtinMessages.globalSystem,
            },
            ...(session.systemMessages?.map(msg => ({ type: 'text', text: msg.content })) || []),
          ],
        }),
        tools: this.buildTools(),
        contextSchema,
      })

      const stream = await agent.stream(
        { messages },
        {
          signal: abortController.signal,
          streamMode: ['messages', 'updates'],
          context: this.buildConfig(session),
        },
      )

      const state: StreamState = { fullContent: '', segmentIndex: 0, draftSegments: [] }
      const ctx: StreamSessionCtx = { chatUid, requestId, assistantMessageUid, throttledDbUpdate }

      for await (const [streamMode, chunk] of stream) {
        if (session.status === 'aborted') {
          logger.info(`[ChatManager] Session ${requestId} was aborted`)
          throttledDbUpdate.cancel()
          return
        }

        if (streamMode === 'messages') {
          this.handleMessagesMode(chunk, state, ctx)
        }
        else if (streamMode === 'updates') {
          this.handleUpdatesMode(chunk, state, ctx)
        }
      }

      const { fullContent, draftSegments } = state

      logger.info(`[ChatManager] Stream completed for session ${requestId}`)

      // 等待所有待处理的更新完成
      await throttledDbUpdate.flush()

      // 流式完成，最终使用 helper 写回数据库（包含所有 segments）
      await this.finalizeAssistantMessage(assistantMessageUid, fullContent, draftSegments)
      session.status = 'completed'

      update('message.updated', {
        chatUid,
        messageUid: assistantMessageUid,
        updates: { status: 'done', content: fullContent },
      })

      logger.info(
        `[ChatManager] Session ${requestId} completed with ${fullContent.length} chars (${draftSegments.length} segments)`,
      )
    }
    catch (error: any) {
      await this.handleSessionError(session, assistantMessageUid, error, throttledDbUpdate)
    }
    finally {
      // 清理会话
      this.sessions.delete(requestId)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stream 处理（私有方法）
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 处理 LangChain Agent stream 的 "messages" 模式。
   *
   * 每个 chunk 格式为 [BaseMessageChunk, metadata]，metadata.langgraph_node 标识产出节点。
   * - msgType='ai', content       → AI 文本增量，累积并推送流式更新
   * - msgType='ai', tool_call_chunks → 工具调用参数增量 token，仅日志跟踪
   * - msgType='tool'              → 工具结果（流式），仅日志跟踪
   */
  private handleMessagesMode(chunk: unknown, state: StreamState, ctx: StreamSessionCtx): void {
    const [msg, metadata] = (Array.isArray(chunk) ? chunk : [chunk, {}]) as [any, Record<string, any>]
    const nodeId: string = metadata?.langgraph_node ?? 'unknown'
    const msgType: string = msg?.getType?.() ?? ''

    logger.debug(
      `[chat/manager] messages | node=${nodeId} type=${msgType}`,
      util.inspect(msg, { depth: 3, colors: true }),
    )

    if (msgType === 'ai') {
      const aiChunk = msg as AIMessageChunk
      if (aiChunk.tool_call_chunks?.length) {
        // 工具调用参数的增量 token，完整 tool_calls 由 updates 模式落库
        for (const tc of aiChunk.tool_call_chunks) {
          logger.debug(`[chat/manager] tool_call_chunk | name=${tc.name ?? '?'} id=${tc.id ?? '?'} args_delta=${tc.args}`)
        }
      }
      else if (aiChunk.content) {
        const textDelta = this.extractTextDelta(aiChunk.content)
        if (textDelta)
          this.applyTextDelta(textDelta, state, ctx)
      }
    }
    else if (msgType === 'tool') {
      const toolMsg = msg as ToolMessage
      const len = typeof toolMsg.content === 'string' ? toolMsg.content.length : JSON.stringify(toolMsg.content).length
      logger.debug(`[chat/manager] ToolMessage via messages | tool_call_id=${toolMsg.tool_call_id} content_len=${len}`)
    }
    else {
      logger.debug(`[chat/manager] Unexpected message type in stream: ${msgType}`)
    }
  }

  /**
   * 处理 LangChain Agent stream 的 "updates" 模式。
   *
   * 每个 chunk 格式为 { [nodeName]: stateUpdate }，表示节点执行完毕后的完整状态。
   * - 'agent' 节点 → AI 决策完毕，含完整 tool_calls
   * - 'tools' 节点 → 工具执行完毕，含 ToolMessage[]
   */
  private handleUpdatesMode(chunk: unknown, state: StreamState, ctx: StreamSessionCtx): void {
    const updates = chunk as Record<string, any>
    for (const [nodeName, nodeUpdate] of Object.entries(updates)) {
      logger.debug(
        `[chat/manager] updates | node=${nodeName}`,
        util.inspect(nodeUpdate, { depth: 3, colors: true }),
      )

      if (nodeName === 'agent') {
        this.handleAgentNodeUpdate(nodeUpdate, state, ctx)
      }
      else if (nodeName === 'tools') {
        this.handleToolsNodeUpdate(nodeUpdate, state, ctx)
      }
      else {
        logger.debug(`[chat/manager] Unknown update node: ${nodeName}`)
      }
    }
  }

  /** AI 文本增量：更新 state 并推送流式事件 */
  private applyTextDelta(textDelta: string, state: StreamState, ctx: StreamSessionCtx): void {
    state.fullContent += textDelta
    state.draftSegments.push({
      id: `${ctx.requestId}-${state.segmentIndex++}`,
      content: textDelta,
      phase: 'answer',
      source: 'model',
      delta: true,
      createdAt: Date.now(),
    })
    this.pushStreamingUpdate(ctx.chatUid, ctx.assistantMessageUid, state.fullContent, textDelta, state.draftSegments, ctx.throttledDbUpdate)
  }

  /** agent 节点更新：AI 决定调用工具，记录 tool_call DraftSegment */
  private handleAgentNodeUpdate(nodeUpdate: any, state: StreamState, ctx: StreamSessionCtx): void {
    const agentMessages: AIMessage[] = nodeUpdate?.messages ?? []
    for (const agentMsg of agentMessages) {
      const calls = agentMsg.tool_calls ?? []
      if (!calls.length)
        continue
      for (const call of calls) {
        state.draftSegments.push({
          id: `${ctx.requestId}-tc-${call.id ?? state.segmentIndex++}`,
          content: JSON.stringify({ name: call.name, args: call.args }),
          phase: 'tool',
          source: 'model',
          delta: false,
          createdAt: Date.now(),
        })
        logger.info(`[chat/manager] Tool call dispatched | name=${call.name} id=${call.id} args=${JSON.stringify(call.args)}`)
      }
      ctx.throttledDbUpdate.addItem({ content: state.fullContent, segments: [...state.draftSegments] })
    }
  }

  /** tools 节点更新：工具执行完毕，记录 tool_result DraftSegment */
  private handleToolsNodeUpdate(nodeUpdate: any, state: StreamState, ctx: StreamSessionCtx): void {
    const toolMessages: ToolMessage[] = nodeUpdate?.messages ?? []
    for (const toolMsg of toolMessages) {
      const content = typeof toolMsg.content === 'string' ? toolMsg.content : JSON.stringify(toolMsg.content)
      state.draftSegments.push({
        id: `${ctx.requestId}-tr-${toolMsg.tool_call_id ?? state.segmentIndex++}`,
        content,
        phase: 'tool',
        source: 'tool',
        delta: false,
        createdAt: Date.now(),
      })
      logger.info(`[chat/manager] Tool result received | tool_call_id=${toolMsg.tool_call_id} content_len=${content.length}`)
    }
    if (toolMessages.length)
      ctx.throttledDbUpdate.addItem({ content: state.fullContent, segments: [...state.draftSegments] })
  }

  /**
   * 从 AIMessageChunk.content 中提取纯文本增量，兼容两种格式：
   * - 纯字符串（OpenAI / Ollama）
   * - 多模态数组 `{ type:'text', text:string }[]`（Anthropic / Gemini）
   */
  private extractTextDelta(content: AIMessageChunk['content']): string {
    if (typeof content === 'string')
      return content
    return (content as any[])
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c.text as string)
      .join('')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 会话控制
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 中止指定会话
   */
  abortSession(requestId: string): boolean {
    const session = this.sessions.get(requestId)
    if (!session) {
      logger.warn(`[ChatManager] Session ${requestId} not found for abort`)
      return false
    }

    session.status = 'aborted'
    session.abortController.abort()
    logger.info(`[ChatManager] Aborting session ${requestId}`)
    return true
  }

  /**
   * 中止指定聊天的所有会话
   */
  abortChatSessions(chatUid: string): number {
    let count = 0
    for (const [_, session] of this.sessions.entries()) {
      if (session.chatUid === chatUid) {
        session.status = 'aborted'
        session.abortController.abort()
        count++
      }
    }
    logger.info(`[ChatManager] Aborted ${count} sessions for chat ${chatUid}`)
    return count
  }

  /**
   * 获取活跃会话数量
   */
  getActiveSessionCount(): number {
    return this.sessions.size
  }

  /**
   * 获取指定聊天的活跃会话
   */
  getChatSessions(chatUid: string): ChatSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.chatUid === chatUid,
    )
  }

  /**
   * 构建 LangChain 消息数组
   */
  private buildMessages(
    contextMessages: Message[],
    userMessageContent: string,
  ) {
    // 添加内置提示词
    const messages: (HumanMessage | SystemMessage | AIMessage)[] = []

    // 添加历史消息
    for (const msg of contextMessages) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content || ''))
      }
      else if (msg.role === 'assistant') {
        messages.push(new HumanMessage(msg.content || ''))
      }
      else if (msg.role === 'system') {
        messages.push(new SystemMessage(msg.content || ''))
      }
    }

    // 添加当前用户消息
    messages.push(new HumanMessage(userMessageContent))

    return messages
  }

  /**
   * 获取下一个序号（简化版）
   */
  private async getNextSeq(chatUid: string): Promise<number> {
    const messages = await getLatestMessages(chatUid, 1)
    return messages.length > 0 ? messages[0].seq + 1 : 1
  }

  private buildConfig(session: ChatSession): ChatContext {
    return {
      config: configStore.getData(),
      chatUid: session.chatUid,
    }
  }

  private buildTools() {
    const context7ApiKey = configStore.get('context7ApiKey')
    const tools = [
      systemPlatformTool,
      systemEnvTool,
      systemTimezoneTool,
      systemTimeTool,
      chatTimeSearchTool,
      chatKeywordSearchTool,
      ...(context7ApiKey ? [context7Tool] : []),
    ]

    return tools
  }

  /**
   * 创建节流的数据库更新器（返回 AsyncBatcher）
   */
  private createThrottledDbUpdater(assistantMessageUid: string) {
    return new AsyncBatcher<{ content: string, segments: DraftContent }>(
      async (items) => {
        const latest = items[items.length - 1]
        try {
          await updateMessage(assistantMessageUid, {
            content: latest.content,
            draftContent: latest.segments,
          })
        }
        catch (error) {
          logger.error(`[ChatManager] Failed to update message ${assistantMessageUid}:`, error)
        }
      },
      {
        maxSize: 100,
        wait: 300,
      },
    )
  }

  /**
   * 将节流写入与流事件合并处理：写入 draft 并发出 streaming 更新
   */
  private pushStreamingUpdate(
    chatUid: string,
    assistantMessageUid: string,
    fullContent: string,
    delta: string,
    draftSegments: DraftContent,
    throttledDbUpdate: AsyncBatcher<{ content: string, segments: DraftContent }>,
  ) {
    throttledDbUpdate.addItem({ content: fullContent, segments: [...draftSegments] })
    update('message.streaming', {
      chatUid,
      messageUid: assistantMessageUid,
      content: fullContent,
      delta,
    })
  }

  /**
   * 将流完成的最终结果写回数据库
   */
  private async finalizeAssistantMessage(
    assistantMessageUid: string,
    fullContent: string,
    draftSegments: DraftContent,
  ) {
    await updateMessage(assistantMessageUid, {
      content: fullContent,
      status: 'done',
      draftContent: draftSegments.map(s => ({ ...s, committed: true })),
    })
  }

  /**
   * 统一处理会话错误：取消节流、abort、更新消息状态并记录日志
   */
  private async handleSessionError(
    session: ChatSession,
    assistantMessageUid: string,
    error: any,
    throttledDbUpdate?: AsyncBatcher<{ content: string, segments: DraftContent }>,
  ) {
    const { chatUid, requestId, abortController } = session

    // 取消节流队列以防止后续写入
    try {
      throttledDbUpdate?.cancel()
    }
    catch (e) {
      logger.warn(`[ChatManager] Failed to cancel throttledDbUpdate for ${requestId}: ${String(e)}`)
    }

    // 确保流被中止
    if (!abortController.signal.aborted) {
      try {
        abortController.abort()
      }
      catch {
        /* ignore */
      }
    }

    // 区分用户中止和实际错误
    const isAbort = error?.name === 'AbortError' || session.status === 'aborted'

    if (isAbort) {
      try {
        await updateMessage(assistantMessageUid, { status: 'aborted' })
      }
      catch (e) {
        logger.error(`[ChatManager] Failed to mark message ${assistantMessageUid} as aborted:`, e)
      }
      session.status = 'aborted'
      update('message.updated', {
        chatUid,
        messageUid: assistantMessageUid,
        updates: { status: 'aborted' },
      })
      logger.info(`[ChatManager] Session ${requestId} was aborted by user`)
      return
    }

    // 真实错误处理
    const errMsg = error?.message ?? String(error ?? 'Unknown error')
    try {
      await updateMessage(assistantMessageUid, { status: 'error', error: errMsg })
    }
    catch (e) {
      logger.error(`[ChatManager] Failed to mark message ${assistantMessageUid} as error:`, e)
    }
    session.status = 'error'
    update('message.updated', {
      chatUid,
      messageUid: assistantMessageUid,
      updates: { status: 'error', error: errMsg },
    })

    logger.error(`[ChatManager] Session ${requestId} encountered error:`, error)
  }
}

// 导出单例
export const chatManager = new ChatManager()
