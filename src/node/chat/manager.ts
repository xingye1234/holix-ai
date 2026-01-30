// biome-ignore assist/source/organizeImports: <explanation>
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { AIMessage } from '@langchain/core/messages'
import type { DraftContent, Message } from '../database/schema/chat'
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
import { createContext7Tool } from './tools/context7'
import { systemEnvTool, systemPlatformTool, systemTimeTool, systemTimezoneTool } from './tools/system'
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
   * @param params - 会话参数
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
    const throttledDbUpdate = new AsyncBatcher<{ content: string, segments: DraftContent }>(
      async (items) => {
        // 只取最后一次更新（节流效果）
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

    // Widen the type to accept any tool
    const tools: any[] = [
      systemPlatformTool,
      systemEnvTool,
      systemTimezoneTool,
      systemTimeTool,
    ]

    const context7ApiKey = configStore.get('context7ApiKey')

    if (context7ApiKey?.trim()) {
      const context7Tool = createContext7Tool(context7ApiKey.trim())
      tools.push(context7Tool)
    }

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
        tools,
      })

      const stream = await agent.stream(
        { messages },
        {
          signal: abortController.signal,
          streamMode: ['messages', 'updates'],
        },
      )

      const draftSegments: DraftContent = []
      let fullContent = ''
      let segmentIndex = 0

      for await (const [streamMode, chunk] of stream) {
        logger.debug('[chat/manager] Stream chunk:', util.inspect({ streamMode, chunk }, { depth: null, colors: true }))
        // 检查是否已被中止
        if (session.status === 'aborted') {
          logger.info(`[ChatManager] Session ${requestId} was aborted`)
          throttledDbUpdate.cancel()
          return
        }

        if (streamMode === 'messages') {
          // payload 可能是数组，也可能是单条 message
          const msgs = Array.isArray(chunk) ? chunk : [chunk]
          for (const msg of msgs) {
            const content = (msg as any)?.content as string | undefined
            if (!content)
              continue
            fullContent += content
            const segment = {
              id: `${requestId}-${segmentIndex++}`,
              content,
              phase: 'answer' as const,
              source: 'model' as const,
              delta: true,
              createdAt: Date.now(),
            }
            draftSegments.push(segment)
            // 节流更新数据库（保证消息完整性，即使中途出错也有部分数据）
            throttledDbUpdate.addItem({ content: fullContent, segments: [...draftSegments] })
            // 推送到渲染进程（由 streamingBatcher 自动批处理，~60fps）
            update('message.streaming', {
              chatUid,
              messageUid: assistantMessageUid,
              content: fullContent,
              delta: content,
            })
          }
        }
        else if (streamMode === 'updates') {
          // 目前不处理 updates
          logger.debug('[chat/manager] Received update chunk:', chunk)
        }
      }

      logger.info(`[ChatManager] Stream completed for session ${requestId}`)

      // 等待所有待处理的更新完成
      await throttledDbUpdate.flush()

      // 流式完成，最终更新数据库（包含所有 segments）
      await updateMessage(assistantMessageUid, {
        content: fullContent,
        status: 'done',
        draftContent: draftSegments.map(s => ({ ...s, committed: true })),
      })
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
      // 取消正在进行的流和待处理的节流更新
      if (!abortController.signal.aborted) {
        abortController.abort()
      }

      // 检查是否是用户主动取消
      if (error.name === 'AbortError' || session.status === 'aborted') {
        await updateMessage(assistantMessageUid, { status: 'aborted' })
        session.status = 'aborted'

        update('message.updated', {
          chatUid,
          messageUid: assistantMessageUid,
          updates: { status: 'aborted' },
        })

        logger.info(`[ChatManager] Session ${requestId} was aborted by user`)
      }
      else {
        // 真实错误
        await updateMessage(assistantMessageUid, {
          status: 'error',
          error: error.message || 'Unknown error',
        })
        session.status = 'error'

        update('message.updated', {
          chatUid,
          messageUid: assistantMessageUid,
          updates: {
            status: 'error',
            error: error.message || 'Unknown error',
          },
        })

        logger.error(
          `[ChatManager] Session ${requestId} encountered error:`,
          error,
        )
      }
    }
    finally {
      // 清理会话
      this.sessions.delete(requestId)
    }
  }

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
}

// 导出单例
export const chatManager = new ChatManager()
