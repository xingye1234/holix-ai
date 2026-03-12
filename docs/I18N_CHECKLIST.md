# 多语言化检查报告

## 概述
项目中有大量硬编码的中文文案需要多语言化处理。以下是详细的检查结果：

## 1. Skills 页面 (`src/routes/setting/skills.tsx`)

### 需要多语言化的文案：

#### 标题和描述
- ✅ "Skills" (第 483 行) - 页面标题
- ✅ "查看当前已加载的所有 Skills 及其工具能力、权限配置" (第 485 行)
- ✅ "个 Skill" / "内置" / "用户" (第 488-496 行)

#### 表单和输入
- ✅ "从 GitHub 安装 Skills" (第 501 行)
- ✅ "支持仓库 URL..." (第 502-505 行) - 说明文字
- ✅ placeholder: "https://github.com/owner/repo" (第 508 行)
- ✅ placeholder: "skills（可选，默认 skills）" (第 510 行)
- ✅ placeholder: "main（可选）" (第 511 行)
- ✅ "安装中..." / "安装 Skill" (第 514 行)

#### Skill 卡片
- ✅ "个工具" (第 314 行)
- ✅ "来源路径：" (第 320 行)
- ✅ "工具能力" (第 340 行)
- ✅ "系统提示词扩展" (第 353 行)
- ✅ "来源与目录" (第 365 行)
- ✅ "来源：" (第 369 行)
- ✅ "符合 skill 规范的资源目录" (第 375 行)
- ✅ "其他目录（若存在）" (第 385 行)
- ✅ "查看完整提示词" (第 400 行)
- ✅ "提示词" / "完整系统提示词内容" (第 406-409 行)
- ✅ "沙箱权限" (第 422 行)
- ✅ "配置" (第 220 行)

#### 权限面板
- ✅ "允许调用的模块" (第 119 行)
- ✅ "无（完全隔离）" (第 122 行)
- ✅ "可读取的环境变量" (第 142 行)
- ✅ "超时" / "内存上限" (第 158-166 行)

#### Toast 提示
- ✅ "请先输入 GitHub 仓库地址" (第 457 行)
- ✅ "已安装 X 个 skill：..." (第 468 行)

#### 空状态
- ✅ "暂无加载的 Skills" (第 523 行)

#### 分组标题
- ✅ "内置 Skills" (第 532 行)
- ✅ "用户 Skills" (第 548 行)

#### 来源标签映射
- ✅ SOURCE_LABEL_MAP 对象 (第 274-285 行)
  - '内置', '外部目录', '.holixai', '.holix', '.codex', '.claude', '.cursor', '.gemini', '.qwen', '.Claude Code'

## 2. Help 页面 (`src/routes/setting/help.tsx`)

### 需要多语言化的文案：

#### 更新相关
- ✅ "查看更新详情" (第 48 行)
- ✅ "更新详情" (第 54 行)
- ✅ "加载中..." (第 68 行)
- ✅ "加载更新说明失败，请检查网络连接。" (第 73 行)
- ✅ "重试" (第 74 行)
- ✅ "帮助与支持" (第 186 行)
- ✅ "应用工具和支持选项" (第 187 行)
- ✅ "应用更新" (第 193 行)
- ✅ "检查更新" (第 197 行)
- ✅ "检查并获取应用的最新版本" (第 199 行)
- ✅ "检查中..." / "检查更新" (第 209 行)
- ✅ "安装并重启" (第 217 行)
- ✅ "当前版本:" (第 225 行)
- ✅ "→ 新版本: v" (第 229 行)
- ✅ "下载完成" / "正在下载..." (第 237 行)
- ✅ "当前已是最新版本。" (第 245 行)

#### Toast 提示
- ✅ "发现新版本 X，开始下载..." (第 113 行)
- ✅ "当前已是最新版本！" (第 117 行)
- ✅ "更新出错：X" (第 122 行)
- ✅ "更新已下载完成，可以立即安装。" (第 127 行)
- ✅ "开发者控制台已切换" (第 145 行)
- ✅ "打开控制台失败" (第 148 行)
- ✅ "打开链接失败" (第 152 行)

#### 开发者工具
- ✅ "开发者工具" (第 260 行)
- ✅ "开发者控制台" (第 264 行)
- ✅ "打开开发者工具用于调试和检查应用" (第 266 行)
- ✅ "打开控制台" (第 271 行)

#### 关于信息
- ✅ "关于" (第 278 行)
- ✅ "应用名称" / "Holix AI" (第 282-283 行)
- ✅ "版本号" (第 286 行)
- ✅ "许可证" / "MIT" (第 290-291 行)

