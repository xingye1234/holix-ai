import type { AgentHook, HookSubscription } from './types'

/**
 * Hook Registry - manages hook → agent subscriptions
 *
 * Provides:
 * - Subscription management
 * - Priority-based ordering
 * - Efficient lookup by hook name
 */
export class HookRegistry {
  private subscriptions: Map<AgentHook, HookSubscription[]> = new Map()

  /**
   * Subscribe an agent to a hook
   */
  subscribe(subscription: HookSubscription): void {
    const { hook } = subscription

    if (!this.subscriptions.has(hook)) {
      this.subscriptions.set(hook, [])
    }

    this.subscriptions.get(hook)!.push(subscription)

    // Sort by priority (lower = earlier)
    this.subscriptions.get(hook)!.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Get all subscriptions for a hook
   */
  getSubscriptions(hook: AgentHook): HookSubscription[] {
    return this.subscriptions.get(hook) || []
  }

  /**
   * Get subscription by agent ID
   */
  getByAgentId(agentId: string): HookSubscription[] {
    const all: HookSubscription[] = []

    for (const subscriptions of this.subscriptions.values()) {
      for (const sub of subscriptions) {
        if (sub.agentId === agentId) {
          all.push(sub)
        }
      }
    }

    return all
  }

  /**
   * Get all subscribed hooks
   */
  getHooks(): AgentHook[] {
    return Array.from(this.subscriptions.keys())
  }

  /**
   * Clear all subscriptions (for testing)
   */
  clear(): void {
    this.subscriptions.clear()
  }
}
