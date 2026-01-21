import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import { useEffect } from 'react'

/**
 * 受控文本值插件
 * 当 textValue 从外部改变时，同步更新编辑器内容
 */
export function ControlledTextPlugin({ textValue }: { textValue?: string }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (textValue === undefined)
      return

    // 获取当前编辑器的文本内容
    const currentText = editor.getEditorState().read(() => {
      return $getRoot().getTextContent()
    })

    // 只有当外部值与内部值不同时才更新
    if (currentText !== textValue) {
      editor.update(() => {
        const root = $getRoot()
        root.clear()

        if (textValue) {
          const paragraph = $createParagraphNode()
          const textNode = $createTextNode(textValue)
          paragraph.append(textNode)
          root.append(paragraph)
        }
      })
    }
  }, [editor, textValue])

  return null
}