#### 帮助资源
- ✅ "帮助资源" (第 297 行)
- ✅ "使用文档" (第 302 行)
- ✅ "问题反馈" (第 313 行)
- ✅ "GitHub 仓库" (第 324 行)

## 3. Provider 页面 (`src/routes/setting/provider.tsx`)

### 需要多语言化的文案：

#### 标题和描述
- ✅ "供应商设置" (第 88 行)
- ✅ "管理 AI 模型供应商和 API 配置" (第 89 行)

#### 按钮和操作
- ✅ "添加供应商" (第 95 行)
- ✅ "设为默认" (第 122 行)
- ✅ "删除" (第 141 行)

#### 表单字段
- ✅ "供应商名称" (第 169 行)
- ✅ "API 地址" (第 173 行)
- ✅ "API Key" (第 177 行)
- ✅ "可用模型" (第 181 行)
- ✅ "添加模型名称" (第 182 行)
- ✅ "启用" (第 186 行)

#### Placeholder
- ✅ placeholder: "https://api.example.com/v1" (第 174 行)
- ✅ placeholder: "输入您的 API Key" (第 178 行)
- ✅ placeholder: "OpenAI" (第 170 行)
- ✅ placeholder: "🤖" (第 192 行)
- ✅ placeholder: "https://api.example.com/v1" (第 207 行)
- ✅ placeholder: "sk-xxxxx" (第 211 行)

#### Toast 提示
- ✅ "已设为默认供应商" (第 67 行)
- ✅ "设置默认供应商失败" (第 69 行)
- ✅ "供应商添加成功" (第 79 行)
- ✅ "添加失败：X" (第 81 行)
- ✅ "供应商删除成功" (第 93 行)
- ✅ "删除失败：X" (第 95 行)

#### 对话框
- ✅ "添加新供应商" (第 163 行)
- ✅ "添加" / "取消" (第 221-222 行)

## 4. 其他页面

### Chat 相关 (`src/views/chat/`)

#### panel.tsx
- ✅ placeholder: "输入新的会话名称" (第 ? 行)

#### header.tsx
- ✅ placeholder: "搜索聊天..." (第 ? 行)

#### prompt-dialog.tsx
- ✅ placeholder: "在此输入提示词内容..." (第 ? 行)

#### right-prompts.tsx
- ✅ "提示词保存成功" / "提示词保存失败"
- ✅ "提示词编辑成功" / "提示词编辑失败"
- ✅ "提示词删除成功" / "提示词删除失败"

### Main 相关 (`src/views/main/`)

#### footer.tsx
- ✅ placeholder: "请输入问题"
- ✅ "已保存为草稿" / "保存草稿失败"

#### message-item/index.tsx
- ✅ "正在取消生成..." / "无法取消：缺少请求ID"

### Components

#### provider-model-selector.tsx
- ✅ placeholder: "选择供应商"
- ✅ placeholder: "选择模型"

## 5. 统计总结

### 按类型统计：
- **页面标题/描述**: ~30 处
- **按钮文本**: ~25 处
- **表单标签**: ~35 处
- **Placeholder**: ~20 处
- **Toast 提示**: ~30 处
- **对话框内容**: ~15 处
- **空状态提示**: ~5 处
- **其他文案**: ~20 处

**总计**: 约 **180+ 处**需要多语言化

## 6. 建议的多语言化结构

