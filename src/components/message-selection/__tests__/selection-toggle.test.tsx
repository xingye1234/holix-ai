/**
 * SelectionToggle 组件测试
 *
 * 测试选择模式切换按钮的功能
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useMessageSelection from '@/store/message-selection'
import { SelectionToggle } from '../selection-toggle'

describe('selectionToggle', () => {
  beforeEach(() => {
    // 重置 store
    useMessageSelection.getState().disableSelectionMode()
    vi.clearAllMocks()
  })

  describe('渲染', () => {
    it('应该渲染按钮', () => {
      render(<SelectionToggle />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('应该显示图标', () => {
      render(<SelectionToggle />)

      // 检查图标是否存在（通过 SVG 元素）
      const icon = document.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('按钮文本', () => {
    it('不在选择模式时应该显示"选择消息"', () => {
      useMessageSelection.getState().disableSelectionMode()

      render(<SelectionToggle />)

      expect(screen.getByText('选择消息')).toBeInTheDocument()
    })

    it('在选择模式时应该显示"取消选择"', () => {
      useMessageSelection.getState().enableSelectionMode()

      render(<SelectionToggle />)

      expect(screen.getByText('取消选择')).toBeInTheDocument()
    })
  })

  describe('点击处理', () => {
    it('点击应该切换选择模式', async () => {
      const user = userEvent.setup()

      render(<SelectionToggle />)

      const button = screen.getByRole('button')

      // 初始状态：不在选择模式
      expect(useMessageSelection.getState().isSelectionMode).toBe(false)

      // 点击进入选择模式
      await user.click(button)
      expect(useMessageSelection.getState().isSelectionMode).toBe(true)

      // 再次点击退出选择模式
      await user.click(button)
      expect(useMessageSelection.getState().isSelectionMode).toBe(false)
    })
  })

  describe('可访问性', () => {
    it('按钮应该有正确的 role', () => {
      render(<SelectionToggle />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('按钮应该有 gap 类来分隔图标和文本', () => {
      render(<SelectionToggle />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('gap-2')
    })
  })
})
