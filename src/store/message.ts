import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { trpcClient } from "@/lib/trpc-client";
import type { Message } from "@/node/database/schema/chat";

/* =========================================================
 * 冷路径工具：消息排序（只允许 init / load 使用）
 * =======================================================*/

/**
 * 冷路径：按 seq 升序排序消息
 * ⚠️ 禁止在实时更新 / stream 路径中使用
 */
function sortMessagesBySeqAscCold(messages: readonly Message[]): Message[] {
	if (messages.length <= 1) return messages.slice();
	return [...messages].sort((a, b) => a.seq - b.seq);
}

/* =========================================================
 * Store 定义
 * =======================================================*/

interface MessageStore {
	messagesByChatId: Record<string, Message[]>;
	isLoading: boolean;
	initialized: boolean;

	/* 冷路径 */
	init(): Promise<void>;
	loadMessages(chatUid: string): Promise<void>;

	/* 热路径 */
	appendMessage(chatUid: string, message: Message): void;
	appendMessages(chatUid: string, messages: Message[]): void;
	prependMessages(chatUid: string, messages: Message[]): void;

	updateMessage(
		chatUid: string,
		messageUid: string,
		updates: Partial<Message>,
	): void;
}

/* =========================================================
 * Store 实现（Virtuoso / AI Chat 特化）
 * =======================================================*/

export const useMessageStore = createWithEqualityFn<MessageStore>()(
	(set, get) => ({
		messagesByChatId: {},
		isLoading: false,
		initialized: false,

		/* ---------- 冷路径 ---------- */

		async init() {
			if (get().initialized) return;

			set({ isLoading: true });

			try {
				const chats = await trpcClient.chat.list();
				const messagesByChatId: Record<string, Message[]> = {};

				await Promise.all(
					chats.map(async (chat) => {
						const msgs = await trpcClient.message.getByChatUid({
							chatUid: chat.uid,
							limit: 200,
							order: "asc",
						});

						// ✅ 冷路径排序
						messagesByChatId[chat.uid] = sortMessagesBySeqAscCold(msgs);
					}),
				);

				set({
					messagesByChatId,
					initialized: true,
					isLoading: false,
				});
			} catch (err) {
				console.error("[message-store] init failed", err);
				set({ isLoading: false });
			}
		},

		async loadMessages(chatUid) {
			set({ isLoading: true });

			try {
				const msgs = await trpcClient.message.getByChatUid({
					chatUid,
					limit: 200,
					order: "asc",
				});

				set((state) => ({
					messagesByChatId: {
						...state.messagesByChatId,
						// ✅ 冷路径排序
						[chatUid]: sortMessagesBySeqAscCold(msgs),
					},
					isLoading: false,
				}));
			} catch (err) {
				console.error("[message-store] loadMessages failed", err);
				set({ isLoading: false });
			}
		},

		/* ---------- 热路径（不允许排序） ---------- */

		appendMessage(chatUid, message) {
			set((state) => {
				const current = state.messagesByChatId[chatUid] || [];

				// 防重复
				if (current.some((m) => m.uid === message.uid)) {
					return state;
				}

				return {
					messagesByChatId: {
						...state.messagesByChatId,
						[chatUid]: [...current, message], // ❌ 不排序
					},
				};
			});
		},

		appendMessages(chatUid, messages) {
			if (messages.length === 0) return;

			set((state) => {
				const current = state.messagesByChatId[chatUid] || [];
				const existing = new Set(current.map((m) => m.uid));

				const incoming = messages.filter((m) => !existing.has(m.uid));

				if (incoming.length === 0) return state;

				return {
					messagesByChatId: {
						...state.messagesByChatId,
						[chatUid]: [...current, ...incoming], // ❌ 不排序
					},
				};
			});
		},

		prependMessages(chatUid, messages) {
			if (messages.length === 0) return;

			set((state) => {
				const current = state.messagesByChatId[chatUid] || [];

				return {
					messagesByChatId: {
						...state.messagesByChatId,
						[chatUid]: [...messages, ...current], // ❌ 不排序
					},
				};
			});
		},

		updateMessage(chatUid, messageUid, updates) {
			set((state) => {
				const current = state.messagesByChatId[chatUid];
				if (!current) return state;

				const index = current.findIndex((m) => m.uid === messageUid);
				if (index === -1) return state;

				const next = [...current];
				next[index] = {
					...next[index],
					...updates,
				};

				console.log(
					"[message-store] updateMessage",
					chatUid,
					messageUid,
					updates,
					next[index],
				);

				return {
					messagesByChatId: {
						...state.messagesByChatId,
						// ✅ index 稳定，Virtuoso 友好
						[chatUid]: next,
					},
				};
			});
		},
	}),
	shallow,
);
