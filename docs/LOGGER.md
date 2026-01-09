# Logger 配置说明

## 概述

应用使用 `electron-log` 进行日志管理，支持开发和生产环境的不同配置。

## 日志路径

### 开发模式
```
<project-root>/.holixai/logs/
├── main.log              # 主进程日志
└── archive/              # 归档日志
    ├── main-2026-01-10.log
    └── main-2026-01-09.log
```

### 生产模式

**Windows:**
```
C:\Users\<username>\AppData\Roaming\<appName>\logs\
├── main.log
└── archive/
```

**macOS:**
```
~/Library/Logs/<appName>/
├── main.log
└── archive/
```

**Linux:**
```
~/.config/<appName>/logs/
├── main.log
└── archive/
```

## 日志级别

### 开发模式
- 文件日志级别：`debug`
- 控制台日志级别：`debug`
- 显示所有级别的日志

### 生产模式
- 文件日志级别：`info`
- 控制台日志级别：`info`
- 只记录 info、warn、error 级别

## 日志级别说明

| 级别 | 说明 | 使用场景 |
|------|------|----------|
| `error` | 错误 | 应用错误、异常 |
| `warn` | 警告 | 潜在问题、性能警告 |
| `info` | 信息 | 重要的业务日志 |
| `verbose` | 详细 | 详细的操作日志 |
| `debug` | 调试 | 调试信息、变量值 |
| `silly` | 琐碎 | 非常详细的调试信息 |

## 日志格式

### 文件日志格式
```
[2026-01-10 12:34:56.789] [info] Application started
[2026-01-10 12:34:56.790] [debug] Loading configuration
[2026-01-10 12:34:56.791] [error] Failed to connect: timeout
```

### 控制台日志格式
```
12:34:56.789 > Application started
12:34:56.790 > Loading configuration
12:34:56.791 > Failed to connect: timeout
```

## 日志文件管理

### 文件大小限制
- 最大单个日志文件大小：10MB
- 超过限制后自动归档

### 归档策略
- 归档文件命名：`main-YYYY-MM-DD.log`
- 归档位置：`logs/archive/`
- 自动按日期归档旧日志

## 使用方法

### 基本用法

```typescript
import { logger } from './platform/logger'

// 不同级别的日志
logger.error('发生错误', error)
logger.warn('性能警告', { duration: 1000 })
logger.info('应用启动完成')
logger.verbose('详细操作日志')
logger.debug('调试信息', { userId: 123 })
```

### 带标签的日志

```typescript
// 使用标签分类日志
logger.info('[Database] Connection established')
logger.info('[Auth] User logged in:', username)
logger.error('[Network] Request failed:', error)
```

### 结构化日志

```typescript
// 记录对象
logger.info('User action:', {
  action: 'login',
  userId: 123,
  timestamp: Date.now()
})

// 记录错误堆栈
try {
  // some code
}
catch (error) {
  logger.error('Operation failed:', error)
  logger.error('Stack trace:', error.stack)
}
```

### 生命周期日志示例

```typescript
// 启动日志
logger.info('[Lifecycle] ═══════════════════════════════════════════')
logger.info('[Lifecycle] Phase: INITIALIZING (+0ms)')
logger.info('[Lifecycle] ═══════════════════════════════════════════')

// 任务执行日志
logger.info('[Lifecycle] Executing task: Initialize database')
logger.info('[Lifecycle] ✓ Task completed: Initialize database (123.45ms)')

// 性能日志
logger.warn('[Performance] Slow task detected: Load config (234ms)')
```

## 错误处理

### 未捕获的错误

应用会自动捕获并记录所有未处理的错误：

```typescript
// 自动捕获
throw new Error('Uncaught error')
// 会自动记录到日志文件中

// 未处理的 Promise 拒绝
Promise.reject(new Error('Unhandled rejection'))
// 也会被自动记录
```

### 手动错误记录

```typescript
try {
  await riskyOperation()
}
catch (error) {
  logger.error('[Operation] Failed:', error)
  logger.error('[Operation] Error details:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  })
}
```

## 启动日志

应用启动时会自动记录系统信息：

```
============================================================
Logger initialized
Environment: Development
Log path: D:/projects/holix-ai/.holixai/logs
App version: 1.0.0
Electron version: 28.0.0
Node version: 18.17.0
Platform: win32 x64
============================================================
```

## 最佳实践

### 1. 使用适当的日志级别

```typescript
// ✅ 好的做法
logger.info('[App] Application started successfully')
logger.error('[Database] Connection failed:', error)
logger.debug('[Cache] Cache hit:', { key, value })

// ❌ 避免
logger.error('App started') // 不是错误
logger.info(JSON.stringify(hugeObject)) // 太详细
```

### 2. 添加上下文信息

```typescript
// ✅ 好的做法
logger.error('[API] Request failed:', {
  endpoint: '/api/users',
  method: 'POST',
  statusCode: 500,
  error: error.message
})

// ❌ 避免
logger.error('Request failed')
```

### 3. 使用一致的标签格式

```typescript
// ✅ 好的做法
logger.info('[Module] Message')
logger.info('[Component:Action] Message')

// 建议的标签：
// [Lifecycle], [Database], [Auth], [Network], [UI], [Performance]
```

### 4. 避免敏感信息

```typescript
// ❌ 危险 - 不要记录敏感信息
logger.info('User logged in:', {
  password: user.password, // ❌
  apiKey: config.apiKey, // ❌
  token: authToken // ❌
})

// ✅ 安全做法
logger.info('User logged in:', {
  userId: user.id,
  username: user.username,
  timestamp: Date.now()
})
```

### 5. 性能考虑

```typescript
// ❌ 避免在循环中记录大量日志
for (const item of items) {
  logger.debug('Processing:', item) // 可能产生大量日志
}

// ✅ 批量记录或使用更高级别
logger.info(`Processing ${items.length} items`)
// ... 处理 ...
logger.info('Processing completed')
```

## 日志查看

### 开发模式
日志文件位置：
```bash
# Windows
D:\projects\holix-ai\.holixai\logs\main.log

# macOS/Linux
/path/to/project/.holixai/logs/main.log
```

### 生产模式
快速打开日志目录：
```typescript
import { app, shell } from 'electron'

// 在菜单或开发者工具中添加
shell.openPath(app.getPath('logs'))
```

## 日志分析

### 查找错误
```bash
# 查找所有错误日志
grep "ERROR" .holixai/logs/main.log

# 查找特定模块的错误
grep "\[Database\].*ERROR" .holixai/logs/main.log
```

### 性能分析
```bash
# 查找慢任务
grep "slow task" .holixai/logs/main.log

# 查找特定时间范围
grep "2026-01-10 12:" .holixai/logs/main.log
```

## 配置选项

如需自定义配置，修改 [logger.ts](../src/node/platform/logger.ts)：

```typescript
// 修改日志级别
logger.transports.file.level = 'verbose'

// 修改文件大小限制
logger.transports.file.maxSize = 20 * 1024 * 1024 // 20MB

// 自定义日志格式
logger.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s} [{level}] {text}'

// 禁用控制台输出（生产环境）
logger.transports.console.level = false
```

## 故障排查

### 日志文件未生成
1. 检查目录权限
2. 确认路径存在
3. 查看控制台错误信息

### 日志文件过大
1. 检查是否有大量重复日志
2. 降低日志级别
3. 减小文件大小限制以增加归档频率

### 日志信息不完整
1. 确认日志级别设置正确
2. 检查是否有异步操作未等待完成
3. 查看归档文件中的历史日志
