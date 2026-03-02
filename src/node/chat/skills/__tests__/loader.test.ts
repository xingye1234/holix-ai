import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mock 依赖（必须在导入被测模块之前）────────────────────────────────────────

vi.mock('../../../platform/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// mock adapters，避免 langchain/electron 依赖链被拉入
vi.mock('../adapters/js', () => ({
  loadJsTools: vi.fn(() => []),
}))

vi.mock('../adapters/command', () => ({
  commandToTool: vi.fn(() => ({ name: 'mocked_command' })),
  scriptToTool: vi.fn(() => ({ name: 'mocked_script' })),
}))

import { getSkillsDir, scanSkillsDir } from '../loader'

// ─── 测试工具函数 ──────────────────────────────────────────────────────────────

let testRoot: string

function makeSkillDir(skillName: string, manifest: object): string {
  const dir = join(testRoot, skillName)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'skill.json'), JSON.stringify(manifest), 'utf-8')
  return dir
}

function makeSkillFile(filename: string, manifest: object): string {
  const filePath = join(testRoot, filename)
  writeFileSync(filePath, JSON.stringify(manifest), 'utf-8')
  return filePath
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getSkillsDir', () => {
  it('返回 userDataDir 下的 skills 子目录', () => {
    expect(getSkillsDir('/home/user/.holixai')).toBe('/home/user/.holixai/skills')
  })

  it('正确拼接路径', () => {
    const result = getSkillsDir('/tmp/test')
    expect(result).toContain('skills')
    expect(result.startsWith('/tmp/test')).toBe(true)
  })
})

describe('scanSkillsDir', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `holix-skill-loader-test-${Date.now()}`)
    mkdirSync(testRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
  })

  // ─── 目录不存在 ──────────────────────────────────────────────────────────────

  it('目录不存在时返回空数组', () => {
    const result = scanSkillsDir('/nonexistent/path/skills')
    expect(result).toEqual([])
  })

  // ─── 空目录 ───────────────────────────────────────────────────────────────────

  it('空目录返回空数组', () => {
    const result = scanSkillsDir(testRoot)
    expect(result).toEqual([])
  })

  // ─── 目录型 skill ─────────────────────────────────────────────────────────────

  it('加载有效的目录型 skill', () => {
    makeSkillDir('my-skill', {
      name: 'my_skill',
      description: 'A test skill',
    })

    const skills = scanSkillsDir(testRoot)

    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('my_skill')
    expect(skills[0].description).toBe('A test skill')
  })

  it('加载 skill 时正确填充默认版本号', () => {
    makeSkillDir('no-version-skill', {
      name: 'no_version',
      description: 'No version specified',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].version).toBe('1.0.0')
  })

  it('加载 skill 时保留清单中的版本号', () => {
    makeSkillDir('versioned-skill', {
      name: 'versioned',
      version: '2.3.1',
      description: 'Has a version',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].version).toBe('2.3.1')
  })

  it('加载 skill 时保留 prompt 字段', () => {
    makeSkillDir('prompt-skill', {
      name: 'prompt_skill',
      description: 'Has prompt',
      prompt: 'You are an expert assistant.',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].prompt).toBe('You are an expert assistant.')
  })

  it('prompt 为 undefined 时不报错', () => {
    makeSkillDir('no-prompt', {
      name: 'no_prompt',
      description: 'No prompt field',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].prompt).toBeUndefined()
  })

  it('dir 字段指向 skill 目录', () => {
    makeSkillDir('dir-test', {
      name: 'dir_test',
      description: 'Dir test',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].dir).toBe(join(testRoot, 'dir-test'))
  })

  it('加载多个 skill 目录', () => {
    makeSkillDir('skill-a', { name: 'skill_a', description: 'Skill A' })
    makeSkillDir('skill-b', { name: 'skill_b', description: 'Skill B' })
    makeSkillDir('skill-c', { name: 'skill_c', description: 'Skill C' })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(3)
    const names = skills.map(s => s.name).sort()
    expect(names).toEqual(['skill_a', 'skill_b', 'skill_c'])
  })

  // ─── 禁用 skill ───────────────────────────────────────────────────────────────

  it('disabled=true 的 skill 被跳过', () => {
    makeSkillDir('disabled-skill', {
      name: 'disabled',
      description: 'Should be skipped',
      disabled: true,
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  it('disabled=false 的 skill 正常加载', () => {
    makeSkillDir('enabled-skill', {
      name: 'enabled',
      description: 'Should be loaded',
      disabled: false,
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
  })

  // ─── 无效清单 ──────────────────────────────────────────────────────────────────

  it('缺少 name 字段的 skill 被跳过', () => {
    makeSkillDir('no-name', {
      description: 'No name field',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  it('缺少 description 字段的 skill 被跳过', () => {
    makeSkillDir('no-desc', {
      name: 'no_desc',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  it('空 name 的 skill 被跳过', () => {
    makeSkillDir('empty-name', {
      name: '   ',
      description: 'Whitespace name',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  it('JSON 损坏的 skill 被跳过、不抛异常', () => {
    const dir = join(testRoot, 'broken-skill')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'skill.json'), '{ invalid json !!!', 'utf-8')

    expect(() => scanSkillsDir(testRoot)).not.toThrow()
    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  it('目录中没有 skill.json 时跳过该目录', () => {
    const dir = join(testRoot, 'no-manifest')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'readme.txt'), 'no manifest here', 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  // ─── 单文件型 skill ────────────────────────────────────────────────────────────

  it('加载单文件型 skill（.json 在根目录）', () => {
    makeSkillFile('simple.json', {
      name: 'simple_skill',
      description: 'Simple file-based skill',
      prompt: 'Simple prompt',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('simple_skill')
    expect(skills[0].tools).toHaveLength(0)
  })

  it('单文件型 skill 的 dir 指向根目录', () => {
    makeSkillFile('file-skill.json', {
      name: 'file_skill',
      description: 'File skill',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].dir).toBe(testRoot)
  })

  it('忽略非 .json 的文件', () => {
    writeFileSync(join(testRoot, 'readme.md'), '# readme', 'utf-8')
    writeFileSync(join(testRoot, 'script.sh'), 'echo hello', 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  // ─── 重名去重 ──────────────────────────────────────────────────────────────────

  it('同名 skill 只保留第一个（去重）', () => {
    makeSkillDir('skill-dir-1', { name: 'duplicate', description: 'First' })
    makeSkillDir('skill-dir-2', { name: 'duplicate', description: 'Second' })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
    expect(skills[0].description).toBe('First')
  })

  // ─── 混合加载 ──────────────────────────────────────────────────────────────────

  it('同时加载目录型和单文件型 skill', () => {
    makeSkillDir('dir-skill', { name: 'dir_skill', description: 'Dir based' })
    makeSkillFile('file-skill.json', { name: 'file_skill', description: 'File based' })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(2)
    const names = skills.map(s => s.name).sort()
    expect(names).toEqual(['dir_skill', 'file_skill'])
  })
})
