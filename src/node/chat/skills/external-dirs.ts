import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function getExternalSkillsDirs(): string[] {
  const home = homedir()
  const defaults = [
    join(home, '.claude', 'skills'),
    join(home, '.cursor', 'skills'),
    join(home, '.gemini', 'skills'),
    join(home, '.qwen', 'skills'),
    join(home, '.kiro', 'skills'),
  ]

  const fromEnv = process.env.HOLIX_EXTERNAL_SKILL_DIRS
    ?.split(',')
    .map(dir => dir.trim())
    .filter(Boolean) ?? []

  const seen = new Set<string>()
  return [...defaults, ...fromEnv].filter((dir) => {
    if (seen.has(dir))
      return false

    seen.add(dir)
    return existsSync(dir)
  })
}
