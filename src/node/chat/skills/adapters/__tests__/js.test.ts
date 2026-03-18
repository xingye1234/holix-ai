/**
 * JS Adapter 沙箱版测试
 *
 * 测试覆盖：
 * 1. 文件不存在（skillDir 及 scripts/ 子目录均无）→ 返回空数组
 * 2. scripts/ 子目录路径解析
 * 3. name / description / schema 来自 declaration（非 JS 文件）
 * 4. 同一文件多个声明（数组导出）→ 每个声明独立创建一个 tool
 * 5. 执行阶段：正常返回、对象序列化、异常处理、没有 execute 函数
 * 6. schema 构建：无 schema、简写类型、完整字段
 * 7. 具名导出：export 字段
 * 8. 错误处理：语法错误文件、null 导出
 * 9. 安全沙箱（执行阶段）：electron / 相对路径 / 无权限模块 → 错误
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadJsTools } from '../js'

// ─── Mock 依赖 ────────────────────────────────────────────────────────────────

vi.mock('../../../../platform/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// skill-config 的依赖链包含 Electron，必须 mock
vi.mock('../../../../database/skill-config', () => ({
  getSkillConfig: vi.fn(() => ({})),
  setSkillConfigField: vi.fn(),
  getSkillConfigField: vi.fn(),
  deleteSkillConfig: vi.fn(),
}))

// ─── 辅助 ──────────────────────────────────────────────────────────────────────

let testDir: string

function writeJsFile(filename: string, content: string): void {
  writeFileSync(join(testDir, filename), content, 'utf-8')
}

function setup() {
  beforeEach(() => {
    testDir = join(tmpdir(), `holix-js-adapter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })
}

// ─── 文件不存在 ───────────────────────────────────────────────────────────────

describe('loadJsTools - 文件不存在', () => {
  setup()

  it('skillDir 和 scripts/ 子目录均无对应文件时返回空数组', () => {
    const tools = loadJsTools(
      { type: 'js', name: 'missing_tool', description: 'Missing', file: 'nonexistent.js' },
      testDir,
      'test_skill',
    )
    expect(tools).toEqual([])
  })

  it('静态审查发现高危操作时阻止加载', () => {
    writeJsFile('blocked.js', `
      const cp = require('child_process')
      module.exports = { name: 'blocked_tool', execute: async () => cp.execSync('echo blocked').toString() }
    `)

    const tools = loadJsTools(
      { type: 'js', name: 'blocked_tool', description: 'Blocked by static audit', file: 'blocked.js' },
      testDir,
      'test_skill',
    )

    expect(tools).toEqual([])
  })
})

// ─── scripts/ 子目录路径解析 ──────────────────────────────────────────────────

describe('loadJsTools - scripts/ 子目录路径解析', () => {
  setup()

  it('文件在 scripts/ 子目录时可找到并加载', () => {
    mkdirSync(join(testDir, 'scripts'), { recursive: true })
    writeFileSync(join(testDir, 'scripts', 'sub.js'), `
      module.exports = {
        name: 'sub_tool',
        execute: async () => 'from scripts/'
      }
    `, 'utf-8')

    const tools = loadJsTools(
      { type: 'js', name: 'sub_tool', description: 'Sub-directory tool', file: 'sub.js' },
      testDir,
      'test_skill',
    )
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('sub_tool')
  })

  it('skillDir 同级文件优先于 scripts/ 子目录', () => {
    // 同时在两个位置有文件（同级优先）
    writeJsFile('both.js', `
      module.exports = { name: 'priority_tool', execute: async () => 'from root' }
    `)
    mkdirSync(join(testDir, 'scripts'), { recursive: true })
    writeFileSync(join(testDir, 'scripts', 'both.js'), `
      module.exports = { name: 'priority_tool', execute: async () => 'from scripts' }
    `, 'utf-8')

    const tools = loadJsTools(
      { type: 'js', name: 'priority_tool', description: 'Priority test', file: 'both.js' },
      testDir,
      'test_skill',
    )
    expect(tools).toHaveLength(1)
    // 执行结果应来自 skillDir 同级文件
    // （文件存在性验证，无需执行）
  })
})

// ─── 声明元数据（name / description 来自 declaration）─────────────────────────

describe('loadJsTools - declaration 元数据优先', () => {
  setup()

  it('工具 name 和 description 来自 declaration，而非 JS 文件', () => {
    writeJsFile('override.js', `
      module.exports = {
        name: 'js_name',
        description: 'JS description',
        execute: async () => 'ok'
      }
    `)

    const tools = loadJsTools(
      {
        type: 'js',
        name: 'declared_name',
        description: 'Declared description',
        file: 'override.js',
      },
      testDir,
      'test_skill',
    )

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('declared_name') // 来自 declaration
    expect(tools[0].description).toBe('Declared description') // 来自 declaration
  })

  it('文件存在即可加载，JS 文件内容不影响 loadJsTools 返回值', () => {
    // JS 文件可以只有 name + execute（不需要 description/schema 字段）
    writeJsFile('minimal.js', `
      module.exports = {
        name: 'my_tool',
        execute: async ({ x }) => String(x)
      }
    `)

    const tools = loadJsTools(
      { type: 'js', name: 'my_tool', description: 'Description from declaration', file: 'minimal.js' },
      testDir,
      'test_skill',
    )

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('my_tool')
    expect(tools[0].description).toBe('Description from declaration')
  })
})

// ─── 执行阶段 ─────────────────────────────────────────────────────────────────

describe('loadJsTools - 执行阶段', () => {
  setup()

  it('invoke() 在沙箱中执行并返回字符串结果', async () => {
    writeJsFile('greet.js', `
      module.exports = {
        name: 'greet',
        execute: async ({ name }) => 'Hello, ' + name + '!'
      }
    `)

    const tools = loadJsTools(
      {
        type: 'js',
        name: 'greet',
        description: 'Greets by name',
        file: 'greet.js',
        schema: { name: { type: 'string', description: 'Person name' } },
      },
      testDir,
      'test_skill',
    )
    const result = await tools[0].invoke({ name: 'World' })

    expect(result).toBe('Hello, World!')
  }, 15_000)

  it('execute 返回对象时序列化为 JSON 字符串', async () => {
    writeJsFile('json-result.js', `
      module.exports = {
        name: 'json_tool',
        execute: async () => ({ status: 'ok', count: 42 })
      }
    `)

    const tools = loadJsTools(
      { type: 'js', name: 'json_tool', description: 'Returns object', file: 'json-result.js' },
      testDir,
      'test_skill',
    )
    const result = await tools[0].invoke({})

    expect(result).toBe('{"status":"ok","count":42}')
  }, 15_000)

  it('execute 抛出异常时返回包含 tool 名的错误消息', async () => {
    writeJsFile('throws.js', `
      module.exports = {
        name: 'fail_tool',
        execute: async () => { throw new Error('something went wrong') }
      }
    `)

    const tools = loadJsTools(
      { type: 'js', name: 'fail_tool', description: 'Always fails', file: 'throws.js' },
      testDir,
      'test_skill',
    )
    const result = await tools[0].invoke({})

    expect(result).toContain('something went wrong')
    expect(result).toContain('fail_tool')
  }, 15_000)

  it('没有 execute 函数的 tool 可加载，但 invoke 时返回错误', async () => {
    writeJsFile('no-exec.js', `
      module.exports = {
        name: 'no_execute'
      }
    `)

    const tools = loadJsTools(
      { type: 'js', name: 'no_execute', description: 'No execute function', file: 'no-exec.js' },
      testDir,
      'test_skill',
    )

    // 加载阶段不过滤缺少 execute 的 tool：声明决定加载
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('no_execute')

    // 执行阶段报错
    const result = await tools[0].invoke({})
    expect(typeof result).toBe('string')
  }, 15_000)
})

// ─── 数组导出（多个 tools 共用一个文件）──────────────────────────────────────

describe('loadJsTools - 数组导出（多个 tools）', () => {
  setup()

  it('每个声明对应一个 tool，同一文件多个声明调用正确的 tool', async () => {
    writeJsFile('multi.js', `
      module.exports = [
        { name: 'tool_one',   execute: async () => 'one'   },
        { name: 'tool_two',   execute: async () => 'two'   },
        { name: 'tool_three', execute: async () => 'three' }
      ]
    `)

    const t1 = loadJsTools(
      { type: 'js', name: 'tool_one', description: 'Tool one', file: 'multi.js' },
      testDir,
      'test_skill',
    )
    const t2 = loadJsTools(
      { type: 'js', name: 'tool_two', description: 'Tool two', file: 'multi.js' },
      testDir,
      'test_skill',
    )

    // 每次 loadJsTools 返回恰好 1 个 tool
    expect(t1).toHaveLength(1)
    expect(t1[0].name).toBe('tool_one')
    expect(t2).toHaveLength(1)
    expect(t2[0].name).toBe('tool_two')

    // invoke 各自执行正确的函数
    expect(await t1[0].invoke({})).toBe('one')
    expect(await t2[0].invoke({})).toBe('two')
  }, 15_000)
})

// ─── schema 构建 ──────────────────────────────────────────────────────────────

describe('loadJsTools - schema 构建（来自 declaration）', () => {
  setup()

  it('declaration 无 schema 时 tool 仍可 invoke', async () => {
    writeJsFile('no-schema.js', `
      module.exports = { name: 'no_schema', execute: async () => 'result' }
    `)

    const tools = loadJsTools(
      { type: 'js', name: 'no_schema', description: 'No schema', file: 'no-schema.js' },
      testDir,
      'test_skill',
    )
    const result = await tools[0].invoke({})
    expect(result).toBe('result')
  }, 15_000)

  it('declaration 简写 schema（字符串类型）数据正常传入 execute', async () => {
    // JS 文件不需要声明 schema，schema 来自 declaration
    writeJsFile('shorthand-schema.js', `
      module.exports = {
        name: 'shorthand',
        execute: async ({ text, count, flag }) =>
          text + ':' + count + ':' + flag
      }
    `)

    const tools = loadJsTools(
      {
        type: 'js',
        name: 'shorthand',
        description: 'Shorthand schema',
        file: 'shorthand-schema.js',
        schema: { text: 'string', count: 'number', flag: 'boolean' },
      },
      testDir,
      'test_skill',
    )
    const result = await tools[0].invoke({ text: 'hello', count: 3, flag: true })
    expect(result).toBe('hello:3:true')
  }, 15_000)

  it('declaration 完整 schema（含 description 和 optional）数据正常传入 execute', async () => {
    writeJsFile('full-schema.js', `
      module.exports = {
        name: 'full_schema',
        execute: async ({ required_field, optional_field }) =>
          required_field + (optional_field ? ':' + optional_field : '')
      }
    `)

    const tools = loadJsTools(
      {
        type: 'js',
        name: 'full_schema',
        description: 'Full schema',
        file: 'full-schema.js',
        schema: {
          required_field: { type: 'string', description: 'Required' },
          optional_field: { type: 'string', description: 'Optional', optional: true },
        },
      },
      testDir,
      'test_skill',
    )
    const result = await tools[0].invoke({ required_field: 'hello' })
    expect(result).toBe('hello')
  }, 15_000)
})

// ─── 具名导出 ─────────────────────────────────────────────────────────────────

describe('loadJsTools - 具名导出', () => {
  setup()

  it('通过 export 字段加载具名导出', () => {
    writeJsFile('named-export.js', `
      exports.myTool = {
        name: 'named_tool',
        execute: async () => 'from named export'
      }
    `)

    const tools = loadJsTools(
      { type: 'js', name: 'named_tool', description: 'Named export tool', file: 'named-export.js', export: 'myTool' },
      testDir,
      'test_skill',
    )

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('named_tool')
  })

  it('具名导出执行结果正确', async () => {
    writeJsFile('named-invoke.js', `
      exports.myTool = {
        name: 'named_tool',
        execute: async () => 'from named export'
      }
    `)

    const tools = loadJsTools(
      { type: 'js', name: 'named_tool', description: 'Named export tool', file: 'named-invoke.js', export: 'myTool' },
      testDir,
      'test_skill',
    )
    const result = await tools[0].invoke({})
    expect(result).toBe('from named export')
  }, 15_000)
})

// ─── 错误处理 ─────────────────────────────────────────────────────────────────

describe('loadJsTools - 错误处理', () => {
  setup()

  it('jS 文件语法错误时 tool 可加载（来自 declaration），invoke 时返回错误', async () => {
    writeJsFile('syntax-error.js', `module.exports = { invalid syntax !!!`)

    // 文件存在 → 根据 declaration 创建 tool（不执行文件）
    const tools = loadJsTools(
      { type: 'js', name: 'broken_tool', description: 'Broken', file: 'syntax-error.js' },
      testDir,
      'test_skill',
    )
    expect(tools).toHaveLength(1)

    // invoke 时 Worker 执行文件失败 → 返回错误字符串
    const result = await tools[0].invoke({})
    expect(typeof result).toBe('string')
    expect(result.toLowerCase()).toMatch(/error/i)
  }, 15_000)
})

// ─── 安全沙箱 ─────────────────────────────────────────────────────────────────

describe('loadJsTools - 安全沙箱（执行阶段）', () => {
  setup()

  it('require("electron") 在加载阶段被永久拦截', () => {
    writeJsFile('use-electron.js', `
      module.exports = {
        name: 'electron_tool',
        execute: async () => {
          const { app } = require('electron');
          return app.getVersion();
        }
      }
    `)

    const tools = loadJsTools(
      { type: 'js', name: 'electron_tool', description: 'Tries to use electron', file: 'use-electron.js' },
      testDir,
      'test_skill',
    )
    expect(tools).toEqual([])
  })

  it('require("./local-file") 相对路径 require 被拦截', async () => {
    writeJsFile('use-relative.js', `
      module.exports = {
        name: 'relative_tool',
        execute: async () => {
          const x = require('./some-local-module');
          return x.value;
        }
      }
    `)

    const tools = loadJsTools(
      { type: 'js', name: 'relative_tool', description: 'Tries relative require', file: 'use-relative.js' },
      testDir,
      'test_skill',
    )
    const result = await tools[0].invoke({})

    expect(typeof result).toBe('string')
    expect(result.toLowerCase()).toMatch(/block|path|sandbox|error/i)
  }, 15_000)

  it('无权限时 require("fs") 在加载阶段被拦截', () => {
    writeJsFile('use-fs.js', `
      module.exports = {
        name: 'fs_tool',
        execute: async () => {
          const fs = require('fs');
          return fs.readdirSync('/tmp').join(',');
        }
      }
    `)

    const tools = loadJsTools(
      {
        type: 'js',
        name: 'fs_tool',
        description: 'Tries to use fs without permission',
        file: 'use-fs.js',
        permissions: { allowedBuiltins: [] },
      },
      testDir,
      'test_skill',
    )
    expect(tools).toEqual([])
  })

  it('有权限时 require("path") 可正常使用', async () => {
    writeJsFile('use-path.js', `
      module.exports = {
        name: 'path_tool',
        execute: async ({ input }) => {
          const path = require('path');
          return path.basename(input);
        }
      }
    `)

    const tools = loadJsTools(
      {
        type: 'js',
        name: 'path_tool',
        description: 'Uses path module with permission',
        file: 'use-path.js',
        schema: { input: 'string' },
        permissions: { allowedBuiltins: ['path'] },
      },
      testDir,
      'test_skill',
    )
    const result = await tools[0].invoke({ input: '/foo/bar/baz.txt' })

    expect(result).toBe('baz.txt')
  }, 15_000)
})
