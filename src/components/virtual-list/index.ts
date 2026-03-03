/**
 * @fileoverview Virtual Message List — Public API
 *
 * 未来独立打包时，只需将此目录提取为独立包：
 *   - 无业务耦合（不导入 store / context / ipc 等）
 *   - 唯一外部 peer dependency: react + @tanstack/react-virtual
 *
 * @example 使用方式
 * ```tsx
 * import type { VirtualListHandle } from '@/components/virtual-list'
 * import { VirtualMessageList } from '@/components/virtual-list'
 * ```
 */

// Hooks（供高级用法：如在 VirtualMessageList 外部直接操控虚拟器）
export { usePrependAnchor } from './hooks/use-prepend-anchor'

export { useVirtualScroller } from './hooks/use-virtual-scroller'

export type { UseVirtualScrollerOptions, UseVirtualScrollerReturn } from './hooks/use-virtual-scroller'

// 公共子组件（供二次封装）
export { LoadMoreIndicator, VirtualListEmpty, VirtualListSpinner } from './loading'
// 类型定义（全部 re-export，方便外部使用）
export type {
  ItemSizeCache,
  LoadingState,
  ScrollAlignment,
  ScrollBehavior,
  ScrollDirection,
  ScrollToIndexOptions,
  VirtualItemRenderInfo,
  VirtualListHandle,
  VirtualMessageListProps,
} from './types'
// 工具函数
export {
  captureScrollAnchor,
  clampIndex,
  defaultGetItemKey,
  getScrollDirection,
  isScrolledToBottom,
  isScrolledToTop,
  rafThrottle,
  scrollElementToBottom,
  scrollElementToTop,
} from './utils'

// 主组件
export { VirtualMessageList } from './VirtualMessageList'
