import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatContext } from '@/context/chat'

const mocks = vi.hoisted(() => ({
  skillList: vi.fn(),
  getSkillSettings: vi.fn(),
  getConfig: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: vi.fn(),
  },
}))

vi.mock('@/lib/config', () => ({
  getConfig: mocks.getConfig,
}))

vi.mock('@/lib/trpc-client', () => ({
  trpcClient: {
    skill: {
      list: mocks.skillList,
    },
    chat: {
      getSkillSettings: mocks.getSkillSettings,
      updateContextSettings: vi.fn(),
      updateSkillSettings: vi.fn(),
    },
  },
}))

import RightContextSettings from '../right-context-settings'

function makeChat(overrides = {}) {
  return {
    id: 1,
    uid: 'chat-1',
    title: 'Test Chat',
    provider: 'openai',
    model: 'gpt-4o',
    status: 'active' as const,
    pinned: false,
    archived: false,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    expiresAt: null,
    lastSeq: 0,
    lastMessagePreview: null,
    pendingMessages: null,
    prompts: [],
    workspace: null,
    contextSettings: {
      maxMessages: 10,
      timeWindowHours: 24,
      autoScrollToBottomOnSend: true,
    },
    ...overrides,
  }
}

function renderSettings(chat = makeChat()) {
  return render(
    <ChatContext.Provider
      value={{
        chat,
        chatId: chat.uid,
        pendingMessages: [],
        isAtBottom: true,
        setIsAtBottom: vi.fn(),
        scrollToBottomRef: { current: null },
      }}
    >
      <RightContextSettings />
    </ChatContext.Provider>,
  )
}

describe('rightContextSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignores stale skill settings responses when switching chats quickly', async () => {
    const firstSettings = Promise.withResolvers<{ disabledSkills: string[], enabledSkills: string[] }>()
    const secondSettings = Promise.withResolvers<{ disabledSkills: string[], enabledSkills: string[] }>()

    mocks.skillList.mockResolvedValue([
      { name: 'skill-a', description: 'Skill A' },
    ])
    mocks.getConfig.mockResolvedValue({
      disabledSkills: [],
    })
    mocks.getSkillSettings
      .mockImplementationOnce(() => firstSettings.promise)
      .mockImplementationOnce(() => secondSettings.promise)

    const { rerender } = renderSettings(makeChat({ uid: 'chat-1' }))

    rerender(
      <ChatContext.Provider
        value={{
          chat: makeChat({ uid: 'chat-2' }),
          chatId: 'chat-2',
          pendingMessages: [],
          isAtBottom: true,
          setIsAtBottom: vi.fn(),
          scrollToBottomRef: { current: null },
        }}
      >
        <RightContextSettings />
      </ChatContext.Provider>,
    )

    await act(async () => {
      secondSettings.resolve({
        disabledSkills: ['skill-a'],
        enabledSkills: [],
      })
      await secondSettings.promise
    })

    await waitFor(() => {
      expect(screen.getByText('skill-a')).toBeInTheDocument()
      expect(screen.getByText('来源：会话强制禁用')).toBeInTheDocument()
    })

    await act(async () => {
      firstSettings.resolve({
        disabledSkills: [],
        enabledSkills: ['skill-a'],
      })
      await firstSettings.promise
    })

    expect(screen.getByText('来源：会话强制禁用')).toBeInTheDocument()
    expect(screen.queryByText('来源：会话强制启用')).not.toBeInTheDocument()
  })
})
