import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToolApprovalModal } from '../tool-approval-modal'
import { useMessageStore } from '@/store/message'
import { useToolApprovalStore } from '@/store/tool-approval'

const mocks = vi.hoisted(() => ({
  pathname: '/chat/chat-1',
}))

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: mocks.pathname } }),
}))

vi.mock('@/lib/trpc-client', () => ({
  trpcClient: {
    approval: {
      setAlwaysAllow: vi.fn(),
      setSessionAllowAll: vi.fn(),
    },
  },
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: any }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: any }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: any }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: any }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: any }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: any }) => <div>{children}</div>,
}))

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

function makeAssistantMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    uid: 'msg-1',
    seq: 1,
    chatUid: 'chat-1',
    role: 'assistant',
    kind: 'message',
    content: '',
    draftContent: [],
    toolCalls: [],
    status: 'streaming',
    toolStatus: undefined,
    model: 'gpt-4o',
    searchable: true,
    searchIndexVersion: 1,
    parentUid: null,
    requestId: null,
    streamId: null,
    toolName: null,
    toolPayload: null,
    telemetry: null,
    error: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  }
}

describe('ToolApprovalModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pathname = '/chat/chat-1'

    useMessageStore.setState({
      chatMessages: {
        'chat-1': ['msg-1'],
      },
      messages: {
        'msg-1': makeAssistantMessage(),
      },
      initialLoaded: new Set(['chat-1']),
    })

    useToolApprovalStore.setState({
      pendingRequest: {
        callbackId: 'cb-1',
        toolName: 'exec_command',
        skillName: 'shell',
        description: 'run command',
        messageUid: 'msg-1',
        args: { cmd: 'pnpm test' },
        resolve: vi.fn(),
      },
    })
  })

  it('does not render the fallback modal when the approval can be shown inside the visible chat message', () => {
    render(<ToolApprovalModal />)

    expect(screen.queryByText('高风险操作需要确认')).not.toBeInTheDocument()
  })

  it('renders the fallback modal when the request message belongs to a different chat route', () => {
    mocks.pathname = '/chat/chat-2'

    render(<ToolApprovalModal />)

    expect(screen.getByText('高风险操作需要确认')).toBeInTheDocument()
    expect(screen.getByText('exec_command')).toBeInTheDocument()
  })

  it('renders the fallback modal when the request has no bound message uid', () => {
    useToolApprovalStore.setState((state) => ({
      ...state,
      pendingRequest: state.pendingRequest
        ? {
            ...state.pendingRequest,
            messageUid: undefined,
          }
        : null,
    }))

    render(<ToolApprovalModal />)

    expect(screen.getByText('高风险操作需要确认')).toBeInTheDocument()
  })
})
