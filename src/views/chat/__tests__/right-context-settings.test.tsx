import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatContext } from '@/context/chat'
import useChat from '@/store/chat'

const mocks = vi.hoisted(() => ({
  skillList: vi.fn(),
  getSkillSettings: vi.fn(),
  getConfig: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  chatUpdate: vi.fn(),
  chatDelete: vi.fn(),
  pathname: '/chat/chat-1',
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}))

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/i18n/provider', () => ({
  useI18n: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const dict: Record<string, string> = {
        'chat.settingsPanel.renameTitle': '会话名称',
        'chat.renamePlaceholder': '输入新的会话名称',
        'chat.settingsPanel.saveName': '保存名称',
        'chat.settingsPanel.skillSource.enabledByChat': '会话强制启用',
        'chat.settingsPanel.skillSource.disabledByChat': '会话强制禁用',
        'chat.settingsPanel.skillSource.disabledGlobally': '全局禁用',
        'chat.settingsPanel.skillSource.followGlobal': '跟随全局',
        'chat.settingsPanel.skillSourceLabel': '来源：',
      }

      if (key === 'chat.settingsPanel.currentExpiry')
        return `当前：${options?.value ?? ''}`

      return dict[key] ?? key
    },
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: mocks.pathname } }),
  useNavigate: () => vi.fn(),
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
      update: mocks.chatUpdate,
      delete: mocks.chatDelete,
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
    mocks.pathname = '/chat/chat-1'
    useChat.setState({
      chats: [makeChat()],
      isLoading: false,
      initialized: true,
      searchQuery: '',
    })
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

  it('allows renaming the current chat from the settings panel', async () => {
    const user = userEvent.setup()
    mocks.skillList.mockResolvedValue([])
    mocks.getConfig.mockResolvedValue({ disabledSkills: [] })
    mocks.getSkillSettings.mockResolvedValue({ disabledSkills: [], enabledSkills: [] })
    mocks.chatUpdate.mockResolvedValue({})

    renderSettings()

    const input = await screen.findByLabelText('会话名称')
    await user.clear(input)
    await user.type(input, 'Renamed Chat')
    const managementSection = input.closest('[data-slot="field"]')
    if (!managementSection)
      throw new Error('management section not found')
    await user.click(within(managementSection).getByRole('button', { name: '保存名称' }))

    expect(mocks.chatUpdate).toHaveBeenCalledWith({
      uid: 'chat-1',
      title: 'Renamed Chat',
    })
  })
})
