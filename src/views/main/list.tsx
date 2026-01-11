import type { VirtuosoHandle } from 'react-virtuoso'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'

interface ChatVirtuosoProps {
  data: string[]
  renderMessage: (msg: string, index: number) => React.ReactNode
  loadMoreTop?: () => Promise<void>
  loadMoreBottom?: () => Promise<void>
  initialIndex?: number // 首次显示索引，默认显示最后一条
  overscan?: number
}

export const ChatVirtuoso: React.FC<ChatVirtuosoProps> = ({
  data,
  renderMessage,
  loadMoreTop,
  loadMoreBottom,
  initialIndex,
  overscan = 10,
}) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const heightMap = useRef(new Map<string, number>()) // 缓存每条消息高度
  const [items, setItems] = useState<string[]>(data)

  // 同步 data 到内部 state
  useEffect(() => {
    setItems(data)
  }, [data])

  // 渲染单条消息并测量高度
  const Row = useCallback(
    ({ index }: { index: number }) => {
      const msg = items[index]
      const ref = useRef<HTMLDivElement>(null)

      useEffect(() => {
        if (!ref.current)
          return
        const h = ref.current.offsetHeight
        const prev = heightMap.current.get(msg)
        if (prev !== h) {
          heightMap.current.set(msg, h)
          // 新版 Virtuoso 会自动处理高度变化，无需 resetAfterIndex
        }
      }, [msg, index])

      return (
        <div ref={ref} style={{ width: '100%' }}>
          {renderMessage(msg, index)}
        </div>
      )
    },
    [items, renderMessage],
  )

  // 向上加载历史消息
  const handleReachStart = useCallback(async () => {
    if (!loadMoreTop || !virtuosoRef.current)
      return

    virtuosoRef.current.getState(async (state) => {
      const anchorOffset = state.scrollTop
      await loadMoreTop()
      // 保持 scrollTop
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollTo({ top: anchorOffset })
      })
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
      totalCount={items.length}
      overscan={overscan}
      initialTopMostItemIndex={initialIndex ?? items.length - 1}
      itemContent={index => <Row index={index} />}
      startReached={handleReachStart}
      endReached={handleReachEnd}
      style={{ height: '100%', width: '100%' }}
    />
  )
}
