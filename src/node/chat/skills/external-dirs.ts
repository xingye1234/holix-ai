import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

export function getExternalSkillsDirs(): string[] {
  const home = homedir()
  const defaults = [
    join(home, '.codex', 'skills'),
    join(home, '.holix', 'skills'),
    join(home, '.claude', 'skills'),
    join(home, '.openclaw', 'skills'),
    join(home, '.agents', 'skills'),
    join(home, '.codebuddy', 'skills'),
    join(home, '.codex', 'skills'),
    join(home, '.commandcode', 'skills'),
    join(home, '.continue', 'skills'),
    join(home, '.snowflake', 'cortex', 'skills'),
    join(home, '.config', 'crush', 'skills'),
    join(home, '.cursor', 'skills'),
    join(home, '.factory', 'skills'),
    join(home, '.gemini', 'skills'),
    join(home, '.copilot', 'skills'),
    join(home, '.config', 'goose', 'skills'),
    join(home, '.junie', 'skills'),
    join(home, '.iflow', 'skills'),
    join(home, '.kilocode', 'skills'),
    join(home, '.qwen', 'skills'),
    join(home, '.kiro', 'skills'),
    join(home, '.kode', 'skills'),
    join(home, '.mcpjam', 'skills'),
    join(home, '.vibe', 'skills'),
    join(home, '.mux', 'skills'),
    join(home, '.config', 'opencode', 'skills'),
    join(home, '.openhands', 'skills'),
    join(home, '.pi', 'agent', 'skills'),
    join(home, '.qoder', 'skills'),
    join(home, '.roo', 'skills'),
    join(home, '.trae-cn', 'skills'),
    join(home, '.trae', 'skills'),
    join(home, '.codeium', 'windsurf', 'skills'),
    join(home, '.zencoder', 'skills'),
    join(home, '.neovate', 'skills'),
    join(home, '.pochi', 'skills'),
    join(home, '.adal', 'skills'),
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
