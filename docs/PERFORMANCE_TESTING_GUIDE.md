# 性能测试指南

## 如何验证优化效果

### 1. 使用 React DevTools Profiler

#### 步骤
1. 安装 React DevTools 浏览器扩展
2. 打开应用，进入聊天页面
3. 打开 DevTools，切换到 "Profiler" 标签
4. 点击 "Record" 开始记录
5. 发送一条消息，等待 AI 回复（流式输出）
6. 点击 "Stop" 停止记录
7. 查看 Flamegraph 和 Ranked 视图

#### 期望结果（优化后）
- **流式更新时**：只有 1 个 MessageItem 组件高亮（正在更新的消息）
- **渲染时间**：每次更新 < 16ms (60fps)
- **重渲染次数**：MessageItem[index] 只在该消息变化时重渲染

#### 对比（优化前 vs 优化后）

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 每次 delta 重渲染组件数 | 200+ | 1 |
| 每次 delta 渲染时间 | 50-100ms | < 5ms |
| 帧率 | 10-20 fps | 60 fps |
| Chat 更新触发组件数 | 所有组件 | 0-1 |

### 2. 在控制台查看调试日志

优化后的代码已移除大部分调试日志，如需验证可临时添加：

```typescript
// src/views/main/content.tsx
export const MainContent = memo(function MainContent() {
  console.log('[MainContent] Render'); // 应该只在初始化和 chat 切换时打印
  // ...
});

// src/views/main/message-item.tsx
export const MessageItem = memo(function MessageItem({ message, index }: MessageItemProps) {
  console.log('[MessageItem] Render', index, message.uid); // 只在该消息变化时打印
  // ...
});
```

#### 期望输出
```
# 初始加载
[MainContent] Render
[MessageItem] Render 0 msg-001
[MessageItem] Render 1 msg-002
...
[MessageItem] Render 199 msg-200

# 流式更新（只有最后一条消息更新）
[MessageItem] Render 199 msg-200
[MessageItem] Render 199 msg-200
[MessageItem] Render 199 msg-200
...

# Chat 更新（如果 chat 引用未变，MainContent 不会重渲染）
(无日志输出)
```

### 3. 使用 Chrome Performance

#### 步骤
1. 打开 Chrome DevTools
2. 切换到 "Performance" 标签
3. 点击 "Record"
4. 发送消息，等待流式输出完成
5. 点击 "Stop"
6. 分析 Main Thread 活动

#### 期望结果
- **帧率**：稳定在 60 fps
- **Scripting 时间**：每次更新 < 5ms
- **无长任务**：没有超过 50ms 的任务
- **无布局抖动**：Layout/Paint 时间稳定

### 4. 内存泄漏检查

#### 步骤
1. 打开 Chrome DevTools Memory 标签
2. 创建多个聊天，发送大量消息
3. 切换聊天，删除聊天
4. 拍摄 Heap Snapshot
5. 检查是否有未释放的 DOM 节点或监听器

#### 期望结果
- 删除聊天后，相关消息和组件被 GC 回收
- 无 detached DOM 节点累积
- Event Listener 正确清理

## 性能测试场景

### 场景 1：大量消息的流式输出

**条件**：
- 已有 200 条历史消息
- 发送新消息，AI 回复 500 字内容

**验证点**：
1. 流式输出期间帧率稳定 60fps
2. 只有最后一条消息更新
3. 滚动流畅，无卡顿
4. CPU 使用率 < 30%

### 场景 2：快速连续发送消息

**条件**：
- 快速发送 5 条消息
- 每条消息都触发 AI 回复

**验证点**：
1. 每条消息独立渲染，互不干扰
2. 没有消息丢失或重复
3. UI 响应流畅
4. 内存占用稳定

### 场景 3：切换聊天

**条件**：
- 在两个聊天之间快速切换
- 每个聊天有 100+ 条消息

**验证点**：
1. 切换速度 < 100ms
2. 消息列表正确加载
3. 滚动位置正确（底部）
4. 无闪烁或布局跳动

### 场景 4：长时间运行

**条件**：
- 应用运行 30 分钟
- 期间发送 50+ 条消息
- 收到 50+ 条 AI 回复

**验证点**：
1. 内存占用稳定，无泄漏
2. 性能不随时间降低
3. 所有功能正常
4. 无崩溃或卡死

## 性能基准

### 硬件参考
- **CPU**: Intel i5 或同等性能
- **内存**: 8GB
- **显示器**: 1920x1080 @ 60Hz

### 性能目标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 初始加载时间 | < 500ms | 首次进入聊天页面 |
| 流式更新帧率 | 60 fps | 持续稳定 |
| 消息渲染时间 | < 5ms | 单个组件 |
| 切换聊天延迟 | < 100ms | 用户感知 |
| 内存增长率 | < 1MB/min | 长时间运行 |
| CPU 占用 | < 30% | 流式输出时 |

## 回归测试检查清单

在修改相关代码后，确认以下功能正常：

- [ ] 消息正确显示（用户/助手/系统）
- [ ] 流式输出正常工作
- [ ] 消息状态正确（pending/streaming/done/error）
- [ ] 滚动自动跟随最新消息
- [ ] 历史消息加载（向上滚动）
- [ ] 切换聊天正常
- [ ] 创建新聊天正常
- [ ] 消息编辑/删除正常
- [ ] 代码高亮正常
- [ ] Markdown 渲染正常
- [ ] 复制消息功能正常
- [ ] 重新生成功能正常

## 常见性能问题排查

### 问题：MainContent 仍在重渲染

**可能原因**：
1. ChatContext value 频繁变化
2. chat 对象引用不稳定
3. useChatMessages 返回新数组引用

**排查**：
```typescript
// 在 $id.tsx 中添加日志
useEffect(() => {
  console.log('[Chat] Changed', chat);
}, [chat]);

// 在 content.tsx 中添加日志
useEffect(() => {
  console.log('[Messages] Changed', messages);
}, [messages]);
```

### 问题：MessageItem 过度重渲染

**可能原因**：
1. message 对象引用频繁变化
2. 父组件传递新的 props
3. 使用了非稳定的 callback

**排查**：
```typescript
// 使用 why-did-you-render
import whyDidYouRender from '@welldone-software/why-did-you-render';

whyDidYouRender(React, {
  trackAllPureComponents: true,
});

// MessageItem.whyDidYouRender = true;
```

### 问题：内存持续增长

**可能原因**：
1. 事件监听器未清理
2. Zustand store 累积数据
3. React 组件未卸载

**排查**：
- 使用 Chrome Memory Profiler
- 检查 useEffect 的 cleanup 函数
- 确认组件正确卸载

## 优化建议

### 已实现的优化 ✅
- Immer structural sharing
- React.memo
- Shallow comparison
- RAF batching（后端）
- 节流数据库更新

### 可选的进一步优化 💡
1. **虚拟滚动优化**
   - 调整 Virtuoso 的 `increaseViewportBy`
   - 使用 `overscan` 减少白屏

2. **代码分割**
   - 懒加载 Markdown 组件
   - 懒加载代码高亮库

3. **Web Worker**
   - 将 Markdown 解析移到 Worker
   - 后台处理搜索索引

4. **数据预加载**
   - 预加载相邻聊天的消息
   - Service Worker 缓存

---

**最后更新**: 2026-01-04  
**测试版本**: v2.0
