# Chat Manager 重构计划

## 目标

重构 `src/node/chat/manager.ts`（710 行），拆分为多个职责单一的模块，提升可维护性、可测试性和可扩展性。

## 当前问题

1. **单一文件过大**：710 行代码，难以维护
2. **职责过多**：会话管理、流处理、消息构建、数据库操作、工具追踪等混在一起
3. **耦合度高**：直接依赖多个模块（database, update, skillManager, configStore）
4. **可测试性差**：大量私有方法，难以单独测试
5. **扩展性差**：添加新功能（如多媒体支持）需要修改核心逻辑

## 重构架构

```
src/node/chat/
├── manager.ts                    # 会话管理器（简化，只管理会话生命周期）
├── session/
│   ├── chat-session.ts           # 单个会话封装
│   ├── session-builder.ts        # 会话构建器（构建 Agent、Tools、Prompts）
│   └── session-state.ts          # 会话状态类型定义
├── stream/
│   ├── stream-processor.ts       # 流处理器（协调者）
│   ├── handlers/
│   │   ├── base-handler.ts       # 处理器基类
│   │   ├── message-handler.ts    # messages 模式处理
│   │   ├── update-handler.ts     # updates 模式处理
│   │   ├── agent-handler.ts      # agent 节点处理
│   │   └── tool-handler.ts       # tools 节点处理
│   └── stream-state.ts           # 流状态管理
├── message/
│   ├── message-builder.ts        # 消息构建器
│   ├── message-persister.ts      # 消息持久化服务
│   └── content-extractor.ts      # 内容提取器（文本、多媒体等）
├── tools/
│   ├── tool-registry.ts          # 工具注册表
│   └── tool-call-tracker.ts      # 工具调用追踪
└── events/
    └── chat-event-emitter.ts     # 聊天事件发射器
```

## 重构步骤

### 阶段 1：准备工作（当前）
- [x] 创建重构分支 `refactor/chat-manager-restructure`
- [ ] 编写重构计划文档
- [ ] 备份现有测试用例
- [ ] 创建新的测试框架

### 阶段 2：类型定义和接口（第 1 天）
- [ ] 创建 `session/session-state.ts` - 会话状态类型
- [ ] 创建 `stream/stream-state.ts` - 流状态类型
- [ ] 创建 `events/chat-event-emitter.ts` - 事件接口
- [ ] 创建 `message/message-types.ts` - 消息类型定义

### 阶段 3：底层服务（第 2 天）
- [ ] 创建 `message/message-persister.ts` - 消息持久化服务
- [ ] 创建 `message/content-extractor.ts` - 内容提取器
- [ ] 创建 `tools/tool-call-tracker.ts` - 工具调用追踪
- [ ] 创建 `tools/tool-registry.ts` - 工具注册表
- [ ] 为每个服务编写单元测试

### 阶段 4：流处理器（第 3 天）
- [ ] 创建 `stream/handlers/base-handler.ts` - 处理器基类
- [ ] 创建 `stream/handlers/message-handler.ts` - messages 模式处理
- [ ] 创建 `stream/handlers/update-handler.ts` - updates 模式处理
- [ ] 创建 `stream/handlers/agent-handler.ts` - agent 节点处理
- [ ] 创建 `stream/handlers/tool-handler.ts` - tools 节点处理
- [ ] 创建 `stream/stream-processor.ts` - 流处理器协调者
- [ ] 为每个处理器编写单元测试

### 阶段 5：会话管理（第 4 天）
- [ ] 创建 `session/session-builder.ts` - 会话构建器
- [ ] 创建 `session/chat-session.ts` - 单个会话封装
- [ ] 重构 `manager.ts` - 简化为会话生命周期管理
- [ ] 编写集成测试

### 阶段 6：测试和验证（第 5 天）
- [ ] 运行所有单元测试
- [ ] 运行集成测试
- [ ] 手动测试核心功能
- [ ] 性能测试（对比重构前后）
- [ ] 修复发现的问题

### 阶段 7：文档和清理（第 6 天）
- [ ] 更新 API 文档
- [ ] 添加代码注释
- [ ] 更新 README
- [ ] 删除旧代码（如果完全迁移）
- [ ] 代码审查

### 阶段 8：合并和发布
- [ ] 创建 Pull Request
- [ ] 代码审查
- [ ] 合并到 main 分支
- [ ] 发布新版本

## 设计原则

1. **单一职责原则（SRP）** - 每个类只做一件事
2. **依赖注入（DI）** - 通过构造函数注入依赖，便于测试
3. **开闭原则（OCP）** - 对扩展开放，对修改关闭
4. **接口隔离（ISP）** - 使用接口定义契约
5. **依赖倒置（DIP）** - 依赖抽象而非具体实现

## 测试策略

1. **单元测试** - 每个模块独立测试，覆盖率目标 80%+
2. **集成测试** - 测试模块间协作
3. **端到端测试** - 测试完整的聊天流程
4. **性能测试** - 确保重构不影响性能

## 兼容性保证

1. **向后兼容** - 保持 `chatManager` 单例的公共 API 不变
2. **渐进式迁移** - 可以逐步迁移，不影响现有功能
3. **回滚方案** - 保留旧代码，出问题可快速回滚

## 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 破坏现有功能 | 高 | 完善的测试覆盖 |
| 性能下降 | 中 | 性能测试和优化 |
| 引入新 bug | 中 | 代码审查和测试 |
| 开发时间过长 | 低 | 分阶段实施，可随时停止 |

## 成功标准

1. ✅ 所有测试通过
2. ✅ 代码覆盖率 ≥ 80%
3. ✅ 性能不低于重构前
4. ✅ 代码行数减少 30%+（通过拆分）
5. ✅ 单个文件不超过 300 行
6. ✅ 循环复杂度降低
7. ✅ 可维护性指数提升

## 时间估算

- **总时间**：6 个工作日
- **每天工作量**：4-6 小时
- **总工作量**：24-36 小时

## 备注

- 重构过程中保持与团队沟通
- 每个阶段完成后提交代码
- 遇到问题及时记录和讨论
- 优先保证功能正确性，其次考虑性能优化
