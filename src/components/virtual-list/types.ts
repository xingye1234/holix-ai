/**
 * @fileoverview Virtual Message List — Type Definitions
 *
 * 设计目标：
 *  - 高性能 AI 聊天消息渲染
 *  - 动态 item 高度测量
 *  - 顶部/底部加载更多 + 插槽
 *  - 滚动到指定消息 & 指定初始位置
 *  - 为未来独立打包留好边界（无业务耦合，纯通用接口）
 */

import type { ReactNode, RefObject } from 'react'

// ─── 滚动对齐方式 ────────────────────────────────────────────────────────────

export type ScrollAlignment = 'start' | 'center' | 'end' | 'auto'

// ─── 滚动行为 ────────────────────────────────────────────────────────────────

export type ScrollBehavior = 'smooth' | 'instant' | 'auto'

// ─── 滚动到指定 index 的参数 ─────────────────────────────────────────────────

export interface ScrollToIndexOptions {
  index: number
  align?: ScrollAlignment
  behavior?: ScrollBehavior
}

// ─── 虚拟列表对外暴露的命令式 API ─────────────────────────────────────────────

export interface VirtualListHandle {
  /** 滚动到指定索引 */
  scrollToIndex: (options: ScrollToIndexOptions) => void
  /** 滚动到底部 */
  scrollToBottom: (behavior?: ScrollBehavior) => void
  /** 滚动到顶部 */
  scrollToTop: (behavior?: ScrollBehavior) => void
  /** 获取当前滚动容器的 DOM 引用 */
  getScrollElement: () => HTMLElement | null
  /** 当前是否处于底部（距底部 <= threshold px） */
  isAtBottom: () => boolean
  /** 当前是否处于顶部（距顶部 <= threshold px） */
  isAtTop: () => boolean
}

// ─── 加载状态 ────────────────────────────────────────────────────────────────

export type LoadingState = 'idle' | 'loading' | 'error' | 'done'

// ─── 单个虚拟行渲染信息（传给 itemContent） ──────────────────────────────────

export interface VirtualItemRenderInfo<TData = unknown> {
  index: number
  item: TData
  /** 当前是否是最后一条 */
  isLast: boolean
  /** 当前是否是第一条 */
  isFirst: boolean
}

// ─── 主组件 Props ─────────────────────────────────────────────────────────────

export interface VirtualMessageListProps<TItem = string> {
  // ── 数据 ──────────────────────────────────────────────────────────────────

  /** 数据项数组（默认为消息 ID 字符串列表） */
  data: TItem[]

  /**
   * 为每个 item 返回唯一 key，默认使用 index
   * 推荐传入 (item) => item.id
   */
  getItemKey?: (item: TItem, index: number) => string | number

  // ── 渲染 ──────────────────────────────────────────────────────────────────

  /** item 内容渲染函数 */
  itemContent: (info: VirtualItemRenderInfo<TItem>) => ReactNode

  /**
   * 估算高度（用于虚拟化初始布局），默认 80
   * 越接近真实平均高度，初始布局越精准
   */
  estimatedItemSize?: number

  /**
   * 预渲染的屏外 item 数量，默认 3
   * 更大值 → 更平滑但更高内存
   */
  overscan?: number

  // ── 顶部区域 ──────────────────────────────────────────────────────────────

  /** 列表顶部固定插槽（始终可见，如 "开始的地方"横幅） */
  topSlot?: ReactNode

  /** 顶部加载状态 */
  loadingTopState?: LoadingState

  /** 顶部加载中的占位内容，默认使用内置 spinner */
  loadingTopContent?: ReactNode

  /**
   * 是否还有更多历史消息可加载
   * true → 滚动到顶部时触发 onLoadMoreTop
   */
  hasMoreTop?: boolean

  /** 滚动到顶部时触发加载更多 */
  onLoadMoreTop?: () => void | Promise<void>

  /**
   * 触发 onLoadMoreTop 的阈值（距顶部 px），默认 100
   */
  loadMoreTopThreshold?: number

  // ── 底部区域 ──────────────────────────────────────────────────────────────

  /** 列表底部固定插槽（如输入中指示器、欢迎语） */
  bottomSlot?: ReactNode

  /** 底部加载状态 */
  loadingBottomState?: LoadingState

  /** 底部加载中的占位内容 */
  loadingBottomContent?: ReactNode

  /** 是否有更多新消息可加载（反向分页，一般不常用） */
  hasMoreBottom?: boolean

  /** 滚动到底部时触发 */
  onLoadMoreBottom?: () => void | Promise<void>

  /**
   * 触发 onLoadMoreBottom 的阈值（距底部 px），默认 50
   */
  loadMoreBottomThreshold?: number

  // ── 自动跟随底部 ──────────────────────────────────────────────────────────

  /**
   * 是否启用"跟随底部"——当用户处于底部时，新增 item 后自动滚动到底
   * 默认 true
   */
  followOutput?: boolean

  /**
   * 自定义跟随行为：
   *  - 返回 'smooth' | 'instant' |'auto'
   *  - 返回 false 表示本次不跟随
   * 优先级高于 followOutput
   */
  followOutputBehavior?: (isAtBottom: boolean) => ScrollBehavior | false

  /**
   * "处于底部"判定阈值（px），默认 80
   */
  atBottomThreshold?: number

  // ── 初始位置 ──────────────────────────────────────────────────────────────

  /**
   * 初始渲染时滚动到的索引
   * 默认 = data.length - 1（聊天通常从底部开始）
   * 传 0 则从顶部开始
   */
  initialIndex?: number

  /** 初始定位对齐方式，默认 'end' */
  initialAlignment?: ScrollAlignment

  // ── 样式 ──────────────────────────────────────────────────────────────────

  className?: string
  style?: React.CSSProperties

  /** 内部 item 容器的 className */
  itemClassName?: string

  // ── 事件回调 ──────────────────────────────────────────────────────────────

  /** 滚动位置变更 */
  onScroll?: (event: Event) => void

  /** 是否处于底部状态变更 */
  onAtBottomStateChange?: (atBottom: boolean) => void

  /** 是否处于顶部状态变更 */
  onAtTopStateChange?: (atTop: boolean) => void

  // ── 命令式 ref ────────────────────────────────────────────────────────────

  listRef?: RefObject<VirtualListHandle | null>
}

// ─── 内部使用的 item 测量缓存 ─────────────────────────────────────────────────

export interface ItemSizeCache {
  get: (index: number) => number | undefined
  set: (index: number, size: number) => void
  clear: () => void
}

// ─── 滚动方向 ────────────────────────────────────────────────────────────────

export type ScrollDirection = 'up' | 'down' | 'none'
