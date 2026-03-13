# Update 事件类型扩展

## 问题描述

在实现 `ChatEventEmitter` 时，发现 `update()` 函数的第一个参数类型受到限制，缺少以下事件类型：

1. `message.deleted` - 消息删除事件
2. `chat.created` - 会话创建事件

同时发现 `chat.updated` 事件的 payload 类型不正确。

## 错误信息

```typescript
// src/node/chat/events/chat-event-emitter.ts

update('message.deleted', { chatUid, messageUid })
// ❌ 类型""message.deleted""的参数不能赋给类型 UpdateNames 的参数

update('chat.created', { chatUid })
// ❌ 类型""chat.created""的参数不能赋给类型 UpdateNames 的参数

update('chat.updated', { chatUid, updates })
// ❌ payload 类型不匹配
```

## 根本原因

`UpdateNames` 类型是从 `Update` 联合类型中提取的：

```typescript
// src/types/updates/index.ts
export type Update = ChatEnvelope | WindowUpdateEnvelope | ChatUpdateEnvelope | AutoUpdateEnvelope
export type UpdateNames = Update['name']
```

而 `ChatEnvelope` 和 `ChatUpdateEnvelope` 中缺少相应的事件类型定义。

## 解决方案

### 1. 扩展 ChatUpdateEnvelope（消息事件）

**文件**: `src/types/updates/message.ts`

```typescript
/**
 * 消息删除事件
 */
export type MessageDeletedEnvelope = EventEnvelope<
  'message.deleted',
  {
    chatUid: string
    messageUid: string
  }
>

export type ChatUpdateEnvelope
  = | MessageCreatedEnvelope
    | MessageStreamingEnvelope
    | MessageUpdatedEnvelope
    | MessageStreamStartEnvelope
    | MessageStreamChunkEnvelope
    | MessageStreamDoneEnvelope
    | MessageStreamErrorEnvelope
    | MessageDeletedEnvelope  // ✅ 新增
```

### 2. 扩展 ChatEnvelope（会话事件）

**文件**: `src/types/updates/chat.ts`

```typescript
/**
 * 会话创建事件（新增）
 */
export type ChatCreatedEnvelope = EventEnvelope<
  'chat.created',
  { chatUid: string }
>

/**
 * 会话更新事件（修复 payload 类型）
 */
export type ChatUpdatedEnvelope = EventEnvelope<
  'chat.updated',
  {
    chatUid: string
    updates: Record<string, any>  // ✅ 修复：不是完整的 Chat 对象
  }
>

export type ChatEnvelope =
  | CreateChatEnvelope
  | ChatCreatedEnvelope  // ✅ 新增
  | ChatUpdatedEnvelope
  | ChatDeletedEnvelope
```

## 事件类型完整列表

### 消息事件（ChatUpdateEnvelope）

| 事件名 | Payload | 说明 |
|--------|---------|------|
| `message.created` | `{ chatUid, message }` | 消息创建 |
| `message.streaming` | `{ chatUid, messageUid, content, delta, ... }` | 流式更新 |
| `message.updated` | `{ chatUid, messageUid, updates }` | 消息更新 |
| `message.deleted` | `{ chatUid, messageUid }` | 消息删除 ✅ 新增 |
| `message.stream.start` | `{ chatUid, messageUid, requestId, model }` | 流开始 |
| `message.stream.chunk` | `{ chatUid, messageUid, requestId, segment }` | 流片段 |
| `message.stream.done` | `{ chatUid, messageUid, requestId, finalContent }` | 流完成 |
| `message.stream.error` | `{ chatUid, messageUid, requestId, error }` | 流错误 |

### 会话事件（ChatEnvelope）

| 事件名 | Payload | 说明 |
|--------|---------|------|
| `chat.create` | `Chat` | 会话创建（完整对象） |
| `chat.created` | `{ chatUid }` | 会话创建通知 ✅ 新增 |
| `chat.updated` | `{ chatUid, updates }` | 会话更新 ✅ 修复 |
| `chat.deleted` | `{ uid }` | 会话删除 |

## 渲染层处理

这些事件会通过 `update()` 函数发送到渲染进程，渲染层需要监听这些事件：

```typescript
// 前端监听示例
useEffect(() => {
  // 监听消息删除
  const unsubscribe1 = onUpdate('message.deleted', ({ chatUid, messageUid }) => {
    // 从 UI 中移除消息
    removeMessageFromUI(chatUid, messageUid)
  })

  // 监听会话创建
  const unsubscribe2 = onUpdate('chat.created', ({ chatUid }) => {
    // 刷新会话列表或导航到新会话
    refreshChatList()
  })

  // 监听会话更新
  const unsubscribe3 = onUpdate('chat.updated', ({ chatUid, updates }) => {
    // 更新会话信息
    updateChatInUI(chatUid, updates)
  })

  return () => {
    unsubscribe1()
    unsubscribe2()
    unsubscribe3()
  }
}, [])
```

## 验证结果

### 类型检查
```bash
pnpm type-check
# ✅ 0 个错误
```

### 单元测试
```bash
pnpm test src/node/chat
# ✅ 120/120 测试通过
```

### ChatEventEmitter 使用
```typescript
// src/node/chat/events/chat-event-emitter.ts

// ✅ 现在可以正常使用
chatEventEmitter.emitMessageDeleted(chatUid, messageUid)
chatEventEmitter.emitChatCreated(chatUid)
chatEventEmitter.emitChatUpdated(chatUid, { title: 'New Title' })
```

## 影响范围

### 主进程（Node）
- ✅ `ChatEventEmitter` 可以发射所有事件
- ✅ 类型安全，编译时检查

### 渲染进程（React）
- ⚠️ 需要添加对应的事件监听器
- ⚠️ 需要处理新增的事件类型

## 后续工作

1. **前端事件监听**
   - 在 `src/hooks/chat.ts` 中添加 `message.deleted` 监听
   - 在 `src/store/chat.ts` 中添加 `chat.created` 监听
   - 更新 `chat.updated` 的处理逻辑

2. **文档更新**
   - 更新事件系统文档
   - 添加事件监听示例

3. **测试覆盖**
   - 添加 `ChatEventEmitter` 的单元测试
   - 添加端到端的事件流测试

## 提交记录

```bash
12d266a fix(types): extend update event types for chat events
        - Add MessageDeletedEnvelope for message.deleted event
        - Add ChatCreatedEnvelope for chat.created event
        - Fix ChatUpdatedEnvelope payload type
        - All type checks passing
        - All tests passing (120/120)
```

---

**总结**: 通过扩展 `ChatUpdateEnvelope` 和 `ChatEnvelope` 类型，解决了 `update()` 函数的类型限制问题，使 `ChatEventEmitter` 可以正常发射所有需要的事件。
