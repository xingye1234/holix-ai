import type {
  AutocompleteEditorProps as AutocompletePluginProps,
  AutocompleteSuggestion,
  PopupPosition,
  TriggerChar,
  TriggerMatch,
} from './types'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_CRITICAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { filterSuggestions, formatInsertText } from './detect'
import { AutocompletePopup } from './Popup'

const TRIGGER_RE = /(^|\s)([@#/])(\S*)$/

function detectInline(textBeforeCursor: string): TriggerMatch | null {
  const m = TRIGGER_RE.exec(textBeforeCursor)
  if (!m)
    return null
  const [, prefix, trigger, query] = m
  return {
    trigger: trigger as TriggerChar,
    query,
    triggerOffset: m.index + prefix.length,
  }
}

function getCursorRect(): DOMRect | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0)
    return null
  const rect = sel.getRangeAt(0).getBoundingClientRect()
  // 零大小的 rect 说明 DOM 还没 paint，无效
  if (rect.width === 0 && rect.height === 0 && rect.x === 0 && rect.y === 0)
    return null
  return rect
}

function calcPosition(rect: DOMRect): PopupPosition {
  const POPUP_H = 300
  const pad = 8
  const above = rect.bottom + POPUP_H + pad > window.innerHeight
  return {
    x: Math.min(rect.left, window.innerWidth - 260),
    y: above ? rect.top - pad : rect.bottom + pad,
    above,
  }
}

export function AutocompletePlugin({ sources, onInsert }: AutocompletePluginProps) {
  const [editor] = useLexicalComposerContext()

  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<AutocompleteSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<PopupPosition>({ x: 0, y: 0, above: false })
  const [currentTitle, setCurrentTitle] = useState<string | undefined>()
  const [currentQuery, setCurrentQuery] = useState('')

  // 用 ref 缓存 sources，避免 sources 引用不稳定导致 useEffect 反复重注册 listener
  const sourcesRef = useRef(sources)
  useLayoutEffect(() => {
    sourcesRef.current = sources
  })

  const matchRef = useRef<TriggerMatch | null>(null)
  // 标记「当前是否应该显示弹窗」，用于在 rAF 中判断
  const shouldShowRef = useRef(false)

  const closePopup = useCallback(() => {
    shouldShowRef.current = false
    matchRef.current = null
    setIsOpen(false)
    setItems([])
    setActiveIndex(0)
  }, [])

  const confirmSelection = useCallback(
    (item: AutocompleteSuggestion) => {
      const match = matchRef.current
      if (!match)
        return

      const insertText = formatInsertText(match.trigger, item)

      editor.update(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection))
          return
        const anchorNode = selection.anchor.getNode()
        if (!$isTextNode(anchorNode))
          return
        const anchorOffset = selection.anchor.offset
        const deleteCount = anchorOffset - match.triggerOffset
        anchorNode.spliceText(match.triggerOffset, deleteCount, insertText, true)
      })

      onInsert?.(match.trigger, item)
      closePopup()
    },
    [editor, onInsert, closePopup],
  )

  // ─── 监听编辑器状态变化，检测触发 ─────────────────────────────────────────
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      // 在 read() 里收集纯逻辑数据（不操作 DOM，不调用 setState）
      let nextMatch: TriggerMatch | null = null
      let nextItems: AutocompleteSuggestion[] = []
      let nextTitle: string | undefined

      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection) || !selection.isCollapsed())
          return

        const anchorNode = selection.anchor.getNode()
        if (!$isTextNode(anchorNode))
          return

        const textBefore = anchorNode.getTextContent().slice(0, selection.anchor.offset)
        const match = detectInline(textBefore)
        if (!match)
          return

        const source = sourcesRef.current.find(s => s.trigger === match.trigger)
        if (!source)
          return

        const rawSuggestions
          = typeof source.suggestions === 'function'
            ? source.suggestions(match.query)
            : source.suggestions

        const filtered = filterSuggestions(rawSuggestions, match.query)
        if (filtered.length === 0)
          return

        nextMatch = match
        nextItems = filtered
        nextTitle = source.title
      })

      // read() 已结束，在此同步更新状态——
      // 此时 Lexical 内部状态已提交但 DOM 可能还未 paint，
      // popup 位置交给 useLayoutEffect + rAF 处理
      if (nextMatch && nextItems.length > 0) {
        matchRef.current = nextMatch
        shouldShowRef.current = true
        setItems(nextItems)
        setCurrentTitle(nextTitle)
        setCurrentQuery((nextMatch as TriggerMatch).query)
        setActiveIndex(0)
        setIsOpen(true)
      }
      else {
        closePopup()
      }
    })
  }, [editor, closePopup]) // sources 通过 sourcesRef 访问，不作为 dep

  // ─── DOM paint 后更新 popup 位置 ──────────────────────────────────────────
  // useLayoutEffect 在 DOM 更新后同步执行，rAF 确保 Lexical 已完成 DOM reconcile
  useLayoutEffect(() => {
    if (!isOpen)
      return

    const rafId = requestAnimationFrame(() => {
      if (!shouldShowRef.current)
        return
      const rect = getCursorRect()
      if (rect)
        setPosition(calcPosition(rect))
    })
    return () => cancelAnimationFrame(rafId)
  }, [isOpen, currentQuery])

  // ─── 弹窗打开时拦截键盘命令 ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen)
      return

    const removeUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (e: KeyboardEvent) => {
        e.preventDefault()
        setActiveIndex(i => (i - 1 + items.length) % items.length)
        return true
      },
      COMMAND_PRIORITY_CRITICAL,
    )
    const removeDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (e: KeyboardEvent) => {
        e.preventDefault()
        setActiveIndex(i => (i + 1) % items.length)
        return true
      },
      COMMAND_PRIORITY_CRITICAL,
    )
    const removeEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (e: KeyboardEvent) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey)
          return false
        e.preventDefault()
        const item = items[activeIndex]
        if (item)
          confirmSelection(item)
        return true
      },
      COMMAND_PRIORITY_CRITICAL,
    )
    const removeTab = editor.registerCommand(
      KEY_TAB_COMMAND,
      (e: KeyboardEvent) => {
        e.preventDefault()
        const item = items[activeIndex]
        if (item)
          confirmSelection(item)
        return true
      },
      COMMAND_PRIORITY_CRITICAL,
    )
    const removeEsc = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        closePopup()
        return true
      },
      COMMAND_PRIORITY_CRITICAL,
    )

    return () => {
      removeUp()
      removeDown()
      removeEnter()
      removeTab()
      removeEsc()
    }
  }, [isOpen, items, activeIndex, editor, confirmSelection, closePopup])

  if (!isOpen)
    return null

  return (
    <AutocompletePopup
      items={items}
      activeIndex={activeIndex}
      query={currentQuery}
      position={position}
      title={currentTitle}
      onSelect={confirmSelection}
      onActiveChange={setActiveIndex}
    />
  )
}
