/**
 * chatRouter 单元测试
 *
 * 覆盖 chatRouter 所有 procedure：create / getById / list /
 * updateModel / update / updatePrompts / updateWorkspace /
 * updatePendingMessages / delete
 *
 * Mock 策略：
 * - `../../database/chat-operations` → 完全 mock，控制返回值
 * - `../../platform/update`          → spy，验证 IPC 通知
 *
 * 通用 mocks（electron, logger, database/connect）已在 test-setup.ts 中统一配置
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mock 数据库操作 ─────────────────────────────────────────────────────────
vi.mock('../../database/chat-operations', () => ({
  cleanupExpiredChats: vi.fn(),
  createChat: vi.fn(),
  getAllChats: vi.fn(),
  getChatByUid: vi.fn(),
  updateChat: vi.fn(),
  updateChatContextSettings: vi.fn(),
  updateChatModel: vi.fn(),
  deleteChat: vi.fn(),
  updateChatPrompts: vi.fn(),
  updateChatWorkspace: vi.fn(),
  updatePendingMessages: vi.fn(),
}))

// ─── Mock IPC update ─────────────────────────────────────────────────────────
vi.mock('../../platform/update', () => ({
  update: vi.fn(),
}))

vi.mock('../../database/chat-title-state', () => ({
  markInitialTitleGenerated: vi.fn(),
}))

// ─── 测试数据工厂 ─────────────────────────────────────────────────────────────
function makeChat(overrides = {}) {
  return {
    id: 1,
    uid: 'chat-uid-001',
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
    prompts: [] as any,
    workspace: null,
    contextSettings: {
      maxMessages: 10,
      timeWindowHours: 24,
      autoScrollToBottomOnSend: true,
    },
    ...overrides,
  }
}

// ─── 被测模块 ─────────────────────────────────────────────────────────────────
import * as chatOps from '../../database/chat-operations'
import { update } from '../../platform/update'
import { chatRouter } from '../chat'
import { createCaller } from '../trpc'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('chatRouter', () => {
  let caller: ReturnType<typeof createCaller<typeof chatRouter>>

  beforeEach(() => {
    vi.clearAllMocks()
    caller = createCaller(chatRouter)
  })

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('创建会话并返回新记录', async () => {
      const chat = makeChat()
      vi.mocked(chatOps.createChat).mockResolvedValue(chat)

      const result = await caller.create({
        provider: 'openai',
        model: 'gpt-4o',
        title: 'Test Chat',
      })

      expect(chatOps.createChat).toHaveBeenCalledWith({
        provider: 'openai',
        model: 'gpt-4o',
        title: 'Test Chat',
      })
      expect(result).toEqual(chat)
    })
  })

  // ── getById ──────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('返回存在的会话', async () => {
      const chat = makeChat()
      vi.mocked(chatOps.getChatByUid).mockResolvedValue(chat)

      const result = await caller.getById({ chatUid: 'chat-uid-001' })

      expect(chatOps.getChatByUid).toHaveBeenCalledWith('chat-uid-001')
      expect(result.uid).toBe('chat-uid-001')
    })

    it('抛出异常当会话不存在时', async () => {
      vi.mocked(chatOps.getChatByUid).mockResolvedValue(undefined as any)

      await expect(caller.getById({ chatUid: 'nonexistent' })).rejects.toThrow(
        'Chat not found: nonexistent',
      )
    })
  })

  // ── list ─────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('返回所有会话列表', async () => {
      const chats = [makeChat(), makeChat({ uid: 'chat-uid-002', title: 'Second Chat' })]
      vi.mocked(chatOps.cleanupExpiredChats).mockResolvedValue([])
      vi.mocked(chatOps.getAllChats).mockResolvedValue(chats)

      const result = await caller.list()

      expect(chatOps.cleanupExpiredChats).toHaveBeenCalled()
      expect(chatOps.getAllChats).toHaveBeenCalled()
      expect(result).toHaveLength(2)
    })

    it('空列表时返回 []', async () => {
      vi.mocked(chatOps.cleanupExpiredChats).mockResolvedValue(['expired-1'])
      vi.mocked(chatOps.getAllChats).mockResolvedValue([])
      const result = await caller.list()
      expect(update).toHaveBeenCalledWith('chat.deleted', { uid: 'expired-1' })
      expect(result).toEqual([])
    })
  })

  // ── updateModel ──────────────────────────────────────────────────────────

  describe('updateModel', () => {
    it('更新会话模型', async () => {
      vi.mocked(chatOps.updateChatModel).mockResolvedValue()

      const result = await caller.updateModel({
        chatUid: 'chat-uid-001',
        model: 'gpt-4o-mini',
      })

      expect(chatOps.updateChatModel).toHaveBeenCalledWith('chat-uid-001', 'gpt-4o-mini')
      expect(result).toEqual({ success: true })
    })
  })

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('更新会话标题', async () => {
      const updated = makeChat({ title: 'New Title' })
      vi.mocked(chatOps.updateChat).mockResolvedValue(updated)

      const result = await caller.update({
        uid: 'chat-uid-001',
        title: 'New Title',
      })

      expect(chatOps.updateChat).toHaveBeenCalledWith(
        'chat-uid-001',
        expect.objectContaining({ title: 'New Title' }),
      )
      expect(update).toHaveBeenCalledWith('chat.updated', {
        chatUid: 'chat-uid-001',
        updates: {
          title: 'New Title',
        },
      })
      expect(result.title).toBe('New Title')
    })

    it('归档会话', async () => {
      const archived = makeChat({ archived: true })
      vi.mocked(chatOps.updateChat).mockResolvedValue(archived)

      await caller.update({ uid: 'chat-uid-001', archived: true })

      expect(chatOps.updateChat).toHaveBeenCalledWith(
        'chat-uid-001',
        expect.objectContaining({ archived: true }),
      )
    })

    it('更新 provider 时只广播本次改动字段，避免覆盖并发 model 更新', async () => {
      const updated = makeChat({ provider: 'anthropic' })
      vi.mocked(chatOps.updateChat).mockResolvedValue(updated)

      await caller.update({
        uid: 'chat-uid-001',
        provider: 'anthropic',
      })

      expect(update).toHaveBeenCalledWith('chat.updated', {
        chatUid: 'chat-uid-001',
        updates: {
          provider: 'anthropic',
        },
      })
    })
  })

  // ── updatePrompts ────────────────────────────────────────────────────────

  describe('updatePrompts', () => {
    it('更新 prompts 并发送 IPC 通知', async () => {
      const chat = makeChat({ prompts: ['You are helpful.'] as any })
      vi.mocked(chatOps.updateChatPrompts).mockResolvedValue(chat)

      const result = await caller.updatePrompts({
        chatUid: 'chat-uid-001',
        prompts: ['You are helpful.'],
      })

      expect(chatOps.updateChatPrompts).toHaveBeenCalledWith('chat-uid-001', ['You are helpful.'])
      expect(update).toHaveBeenCalledWith('chat.updated', {
        chatUid: 'chat-uid-001',
        updates: {
          prompts: chat.prompts,
          updatedAt: chat.updatedAt,
        },
      })
      expect(result).toEqual(chat)
    })
  })

  describe('updateContextSettings', () => {
    it('updates context settings including auto scroll flag and sends IPC update', async () => {
      const chat = makeChat({
        contextSettings: {
          maxMessages: 20,
          timeWindowHours: null,
          autoScrollToBottomOnSend: false,
        },
      })
      vi.mocked(chatOps.updateChatContextSettings).mockResolvedValue(chat as any)

      const result = await caller.updateContextSettings({
        chatUid: 'chat-uid-001',
        contextSettings: {
          maxMessages: 20,
          timeWindowHours: null,
          autoScrollToBottomOnSend: false,
        },
      })

      expect(chatOps.updateChatContextSettings).toHaveBeenCalledWith('chat-uid-001', {
        maxMessages: 20,
        timeWindowHours: null,
        autoScrollToBottomOnSend: false,
      })
      expect(update).toHaveBeenCalledWith('chat.updated', {
        chatUid: 'chat-uid-001',
        updates: {
          contextSettings: chat.contextSettings,
          updatedAt: chat.updatedAt,
        },
      })
      expect(result).toEqual(chat)
    })
  })

  // ── updateWorkspace ──────────────────────────────────────────────────────

  describe('updateWorkspace', () => {
    it('更新工作区配置并发送 IPC 通知', async () => {
      const workspace = [{ type: 'directory' as const, value: '/home/user/project' }]
      const chat = makeChat({ workspace: workspace as any })
      vi.mocked(chatOps.updateChatWorkspace).mockResolvedValue(chat)

      await caller.updateWorkspace({ chatUid: 'chat-uid-001', workspace })

      expect(chatOps.updateChatWorkspace).toHaveBeenCalledWith('chat-uid-001', workspace)
      expect(update).toHaveBeenCalledWith('chat.updated', {
        chatUid: 'chat-uid-001',
        updates: {
          workspace: chat.workspace,
          updatedAt: chat.updatedAt,
        },
      })
    })

    it('清空工作区（null）', async () => {
      const chat = makeChat({ workspace: null })
      vi.mocked(chatOps.updateChatWorkspace).mockResolvedValue(chat)

      await caller.updateWorkspace({ chatUid: 'chat-uid-001', workspace: null })

      expect(chatOps.updateChatWorkspace).toHaveBeenCalledWith('chat-uid-001', null)
    })
  })

  // ── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('删除会话并发送 IPC 通知', async () => {
      vi.mocked(chatOps.deleteChat).mockResolvedValue()

      const result = await caller.delete({ chatUid: 'chat-uid-001' })

      expect(chatOps.deleteChat).toHaveBeenCalledWith('chat-uid-001')
      expect(update).toHaveBeenCalledWith('chat.deleted', { uid: 'chat-uid-001' })
      expect(result).toEqual({ success: true })
    })
  })
})
