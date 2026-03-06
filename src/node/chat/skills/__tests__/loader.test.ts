import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getSkillsDir, scanSkillsDir } from '../loader'

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
const mockLoadJsTools = vi.fn((..._args: any[]): any[] => [])

vi.mock('../adapters/js', () => ({
  loadJsTools: (...args: any[]) => mockLoadJsTools(...args),
}))

vi.mock('../adapters/command', () => ({
  commandToTool: vi.fn(() => ({ name: 'mocked_command' })),
  scriptToTool: vi.fn(() => ({ name: 'mocked_script' })),
}))

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

  it('jSON 损坏的 skill 被跳过、不抛异常', () => {
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

  it('忽略无有效 frontmatter 的 .md 文件和非 .md/.json 的文件', () => {
    writeFileSync(join(testRoot, 'readme.md'), '# readme', 'utf-8')
    writeFileSync(join(testRoot, 'script.sh'), 'echo hello', 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  // ─── SKILL.md (antfu/skills 格式) ─────────────────────────────────────────────

  it('加载独立 SKILL.md 文件（antfu/skills 格式）', () => {
    const content = [
      '---',
      'name: vite',
      'description: Vite build tool configuration and plugin API.',
      'metadata:',
      '  author: Anthony Fu',
      '  version: "2026.1.31"',
      '---',
      '',
      '# Vite',
      '',
      'Vite is a next-generation frontend build tool.',
    ].join('\n')
    writeFileSync(join(testRoot, 'SKILL.md'), content, 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('vite')
    expect(skills[0].description).toBe('Vite build tool configuration and plugin API.')
    expect(skills[0].version).toBe('2026.1.31')
    expect(skills[0].prompt).toContain('# Vite')
    expect(skills[0].tools).toHaveLength(0)
  })

  it('sKILL.md 正文作为 system prompt 注入', () => {
    const content = [
      '---',
      'name: react',
      'description: React hooks and patterns.',
      '---',
      '',
      '# React',
      '',
      'Use functional components and hooks.',
    ].join('\n')
    writeFileSync(join(testRoot, 'react.md'), content, 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].prompt).toBe('# React\n\nUse functional components and hooks.')
  })

  it('sKILL.md 无正文时 prompt 为 undefined', () => {
    const content = ['---', 'name: empty_skill', 'description: Skill with no body.', '---'].join('\n')
    writeFileSync(join(testRoot, 'empty.md'), content, 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].prompt).toBeUndefined()
  })

  it('sKILL.md 缺少 description 时跳过', () => {
    const content = ['---', 'name: no_desc', '---', '', '# Something'].join('\n')
    writeFileSync(join(testRoot, 'no-desc.md'), content, 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  it('sKILL.md disabled=true 时跳过', () => {
    const content = ['---', 'name: disabled_skill', 'description: Should be skipped.', 'disabled: true', '---', '', '# Disabled'].join('\n')
    writeFileSync(join(testRoot, 'disabled.md'), content, 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  it('目录中的 SKILL.md 可以作为目录型 skill 加载', () => {
    const dir = join(testRoot, 'vite-skill')
    mkdirSync(dir, { recursive: true })
    const content = ['---', 'name: vite_dir', 'description: Vite in a directory.', '---', '', '# Vite Directory Skill'].join('\n')
    writeFileSync(join(dir, 'SKILL.md'), content, 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('vite_dir')
    expect(skills[0].dir).toBe(dir)
  })

  it('目录同时有 skill.json 和 SKILL.md 时优先使用 skill.json', () => {
    const dir = join(testRoot, 'mixed-skill')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'skill.json'), JSON.stringify({ name: 'from_json', description: 'From JSON manifest' }), 'utf-8')
    const mdContent = ['---', 'name: from_md', 'description: From SKILL.md', '---'].join('\n')
    writeFileSync(join(dir, 'SKILL.md'), mdContent, 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('from_json')
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

  // ─── config 字段（SkillConfigField）─────────────────────────────────────────

  it('manifest 中的 config 字段被正确透传', () => {
    makeSkillDir('config-skill', {
      name: 'config_skill',
      description: 'Has config fields',
      config: [
        { key: 'apiKey', type: 'string', label: 'API Key', required: true, secret: true },
        { key: 'model', type: 'select', label: 'Model', options: [{ value: 'gpt-4', label: 'GPT-4' }] },
      ],
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
    // config 字段不直接挂在 LoadedSkill 上，但 loader 不报错，正确加载
    expect(skills[0].name).toBe('config_skill')
  })

  it('manifest 无 config 字段时正常加载', () => {
    makeSkillDir('no-config-skill', {
      name: 'no_config',
      description: 'No config field declared',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills[0].name).toBe('no_config')
  })

  it('config 字段中的 key 列表被正确传给 buildTools（通过 mock 验证）', () => {
    mockLoadJsTools.mockClear()

    makeSkillDir('js-config-skill', {
      name: 'js_config',
      description: 'JS skill with config',
      config: [
        { key: 'apiKey', type: 'password', label: 'API Key' },
        { key: 'timeout', type: 'number', label: 'Timeout' },
      ],
      tools: [
        { type: 'js', file: 'tool.js' },
      ],
    })

    scanSkillsDir(testRoot)

    // loadJsTools 应被调用，且第四个参数为 configFieldKeys
    expect(mockLoadJsTools).toHaveBeenCalled()
    const [, , , configFieldKeys] = mockLoadJsTools.mock.calls[0] as unknown as [any, any, any, string[]]
    expect(configFieldKeys).toEqual(['apiKey', 'timeout'])
  })
})
