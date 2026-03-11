import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  sourceRepo: '',
}))

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn((command: string, args: string[]) => {
    if (command !== 'git' || args[0] !== 'clone') {
      throw new Error('unexpected command')
    }

    const targetDir = args[args.length - 1]
    cpSync(mocked.sourceRepo, targetDir, { recursive: true })
  }),
}))

import { collectSkillDirs, installSkillsFromGitHub, parseGitHubSource } from '../skill-installer'

afterEach(() => {
  if (mocked.sourceRepo && existsSync(mocked.sourceRepo)) {
    rmSync(mocked.sourceRepo, { recursive: true, force: true })
  }
  mocked.sourceRepo = ''
})

describe('parseGitHubSource', () => {
  it('parses github repository url', () => {
    expect(parseGitHubSource('https://github.com/antfu/skills')).toEqual({ repo: 'antfu/skills' })
  })

  it('parses github tree url with ref and path', () => {
    expect(parseGitHubSource('https://github.com/antfu/skills/tree/main/skills')).toEqual({
      repo: 'antfu/skills',
      ref: 'main',
      path: 'skills',
    })
  })

  it('parses owner/repo shorthand', () => {
    expect(parseGitHubSource('antfu/skills')).toEqual({ repo: 'antfu/skills' })
  })
})

describe('collectSkillDirs', () => {
  it('collects direct skill dir and nested skill dirs', () => {
    const root = mkdtempSync(join(tmpdir(), 'skill-installer-test-'))
    try {
      const single = join(root, 'single')
      mkdirSync(single)
      writeFileSync(join(single, 'skill.json'), '{"name":"single"}')
      expect(collectSkillDirs(single)).toEqual([single])

      const group = join(root, 'group')
      const skillA = join(group, 'a')
      const skillB = join(group, 'b')
      mkdirSync(skillA, { recursive: true })
      mkdirSync(skillB, { recursive: true })
      writeFileSync(join(skillA, 'skill.json'), '{"name":"a"}')
      writeFileSync(join(skillB, 'skill.json'), '{"name":"b"}')

      const dirs = collectSkillDirs(group)
      expect(dirs).toHaveLength(2)
      expect(dirs).toContain(skillA)
      expect(dirs).toContain(skillB)

      const markdownSkillRoot = join(root, 'markdown-skills')
      const claudeSkill = join(markdownSkillRoot, 'react')
      const agentsSkill = join(markdownSkillRoot, 'nextjs')
      mkdirSync(claudeSkill, { recursive: true })
      mkdirSync(agentsSkill, { recursive: true })
      writeFileSync(join(claudeSkill, 'CLAUDE.md'), '# React\n\nReact skill prompt')
      writeFileSync(join(agentsSkill, 'AGENTS.md'), '# Next.js\n\nNext.js skill prompt')

      const markdownDirs = collectSkillDirs(markdownSkillRoot)
      expect(markdownDirs).toHaveLength(2)
      expect(markdownDirs).toContain(claudeSkill)
      expect(markdownDirs).toContain(agentsSkill)
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('installSkillsFromGitHub', () => {
  it('creates skill.json from third-party markdown skill files', () => {
    const root = mkdtempSync(join(tmpdir(), 'skill-installer-local-'))
    mocked.sourceRepo = join(root, 'repo')
    const destination = join(root, 'dest')
    mkdirSync(join(mocked.sourceRepo, 'skills', 'react'), { recursive: true })
    mkdirSync(destination, { recursive: true })
    writeFileSync(join(mocked.sourceRepo, 'skills', 'react', 'CLAUDE.md'), '# React\n\nUse hooks first.')

    const result = installSkillsFromGitHub({
      source: 'owner/repo',
      destinationDir: destination,
      path: 'skills',
      ref: 'main',
    })

    expect(result.installed).toEqual(['react'])

    const manifestPath = join(destination, 'react', 'skill.json')
    expect(existsSync(manifestPath)).toBe(true)

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      name: string
      description: string
      prompt: string
    }

    expect(manifest.name).toBe('react')
    expect(manifest.description).toContain('React')
    expect(manifest.prompt).toContain('Use hooks first.')

    rmSync(root, { recursive: true, force: true })
    mocked.sourceRepo = ''
  })
})
