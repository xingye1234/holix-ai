import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── 导入被测模块（在 mock 之后）──────────────────────────────────────────────

// 由于 APP_DATA_PATH 已在模块加载时被读取
// 我们直接测 scanSkillsDir（通过 loader），SkillManager 通过 getSkillsDir 构建地址
// 为避免单例状态污染，从 manager 模块直接 import class 并手动实例化

import { scanSkillsDir } from '../loader'

// ─── Mock 依赖 ────────────────────────────────────────────────────────────────

vi.mock('../../../platform/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// mock adapters 避免 langchain 在单元测试中被实例化
vi.mock('../adapters/js', () => ({
  loadJsTools: vi.fn(() => []),
}))

vi.mock('../adapters/command', () => ({
  commandToTool: vi.fn(decl => ({
    name: decl.name,
    description: decl.description,
    invoke: vi.fn(async () => 'command result'),
  })),
  scriptToTool: vi.fn(decl => ({
    name: decl.name,
    description: decl.description,
    invoke: vi.fn(async () => 'script result'),
  })),
}))

// mock approval-state 避免 kv-operations → connect → constant → Electron 依赖链
vi.mock('../../tools/approval-state', () => ({
  approvalState: {
    isApproved: vi.fn(() => false),
    isAlwaysAllowed: vi.fn(() => false),
    setAlwaysAllow: vi.fn(),
    removeAlwaysAllow: vi.fn(),
    setSessionAllowAll: vi.fn(),
    setSessionAllowSkill: vi.fn(),
  },
}))

// mock approval / skill-invocation 避免 skill-invocation-log → connect → Electron 依赖链
vi.mock('../../tools/approval', () => ({
  wrapWithApproval: vi.fn((tool: unknown) => tool),
}))

vi.mock('../../tools/skill-invocation', () => ({
  wrapWithSkillInvocationLog: vi.fn((tool: unknown) => tool),
}))

// mock constant - SkillManager 通过 APP_DATA_PATH 构建技能目录
// 我们在每个测试中通过 SkillManager 内部的 skillsDir 来控制
vi.mock('../../../constant', () => ({
  APP_DATA_PATH: tmpdir(), // 初始占位，每个测试会使用独立临时目录
  BUILTIN_SKILLS_PATH: tmpdir(), // 内置 skills 目录占位，指向空临时目录
  databaseUrl: ':memory:', // connect.ts 需要此 export
}))

// ─── 测试辅助 ─────────────────────────────────────────────────────────────────

let testRoot: string

function makeSkillDir(skillName: string, manifest: object): void {
  const dir = join(testRoot, skillName)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'skill.json'), JSON.stringify(manifest), 'utf-8')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getSkillsDir + scanSkillsDir（集成）', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `holix-manager-test-${Date.now()}`)
    mkdirSync(testRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
  })

  it('从真实目录扫描并加载 skill', () => {
    makeSkillDir('code-assistant', {
      name: 'code_assistant',
      description: 'Expert code assistant',
      prompt: 'You are an expert coder.',
    })

    const skills = scanSkillsDir(testRoot)

    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('code_assistant')
    expect(skills[0].prompt).toBe('You are an expert coder.')
  })

  it('加载多个 skill 后列表完整', () => {
    makeSkillDir('skill-a', { name: 'skill_a', description: 'Skill A', prompt: 'Prompt A' })
    makeSkillDir('skill-b', { name: 'skill_b', description: 'Skill B', prompt: 'Prompt B' })

    const skills = scanSkillsDir(testRoot)

    expect(skills).toHaveLength(2)
  })

  it('skill 的 tools 列表默认为空（无 tools 声明时）', () => {
    makeSkillDir('no-tools', {
      name: 'no_tools',
      description: 'No tools skill',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].tools).toEqual([])
  })

  it('skill 声明 command tool 时 tools 被创建', () => {
    makeSkillDir('with-cmd', {
      name: 'with_cmd',
      description: 'Has command tool',
      tools: [
        {
          type: 'command',
          name: 'run_it',
          description: 'Run it',
          command: 'echo {{input}}',
          schema: { input: { type: 'string', description: 'Input' } },
        },
      ],
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].tools).toHaveLength(1)
    expect(skills[0].tools[0].name).toBe('run_it')
  })
})

