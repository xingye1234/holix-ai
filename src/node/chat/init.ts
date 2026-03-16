import {
  getChatByUid,
  updateLastMessagePreview,
} from '../database/chat-operations'
import { createUserMessage, getLatestMessages } from '../database/message-operations'
import { onCommand } from '../platform/commands'
import { logger } from '../platform/logger'
import { providerStore } from '../platform/provider'
import { update } from '../platform/update'
import { createLlm } from './llm'
import { sessionOrchestrator } from './session-orchestrator'

export function initChat() {
  // 监听聊天消息发送
  onCommand('chat.message', async (payload) => {
    const { chatId, content, replyTo } = payload
    logger.info(
      `[Chat] New message for chat ${chatId}: ${content} (replyTo: ${replyTo ?? 'none'})`,
    )

    const chat = await getChatByUid(chatId)

    if (!chat) {
      logger.error(`[Chat] Chat with UID ${chatId} not found.`)
      return
    }

    // 创建用户消息
    const userMessage = await createUserMessage(chatId, content)

    // 发送更新事件
    update('message.created', {
      chatUid: chatId,
      message: userMessage,
    })

    // 更新聊天的最后消息预览
    await updateLastMessagePreview(chatId, content)

    const updatedChat = await getChatByUid(chatId)
    update('chat.updated', {
      chatUid: chatId,
      updates: { lastMessagePreview: content },
    })

    // 获取供应商配置
    const providers = providerStore.get('providers')
    const provider = providers.find(p => p.name === chat.provider)
    const model = chat.model.toLowerCase()

    if (!provider || !provider.apiKey) {
      logger.error(`[Chat] Provider ${chat.provider} not found or missing API key for chat ${chatId}.`)
      return
    }

    logger.info(
      `[Chat] Using provider ${provider.name} (${model}) for chat ${chatId}`,
    )

    // 创建 LLM 实例
    const llm = createLlm(model, {
      provider: provider.name,
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
      streaming: true,
    })

    // 获取最近的上下文消息（例如最近 10 条）
    const contextMessages = await getLatestMessages(chatId, 10)

    const systemMessages = chat.prompts || []

    // 使用 SessionOrchestrator 启动会话（异步处理，不阻塞）
    const requestId = await sessionOrchestrator.startSession({
      chatUid: chatId,
      llm,
      userMessageContent: content,
      contextMessages,
      systemMessages,
      workspace: updatedChat?.workspace || [],
    })

    logger.info(
      `[Chat] Started session ${requestId} for chat ${chatId} with user message ${userMessage.uid}`,
    )
  })

  // 监听中止请求
  onCommand('chat.abort', async (payload) => {
    const { requestId, chatId } = payload

    if (requestId) {
      // 中止特定请求
      const success = sessionOrchestrator.abortSession(requestId)
      logger.info(`[Chat] Abort session ${requestId}: ${success ? 'success' : 'not found'}`)
    }
    else if (chatId) {
      // 中止聊天的所有会话
      const count = sessionOrchestrator.abortChatSessions(chatId)
      logger.info(`[Chat] Aborted ${count} sessions for chat ${chatId}`)
    }
  })
}
