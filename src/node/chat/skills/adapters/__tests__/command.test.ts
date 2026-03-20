import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { commandToTool, scriptToTool } from '../command'

// ─── Mock 依赖 ────────────────────────────────────────────────────────────────

// skill-config 的依赖链包含 Electron，必须 mock
vi.mock('../../../../database/skill-config', () => ({
  getSkillConfig: vi.fn(() => ({})),
  setSkillConfigField: vi.fn(),
  getSkillConfigField: vi.fn(),
  deleteSkillConfig: vi.fn(),
}))

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

let testDir: string

// ─── commandToTool 测试 ───────────────────────────────────────────────────────

describe('commandToTool - 工具属性', () => {
  it('创建指定 name 的 tool', () => {
    const t = commandToTool(
      { type: 'command', name: 'my_cmd', description: 'A command', command: 'echo hi' },
      '/tmp',
      'my_skill',
    )
    expect(t.name).toBe('my_cmd')
  })

  it('创建指定 description 的 tool', () => {
    const t = commandToTool(
      { type: 'command', name: 'cmd', description: 'Run a thing', command: 'echo x' },
      '/tmp',
      'my_skill',
    )
    expect(t.description).toBe('Run a thing')
  })
})

describe('commandToTool - 命令执行', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `holix-cmd-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('echo 命令返回输出', async () => {
    const t = commandToTool(
      { type: 'command', name: 'echo_cmd', description: 'Echo', command: 'echo hello' },
      testDir,
      'my_skill',
    )

    const result = await t.invoke({})
    expect(result).toBe('hello')
  })

  it('模板变量 {{param}} 被替换', async () => {
    const t = commandToTool(
      {
        type: 'command',
        name: 'echo_param',
        description: 'Echo param',
        command: 'echo {{message}}',
        schema: { message: { type: 'string', description: 'Message' } },
      },
      testDir,
      'my_skill',
    )

    const result = await t.invoke({ message: 'hello-world' })
    expect(result).toBe('hello-world')
  })

  it('{{skillDir}} 模板变量被替换为 skill 目录', async () => {
    const t = commandToTool(
      {
        type: 'command',
        name: 'pwd_cmd',
        description: 'Print skilldir',
        command: 'echo {{skillDir}}',
      },
      testDir,
      'my_skill',
    )

    const result = await t.invoke({})
    expect(result).toBe(testDir)
  })

  it('cwd 模板变量正确设置工作目录', async () => {
    const t = commandToTool(
      {
        type: 'command',
        name: 'cwd_cmd',
        description: 'Show cwd',
        command: 'pwd',
        cwd: testDir,
      },
      '/other-dir',
      'my_skill',
    )

    const result = await t.invoke({})
    // pwd 应输出 testDir（macOS 下 /tmp 可能解析为 /private/tmp）
    expect(result).toContain(testDir.replace(/^\/tmp/, ''))
  })

  it('命令执行失败时返回错误消息', async () => {
    const t = commandToTool(
      {
        type: 'command',
        name: 'fail_cmd',
        description: 'Fail',
        command: 'exit 1',
      },
      testDir,
      'my_skill',
    )

    const result = await t.invoke({})
    expect(result).toContain('Command failed')
  })

  it('不存在的命令返回错误消息', async () => {
    const t = commandToTool(
      {
        type: 'command',
        name: 'unknown_cmd',
        description: 'Unknown',
        command: '__holix_nonexistent_cmd__',
      },
      testDir,
      'my_skill',
    )

    const result = await t.invoke({})
    expect(result).toMatch(/Command failed|not found|No such file/i)
  })

  it('同时有 stdout 和 stderr 时均返回', async () => {
    const t = commandToTool(
      {
        type: 'command',
        name: 'both_output',
        description: 'Both outputs',
        command: 'echo out && echo err >&2',
      },
      testDir,
      'my_skill',
    )

    const result = await t.invoke({})
    expect(result).toContain('out')
    expect(result).toContain('err')
  })

  it('多个模板参数同时替换', async () => {
    const t = commandToTool(
      {
        type: 'command',
        name: 'multi_param',
        description: 'Multi param',
        command: 'echo {{a}}-{{b}}-{{c}}',
        schema: {
          a: { type: 'string', description: 'A' },
          b: { type: 'string', description: 'B' },
          c: { type: 'string', description: 'C' },
        },
      },
      testDir,
      'my_skill',
    )

    const result = await t.invoke({ a: 'x', b: 'y', c: 'z' })
    expect(result).toBe('x-y-z')
  })

  it('超时时返回超时消息', async () => {
    const t = commandToTool(
      {
        type: 'command',
        name: 'slow_cmd',
        description: 'Slow',
        command: 'sleep 10',
        timeout: 200,
      },
      testDir,
      'my_skill',
    )

    const result = await t.invoke({})
    expect(result).toContain('timed out')
  }, 3000)
})

// ─── scriptToTool 测试 ────────────────────────────────────────────────────────

describe('scriptToTool - 属性与执行', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `holix-script-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('创建指定 name/description 的 tool', () => {
    const t = scriptToTool(
      { type: 'script', name: 'my_script', description: 'My Script', script: 'echo hi' },
      testDir,
      'my_skill',
    )

    expect(t.name).toBe('my_script')
    expect(t.description).toBe('My Script')
  })

  it('执行 shell 脚本并返回输出', async () => {
    const scriptPath = join(testDir, 'hello.sh')
    writeFileSync(scriptPath, '#!/bin/sh\necho "script-output"', 'utf-8')

    const t = scriptToTool(
      {
        type: 'script',
        name: 'run_hello',
        description: 'Run hello script',
        script: `sh ${scriptPath}`,
      },
      testDir,
      'my_skill',
    )

    const result = await t.invoke({})
    expect(result).toBe('script-output')
  })

  it('{{skillDir}} 在 script 字段中被替换', async () => {
    const t = scriptToTool(
      {
        type: 'script',
        name: 'skilldir_script',
        description: 'Print skillDir',
        script: 'echo {{skillDir}}',
      },
      testDir,
      'my_skill',
    )

    const result = await t.invoke({})
    expect(result).toBe(testDir)
  })

  it('脚本参数替换正确', async () => {
    const t = scriptToTool(
      {
        type: 'script',
        name: 'param_script',
        description: 'Param script',
        script: 'echo {{input}}',
        schema: { input: { type: 'string', description: 'Input' } },
      },
      testDir,
      'my_skill',
    )

    const result = await t.invoke({ input: 'test-value' })
    expect(result).toBe('test-value')
  })
})
