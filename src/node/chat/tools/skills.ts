import type { LoadedSkill } from '../skills/type'
import { tool } from 'langchain'
import z from 'zod'
import { logger } from '../../platform/logger'
import { skillManager } from '../skills/manager'

/**
 * 构建 loadSkillTool：每次会话开始时动态生成，反映热重载后的最新 skills 列表
 */
export function buildLoadSkillTool() {
  const availableSkillsList = skillManager
    .listSkills()
    .map((s: LoadedSkill) => `- ${s.name}: ${s.description}`)
    .join('\n') || '(暂无已安装的 skills)'

  return tool(
    async ({ skillName }) => {
      logger.info(`[loadSkillTool] Loading skill: ${skillName}`)

      const skill = skillManager.getSkill(skillName)

      if (!skill) {
        const names = skillManager.listSkills().map((s: LoadedSkill) => s.name).join(', ') || '(none)'
        logger.warn(`[loadSkillTool] Skill not found: ${skillName}`)
        return `Skill "${skillName}" not found. Available skills: ${names}`
      }

      logger.info(`[loadSkillTool] Skill loaded: ${skillName}, prompt length: ${skill.prompt?.length ?? 0}`)

      if (!skill.prompt)
        return `Skill "${skillName}" loaded. No additional instructions.`

      return skill.prompt
    },
    {
      name: 'load_skill',
      description: `Load a specialized skill prompt to enhance your capabilities for a specific domain.
Once loaded, follow the skill's instructions for the remainder of the conversation.

Available skills:
${availableSkillsList}`,
      schema: z.object({
        skillName: z.string().describe('The name of the skill to load (e.g. "code_assistant", "sql_expert")'),
      }),
    },
  )
}

/**
 * 允许 AI 主动触发 skills 热重载（用于调试或用户安装了新 skill 后）
 */
export const reloadSkillsTool = tool(
  async () => {
    logger.info('[reloadSkillsTool] Reloading skills...')
    skillManager.reload()
    const count = skillManager.size
    const names = skillManager.listSkills().map((s: LoadedSkill) => s.name).join(', ')
    return `Skills reloaded. ${count} skill(s) available: ${names || '(none)'}`
  },
  {
    name: 'reload_skills',
    description: 'Reload all installed skills from disk. Use this after the user installs or updates a skill.',
    schema: z.object({}),
  },
)

/** @deprecated 使用 buildLoadSkillTool() 替代，以获取热重载支持 */
export const loadSkillTool = buildLoadSkillTool()
