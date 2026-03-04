# Editor Autocomplete 设计规范

## 概述

为 Lexical 编辑器添加类 VSCode 的智能提示与快捷指令输入功能，支持 `@`、`#`、`/` 三类触发前缀。

---

## 触发规则

| 触发字符 | 触发条件 | 用途 |
|---------|---------|------|
| `@` | 当前词前面是空白或行首 | 引用 Skill / 提及 |
| `#` | 当前词前面是空白或行首 | 文件/目录快捷引用 |
| `/` | 行首或空白后 | 斜杠命令（格式化、动作） |

触发后，输入的内容作为 **query** 进行模糊过滤（忽略大小写，前缀优先排序）。空白或 `Esc` 关闭弹窗。

---

## 交互设计

### 候选弹窗

```
┌─────────────────────────────────┐
│  @ Skills                       │  ← section header
│  ─────────────────────────────  │
│  ▶ file_system                  │  ← 高亮选中项
│    Local file system tools ...  │
│  ─────────────────────────────  │
│    code_reader                  │
│    Code reading and search ...  │
└─────────────────────────────────┘
```

- 弹窗出现在光标正下方（viewport 底部不足时则显示在上方）
- 最多同时展示 **8 条**候选
- 候选文本中匹配 query 的部分加粗高亮

### 键盘操作

| 按键 | 行为 |
|------|------|
| `↑` / `↓` | 移动选中项 |
| `Enter` / `Tab` | 确认插入 |
| `Esc` | 关闭弹窗，保留已输入文字 |
| `Backspace` | 缩短 query；query 为空时关闭弹窗 |
| 输入空格 | 关闭弹窗，保留已输入文字 |

---

## 数据模型

```ts
// 触发字符类型
type TriggerChar = '@' | '#' | '/'

// 候选项
interface AutocompleteSuggestion {
  id: string
  label: string // 显示名称（也作为插入文本的基础）
  description?: string // 副标题描述
  icon?: string // emoji 或文字图标
  type?: string // skill | file | command | ...
  insertText?: string // 实际插入文本，默认 = trigger + label + ' '
}

// 候选来源（每个触发字符对应一个 source）
interface AutocompleteSource {
  trigger: TriggerChar
  title?: string // section header
  suggestions: AutocompleteSuggestion[]
    | ((query: string) => AutocompleteSuggestion[])
}
```

---

## 插入行为

选中候选项后：
1. 将光标所在文本节点中 `[triggerOffset, cursorOffset]` 范围替换为 `insertText`
2. 默认 `insertText = trigger + label + ' '`（尾部空格便于继续输入）
3. 若候选项定义了自定义 `insertText`，则使用该值

---

## 组件结构

```
src/components/editor/plugins/autocomplete/
├── types.ts                 — 类型定义
├── detect.ts                — 纯函数：触发检测 & 候选过滤（可单元测试）
├── Popup.tsx                — 浮动弹窗 React 组件（Portal 渲染到 body）
├── AutocompletePlugin.tsx   — Lexical 插件：监听编辑器 + 连接弹窗
├── index.ts                 — 公共导出
└── __tests__/
    └── detect.test.ts       — detect.ts 单元测试
```

`Editor` 组件新增可选 prop：

```ts
interface EditorProps {
  // ...existing...
  autocomplete?: AutocompleteEditorProps
}

interface AutocompleteEditorProps {
  sources: AutocompleteSource[]
  onInsert?: (trigger: TriggerChar, item: AutocompleteSuggestion) => void
}
```

---

## 内置来源示例

### `@` Skill 提及

由调用方从 `trpcClient.skill.list()` 获取后注入：

```tsx
<Editor
  autocomplete={{
    sources: [{
      trigger: '@',
      title: 'Skills',
      suggestions: skills.map(s => ({
        id: s.name,
        label: s.name,
        description: s.description,
        icon: s.isBuiltin ? '⚙️' : '📦',
        type: 'skill',
      })),
    }]
  }}
/>
```

### `/` 斜杠命令（编辑器内置）

| 命令 | 说明 |
|------|------|
| `/clear` | 清空输入框 |
| `/bold` | 切换粗体（光标所在词） |

---

## 测试覆盖

- `detectTrigger()` - 各种输入场景
- `filterSuggestions()` - 过滤顺序（前缀匹配优先）
- `formatInsertText()` - 插入文本生成
