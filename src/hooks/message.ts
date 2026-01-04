import { useEffect, useRef } from "react";
import { onUpdate } from "@/lib/command";
import { useMessageStore } from "@/store/message";

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
 * Telegram 架构：直接通过消息 ID 更新，不影响列表
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
				content: string;
			}
		>
	>(new Map());

	const rafId = useRef<number | null>(null);

	const flushStreaming = () => {
		streamingBuffer.current.forEach((value, messageUid) => {
			// ✅ 只需要 messageUid，不需要 chatUid
			updateMessage(messageUid, {
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
				content: payload.content,
			});

			if (rafId.current == null) {
				rafId.current = requestAnimationFrame(flushStreaming);
			}
		});

		/* message.updated → 最终态 / error / metadata */
		const unsubscribeUpdated = onUpdate("message.updated", (payload) => {
			// ✅ 只需要 messageUid
			updateMessage(payload.messageUid, payload.updates);
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
/* 当前聊天消息 ID 列表（Telegram 架构）
 * 返回消息 ID 数组，MessageItem 自己订阅单个消息
 * ------------------------------------------------------------------ */

export function useChatMessageIds(chatUid?: string) {
	return useMessageStore(
		(state) => {
			if (!chatUid) return [];
			// ✅ 安全检查：确保 chatMessageIds 存在
			if (!state.chatMessageIds) return [];
			return state.chatMessageIds[chatUid] || [];
		},
		// ✅ 只比较 ID 数组，不涉及消息内容
		(a, b) => {
			if (a === b) return true;
			if (a.length !== b.length) return false;
			return a.every((id, i) => id === b[i]);
		},
	);
}

/* ------------------------------------------------------------------ */
/* 订阅单个消息（Telegram 架构）
 * MessageItem 使用此 hook 订阅单个消息，完全隔离
 * ------------------------------------------------------------------ */

export function useMessage(messageUid: string) {
	return useMessageStore(
		(state) => {
			// ✅ 安全检查：确保 messagesById 存在
			if (!state.messagesById) return undefined;
			return state.messagesById[messageUid];
		},
		// ✅ 浅比较消息对象
		(a, b) => a === b,
	);
}
