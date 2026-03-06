/**
 * JS Adapter 沙箱版测试
 *
 * 测试覆盖：
 * 1. 文件不存在 → 返回空数组
 * 2. 元数据解析阶段（vm，主进程）：name/description/schema 提取
 * 3. 执行阶段（Worker + vm）：正常返回、对象序列化、异常处理
 * 4. 数组导出、具名导出
 * 5. schema 构建（无 schema、简写、完整）
 * 6. 安全沙箱：require('electron')、相对路径 require、无权限模块 → 错误
 * 7. 没有 execute 函数 → 加载成功但 invoke 返回错误
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

  it('jS 文件不存在时返回空数组', () => {
    const tools = loadJsTools({ type: 'js', file: 'nonexistent.js' }, testDir, 'test_skill')
    expect(tools).toEqual([])
  })
})

// ─── 元数据解析（默认导出）──────────────────────────────────────────────────────

describe('loadJsTools - 默认导出（单个 tool）', () => {
  setup()

  it('加载单个 tool 的默认导出：名称和描述正确', () => {
    writeJsFile('single.js', `
      module.exports = {
        name: 'echo_tool',
        description: 'Echoes the input',
        schema: { input: 'string' },
        execute: async ({ input }) => input
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'single.js' }, testDir, 'test_skill')

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('echo_tool')
    expect(tools[0].description).toBe('Echoes the input')
  })

  it('invoke() 在沙箱中执行并返回字符串结果', async () => {
    writeJsFile('invoke.js', `
      module.exports = {
        name: 'greet',
        description: 'Greets by name',
        schema: { name: { type: 'string', description: 'Person name' } },
        execute: async ({ name }) => 'Hello, ' + name + '!'
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'invoke.js' }, testDir, 'test_skill')
    const result = await tools[0].invoke({ name: 'World' })

    expect(result).toBe('Hello, World!')
  }, 15_000)

  it('execute 返回对象时序列化为 JSON 字符串', async () => {
    writeJsFile('json-result.js', `
      module.exports = {
        name: 'json_tool',
        description: 'Returns object',
        execute: async () => ({ status: 'ok', count: 42 })
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'json-result.js' }, testDir, 'test_skill')
    const result = await tools[0].invoke({})

    expect(result).toBe('{"status":"ok","count":42}')
  }, 15_000)

  it('execute 抛出异常时返回包含 tool 名的错误消息', async () => {
    writeJsFile('throws.js', `
      module.exports = {
        name: 'fail_tool',
        description: 'Always fails',
        execute: async () => { throw new Error('something went wrong') }
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'throws.js' }, testDir, 'test_skill')
    const result = await tools[0].invoke({})

    expect(result).toContain('something went wrong')
    expect(result).toContain('fail_tool')
  }, 15_000)
})

// ─── 数组导出（多个 tools）────────────────────────────────────────────────────

describe('loadJsTools - 数组导出（多个 tools）', () => {
  setup()

  it('加载数组导出的多个 tools', () => {
    writeJsFile('multi.js', `
      module.exports = [
        { name: 'tool_one',   description: 'Tool one',   execute: async () => 'one'   },
        { name: 'tool_two',   description: 'Tool two',   execute: async () => 'two'   },
        { name: 'tool_three', description: 'Tool three', execute: async () => 'three' }
      ]
    `)

    const tools = loadJsTools({ type: 'js', file: 'multi.js' }, testDir, 'test_skill')

    expect(tools).toHaveLength(3)
    expect(tools.map(t => t.name)).toEqual(['tool_one', 'tool_two', 'tool_three'])
  })

  it('数组中过滤掉缺少 name 或 description 的条目', () => {
    writeJsFile('partial.js', `
      module.exports = [
        { name: 'valid_tool',    description: 'Valid',      execute: async () => 'ok'  },
        {                        description: 'No name',    execute: async () => 'x'   },
        { name: 'no_desc',                                  execute: async () => 'x'   }
      ]
    `)

    const tools = loadJsTools({ type: 'js', file: 'partial.js' }, testDir, 'test_skill')

    // 只有同时具备 name 和 description 的条目才会被加载
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('valid_tool')
  })

  it('没有 execute 函数的 tool 可加载，但 invoke 时返回错误', async () => {
    writeJsFile('no-exec.js', `
      module.exports = {
        name: 'no_execute',
        description: 'No execute function'
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'no-exec.js' }, testDir, 'test_skill')

    // 元数据阶段不过滤缺少 execute 的 tool
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('no_execute')

    // 执行阶段报错
    const result = await tools[0].invoke({})
    expect(result).toContain('no_execute')
    expect(typeof result).toBe('string')
  }, 15_000)
})

// ─── schema 构建 ──────────────────────────────────────────────────────────────

describe('loadJsTools - schema 构建', () => {
  setup()

  it('schema 为空时 tool 仍可 invoke', async () => {
    writeJsFile('no-schema.js', `
      module.exports = {
        name: 'no_schema',
        description: 'No schema',
        execute: async () => 'result'
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'no-schema.js' }, testDir, 'test_skill')
    const result = await tools[0].invoke({})
    expect(result).toBe('result')
  }, 15_000)

  it('简写 schema（字符串类型）数据正常传入 execute', async () => {
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

    const tools = loadJsTools({ type: 'js', file: 'shorthand-schema.js' }, testDir, 'test_skill')
    const result = await tools[0].invoke({ text: 'hello', count: 3, flag: true })
    expect(result).toBe('hello:3:true')
  }, 15_000)

  it('完整 schema（含 description 和 optional）数据正常传入 execute', async () => {
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

    const tools = loadJsTools({ type: 'js', file: 'full-schema.js' }, testDir, 'test_skill')
    const result = await tools[0].invoke({ required_field: 'hello' })
    expect(result).toBe('hello')
  }, 15_000)
})

// ─── 具名导出 ─────────────────────────────────────────────────────────────────

describe('loadJsTools - 具名导出', () => {
  setup()

  it('通过 export 字段加载具名导出的元数据', () => {
    writeJsFile('named-export.js', `
      exports.myTool = {
        name: 'named_tool',
        description: 'Named export tool',
        execute: async () => 'from named export'
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'named-export.js', export: 'myTool' }, testDir, 'test_skill')

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('named_tool')
  })

  it('具名导出执行结果正确', async () => {
    writeJsFile('named-invoke.js', `
      exports.myTool = {
        name: 'named_tool',
        description: 'Named export tool',
        execute: async () => 'from named export'
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'named-invoke.js', export: 'myTool' }, testDir, 'test_skill')
    const result = await tools[0].invoke({})
    expect(result).toBe('from named export')
  }, 15_000)

  it('具名导出不存在时返回空数组', () => {
    writeJsFile('no-named.js', `
      exports.other = { name: 'other', description: 'Other', execute: async () => 'ok' }
    `)

    const tools = loadJsTools({ type: 'js', file: 'no-named.js', export: 'nonexistent' }, testDir, 'test_skill')
    expect(tools).toEqual([])
  })
})

// ─── 错误处理 ─────────────────────────────────────────────────────────────────

describe('loadJsTools - 错误处理', () => {
  setup()

  it('jS 文件语法错误时返回空数组、不抛异常', () => {
    writeJsFile('syntax-error.js', `module.exports = { invalid syntax !!!`)

    expect(() => loadJsTools({ type: 'js', file: 'syntax-error.js' }, testDir, 'test_skill')).not.toThrow()
    const tools = loadJsTools({ type: 'js', file: 'syntax-error.js' }, testDir, 'test_skill')
    expect(tools).toEqual([])
  })

  it('导出 null 时返回空数组', () => {
    writeJsFile('null-export.js', `module.exports = null`)

    const tools = loadJsTools({ type: 'js', file: 'null-export.js' }, testDir, 'test_skill')
    expect(tools).toEqual([])
  })
})

// ─── 安全沙箱 ─────────────────────────────────────────────────────────────────

describe('loadJsTools - 安全沙箱（执行阶段）', () => {
  setup()

  it('require("electron") 在执行阶段被永久拦截', async () => {
    writeJsFile('use-electron.js', `
      module.exports = {
        name: 'electron_tool',
        description: 'Tries to use electron',
        execute: async () => {
          const { app } = require('electron');
          return app.getVersion();
        }
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'use-electron.js' }, testDir, 'test_skill')
    expect(tools).toHaveLength(1)

    const result = await tools[0].invoke({})
    // 应返回包含 sandbox 阻止信息的错误字符串，而非抛出
    expect(typeof result).toBe('string')
    expect(result.toLowerCase()).toMatch(/block|electron|sandbox|error/i)
  }, 15_000)

  it('require("./local-file") 相对路径 require 被拦截', async () => {
    writeJsFile('use-relative.js', `
      module.exports = {
        name: 'relative_tool',
        description: 'Tries relative require',
        execute: async () => {
          const x = require('./some-local-module');
          return x.value;
        }
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'use-relative.js' }, testDir, 'test_skill')
    const result = await tools[0].invoke({})

    expect(typeof result).toBe('string')
    expect(result.toLowerCase()).toMatch(/block|path|sandbox|error/i)
  }, 15_000)

  it('无权限时 require("fs") 被拦截', async () => {
    writeJsFile('use-fs.js', `
      module.exports = {
        name: 'fs_tool',
        description: 'Tries to use fs without permission',
        execute: async () => {
          const fs = require('fs');
          return fs.readdirSync('/tmp').join(',');
        }
      }
    `)

    // permissions 中没有给 fs 权限
    const tools = loadJsTools(
      { type: 'js', file: 'use-fs.js', permissions: { allowedBuiltins: [] } },
      testDir,
      'test_skill',
    )
    const result = await tools[0].invoke({})

    expect(typeof result).toBe('string')
    expect(result.toLowerCase()).toMatch(/not allowed|block|permission|sandbox|error/i)
  }, 15_000)

  it('有权限时 require("path") 可正常使用', async () => {
    writeJsFile('use-path.js', `
      module.exports = {
        name: 'path_tool',
        description: 'Uses path module with permission',
        schema: { input: 'string' },
        execute: async ({ input }) => {
          const path = require('path');
          return path.basename(input);
        }
      }
    `)

    const tools = loadJsTools(
      { type: 'js', file: 'use-path.js', permissions: { allowedBuiltins: ['path'] } },
      testDir,
      'test_skill',
    )
    const result = await tools[0].invoke({ input: '/foo/bar/baz.txt' })

    expect(result).toBe('baz.txt')
  }, 15_000)
})

// ─── 解析阶段：顶层 require 和顶层调用的健壮性 ───────────────────────────────────

describe('loadJsTools - 解析阶段：顶层 require 健壮性', () => {
  setup()

  it('顶层 require("node:util") + promisify 调用不崩溃，能正确提取元数据', () => {
    // 模拟 shell/index.js 的真实写法
    writeJsFile('promisify.js', `
      const { execFile } = require('node:child_process');
      const { promisify } = require('node:util');
      const execFileAsync = promisify(execFile);
      const os = require('node:os');

      module.exports = {
        name: 'run_cmd',
        description: 'Runs a shell command',
        schema: { command: 'string' },
        execute: async ({ command }) => execFileAsync(command)
      }
    `)

    // 元数据解析不应抛异常
    expect(() => loadJsTools({ type: 'js', file: 'promisify.js' }, testDir, 'test_skill')).not.toThrow()

    const tools = loadJsTools({ type: 'js', file: 'promisify.js' }, testDir, 'test_skill')
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('run_cmd')
    expect(tools[0].description).toBe('Runs a shell command')
  })

  it('顶层多层方法链调用（stub.method().otherMethod()）不崩溃', () => {
    writeJsFile('chained.js', `
      const path = require('path');
      const resolved = path.join('/some', 'dir');
      const base = resolved.split('/').pop();

      module.exports = {
        name: 'chain_tool',
        description: 'Uses chained method calls at top level',
        execute: async () => base
      }
    `)

    expect(() => loadJsTools({ type: 'js', file: 'chained.js' }, testDir, 'test_skill')).not.toThrow()
    const tools = loadJsTools({ type: 'js', file: 'chained.js' }, testDir, 'test_skill')
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('chain_tool')
  })

  it('顶层 require 返回的 stub 可被 new 调用（如 new EventEmitter()）', () => {
    writeJsFile('new-call.js', `
      const { EventEmitter } = require('events');
      const emitter = new EventEmitter();

      module.exports = {
        name: 'emitter_tool',
        description: 'Uses EventEmitter at top level',
        execute: async () => 'ok'
      }
    `)

    expect(() => loadJsTools({ type: 'js', file: 'new-call.js' }, testDir, 'test_skill')).not.toThrow()
    const tools = loadJsTools({ type: 'js', file: 'new-call.js' }, testDir, 'test_skill')
    expect(tools).toHaveLength(1)
  })
})
