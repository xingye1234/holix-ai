import type { LifecycleAgent, AgentContext } from '../types'

/**
 * TitleGenerator Agent
 *
 * Analyzes conversation and suggests chat titles.
 *
 * IMPORTANT: This agent does NOT update the database.
 * It returns suggestions that the caller (ChatSession) can choose to apply.
 *
 * Trigger: onMessageCompleted
 * Logic:
 * - Suggest title if current title is "新对话"
 * - Suggest title every 5 messages
 */
export const titleGeneratorAgent: LifecycleAgent = {
  id: 'builtin:title-generator',
  name: 'Title Generator',
  description: 'Analyzes conversation and suggests chat titles',
  version: '1.0.0',

  handler: async (context: AgentContext) => {
    const { messages, chat } = context

    // Check if we should suggest a title
    const shouldUpdate = shouldUpdateTitle(messages, chat)

    if (!shouldUpdate) {
      return {
        agentId: 'builtin:title-generator',
        status: 'success',
      }
    }

    // Generate title suggestion (simplified - Phase 1 uses basic logic)
    const suggestedTitle = generateBasicTitle(messages)

    // Return suggestion (caller decides whether to apply)
    return {
      agentId: 'builtin:title-generator',
      status: 'suggest',
      suggestion: {
        type: 'title',
        content: suggestedTitle,
        metadata: {
          currentTitle: chat.title,
          messageCount: messages.length,
          reason: chat.title === '新对话'
            ? 'Default title detected'
            : 'Message threshold reached',
        },
      },
    }
  },
}

/**
 * Check if title should be suggested
 */
function shouldUpdateTitle(messages: any[], chat: any): boolean {
  // Suggest if title is default
  if (chat.title === '新对话') {
    return true
  }

  // Suggest every 5 messages
  if (messages.length > 0 && messages.length % 5 === 0) {
    return true
  }

  return false
}

/**
 * Generate basic title from messages (Phase 1 - simple logic)
 * Phase 2 will use LLM for better titles
 */
function generateBasicTitle(messages: any[]): string {
  // Get first user message
  const firstUserMessage = messages.find(m => m.role === 'user')

  if (!firstUserMessage || !firstUserMessage.content) {
    return '新对话'
  }

  // Truncate to max 30 characters
  const content = String(firstUserMessage.content)
  const title = content.slice(0, 30)

  return title.length < content.length ? `${title}...` : title
}
