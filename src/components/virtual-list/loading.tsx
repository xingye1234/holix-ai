/**
 * @fileoverview Virtual List — 内置 Loading 与占位组件
 * 轻量级，不依赖业务组件库，方便未来独立打包
 */

import type { LoadingState } from './types'

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function VirtualListSpinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        animation: 'virtual-list-spin 0.75s linear infinite',
        display: 'inline-block',
        flexShrink: 0,
        opacity: 0.6,
      }}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <style>
        {`
        @keyframes virtual-list-spin {
          to { transform: rotate(360deg); }
        }
      `}
      </style>
    </svg>
  )
}

// ─── 顶部加载更多 loading 行 ─────────────────────────────────────────────────

interface LoadMoreIndicatorProps {
  state?: LoadingState
  position?: 'top' | 'bottom'
  custom?: React.ReactNode
}

export function LoadMoreIndicator({ state, position = 'top', custom }: LoadMoreIndicatorProps) {
  if (state !== 'loading')
    return null

  if (custom) {
    return <>{custom}</>
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '12px 0',
        gap: 6,
        color: 'var(--muted-foreground, #888)',
        fontSize: 12,
      }}
      aria-label={position === 'top' ? '加载历史消息' : '加载更多'}
    >
      <VirtualListSpinner size={14} />
      <span>{position === 'top' ? '加载历史消息...' : '正在加载...'}</span>
    </div>
  )
}

// ─── 空状态 ──────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  message?: React.ReactNode
}

export function VirtualListEmpty({ message }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        padding: '40px 0',
        color: 'var(--muted-foreground, #888)',
        fontSize: 13,
      }}
      aria-label="暂无消息"
    >
      {message ?? '暂无消息'}
    </div>
  )
}
