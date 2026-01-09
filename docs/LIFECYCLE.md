# Holix AI 应用生命周期流程

## 概述

本文档描述了 Holix AI 应用的完整启动和关闭生命周期，包括性能监控和错误处理机制。

## 生命周期阶段

应用的生命周期分为以下几个阶段：

```
INITIALIZING → STARTING → RUNNING → STOPPING → STOPPED
                    ↓
                  ERROR
```

### 1. INITIALIZING（初始化）

在此阶段，应用会初始化所有核心系统组件。

**执行的任务：**

| 任务 | 描述 | 超时时间 | 是否关键 |
|------|------|----------|----------|
| Wait for Electron ready | 等待 Electron 框架准备就绪 | 10000ms | ✓ |
| Migrate database | 执行数据库迁移 | 5000ms | ✓ |
| Initialize chat module | 初始化聊天模块 | - | ✓ |
| Initialize config store | 初始化配置存储 | 3000ms | ✓ |
| Initialize provider store | 初始化 AI 提供商存储 | 3000ms | ✓ |

### 2. STARTING（启动中）

在此阶段，应用会创建窗口并注册所有路由。

**执行的任务：**

| 任务 | 描述 | 超时时间 | 是否关键 |
|------|------|----------|----------|
| Create application window | 创建应用主窗口 | - | ✓ |
| Register protocol handler | 注册自定义协议处理器 | - | ✓ |
| Register window router | 注册窗口路由 | - | ✓ |
| Show application window | 显示应用窗口 | 10000ms | ✓ |

### 3. RUNNING（运行中）

应用正常运行状态。在此阶段：
- 打印性能报告
- 检测并警告慢任务（>100ms）
- 处理用户交互

### 4. STOPPING（停止中）

当用户关闭应用时触发，执行清理工作。

### 5. STOPPED（已停止）

应用完全关闭。

### 6. ERROR（错误）

如果任何关键任务失败，应用会进入此状态并退出。

## 性能监控

### 自动收集的指标

每个任务执行时，系统会自动收集以下指标：

- **任务名称**：执行的任务标识
- **阶段**：任务所属的生命周期阶段
- **开始时间**：任务开始执行的时间戳
- **结束时间**：任务完成的时间戳
- **持续时间**：任务执行耗时（毫秒）
- **成功状态**：任务是否成功完成
- **错误信息**（如果失败）

### 性能报告

应用启动完成后，会自动打印性能报告：

```
╔════════════════════════════════════════════════════════════╗
║            APPLICATION LIFECYCLE REPORT                   ║
╠════════════════════════════════════════════════════════════╣
║ Total Startup Time: 1234.56ms                             ║
║ Successful Tasks: 9                                       ║
║ Failed Tasks: 0                                           ║
╠════════════════════════════════════════════════════════════╣
║ Task Performance Breakdown:                               ║
╟────────────────────────────────────────────────────────────╢
║ INITIALIZING:                                             ║
║   ✓ Wait for Electron ready                     234.56ms ║
║   ✓ Migrate database                            123.45ms ║
║   ✓ Initialize chat module                       12.34ms ║
║   ✓ Initialize config store                      45.67ms ║
║   ✓ Initialize provider store                    34.56ms ║
║ STARTING:                                                 ║
║   ✓ Create application window                   123.45ms ║
║   ✓ Register protocol handler                     5.67ms ║
║   ✓ Register window router                        3.45ms ║
║   ✓ Show application window                     456.78ms ║
╚════════════════════════════════════════════════════════════╝
```

### 慢任务警告

如果任何任务执行时间超过 100ms，系统会发出警告：

```
[Performance] Found 2 slow task(s) (>100ms):
  - Wait for Electron ready: 234.56ms
  - Show application window: 456.78ms
```

## 错误处理

### 关键任务失败

如果标记为 `critical: true` 的任务失败：
1. 应用立即进入 `ERROR` 阶段
2. 打印错误详情和堆栈跟踪
3. 打印当前的性能报告
4. 退出应用

### 非关键任务失败

如果标记为 `critical: false` 的任务失败：
1. 记录错误到日志
2. 继续执行后续任务

### 任务超时

如果任务执行超过设定的 `timeout` 时间：
1. 抛出超时错误
2. 如果是关键任务，应用退出
3. 如果是非关键任务，继续执行

## 生命周期钩子

可以注册钩子来响应生命周期阶段变化：

