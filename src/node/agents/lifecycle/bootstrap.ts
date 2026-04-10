import type { AgentHook, LifecycleAgent } from './types'
import { BUILTIN_LIFECYCLE_AGENTS } from './builtin'
import { initializeOrchestrator } from '.'

const HOOKS_BY_AGENT_ID: Record<string, AgentHook[]> = {
  'builtin:title-generator': ['onMessageCompleted'],
}

export function initializeLifecycleAgents() {
  const orchestrator = initializeOrchestrator()

  for (const agent of BUILTIN_LIFECYCLE_AGENTS as readonly LifecycleAgent[]) {
    const hooks = HOOKS_BY_AGENT_ID[agent.id]
    if (!hooks?.length)
      continue

    orchestrator.registerAgent(agent, hooks)
  }

  return orchestrator
}
