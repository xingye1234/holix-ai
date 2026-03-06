/**
 * Adapter config 注入测试
 *
 * 验证 commandToTool / scriptToTool / loadJsTools 在运行时
 * 能够正确从 KV 读取 skill 配置并注入到命令模板 / 沙箱上下文。
 *
 * 依赖全部通过 vi.mock 替换：
 * - child_process.exec → 捕获最终命令字符串
 * - skill-config（getSkillConfig）→ 可控返回值
 * - sandbox/executor（runInSandbox）→ 可控返回值
 * - logger → 静默
 * - langchain → 轻量 tool wrapper（直接透传 invoke）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── 被测模块（在所有 mock 之后导入）──────────────────────────────────────────

import { commandToTool, scriptToTool } from '../adapters/command'
import { loadJsTools } from '../adapters/js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../platform/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// getSkillConfig 可控返回
const mockGetSkillConfig = vi.fn((_skillName: string, _fieldKeys: string[]): Record<string, unknown> => ({}))

vi.mock('../../../database/skill-config', () => ({
  getSkillConfig: (skillName: string, fieldKeys: string[]) => mockGetSkillConfig(skillName, fieldKeys),
  setSkillConfigField: vi.fn(),
  getSkillConfigField: vi.fn(),
  deleteSkillConfig: vi.fn(),
}))

// child_process.exec 捕获命令
const capturedCommands: Array<{ command: string, cwd: string }> = []

vi.mock('node:child_process', () => ({
  exec: vi.fn((cmd: string, opts: any, cb: (err: null, result: { stdout: string, stderr: string }) => void) => {
    capturedCommands.push({ command: cmd, cwd: opts?.cwd ?? '' })
    cb(null, { stdout: `executed: ${cmd}`, stderr: '' })
  }),
}))

// util.promisify：直接把回调版 exec 包成 promise
type ExecCb = (err: Error | null, result: { stdout: string, stderr: string }) => void
type ExecFn = (cmd: string, opts: any, cb: ExecCb) => void

vi.mock('node:util', () => ({
  promisify: (fn: ExecFn) => (cmd: string, opts: any) =>
    new Promise((resolve, reject) => {
      fn(cmd, opts, (err, result) => {
        if (err)
          reject(err)
        else
          resolve(result)
      })
    }),
}))

// langchain tool wrapper：将 fn 包成可 invoke 的 tool 对象
vi.mock('langchain', () => ({
  tool: (fn: (args: any) => any, meta: any) => ({
    name: meta.name,
    description: meta.description,
    schema: meta.schema,
    invoke: (args: any) => fn(args),
  }),
}))

// runInSandbox mock — 记录调用参数
const mockRunInSandbox = vi.fn(async (opts: any) => `sandbox result for ${opts.toolName}`)

vi.mock('../sandbox/executor', () => ({
  runInSandbox: (opts: any) => mockRunInSandbox(opts),
}))

// ─── 测试辅助 ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedCommands.length = 0
  mockGetSkillConfig.mockReturnValue({})
  mockRunInSandbox.mockClear()
})

// ─── commandToTool：config 注入 ───────────────────────────────────────────────

describe('commandToTool() — config 注入', () => {
  it('无 configFieldKeys 时不调用 getSkillConfig', async () => {
    const t = commandToTool(
      { type: 'command', name: 'echo', description: 'echo', command: 'echo hello' },
      '/tmp',
      'my_skill',
      [],
    )
    await t.invoke({})
    expect(mockGetSkillConfig).not.toHaveBeenCalled()
  })

  it('有 configFieldKeys 时调用 getSkillConfig 并正确传入 skillName 和 keys', async () => {
    mockGetSkillConfig.mockReturnValue({ apiKey: 'test-key' })

    const t = commandToTool(
      { type: 'command', name: 'fetch', description: 'fetch', command: 'curl {{url}}' },
      '/tmp',
      'my_skill',
      ['apiKey', 'endpoint'],
    )
    await t.invoke({ url: 'https://example.com' })

    expect(mockGetSkillConfig).toHaveBeenCalledWith('my_skill', ['apiKey', 'endpoint'])
  })

  it('{{config.KEY}} 用 KV 中的值替换', async () => {
    mockGetSkillConfig.mockReturnValue({ apiKey: 'sk-abc123' })

    const t = commandToTool(
      {
        type: 'command',
        name: 'api_call',
        description: 'call',
        command: 'curl -H "Authorization: {{config.apiKey}}" https://api.example.com',
      },
      '/tmp',
      'my_skill',
      ['apiKey'],
    )
    await t.invoke({})

    const cmd = capturedCommands[0]?.command ?? ''
    expect(cmd).toContain('sk-abc123')
    expect(cmd).not.toContain('{{config.apiKey}}')
  })

  it('config 值未配置时 {{config.KEY}} 替换为空字符串', async () => {
    mockGetSkillConfig.mockReturnValue({})

    const t = commandToTool(
      { type: 'command', name: 'test', description: 'test', command: 'echo {{config.missing}}' },
      '/tmp',
      'my_skill',
      ['missing'],
    )
    await t.invoke({})

    const cmd = capturedCommands[0]?.command ?? ''
    expect(cmd).toBe('echo ')
  })

  it('普通 {{arg}} 替换不受 config 影响', async () => {
    mockGetSkillConfig.mockReturnValue({ apiKey: 'key' })

    const t = commandToTool(
      {
        type: 'command',
        name: 'greet',
        description: 'greet',
        command: 'echo {{name}} --key={{config.apiKey}}',
        schema: { name: { type: 'string', description: 'name' } },
      },
      '/tmp',
      'my_skill',
      ['apiKey'],
    )
    await t.invoke({ name: 'world' })

    const cmd = capturedCommands[0]?.command ?? ''
    expect(cmd).toBe('echo world --key=key')
  })

  it('每次 invoke 实时读取配置（热更新验证）', async () => {
    mockGetSkillConfig
      .mockReturnValueOnce({ token: 'old-token' })
      .mockReturnValueOnce({ token: 'new-token' })

    const t = commandToTool(
      { type: 'command', name: 'auth', description: 'auth', command: 'cli --token={{config.token}}' },
      '/tmp',
      'my_skill',
      ['token'],
    )

    await t.invoke({})
    await t.invoke({})

    expect(capturedCommands[0].command).toContain('old-token')
    expect(capturedCommands[1].command).toContain('new-token')
  })
})

// ─── scriptToTool：config 注入 ────────────────────────────────────────────────

describe('scriptToTool() — config 注入', () => {
  it('{{config.KEY}} 在 script 模板中正确替换', async () => {
    mockGetSkillConfig.mockReturnValue({ model: 'gpt-4' })

    const t = scriptToTool(
      { type: 'script', name: 'run_model', description: 'run', script: 'python run.py --model={{config.model}}' },
      '/tmp',
      'my_skill',
      ['model'],
    )
    await t.invoke({})

    const cmd = capturedCommands[0]?.command ?? ''
    expect(cmd).toContain('gpt-4')
    expect(cmd).not.toContain('{{config.model}}')
  })

  it('有 configFieldKeys 时调用 getSkillConfig', async () => {
    const t = scriptToTool(
      { type: 'script', name: 's', description: 's', script: 'python s.py' },
      '/tmp',
      'script_skill',
      ['key1', 'key2'],
    )
    await t.invoke({})

    expect(mockGetSkillConfig).toHaveBeenCalledWith('script_skill', ['key1', 'key2'])
  })
})

// ─── loadJsTools：skillConfig 传入沙箱 ───────────────────────────────────────

describe('loadJsTools() — skillConfig 传入沙箱', () => {
  // 创建真实 JS 文件路径（parseToolMeta 需要读取文件，我们直接 mock runInSandbox）
  // 由于 parseToolMeta 使用 vm.runInContext 执行文件，测试中需要真实 JS 内容

  it('无 configFieldKeys 时 skillConfig 为空对象', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')

    const dir = mkdtempSync(`${tmpdir()}/js-adapter-test-`)
    const jsPath = join(dir, 'tool.js')
    writeFileSync(jsPath, `
      module.exports = {
        name: 'my_tool',
        description: 'A test tool',
        schema: { input: { type: 'string', description: 'input' } },
        execute: async ({ input }) => 'result'
      }
    `)

    const tools = loadJsTools(
      { type: 'js', file: 'tool.js' },
      dir,
      'my_skill',
      [],
    )

    expect(tools).toHaveLength(1)
    await tools[0].invoke({ input: 'test' })

    expect(mockRunInSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ skillConfig: {} }),
    )
  })

  it('有 configFieldKeys 时 skillConfig 包含 KV 中的值', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')

    mockGetSkillConfig.mockReturnValue({ apiKey: 'fetched-key', model: 'gpt-4o' })

    const dir = mkdtempSync(`${tmpdir()}/js-adapter-cfg-test-`)
    const jsPath = join(dir, 'tool.js')
    writeFileSync(jsPath, `
      module.exports = {
        name: 'cfg_tool',
        description: 'Uses config',
        schema: {},
        execute: async () => 'ok'
      }
    `)

    const tools = loadJsTools(
      { type: 'js', file: 'tool.js' },
      dir,
      'cfg_skill',
      ['apiKey', 'model'],
    )

    await tools[0].invoke({})

    expect(mockGetSkillConfig).toHaveBeenCalledWith('cfg_skill', ['apiKey', 'model'])
    expect(mockRunInSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ skillConfig: { apiKey: 'fetched-key', model: 'gpt-4o' } }),
    )
  })

  it('每次工具调用都实时读取配置（热更新）', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')

    mockGetSkillConfig
      .mockReturnValueOnce({ token: 'v1' })
      .mockReturnValueOnce({ token: 'v2' })

    const dir = mkdtempSync(`${tmpdir()}/js-adapter-hot-test-`)
    writeFileSync(join(dir, 'tool.js'), `
      module.exports = {
        name: 'hot_tool',
        description: 'Hot reload test',
        schema: {},
        execute: async () => 'ok'
      }
    `)

    const tools = loadJsTools({ type: 'js', file: 'tool.js' }, dir, 'hot_skill', ['token'])

    await tools[0].invoke({})
    await tools[0].invoke({})

    const calls = mockRunInSandbox.mock.calls
    expect(calls[0][0].skillConfig).toEqual({ token: 'v1' })
    expect(calls[1][0].skillConfig).toEqual({ token: 'v2' })
  })
})
