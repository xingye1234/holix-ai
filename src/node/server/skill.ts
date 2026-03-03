import type { SkillManifest } from '../chat/skills/type'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { skillManager } from '../chat/skills/manager'
import { BUILTIN_SKILLS_PATH } from '../constant'
import { procedure, router } from './trpc'

export const skillRouter = router({
  list: procedure().query(() => {
    return skillManager.listSkills().map((skill) => {
      const isBuiltin = skill.dir.startsWith(BUILTIN_SKILLS_PATH)

      // 重读 skill.json 拿 permissions 等原始声明
      let manifest: SkillManifest | null = null
      const manifestPath = join(skill.dir, 'skill.json')
      if (existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        }
        catch {}
      }

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
      }
    })
  }),
})
