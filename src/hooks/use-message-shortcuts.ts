import { useEffect } from 'react'
import useMessageSelection from '@/store/message-selection'

interface UseMessageShortcutsProps {
  /** 所有消息ID列表，用于全选 */
  messageIds: string[]
  /** 禁用快捷键 */
  disabled?: boolean
}

/**
 * 消息选择键盘快捷键 Hook
 * - Ctrl/Cmd + A: 全选消息
 * - Escape: 取消选择模式
 */
export function useMessageShortcuts({
  messageIds,
  disabled = false,
}: UseMessageShortcutsProps) {
  const isSelectionMode = useMessageSelection(state => state.isSelectionMode)
  const selectAllMessages = useMessageSelection(state => state.selectAllMessages)
  const disableSelectionMode = useMessageSelection(state => state.disableSelectionMode)

  useEffect(() => {
    if (disabled || !isSelectionMode)
      return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A: 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        selectAllMessages(messageIds)
        return
      }

      // Escape: 取消选择模式
      if (e.key === 'Escape') {
        e.preventDefault()
        disableSelectionMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [disabled, isSelectionMode, messageIds, selectAllMessages, disableSelectionMode])
}
