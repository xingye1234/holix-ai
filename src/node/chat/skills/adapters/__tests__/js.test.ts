import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mock 依赖 ────────────────────────────────────────────────────────────────

vi.mock('../../../../platform/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// langchain 的 tool() 在 Node 环境可正常运行，无需 mock
import { loadJsTools } from '../js'

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

let testDir: string

function writeJsFile(filename: string, content: string): string {
  const filePath = join(testDir, filename)
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('loadJsTools - 文件不存在', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `holix-js-adapter-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('JS 文件不存在时返回空数组', () => {
    const tools = loadJsTools({ type: 'js', file: 'nonexistent.js' }, testDir)
    expect(tools).toEqual([])
  })
})

describe('loadJsTools - 默认导出（单个 tool）', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `holix-js-adapter-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('加载单个 tool 的默认导出', () => {
    writeJsFile('single.js', `
      module.exports = {
        name: 'echo_tool',
        description: 'Echoes the input',
        schema: { input: 'string' },
        execute: async ({ input }) => input
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'single.js' }, testDir)

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('echo_tool')
    expect(tools[0].description).toBe('Echoes the input')
  })

  it('tool.invoke() 执行并返回结果', async () => {
    writeJsFile('invoke.js', `
      module.exports = {
        name: 'greet',
        description: 'Greets by name',
        schema: { name: { type: 'string', description: 'Person name' } },
        execute: async ({ name }) => 'Hello, ' + name + '!'
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'invoke.js' }, testDir)
    const result = await tools[0].invoke({ name: 'World' })

    expect(result).toBe('Hello, World!')
  })

  it('execute 返回对象时序列化为 JSON', async () => {
    writeJsFile('json-result.js', `
      module.exports = {
        name: 'json_tool',
        description: 'Returns object',
        execute: async () => ({ status: 'ok', count: 42 })
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'json-result.js' }, testDir)
    const result = await tools[0].invoke({})

    expect(result).toBe('{"status":"ok","count":42}')
  })

  it('execute 抛出异常时返回错误消息字符串', async () => {
    writeJsFile('throws.js', `
      module.exports = {
        name: 'fail_tool',
        description: 'Always fails',
        execute: async () => { throw new Error('something went wrong') }
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'throws.js' }, testDir)
    const result = await tools[0].invoke({})

    expect(result).toContain('something went wrong')
    expect(result).toContain('fail_tool')
  })
})

describe('loadJsTools - 数组导出（多个 tools）', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `holix-js-adapter-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('加载数组导出的多个 tools', () => {
    writeJsFile('multi.js', `
      module.exports = [
        {
          name: 'tool_one',
          description: 'Tool one',
          execute: async () => 'one'
        },
        {
          name: 'tool_two',
          description: 'Tool two',
          execute: async () => 'two'
        },
        {
          name: 'tool_three',
          description: 'Tool three',
          execute: async () => 'three'
        }
      ]
    `)

    const tools = loadJsTools({ type: 'js', file: 'multi.js' }, testDir)

    expect(tools).toHaveLength(3)
    expect(tools.map(t => t.name)).toEqual(['tool_one', 'tool_two', 'tool_three'])
  })

  it('数组中过滤掉缺少 name 或 execute 的 tool', () => {
    writeJsFile('partial.js', `
      module.exports = [
        { name: 'valid_tool', description: 'Valid', execute: async () => 'ok' },
        { description: 'No name', execute: async () => 'missing name' },
        { name: 'no_execute', description: 'No execute' }
      ]
    `)

    const tools = loadJsTools({ type: 'js', file: 'partial.js' }, testDir)

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('valid_tool')
  })
})

describe('loadJsTools - schema 构建', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `holix-js-adapter-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('schema 为空时 tool 仍可 invoke', async () => {
    writeJsFile('no-schema.js', `
      module.exports = {
        name: 'no_schema',
        description: 'No schema',
        execute: async () => 'result'
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'no-schema.js' }, testDir)
    const result = await tools[0].invoke({})
    expect(result).toBe('result')
  })

  it('简写 schema（字符串类型）正常工作', async () => {
    writeJsFile('shorthand-schema.js', `
      module.exports = {
        name: 'shorthand',
        description: 'Shorthand schema',
        schema: {
          text: 'string',
          count: 'number',
          flag: 'boolean'
        },
        execute: async ({ text, count, flag }) =>
          text + ':' + count + ':' + flag
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'shorthand-schema.js' }, testDir)
    const result = await tools[0].invoke({ text: 'hello', count: 3, flag: true })
    expect(result).toBe('hello:3:true')
  })

  it('完整 schema（含 description 和 optional）', async () => {
    writeJsFile('full-schema.js', `
      module.exports = {
        name: 'full_schema',
        description: 'Full schema',
        schema: {
          required_field: { type: 'string', description: 'Required' },
          optional_field: { type: 'string', description: 'Optional', optional: true }
        },
        execute: async ({ required_field, optional_field }) =>
          required_field + (optional_field ? ':' + optional_field : '')
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'full-schema.js' }, testDir)
    const result = await tools[0].invoke({ required_field: 'hello' })
    expect(result).toBe('hello')
  })
})

describe('loadJsTools - 具名导出', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `holix-js-adapter-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('通过 export 字段加载具名导出', () => {
    writeJsFile('named-export.js', `
      exports.myTool = {
        name: 'named_tool',
        description: 'Named export tool',
        execute: async () => 'from named export'
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'named-export.js', export: 'myTool' }, testDir)

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('named_tool')
  })

  it('具名导出不存在时返回空数组', () => {
    writeJsFile('no-named.js', `
      exports.other = { name: 'other', description: 'Other', execute: async () => 'ok' }
    `)

    const tools = loadJsTools({ type: 'js', file: 'no-named.js', export: 'nonexistent' }, testDir)
    expect(tools).toEqual([])
  })
})

describe('loadJsTools - 错误处理', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `holix-js-adapter-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('JS 文件语法错误时返回空数组、不抛异常', () => {
    writeJsFile('syntax-error.js', `
      module.exports = { invalid syntax !!!
    `)

    expect(() => loadJsTools({ type: 'js', file: 'syntax-error.js' }, testDir)).not.toThrow()
    const tools = loadJsTools({ type: 'js', file: 'syntax-error.js' }, testDir)
    expect(tools).toEqual([])
  })

  it('导出 null 时返回空数组', () => {
    writeJsFile('null-export.js', `module.exports = null`)

    const tools = loadJsTools({ type: 'js', file: 'null-export.js' }, testDir)
    expect(tools).toEqual([])
  })
})
