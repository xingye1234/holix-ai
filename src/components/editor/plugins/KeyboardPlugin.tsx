import type { LexicalCommand } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,

} from 'lexical'
import { useEffect } from 'react'

export interface KeyboardPluginProps {
  /** Enter 键按下 */
  onEnter?: (event: KeyboardEvent) => boolean | void
  /** Shift+Enter 键按下 */
  onShiftEnter?: (event: KeyboardEvent) => boolean | void
  /** Ctrl+Enter 或 Cmd+Enter 键按下 */
  onCtrlEnter?: (event: KeyboardEvent) => boolean | void
  /** Escape 键按下 */
  onEscape?: (event: KeyboardEvent) => boolean | void
  /** Ctrl+S 或 Cmd+S 保存 */
  onCtrlS?: (event: KeyboardEvent) => boolean | void
  /** 其他键盘事件 */
  onKeyDown?: (event: KeyboardEvent) => boolean | void
}

/**
 * 键盘事件插件
 * 监听编辑器中的键盘事件，支持各种快捷键
 */
export function KeyboardPlugin(props: KeyboardPluginProps) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    // 注册 Enter 键命令
    const removeEnterCommand = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        // Shift + Enter: 换行
        if (event.shiftKey) {
          if (props.onShiftEnter) {
            const result = props.onShiftEnter(event)
            return result ?? false
          }
          return false // 允许默认换行行为
        }

        // Ctrl/Cmd + Enter: 发送
        if (event.ctrlKey || event.metaKey) {
          if (props.onCtrlEnter) {
            event.preventDefault()
            const result = props.onCtrlEnter(event)
            return result ?? false
          }
          return false
        }

        // 单独的 Enter: 发送
        if (props.onEnter) {
          event.preventDefault()
          const result = props.onEnter(event)
          return result ?? false
        }

        return false
      },
      COMMAND_PRIORITY_HIGH,
    )

    // 注册 Escape 键命令
    const removeEscapeCommand = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (event: KeyboardEvent) => {
        if (props.onEscape) {
          const result = props.onEscape(event)
          return result ?? false
        }
        return false
      },
      COMMAND_PRIORITY_HIGH,
    )

    // 注册其他键盘事件
    const removeKeyDownListener = editor.registerRootListener(
      (
        rootElement: null | HTMLElement,
        prevRootElement: null | HTMLElement,
      ) => {
        if (prevRootElement !== null) {
          prevRootElement.removeEventListener('keydown', handleKeyDown)
        }
        if (rootElement !== null) {
          rootElement.addEventListener('keydown', handleKeyDown)
        }
      },
    )

    function handleKeyDown(event: KeyboardEvent) {
      // Ctrl+S 或 Cmd+S 保存
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        if (props.onCtrlS) {
          event.preventDefault()
          const result = props.onCtrlS(event)
          if (result ?? false) {
            return
          }
        }
      }

      if (props.onKeyDown) {
        props.onKeyDown(event)
      }
    }

    // 清理函数
    return () => {
      removeEnterCommand()
      removeEscapeCommand()
      removeKeyDownListener()
    }
  }, [editor, props])

  return null
}
