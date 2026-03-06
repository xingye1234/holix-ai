/**
 * skill-config 测试
 *
 * 使用与 kv-operations.test.ts 相同的 Map 后端 mock，
 * 覆盖 skillConfigKey / skillConfigPrefix / getSkillConfigField /
 * setSkillConfigField / getSkillConfig / deleteSkillConfig
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteSkillConfig,
  getSkillConfig,
  getSkillConfigField,
  setSkillConfigField,
  skillConfigKey,
  skillConfigPrefix,
} from '../skill-config'

// ─── Mocks（与 kv-operations.test.ts 保持一致）───────────────────────────────

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
              const prefix = cond.values[1] as string
              return [...store.entries()]
                .filter(([k]) => k === prefix || k.startsWith(`${prefix}.`))
                .map(([key, value]) => ({ key, value }))
            }
            return []
          },
        }),
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

// ─── key 命名工具 ─────────────────────────────────────────────────────────────

describe('skillConfigKey()', () => {
  it('生成正确的 dot-notation key', () => {
    expect(skillConfigKey('my_skill', 'apiKey')).toBe('skill.my_skill.config.apiKey')
  })

  it('特殊字符 skill 名称也能正确拼接', () => {
    expect(skillConfigKey('foo-bar', 'token')).toBe('skill.foo-bar.config.token')
  })
})

describe('skillConfigPrefix()', () => {
  it('生成正确的前缀', () => {
    expect(skillConfigPrefix('my_skill')).toBe('skill.my_skill.config')
  })
})

// ─── getSkillConfigField / setSkillConfigField ────────────────────────────────

describe('setSkillConfigField() / getSkillConfigField()', () => {
  it('写入后能读取字符串值', () => {
    setSkillConfigField('my_skill', 'apiKey', 'secret-123')
    expect(getSkillConfigField('my_skill', 'apiKey')).toBe('secret-123')
  })

  it('写入数字值后能读回', () => {
    setSkillConfigField('my_skill', 'timeout', 5000)
    expect(getSkillConfigField('my_skill', 'timeout')).toBe(5000)
  })

  it('写入布尔值后能读回', () => {
    setSkillConfigField('my_skill', 'enabled', true)
    expect(getSkillConfigField('my_skill', 'enabled')).toBe(true)
  })

  it('未写入的字段返回 undefined', () => {
    expect(getSkillConfigField('my_skill', 'nonexistent')).toBeUndefined()
  })

  it('不同 skill 的同名字段互不干扰', () => {
    setSkillConfigField('skill_a', 'key', 'value_a')
    setSkillConfigField('skill_b', 'key', 'value_b')
    expect(getSkillConfigField('skill_a', 'key')).toBe('value_a')
    expect(getSkillConfigField('skill_b', 'key')).toBe('value_b')
  })

  it('覆盖写入更新值', () => {
    setSkillConfigField('my_skill', 'apiKey', 'old')
    setSkillConfigField('my_skill', 'apiKey', 'new')
    expect(getSkillConfigField('my_skill', 'apiKey')).toBe('new')
  })
})

// ─── getSkillConfig ───────────────────────────────────────────────────────────

describe('getSkillConfig()', () => {
  it('读取多个字段并合并为对象', () => {
    setSkillConfigField('my_skill', 'apiKey', 'k123')
    setSkillConfigField('my_skill', 'model', 'gpt-4')
    const result = getSkillConfig('my_skill', ['apiKey', 'model'])
    expect(result).toEqual({ apiKey: 'k123', model: 'gpt-4' })
  })

  it('未配置的字段不出现在结果中', () => {
    setSkillConfigField('my_skill', 'apiKey', 'k123')
    const result = getSkillConfig('my_skill', ['apiKey', 'missing'])
    expect(result).toEqual({ apiKey: 'k123' })
    expect('missing' in result).toBe(false)
  })

  it('传入空 key 列表时返回空对象', () => {
    setSkillConfigField('my_skill', 'apiKey', 'k123')
    expect(getSkillConfig('my_skill', [])).toEqual({})
  })

  it('所有字段均未配置时返回空对象', () => {
    expect(getSkillConfig('my_skill', ['a', 'b', 'c'])).toEqual({})
  })

  it('不同 skill 的配置互不干扰', () => {
    setSkillConfigField('skill_a', 'token', 'aaa')
    setSkillConfigField('skill_b', 'token', 'bbb')
    expect(getSkillConfig('skill_a', ['token'])).toEqual({ token: 'aaa' })
    expect(getSkillConfig('skill_b', ['token'])).toEqual({ token: 'bbb' })
  })
})

// ─── deleteSkillConfig ────────────────────────────────────────────────────────

describe('deleteSkillConfig()', () => {
  it('删除后所有字段均返回 undefined', () => {
    setSkillConfigField('my_skill', 'apiKey', 'k123')
    setSkillConfigField('my_skill', 'model', 'gpt-4')
    deleteSkillConfig('my_skill')
    expect(getSkillConfigField('my_skill', 'apiKey')).toBeUndefined()
    expect(getSkillConfigField('my_skill', 'model')).toBeUndefined()
  })

  it('只删除目标 skill，不影响其他 skill', () => {
    setSkillConfigField('skill_a', 'k', 'v_a')
    setSkillConfigField('skill_b', 'k', 'v_b')
    deleteSkillConfig('skill_a')
    expect(getSkillConfigField('skill_a', 'k')).toBeUndefined()
    expect(getSkillConfigField('skill_b', 'k')).toBe('v_b')
  })

  it('对未存储任何配置的 skill 执行删除不报错', () => {
    expect(() => deleteSkillConfig('nonexistent')).not.toThrow()
  })
})
