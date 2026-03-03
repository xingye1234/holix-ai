import type { EditorState } from 'lexical'
import type { EditorHandle } from '../props'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isRangeSelection } from 'lexical'
import { useEffect, useImperativeHandle, useRef } from 'react'

export function EditorBridgePlugin({ apiRef }: { apiRef: React.MutableRefObject<EditorHandle | null> }) {
  const [editor] = useLexicalComposerContext()
  const lastTextRef = useRef('')

  // 监听用户手动删空内容的情况：当编辑器内容变为空时，重置选区 format 位域，
  // 防止粘贴过加粗文字后再手动删除、下次输入仍然是加粗状态。
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // 仅在有实际变化时检查，避免每次渲染都触发多余的 update
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0)
        return

      const isEmpty = editorState.read(() => {
        const root = $getRoot()
        return root.getTextContent() === ''
      })

      if (!isEmpty)
        return

      // 内容已被清空：在下一个微任务里重置选区格式，避免在同一帧嵌套 update
      editor.update(() => {
        const sel = $getSelection()
        if ($isRangeSelection(sel) && sel.format !== 0) {
          sel.format = 0
        }
      })
    })
  }, [editor])

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
        const paragraph = $createParagraphNode()
        root.append(paragraph)
        // 选中新段落起点，并将选区 format 位域清零，
        // 防止上次输入的粗体 / 斜体等格式被继承到下次输入。
        paragraph.selectStart()
        const sel = $getSelection()
        if ($isRangeSelection(sel)) {
          sel.format = 0
        }
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
