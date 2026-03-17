import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MessageSelectionStore {
  /** 选中的消息ID集合 */
  selectedMessageIds: Set<string>
  /** 是否处于选择模式 */
  isSelectionMode: boolean
  /** 切换选择模式 */
  toggleSelectionMode: () => void
  /** 开启选择模式 */
  enableSelectionMode: () => void
  /** 关闭选择模式并清空选择 */
  disableSelectionMode: () => void
  /** 选择/取消选择消息 */
  toggleMessageSelection: (messageId: string) => void
  /** 选择消息 */
  selectMessage: (messageId: string) => void
  /** 取消选择消息 */
  deselectMessage: (messageId: string) => void
  /** 选择所有消息 */
  selectAllMessages: (messageIds: string[]) => void
  /** 清空所有选择 */
  clearSelection: () => void
  /** 删除选中的消息 */
  removeSelectedMessages: (messageIds: string[]) => void
  /** 检查消息是否被选中 */
  isMessageSelected: (messageId: string) => boolean
  /** 获取选中消息的数量 */
  getSelectedCount: () => number
}

const useMessageSelection = create<MessageSelectionStore>()(
  persist(
    (set, get) => ({
      selectedMessageIds: new Set<string>(),
      isSelectionMode: false,

      toggleSelectionMode: () =>
        set(state => {
          if (state.isSelectionMode) {
            // 关闭选择模式，清空选择
            return {
              isSelectionMode: false,
              selectedMessageIds: new Set<string>(),
            }
          }
          // 开启选择模式
          return { isSelectionMode: true }
        }),

      enableSelectionMode: () => set({ isSelectionMode: true }),

      disableSelectionMode: () =>
        set({
          isSelectionMode: false,
          selectedMessageIds: new Set<string>(),
        }),

      toggleMessageSelection: messageId =>
        set(state => {
          const newSet = new Set(state.selectedMessageIds)
          if (newSet.has(messageId)) {
            newSet.delete(messageId)
            // 如果没有选中的消息了，自动关闭选择模式
            if (newSet.size === 0) {
              return {
                selectedMessageIds: newSet,
                isSelectionMode: false,
              }
            }
          }
          else {
            newSet.add(messageId)
          }
          return { selectedMessageIds: newSet }
        }),

      selectMessage: messageId =>
        set(state => {
          const newSet = new Set(state.selectedMessageIds)
          newSet.add(messageId)
          return { selectedMessageIds: newSet }
        }),

      deselectMessage: messageId =>
        set(state => {
          const newSet = new Set(state.selectedMessageIds)
          newSet.delete(messageId)
          // 如果没有选中的消息了，自动关闭选择模式
          if (newSet.size === 0) {
            return {
              selectedMessageIds: newSet,
              isSelectionMode: false,
            }
          }
          return { selectedMessageIds: newSet }
        }),

      selectAllMessages: messageIds =>
        set({ selectedMessageIds: new Set(messageIds) }),

      clearSelection: () =>
        set({
          selectedMessageIds: new Set<string>(),
          // 不自动关闭选择模式，允许用户继续选择
        }),

      removeSelectedMessages: messageIds =>
        set(state => {
          const newSet = new Set(state.selectedMessageIds)
          messageIds.forEach(id => newSet.delete(id))
          // 如果没有选中的消息了，自动关闭选择模式
          if (newSet.size === 0) {
            return {
              selectedMessageIds: newSet,
              isSelectionMode: false,
            }
          }
          return { selectedMessageIds: newSet }
        }),

      isMessageSelected: messageId => get().selectedMessageIds.has(messageId),

      getSelectedCount: () => get().selectedMessageIds.size,
    }),
    {
      name: 'holix-message-selection',
      // 只持久化选择模式状态，不持久化具体选中的消息（因为每次对话不同）
      partialize: state => ({
        isSelectionMode: state.isSelectionMode,
      }),
    },
  ),
)

export default useMessageSelection
