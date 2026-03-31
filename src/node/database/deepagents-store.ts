import { eq, sql } from 'drizzle-orm'
import { db } from './connect'
import { ky } from './schema/ky'

const STORE_ROOT_PREFIX = 'deepagents.store.v1'

export interface DeepAgentStoreItem {
  value: Record<string, any>
  key: string
  namespace: string[]
  createdAt: Date
  updatedAt: Date
  score?: number
}

interface PersistedDeepAgentStoreItem {
  value: Record<string, any>
  key: string
  namespace: string[]
  createdAt: string
  updatedAt: string
}

interface SearchOptions {
  filter?: Record<string, any>
  limit?: number
  offset?: number
  query?: string
}

interface MatchCondition {
  matchType: 'prefix' | 'suffix'
  path: Array<string | '*'>
}

interface ListNamespacesOptions {
  prefix?: string[]
  suffix?: string[]
  maxDepth?: number
  limit?: number
  offset?: number
}

interface GetOperation {
  namespace: string[]
  key: string
}

interface SearchOperation {
  namespacePrefix: string[]
  filter?: Record<string, any>
  limit?: number
  offset?: number
  query?: string
}

interface PutOperation {
  namespace: string[]
  key: string
  value: Record<string, any> | null
}

interface ListNamespacesOperation {
  matchConditions?: MatchCondition[]
  maxDepth?: number
  limit: number
  offset: number
}

type StoreOperation = GetOperation | SearchOperation | PutOperation | ListNamespacesOperation

function isSearchOperation(operation: StoreOperation): operation is SearchOperation {
  return 'namespacePrefix' in operation
}

function isPutOperation(operation: StoreOperation): operation is PutOperation {
  return 'value' in operation
}

function isListNamespacesOperation(operation: StoreOperation): operation is ListNamespacesOperation {
  return 'matchConditions' in operation
}

function encodeSegment(value: string) {
  return encodeURIComponent(value)
}

function decodeSegment(value: string) {
  return decodeURIComponent(value)
}

function compareValues(actual: unknown, expected: unknown) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    const operators = expected as Record<string, unknown>

    if ('$eq' in operators)
      return actual === operators.$eq
    if ('$ne' in operators)
      return actual !== operators.$ne
    if ('$gt' in operators)
      return typeof actual === 'number' && actual > Number(operators.$gt)
    if ('$gte' in operators)
      return typeof actual === 'number' && actual >= Number(operators.$gte)
    if ('$lt' in operators)
      return typeof actual === 'number' && actual < Number(operators.$lt)
    if ('$lte' in operators)
      return typeof actual === 'number' && actual <= Number(operators.$lte)
  }

  return actual === expected
}

export class SqliteDeepAgentStore {
  async batch(operations: readonly StoreOperation[]) {
    const results: unknown[] = []

    for (const operation of operations) {
      if (isSearchOperation(operation)) {
        results.push(await this.search(operation.namespacePrefix, {
          filter: operation.filter,
          limit: operation.limit,
          offset: operation.offset,
          query: operation.query,
        }))
        continue
      }

      if (isPutOperation(operation)) {
        if (operation.value === null) {
          await this.delete(operation.namespace, operation.key)
        }
        else {
          await this.put(operation.namespace, operation.key, operation.value)
        }
        results.push(undefined)
        continue
      }

      if (isListNamespacesOperation(operation)) {
        results.push(await this.listNamespacesFromConditions(operation))
        continue
      }

      results.push(await this.get(operation.namespace, operation.key))
    }

    return results
  }

  async get(namespace: string[], key: string): Promise<DeepAgentStoreItem | null> {
    this.validateNamespace(namespace)

    const row = db.select()
      .from(ky)
      .where(eq(ky.key, this.getStorageKey(namespace, key)))
      .get()

    if (!row?.value) {
      return null
    }

    return this.parsePersistedItem(row.value)
  }

  async put(namespace: string[], key: string, value: Record<string, any>): Promise<void> {
    this.validateNamespace(namespace)

    const existing = await this.get(namespace, key)
    const now = new Date()
    const persisted: PersistedDeepAgentStoreItem = {
      value,
      key,
      namespace,
      createdAt: existing?.createdAt.toISOString() || now.toISOString(),
      updatedAt: now.toISOString(),
    }
    const serialized = JSON.stringify(persisted)

    db.insert(ky)
      .values({
        key: this.getStorageKey(namespace, key),
        value: serialized,
      })
      .onConflictDoUpdate({
        target: ky.key,
        set: {
          value: serialized,
        },
      })
      .run()
  }

  async delete(namespace: string[], key: string): Promise<void> {
    this.validateNamespace(namespace)

    db.delete(ky)
      .where(eq(ky.key, this.getStorageKey(namespace, key)))
      .run()
  }

