import type { Message } from '@/node/database/schema/chat'
import { create } from 'zustand'
import { trpcClient } from '@/lib/trpc-client'

/* =========================================================
 * 类型定义
 * ======================================================= */

type Seq = number

interface Range {
  from: Seq
  to: Seq
}

interface ChatCache {
  /** seq -> message */
  messagesBySeq: Record<Seq, Message>

  /** 已经完整加载的连续区间 */
  ranges: Range[]
}

interface MessageStore {
  /** chatUid -> ChatCache */
  chats: Record<string, ChatCache>

  /**
   * 获取指定区间的消息
   * - 若内存中缺失，会自动从主线程补齐
   * - 返回结果按 seq 升序
   */
  getRange: (chatUid: string, range?: Range) => Promise<Message[]>
}

/* =========================================================
 * 区间工具函数
 * ======================================================= */

/**
 * 计算 [need] 中哪些区间尚未被 [loaded] 覆盖
 */
function diffRanges(
  loaded: Range[],
  need: Range,
): Range[] {
  let missing: Range[] = [{ ...need }]

  for (const r of loaded) {
    missing = missing.flatMap((m) => {
      // 完全无交集
      if (r.to < m.from || r.from > m.to)
        return [m]

      const res: Range[] = []
      if (m.from < r.from)
        res.push({ from: m.from, to: r.from - 1 })
      if (m.to > r.to)
        res.push({ from: r.to + 1, to: m.to })
      return res
    })
  }

  return missing
}

/**
 * 合并重叠或相邻的区间
 */
function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0)
    return []

  const sorted = [...ranges].sort((a, b) => a.from - b.from)
  const result: Range[] = [sorted[0]]

  for (const r of sorted.slice(1)) {
    const last = result[result.length - 1]
    if (r.from <= last.to + 1) {
      last.to = Math.max(last.to, r.to)
    }
    else {
      result.push({ ...r })
    }
  }

  return result
}

/* =========================================================
 * 主线程 RPC 适配：向上分页加载区间
 * ======================================================= */

/**
 * 使用 beforeSeq + limit + desc
 * 将 [from, to] 区间完整加载进内存
 */
async function loadOlderRange(
  chatUid: string,
  from: Seq,
  to: Seq,
  chat: ChatCache,
) {
  // beforeSeq 是「小于等于」，所以从 to + 1 开始
  let cursor = to + 1

  while (cursor > from) {
    const messages = await trpcClient.message.getByChatUid({
      chatUid,
      beforeSeq: cursor,
      limit: 30,
      order: 'desc',
    })

    if (messages.length === 0)
      break

    for (const msg of messages) {
      // 同一条消息只写入一次
      if (!chat.messagesBySeq[msg.seq]) {
        chat.messagesBySeq[msg.seq] = msg
      }
    }

    // desc 排序下，最后一条是最小 seq
    const minSeq = messages[messages.length - 1].seq
    cursor = minSeq

    if (minSeq <= from)
      break
  }

  // 合并已加载区间
  chat.ranges = mergeRanges([
    ...chat.ranges,
    { from, to },
  ])
}

/* =========================================================
 * Store 实现（消息内存仓库）
 * ======================================================= */

export const useMessageStore = create<MessageStore>((set, get) => ({
  chats: {},

  async getRange(chatUid, range) {
    let chat = get().chats[chatUid]

    // 初始化 chat cache
    if (!chat) {
      chat = {
        messagesBySeq: {},
        ranges: [],
      }

      set(state => ({
        chats: {
          ...state.chats,
          [chatUid]: chat!,
        },
      }))
    }

    if (!range) {
      const messages = await trpcClient.message.getLatest({ chatUid, limit: 20 })
      messages.forEach(msg => (chat.messagesBySeq[msg.seq] = msg))
      // 更新 ranges
      const minSeq = messages.length > 0 ? messages[0].seq : 0
      const maxSeq = messages.length > 0 ? messages[messages.length - 1].seq : 0
      chat.ranges.push({ from: minSeq, to: maxSeq })
      // 写回 store
      set(state => ({
        chats: {
          ...state.chats,
          [chatUid]: chat,
        },
      }))
      return messages
    }

    // 找出缺失的区间
    const missingRanges = diffRanges(chat.ranges, range)

    // 逐段补齐
    for (const r of missingRanges) {
      await loadOlderRange(chatUid, r.from, r.to, chat)
    }

    // 从内存中按 seq 顺序取出
    const result: Message[] = []
    for (let seq = range.from; seq <= range.to; seq++) {
      const msg = chat.messagesBySeq[seq]
      if (msg)
        result.push(msg)
    }

    return result
  },
}))
