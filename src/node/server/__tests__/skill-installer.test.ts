import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectSkillDirs, parseGitHubSource } from '../skill-installer'

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
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
