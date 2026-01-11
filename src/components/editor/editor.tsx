import type { EditorState, LexicalEditor } from 'lexical'
import type { EditorProps } from './props'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { $getRoot } from 'lexical'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ControlledTextPlugin } from './plugins/ControlledTextPlugin'
import { KeyboardPlugin } from './plugins/KeyboardPlugin'

export function Editor(props: EditorProps) {
  const initialConfig = useMemo(
    () => ({
      namespace: props.namespace || 'holix-editor',
      theme: Object.assign(
        {
          root: cn(
            'editor-root w-full border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            props.rootClassName,
          ),
        },
        props.theme || {},
      ),
      onError: props.onError,
    }),
    [props.namespace, props.theme, props.onError, props.rootClassName],
  )

  // TODO 处理组合输入事件 （中文输入法）
  const onChange = useMemo(() => {
    if (!props.onChange && !props.onTextChange) {
      return null
    }
    return (
      editorState: EditorState,
      editor: LexicalEditor,
      tags: Set<string>,
    ) => {
      if (props.onChange) {
        props.onChange(editorState, editor, tags)
      }

      if (props.onTextChange) {
        const text = editorState.read(() => {
          return $getRoot().getTextContent()
        })
        props.onTextChange(text?.trim(), editor)
      }
    }
  }, [props.onChange, props.onTextChange])

  return (
    <div className={cn(props.wrapperClassName, 'relative w-full')}>
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={(
            <ContentEditable
              aria-placeholder={props.ariaPlaceholder || ''}
              placeholder={(
                <div className="editor-placeholder px-3 py-2 text-base md:text-sm text-muted-foreground select-none absolute top-0 left-0 pointer-events-none">
                  {props.placeholder || ''}
                </div>
              )}
            />
          )}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin delay={300} />
        <AutoFocusPlugin />
        {onChange && <OnChangePlugin onChange={onChange} />}
        {props.textValue !== undefined && (
          <ControlledTextPlugin textValue={props.textValue} />
        )}
        {props.keyboard && <KeyboardPlugin {...props.keyboard} />}
      </LexicalComposer>
    </div>
  )
}
