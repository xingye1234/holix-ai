import {
  getChatByUid,
  updateChatTitle,
  updateLastMessagePreview,
} from '../database/chat-operations'
import { createUserMessage, getLatestMessages } from '../database/message-operations'
import { DEFAULT_CHAT_CONTEXT_SETTINGS } from '../database/schema/chat'
import { runBuiltinSubAgent } from '../agents/sub-agents'
import { onCommand } from '../platform/commands'
import { logger } from '../platform/logger'
import { providerStore } from '../platform/provider'
import { update } from '../platform/update'
import { sessionOrchestrator } from './session-orchestrator'
import { buildUserMessageTelemetry } from './telemetry/estimator'

export function initChat() {
  // 监听聊天消息发送
  onCommand('chat.message', async (payload) => {
    const { chatId, content, replyTo, agent: agentName } = payload
    logger.info(
      `[Chat] New message for chat ${chatId}: ${content} (replyTo: ${replyTo ?? 'none'}, agent: ${agentName ?? 'none'})`,
    )

    const chat = await getChatByUid(chatId)

    if (!chat) {
      logger.error(`[Chat] Chat with UID ${chatId} not found.`)
      return
    }

    // 创建用户消息
    const userMessage = await createUserMessage(
      chatId,
      content,
      buildUserMessageTelemetry({
        content,
        provider: chat.provider,
        model: chat.model,
      }),
    )

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

    if (updatedChat && shouldAutoGenerateTitle(updatedChat.title, content)) {
      void autoGenerateChatTitle({
        chatUid: chatId,
        currentTitle: updatedChat.title,
        question: content,
        providerName: chat.provider,
        model: chat.model,
      })
    }

    // 获取供应商配置
    const providers = providerStore.list()
    const provider = providers.find(p => p.name === chat.provider)
    const model = chat.model.toLowerCase()
    // 应用 Agent 配置
    const systemMessages = chat.prompts || []
    const workspace = updatedChat?.workspace || []

    if (!provider || (provider.apiType !== 'ollama' && !provider.apiKey)) {
      logger.error(`[Chat] Provider not found or missing API key for chat ${chatId}`)
      return
    }

    logger.info(
      `[Chat] Using provider ${provider.name} (${model}) for chat ${chatId}`,
    )

    const contextSettings = chat.contextSettings || DEFAULT_CHAT_CONTEXT_SETTINGS
    const llmSettings = chat.llmSettings || {}
    const contextMessagesRaw = await getLatestMessages(chatId, contextSettings.maxMessages)
    const contextMessages = contextSettings.timeWindowHours != null
      ? contextMessagesRaw.filter(msg => msg.createdAt >= Date.now() - contextSettings.timeWindowHours! * 60 * 60 * 1000)
      : contextMessagesRaw

    // 使用 SessionOrchestrator 启动会话（异步处理，不阻塞）
    const requestId = await sessionOrchestrator.startSession({
      chatUid: chatId,
      modelConfig: {
        provider: provider.apiType,
        model,
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl,
        temperature: llmSettings.temperature ?? provider.temperature,
        maxTokens: llmSettings.maxTokens ?? provider.maxTokens,
      },
      userMessageContent: content,
      contextMessages,
      systemMessages,
      workspace,
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

function shouldAutoGenerateTitle(currentTitle: string, question: string) {
  return currentTitle === '新对话'
}

async function autoGenerateChatTitle(params: {
  chatUid: string
  currentTitle: string
  question: string
  providerName: string
  model: string
}) {
  try {
    const provider = providerStore.list().find(p => p.name === params.providerName)
    const generated = await runBuiltinSubAgent('title-from-question', {
      question: params.question,
      modelConfig: provider
        ? {
            provider: provider.apiType,
            model: params.model,
            apiKey: provider.apiKey,
            baseURL: provider.baseUrl,
          }
        : undefined,
    })

    if (!generated.title || generated.title === params.currentTitle) {
      return
    }

    await updateChatTitle(params.chatUid, generated.title)
    update('chat.updated', {
      chatUid: params.chatUid,
      updates: { title: generated.title },
    })
  }
  catch (error) {
    logger.warn(`[Chat] Failed to auto generate title for chat ${params.chatUid}:`, error)
  }
}
