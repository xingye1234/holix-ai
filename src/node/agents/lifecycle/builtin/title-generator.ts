import type { LifecycleAgent, AgentContext } from '../types'

/**
 * TitleGenerator Agent
 *
 * Automatically generates or updates chat titles based on conversation content.
 *
 * Trigger: onMessageCompleted
 * Logic:
 * - Generate title if current title is "新对话"
 * - Update title every 5 messages
 */
export const titleGeneratorAgent: LifecycleAgent = {
  id: 'builtin:title-generator',
  name: 'Title Generator',
  description: 'Automatically generates or updates chat titles based on conversation content',
  version: '1.0.0',

  handler: async (context: AgentContext) => {
    const { messages, chat } = context

    // Check if we should update title
    const shouldUpdate = shouldUpdateTitle(messages, chat)

    if (!shouldUpdate) {
      return {
        agentId: 'builtin:title-generator',
        status: 'success'
      }
    }

    // Generate title (simplified - Phase 1 uses basic logic)
    const newTitle = generateBasicTitle(messages)

    // Update database
    try {
      const { db } = await import('../../database/connect')
      const { chats } = await import('../../database/schema/chat')
      const { eq } = await import('drizzle-orm')

      await db.update(chats)
        .set({
          title: newTitle,
          updatedAt: Date.now()
        })
        .where(eq(chats.uid, context.chatUid))

      return {
        agentId: 'builtin:title-generator',
        status: 'success',
        data: { title: newTitle }
      }
    } catch (error) {
      return {
        agentId: 'builtin:title-generator',
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

/**
 * Check if title should be updated
 */
function shouldUpdateTitle(messages: any[], chat: any): boolean {
  // Update if title is default
  if (chat.title === '新对话') {
    return true
  }

  // Update every 5 messages
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
