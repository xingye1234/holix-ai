/**
 * message-selection store 测试
 *
 * 测试消息选择状态管理的所有功能
 */

import { beforeEach, describe, expect, it } from 'vitest'
import useMessageSelection from '@/store/message-selection'

describe('message-selection store', () => {
  beforeEach(() => {
    // 重置为初始状态
    useMessageSelection.getState().disableSelectionMode()
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const state = useMessageSelection.getState()

      expect(state.selectedMessageIds).toEqual(new Set())
      expect(state.isSelectionMode).toBe(false)
    })

    it('getSelectedCount 应该返回 0', () => {
      expect(useMessageSelection.getState().getSelectedCount()).toBe(0)
    })
  })

  describe('选择模式切换', () => {
    it('toggleSelectionMode 应该开启选择模式', () => {
      const { toggleSelectionMode } = useMessageSelection.getState()

      toggleSelectionMode()

      expect(useMessageSelection.getState().isSelectionMode).toBe(true)
    })

    it('toggleSelectionMode 应该关闭选择模式并清空选择', () => {
      const { toggleSelectionMode, selectMessage } = useMessageSelection.getState()

      // 开启选择模式并选择一条消息
      toggleSelectionMode()
      selectMessage('msg1')

      expect(useMessageSelection.getState().isSelectionMode).toBe(true)
      expect(useMessageSelection.getState().getSelectedCount()).toBe(1)

      // 再次切换
      toggleSelectionMode()

      expect(useMessageSelection.getState().isSelectionMode).toBe(false)
      expect(useMessageSelection.getState().getSelectedCount()).toBe(0)
    })

    it('enableSelectionMode 应该开启选择模式', () => {
      const { enableSelectionMode } = useMessageSelection.getState()

      enableSelectionMode()

      expect(useMessageSelection.getState().isSelectionMode).toBe(true)
    })

    it('disableSelectionMode 应该关闭选择模式并清空选择', () => {
      const { enableSelectionMode, selectMessage, disableSelectionMode } = useMessageSelection.getState()

      enableSelectionMode()
      selectMessage('msg1')

      disableSelectionMode()

      expect(useMessageSelection.getState().isSelectionMode).toBe(false)
      expect(useMessageSelection.getState().getSelectedCount()).toBe(0)
    })
  })

  describe('单个消息选择', () => {
    beforeEach(() => {
      useMessageSelection.getState().enableSelectionMode()
    })

    it('selectMessage 应该添加消息到选择集合', () => {
      const { selectMessage, isMessageSelected } = useMessageSelection.getState()

      selectMessage('msg1')

      expect(isMessageSelected('msg1')).toBe(true)
      expect(useMessageSelection.getState().getSelectedCount()).toBe(1)
    })

    it('deselectMessage 应该从选择集合中移除消息', () => {
      const { selectMessage, deselectMessage, isMessageSelected } = useMessageSelection.getState()

      selectMessage('msg1')
      expect(isMessageSelected('msg1')).toBe(true)

      deselectMessage('msg1')
      expect(isMessageSelected('msg1')).toBe(false)
      expect(useMessageSelection.getState().getSelectedCount()).toBe(0)
    })

    it('deselectMessage 最后一条消息时应该自动关闭选择模式', () => {
      const { selectMessage, deselectMessage } = useMessageSelection.getState()

      selectMessage('msg1')
      deselectMessage('msg1')

      expect(useMessageSelection.getState().isSelectionMode).toBe(false)
    })

    it('toggleMessageSelection 应该切换消息选择状态', () => {
      const { toggleMessageSelection, isMessageSelected } = useMessageSelection.getState()

      // 未选择 -> 已选择
      toggleMessageSelection('msg1')
      expect(isMessageSelected('msg1')).toBe(true)

      // 已选择 -> 未选择
      toggleMessageSelection('msg1')
      expect(isMessageSelected('msg1')).toBe(false)
    })

    it('toggleMessageSelection 移除最后一条消息时应该自动关闭选择模式', () => {
      const { toggleMessageSelection } = useMessageSelection.getState()

      toggleMessageSelection('msg1')
      expect(useMessageSelection.getState().isSelectionMode).toBe(true)

      toggleMessageSelection('msg1')
      expect(useMessageSelection.getState().isSelectionMode).toBe(false)
    })

    it('isMessageSelected 应该正确返回选择状态', () => {
      const { selectMessage, isMessageSelected } = useMessageSelection.getState()

      expect(isMessageSelected('msg1')).toBe(false)

      selectMessage('msg1')
      expect(isMessageSelected('msg1')).toBe(true)
    })
  })

  describe('批量选择操作', () => {
    beforeEach(() => {
      useMessageSelection.getState().enableSelectionMode()
    })

    it('selectAllMessages 应该选择所有指定的消息', () => {
      const { selectAllMessages, getSelectedCount, isMessageSelected } = useMessageSelection.getState()
      const messageIds = ['msg1', 'msg2', 'msg3']

      selectAllMessages(messageIds)

      expect(getSelectedCount()).toBe(3)
      expect(isMessageSelected('msg1')).toBe(true)
      expect(isMessageSelected('msg2')).toBe(true)
      expect(isMessageSelected('msg3')).toBe(true)
    })

    it('clearSelection 应该清空所有选择但保持选择模式', () => {
      const { selectMessage, clearSelection, getSelectedCount, isSelectionMode } = useMessageSelection.getState()

      selectMessage('msg1')
      selectMessage('msg2')

      expect(getSelectedCount()).toBe(2)

      clearSelection()

      expect(getSelectedCount()).toBe(0)
      expect(isSelectionMode).toBe(true) // 选择模式应该保持
    })

    it('removeSelectedMessages 应该移除指定的消息', () => {
      const { selectMessage, removeSelectedMessages, getSelectedCount, isMessageSelected } = useMessageSelection.getState()

      selectMessage('msg1')
      selectMessage('msg2')
      selectMessage('msg3')

      expect(getSelectedCount()).toBe(3)

      removeSelectedMessages(['msg1', 'msg3'])

      expect(getSelectedCount()).toBe(1)
      expect(isMessageSelected('msg1')).toBe(false)
      expect(isMessageSelected('msg2')).toBe(true)
      expect(isMessageSelected('msg3')).toBe(false)
    })

    it('removeSelectedMessages 移除所有消息时应该自动关闭选择模式', () => {
      const { selectMessage, removeSelectedMessages } = useMessageSelection.getState()

      selectMessage('msg1')
      selectMessage('msg2')

      removeSelectedMessages(['msg1', 'msg2'])

      expect(useMessageSelection.getState().isSelectionMode).toBe(false)
    })
  })

  describe('边界情况', () => {
    beforeEach(() => {
      useMessageSelection.getState().enableSelectionMode()
    })

    it('重复选择同一条消息不应该增加计数', () => {
      const { selectMessage, getSelectedCount } = useMessageSelection.getState()

      selectMessage('msg1')
      selectMessage('msg1')
      selectMessage('msg1')

      expect(getSelectedCount()).toBe(1)
    })

    it('取消选择不存在的消息不应该报错', () => {
      const { deselectMessage, getSelectedCount } = useMessageSelection.getState()

      expect(() => deselectMessage('nonexistent')).not.toThrow()
      expect(getSelectedCount()).toBe(0)
    })

    it('空数组调用 selectAllMessages 应该正常工作', () => {
      const { selectAllMessages, getSelectedCount } = useMessageSelection.getState()

      selectAllMessages([])

      expect(getSelectedCount()).toBe(0)
    })

    it('空数组调用 removeSelectedMessages 应该正常工作', () => {
      const { selectMessage, removeSelectedMessages, getSelectedCount } = useMessageSelection.getState()

      selectMessage('msg1')

      removeSelectedMessages([])

      expect(getSelectedCount()).toBe(1)
    })

    it('getSelectedCount 应该正确返回选择数量', () => {
      const { selectMessage, getSelectedCount } = useMessageSelection.getState()

      expect(getSelectedCount()).toBe(0)

      selectMessage('msg1')
      expect(getSelectedCount()).toBe(1)

      selectMessage('msg2')
      expect(getSelectedCount()).toBe(2)

      selectMessage('msg3')
      expect(getSelectedCount()).toBe(3)
    })
  })
})