```typescript
// zh-CN.ts / en-US.ts 需要新增的结构

{
  skills: {
    title: 'Skills',
    description: '查看当前已加载的所有 Skills...',
    install: {
      title: '从 GitHub 安装 Skills',
      description: '支持仓库 URL...',
      repoPlaceholder: 'https://github.com/owner/repo',
      pathPlaceholder: 'skills（可选，默认 skills）',
      refPlaceholder: 'main（可选）',
      installing: '安装中...',
      install: '安装 Skill',
      errorNoRepo: '请先输入 GitHub 仓库地址',
      successInstalled: '已安装 {count} 个 skill：{names}',
    },
    card: {
      tools: '个工具',
      sourcePath: '来源路径：',
      toolsCapability: '工具能力',
      systemPrompt: '系统提示词扩展',
      sourceAndDirs: '来源与目录',
      source: '来源：',
      resourceDirs: '符合 skill 规范的资源目录',
      otherDirs: '其他目录（若存在）',
      viewFullPrompt: '查看完整提示词',
      promptTitle: '提示词',
      promptDescription: '完整系统提示词内容',
      sandboxPermissions: '沙箱权限',
      config: '配置',
    },
    permissions: {
      allowedModules: '允许调用的模块',
      noModules: '无（完全隔离）',
      envKeys: '可读取的环境变量',
      timeout: '超时',
      memoryLimit: '内存上限',
    },
    empty: '暂无加载的 Skills',
    builtin: '内置 Skills',
    user: '用户 Skills',
    sourceLabels: {
      builtin: '内置',
      external: '外部目录',
      // ...
    },
  },
  help: {
    title: '帮助与支持',
    subtitle: '应用工具和支持选项',
    update: {
      title: '应用更新',
      checkUpdate: '检查更新',
      description: '检查并获取应用的最新版本',
      checking: '检查中...',
      installAndRestart: '安装并重启',
      viewDetails: '查看更新详情',
      currentVersion: '当前版本:',
      newVersion: '→ 新版本: v',
      downloading: '正在下载...',
      downloaded: '下载完成',
      upToDate: '当前已是最新版本。',
      detailsTitle: '更新详情',
      loading: '加载中...',
      loadError: '加载更新说明失败，请检查网络连接。',
      retry: '重试',
    },
    toast: {
      newVersionFound: '发现新版本 {version}，开始下载...',
      upToDate: '当前已是最新版本！',
      updateError: '更新出错：{message}',
      downloadComplete: '更新已下载完成，可以立即安装。',
      devToolsToggled: '开发者控制台已切换',
      devToolsError: '打开控制台失败',
      linkError: '打开链接失败',
    },
    devTools: {
      title: '开发者工具',
      console: '开发者控制台',
      description: '打开开发者工具用于调试和检查应用',
      openConsole: '打开控制台',
    },
    about: {
      title: '关于',
      appName: '应用名称',
      version: '版本号',
      license: '许可证',
    },
    resources: {
      title: '帮助资源',
      docs: '使用文档',
      feedback: '问题反馈',
      github: 'GitHub 仓库',
    },
  },
  provider: {
    title: '供应商设置',
    subtitle: '管理 AI 模型供应商和 API 配置',
    addProvider: '添加供应商',
    setDefault: '设为默认',
    delete: '删除',
    form: {
      name: '供应商名称',
      namePlaceholder: 'OpenAI',
      apiUrl: 'API 地址',
      apiUrlPlaceholder: 'https://api.example.com/v1',
      apiKey: 'API Key',
      apiKeyPlaceholder: '输入您的 API Key',
      models: '可用模型',
      modelsPlaceholder: '添加模型名称',
      enabled: '启用',
      avatar: '图标',
      avatarPlaceholder: '🤖',
    },
    dialog: {
      addTitle: '添加新供应商',
      add: '添加',
      cancel: '取消',
    },
    toast: {
      setDefaultSuccess: '已设为默认供应商',
      setDefaultError: '设置默认供应商失败',
      addSuccess: '供应商添加成功',
      addError: '添加失败：{message}',
      deleteSuccess: '供应商删除成功',
      deleteError: '删除失败：{message}',
    },
  },
  chat: {
    searchPlaceholder: '搜索聊天...',
    renamePlaceholder: '输入新的会话名称',
  },
  prompt: {
    inputPlaceholder: '在此输入提示词内容...',
    saveSuccess: '提示词保存成功',
    saveError: '提示词保存失败',
    editSuccess: '提示词编辑成功',
    editError: '提示词编辑失败',
    deleteSuccess: '提示词删除成功',
    deleteError: '提示词删除失败',
  },
  message: {
    inputPlaceholder: '请输入问题',
    draftSaved: '已保存为草稿',
    draftError: '保存草稿失败',
    canceling: '正在取消生成...',
    cancelError: '无法取消：缺少请求ID',
  },
  selector: {
    selectProvider: '选择供应商',
    selectModel: '选择模型',
  },
}
```

## 7. 优先级建议

### 高优先级（用户直接可见）
1. Skills 页面的所有文案
2. Help 页面的所有文案
3. Provider 页面的所有文案
4. Toast 提示消息
5. Placeholder 文本

### 中优先级
1. 对话框内容
2. 空状态提示
3. 按钮文本

### 低优先级
1. 开发者工具相关
2. 调试信息

## 8. 实施步骤

1. **扩展 i18n 配置文件**
   - 更新 `src/i18n/locales/zh-CN.ts`
   - 更新 `src/i18n/locales/en-US.ts`

2. **逐页面替换硬编码文案**
   - 使用 `t()` 函数替换所有硬编码字符串
   - 确保所有 placeholder 都使用 i18n

3. **测试**
   - 切换语言测试所有页面
   - 确保所有文案都正确显示

4. **文档更新**
   - 更新开发文档，说明如何添加新的多语言文案
