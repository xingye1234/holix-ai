import { kvGet, kvSet } from './kv-operations'

export interface ChatSkillSettings {
  disabledSkills: string[]
  enabledSkills: string[]
}

export const DEFAULT_CHAT_SKILL_SETTINGS: ChatSkillSettings = {
  disabledSkills: [],
  enabledSkills: [],
}

function chatSkillSettingsKey(chatUid: string): string {
  return `chat.${chatUid}.skillSettings`
}

function normalizeSettings(input?: Partial<ChatSkillSettings> | null): ChatSkillSettings {
  return {
    disabledSkills: Array.isArray(input?.disabledSkills)
      ? [...new Set(input.disabledSkills.filter(Boolean))]
      : [],
    enabledSkills: Array.isArray(input?.enabledSkills)
      ? [...new Set(input.enabledSkills.filter(Boolean))]
      : [],
  }
}

export function getChatSkillSettings(chatUid: string): ChatSkillSettings {
  const data = kvGet<ChatSkillSettings>(chatSkillSettingsKey(chatUid))
  return normalizeSettings(data)
}

export function setChatSkillSettings(chatUid: string, settings: ChatSkillSettings): ChatSkillSettings {
  const normalized = normalizeSettings(settings)
  kvSet(chatSkillSettingsKey(chatUid), normalized)
  return normalized
}
