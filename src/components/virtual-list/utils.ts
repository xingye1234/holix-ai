/**
 * @fileoverview Virtual Message List — Utilities
 */

import type { ScrollAlignment, ScrollBehavior, ScrollDirection } from './types'

// ─── 滚动位置判断 ─────────────────────────────────────────────────────────────

/**
 * 判断元素是否处于底部
 * @param el          滚动容器
 * @param threshold   阈值（px），默认 80
 */
export function isScrolledToBottom(el: HTMLElement, threshold = 80): boolean {
  const { scrollTop, scrollHeight, clientHeight } = el
  return scrollHeight - scrollTop - clientHeight <= threshold
}

/**
 * 判断元素是否处于顶部
 */
export function isScrolledToTop(el: HTMLElement, threshold = 50): boolean {
  return el.scrollTop <= threshold
}

// ─── 滚动执行 ────────────────────────────────────────────────────────────────

/**
 * 滚动容器到底部
 */
export function scrollElementToBottom(el: HTMLElement, behavior: ScrollBehavior = 'smooth'): void {
  el.scrollTo({ top: el.scrollHeight, behavior })
}

/**
 * 滚动容器到顶部
 */
export function scrollElementToTop(el: HTMLElement, behavior: ScrollBehavior = 'smooth'): void {
  el.scrollTo({ top: 0, behavior })
}

// ─── 滚动方向检测 ─────────────────────────────────────────────────────────────

/**
 * 根据前后 scrollTop 判断滚动方向
 */
export function getScrollDirection(prev: number, current: number): ScrollDirection {
  if (current < prev)
    return 'up'
  if (current > prev)
    return 'down'
  return 'none'
}

// ─── 对齐方式映射 ─────────────────────────────────────────────────────────────

/**
 * 将 ScrollAlignment 映射为 `ScrollLogicalPosition`（用于 scrollIntoView）
 */
export function alignmentToBlock(align: ScrollAlignment): ScrollLogicalPosition {
  switch (align) {
    case 'start': return 'start'
    case 'center': return 'center'
    case 'end': return 'end'
    case 'auto': return 'nearest'
    default: return 'nearest'
  }
}

// ─── item 索引处理 ────────────────────────────────────────────────────────────

/**
 * 将 item index 钳制在合法范围
 */
export function clampIndex(index: number, length: number): number {
  if (length === 0)
    return 0
  return Math.max(0, Math.min(index, length - 1))
}

// ─── Prepend 时保持滚动位置 ───────────────────────────────────────────────────

/**
 * 在向列表头部插入新 items（加载历史消息）时，
 * 通过在更新前后对比 scrollHeight 来补偿 scrollTop，
 * 防止视觉跳动。
 *
 * 用法：
 *   const restore = captureScrollAnchor(el)
 *   // ... prepend items in state ...
 *   restore()
 */
export function captureScrollAnchor(el: HTMLElement): () => void {
  const prevScrollTop = el.scrollTop
  const prevScrollHeight = el.scrollHeight
  return () => {
    const newScrollHeight = el.scrollHeight
    const delta = newScrollHeight - prevScrollHeight
    if (delta > 0) {
      el.scrollTop = prevScrollTop + delta
    }
  }
}

// ─── RAF 节流 ────────────────────────────────────────────────────────────────

/**
 * 简单的 requestAnimationFrame 节流包装
 */
export function rafThrottle<T extends (...args: any[]) => void>(fn: T): T {
  let rafId: number | null = null

  const throttled = (...args: Parameters<T>) => {
    if (rafId != null)
      return
    rafId = requestAnimationFrame(() => {
      fn(...args)
      rafId = null
    })
  }

  return throttled as T
}

// ─── 稳定 key 生成 ────────────────────────────────────────────────────────────

/**
 * 默认 getItemKey：使用 index
 */
export function defaultGetItemKey<T>(_item: T, index: number): string | number {
  return index
}
