import type { EditorState, EditorThemeClasses, LexicalEditor } from 'lexical'
import type { AutocompleteEditorProps } from './plugins/autocomplete'
import type { KeyboardPluginProps } from './plugins/KeyboardPlugin'

export interface EditorProps {
  /** 初始内容 */
  initialContent?: string

  rootClassName?: string
  wrapperClassName?: string

  /** 只读模式 */
  readOnly?: boolean

  onError: (error: Error, editor: LexicalEditor) => void

  namespace?: string

  theme?: EditorThemeClasses

  placeholder?: string

  ariaPlaceholder?: string

  value?: string

  onChange?: (
    editorState: EditorState,
    editor: LexicalEditor,
    tags: Set<string>,
  ) => void

  onTextChange?: (text: string, editor: LexicalEditor) => void

  textValue?: string

  /** 键盘事件回调 */
  keyboard?: KeyboardPluginProps

  /** 自动补全 / @ # / 触发提示 */
  autocomplete?: AutocompleteEditorProps
}

export interface EditorHandle {
  setText: (text: string, opts?: { focus?: boolean }) => void
  clear: (opts?: { focus?: boolean }) => void
  focus: () => void
  getText: () => string
}
