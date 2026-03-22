import { describe, it, expect, beforeEach } from 'vitest'
import { HookRegistry } from '../hook-registry'
import type { AgentHook } from '../types'

describe('HookRegistry', () => {
  let registry: HookRegistry

  beforeEach(() => {
    registry = new HookRegistry()
  })

  it('should subscribe agents to hooks', () => {
    registry.subscribe({
      agentId: 'agent1',
      hook: 'onMessageCompleted',
      priority: 10,
      mode: 'auto',
    })

    const subscriptions = registry.getSubscriptions('onMessageCompleted')
    expect(subscriptions).toHaveLength(1)
    expect(subscriptions[0].agentId).toBe('agent1')
  })

  it('should sort subscriptions by priority', () => {
    registry.subscribe({
      agentId: 'agent1',
      hook: 'onMessageCompleted',
      priority: 20,
      mode: 'auto',
    })

    registry.subscribe({
      agentId: 'agent2',
      hook: 'onMessageCompleted',
      priority: 10,
      mode: 'auto',
    })

    const subscriptions = registry.getSubscriptions('onMessageCompleted')
    expect(subscriptions[0].agentId).toBe('agent2') // Lower priority first
    expect(subscriptions[1].agentId).toBe('agent1')
  })

  it('should return empty array for non-existent hook', () => {
    const subscriptions = registry.getSubscriptions('onChatCreated' as AgentHook)
    expect(subscriptions).toEqual([])
  })

  it('should get subscriptions by agent ID', () => {
    registry.subscribe({
      agentId: 'agent1',
      hook: 'onMessageCompleted',
      priority: 10,
      mode: 'auto',
    })

    registry.subscribe({
      agentId: 'agent1',
      hook: 'onChatCreated',
      priority: 10,
      mode: 'auto',
    })

    const subscriptions = registry.getByAgentId('agent1')
    expect(subscriptions).toHaveLength(2)
  })

  it('should return all subscribed hooks', () => {
    registry.subscribe({
      agentId: 'agent1',
      hook: 'onMessageCompleted',
      priority: 10,
      mode: 'auto',
    })

    registry.subscribe({
      agentId: 'agent2',
      hook: 'onChatCreated',
      priority: 10,
      mode: 'auto',
    })

    const hooks = registry.getHooks()
    expect(hooks).toHaveLength(2)
    expect(hooks).toContain('onMessageCompleted')
    expect(hooks).toContain('onChatCreated')
  })
})
