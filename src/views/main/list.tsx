import type { VirtuosoHandle } from 'react-virtuoso'
import React, { useCallback, useRef } from 'react'
import { Virtuoso } from 'react-virtuoso'

interface ChatVirtuosoProps {
  /** 消息 ID 数组 */
  data: string[]
  /** 渲染单条消息的函数 */
  renderMessage: (msg: string, index: number) => React.ReactNode
  /** 滚动到顶部时加载更多历史消息 */
  loadMoreTop?: () => Promise<void>
  /** 滚动到底部时加载更多新消息 */
  loadMoreBottom?: () => Promise<void>
  /** 首次显示的条目索引，默认显示最后一条 */
  initialIndex?: number
  /** 预渲染条目数（默认 10） */
  overscan?: number
}

/**
 * 基于 react-virtuoso 的聊天消息虚拟列表组件。
 * - 动态高度由 Virtuoso 自动测量，无需手动缓存
 * - 加载历史消息时通过 scroller DOM 保持视口稳定
 * - followOutput / startReached / endReached 覆盖全部滚动场景
 */
export const ChatVirtuoso: React.FC<ChatVirtuosoProps> = ({
  data,
  renderMessage,
  loadMoreTop,
  loadMoreBottom,
  initialIndex,
  overscan = 10,
}) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  // 通过 scroller ref 获取 DOM 节点以在加载历史消息时锚定滚动位置
  const scrollerRef = useRef<HTMLElement | Window | null>(null)

  // 向上加载历史消息，加载前保存 scrollTop 并在加载完成后还原，避免视口跳动
  const handleReachStart = useCallback(async () => {
    if (!loadMoreTop)
      return
    const scroller = scrollerRef.current
    const prevScrollTop = scroller instanceof HTMLElement ? scroller.scrollTop : 0
    await loadMoreTop()
    requestAnimationFrame(() => {
      if (scroller instanceof HTMLElement) {
        scroller.scrollTop = prevScrollTop
      }
    })
  }, [loadMoreTop])

  // 向下加载新消息
  const handleReachEnd = useCallback(async () => {
    if (!loadMoreBottom)
      return
    await loadMoreBottom()
  }, [loadMoreBottom])

  return (
    <Virtuoso
      ref={virtuosoRef}
      scrollerRef={ref => (scrollerRef.current = ref)}
      data={data}
      overscan={overscan}
      initialTopMostItemIndex={initialIndex ?? Math.max(0, data.length - 1)}
      followOutput={isAtBottom => (isAtBottom ? 'smooth' : false)}
      startReached={handleReachStart}
      endReached={handleReachEnd}
      itemContent={(index, msg) => renderMessage(msg, index)}
      style={{ height: '100%', width: '100%' }}
    />
  )
}
