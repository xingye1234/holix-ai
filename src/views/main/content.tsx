import type { VirtualItemRenderInfo } from '@/components/virtual-list'
import { AnimatePresence, motion } from 'framer-motion'
import { VirtualMessageList } from '@/components/virtual-list'
import { useChatContext } from '@/context/chat'
import { useChatVirtualList } from '@/hooks/chat-virtual-list'
import { MessageItem } from './message-item'

// ─── item 渲染函数 ─────────────────────────────────────────────────────────────
// 保持引用稳定，避免 VirtualMessageList 整体重渲染

function renderItem({ item: id, index }: VirtualItemRenderInfo<string>) {
  return <MessageItem id={id} index={index} />
}

// ─── 主内容区 ─────────────────────────────────────────────────────────────────

export const MainContent = memo(() => {
  const { chat } = useChatContext()

  const {
    messageIds,
    hasMoreTop,
    loadingTopState,
    onLoadMoreTop,
    followOutputBehavior,
    onAtBottomStateChange,
    listRef,
  } = useChatVirtualList()

  return (
    <main className="h-(--app-chat-content-height)">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={chat?.uid ?? '__empty'}
          className="size-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          <VirtualMessageList
            listRef={listRef}
            data={messageIds}
            getItemKey={(id: string) => id}
            itemContent={renderItem}

            // 动态行高估算：AI 消息含 markdown 平均约 120px
            estimatedItemSize={120}
            overscan={4}

            // 顶部历史记录加载
            hasMoreTop={hasMoreTop}
            loadingTopState={loadingTopState}
            onLoadMoreTop={onLoadMoreTop}
            loadMoreTopThreshold={120}

            // AI 流式输出跟随底部
            followOutputBehavior={followOutputBehavior}
            atBottomThreshold={80}
            onAtBottomStateChange={onAtBottomStateChange}

            // 初始从最新消息开始
            initialIndex={messageIds.length > 0 ? messageIds.length - 1 : 0}
            initialAlignment="end"

            style={{ height: 'var(--app-chat-content-height)' }}
          />
        </motion.div>
      </AnimatePresence>
    </main>
  )
})
