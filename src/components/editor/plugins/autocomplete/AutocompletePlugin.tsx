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
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical'
import { useCallback, useEffect, useRef, useState } from 'react'
import { filterSuggestions, formatInsertText } from './detect'
import { AutocompletePopup } from './Popup'

const TRIGGER_RE = /(^|\s)([@#/])(\S*)$/

/** 从光标前文本中检测触发状态（专为 Lexical 消费，inline 避免 import cycle） */
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

/** 获取光标矩形（相对于视口），用于定位弹窗 */
function getCursorRect(): DOMRect | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0)
    return null
  return sel.getRangeAt(0).getBoundingClientRect()
}

/** 根据光标位置计算弹窗的固定坐标 */
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

  // 使用 ref 缓存当前匹配，供命令回调（闭包）直接读取
  const matchRef = useRef<TriggerMatch | null>(null)

  const closePopup = useCallback(() => {
    setIsOpen(false)
    setItems([])
    setActiveIndex(0)
    matchRef.current = null
  }, [])

  /** 将选中的候选项插入到编辑器 */
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
        // 从 triggerOffset 到光标处全部替换
        const deleteCount = anchorOffset - match.triggerOffset
        anchorNode.spliceText(match.triggerOffset, deleteCount, insertText, true)
      })

      onInsert?.(match.trigger, item)
      closePopup()
    },
    [editor, onInsert, closePopup],
  )

  // ─── 监听编辑器状态变化 ─────────────────────────────────────────────────────
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          closePopup()
          return
        }

        const anchorNode = selection.anchor.getNode()
        if (!$isTextNode(anchorNode)) {
          closePopup()
          return
        }

        const anchorOffset = selection.anchor.offset
        const text = anchorNode.getTextContent()
        const textBefore = text.slice(0, anchorOffset)

        const match = detectInline(textBefore)
        if (!match) {
          closePopup()
          return
        }

        // 找对应 source
        const source = sources.find(s => s.trigger === match.trigger)
        if (!source) {
          closePopup()
          return
        }

        const rawSuggestions
          = typeof source.suggestions === 'function'
            ? source.suggestions(match.query)
            : source.suggestions

        const filtered = filterSuggestions(rawSuggestions, match.query)
        if (filtered.length === 0) {
          closePopup()
          return
        }

        // 更新弹窗状态（在 read 回调外部更新 React state）
        const rect = getCursorRect()
        matchRef.current = match

        // 由于在 editorState.read 内，不能直接 setState；改用微任务
        Promise.resolve().then(() => {
          setItems(filtered)
          setActiveIndex(0)
          setCurrentTitle(source.title)
          setCurrentQuery(match.query)
          if (rect)
            setPosition(calcPosition(rect))
          setIsOpen(true)
        })
      })
    })
  }, [editor, sources, closePopup])

  // ─── 弹窗打开时拦截键盘命令 ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen)
      return

    const removeUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (e: KeyboardEvent) => {
        e.preventDefault()
        setActiveIndex(i => (i - 1 + items.length) % items.length)
        return true // 阻止光标移动
      },
      COMMAND_PRIORITY_HIGH,
    )

    const removeDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (e: KeyboardEvent) => {
        e.preventDefault()
        setActiveIndex(i => (i + 1) % items.length)
        return true
      },
      COMMAND_PRIORITY_HIGH,
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
      COMMAND_PRIORITY_HIGH,
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
      COMMAND_PRIORITY_HIGH,
    )

    const removeEsc = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (_e: KeyboardEvent) => {
        closePopup()
        return true
      },
      COMMAND_PRIORITY_HIGH,
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
