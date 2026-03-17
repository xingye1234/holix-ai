/**
 * useMessageJump Hook 测试
 *
 * 测试消息跳转功能的各个方面：
 * - 按 messageId 跳转
 * - 按 index 跳转
 * - 按 seq 跳转
 * - 自动补全缺失消息
 * - 距离策略选择
 */

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMessageStore } from '@/store/message'
import { useMessageJump } from '../use-message-jump'

// Mock logger to avoid electron-log initialization issues
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock window.api
const mockGetByChatUid = vi.fn()

declare global {
  interface Window {
    api: {
      message: {
        getByChatUid: (params: any) => Promise<any[]>
      }
    }
  }
}

Object.defineProperty(window, 'api', {
  value: {
    message: {
      getByChatUid: mockGetByChatUid,
    },
  },
  writable: true,
  configurable: true,
})

/**
 * Helper function to completely clean messages for a chat
 * This removes both the chatMessages entry and the individual message objects
 */
// @ts-expect-error - Test helper function that needs to mutate immer state directly
function cleanChatMessages(chatUid: string) {
  const store = useMessageStore.getState()
  const messageIds = store.chatMessages[chatUid] || []

  // Use zustand's setState to properly mutate the immer state
  useMessageStore.setState((state) => {
    // Remove individual message objects
    for (const messageId of messageIds) {
      // @ts-expect-error - Deleting from readonly state for test cleanup
      delete state.messages[messageId]
    }
    // Remove the chat's message list
    // @ts-expect-error - Deleting from readonly state for test cleanup
    delete state.chatMessages[chatUid]
  })
}

