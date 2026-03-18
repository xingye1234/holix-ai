# Skills 渐进式披露机制分析

## 📊 当前实现分析

### 问题：Skills 是否是渐进式披露的？

**答案：❌ 不是完全渐进式的，存在混合模式**

### 当前机制

#### 1. 会话启动时（manager.ts:524-548）

```typescript
private buildTools() {
  // 动态构建 loadSkillTool，确保每次会话获取最新的 skills 列表
  const loadSkillTool = buildLoadSkillTool()

  // ⚠️ 关键：收集所有已安装 skill 提供的自定义 tools
  const skillTools = skillManager.getAllTools()

  const tools = [
    systemPlatformTool,
    systemEnvTool,
    // ... 其他系统工具
    loadSkillTool,        // 用于加载 skill prompt
    reloadSkillsTool,
    // ⚠️ 问题：直接注入所有 skill 的工具
    ...skillTools,
  ]

  return tools
}
```

#### 2. System Prompt 构建（manager.ts:159-180）

```typescript
// 收集 skill 注入的 system prompts
const skillPrompts = skillManager.getSystemPrompts()

// 创建 Agent
const agent = createAgent({
  model: llm,
  systemPrompt: new SystemMessage({
    content: [
      { type: 'text', text: builtinMessages.globalSystem },
      ...(session.systemMessages?.map(...) || []),
      // ⚠️ 问题：直接注入所有 skill 的 system prompt
      ...skillPrompts.map(prompt => ({ type: 'text', text: prompt })),
      ...(workspacePrompt ? [...] : []),
    ],
  }),
  tools: this.buildTools(),
})
```

### 实际行为

#### ❌ 非渐进式部分（会话启动时立即加载）

1. **所有 Skill 的工具** - `skillManager.getAllTools()`
   - 所有已安装 skill 的工具都会立即注入到 Agent
   - AI 从一开始就能看到所有工具

2. **所有 Skill 的 System Prompt** - `skillManager.getSystemPrompts()`
   - 所有已安装 skill 的 system prompt 都会立即注入
   - AI 从一开始就受到所有 skill 的指令影响

#### ✅ 渐进式部分（按需加载）

1. **`load_skill` 工具** - 用于加载额外的 skill prompt
   - AI 可以通过调用 `load_skill` 工具来获取特定 skill 的详细指令
   - 但这只是**补充**，因为 system prompt 已经包含了基础指令

### 问题总结

| 项目 | 当前行为 | 是否渐进式 | 影响 |
|------|----------|-----------|------|
| Skill 工具 | 会话启动时全部加载 | ❌ 否 | Token 消耗高，上下文污染 |
| Skill System Prompt | 会话启动时全部加载 | ❌ 否 | Token 消耗高，指令冲突 |
| Skill 详细指令 | 通过 load_skill 按需加载 | ✅ 是 | 但作用有限 |

### 具体示例

假设安装了 3 个 skills：
- `code_assistant` - 代码助手（10 个工具，500 token prompt）
- `sql_expert` - SQL 专家（5 个工具，300 token prompt）
- `web_search` - 网页搜索（3 个工具，200 token prompt）

**当前行为**：
```
会话启动 → 立即加载：
  - 18 个工具（10 + 5 + 3）
  - 1000 token 的 system prompt（500 + 300 + 200）

用户："帮我写个 Python 函数"
AI：已经知道所有 18 个工具，包括不相关的 SQL 和搜索工具
```

**理想的渐进式行为**：
```
会话启动 → 只加载：
  - load_skill 工具
  - 基础系统工具

用户："帮我写个 Python 函数"
AI：识别需要代码能力 → 调用 load_skill('code_assistant')
  → 动态加载 10 个代码工具 + 500 token prompt
```

---

## 🎯 改进方案

### 方案 1：完全渐进式加载（推荐）

#### 实现思路

1. **会话启动时只加载核心工具**
   ```typescript
   private buildTools() {
     const tools = [
       // 系统工具
       systemPlatformTool,
       systemEnvTool,
       systemTimezoneTool,
       systemTimeTool,

       // Skill 管理工具
       loadSkillTool,      // 加载 skill
       reloadSkillsTool,   // 重载 skills
       listSkillsTool,     // 列出可用 skills（新增）

       // ❌ 移除：...skillTools
     ]

     return tools
   }
   ```

2. **不在 System Prompt 中注入 Skill Prompts**
   ```typescript
   systemPrompt: new SystemMessage({
     content: [
       { type: 'text', text: builtinMessages.globalSystem },
       ...(session.systemMessages?.map(...) || []),
       // ❌ 移除：...skillPrompts.map(...)
       ...(workspacePrompt ? [...] : []),
     ],
   })
   ```

3. **增强 load_skill 工具**
   ```typescript
   // 新的 load_skill 实现
   async ({ skillName }) => {
     const skill = skillManager.getSkill(skillName)

     if (!skill) {
       return `Skill not found: ${skillName}`
     }

     // 动态注入工具到当前会话
     this.injectToolsToSession(sessionId, skill.tools)

     // 返回 skill 的 system prompt
     return skill.prompt || 'Skill loaded successfully'
   }
   ```

4. **支持会话中动态注入工具**
   ```typescript
   class ChatSession {
     private dynamicTools: DynamicStructuredTool[] = []

     injectTools(tools: DynamicStructuredTool[]) {
       this.dynamicTools.push(...tools)
       // 重新构建 Agent 的工具列表
       this.rebuildAgent()
     }
   }
   ```

