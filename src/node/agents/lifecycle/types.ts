/**
 * Agent Lifecycle System Types
 *
 * Custom orchestrator-based implementation (not hookable)
 */

/** Lifecycle hook names */
export type AgentHook =
  | 'onChatCreated'
  | 'onMessageCompleted'
  | 'onChatIdle'
  | 'onMessageError'

/** Execution mode */
export type ExecutionMode = 'auto' | 'manual'

/** Agent execution result */
export interface AgentResult {
  agentId: string
  status: 'success' | 'error'
  data?: unknown
  error?: string
  duration?: number
}

/** Agent context provided to handlers */
export interface AgentContext {
  chatUid: string
  messages: Message[]
  chat: Chat
  event: {
    hook: AgentHook
    data?: unknown
  }
}

/** Hook subscription configuration */
export interface HookSubscription {
  agentId: string
  hook: AgentHook
  priority: number
  mode: ExecutionMode
}

/** Lifecycle agent definition */
export interface LifecycleAgent {
  id: string
  name: string
  description: string
  version: string
  handler: (context: AgentContext) => Promise<AgentResult>
}

/** Execution request */
export interface ExecutionRequest {
  agent: LifecycleAgent
  context: AgentContext
  timeout: number
  signal?: AbortSignal
}

// Re-export database types for convenience
import type { Message, Chat } from '../../database/schema/chat'
