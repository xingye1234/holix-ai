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
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify(manifest), 'utf-8')
  writeFileSync(join(dir, 'SKILL.md'), `# ${skillName}\n`, 'utf-8')
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
      version: '1.0.0',
      description: 'Expert code assistant',
      entry: 'SKILL.md',
    })

    const skills = scanSkillsDir(testRoot)

    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('code_assistant')
    expect(skills[0].prompt).toContain('<skill_content')
  })

  it('加载多个 skill 后列表完整', () => {
    makeSkillDir('skill-a', { name: 'skill_a', version: '1.0.0', description: 'Skill A', entry: 'SKILL.md' })
    makeSkillDir('skill-b', { name: 'skill_b', version: '1.0.0', description: 'Skill B', entry: 'SKILL.md' })

    const skills = scanSkillsDir(testRoot)

    expect(skills).toHaveLength(2)
  })

  it('skill 的 allowedTools 列表默认为空（无 allowedTools 声明时）', () => {
    makeSkillDir('no-tools', {
      name: 'no_tools',
      version: '1.0.0',
      description: 'No tools skill',
      entry: 'SKILL.md',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].allowedTools).toEqual([])
  })

  it('skill 可以通过 metadata.allowedTools 声明允许使用的工具', () => {
    makeSkillDir('with-tools', {
      name: 'with_tools',
      version: '1.0.0',
      description: 'Has tool allowlist',
      entry: 'SKILL.md',
      allowedTools: ['glob', 'grep'],
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].allowedTools).toEqual(['glob', 'grep'])
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

  it('通过 scanSkillsDir + map 模拟获取 allowedTools', () => {
    makeSkillDir('tool-skill', {
      name: 'tool_skill',
      version: '1.0.0',
      description: 'Has tool allowlist',
      entry: 'SKILL.md',
      allowedTools: ['glob', 'grep'],
    })

    const skills = scanSkillsDir(testRoot)
    const allAllowedTools = skills.flatMap(s => s.allowedTools)

    expect(allAllowedTools).toEqual(['glob', 'grep'])
  })

  it('通过 scanSkillsDir + filter 模拟 getSystemPrompts', () => {
    makeSkillDir('prompt-a', { name: 'prompt_a', version: '1.0.0', description: 'PA', entry: 'SKILL.md' })
    makeSkillDir('no-prompt', { name: 'no_prompt', version: '1.0.0', description: 'NP', entry: 'SKILL.md' })
    makeSkillDir('prompt-b', { name: 'prompt_b', version: '1.0.0', description: 'PB', entry: 'SKILL.md' })

    const skills = scanSkillsDir(testRoot)
    const prompts = skills
      .filter(s => s.prompt)
      .map(s => `[Skill: ${s.name}]\n${s.prompt}`)

    expect(prompts).toHaveLength(3)
    expect(prompts.every(p => p.includes('<skill_content'))).toBe(true)
  })

  it('重载（reload）后能访问新增的 skill', () => {
    // 第一次扫描
    makeSkillDir('existing', { name: 'existing', version: '1.0.0', description: 'Already here', entry: 'SKILL.md' })
    const firstScan = scanSkillsDir(testRoot)
    expect(firstScan).toHaveLength(1)

    // 新增 skill
    makeSkillDir('new-skill', { name: 'new_skill', version: '1.0.0', description: 'Newly added', entry: 'SKILL.md' })

    // 重新扫描
    const secondScan = scanSkillsDir(testRoot)
    expect(secondScan).toHaveLength(2)
    expect(secondScan.map(s => s.name)).toContain('new_skill')
  })

  it('缺少 metadata.json 的 legacy skill 不再出现', () => {
    makeSkillDir('to-disable', { name: 'to_disable', version: '1.0.0', description: 'Will be skipped', entry: 'SKILL.md' })

    const firstScan = scanSkillsDir(testRoot)
    expect(firstScan).toHaveLength(1)

    rmSync(join(testRoot, 'to-disable', 'metadata.json'))

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