describe('useMessageJump', () => {
  const mockChatUid = 'test-chat-uid'
  const mockListRef = { current: null } as any
  const mockMessageIds = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5']

  beforeEach(() => {
    vi.clearAllMocks()
    // 重置 store
    cleanChatMessages(mockChatUid)

    // Mock listRef
    mockListRef.current = {
      scrollToIndex: vi.fn(),
      scrollToBottom: vi.fn(),
      scrollToTop: vi.fn(),
    }

    // Mock 返回数据
    mockGetByChatUid.mockResolvedValue([])
  })

  describe('基本功能', () => {
    it('应该能够渲染 hook 而不崩溃', () => {
      expect(() => {
        renderHook(() =>
          useMessageJump({
            chatUid: mockChatUid,
            listRef: mockListRef,
            messageIds: mockMessageIds,
          }),
        )
      }).not.toThrow()
    })

    it('应该返回 jumpToMessage 和 clearHighlight 方法', () => {
      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: mockMessageIds,
        }),
      )

      expect(typeof result.current.jumpToMessage).toBe('function')
      expect(typeof result.current.clearHighlight).toBe('function')
    })
  })

  describe('按 messageId 跳转', () => {
    const testMessageIds = ['msg1', 'msg2', 'msg3']

    beforeEach(() => {
      // 清理之前的消息
      cleanChatMessages(mockChatUid)

      // 添加测试消息到 store
      const messages = [
        { uid: 'msg1', seq: 1, role: 'user', content: 'Message 1', createdAt: Date.now(), chatUid: mockChatUid, status: 'success' },
        { uid: 'msg2', seq: 2, role: 'assistant', content: 'Message 2', createdAt: Date.now(), chatUid: mockChatUid, status: 'success' },
        { uid: 'msg3', seq: 3, role: 'user', content: 'Message 3', createdAt: Date.now(), chatUid: mockChatUid, status: 'success' },
      ]

      const prependMessages = useMessageStore.getState().prependMessages
      messages.forEach(msg => prependMessages(mockChatUid, [msg]))
    })

    it('应该能够跳转到存在的消息', async () => {
      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: testMessageIds,
        }),
      )

      // 跳转到 msg2（索引 1）
      await result.current.jumpToMessage({ messageId: 'msg2' })

      // 'smart' 策略会根据距离选择，近距离使用 'smooth'
      expect(mockListRef.current.scrollToIndex).toHaveBeenCalledWith({
        index: 1,
        align: 'center',
        behavior: 'smooth',
      })
    })

    it('对于不存在的消息 ID 应该不执行跳转', async () => {
      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: testMessageIds,
        }),
      )

      // 尝试跳转到不存在的消息
      await result.current.jumpToMessage({ messageId: 'nonexistent' })

      expect(mockListRef.current.scrollToIndex).not.toHaveBeenCalled()
    })
  })

  describe('按 index 跳转', () => {
    const testMessageIds = ['msg1', 'msg2']

    beforeEach(() => {
      // 清理之前的消息
      cleanChatMessages(mockChatUid)

      // 添加测试消息
      const messages = [
        { uid: 'msg1', seq: 1, role: 'user', content: 'Message 1', createdAt: Date.now(), chatUid: mockChatUid, status: 'success' },
        { uid: 'msg2', seq: 2, role: 'assistant', content: 'Message 2', createdAt: Date.now(), chatUid: mockChatUid, status: 'success' },
      ]

      const prependMessages = useMessageStore.getState().prependMessages
      messages.forEach(msg => prependMessages(mockChatUid, [msg]))
    })

    it('应该能够跳转到指定索引', async () => {
      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: testMessageIds,
        }),
      )

      // 跳转到索引 1
      await result.current.jumpToMessage({ index: 1 })

      expect(mockListRef.current.scrollToIndex).toHaveBeenCalledWith({
        index: 1,
        align: 'center',
        behavior: 'smooth',
      })
    })

    it('对于超出范围的索引应该不执行跳转', async () => {
      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: testMessageIds,
        }),
      )

      // 尝试跳转到不存在的索引
      await result.current.jumpToMessage({ index: 999 })

      expect(mockListRef.current.scrollToIndex).not.toHaveBeenCalled()
    })
  })

  describe('按 seq 跳转', () => {
    const testMessageIds = ['msg1', 'msg2', 'msg3']

    beforeEach(() => {
      // 清理之前的消息
      cleanChatMessages(mockChatUid)

      const messages = [
        { uid: 'msg1', seq: 10, role: 'user', content: 'Message 1', createdAt: Date.now(), chatUid: mockChatUid, status: 'success' },
        { uid: 'msg2', seq: 20, role: 'assistant', content: 'Message 2', createdAt: Date.now(), chatUid: mockChatUid, status: 'success' },
        { uid: 'msg3', seq: 30, role: 'user', content: 'Message 3', createdAt: Date.now(), chatUid: mockChatUid, status: 'success' },
      ]

      const prependMessages = useMessageStore.getState().prependMessages
      messages.forEach(msg => prependMessages(mockChatUid, [msg]))
    })

    it('应该能够按 seq 跳转到消息', async () => {
      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: testMessageIds,
        }),
      )

      // 按 seq 跳转
      await result.current.jumpToMessage({ seq: 20 })

      expect(mockListRef.current.scrollToIndex).toHaveBeenCalledWith({
        index: 1, // msg2 的索引
        align: 'center',
        behavior: 'smooth',
      })
    })

    it('对于不存在的 seq 应该不执行跳转', async () => {
      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: testMessageIds,
        }),
      )

      await result.current.jumpToMessage({ seq: 999 })

      expect(mockListRef.current.scrollToIndex).not.toHaveBeenCalled()
    })
  })

  describe('距离策略', () => {
    beforeEach(() => {
      // 清理之前的消息
      cleanChatMessages(mockChatUid)

      const messages = [
        { uid: 'msg1', seq: 1, role: 'user', content: 'Message 1', createdAt: Date.now(), chatUid: mockChatUid, status: 'success' },
        { uid: 'msg50', seq: 50, role: 'assistant', content: 'Message 50', createdAt: Date.now(), chatUid: mockChatUid, status: 'success' },
      ]

      const prependMessages = useMessageStore.getState().prependMessages
      messages.forEach(msg => prependMessages(mockChatUid, [msg]))
    })

    it('近距离跳转（< 20）应该使用 smooth 滚动', async () => {
      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: ['msg1', 'msg50'],
        }),
      )

      // 从索引 0 跳到索引 1（距离为 1，应该 smooth）
      await result.current.jumpToMessage({ index: 1 })

      expect(mockListRef.current.scrollToIndex).toHaveBeenCalledWith({
        index: 1,
        align: 'center',
        behavior: 'smooth',
      })
    })

    it('远距离跳转（>= 20）应该使用 instant 跳转', async () => {
      // 清理并添加50条消息
      cleanChatMessages(mockChatUid)

      const messages = Array.from({ length: 50 }, (_, i) => ({
        uid: `msg${i + 1}`,
        seq: i + 1,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        createdAt: Date.now() + i,
        chatUid: mockChatUid,
        status: 'success' as const,
      }))

      const prependMessages = useMessageStore.getState().prependMessages
      messages.forEach(msg => prependMessages(mockChatUid, [msg]))

      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: Array.from({ length: 50 }, (_, i) => `msg${i + 1}`),
        }),
      )

      // 从索引 0 跳到索引 45（距离为 45，应该 instant）
      await result.current.jumpToMessage({ index: 45 })

      expect(mockListRef.current.scrollToIndex).toHaveBeenCalledWith({
        index: 45,
        align: 'center',
        behavior: 'auto', // instant 映射为 auto
      })
    })
  })

  describe('选项配置', () => {
    const testMessageIds = ['msg1']

    beforeEach(() => {
      // 清理之前的消息
      cleanChatMessages(mockChatUid)

      const messages = [
        { uid: 'msg1', seq: 1, role: 'user', content: 'Message 1', createdAt: Date.now(), chatUid: mockChatUid, status: 'success' },
      ]

      const prependMessages = useMessageStore.getState().prependMessages
      messages.forEach(msg => prependMessages(mockChatUid, [msg]))
    })

    it('应该支持自定义对齐方式', async () => {
      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: testMessageIds,
        }),
      )

      await result.current.jumpToMessage(
        { messageId: 'msg1' },
        { align: 'start' },
      )

      expect(mockListRef.current.scrollToIndex).toHaveBeenCalledWith({
        index: 0,
        align: 'start',
        behavior: 'smooth',
      })
    })

    it('应该支持自定义滚动行为', async () => {
      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: testMessageIds,
        }),
      )

      await result.current.jumpToMessage(
        { messageId: 'msg1' },
        { behavior: 'instant' },
      )

      expect(mockListRef.current.scrollToIndex).toHaveBeenCalledWith({
        index: 0,
        align: 'center',
        behavior: 'auto',
      })
    })
  })

  describe('清理', () => {
    it('卸载时应该提供清理高亮的方法', () => {
      const { result } = renderHook(() =>
        useMessageJump({
          chatUid: mockChatUid,
          listRef: mockListRef,
          messageIds: mockMessageIds,
        }),
      )

      // 验证 clearHighlight 方法存在
      expect(typeof result.current.clearHighlight).toBe('function')
    })
  })
})
