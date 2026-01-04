import { memo, useRef } from "react";
import { Virtuoso } from "react-virtuoso";
import { useChatContext } from "@/context/chat";
import { useChatMessages } from "@/hooks/message";
import { MessageItem } from "./message-item";

// ✅ 使用 memo 优化，只有 context 真正变化时才重渲染
export const MainContent = memo(function MainContent() {
	const { chat } = useChatContext();
	const virtuosoRef = useRef(null);
	const wrapperRef = useRef<HTMLDivElement>(null);

	const messages = useChatMessages(chat?.uid);

	const isAtBottomRef = useRef(true);
	const initialIndex = useRef<number | null>(null);

	if (initialIndex.current === null && messages.length > 0) {
		initialIndex.current = messages.length - 1;
	}

  console.log("Rendering MainContent for chat ID:", chat?.uid, "Messages count:", messages.length);

	return (
		<main ref={wrapperRef} className="h-(--app-chat-content-height)">
			<Virtuoso
				ref={virtuosoRef}
				data={messages}
				style={{ height: "var(--app-chat-content-height)" }}
				className="custom-scrollbar"
				increaseViewportBy={{ top: 0, bottom: 200 }}
				followOutput={(isAtBottom) => (isAtBottom ? "smooth" : false)}
				atBottomStateChange={(bottom) => {
					isAtBottomRef.current = bottom;
				}}
				initialTopMostItemIndex={
					initialIndex.current != null
						? { index: initialIndex.current, align: "end" }
						: undefined
				}
				itemContent={(index, msg) => (
					<MessageItem key={msg.uid} index={index} message={msg} />
				)}
			/>
		</main>
	);
});
