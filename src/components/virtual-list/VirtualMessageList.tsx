/**
 * @fileoverview VirtualMessageList — 主组件
 *
 * 基于 @tanstack/react-virtual 实现的高性能虚拟聊天消息列表
 *
 * ─── 特性一览 ────────────────────────────────────────────────────────────────
 *  ✅ 高性能虚拟化渲染（仅渲染可见区域 + overscan）
 *  ✅ 动态 item 高度（ResizeObserver 自动测量）
 *  ✅ 顶部历史加载 + 插槽 + 滚动位置补偿（无跳动）
 *  ✅ 底部反向分页加载 + 插槽
 *  ✅ 跟随底部自动滚动（AI 流式输出场景）
 *  ✅ 滚动方向检测
 *  ✅ 滚动到指定 index（命令式），支持对齐与动画
 *  ✅ 从指定初始位置开始渲染
 *  ✅ 命令式 ref handle（scrollToIndex / scrollToBottom / isAtBottom / ...）
 *  ✅ 底部/顶部状态回调
 *  ✅ 独立于业务逻辑，无硬依赖
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { VirtualMessageListProps } from './types'
import { memo, useMemo } from 'react'
import { usePrependAnchor } from './hooks/use-prepend-anchor'
import { useVirtualScroller } from './hooks/use-virtual-scroller'
import { LoadMoreIndicator, VirtualListEmpty } from './loading'
import { defaultGetItemKey } from './utils'

// ─── 默认值 ──────────────────────────────────────────────────────────────────

const DEFAULT_ESTIMATED_SIZE = 80
const DEFAULT_OVERSCAN = 3
const DEFAULT_AT_BOTTOM_THRESHOLD = 80
const DEFAULT_LOAD_MORE_TOP_THRESHOLD = 100
const DEFAULT_LOAD_MORE_BOTTOM_THRESHOLD = 50

// ─── 主组件 ──────────────────────────────────────────────────────────────────

function VirtualMessageListInner<TItem = string>({
  // 数据
  data,
  getItemKey = defaultGetItemKey,

  // 渲染
  itemContent,
  estimatedItemSize = DEFAULT_ESTIMATED_SIZE,
  overscan = DEFAULT_OVERSCAN,

  // 顶部
  topSlot,
  loadingTopState,
  loadingTopContent,
  hasMoreTop = false,
  onLoadMoreTop,
  loadMoreTopThreshold = DEFAULT_LOAD_MORE_TOP_THRESHOLD,

  // 底部
  bottomSlot,
  loadingBottomState,
  loadingBottomContent,
  hasMoreBottom = false,
  onLoadMoreBottom,
  loadMoreBottomThreshold = DEFAULT_LOAD_MORE_BOTTOM_THRESHOLD,

  // 跟随底部
  followOutput = true,
  followOutputBehavior,
  atBottomThreshold = DEFAULT_AT_BOTTOM_THRESHOLD,

  // 初始位置
  initialIndex,
  initialAlignment = 'end',

  // 样式
  className,
  style,
  itemClassName,

  // 事件
  onScroll,
  onAtBottomStateChange,
  onAtTopStateChange,

  // ref
  listRef,
}: VirtualMessageListProps<TItem>) {
  // ── 滚动锚点（顶部插入防跳）────────────────────────────────────────────────

  // 将 scrollRef 从 useVirtualScroller 传给 usePrependAnchor
  // 由于两个 hook 都需要 scrollRef，先创建再传入
  // useVirtualScroller 内部会创建 scrollRef，我们通过 captureAnchor 来处理
  // 这里的架构是：useVirtualScroller 持有 scrollRef，captureAnchor 暴露给外部
  // 使用方：在 onLoadMoreTop 回调中先调用 captureAnchor() 获取 restore fn，
  //        更新 state 后在 useLayoutEffect 中 restore()

  const {
    scrollRef,
    virtualItems,
    totalSize,
    scrollDirection: _scrollDirection,
    atBottom: _atBottom,
    atTop: _atTop,
    measureRef,
  } = useVirtualScroller({
    count: data.length,
    estimatedItemSize,
    overscan,
    initialIndex: initialIndex !== undefined ? initialIndex : data.length > 0 ? data.length - 1 : 0,
    initialAlignment,
    followOutput,
    followOutputBehavior,
    atBottomThreshold,
    hasMoreTop,
    onLoadMoreTop,
    loadMoreTopThreshold,
    hasMoreBottom,
    onLoadMoreBottom,
    loadMoreBottomThreshold,
    onScroll,
    onAtBottomStateChange,
    onAtTopStateChange,
    listRef,
  })

  // usePrependAnchor 共享同一个 scrollRef
  usePrependAnchor(scrollRef as React.RefObject<HTMLElement | null>)

  // ── 内容渲染 ──────────────────────────────────────────────────────────────

  const renderItems = useMemo(() => {
    return virtualItems.map((vItem) => {
      const item = data[vItem.index]
      if (item === undefined)
        return null

      const key = getItemKey(item, vItem.index)
      const isFirst = vItem.index === 0
      const isLast = vItem.index === data.length - 1

      return (
        <div
          key={key}
          data-index={vItem.index}
          ref={measureRef(vItem)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            // @tanstack/react-virtual v3 使用 transform 定位
            transform: `translateY(${vItem.start}px)`,
          }}
          className={itemClassName}
        >
          {itemContent({ index: vItem.index, item, isFirst, isLast })}
        </div>
      )
    })
  }, [virtualItems, data, getItemKey, measureRef, itemContent, itemClassName])

  // ── 空状态 ────────────────────────────────────────────────────────────────

  if (data.length === 0) {
    return (
      <div
        ref={scrollRef}
        className={className}
        style={{ overflow: 'auto', height: '100%', position: 'relative', ...style }}
      >
        {topSlot}
        <VirtualListEmpty />
        {bottomSlot}
      </div>
    )
  }

  // ── 主渲染 ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={scrollRef}
      className={className}
      style={{
        overflow: 'auto',
        height: '100%',
        position: 'relative',
        // 防止 content-visibility 导致测量问题
        contain: 'strict',
        ...style,
      }}
      tabIndex={0}
      aria-label="消息列表"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {/* 顶部固定插槽 */}
      {topSlot && (
        <div data-virtual-list-slot="top" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          {topSlot}
        </div>
      )}

      {/* 顶部加载指示器 */}
      <LoadMoreIndicator
        state={loadingTopState}
        position="top"
        custom={loadingTopContent}
      />

      {/* 虚拟化内容区域 */}
      <div
        data-virtual-list-inner
        style={{
          height: totalSize,
          width: '100%',
          position: 'relative',
        }}
      >
        {renderItems}
      </div>

      {/* 底部加载指示器 */}
      <LoadMoreIndicator
        state={loadingBottomState}
        position="bottom"
        custom={loadingBottomContent}
      />

      {/* 底部固定插槽 */}
      {bottomSlot && (
        <div data-virtual-list-slot="bottom">
          {bottomSlot}
        </div>
      )}
    </div>
  )
}

/**
 * VirtualMessageList — 泛型虚拟列表，默认 item 类型为 string（消息 ID）
 *
 * @example
 * ```tsx
 * <VirtualMessageList
 *   ref={listRef}
 *   data={messageIds}
 *   getItemKey={(id) => id}
 *   itemContent={({ item: id }) => <MessageItem id={id} />}
 *   hasMoreTop={hasMore}
 *   loadingTopState={loading ? 'loading' : 'idle'}
 *   onLoadMoreTop={loadOlderMessages}
 *   followOutput
 *   initialIndex={messageIds.length - 1}
 *   initialAlignment="end"
 * />
 * ```
 */
export const VirtualMessageList = memo(VirtualMessageListInner) as typeof VirtualMessageListInner
