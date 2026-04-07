import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import z from 'zod'
import { getExternalSkillSources } from '../skills/external-dirs'
import { skillManager } from '../skills/manager'
import { BUILTIN_SKILLS_PATH } from '../constant'
import { deleteSkillConfig, getSkillConfig, setSkillConfigField } from '../database/skill-config'
import { listSkillInvocationLogs } from '../database/skill-invocation-log'
import { importSkillsFromDirectory, installSkillsFromGitHub } from './skill-installer'
import { procedure, router } from './trpc'

function inferSkillSourceLabel(skillDir: string, isBuiltin: boolean): string {
  if (isBuiltin)
    return 'builtin'

  if (skillDir.includes('/.holixai/'))
    return '.holixai'
  if (skillDir.includes('/.holix/'))
    return '.holix'
  if (skillDir.includes('/.codex/'))
    return '.codex'
  if (skillDir.includes('/.claude/'))
    return '.claude'
  if (skillDir.includes('/.cursor/'))
    return '.cursor'
  if (skillDir.includes('/.gemini/'))
    return '.gemini'
  if (skillDir.includes('/.qwen/'))
    return '.qwen'
  if (skillDir.includes('/.kiro/'))
    return '.kiro'

  return 'external'
}

function listResourceDirs(skillDir: string): string[] {
  const candidates = ['scripts', 'references', 'assets', 'tests']
  return candidates.filter((dirName) => {
    const fullPath = join(skillDir, dirName)
    return existsSync(fullPath) && statSync(fullPath).isDirectory()
  })
}

export const skillRouter = router({
  list: procedure().query(() => {
    return skillManager.listSkills().map((skill) => {
      const isBuiltin = skill.dir.startsWith(BUILTIN_SKILLS_PATH)
      const configFields = skill.config ?? []
      const configFieldKeys = configFields.map(f => f.key)
      const configValues = configFieldKeys.length > 0
        ? getSkillConfig(skill.name, configFieldKeys)
        : {}

      const sourceLabel = inferSkillSourceLabel(skill.dir, isBuiltin)
      const sourcePath = skill.dir
      const relativeSourcePath = relative(process.cwd(), sourcePath)
      const promptPreview = skill.prompt
        ? (skill.prompt.length > 240 ? `${skill.prompt.slice(0, 240)}...` : skill.prompt)
        : null
      const availableResourceDirs = listResourceDirs(skill.dir)
      const allDirEntries = (() => {
        try {
          return readdirSync(skill.dir).filter((entry) => {
            const fullPath = join(skill.dir, entry)
            return existsSync(fullPath) && statSync(fullPath).isDirectory()
          }).sort()
        }
        catch {
          return []
        }
      })()

      return {
        name: skill.name,
        version: skill.version,
        description: skill.description,
        prompt: skill.prompt ?? null,
        isBuiltin,
        sourceLabel,
        sourcePath,
        relativeSourcePath,
        availableResourceDirs,
        allDirEntries,
        promptPreview,
        toolCount: skill.allowedTools.length,
        tools: skill.allowedTools.map(toolName => ({
          name: toolName,
          description: '',
        })),
        declarations: [],
        /** 配置字段声明列表（来自 manifest.config） */
        config: configFields,
        /** 当前已存储的配置值 */
        configValues,
      }
    })
  }),

  externalSources: procedure().query(() => {
    return getExternalSkillSources().map((source) => {
      let skillCount = 0

      try {
        skillCount = readdirSync(source.path)
          .map(name => join(source.path, name))
          .filter(path => existsSync(path) && statSync(path).isDirectory())
          .length
      }
      catch {
        skillCount = 0
      }

      return {
        id: source.id,
        label: source.label,
        path: source.path,
        skillCount,
      }
    })
  }),

  /** 写入单个配置字段 */
  setConfig: procedure()
    .input(z.object({
      skillName: z.string(),
      key: z.string(),
      value: z.unknown(),
    }))
    .mutation(({ input }) => {
      setSkillConfigField(input.skillName, input.key, input.value)
    }),

  /** 重置某个 skill 的所有配置 */
  resetConfig: procedure()
    .input(z.object({ skillName: z.string() }))
    .mutation(({ input }) => {
      deleteSkillConfig(input.skillName)
    }),

  invocationLogs: procedure()
    .input(z.object({
      limit: z.number().int().min(1).max(1000).optional(),
      offset: z.number().int().min(0).optional(),
      skillName: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await listSkillInvocationLogs({
        limit: input?.limit,
        offset: input?.offset,
        skillName: input?.skillName,
      })
    }),

  installFromGithub: procedure()
    .input(z.object({
      source: z.string().min(1),
      path: z.string().optional(),
      ref: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const result = installSkillsFromGitHub({
        source: input.source,
        path: input.path,
        ref: input.ref,
        destinationDir: skillManager.getSkillsDir(),
      })
      skillManager.reload()
      return result
    }),

  importFromExternal: procedure()
    .input(z.object({
      sourcePath: z.string().min(1),
    }))
    .mutation(({ input }) => {
      const source = getExternalSkillSources().find(item => item.path === input.sourcePath)
      if (!source) {
        throw new Error('外部 skills 来源不存在或当前不可用')
      }

      const result = importSkillsFromDirectory({
        sourceDir: source.path,
        destinationDir: skillManager.getSkillsDir(),
      })
      skillManager.reload()
      return result
    }),
})
