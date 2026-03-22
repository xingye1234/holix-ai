import { HookRegistry } from './hook-registry'
import { MainProcessExecutor } from './executor/main'
import { contextProvider } from './context'
import { db } from '../../database/connect'
import { agentExecutionLog } from '../../database/schema/lifecycle-agent'
import type { AgentHook, LifecycleAgent, AgentResult, ExecutionRequest } from './types'

/**
 * Agent Orchestrator
 *
 * Custom task orchestrator with:
 * - Hook-based agent triggering
 * - Parallel execution with error isolation
 * - Result aggregation
 * - Execution logging
 */
export class AgentOrchestrator {
  private registry: HookRegistry
  private executor: MainProcessExecutor
  private defaultTimeout: number

  // Agent registry (will be populated with builtin agents)
  private agents: Map<string, LifecycleAgent> = new Map()

  constructor(timeout: number = 30000) {
    this.registry = new HookRegistry()
    this.executor = new MainProcessExecutor()
    this.defaultTimeout = timeout
  }

  /**
   * Register an agent
   */
  registerAgent(
    agent: LifecycleAgent,
    hooks: AgentHook[],
    priority: number = 10
  ): void {
    // Store agent
    this.agents.set(agent.id, agent)

    // Subscribe to hooks
    for (const hook of hooks) {
      this.registry.subscribe({
        agentId: agent.id,
        hook,
        priority,
        mode: 'auto'
      })
    }
  }

  /**
   * Trigger a hook - executes all subscribed agents
   */
  async triggerHook(
    hook: AgentHook,
    chatUid: string,
    data?: unknown
  ): Promise<AgentResult[]> {
    // Get subscriptions
    const subscriptions = this.registry.getSubscriptions(hook)
    if (subscriptions.length === 0) {
      return []
    }

    // Get context
    const context = await contextProvider.getContext(chatUid, hook, data)

    // Execute in parallel with error isolation
    const promises = subscriptions.map(async (subscription) => {
      const agent = this.agents.get(subscription.agentId)
      if (!agent) {
        return {
          agentId: subscription.agentId,
          status: 'error' as const,
          error: 'Agent not found'
        }
      }

      try {
        const result = await this.executor.execute({
          agent,
          context,
          timeout: this.defaultTimeout
        })

        // Log execution
        await this.logExecution(agent, context, result)

        return result
      } catch (error) {
        // Error isolation - one agent failure doesn't affect others
        const errorResult: AgentResult = {
          agentId: agent.id,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        }

        await this.logExecution(agent, context, errorResult)

        return errorResult
      }
    })

    // Wait for all executions to complete
    const results = await Promise.all(promises)

    return results
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents(): LifecycleAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Log execution to database
   */
  private async logExecution(
    agent: LifecycleAgent,
    context: any,
    result: AgentResult
  ): Promise<void> {
    try {
      await db.insert(agentExecutionLog).values({
        uid: `${agent.id}-${Date.now()}-${Math.random()}`,
        chatUid: context.chatUid,
        agentId: agent.id,
        hook: context.event.hook,
        status: result.status,
        resultData: result.data,
        error: result.error,
        duration: result.duration,
        createdAt: Date.now()
      })
    } catch (error) {
      console.error('[Orchestrator] Failed to log execution:', error)
    }
  }
}

// Singleton instance
let _instance: AgentOrchestrator | null = null

export function initializeOrchestrator(timeout?: number): AgentOrchestrator {
  if (_instance) {
    return _instance
  }

  _instance = new AgentOrchestrator(timeout)
  return _instance
}

export function getOrchestrator(): AgentOrchestrator | null {
  return _instance
}
