/**
 * @fileoverview useVirtualScroller — 核心虚拟化 Hook
 *
 * 基于 @tanstack/react-virtual 封装，附加：
 *  - 动态高度测量（measureElement callback ref）
 *  - 跟随底部自动滚动
 *  - 滚动到指定 index（命令式）
 *  - 预留 scroll anchor（顶部加载后位置补偿）
 */

import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual'
import type {
  ScrollAlignment,
  ScrollBehavior,
  ScrollDirection,
  ScrollToIndexOptions,
  VirtualListHandle,
} from '../types'
import { useVirtualizer } from '@tanstack/react-virtual'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  captureScrollAnchor,
  clampIndex,
  getScrollDirection,
  isScrolledToBottom,
  isScrolledToTop,
  rafThrottle,
  scrollElementToBottom,
  scrollElementToTop,
} from '../utils'

// @tanstack/react-virtual 仅支持 'auto' | 'smooth'
type TanstackScrollBehavior = 'auto' | 'smooth'

// ─── 选项 ────────────────────────────────────────────────────────────────────

export interface UseVirtualScrollerOptions {
  count: number
  estimatedItemSize?: number
  overscan?: number

  // 初始位置
  initialIndex?: number
  initialAlignment?: ScrollAlignment

  // 底部跟随
  followOutput?: boolean
  followOutputBehavior?: (isAtBottom: boolean) => ScrollBehavior | false
  atBottomThreshold?: number

  // 顶部/底部加载更多
  hasMoreTop?: boolean
  onLoadMoreTop?: () => void | Promise<void>
  loadMoreTopThreshold?: number

  hasMoreBottom?: boolean
  onLoadMoreBottom?: () => void | Promise<void>
  loadMoreBottomThreshold?: number

  // 事件
  onScroll?: (event: Event) => void
  onAtBottomStateChange?: (atBottom: boolean) => void
  onAtTopStateChange?: (atTop: boolean) => void

  // 命令式 ref
  listRef?: React.RefObject<VirtualListHandle | null>
}

// ─── 返回值 ──────────────────────────────────────────────────────────────────

