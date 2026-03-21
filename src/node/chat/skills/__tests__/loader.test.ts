import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockLoadJsTools = vi.fn((..._args: any[]) => [])

vi.mock('../adapters/js', () => ({
  loadJsTools: (...args: any[]) => mockLoadJsTools(...args),
}))

vi.mock('../adapters/command', () => ({
  commandToTool: vi.fn(() => ({ name: 'mocked_command' })),
  scriptToTool: vi.fn(() => ({ name: 'mocked_script' })),
}))

vi.mock('../../tools/approval', () => ({
  wrapWithApproval: (tool: any) => tool,
}))

vi.mock('../../tools/skill-invocation', () => ({
  wrapWithSkillInvocationLog: (tool: any) => tool,
}))

const { getSkillsDir, scanSkillsDir } = await import('../loader')

let testRoot: string

function writeStandardSkill(
  dirName: string,
  metadata: Record<string, unknown>,
  entryFile = 'SKILL.md',
  entryContent = '# Skill Content',
): string {
  const dir = join(testRoot, dirName)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify(metadata), 'utf-8')
  writeFileSync(join(dir, entryFile), entryContent, 'utf-8')
  return dir
}

describe('getSkillsDir', () => {
  it('returns userDataDir/skills', () => {
    expect(getSkillsDir('/home/user/.holixai')).toBe(join('/home/user/.holixai', 'skills'))
  })
})

describe('scanSkillsDir (standard skills)', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `holix-skill-loader-test-${Date.now()}`)
    mkdirSync(testRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
  })

  it('returns [] when directory does not exist', () => {
    expect(scanSkillsDir('/path/does/not/exist')).toEqual([])
  })

  it('loads standard skill with metadata.json + entry', () => {
    writeStandardSkill('pdf-analysis', {
      name: 'pdf-analysis',
      version: '1.0.0',
      description: 'Analyze PDF',
      entry: 'SKILL.md',
    }, 'SKILL.md', '# Skill: PDF\n\nDo work')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('pdf-analysis')
    expect(skills[0].version).toBe('1.0.0')
    expect(skills[0].description).toBe('Analyze PDF')
    expect(skills[0].tools).toEqual([])
    expect(skills[0].prompt).toContain('<skill_content name="pdf-analysis">')
    expect(skills[0].prompt).toContain('# Skill: PDF')
    expect(skills[0].dir).toBe(join(testRoot, 'pdf-analysis'))
  })

  it('supports custom metadata.entry path', () => {
    const dir = join(testRoot, 'custom-entry')
    mkdirSync(join(dir, 'docs'), { recursive: true })
    writeFileSync(join(dir, 'metadata.json'), JSON.stringify({
      name: 'custom-entry',
      version: '1.2.3',
      description: 'Custom entry path',
      entry: 'docs/INSTRUCTION.md',
    }), 'utf-8')
    writeFileSync(join(dir, 'docs/INSTRUCTION.md'), '# Custom Entry', 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
    expect(skills[0].prompt).toContain('# Custom Entry')
  })

  it('skips invalid metadata required fields', () => {
    writeStandardSkill('invalid-skill', {
      name: 'invalid-skill',
      version: '1.0.0',
      entry: 'SKILL.md',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  it('skips unsafe metadata.entry path', () => {
    const dir = join(testRoot, 'unsafe-entry')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'metadata.json'), JSON.stringify({
      name: 'unsafe-entry',
      version: '1.0.0',
      description: 'unsafe',
      entry: '../outside.md',
    }), 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(0)
  })

  it('injects resource index for scripts/references/assets/tests', () => {
    const dir = writeStandardSkill('with-resources', {
      name: 'with-resources',
      version: '1.0.0',
      description: 'Has resources',
      entry: 'SKILL.md',
    })

    mkdirSync(join(dir, 'scripts'), { recursive: true })
    mkdirSync(join(dir, 'references'), { recursive: true })
    mkdirSync(join(dir, 'assets'), { recursive: true })
    mkdirSync(join(dir, 'tests'), { recursive: true })

    writeFileSync(join(dir, 'scripts/run.sh'), '#!/bin/bash', 'utf-8')
    writeFileSync(join(dir, 'references/guide.md'), '# guide', 'utf-8')
    writeFileSync(join(dir, 'assets/template.txt'), 'template', 'utf-8')
    writeFileSync(join(dir, 'tests/test-case.json'), '{}', 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
    expect(skills[0].prompt).toContain('<skill_resources>')
    expect(skills[0].prompt).toContain('- scripts/run.sh')
    expect(skills[0].prompt).toContain('- references/guide.md')
    expect(skills[0].prompt).toContain('- assets/template.txt')
    expect(skills[0].prompt).toContain('- tests/test-case.json')
  })

  it('keeps legacy skill.json compatibility as fallback', () => {
    const dir = join(testRoot, 'legacy')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'skill.json'), JSON.stringify({
      name: 'legacy_skill',
      description: 'legacy',
      prompt: 'legacy prompt',
    }), 'utf-8')

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('legacy_skill')
    expect(skills[0].prompt).toBe('legacy prompt')
  })

  it('deduplicates skill names', () => {
    writeStandardSkill('skill-a', {
      name: 'dup-skill',
      version: '1.0.0',
      description: 'A',
      entry: 'SKILL.md',
    })

    writeStandardSkill('skill-b', {
      name: 'dup-skill',
      version: '1.0.0',
      description: 'B',
      entry: 'SKILL.md',
    })

    const skills = scanSkillsDir(testRoot)
    expect(skills).toHaveLength(1)
  })
})
