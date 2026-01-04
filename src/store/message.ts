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
 * Store 定义（Telegram 架构：扁平化存储 + ID 索引）
 * =======================================================*/

interface MessageStore {
	// 扁平化存储：所有消息按 ID 存储
	messagesById: Record<string, Message>;
	// 聊天消息 ID 索引：每个聊天只存储消息 ID 列表
	chatMessageIds: Record<string, string[]>;
	
	isLoading: boolean;
	initialized: boolean;

	/* 冷路径 */
	init(): Promise<void>;
	loadMessages(chatUid: string): Promise<void>;

	/* 热路径 */
	appendMessage(chatUid: string, message: Message): void;
	appendMessages(chatUid: string, messages: Message[]): void;
	
	updateMessage(messageUid: string, updates: Partial<Message>): void;
	
	/* Selectors */
	getMessageById(messageUid: string): Message | undefined;
	getChatMessageIds(chatUid: string): string[];
}

/* =========================================================
 * Store 实现（Telegram 架构：扁平化存储 + ID 索引）
 * =======================================================*/

export const useMessageStore = createWithEqualityFn<MessageStore>()((set, get) => ({
	messagesById: {},
	chatMessageIds: {},
	isLoading: false,
	initialized: false,

	/* ---------- 冷路径 ---------- */

	async init() {
		if (get().initialized) return;

		set({ isLoading: true });

		try {
			const chats = await trpcClient.chat.list();
			const messagesById: Record<string, Message> = {};
			const chatMessageIds: Record<string, string[]> = {};

			await Promise.all(
				chats.map(async (chat) => {
					const msgs = await trpcClient.message.getByChatUid({
						chatUid: chat.uid,
						limit: 200,
						order: "asc",
					});

					const sorted = sortMessagesBySeqAscCold(msgs);
					
					// 扁平化存储消息
					sorted.forEach((msg) => {
						messagesById[msg.uid] = msg;
					});
					
					// 存储消息 ID 列表
					chatMessageIds[chat.uid] = sorted.map((msg) => msg.uid);
				}),
			);

			set({
				messagesById,
				chatMessageIds,
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

			const sorted = sortMessagesBySeqAscCold(msgs);

			set((state) => {
				const newMessagesById = { ...state.messagesById };
				
				// 扁平化存储消息
				sorted.forEach((msg) => {
					newMessagesById[msg.uid] = msg;
				});

				return {
					messagesById: newMessagesById,
					chatMessageIds: {
						...state.chatMessageIds,
						[chatUid]: sorted.map((msg) => msg.uid),
					},
					isLoading: false,
				};
			});
		} catch (err) {
			console.error("[message-store] loadMessages failed", err);
			set({ isLoading: false });
		}
	},

	/* ---------- 热路径（不允许排序） ---------- */

	appendMessage(chatUid, message) {
		set((state) => {
			// ✅ 安全检查
			if (!state.chatMessageIds || !state.messagesById) return state;
			
			const currentIds = state.chatMessageIds[chatUid] || [];

			// 防重复
			if (currentIds.includes(message.uid)) {
				return state;
			}

			// ✅ 关键优化：messagesById 更新不影响 chatMessageIds 数组引用
			return {
				...state,
				messagesById: {
					...state.messagesById,
					[message.uid]: message,
				},
				chatMessageIds: {
					...state.chatMessageIds,
					[chatUid]: [...currentIds, message.uid],
				},
			};
		});
	},

	appendMessages(chatUid, messages) {
		if (messages.length === 0) return;

		set((state) => {
			// ✅ 安全检查
			if (!state.chatMessageIds || !state.messagesById) return state;
			
			const currentIds = state.chatMessageIds[chatUid] || [];
			const existingSet = new Set(currentIds);

			const incoming = messages.filter((m) => !existingSet.has(m.uid));

			if (incoming.length === 0) return state;

			const newMessagesById = { ...state.messagesById };
			incoming.forEach((msg) => {
				newMessagesById[msg.uid] = msg;
			});

			return {
				...state,
				messagesById: newMessagesById,
				chatMessageIds: {
					...state.chatMessageIds,
					[chatUid]: [...currentIds, ...incoming.map((m) => m.uid)],
				},
			};
		});
	},

	// ✅ 关键改进：只需要 messageUid，不需要 chatUid
	updateMessage(messageUid, updates) {
		set((state) => {
			// ✅ 安全检查
			if (!state.messagesById) return state;
			
			const existingMessage = state.messagesById[messageUid];
			if (!existingMessage) return state;

			// ✅ 只更新 messagesById，chatMessageIds 数组引用完全不变！
			return {
				...state,
				messagesById: {
					...state.messagesById,
					[messageUid]: {
						...existingMessage,
						...updates,
					},
				},
			};
		});
	},

	/* ---------- Selectors ---------- */

	getMessageById(messageUid) {
		return get().messagesById[messageUid];
	},

	getChatMessageIds(chatUid) {
		return get().chatMessageIds[chatUid] || [];
	},
}));
