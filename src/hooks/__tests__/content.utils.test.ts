import { describe, expect, it } from 'vitest'
import { shouldAutoScrollToBottomOnUserMessage } from '@/views/main/content.utils'

describe('shouldAutoScrollToBottomOnUserMessage', () => {
  it('returns true for a new user message in the current chat when enabled', () => {
    expect(shouldAutoScrollToBottomOnUserMessage('chat-1', true, {
      chatUid: 'chat-1',
      message: { role: 'user' },
    })).toBe(true)
  })

  it('returns false when the setting is disabled', () => {
    expect(shouldAutoScrollToBottomOnUserMessage('chat-1', false, {
      chatUid: 'chat-1',
      message: { role: 'user' },
    })).toBe(false)
  })

  it('returns false for assistant messages or different chats', () => {
    expect(shouldAutoScrollToBottomOnUserMessage('chat-1', true, {
      chatUid: 'chat-1',
      message: { role: 'assistant' },
    })).toBe(false)

    expect(shouldAutoScrollToBottomOnUserMessage('chat-1', true, {
      chatUid: 'chat-2',
      message: { role: 'user' },
    })).toBe(false)
  })
})
