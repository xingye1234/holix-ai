/**
 * kv-operations 测试
 *
 * 无需 Electron / better-sqlite3 原生模块：
 * - flatten / unflatten 纯函数直接测试
 * - DB 操作通过 Map 后端 mock（不依赖任何 SQLite 原生绑定）
 *
 * Mock 策略
 * ─────────────────────────────────────────────────────────────────
 * 1. `drizzle-orm` 的 `eq` / `sql` 替换为可检查的标记对象
 * 2. `../connect` 替换为 Map 后端的 drizzle-like 接口
 *    - `where(eq(...))` → 精确 key 匹配
 *    - `where(sql`...`)` → prefix exact + prefix.* 匹配
 * 3. `vi.hoisted()` 保证 store Map 在 mock 工厂执行前即可用
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── 被测模块（在 mock 声明之后导入）────────────────────────────────────────────

import {
  flatten,
  kvDelete,
  kvDeletePrefix,
  kvGet,
  kvGetObject,
  kvSet,
  kvSetObject,
  unflatten,
} from '../kv-operations'

// ─── 让 eq / sql 产生可检查的标记对象 ─────────────────────────────────────────

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: (_col: any, val: any) => ({ __m: 'eq', val }),
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: any[]) => ({ __m: 'sql', values }),
      actual.sql,
    ),
  }
})

// ─── Map 后端数据库 mock ───────────────────────────────────────────────────────

const store = vi.hoisted(() => new Map<string, string | null>())

vi.mock('../connect', () => {
  const db = {
    insert: (_t: any) => ({
      values: (v: { key: string, value: string | null }) => ({
        onConflictDoUpdate: (_opts: any) => ({
          run: () => { store.set(v.key, v.value) },
        }),
      }),
    }),

    select: () => ({
      from: (_t: any) => ({
        // where(eq(col, val)) 或 where(sql`...`)
        where: (cond: any) => ({
          get: () => {
            if (cond?.__m === 'eq') {
              const found = store.get(cond.val as string)
              return found !== undefined ? { key: cond.val, value: found } : undefined
            }
            return undefined
          },
          all: () => {
            if (cond?.__m === 'sql') {
              // sql`${col} = ${prefix} OR ${col} LIKE ${prefix + '.%'}`
              // values: [col, prefix, col, prefix + '.%']
              const prefix = cond.values[1] as string
              return [...store.entries()]
                .filter(([k]) => k === prefix || k.startsWith(`${prefix}.`))
                .map(([key, value]) => ({ key, value }))
            }
            return []
          },
        }),
        // select().from(ky).all() — 无 where，读取全部
        all: () => [...store.entries()].map(([key, value]) => ({ key, value })),
      }),
    }),

    delete: (_t: any) => ({
      where: (cond: any) => ({
        run: () => {
          if (cond?.__m === 'eq') {
            store.delete(cond.val as string)
          }
          else if (cond?.__m === 'sql') {
            const prefix = cond.values[1] as string
            for (const k of [...store.keys()]) {
              if (k === prefix || k.startsWith(`${prefix}.`))
                store.delete(k)
            }
          }
        },
      }),
    }),
  }

  return { db }
})

// ─── 每个测试前清空 store ─────────────────────────────────────────────────────

beforeEach(() => {
  store.clear()
})

// ─── flatten() ───────────────────────────────────────────────────────────────

describe('flatten()', () => {
  it('平铺对象：key 无前缀', () => {
    expect(flatten({ a: 1, b: 'hello' })).toEqual({
      a: '1',
      b: '"hello"',
    })
  })

  it('一层嵌套', () => {
    expect(flatten({ a: { b: 1 } })).toEqual({ 'a.b': '1' })
  })

  it('多层深度嵌套', () => {
    expect(flatten({ a: { b: { c: true } } })).toEqual({ 'a.b.c': 'true' })
  })

  it('带前缀', () => {
    expect(flatten({ x: 1 }, 'cfg')).toEqual({ 'cfg.x': '1' })
  })

  it('数组转换为数字下标 key', () => {
    expect(flatten({ list: ['a', 'b'] })).toEqual({
      'list.0': '"a"',
      'list.1': '"b"',
    })
  })

  it('嵌套对象中含数组', () => {
    expect(flatten({ items: [{ id: 1 }, { id: 2 }] })).toEqual({
      'items.0.id': '1',
      'items.1.id': '2',
    })
  })

  it('null 值作为叶子节点存储', () => {
    expect(flatten({ a: null })).toEqual({ a: 'null' })
  })

  it('布尔值序列化', () => {
    expect(flatten({ flag: false })).toEqual({ flag: 'false' })
  })

  it('空对象返回空记录', () => {
    expect(flatten({})).toEqual({})
  })
})

// ─── unflatten() ──────────────────────────────────────────────────────────────

describe('unflatten()', () => {
  it('单层 key 还原', () => {
    expect(unflatten({ a: '1', b: '"hello"' })).toEqual({ a: 1, b: 'hello' })
  })

  it('dot-notation 还原为嵌套对象', () => {
    expect(unflatten({ 'a.b': '1' })).toEqual({ a: { b: 1 } })
  })

  it('多层深度还原', () => {
    expect(unflatten({ 'a.b.c': 'true' })).toEqual({ a: { b: { c: true } } })
  })

  it('全数字 key 还原为数组', () => {
    const result = unflatten({ 'list.0': '"a"', 'list.1': '"b"' })
    expect(result).toEqual({ list: ['a', 'b'] })
    expect(Array.isArray((result as any).list)).toBe(true)
  })

  it('对象数组还原', () => {
    expect(unflatten({ 'items.0.id': '1', 'items.1.id': '2' })).toEqual({
      items: [{ id: 1 }, { id: 2 }],
    })
  })

  it('空记录返回空对象', () => {
    expect(unflatten({})).toEqual({})
  })
})

// ─── flatten → unflatten 往返完整性 ──────────────────────────────────────────

describe('flatten → unflatten 往返', () => {
  const cases: [string, Record<string, any>][] = [
    ['简单对象', { a: 1, b: 'hello', c: true }],
    ['嵌套对象', { window: { width: 1280, height: 720 }, theme: 'dark' }],
    ['深层嵌套', { a: { b: { c: { d: 42 } } } }],
    ['含数组', { tags: ['ts', 'js'], count: 2 }],
    ['含 null', { x: null, y: 1 }],
    ['混合类型', { num: 3.14, flag: false, str: 'ok', nested: { arr: [1, 2] } }],
  ]

  for (const [label, original] of cases) {
    it(label, () => {
      const flat = flatten(original)
      const restored = unflatten(flat)
      expect(restored).toEqual(original)
    })
  }
})

// ─── kvSet / kvGet ─────────────────────────────────────────────────────────────

describe('kvSet / kvGet', () => {
  it('存储并读取字符串', () => {
    kvSet('theme', 'dark')
    expect(kvGet('theme')).toBe('dark')
  })

  it('存储并读取数字', () => {
    kvSet('count', 42)
    expect(kvGet<number>('count')).toBe(42)
  })

  it('存储并读取布尔值', () => {
    kvSet('enabled', false)
    expect(kvGet<boolean>('enabled')).toBe(false)
  })

  it('存储并读取 null', () => {
    kvSet('empty', null)
    expect(kvGet('empty')).toBeNull()
  })

  it('存储并读取对象', () => {
    kvSet('user', { name: 'Alice', age: 30 })
    expect(kvGet('user')).toEqual({ name: 'Alice', age: 30 })
  })

  it('读取不存在的 key 返回 undefined', () => {
    expect(kvGet('nonexistent')).toBeUndefined()
  })

  it('重复 set 同一 key 覆盖旧值', () => {
    kvSet('x', 1)
    kvSet('x', 2)
    expect(kvGet<number>('x')).toBe(2)
  })
})

// ─── kvDelete ─────────────────────────────────────────────────────────────────

describe('kvDelete', () => {
  it('删除已存在的 key', () => {
    kvSet('a', 1)
    kvDelete('a')
    expect(kvGet('a')).toBeUndefined()
  })

  it('删除不存在的 key 不报错', () => {
    expect(() => kvDelete('ghost')).not.toThrow()
  })

  it('只删除指定 key，不影响其他 key', () => {
    kvSet('a', 1)
    kvSet('b', 2)
    kvDelete('a')
    expect(kvGet('a')).toBeUndefined()
    expect(kvGet<number>('b')).toBe(2)
  })
})

// ─── kvDeletePrefix ───────────────────────────────────────────────────────────

describe('kvDeletePrefix', () => {
  it('删除所有以 prefix. 开头的 key', () => {
    kvSet('app.width', 1280)
    kvSet('app.height', 720)
    kvSet('other', 'keep')

    kvDeletePrefix('app')

    expect(kvGet('app.width')).toBeUndefined()
    expect(kvGet('app.height')).toBeUndefined()
    expect(kvGet<string>('other')).toBe('keep')
  })

  it('同时删除精确匹配前缀 key 本身', () => {
    kvSet('app', 'root')
    kvSet('app.sub', 'child')

    kvDeletePrefix('app')

    expect(kvGet('app')).toBeUndefined()
    expect(kvGet('app.sub')).toBeUndefined()
  })

  it('不误删共享前缀字符串的其他 key（app vs appended）', () => {
    kvSet('app.x', 1)
    kvSet('appended', 'safe')

    kvDeletePrefix('app')

    expect(kvGet('app.x')).toBeUndefined()
    expect(kvGet<string>('appended')).toBe('safe')
  })
})

// ─── kvSetObject / kvGetObject ────────────────────────────────────────────────

describe('kvSetObject / kvGetObject', () => {
  it('基础嵌套对象写入读取', () => {
    kvSetObject('cfg', { a: 1, b: { c: 2 } })
    expect(kvGetObject('cfg')).toEqual({ a: 1, b: { c: 2 } })
  })

  it('深层嵌套', () => {
    kvSetObject('deep', { x: { y: { z: 99 } } })
    expect(kvGetObject('deep')).toEqual({ x: { y: { z: 99 } } })
  })

  it('含数组', () => {
    kvSetObject('data', { tags: ['a', 'b', 'c'] })
    const result = kvGetObject('data')
    expect(result).toEqual({ tags: ['a', 'b', 'c'] })
    expect(Array.isArray(result.tags)).toBe(true)
  })

  it('replace=true（默认）清除旧 key', () => {
    kvSetObject('cfg', { a: 1, b: 2 })
    kvSetObject('cfg', { c: 3 })
    const result = kvGetObject('cfg')
    expect(result).toEqual({ c: 3 })
    expect(result).not.toHaveProperty('a')
    expect(result).not.toHaveProperty('b')
  })

  it('replace=false 保留旧 key，新 key 覆盖同名', () => {
    kvSetObject('cfg', { a: 1, b: 2 })
    kvSetObject('cfg', { b: 99, c: 3 }, false)
    const result = kvGetObject('cfg')
    expect(result.a).toBe(1)
    expect(result.b).toBe(99)
    expect(result.c).toBe(3)
  })

  it('读取不存在的前缀返回空对象', () => {
    expect(kvGetObject('missing')).toEqual({})
  })

  it('前缀为空字符串读取所有 key', () => {
    kvSet('x', 10)
    kvSet('y', 20)
    const result = kvGetObject('')
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
  })

  it('多种类型混合：数字、布尔、null、字符串', () => {
    const input = { num: 3.14, flag: true, empty: null, label: 'ok' }
    kvSetObject('mixed', input)
    expect(kvGetObject('mixed')).toEqual(input)
  })

  it('不同前缀互不干扰', () => {
    kvSetObject('ns1', { val: 1 })
    kvSetObject('ns2', { val: 2 })
    expect(kvGetObject('ns1')).toEqual({ val: 1 })
    expect(kvGetObject('ns2')).toEqual({ val: 2 })
  })

  it('replace=false 更新单个子 key 不影响同级其他 key', () => {
    kvSetObject('win', { width: 800, height: 600 })
    kvSetObject('win', { width: 1920 }, false)
    const result = kvGetObject('win')
    expect(result.width).toBe(1920)
    expect(result.height).toBe(600)
  })
})
