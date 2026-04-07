import type { LoadedSkill } from '../../skills/type'
import type { Workspace } from '../../database/schema/chat'
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { APP_DATA_PATH } from '../../constant'
import { DEEP_AGENT_BUILTIN_TOOL_NAMES } from './session-builder-tools'

interface MaterializeRuntimeSkillsOptions {
  chatUid: string
  enabledSkills: LoadedSkill[]
}

export function materializeRuntimeSkills(
  options: MaterializeRuntimeSkillsOptions,
) {
  const { chatUid, enabledSkills } = options

  if (enabledSkills.length === 0) {
    return {
      skillSources: undefined as string[] | undefined,
      memorySources: undefined as string[] | undefined,
    }
  }

  const sessionRoot = join(APP_DATA_PATH, 'deepagents', 'sessions', safePathSegment(chatUid))
  const skillsRoot = join(sessionRoot, 'skills')
  rmSync(skillsRoot, { recursive: true, force: true })
  mkdirSync(skillsRoot, { recursive: true })

  for (const skill of enabledSkills) {
    const targetDir = join(skillsRoot, skill.name)
    cpSync(skill.dir, targetDir, { recursive: true, force: true })

    const targetSkillPath = join(targetDir, 'SKILL.md')
    if (!existsSync(targetSkillPath)) {
      writeFileSync(targetSkillPath, buildSkillMarkdown(skill), 'utf-8')
    }
  }

  const memorySources = materializeMemory(sessionRoot, enabledSkills)

  return {
    skillSources: [skillsRoot],
    memorySources,
  }
}

export function resolveBackendRoot(workspace?: Workspace[]) {
  const candidates = (workspace || [])
    .map((entry) => {
      if (entry.type === 'directory') {
        return resolve(entry.value)
      }

      if (entry.type === 'file') {
        return resolve(dirname(entry.value))
      }

      return null
    })
    .filter((value): value is string => Boolean(value))

  if (candidates.length === 0) {
    return process.cwd()
  }

  return findCommonPath(candidates)
}

function materializeMemory(
  sessionRoot: string,
  enabledSkills: LoadedSkill[],
) {
  if (enabledSkills.length === 0) {
    return undefined
  }

  mkdirSync(sessionRoot, { recursive: true })
  const memoryPath = join(sessionRoot, 'AGENTS.md')
  const body = [
    '# Holix Active Skills',
    '',
    'The following skill instructions are always relevant in this conversation.',
    '',
    ...enabledSkills.flatMap((skill) => {
      const promptBody = buildSkillBody(skill)
      return [
        `## ${skill.name}`,
        '',
        skill.description,
        '',
        promptBody,
        '',
      ]
    }),
  ].join('\n')

  writeFileSync(memoryPath, `${body.trimEnd()}\n`, 'utf-8')
  return [memoryPath]
}

function buildSkillMarkdown(skill: LoadedSkill) {
  const allowedTools = getAllowedToolsForSkill(skill)
  const lines = [
    '---',
    `name: ${skill.name}`,
    `description: ${JSON.stringify(skill.description)}`,
  ]

  if (allowedTools.length > 0) {
    lines.push('allowed-tools:')
    for (const toolName of allowedTools) {
      lines.push(`  - ${toolName}`)
    }
  }

  lines.push('---', '', buildSkillBody(skill))

  return `${lines.join('\n').trimEnd()}\n`
}

function buildSkillBody(skill: LoadedSkill) {
  if (skill.name === 'file_system') {
    return [
      '# Filesystem',
      '',
      'Use the built-in filesystem tools to inspect and update local files when the task requires it.',
      '',
      '- Use `ls` to inspect directories',
      '- Use `glob` to find files by pattern',
      '- Use `grep` to search within files',
      '- Use `read_file` to inspect file contents with pagination',
      '- Use `write_file` to create or overwrite files',
      '- Use `edit_file` for targeted replacements',
      '',
      'Prefer absolute paths when possible, and start from the configured workspace paths first.',
    ].join('\n')
  }

  if (skill.name === 'code_reader') {
    return [
      '# Code Reading',
      '',
      'Use the built-in filesystem tools for code navigation and inspection.',
      '',
      '- Use `glob` to find candidate files',
      '- Use `grep` to search for symbols or text',
      '- Use `read_file` with `offset` and `limit` to read focused code ranges',
      '',
      'Avoid reading large files all at once. Narrow down with `glob`/`grep` first, then read only the relevant sections.',
    ].join('\n')
  }

  if (skill.prompt?.trim()) {
    return skill.prompt.trim()
  }

  return [
    `# ${skill.name}`,
    '',
    skill.description,
  ].join('\n')
}

function getAllowedToolsForSkill(skill: LoadedSkill) {
  if (skill.name === 'file_system') {
    return ['ls', 'read_file', 'write_file', 'edit_file', 'glob', 'grep']
  }

  if (skill.name === 'code_reader') {
    return ['glob', 'grep', 'read_file']
  }

  return skill.allowedTools
    .filter(toolName => !DEEP_AGENT_BUILTIN_TOOL_NAMES.has(toolName))
}

function findCommonPath(paths: string[]) {
  const resolvedPaths = paths.map(path => resolve(path))
  const splitPaths = resolvedPaths.map(path => path.split(/[\\/]+/).filter(Boolean))

  if (splitPaths.length === 0) {
    return process.cwd()
  }

  const first = splitPaths[0]
  const common: string[] = []

  for (let index = 0; index < first.length; index++) {
    const segment = first[index]
    if (splitPaths.every(path => path[index] === segment)) {
      common.push(segment)
    }
    else {
      break
    }
  }

  const root = resolvedPaths[0].startsWith('/') ? '/' : ''
  return common.length > 0 ? `${root}${common.join('/')}` : dirname(resolvedPaths[0])
}

function safePathSegment(value: string) {
  return value.replace(/[^\w.-]+/g, '_')
}