export interface UseVirtualScrollerReturn {
  /** 挂在滚动容器上的 ref */
  scrollRef: React.RefObject<HTMLDivElement | null>
  /** @tanstack/react-virtual 的虚拟化器实例 */
  virtualizer: Virtualizer<HTMLDivElement, Element>
  /** 当前可见的虚拟 items */
  virtualItems: VirtualItem[]
  /** 整体列表高度（px），用于外层撑开 */
  totalSize: number
  /** 是否正在滚动方向向上 */
  scrollDirection: ScrollDirection
  /** 当前是否处于底部 */
  atBottom: boolean
  /** 当前是否处于顶部 */
  atTop: boolean
  /**
   * measureRef — 挂在每个 item 容器上，用于动态高度测量
   * 用法: <div ref={measureRef(virtualItem)} .../>
   */
  measureRef: (vItem: VirtualItem) => (el: Element | null) => void
  /**
   * 在准备 prepend 数据之前调用，返回一个恢复函数，
   * 在 state 更新后的 layout effect 中调用，以补偿 scrollTop 防止跳动
   */
  captureAnchor: () => () => void
  /** 命令式滚动到指定 index */
  scrollToIndex: (options: ScrollToIndexOptions) => void
  /** 命令式滚动到底部 */
  scrollToBottom: (behavior?: ScrollBehavior) => void
  /** 命令式滚动到顶部 */
  scrollToTop: (behavior?: ScrollBehavior) => void
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVirtualScroller(options: UseVirtualScrollerOptions): UseVirtualScrollerReturn {
  const {
    count,
    estimatedItemSize = 80,
    overscan = 3,
    initialIndex,
    initialAlignment = 'end',
    followOutput = true,
    followOutputBehavior,
    atBottomThreshold = 80,
    hasMoreTop = false,
    onLoadMoreTop,
    loadMoreTopThreshold = 100,
    hasMoreBottom = false,
    onLoadMoreBottom,
    loadMoreBottomThreshold = 50,
    onScroll,
    onAtBottomStateChange,
    onAtTopStateChange,
    listRef,
  } = options

  const scrollRef = useRef<HTMLDivElement>(null)

  // ── 状态追踪 ──────────────────────────────────────────────────────────────

  const atBottomRef = useRef(true)
  const atTopRef = useRef(false)
  const prevScrollTopRef = useRef(0)
  const isLoadingTopRef = useRef(false)
  const isLoadingBottomRef = useRef(false)
  const prevCountRef = useRef(count)
  const initialScrollDoneRef = useRef(false)

  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>('none')
  const [atBottom, setAtBottom] = useState(true)
  const [atTop, setAtTop] = useState(false)

  // ── 创建虚拟化器 ──────────────────────────────────────────────────────────

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedItemSize,
    overscan,
    // paddingStart / paddingEnd 留给 slot 组件自身决定，不在这里处理
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // ── 动态高度测量 ref ──────────────────────────────────────────────────────

  const measureRef = useCallback(
    (_vItem: VirtualItem) =>
      (el: Element | null) => {
        if (el) {
          virtualizer.measureElement(el)
        }
      },
    [virtualizer],
  )

  // ── 命令式滚动 ────────────────────────────────────────────────────────────

  const scrollToIndex = useCallback(
    ({ index, align = 'start', behavior = 'auto' }: ScrollToIndexOptions) => {
      const clamped = clampIndex(index, count)
      // @tanstack/react-virtual 仅支持 'auto' | 'smooth'，'instant' 映射为 'auto'
      const tanstackBehavior: TanstackScrollBehavior = behavior === 'instant' ? 'auto' : behavior as TanstackScrollBehavior
      virtualizer.scrollToIndex(clamped, { align, behavior: tanstackBehavior })
    },
    [virtualizer, count],
  )

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const el = scrollRef.current
      if (!el)
        return
      scrollElementToBottom(el, behavior)
    },
    [],
  )

  const scrollToTop = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const el = scrollRef.current
      if (!el)
        return
      scrollElementToTop(el, behavior)
    },
    [],
  )

  // ── 对外暴露 ref handle ───────────────────────────────────────────────────

  useImperativeHandle(
    listRef,
    (): VirtualListHandle => ({
      scrollToIndex,
      scrollToBottom,
      scrollToTop,
      getScrollElement: () => scrollRef.current,
      isAtBottom: () => {
        const el = scrollRef.current
        return el ? isScrolledToBottom(el, atBottomThreshold) : false
      },
      isAtTop: () => {
        const el = scrollRef.current
        return el ? isScrolledToTop(el, loadMoreTopThreshold) : false
      },
    }),
    [scrollToIndex, scrollToBottom, scrollToTop, atBottomThreshold, loadMoreTopThreshold],
  )

  // ── 初始滚动（仅执行一次） ─────────────────────────────────────────────────

  useLayoutEffect(() => {
    if (initialScrollDoneRef.current || count === 0)
      return

    const targetIndex = initialIndex !== undefined ? initialIndex : count - 1
    // 使用 auto（即时）避免动画阻塞初始渲染
    virtualizer.scrollToIndex(clampIndex(targetIndex, count), {
      align: initialAlignment,
      behavior: 'auto',
    })
    initialScrollDoneRef.current = true
  }, [count > 0]) // 仅当列表从无到有时触发一次

  // ── 跟随底部：新增 item 后自动滚动 ────────────────────────────────────────

  useLayoutEffect(() => {
    const prevCount = prevCountRef.current
    const newCount = count

    // 仅在 count 增加（追加新消息）时触发
    if (newCount <= prevCount) {
      prevCountRef.current = newCount
      return
    }

    prevCountRef.current = newCount

    // 没有启用 followOutput → 跳过
    if (!followOutput && !followOutputBehavior)
      return

    const el = scrollRef.current
    if (!el)
      return

    const currentlyAtBottom = isScrolledToBottom(el, atBottomThreshold)

    let behavior: ScrollBehavior | false = false

    if (followOutputBehavior) {
      behavior = followOutputBehavior(currentlyAtBottom)
    }
    else if (followOutput && currentlyAtBottom) {
      behavior = 'smooth'
    }

    if (behavior) {
      scrollElementToBottom(el, behavior)
    }
  }, [count])

  // ── 滚动事件处理 ──────────────────────────────────────────────────────────

  useEffect(() => {
    const el = scrollRef.current
    if (!el)
      return

    const handleScroll = rafThrottle((event: Event) => {
      const currentScrollTop = el.scrollTop
      const direction = getScrollDirection(prevScrollTopRef.current, currentScrollTop)
      prevScrollTopRef.current = currentScrollTop

      setScrollDirection(direction)

      // ── 底部状态 ────────────────────────────────────────────────────────
      const nowAtBottom = isScrolledToBottom(el, atBottomThreshold)
      if (nowAtBottom !== atBottomRef.current) {
        atBottomRef.current = nowAtBottom
        setAtBottom(nowAtBottom)
        onAtBottomStateChange?.(nowAtBottom)
      }

      // ── 顶部状态 ────────────────────────────────────────────────────────
      const nowAtTop = isScrolledToTop(el, loadMoreTopThreshold)
      if (nowAtTop !== atTopRef.current) {
        atTopRef.current = nowAtTop
        setAtTop(nowAtTop)
        onAtTopStateChange?.(nowAtTop)
      }

      // ── 触发顶部加载更多 ────────────────────────────────────────────────
      if (direction === 'up' && nowAtTop && hasMoreTop && !isLoadingTopRef.current) {
        isLoadingTopRef.current = true
        Promise.resolve(onLoadMoreTop?.()).finally(() => {
          isLoadingTopRef.current = false
        })
      }

      // ── 触发底部加载更多（反向分页） ────────────────────────────────────
      const nowAtBottomForMore = isScrolledToBottom(el, loadMoreBottomThreshold)
      if (direction === 'down' && nowAtBottomForMore && hasMoreBottom && !isLoadingBottomRef.current) {
        isLoadingBottomRef.current = true
        Promise.resolve(onLoadMoreBottom?.()).finally(() => {
          isLoadingBottomRef.current = false
        })
      }

      onScroll?.(event)
    })

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [
    atBottomThreshold,
    loadMoreTopThreshold,
    loadMoreBottomThreshold,
    hasMoreTop,
    hasMoreBottom,
    onLoadMoreTop,
    onLoadMoreBottom,
    onScroll,
    onAtBottomStateChange,
    onAtTopStateChange,
  ])

  // ── scroll anchor（顶部插入补偿） ────────────────────────────────────────

  const captureAnchor = useCallback((): (() => void) => {
    const el = scrollRef.current
    if (!el)
      return () => {}
    return captureScrollAnchor(el)
  }, [])

  return {
    scrollRef,
    virtualizer,
    virtualItems,
    totalSize,
    scrollDirection,
    atBottom,
    atTop,
    measureRef,
    captureAnchor,
    scrollToIndex,
    scrollToBottom,
    scrollToTop,
  }
}
