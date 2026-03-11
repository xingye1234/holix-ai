import { describe, expect, it, vi } from 'vitest'

describe('getExternalSkillsDirs', () => {
  it('includes existing third-party skills dirs and env overrides', async () => {
    vi.resetModules()

    const existing = new Set([
      '/home/test/.claude/skills',
      '/home/test/.qwen/skills',
      '/custom/skills-a',
    ])

    vi.doMock('node:os', () => ({
      homedir: () => '/home/test',
    }))

    vi.doMock('node:fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs')>()
      return {
        ...actual,
        existsSync: (path: string) => existing.has(path),
      }
    })

    process.env.HOLIX_EXTERNAL_SKILL_DIRS = ' /custom/skills-a, /custom/skills-a , /custom/skills-b '

    const { getExternalSkillsDirs } = await import('../external-dirs')
    expect(getExternalSkillsDirs()).toEqual([
      '/home/test/.claude/skills',
      '/home/test/.qwen/skills',
      '/custom/skills-a',
    ])

    delete process.env.HOLIX_EXTERNAL_SKILL_DIRS
    vi.resetModules()
  })
})
