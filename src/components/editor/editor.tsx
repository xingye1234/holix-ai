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
import { MentionNode } from './nodes/MentionNode'
import { AutocompletePlugin } from './plugins/autocomplete'
import { EditorBridgePlugin } from './plugins/BridgePlugin'
import { KeyboardPlugin } from './plugins/KeyboardPlugin'

export const Editor = forwardRef<EditorHandle, EditorProps>((props: EditorProps, ref) => {
  const apiRef = useRef<EditorHandle | null>(null)
  useImperativeHandle(ref, () => apiRef.current!, [])

  const initialConfig = useMemo(
    () => ({
      namespace: props.namespace || 'holix-editor',
      nodes: [MentionNode],
      theme: Object.assign(
        {
          root: cn(
            'editor-root caret-black dark:caret-white overflow-y-auto h-full w-full field-sizing-content rounded-xl border border-border/60 bg-card/75 px-4 py-3 text-base leading-6 shadow-[0_10px_24px_-22px_rgba(0,0,0,0.2)] transition-[color,box-shadow,border-color,background-color] outline-none dark:bg-card/60 md:text-sm',
            'focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/15 focus-visible:shadow-[0_14px_28px_-22px_rgba(0,0,0,0.22)]',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
            'disabled:cursor-not-allowed disabled:opacity-50',
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
                <div className="editor-placeholder pointer-events-none absolute top-0 left-0 select-none px-4 py-3 text-base text-muted-foreground/80 md:text-sm">
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
