import type { StructuredToolInterface } from '@langchain/core/tools'
import type { createDeepAgent } from 'deepagents'
import type { LoadedSkill } from '../../skills/type'
import { configStore } from '../../platform/config'
import { getChatSkillSettings } from '../../database/chat-skill-settings'
import { skillManager } from '../../skills'
import { loadMcpTools } from '../mcp/tools'
import { chatKeywordSearchTool, chatTimeSearchTool } from '../tools/chat'
import { context7Tool } from '../tools/context7'
import { systemEnvTool, systemPlatformTool, systemTimeTool, systemTimezoneTool } from '../tools/system'

export const DEEP_AGENT_BUILTIN_TOOL_NAMES = new Set([
  'ls',
  'read_file',
  'write_file',
  'edit_file',
  'glob',
  'grep',
  'execute',
])

type DeepAgentParams = NonNullable<Parameters<typeof createDeepAgent>[0]>
export type SessionDeepAgentTools = NonNullable<DeepAgentParams['tools']>

export function getEnabledSkills(chatUid: string): LoadedSkill[] {
  const chatSkillSettings = getChatSkillSettings(chatUid)
  const disabledSkills = new Set(configStore.get('disabledSkills') || [])

  for (const skillName of chatSkillSettings.enabledSkills) {
    disabledSkills.delete(skillName)
  }

  for (const skillName of chatSkillSettings.disabledSkills) {
    disabledSkills.add(skillName)
  }

  return skillManager
    .listSkills()
    .filter(skill => !disabledSkills.has(skill.name))
}

export async function buildSessionTools(_enabledSkills: LoadedSkill[]) {
  const baseTools: StructuredToolInterface[] = [
    systemPlatformTool,
    systemEnvTool,
    systemTimezoneTool,
    systemTimeTool,
    chatTimeSearchTool,
    chatKeywordSearchTool,
  ]

  if (configStore.get('context7ApiKey')) {
    baseTools.push(context7Tool)
  }

  const mcpTools = await loadMcpTools()

  return dedupeToolsByName([
    ...baseTools,
    ...mcpTools,
  ])
}

export function asDeepAgentTools(tools: StructuredToolInterface[]): SessionDeepAgentTools {
  return tools as unknown as SessionDeepAgentTools
}

function dedupeToolsByName(tools: StructuredToolInterface[]) {
  const unique = new Map<string, StructuredToolInterface>()

  for (const tool of tools) {
    if (!unique.has(tool.name)) {
      unique.set(tool.name, tool)
    }
  }

  return Array.from(unique.values())
}