describe('skillManager 单例行为模拟', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `holix-manager-test-${Date.now()}`)
    mkdirSync(testRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
  })

  it('通过 scanSkillsDir + reduce 模拟 getAllTools', () => {
    makeSkillDir('tool-skill', {
      name: 'tool_skill',
      description: 'Has tools',
      tools: [
        { type: 'command', name: 'cmd_a', description: 'Cmd A', command: 'echo a' },
        { type: 'command', name: 'cmd_b', description: 'Cmd B', command: 'echo b' },
      ],
    })

    const skills = scanSkillsDir(testRoot)
    const allTools = skills.flatMap(s => s.tools)

    expect(allTools).toHaveLength(2)
    expect(allTools.map(t => t.name)).toContain('cmd_a')
    expect(allTools.map(t => t.name)).toContain('cmd_b')
  })

  it('通过 scanSkillsDir + filter 模拟 getSystemPrompts', () => {
    makeSkillDir('prompt-a', { name: 'prompt_a', description: 'PA', prompt: 'Prompt text A' })
    makeSkillDir('no-prompt', { name: 'no_prompt', description: 'NP' })
    makeSkillDir('prompt-b', { name: 'prompt_b', description: 'PB', prompt: 'Prompt text B' })

    const skills = scanSkillsDir(testRoot)
    const prompts = skills
      .filter(s => s.prompt)
      .map(s => `[Skill: ${s.name}]\n${s.prompt}`)

    expect(prompts).toHaveLength(2)
    expect(prompts.some(p => p.includes('Prompt text A'))).toBe(true)
    expect(prompts.some(p => p.includes('Prompt text B'))).toBe(true)
  })

  it('重载（reload）后能访问新增的 skill', () => {
    // 第一次扫描
    makeSkillDir('existing', { name: 'existing', description: 'Already here' })
    const firstScan = scanSkillsDir(testRoot)
    expect(firstScan).toHaveLength(1)

    // 新增 skill
    makeSkillDir('new-skill', { name: 'new_skill', description: 'Newly added' })

    // 重新扫描
    const secondScan = scanSkillsDir(testRoot)
    expect(secondScan).toHaveLength(2)
    expect(secondScan.map(s => s.name)).toContain('new_skill')
  })

  it('重载后禁用的 skill 不再出现', () => {
    makeSkillDir('to-disable', { name: 'to_disable', description: 'Will be disabled' })

    const firstScan = scanSkillsDir(testRoot)
    expect(firstScan).toHaveLength(1)

    // 更新 manifest，禁用该 skill
    writeFileSync(
      join(testRoot, 'to-disable', 'skill.json'),
      JSON.stringify({ name: 'to_disable', description: 'Disabled', disabled: true }),
      'utf-8',
    )

    const secondScan = scanSkillsDir(testRoot)
    expect(secondScan).toHaveLength(0)
  })
})

describe('skillManager 单例（真实实例）', () => {
  // 注意：skillManager 在进程内是单例，为避免状态污染，
  // 我们通过检查 API 契约来测试，不依赖已安装的 skill
  it('skillManager 导出存在且具备预期方法', async () => {
    // 动态导入以避免与上方 mock 冲突
    const { skillManager } = await import('../manager')

    expect(typeof skillManager.initialize).toBe('function')
    expect(typeof skillManager.reload).toBe('function')
    expect(typeof skillManager.listSkills).toBe('function')
    expect(typeof skillManager.getSkill).toBe('function')
    expect(typeof skillManager.getAllTools).toBe('function')
    expect(typeof skillManager.getSystemPrompts).toBe('function')
    expect(typeof skillManager.watch).toBe('function')
    expect(typeof skillManager.unwatch).toBe('function')
    expect(typeof skillManager.size).toBe('number')
  })

  it('getSkill 对未知名称返回 undefined', async () => {
    const { skillManager } = await import('../manager')
    expect(skillManager.getSkill('__nonexistent__')).toBeUndefined()
  })

  it('listSkills 返回数组', async () => {
    const { skillManager } = await import('../manager')
    expect(Array.isArray(skillManager.listSkills())).toBe(true)
  })

  it('getAllTools 返回数组', async () => {
    const { skillManager } = await import('../manager')
    expect(Array.isArray(skillManager.getAllTools())).toBe(true)
  })

  it('getSystemPrompts 返回字符串数组', async () => {
    const { skillManager } = await import('../manager')
    const prompts = skillManager.getSystemPrompts()
    expect(Array.isArray(prompts)).toBe(true)
    for (const p of prompts) {
      expect(typeof p).toBe('string')
    }
  })
})
