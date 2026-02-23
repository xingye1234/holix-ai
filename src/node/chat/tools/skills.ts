import { tool } from 'langchain'
import z from 'zod'
import { logger } from '../../platform/logger'
import { getSkill, listSkills } from '../skills'

const availableSkillsList = listSkills()
  .map(s => `- ${s.name}: ${s.description}`)
  .join('\n')

export const loadSkillTool = tool(
  async ({ skillName }) => {
    logger.info(`[loadSkillTool] Loading skill: ${skillName}`)

    const skill = getSkill(skillName)

    if (!skill) {
      const names = listSkills().map(s => s.name).join(', ')
      logger.warn(`[loadSkillTool] Skill not found: ${skillName}`)
      return `Skill "${skillName}" not found. Available skills: ${names}`
    }

    logger.info(`[loadSkillTool] Skill loaded: ${skillName}`)
    return skill.prompt
  },
  {
    name: 'load_skill',
    description: `Load a specialized skill to enhance your capabilities for a specific domain.
Once loaded, follow the skill's instructions for the remainder of the conversation.

Available skills:
${availableSkillsList}`,
    schema: z.object({
      skillName: z.string().describe('The name of the skill to load (e.g. "code_assistant", "sql_expert")'),
    }),
  },
)
