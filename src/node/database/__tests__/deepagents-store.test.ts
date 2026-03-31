import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => new Map<string, string | null>())

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()

  return {
    ...actual,
    eq: (_column: any, value: any) => ({ __m: 'eq', value }),
    sql: Object.assign(
      (_strings: TemplateStringsArray, ...values: any[]) => ({ __m: 'sql', values }),
      actual.sql,
    ),
  }
})

vi.mock('../connect', () => {
  const db = {
    insert: (_table: any) => ({
      values: (value: { key: string, value: string | null }) => ({
        onConflictDoUpdate: (_options: any) => ({
          run: () => {
            store.set(value.key, value.value)
          },
        }),
      }),
    }),
    select: () => ({
      from: (_table: any) => ({
        where: (condition: any) => ({
          get: () => {
            if (condition?.__m === 'eq') {
              const value = store.get(condition.value)
              return value !== undefined ? { key: condition.value, value } : undefined
            }
            return undefined
          },
          all: () => {
            if (condition?.__m === 'sql') {
              const pattern = condition.values[1] as string
              const prefix = pattern.endsWith('%') ? pattern.slice(0, -1) : pattern

              return [...store.entries()]
                .filter(([key]) => key.startsWith(prefix))
                .map(([key, value]) => ({ key, value }))
            }

            return []
          },
        }),
      }),
    }),
    delete: (_table: any) => ({
      where: (condition: any) => ({
        run: () => {
          if (condition?.__m === 'eq') {
            store.delete(condition.value)
          }
        },
      }),
    }),
  }

  return { db }
})

import {
  DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE,
  SqliteDeepAgentStore,
} from '../deepagents-store'

describe('SqliteDeepAgentStore', () => {
  let deepAgentStore: SqliteDeepAgentStore

  beforeEach(() => {
    store.clear()
    deepAgentStore = new SqliteDeepAgentStore()
  })

  it('should put and get items from the sqlite-backed store', async () => {
    await deepAgentStore.put(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, '/memories/user_preferences.md', {
      content: ['Prefers concise answers.'],
    })

    const item = await deepAgentStore.get(
      DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE,
      '/memories/user_preferences.md',
    )

    expect(item?.key).toBe('/memories/user_preferences.md')
    expect(item?.namespace).toEqual(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE)
    expect(item?.value).toEqual({
      content: ['Prefers concise answers.'],
    })
    expect(item?.createdAt).toBeInstanceOf(Date)
    expect(item?.updatedAt).toBeInstanceOf(Date)
  })

  it('should update existing items while preserving createdAt', async () => {
    await deepAgentStore.put(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, 'prefs', {
      theme: 'dark',
    })
    const original = await deepAgentStore.get(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, 'prefs')

    await deepAgentStore.put(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, 'prefs', {
      theme: 'light',
    })
    const updated = await deepAgentStore.get(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, 'prefs')

    expect(original?.createdAt.toISOString()).toBe(updated?.createdAt.toISOString())
    expect(updated?.value).toEqual({ theme: 'light' })
  })

  it('should delete items', async () => {
    await deepAgentStore.put(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, 'prefs', {
      theme: 'dark',
    })

    await deepAgentStore.delete(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, 'prefs')

    const deleted = await deepAgentStore.get(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, 'prefs')
    expect(deleted).toBeNull()
  })

  it('should search within a namespace prefix', async () => {
    await deepAgentStore.put(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, '/memories/user_preferences.md', {
      type: 'preference',
      content: ['Prefers TypeScript.'],
    })
    await deepAgentStore.put(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, '/memories/profile.md', {
      type: 'profile',
      content: ['Works on Holix AI.'],
    })
    await deepAgentStore.put(['holix-ai', 'other-space'], '/memories/ignore.md', {
      type: 'other',
    })

    const items = await deepAgentStore.search(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, {
      filter: { type: 'preference' },
      limit: 10,
      offset: 0,
    })

    expect(items).toHaveLength(1)
    expect(items[0].key).toBe('/memories/user_preferences.md')
  })

  it('should support simple query matching during search', async () => {
    await deepAgentStore.put(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, 'project', {
      content: ['Uses Vitest and pnpm.'],
    })
    await deepAgentStore.put(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, 'profile', {
      content: ['Prefers concise replies.'],
    })

    const items = await deepAgentStore.search(DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE, {
      query: 'vitest',
      limit: 10,
      offset: 0,
    })

    expect(items).toHaveLength(1)
    expect(items[0].key).toBe('project')
    expect(items[0].score).toBe(1)
  })

  it('should list namespaces with prefix filtering', async () => {
    await deepAgentStore.put(['holix-ai', 'long-term-memory'], 'prefs', { v: 1 })
    await deepAgentStore.put(['holix-ai', 'project-memory'], 'notes', { v: 2 })
    await deepAgentStore.put(['other-app', 'long-term-memory'], 'prefs', { v: 3 })

    const namespaces = await deepAgentStore.listNamespaces({
      prefix: ['holix-ai'],
      limit: 20,
      offset: 0,
    })

    expect(namespaces).toEqual([
      ['holix-ai', 'long-term-memory'],
      ['holix-ai', 'project-memory'],
    ])
  })

  it('should support batch get/search/put/list operations', async () => {
    const results = await deepAgentStore.batch([
      {
        namespace: DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE,
        key: 'prefs',
        value: { theme: 'dark' },
      },
      {
        namespace: DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE,
        key: 'prefs',
      },
      {
        namespacePrefix: DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE,
        limit: 10,
        offset: 0,
      },
      {
        matchConditions: [
          {
            matchType: 'prefix',
            path: ['holix-ai'],
          },
        ],
        limit: 10,
        offset: 0,
      },
    ])

    expect(results[0]).toBeUndefined()
    expect((results[1] as any)?.key).toBe('prefs')
    expect(results[2]).toHaveLength(1)
    expect(results[3]).toEqual([DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE])
  })

  it('should reject invalid namespaces', async () => {
    await expect(
      deepAgentStore.put([], 'prefs', { theme: 'dark' }),
    ).rejects.toThrow('Namespace cannot be empty.')

    await expect(
      deepAgentStore.put(['invalid.namespace'], 'prefs', { theme: 'dark' }),
    ).rejects.toThrow('Namespace labels cannot contain periods')
  })
})
