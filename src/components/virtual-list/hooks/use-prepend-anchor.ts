/**
 * @fileoverview usePrependAnchor
 *
 * 在向列表 **头部** 插入新数据时（加载历史消息），保持用户当前的滚动位置不跳动。
 *
 * 原理：
 *  1. 插入前记录 scrollTop + scrollHeight
 *  2. 等待 DOM 更新（useLayoutEffect）
 *  3. 用新 scrollHeight - 旧 scrollHeight 的差值补偿 scrollTop
 *
 * 用法：
 * ```tsx
 * const { beforePrepend, afterPrepend } = usePrependAnchor(scrollRef)
 *
 * const handleLoadMore = async () => {
 *   beforePrepend()          // 1. 记录快照
 *   const older = await fetch()
 *   prependMessages(older)   // 2. 更新 state（触发 re-render）
 *   // afterPrepend 在 useLayoutEffect 中自动执行
 * }
 * ```
 */

import { useCallback, useLayoutEffect, useRef } from 'react'

interface ScrollSnapshot {
  scrollTop: number
  scrollHeight: number
}

export function usePrependAnchor(
  scrollRef: React.RefObject<HTMLElement | null>,
): {
  /** 在修改数据之前调用，记录当前滚动快照 */
  beforePrepend: () => void
  /** 由 useLayoutEffect 自动调用，也可手动触发 */
  afterPrepend: () => void
} {
  const snapshotRef = useRef<ScrollSnapshot | null>(null)
  const pendingRef = useRef(false)

  const beforePrepend = useCallback(() => {
    const el = scrollRef.current
    if (!el)
      return
    snapshotRef.current = {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
    }
    pendingRef.current = true
  }, [scrollRef])

  const afterPrepend = useCallback(() => {
    if (!pendingRef.current)
      return
    const el = scrollRef.current
    const snapshot = snapshotRef.current
    if (!el || !snapshot)
      return

    const delta = el.scrollHeight - snapshot.scrollHeight
    if (delta > 0) {
      // 直接设置（不用 scrollTo 避免动画），防止视觉跳动
      el.scrollTop = snapshot.scrollTop + delta
    }

    snapshotRef.current = null
    pendingRef.current = false
  }, [scrollRef])

  // 自动在每次 layout 后触发补偿
  useLayoutEffect(() => {
    afterPrepend()
  })

  return { beforePrepend, afterPrepend }
}
