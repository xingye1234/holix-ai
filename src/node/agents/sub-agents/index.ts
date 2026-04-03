import { titleFromQuestionSubAgent } from './builtin'
import type { BuiltinSubAgent, BuiltinSubAgentId, BuiltinSubAgentInputMap, BuiltinSubAgentOutputMap } from './types'

const BUILTIN_SUB_AGENTS: BuiltinSubAgent[] = [
  titleFromQuestionSubAgent,
]

const subAgentRegistry = new Map<BuiltinSubAgentId, BuiltinSubAgent>(
  BUILTIN_SUB_AGENTS.map(agent => [agent.id, agent]),
)

export function listBuiltinSubAgents() {
  return [...subAgentRegistry.values()]
}

export async function runBuiltinSubAgent<TId extends BuiltinSubAgentId>(
  id: TId,
  input: BuiltinSubAgentInputMap[TId],
): Promise<BuiltinSubAgentOutputMap[TId]> {
  const agent = subAgentRegistry.get(id)
  if (!agent) {
    throw new Error(`Builtin sub agent not found: ${id}`)
  }

  return await agent.run(input as never) as BuiltinSubAgentOutputMap[TId]
}

export type * from './types'

