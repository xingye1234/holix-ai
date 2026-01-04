import { create } from "zustand";
import { trpcClient } from "@/lib/trpc-client";
import type { Chat } from "@/node/database/schema/chat";

interface ChatStore {
	chats: Chat[];
	isLoading: boolean;
	initialized: boolean;
	// 初始化
	init: () => Promise<void>;
	// 加载所有会话
	loadChats: () => Promise<void>;
	// 创建新会话
	createChat: (params: {
		provider: string;
		model: string;
		title: string;
	}) => Promise<Chat | null>;
	// 添加会话到列表
	addChat: (chat: Chat) => void;
	// 更新会话
	updateChat: (chatUid: string, updates: Partial<Chat>) => void;
}

const useChat = create<ChatStore>((set, get) => {
	return {
		chats: [],
		isLoading: false,
		initialized: false,

		init: async () => {
			if (get().initialized) return;
			
			try {
				set({ isLoading: true });
				const chats = await trpcClient.chat.list();
				set({ chats, isLoading: false, initialized: true });
			} catch (error) {
				console.error("Failed to load chats:", error);
				set({ isLoading: false });
			}
		},

		loadChats: async () => {
			try {
				set({ isLoading: true });
				const chats = await trpcClient.chat.list();
				set({ chats, isLoading: false });
			} catch (error) {
				console.error("Failed to load chats:", error);
				set({ isLoading: false });
			}
		},

		createChat: async (params: {
			provider: string;
			model: string;
			title: string;
		}) => {
			try {
				set({ isLoading: true });
				const chat = await trpcClient.chat.create(params);

				// 添加到列表
				set((state) => ({
					chats: [chat, ...state.chats],
					isLoading: false,
				}));

				return chat;
			} catch (error) {
				console.error("Failed to create chat:", error);
				set({ isLoading: false });
				return null;
			}
		},

		addChat: (chat: Chat) => {
			set((state) => {
				// 检查是否已存在，避免重复添加
				if (state.chats.some(c => c.uid === chat.uid)) {
					return state;
				}
				return {
					chats: [chat, ...state.chats],
				};
			});
		},

		updateChat: (chatUid: string, updates: Partial<Chat>) => {
			set((state) => {
				const index = state.chats.findIndex((c) => c.uid === chatUid);
				if (index === -1) return state;

				// ✅ 只修改目标 chat 对象，其他 chat 引用保持不变
				const newChats = [...state.chats];
				newChats[index] = {
					...state.chats[index],
					...updates,
				};

				return {
					chats: newChats,
				};
			});
		},
	};
});

export default useChat;
