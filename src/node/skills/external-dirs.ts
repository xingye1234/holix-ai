import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

export interface ExternalSkillSource {
  id: string
  label: string
  path: string
}

function buildDefaultSources(home: string): ExternalSkillSource[] {
  return [
    { id: 'agents', label: 'Agents', path: join(home, '.config', 'agents', 'skills') },
    { id: 'codex', label: 'Codex', path: join(home, '.codex', 'skills') },
    { id: 'holix', label: 'Holix', path: join(home, '.holix', 'skills') },
    { id: 'claude', label: 'Claude', path: join(home, '.claude', 'skills') },
    { id: 'openclaw', label: 'OpenClaw', path: join(home, '.openclaw', 'skills') },
    { id: 'assistant-agents', label: 'Assistant Agents', path: join(home, '.agents', 'skills') },
    { id: 'codebuddy', label: 'CodeBuddy', path: join(home, '.codebuddy', 'skills') },
    { id: 'commandcode', label: 'Command Code', path: join(home, '.commandcode', 'skills') },
    { id: 'continue', label: 'Continue', path: join(home, '.continue', 'skills') },
    { id: 'snowflake-cortex', label: 'Snowflake Cortex', path: join(home, '.snowflake', 'cortex', 'skills') },
    { id: 'crush', label: 'Crush', path: join(home, '.config', 'crush', 'skills') },
    { id: 'cursor', label: 'Cursor', path: join(home, '.cursor', 'skills') },
    { id: 'factory', label: 'Factory', path: join(home, '.factory', 'skills') },
    { id: 'gemini', label: 'Gemini', path: join(home, '.gemini', 'skills') },
    { id: 'copilot', label: 'Copilot', path: join(home, '.copilot', 'skills') },
    { id: 'goose', label: 'Goose', path: join(home, '.config', 'goose', 'skills') },
    { id: 'junie', label: 'Junie', path: join(home, '.junie', 'skills') },
    { id: 'iflow', label: 'iFlow', path: join(home, '.iflow', 'skills') },
    { id: 'kilocode', label: 'KiloCode', path: join(home, '.kilocode', 'skills') },
    { id: 'qwen', label: 'Qwen', path: join(home, '.qwen', 'skills') },
    { id: 'kiro', label: 'Kiro', path: join(home, '.kiro', 'skills') },
    { id: 'kode', label: 'Kode', path: join(home, '.kode', 'skills') },
    { id: 'mcpjam', label: 'MCPJam', path: join(home, '.mcpjam', 'skills') },
    { id: 'vibe', label: 'Vibe', path: join(home, '.vibe', 'skills') },
    { id: 'mux', label: 'Mux', path: join(home, '.mux', 'skills') },
    { id: 'opencode', label: 'OpenCode', path: join(home, '.config', 'opencode', 'skills') },
    { id: 'openhands', label: 'OpenHands', path: join(home, '.openhands', 'skills') },
    { id: 'pi-agent', label: 'Pi Agent', path: join(home, '.pi', 'agent', 'skills') },
    { id: 'qoder', label: 'Qoder', path: join(home, '.qoder', 'skills') },
    { id: 'roo', label: 'Roo', path: join(home, '.roo', 'skills') },
    { id: 'trae-cn', label: 'Trae CN', path: join(home, '.trae-cn', 'skills') },
    { id: 'trae', label: 'Trae', path: join(home, '.trae', 'skills') },
    { id: 'windsurf', label: 'Windsurf', path: join(home, '.codeium', 'windsurf', 'skills') },
    { id: 'zencoder', label: 'Zencoder', path: join(home, '.zencoder', 'skills') },
    { id: 'neovate', label: 'Neovate', path: join(home, '.neovate', 'skills') },
    { id: 'pochi', label: 'Pochi', path: join(home, '.pochi', 'skills') },
    { id: 'adal', label: 'Adal', path: join(home, '.adal', 'skills') },
  ]
}

export function getExternalSkillSources(): ExternalSkillSource[] {
  const home = homedir()
  const defaults = buildDefaultSources(home)
  const envSources = process.env.HOLIX_EXTERNAL_SKILL_DIRS
    ?.split(',')
    .map(dir => dir.trim())
    .filter(Boolean)
    .map((dir, index) => ({
      id: `env-${index + 1}`,
      label: `Custom ${index + 1}`,
      path: dir,
    })) ?? []

  const seen = new Set<string>()
  return [...defaults, ...envSources].filter((source) => {
    if (seen.has(source.path))
      return false

    seen.add(source.path)
    return existsSync(source.path)
  })
}

export function getExternalSkillsDirs(): string[] {
  return getExternalSkillSources().map(source => source.path)
}
