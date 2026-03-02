/**
 * KV Store — 基于 SQLite 的键值存储（`ky` 表）
 *
 * 特性：
 * - 将嵌套 JSON 对象平铺为 dot-notation 键存储
 *   `{ a: { b: 1 } }` → key=`a.b`  value=`"1"`
 * - 支持任意深度嵌套，数组下标作为 key 片段（`list.0`）
 * - 读取时按前缀重建原始对象结构
 * - 所有方法均为同步操作（better-sqlite3 天然同步）
 */

import { eq, sql } from 'drizzle-orm'
import { db } from './connect'
import { ky } from './schema/ky'

// ─── 平铺与还原工具函数 ───────────────────────────────────────────────────────

type AnyObject = Record<string, any>

/**
 * 将嵌套对象平铺为 `{ 'a.b.c': value }` 的扁平记录。
 * 叶子节点的值序列化为 JSON 字符串存储。
 */
export function flatten(obj: AnyObject, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k

    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flatten(v as AnyObject, key))
    }
    else if (Array.isArray(v)) {
      Object.assign(result, flatten(v.reduce((acc: AnyObject, item, i) => {
        acc[String(i)] = item
        return acc
      }, {} as AnyObject), key))
    }
    else {
      result[key] = JSON.stringify(v)
    }
  }

  return result
}

/**
 * 将扁平记录还原为嵌套对象。
 * 若所有 key 都是纯数字下标，则还原为数组。
 */
export function unflatten(flat: Record<string, string>): AnyObject {
  const result: AnyObject = {}

  for (const [dotKey, rawValue] of Object.entries(flat)) {
    const parts = dotKey.split('.')
    let cur = result

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (cur[part] === undefined || typeof cur[part] !== 'object') {
        cur[part] = {}
      }
      cur = cur[part]
    }

    const last = parts[parts.length - 1]
    try {
      cur[last] = JSON.parse(rawValue)
    }
    catch {
      cur[last] = rawValue
    }
  }

  // 将全数字 key 的对象转换为数组
  return convertArrays(result)
}

function convertArrays(obj: AnyObject): AnyObject {
  if (typeof obj !== 'object' || obj === null)
    return obj

  const keys = Object.keys(obj)
  const isArray = keys.length > 0 && keys.every(k => /^\d+$/.test(k))

  if (isArray) {
    const arr: any[] = []
    for (const k of keys) {
      arr[Number(k)] = convertArrays(obj[k])
    }
    return arr as unknown as AnyObject
  }

  const result: AnyObject = {}
  for (const k of keys) {
    result[k] = convertArrays(obj[k])
  }
  return result
}

// ─── 基础 KV 操作 ─────────────────────────────────────────────────────────────

/**
 * 设置单个 key 的值（serialized JSON string）
 */
export function kvSet(key: string, value: unknown): void {
  const serialized = JSON.stringify(value)
  db.insert(ky)
    .values({ key, value: serialized })
    .onConflictDoUpdate({ target: ky.key, set: { value: serialized } })
    .run()
}

/**
 * 获取单个 key 的值，自动反序列化。未找到时返回 `undefined`。
 */
export function kvGet<T = unknown>(key: string): T | undefined {
  const row = db.select().from(ky).where(eq(ky.key, key)).get()
  if (!row || row.value === null || row.value === undefined)
    return undefined
  try {
    return JSON.parse(row.value) as T
  }
  catch {
    return row.value as unknown as T
  }
}

/**
 * 删除单个 key
 */
export function kvDelete(key: string): void {
  db.delete(ky).where(eq(ky.key, key)).run()
}

/**
 * 删除所有以 `prefix.` 开头的 key（或精确匹配 prefix 本身）
 */
export function kvDeletePrefix(prefix: string): void {
  db.delete(ky)
    .where(
      sql`${ky.key} = ${prefix} OR ${ky.key} LIKE ${`${prefix}.%`}`,
    )
    .run()
}

// ─── 嵌套对象操作 ─────────────────────────────────────────────────────────────

/**
 * 将嵌套 JSON 对象以 dot-notation 方式平铺存储于指定前缀下。
 *
 * @example
 * kvSetObject('app', { window: { width: 1280, height: 720 }, theme: 'dark' })
 * // 存储：app.window.width=1280  app.window.height=720  app.theme="dark"
 *
 * @param prefix  存储前缀（可为空字符串表示不加前缀）
 * @param obj     要存储的对象
 * @param replace 是否先清空该前缀下的所有已有 key（默认 true）
 */
export function kvSetObject(prefix: string, obj: AnyObject, replace = true): void {
  if (replace && prefix) {
    kvDeletePrefix(prefix)
  }

  const flat = flatten(obj, prefix || undefined)

  // 批量 upsert
  if (Object.keys(flat).length === 0)
    return

  for (const [key, value] of Object.entries(flat)) {
    db.insert(ky)
      .values({ key, value })
      .onConflictDoUpdate({ target: ky.key, set: { value } })
      .run()
  }
}

/**
 * 读取指定前缀下的所有 key 并还原为嵌套对象。
 *
 * @example
 * kvGetObject('app')
 * // 返回：{ window: { width: 1280, height: 720 }, theme: 'dark' }
 *
 * @param prefix 前缀（空字符串读取全部）
 */
export function kvGetObject<T extends AnyObject = AnyObject>(prefix: string): T {
  let rows: { key: string, value: string | null }[]

  if (prefix) {
    rows = db.select()
      .from(ky)
      .where(
        sql`${ky.key} = ${prefix} OR ${ky.key} LIKE ${`${prefix}.%`}`,
      )
      .all()
  }
  else {
    rows = db.select().from(ky).all()
  }

  const flat: Record<string, string> = {}

  for (const row of rows) {
    if (row.value === null || row.value === undefined)
      continue
    // 去掉前缀，恢复相对路径
    const relativeKey = prefix && row.key.startsWith(`${prefix}.`)
      ? row.key.slice(prefix.length + 1)
      : prefix && row.key === prefix
        ? ''
        : row.key

    if (relativeKey === '') {
      // 前缀本身就是一个叶子值，直接解析返回
      try {
        return JSON.parse(row.value) as T
      }
      catch {
        return row.value as unknown as T
      }
    }

    flat[relativeKey] = row.value
  }

  return unflatten(flat) as T
}
