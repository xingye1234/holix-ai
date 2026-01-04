import { memo, useRef } from "react";
import { Virtuoso } from "react-virtuoso";
import { useChatContext } from "@/context/chat";
import { useChatMessageIds } from "@/hooks/message";
import { MessageItem } from "./message-item";

// ✅ Telegram 架构：只订阅消息 ID 列表，不订阅消息内容
export const MainContent = memo(function MainContent() {
  const { chat } = useChatContext();
  const virtuosoRef = useRef(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ✅ 只获取消息 ID 数组，不包含消息内容
  const messageIds = useChatMessageIds(chat?.uid);

  const isAtBottomRef = useRef(true);
  const initialIndex = useRef<number | null>(null);

  if (initialIndex.current === null && messageIds.length > 0) {
    initialIndex.current = messageIds.length - 1;
  }

  return (
    <main ref={wrapperRef} className="h-(--app-chat-content-height)">
      <Virtuoso
        ref={virtuosoRef}
        data={messageIds}
        style={{ height: "var(--app-chat-content-height)" }}
        className="custom-scrollbar"
        increaseViewportBy={{ top: 0, bottom: 200 }}
        followOutput={(isAtBottom) => (isAtBottom ? "smooth" : false)}
        atBottomStateChange={(bottom) => {
          isAtBottomRef.current = bottom;
        }}
        initialTopMostItemIndex={
          initialIndex.current != null ? { index: initialIndex.current, align: "end" } : undefined
        }
        itemContent={(index, messageId) => (
          // ✅ 只传递 messageId，MessageItem 自己订阅消息数据
          <MessageItem key={messageId} index={index} messageId={messageId} />
        )}
      />
    </main>
  );
});
