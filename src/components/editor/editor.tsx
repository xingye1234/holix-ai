import type { EditorState, LexicalEditor } from 'lexical'
import type { EditorHandle, EditorProps } from './props'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { $getRoot } from 'lexical'
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import { AutocompletePlugin } from './plugins/autocomplete'
import { EditorBridgePlugin } from './plugins/BridgePlugin'
import { KeyboardPlugin } from './plugins/KeyboardPlugin'

export const Editor = forwardRef<EditorHandle, EditorProps>((props: EditorProps, ref) => {
  const apiRef = useRef<EditorHandle | null>(null)
  useImperativeHandle(ref, () => apiRef.current!, [])

  const initialConfig = useMemo(
    () => ({
      namespace: props.namespace || 'holix-editor',
      theme: Object.assign(
        {
          root: cn(
            'editor-root caret-black dark:caret-white overflow-y-auto w-full h-full border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 field-sizing-content w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm leading-4',
            props.rootClassName,
          ),
        },
        props.theme || {},
      ),
      onError: props.onError,
    }),
    [props.namespace, props.theme, props.onError, props.rootClassName],
  )

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
        props.onTextChange(text, editor)
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
        <EditorBridgePlugin apiRef={apiRef} />
        {onChange && <OnChangePlugin onChange={onChange} />}
        {props.keyboard && <KeyboardPlugin {...props.keyboard} />}
        {props.autocomplete && <AutocompletePlugin {...props.autocomplete} />}
      </LexicalComposer>
    </div>
  )
})
