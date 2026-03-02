# Skills 安装指南

HolixAI 支持在 `~/.holixai/skills/` 目录中安装自定义 skills，让 AI 具备特定领域的专业能力或额外工具。

## 目录结构

```
~/.holixai/skills/
├── code-assistant/          # 目录型 skill（推荐）
│   ├── skill.json           # 必须：skill 清单
│   ├── tools.js             # 可选：自定义 JS 工具
│   └── scripts/
│       └── run-tests.sh     # 可选：外部脚本
│
└── simple-prompt.json       # 单文件型 skill（仅 prompt，无工具）
```

---

## skill.json 格式

```json
{
  "name": "code_assistant",
  "version": "1.0.0",
  "description": "Expert in writing clean, idiomatic code",
  "prompt": "You are an expert software engineer...\nAlways write clean, well-documented code.",
  "disabled": false,
  "tools": [
    {
      "type": "js",
      "file": "tools.js",
      "export": "default"
    },
    {
      "type": "command",
      "name": "run_tests",
      "description": "Run project test suite",
      "command": "npm test",
      "cwd": "{{dir}}",
      "timeout": 60000,
      "schema": {
        "dir": { "type": "string", "description": "Project root directory" }
      }
    },
    {
      "type": "script",
      "name": "analyze_file",
      "description": "Analyze a source file using custom Python script",
      "script": "python3 {{skillDir}}/scripts/analyze.py {{file}}",
      "schema": {
        "file": { "type": "string", "description": "Absolute path to the file" }
      }
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | Skill 唯一标识（snake_case，如 `code_assistant`） |
| `version` | string | ❌ | 版本号，默认 `1.0.0` |
| `description` | string | ✅ | 简短描述，AI 根据此决定是否加载 |
| `prompt` | string | ❌ | 追加到 System Prompt 的内容 |
| `disabled` | boolean | ❌ | 设为 `true` 临时禁用此 skill |
| `tools` | array | ❌ | 工具声明列表（见下方说明） |

---

## 工具类型

### 1. `type: "js"` — JS 工具文件

从 `.js` 文件动态加载工具，适合复杂逻辑。

**`tools.js` 导出格式：**

```js
// 导出单个工具
module.exports = {
  name: 'format_json',
  description: 'Format and validate a JSON string',
  schema: {
    input: { type: 'string', description: 'Raw JSON string to format' }
  },
  execute: async ({ input }) => {
    const parsed = JSON.parse(input)
    return JSON.stringify(parsed, null, 2)
  }
}

// 或导出工具数组
module.exports = [
  {
    name: 'tool_one',
    description: '...',
    execute: async (args) => { /* ... */ }
  },
  {
    name: 'tool_two',
    description: '...',
    execute: async (args) => { /* ... */ }
  }
]
```

**`schema` 参数简写：**

```js
schema: {
  input:    'string',                                         // 简写
  count:    { type: 'number', description: '数量' },        // 完整格式
  verbose:  { type: 'boolean', optional: true }              // 可选参数
}
```

### 2. `type: "command"` — Shell 命令工具

直接包装 Shell 命令，支持 `{{paramName}}` 模板变量。

```json
{
  "type": "command",
  "name": "grep_files",
  "description": "Search for a pattern in files",
  "command": "grep -r {{pattern}} {{dir}} --include='*.ts'",
  "cwd": "{{dir}}",
  "timeout": 10000,
  "schema": {
    "pattern": { "type": "string", "description": "Search pattern" },
    "dir":     { "type": "string", "description": "Search directory" }
  }
}
```

### 3. `type: "script"` — 外部脚本工具

执行 Python、Bash 等任意语言脚本。

```json
{
  "type": "script",
  "name": "analyze_deps",
  "description": "Analyze project dependencies",
  "script": "python3 {{skillDir}}/check_deps.py --project {{projectDir}}",
  "timeout": 30000,
  "schema": {
    "projectDir": { "type": "string", "description": "Project root directory" }
  }
}
```

**内置模板变量：**
- `{{skillDir}}` — skill 目录的绝对路径
- `{{参数名}}` — 动态参数值

---

## 示例 Skills

### 代码审查助手

```
~/.holixai/skills/code-reviewer/
├── skill.json
└── tools.js
```

**skill.json：**
```json
{
  "name": "code_reviewer",
  "description": "Expert code reviewer focusing on quality and best practices",
  "prompt": "You are a senior code reviewer. When reviewing code:\n- Check for bugs, security issues, and performance problems\n- Suggest idiomatic improvements\n- Explain the reasoning behind each suggestion",
  "tools": [
    {
      "type": "js",
      "file": "tools.js"
    }
  ]
}
```

**tools.js：**
```js
const { execSync } = require('child_process')

module.exports = [
  {
    name: 'get_git_diff',
    description: 'Get the git diff for the current changes',
    schema: {
      dir: { type: 'string', description: 'Project directory' }
    },
    execute: async ({ dir }) => {
      return execSync('git diff HEAD', { cwd: dir }).toString()
    }
  }
]
```

---

## 热重载

安装新 skill 或修改 skill 文件后，可以：

1. 告诉 AI："请重新加载 skills"（AI 会调用 `reload_skills` 工具）
2. 或重启 HolixAI 应用

应用运行期间会自动监听 `~/.holixai/skills/` 目录变更并在 1 秒后自动重载。