```typescript
lifecycle.onPhase(LifecyclePhase.RUNNING, () => {
  console.log('应用现在正在运行')
})

lifecycle.onPhase(LifecyclePhase.STOPPING, () => {
  console.log('应用正在停止')
})

lifecycle.onPhase(LifecyclePhase.ERROR, () => {
  console.log('应用进入错误状态')
})
```

## Electron 事件集成

应用集成了以下 Electron 事件：

### `second-instance`
当用户尝试启动第二个应用实例时，聚焦到现有窗口。

### `window-all-closed`
所有窗口关闭时，将生命周期设置为 STOPPING 并退出（macOS 除外）。

### `activate`
在 macOS 上点击 Dock 图标时，如果没有窗口则创建新窗口。

### `before-quit`
应用退出前，设置生命周期为 STOPPING 并打印性能报告。

### `will-quit`
应用即将退出时，设置生命周期为 STOPPED。

## 为什么这次能成功启动？

之前的问题和解决方案：

### 问题 1: 重复的日志输出
**原因**：第 86 行有重复的 `logger.info('Provider store initialized.')`，误导性地让人以为程序卡住了。

**解决**：移除重复日志，使用生命周期管理器统一管理日志输出。

### 问题 2: Logo 路径导入问题
**原因**：`import logo from 'public/logo.png'` 在 Electron 环境中无法正确解析，导致构造函数抛出异常。

**解决**：改用 `join(process.cwd(), 'public', 'logo.png')` 动态构建路径。

### 问题 3: 缺少详细的调试信息
**原因**：关键步骤之间缺少日志，无法准确定位程序卡在哪里。

**解决**：实现了完整的生命周期管理器，每个任务都有详细的执行日志和性能指标。

### 问题 4: 错误处理不完善
**原因**：某些错误被静默吞掉，没有打印堆栈跟踪。

**解决**：在生命周期管理器中添加了完善的错误处理和超时机制。

## API 文档

### AppLifecycle

#### 构造函数
```typescript
new AppLifecycle()
```

#### 方法

##### `onPhase(phase: LifecyclePhase, hook: LifecycleHook): void`
注册生命周期钩子。

##### `executeTask(task: LifecycleTask): Promise<void>`
执行单个任务并收集性能指标。

##### `executeTasks(tasks: LifecycleTask[]): Promise<void>`
按顺序执行一组任务。

##### `setPhase(phase: LifecyclePhase): Promise<void>`
设置当前生命周期阶段并触发钩子。

##### `getPhase(): LifecyclePhase`
获取当前生命周期阶段。

##### `getPerformanceReport(): string`
获取格式化的性能报告。

##### `printPerformanceReport(): void`
打印性能报告到日志。

##### `getMetrics(): LifecycleMetrics[]`
获取所有性能指标。

##### `getSlowTasks(threshold: number): LifecycleMetrics[]`
获取超过指定阈值的慢任务。

##### `reset(): void`
重置生命周期状态。

### LifecycleTask

```typescript
interface LifecycleTask {
  name: string // 任务名称
  execute: () => Promise<void> | void // 执行函数
  critical?: boolean // 是否为关键任务（默认 true）
  timeout?: number // 超时时间（毫秒）
}
```

### LifecycleMetrics

```typescript
interface LifecycleMetrics {
  taskName: string // 任务名称
  phase: LifecyclePhase // 执行阶段
  startTime: number // 开始时间
  endTime: number // 结束时间
  duration: number // 持续时间（毫秒）
  success: boolean // 是否成功
  error?: Error // 错误信息（如果失败）
}
```

## 最佳实践

1. **始终设置超时**：为可能长时间运行的任务设置合理的超时时间
2. **正确标记关键任务**：只将真正必要的任务标记为 `critical: true`
3. **使用生命周期钩子**：在适当的阶段执行额外的初始化或清理工作
4. **监控慢任务**：定期检查性能报告，优化慢任务
5. **完善错误处理**：在任务的 `execute` 函数中处理预期的错误

## 扩展生命周期

要添加新的初始化任务：

```typescript
await lifecycle.executeTasks([
  // ... 现有任务 ...
  {
    name: 'Initialize new module',
    execute: async () => {
      await newModule.init()
    },
    critical: true,
    timeout: 5000,
  },
])
```

要添加新的生命周期阶段，修改 `LifecyclePhase` 枚举并更新相应的逻辑。
