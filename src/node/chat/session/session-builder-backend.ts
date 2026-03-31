import type { createDeepAgent } from 'deepagents'
import {
  CompositeBackend,
  FilesystemBackend,
  StoreBackend,
} from 'deepagents'
import {
  DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE,
  deepAgentLongTermMemoryStore,
} from '../../database/deepagents-store'

type DeepAgentParams = NonNullable<Parameters<typeof createDeepAgent>[0]>
export type SessionDeepAgentStore = NonNullable<DeepAgentParams['store']>

export function createSessionBackend(backendRoot: string) {
  return (config: { store?: unknown }) =>
    new CompositeBackend(
      new FilesystemBackend({ rootDir: backendRoot }),
      {
        '/memories/': new StoreBackend(config, {
          namespace: DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE,
        }),
      },
    )
}

export function asDeepAgentStore(
  store: typeof deepAgentLongTermMemoryStore,
): SessionDeepAgentStore {
  return store as unknown as SessionDeepAgentStore
}
