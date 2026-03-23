export interface MessageCreatedForAutoScroll {
  chatUid: string
  message: {
    role?: string | null
  }
}

export function shouldAutoScrollToBottomOnUserMessage(
  currentChatUid: string | undefined,
  autoScrollToBottomOnSend: boolean,
  payload: MessageCreatedForAutoScroll,
): boolean {
  if (!currentChatUid || !autoScrollToBottomOnSend) {
    return false
  }

  return payload.chatUid === currentChatUid && payload.message?.role === 'user'
}
