import type { SkillManifest } from '../chat/skills/type'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import z from 'zod'
import { skillManager } from '../chat/skills/manager'
import { BUILTIN_SKILLS_PATH } from '../constant'
import { listSkillInvocationLogs } from '../database/skill-invocation-log'
import { deleteSkillConfig, getSkillConfig, setSkillConfigField } from '../database/skill-config'
import { installSkillsFromGitHub } from './skill-installer'
import { procedure, router } from './trpc'

export const skillRouter = router({
  list: procedure().query(() => {
    return skillManager.listSkills().map((skill) => {
      const isBuiltin = skill.dir.startsWith(BUILTIN_SKILLS_PATH)

      // 重读 skill.json 拿 permissions、config 等原始声明
      let manifest: SkillManifest | null = null
      const manifestPath = join(skill.dir, 'skill.json')
      if (existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        }
        catch {}
      }

      const configFields = manifest?.config ?? []
      const configFieldKeys = configFields.map(f => f.key)
      const configValues = configFieldKeys.length > 0
        ? getSkillConfig(skill.name, configFieldKeys)
        : {}

      return {
        name: skill.name,
        version: skill.version,
        description: skill.description,
        prompt: skill.prompt ?? null,
        isBuiltin,
        toolCount: skill.tools.length,
        tools: skill.tools.map(t => ({
          name: t.name,
          description: t.description,
        })),
        /** 原始工具声明（含 permissions） */
        declarations: manifest?.tools ?? [],
        /** 配置字段声明列表（来自 manifest.config） */
        config: configFields,
        /** 当前已存储的配置值 */
        configValues,
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
})