  async search(namespacePrefix: string[], options: SearchOptions = {}): Promise<DeepAgentStoreItem[]> {
    const prefix = this.getStoragePrefix(namespacePrefix)
    const rows = db.select()
      .from(ky)
      .where(sql`${ky.key} LIKE ${`${prefix}%`}`)
      .all()

    let items = rows
      .map(row => row.value)
      .filter((value): value is string => typeof value === 'string')
      .map(value => this.parsePersistedItem(value))
      .filter((item): item is DeepAgentStoreItem => item !== null)
      .filter(item => this.matchesNamespacePrefix(item.namespace, namespacePrefix))

    if (options.filter) {
      items = items.filter(item =>
        Object.entries(options.filter || {}).every(([field, expected]) =>
          compareValues(item.value[field], expected),
        ),
      )
    }

    if (options.query?.trim()) {
      const normalizedQuery = options.query.toLowerCase()
      items = items
        .map((item) => {
          const haystack = JSON.stringify(item.value).toLowerCase()
          const score = haystack.includes(normalizedQuery) ? 1 : 0
          return { ...item, score }
        })
        .filter(item => item.score && item.score > 0)
        .sort((left, right) => (right.score || 0) - (left.score || 0))
    }
    else {
      items.sort((left, right) => left.key.localeCompare(right.key))
    }

    const offset = options.offset || 0
    const limit = options.limit ?? 10

    return items.slice(offset, offset + limit)
  }

  async listNamespaces(options: ListNamespacesOptions = {}) {
    const matchConditions: MatchCondition[] = []

    if (options.prefix?.length) {
      matchConditions.push({
        matchType: 'prefix',
        path: options.prefix,
      })
    }

    if (options.suffix?.length) {
      matchConditions.push({
        matchType: 'suffix',
        path: options.suffix,
      })
    }

    return this.listNamespacesFromConditions({
      matchConditions: matchConditions.length > 0 ? matchConditions : undefined,
      maxDepth: options.maxDepth,
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    })
  }

  start() {}

  stop() {}

  private async listNamespacesFromConditions(operation: ListNamespacesOperation) {
    const rows = db.select()
      .from(ky)
      .where(sql`${ky.key} LIKE ${`${STORE_ROOT_PREFIX}/%`}`)
      .all()

    const namespaceMap = new Map<string, string[]>()

    for (const row of rows) {
      if (!row.value)
        continue

      const item = this.parsePersistedItem(row.value)
      if (!item)
        continue

      if (operation.matchConditions?.length && !operation.matchConditions.every(condition => this.matchesCondition(condition, item.namespace))) {
        continue
      }

      const namespace = operation.maxDepth != null
        ? item.namespace.slice(0, operation.maxDepth)
        : item.namespace

      namespaceMap.set(namespace.join(':'), namespace)
    }

    const namespaces = Array.from(namespaceMap.values())
      .sort((left, right) => left.join(':').localeCompare(right.join(':')))

    return namespaces.slice(operation.offset, operation.offset + operation.limit)
  }

  private matchesCondition(condition: MatchCondition, namespace: string[]) {
    if (condition.path.length > namespace.length) {
      return false
    }

    if (condition.matchType === 'prefix') {
      return condition.path.every((part, index) =>
        part === '*' || namespace[index] === part,
      )
    }

    const offset = namespace.length - condition.path.length
    return condition.path.every((part, index) =>
      part === '*' || namespace[offset + index] === part,
    )
  }

  private matchesNamespacePrefix(namespace: string[], prefix: string[]) {
    if (prefix.length > namespace.length) {
      return false
    }

    return prefix.every((part, index) => namespace[index] === part)
  }

  private parsePersistedItem(rawValue: string): DeepAgentStoreItem | null {
    try {
      const parsed = JSON.parse(rawValue) as PersistedDeepAgentStoreItem

      return {
        value: parsed.value || {},
        key: parsed.key,
        namespace: parsed.namespace || [],
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      }
    }
    catch {
      return null
    }
  }

  private getStoragePrefix(namespace: string[]) {
    const encodedNamespace = namespace.map(encodeSegment).join('/')
    return encodedNamespace.length > 0
      ? `${STORE_ROOT_PREFIX}/${encodedNamespace}/`
      : `${STORE_ROOT_PREFIX}/`
  }

  private getStorageKey(namespace: string[], key: string) {
    return `${this.getStoragePrefix(namespace)}${encodeSegment(key)}`
  }

  private validateNamespace(namespace: string[]) {
    if (namespace.length === 0) {
      throw new Error('Namespace cannot be empty.')
    }

    for (const label of namespace) {
      if (typeof label !== 'string' || label.length === 0) {
        throw new Error(`Invalid namespace label: ${String(label)}`)
      }

      if (label.includes('.')) {
        throw new Error(`Namespace labels cannot contain periods: ${label}`)
      }
    }
  }
}

export const deepAgentLongTermMemoryStore = new SqliteDeepAgentStore()

export const DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE = [
  'holix-ai',
  'long-term-memory',
]

export function decodeDeepAgentStoreKeySegment(value: string) {
  return decodeSegment(value)
}
