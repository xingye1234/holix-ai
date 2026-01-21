import type { EditorState } from 'lexical'
import type { EditorHandle } from '../props'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import { useImperativeHandle, useRef } from 'react'

export function EditorBridgePlugin({ apiRef }: { apiRef: React.MutableRefObject<EditorHandle | null> }) {
  const [editor] = useLexicalComposerContext()
  const lastTextRef = useRef('')

  useImperativeHandle(apiRef, () => ({
    setText(text, opts) {
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        const p = $createParagraphNode()
        p.append($createTextNode(text ?? ''))
        root.append(p)
      })

      if (opts?.focus)
        editor.focus()
    },
    clear(opts) {
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        root.append($createParagraphNode())
      })
      if (opts?.focus)
        editor.focus()
    },
    focus() {
      editor.focus()
    },
    getText() {
      return lastTextRef.current
    },
  }), [editor, apiRef])

  // 维护一个最新文本快照，给 getText 用（避免同步 read 的时序坑）
  return (
    <OnChangePlugin
      onChange={(editorState: EditorState) => {
        lastTextRef.current = editorState.read(() => $getRoot().getTextContent())
      }}
    />
  )
}
