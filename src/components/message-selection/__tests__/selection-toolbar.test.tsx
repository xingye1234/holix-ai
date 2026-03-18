/**
 * SelectionToolbar 组件测试
 *
 * 测试选择工具栏组件的功能
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useMessageSelection from '@/store/message-selection'
import { SelectionToolbar } from '../selection-toolbar'

// Mock logger to avoid electron-log initialization issues in test environment
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('selectionToolbar', () => {
  const mockOnDeleteSelected = vi.fn()
  const mockOnExportSelected = vi.fn()

  beforeEach(() => {
    // 重置 store
    useMessageSelection.getState().disableSelectionMode()
    vi.clearAllMocks()
  })

  describe('显示逻辑', () => {
    it('当没有选中消息时不应该显示', () => {
      const { container } = render(
        <SelectionToolbar
          onDeleteSelected={mockOnDeleteSelected}
          onExportSelected={mockOnExportSelected}
        />,
      )

      // 工具栏不应该在 DOM 中
      expect(container.firstChild).toBe(null)
    })

    it('当有选中消息时应该显示', () => {
      useMessageSelection.getState().enableSelectionMode()
      useMessageSelection.getState().selectMessage('msg1')
      useMessageSelection.getState().selectMessage('msg2')
      useMessageSelection.getState().selectMessage('msg3')

      render(
        <SelectionToolbar
          onDeleteSelected={mockOnDeleteSelected}
          onExportSelected={mockOnExportSelected}
        />,
      )

      // 应该显示工具栏
      expect(screen.getByText(/已选择/)).toBeInTheDocument()
      expect(screen.getByText(/3/)).toBeInTheDocument()
    })
  })

  describe('选中数量显示', () => {
    it('应该正确显示单个选中消息', () => {
      useMessageSelection.getState().enableSelectionMode()
      useMessageSelection.getState().selectMessage('msg1')

      render(
        <SelectionToolbar
          onDeleteSelected={mockOnDeleteSelected}
          onExportSelected={mockOnExportSelected}
        />,
      )

      expect(screen.getByText(/已选择/)).toBeInTheDocument()
      expect(screen.getByText(/1/)).toBeInTheDocument()
    })

    it('应该正确显示多个选中消息', () => {
      useMessageSelection.getState().enableSelectionMode()
      useMessageSelection.getState().selectAllMessages(['msg1', 'msg2', 'msg3', 'msg4', 'msg5'])

      render(
        <SelectionToolbar
          onDeleteSelected={mockOnDeleteSelected}
          onExportSelected={mockOnExportSelected}
        />,
      )

      expect(screen.getByText(/已选择/)).toBeInTheDocument()
      expect(screen.getByText(/5/)).toBeInTheDocument()
    })
  })

  describe('批量操作按钮', () => {
    beforeEach(() => {
      useMessageSelection.getState().enableSelectionMode()
      useMessageSelection.getState().selectAllMessages(['msg1', 'msg2'])
    })

    it('应该渲染所有操作按钮', () => {
      render(
        <SelectionToolbar
          onDeleteSelected={mockOnDeleteSelected}
          onExportSelected={mockOnExportSelected}
        />,
      )

      // 检查所有按钮是否存在
      expect(screen.getByRole('button', { name: /复制/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /导出/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /删除/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /取消/ })).toBeInTheDocument()
    })

    it('点击删除按钮应该调用 onDeleteSelected 并关闭选择模式', async () => {
      const user = userEvent.setup()

      render(
        <SelectionToolbar
          onDeleteSelected={mockOnDeleteSelected}
          onExportSelected={mockOnExportSelected}
        />,
      )

      const deleteButton = screen.getByRole('button', { name: /删除/ })
      await user.click(deleteButton)

      expect(mockOnDeleteSelected).toHaveBeenCalled()
      expect(useMessageSelection.getState().isSelectionMode).toBe(false)
    })

    it('点击取消按钮应该关闭选择模式', async () => {
      const user = userEvent.setup()

      render(
        <SelectionToolbar
          onDeleteSelected={mockOnDeleteSelected}
          onExportSelected={mockOnExportSelected}
        />,
      )

      const cancelButton = screen.getByRole('button', { name: /取消/ })
      await user.click(cancelButton)

      expect(useMessageSelection.getState().isSelectionMode).toBe(false)
    })
  })

  describe('边界情况', () => {
    it('当没有选中消息时所有按钮不应该显示', () => {
      useMessageSelection.getState().disableSelectionMode()

      const { container } = render(
        <SelectionToolbar
          onDeleteSelected={mockOnDeleteSelected}
          onExportSelected={mockOnExportSelected}
        />,
      )

      // 工具栏不应该渲染
      expect(container.firstChild).toBe(null)
    })

    it('应该正确处理空的消息 ID 集合', () => {
      useMessageSelection.getState().disableSelectionMode()

      const { container } = render(
        <SelectionToolbar
          onDeleteSelected={mockOnDeleteSelected}
          onExportSelected={mockOnExportSelected}
        />,
      )

      // 应该不显示工具栏
      expect(container.firstChild).toBe(null)
    })
  })

  describe('可访问性', () => {
    beforeEach(() => {
      useMessageSelection.getState().enableSelectionMode()
      useMessageSelection.getState().selectAllMessages(['msg1', 'msg2'])
    })

    it('所有按钮应该有正确的 role', () => {
      render(
        <SelectionToolbar
          onDeleteSelected={mockOnDeleteSelected}
          onExportSelected={mockOnExportSelected}
        />,
      )

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('按钮应该有适当的 label 或 text', () => {
      render(
        <SelectionToolbar
          onDeleteSelected={mockOnDeleteSelected}
          onExportSelected={mockOnExportSelected}
        />,
      )

      // 检查主要按钮都有可访问的文本
      expect(screen.getByRole('button', { name: /复制/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /导出/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /删除/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /取消/ })).toBeInTheDocument()
    })
  })
})
