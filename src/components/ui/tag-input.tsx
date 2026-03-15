/**
 * TagInput — 标签输入组件
 *
 * 用途：输入并管理多个字符串值（如模型名称列表）
 * 功能：
 *   - 已有标签以 Badge 形式展示，可逐个删除
 *   - 键入内容实时过滤智能候选列表
 *   - 支持键盘操作：Enter/Tab 确认，Backspace 删除最后一个，↑↓ 选候选项，Esc 关闭
 *   - 候选项分"精确匹配前"和"模糊匹配"两段排序
 */

import { X } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { ALL_MODELS } from '@/lib/model-presets'

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface TagInputProps {
  value: string[]
  onChange: (values: string[]) => void
  /** 候选词列表，默认使用内置 ALL_MODELS */
  suggestions?: string[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TagInput({
  value,
  onChange,
  suggestions = ALL_MODELS,
  placeholder = '输入模型名称，按 Enter 添加…',
  className,
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState('')
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)

  // ─── 候选项过滤 & 排序 ──────────────────────────────────────────────────────

  const filteredSuggestions = React.useMemo(() => {
    const q = inputValue.trim().toLowerCase()
    if (!q)
      return []

    const available = suggestions.filter(s => !value.includes(s))
    const starts: string[] = []
    const contains: string[] = []

    for (const s of available) {
      const sl = s.toLowerCase()
      if (sl.startsWith(q))
        starts.push(s)
      else if (sl.includes(q))
        contains.push(s)
    }

    // 也允许完全自定义（不在候选表中的任意值）
    return [...starts, ...contains].slice(0, 10)
  }, [inputValue, suggestions, value])

  const isOpen = showSuggestions && filteredSuggestions.length > 0

  // ─── 添加标签 ───────────────────────────────────────────────────────────────

  const addTag = React.useCallback((tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || value.includes(trimmed))
      return
    onChange([...value, trimmed])
    setInputValue('')
    setShowSuggestions(false)
    setActiveIndex(-1)
    inputRef.current?.focus()
  }, [value, onChange])

  // ─── 删除标签 ───────────────────────────────────────────────────────────────

  const removeTag = React.useCallback((tag: string) => {
    onChange(value.filter(v => v !== tag))
    inputRef.current?.focus()
  }, [value, onChange])

  // ─── 键盘处理 ───────────────────────────────────────────────────────────────

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
      case 'Tab': {
        e.preventDefault()
        if (activeIndex >= 0 && filteredSuggestions[activeIndex]) {
          addTag(filteredSuggestions[activeIndex])
        }
        else if (inputValue.trim()) {
          addTag(inputValue)
        }
        break
      }
      case 'Backspace': {
        if (!inputValue && value.length > 0) {
          removeTag(value[value.length - 1])
        }
        break
      }
      case 'ArrowDown': {
        e.preventDefault()
        setShowSuggestions(true)
        setActiveIndex(i => Math.min(i + 1, filteredSuggestions.length - 1))
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, -1))
        break
      }
      case 'Escape': {
        setShowSuggestions(false)
        setActiveIndex(-1)
        break
      }
    }
  }, [inputValue, value, activeIndex, filteredSuggestions, addTag, removeTag])

  // 选中项滚动到可见区
  React.useEffect(() => {
    if (activeIndex < 0 || !listRef.current)
      return
    const item = listRef.current.children[activeIndex] as HTMLElement
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // 点击外部关闭
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* 标签 + 输入框容器 */}
      <div
        className={cn(
          'border-input bg-transparent shadow-xs transition-[color,box-shadow]',
          'flex min-h-9 w-full flex-wrap gap-1.5 rounded-md border px-2.5 py-1.5',
          'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
          disabled && 'pointer-events-none cursor-not-allowed opacity-50',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* 已有标签 */}
        {value.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {tag}
            <button
              type="button"
              className="rounded hover:text-destructive transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(tag)
              }}
              tabIndex={-1}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}

        {/* 文本输入 */}
        <input
          ref={inputRef}
          value={inputValue}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : ''}
          className="min-w-35 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowSuggestions(true)
            setActiveIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue && setShowSuggestions(true)}
        />
      </div>

      {/* 候选下拉 */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
          <ul ref={listRef} className="max-h-52 overflow-y-auto p-1">
            {filteredSuggestions.map((s, i) => {
              const q = inputValue.trim().toLowerCase()
              const si = s.toLowerCase().indexOf(q)
              return (
                <li key={s}>
                  <button
                    type="button"
                    className={cn(
                      'w-full rounded-sm px-2 py-1.5 text-left text-sm font-mono transition-colors',
                      i === activeIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/60',
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      addTag(s)
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    {si >= 0
                      ? (
                          <>
                            {s.slice(0, si)}
                            <mark className="bg-transparent font-bold text-foreground">{s.slice(si, si + q.length)}</mark>
                            {s.slice(si + q.length)}
                          </>
                        )
                      : s}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
