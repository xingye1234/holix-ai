import type { AutocompleteSuggestion, PopupPosition } from './types'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { cn } from '@/lib/utils'
import { highlightLabel } from './detect'

export interface PopupProps {
  items: AutocompleteSuggestion[]
  activeIndex: number
  query: string
  position: PopupPosition
  title?: string
  onSelect: (item: AutocompleteSuggestion) => void
  onActiveChange: (index: number) => void
}

/**
 * 浮动自动补全弹窗，通过 Portal 挂载到 document.body，
 * 样式跟随应用主题，使用 CSS var 颜色变量。
 */
export function AutocompletePopup({
  items,
  activeIndex,
  query,
  position,
  title,
  onSelect,
  onActiveChange,
}: PopupProps): React.ReactPortal | null {
  if (items.length === 0)
    return null

  const POPUP_HEIGHT_APPROX = 300

  const style: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.above
      ? position.y - POPUP_HEIGHT_APPROX
      : position.y + 4,
    zIndex: 9999,
    minWidth: 240,
    maxWidth: 360,
  }

  const content = (
    <div
      style={style}
      className="rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden"
      // 阻止鼠标点击触发编辑器失焦
      onMouseDown={e => e.preventDefault()}
    >
      {title && (
        <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground select-none">
          {title}
        </div>
      )}
      <ul className="py-1 max-h-[280px] overflow-y-auto" role="listbox">
        {items.map((item, idx) => {
          const segments = highlightLabel(item.label, query)
          const isActive = idx === activeIndex
          return (
            <li
              key={item.id}
              role="option"
              aria-selected={isActive}
              className={cn(
                'flex items-start gap-2 px-3 py-1.5 cursor-pointer select-none',
                'text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/60 hover:text-accent-foreground',
              )}
              onMouseEnter={() => onActiveChange(idx)}
              onClick={() => onSelect(item)}
            >
              {item.icon && (
                <span className="mt-0.5 shrink-0 flex items-center text-muted-foreground" aria-hidden>
                  {item.icon}
                </span>
              )}
              <div className="flex flex-col min-w-0">
                <span className="truncate font-medium leading-snug">
                  {segments.map((seg, i) =>
                    seg.highlight
                      ? (
                          <strong key={i} className="font-semibold">
                            {seg.text}
                          </strong>
                        )
                      : (
                          <span key={i}>{seg.text}</span>
                        ),
                  )}
                </span>
                {item.description && (
                  <span className="truncate text-xs text-muted-foreground leading-snug mt-0.5">
                    {item.description}
                  </span>
                )}
              </div>
              {item.type && (
                <span className="ml-auto mt-0.5 shrink-0 text-xs text-muted-foreground/60">
                  {item.type}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )

  return ReactDOM.createPortal(content, document.body)
}
