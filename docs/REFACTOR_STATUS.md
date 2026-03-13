# Chat Manager 重构 - 当前状态

## ✅ 已完成

1. **创建重构分支** - `refactor/chat-manager-restructure`
2. **编写重构计划** - `docs/REFACTOR_PLAN.md`
3. **评估现有测试** - 项目已有 Vitest 测试框架和 13 个测试套件

## 📊 现状分析

### 文件规模
- `src/node/chat/manager.ts`: **710 行**
- 单一类承担过多职责

### 现有测试
```
✓ src/node/chat/skills/__tests__/manager-external.test.ts (1 test)
✓ src/node/server/__tests__/chat-router.test.ts (12 tests)
✓ src/node/chat/skills/__tests__/manager.test.ts (13 tests)
✓ src/node/chat/tools/__tests__/approval.test.ts (15 tests)
... 等共 13 个测试套件
```

### 问题总结
1. **职责过多** - 会话管理、流处理、消息构建、数据库操作混在一起
2. **耦合度高** - 直接依赖 database, update, skillManager, configStore
3. **可测试性差** - 大量私有方法，难以单独测试
4. **扩展性差** - 添加多媒体支持需要修改核心逻辑

## 🎯 重构目标

### 架构设计
```
src/node/chat/
├── manager.ts                    # 会话管理器（简化版）
├── session/                      # 会话相关
│   ├── chat-session.ts
│   ├── session-builder.ts
│   └── session-state.ts
├── stream/                       # 流处理
│   ├── stream-processor.ts
│   ├── handlers/
│   │   ├── base-handler.ts
│   │   ├── message-handler.ts
│   │   ├── update-handler.ts
│   │   ├── agent-handler.ts
│   │   └── tool-handler.ts
│   └── stream-state.ts
├── message/                      # 消息处理
│   ├── message-builder.ts
│   ├── message-persister.ts
│   └── content-extractor.ts
├── tools/                        # 工具管理
│   ├── tool-registry.ts
│   └── tool-call-tracker.ts
└── events/                       # 事件系统
    └── chat-event-emitter.ts
```

### 设计原则
- **单一职责** - 每个类只做一件事
- **依赖注入** - 便于测试和扩展
- **开闭原则** - 对扩展开放，对修改关闭

## 📋 下一步计划

### 阶段 2：类型定义和接口（优先级：高）

需要创建的文件：

1. **`src/node/chat/session/session-state.ts`**
   - 定义会话状态类型
   - 定义会话配置接口

2. **`src/node/chat/stream/stream-state.ts`**
   - 定义流状态类型
   - 定义流上下文接口

3. **`src/node/chat/events/chat-event-emitter.ts`**
   - 定义事件接口
   - 实现事件发射器

4. **`src/node/chat/message/message-types.ts`**
   - 定义消息类型
   - 定义内容类型（为多媒体支持做准备）

### 实施建议

1. **先创建类型定义** - 定义清晰的接口和类型
2. **编写单元测试** - 每个模块都要有测试
3. **渐进式迁移** - 保持向后兼容
4. **持续集成** - 每个阶段都要确保测试通过

## 🧪 测试策略

### 单元测试
- 每个新模块都要有对应的测试文件
- 测试覆盖率目标：80%+
- 使用 Vitest 框架

### 集成测试
- 测试模块间协作
- 测试完整的聊天流程

### 性能测试
- 对比重构前后的性能
- 确保没有性能退化

## ⚠️ 风险控制

1. **保持向后兼容** - `chatManager` 单例的公共 API 不变
2. **渐进式迁移** - 可以逐步迁移，不影响现有功能
3. **回滚方案** - 保留旧代码，出问题可快速回滚
4. **充分测试** - 每个阶段都要测试验证

## 📝 开发规范

### 提交信息格式
```
<type>(<scope>): <subject>

类型：
- feat: 新功能
- refactor: 重构
- test: 测试
- docs: 文档
- fix: 修复

示例：
refactor(chat): extract stream processor
test(chat): add stream processor tests
```

### 代码规范
- 使用 TypeScript 严格模式
- 遵循项目现有的代码风格
- 添加必要的注释和文档

## 🚀 如何继续

### 方式 1：自动化重构（推荐）
让 AI 助手按照计划逐步实施重构，每个阶段都会：
1. 创建新文件
2. 编写测试
3. 运行测试验证
4. 提交代码

### 方式 2：手动重构
根据 `docs/REFACTOR_PLAN.md` 中的步骤，手动实施重构。

### 方式 3：混合模式
AI 助手创建基础结构和测试，开发者完善业务逻辑。

## 📞 需要帮助？

如果需要继续重构，请告诉我：
1. 是否开始阶段 2（类型定义和接口）？
2. 是否需要我逐步实施，还是一次性完成？
3. 是否有特殊要求或关注点？

---

**分支**: `refactor/chat-manager-restructure`
**状态**: 准备就绪，等待开始实施
**预计时间**: 6 个工作日（24-36 小时）