#### 优点
- ✅ 大幅减少初始 Token 消耗
- ✅ 避免上下文污染
- ✅ 真正的按需加载
- ✅ 更清晰的 skill 边界

#### 缺点
- ❌ 需要重构 Agent 创建逻辑
- ❌ 需要支持动态工具注入
- ❌ 可能影响 AI 的能力发现

---

### 方案 2：混合模式（折中方案）

#### 实现思路

1. **区分"核心 Skills"和"可选 Skills"**
   ```typescript
   // skill.json 中添加配置
   {
     "name": "code_assistant",
     "autoLoad": true,  // 自动加载（核心 skill）
     "description": "..."
   }
   ```

2. **只自动加载核心 Skills**
   ```typescript
   private buildTools() {
     // 只加载标记为 autoLoad 的 skills
     const coreSkillTools = skillManager.getCoreTools()

     const tools = [
       ...systemTools,
       loadSkillTool,
       ...coreSkillTools,  // 只包含核心 skills
     ]

     return tools
   }
   ```

#### 优点
- ✅ 平衡了便利性和性能
- ✅ 实现相对简单
- ✅ 向后兼容

#### 缺点
- ❌ 仍然不是完全渐进式
- ❌ 需要用户配置哪些是核心 skill

---

### 方案 3：智能预加载（AI 驱动）

#### 实现思路

1. **分析用户消息，预测需要的 Skills**
   ```typescript
   async startSession(params) {
     // 分析用户消息
     const userIntent = await this.analyzeIntent(params.userMessageContent)

     // 预加载相关 skills
     const relevantSkills = this.matchSkills(userIntent)
     const skillTools = relevantSkills.flatMap(s => s.tools)

     // 只加载相关的工具
     const tools = [...systemTools, ...skillTools]
   }
   ```

2. **使用轻量级分类器**
   ```typescript
   private matchSkills(userMessage: string): LoadedSkill[] {
     const keywords = {
       code: ['code', 'function', 'class', 'debug', 'python', 'javascript'],
       sql: ['sql', 'database', 'query', 'table', 'select'],
       search: ['search', 'find', 'lookup', 'google'],
     }

     // 简单的关键词匹配
     const matched = []
     for (const [skillType, words] of Object.entries(keywords)) {
       if (words.some(w => userMessage.toLowerCase().includes(w))) {
         matched.push(skillManager.getSkill(skillType))
       }
     }

     return matched.filter(Boolean)
   }
   ```

#### 优点
- ✅ 自动化，用户无感知
- ✅ 减少不必要的加载
- ✅ 提升用户体验

#### 缺点
- ❌ 实现复杂
- ❌ 可能预测不准确
- ❌ 增加延迟

---

## 🧪 验证方法

### 测试 1：检查会话启动时的工具数量

```typescript
// 添加日志
private buildTools() {
  const skillTools = skillManager.getAllTools()

  logger.info(`[ChatManager] Total tools: ${tools.length}`)
  logger.info(`[ChatManager] Skill tools: ${skillTools.length}`)
  logger.info(`[ChatManager] Skill names: ${skillManager.listSkills().map(s => s.name).join(', ')}`)

  return tools
}
```

### 测试 2：检查 System Prompt 大小

```typescript
const skillPrompts = skillManager.getSystemPrompts()

logger.info(`[ChatManager] Skill prompts count: ${skillPrompts.length}`)
logger.info(`[ChatManager] Total prompt tokens: ${skillPrompts.reduce((sum, p) => sum + p.length, 0)}`)
```

### 测试 3：对比不同场景的 Token 消耗

| 场景 | 当前实现 | 渐进式实现 | 节省 |
|------|----------|-----------|------|
| 简单对话（无需 skill） | 1000 tokens | 200 tokens | 80% |
| 代码任务（需要 1 个 skill） | 1000 tokens | 700 tokens | 30% |
| 复杂任务（需要 3 个 skills） | 1000 tokens | 1000 tokens | 0% |

---

## 📝 建议

### 短期（重构时实施）
1. **添加日志和监控** - 了解实际的工具和 prompt 使用情况
2. **实施方案 2（混合模式）** - 快速改进，向后兼容
3. **添加配置选项** - 让用户选择加载策略

### 长期（后续优化）
1. **实施方案 1（完全渐进式）** - 最佳性能
2. **支持动态工具注入** - 需要 LangChain Agent 支持
3. **实施方案 3（智能预加载）** - 最佳用户体验

---

## 🔍 重构时的改进点

在重构 `manager.ts` 时，我们可以：

1. **创建 `ToolRegistry` 类** - 管理工具的动态加载
2. **创建 `SkillLoader` 类** - 负责 skill 的渐进式加载
3. **修改 `SessionBuilder`** - 支持不同的加载策略
4. **添加配置项** - 让用户选择加载模式

```typescript
// 配置示例
interface ChatConfig {
  skillLoadingStrategy: 'eager' | 'lazy' | 'smart'
  coreSkills: string[] // 始终加载的 skills
}
```

---

**结论**：当前实现**不是**完全渐进式的，所有 skills 的工具和 prompts 都会在会话启动时加载。建议在重构时实施混合模式或完全渐进式加载。
