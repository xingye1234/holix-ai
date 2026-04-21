import { kvGet, kvSet } from './kv-operations'

const CHAT_TITLE_GENERATED_PREFIX = 'chat.title.generated'

function chatTitleGeneratedKey(chatUid: string) {
  return `${CHAT_TITLE_GENERATED_PREFIX}.${chatUid}`
}

export function hasGeneratedInitialTitle(chatUid: string): boolean {
  return kvGet<boolean>(chatTitleGeneratedKey(chatUid)) === true
}

export function markInitialTitleGenerated(chatUid: string): void {
  kvSet(chatTitleGeneratedKey(chatUid), true)
}
