import { useEffect, useRef } from "react";
import { onUpdate } from "@/lib/command";
import type { Message } from "@/node/database/schema/chat";
import { useMessageStore } from "@/store/message";

/* ------------------------------------------------------------------ */
/* 常量 */
/* ------------------------------------------------------------------ */

const EMPTY_MESSAGES: Message[] = [];

/* ------------------------------------------------------------------ */
/* 初始化消息 Store（只执行一次） */
/* ------------------------------------------------------------------ */

export function useInitMessages() {
	const init = useMessageStore((s) => s.init);
	const initialized = useMessageStore((s) => s.initialized);

	useEffect(() => {
		if (!initialized) {
			init();
		}
	}, [init, initialized]);
}

/* ------------------------------------------------------------------ */
/* 消息实时更新（created / streaming / updated）
 * 完全适配 appendMessage / updateMessage
 * ------------------------------------------------------------------ */

export function useMessageUpdates() {
	const appendMessage = useMessageStore((s) => s.appendMessage);
	const updateMessage = useMessageStore((s) => s.updateMessage);

	/**
	 * streaming 合帧缓冲
	 * key = messageUid
	 */
	const streamingBuffer = useRef<
		Map<
			string,
			{
				chatUid: string;
				content: string;
			}
		>
	>(new Map());

	const rafId = useRef<number | null>(null);

	const flushStreaming = () => {
		streamingBuffer.current.forEach((value, messageUid) => {
			console.log("Flushing streaming message:", messageUid, value);
			updateMessage(value.chatUid, messageUid, {
				content: value.content,
				status: "streaming",
			});
		});

		streamingBuffer.current.clear();
		rafId.current = null;
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		/* message.created → appendMessage（热路径，不排序） */
		const unsubscribeCreated = onUpdate("message.created", (payload) => {
			appendMessage(payload.chatUid, payload.message);
		});

		/* message.streaming → 合帧 updateMessage */
		const unsubscribeStreaming = onUpdate("message.streaming", (payload) => {
			streamingBuffer.current.set(payload.messageUid, {
				chatUid: payload.chatUid,
				content: payload.content,
			});

			if (rafId.current == null) {
				rafId.current = requestAnimationFrame(flushStreaming);
			}
		});

		/* message.updated → 最终态 / error / metadata */
		const unsubscribeUpdated = onUpdate("message.updated", (payload) => {
			updateMessage(payload.chatUid, payload.messageUid, payload.updates);
		});

		return () => {
			unsubscribeCreated?.();
			unsubscribeStreaming?.();
			unsubscribeUpdated?.();

			if (rafId.current != null) {
				cancelAnimationFrame(rafId.current);
			}
		};
	}, [appendMessage, updateMessage]);
}

/* ------------------------------------------------------------------ */
/* 当前聊天消息列表（Virtuoso 友好 selector）
 * ------------------------------------------------------------------ */

export function useChatMessages(chatUid?: string) {
	return useMessageStore((state) => {
		if (!chatUid) return EMPTY_MESSAGES;
		return state.messagesByChatId[chatUid] ?? EMPTY_MESSAGES;
	});
}
