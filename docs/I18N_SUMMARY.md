# 多语言化检查总结

## 📊 统计数据

### 文件统计
- 包含中文的文件总数: 125+ 个
- 需要重点处理的页面: 8 个

### 文案类型统计
| 类型 | 数量 | 示例 |
|------|------|------|
| 页面标题/描述 | ~30 | "Skills", "帮助与支持" |
| 按钮文本 | ~25 | "检查更新", "安装 Skill" |
| 表单标签 | ~35 | "供应商名称", "API Key" |
| Placeholder | ~20 | "请输入问题", "搜索聊天..." |
| Toast 提示 | ~30 | "已安装 X 个 skill", "更新出错" |
| 对话框内容 | ~15 | "添加新供应商", "查看更新详情" |
| 空状态提示 | ~5 | "暂无加载的 Skills" |
| 其他文案 | ~20 | 来源标签、权限说明等 |

**总计: 约 180+ 处需要多语言化**

## 🎯 重点文件清单

### 1. Settings 页面 (高优先级)
- ✅ `src/routes/setting/skills.tsx` - 约 60+ 处中文
- ✅ `src/routes/setting/help.tsx` - 约 40+ 处中文
- ✅ `src/routes/setting/provider.tsx` - 约 30+ 处中文
- ✅ `src/routes/setting/general.tsx` - 部分已完成

### 2. Chat 相关 (高优先级)
- ✅ `src/views/chat/panel.tsx` - 约 5 处
- ✅ `src/views/chat/header.tsx` - 约 3 处
- ✅ `src/views/chat/prompt-dialog.tsx` - 约 5 处
- ✅ `src/views/chat/right-prompts.tsx` - 约 10 处

### 3. Main 视图 (高优先级)
- ✅ `src/views/main/footer.tsx` - 约 5 处
- ✅ `src/views/main/message-item/index.tsx` - 约 5 处

### 4. Components (中优先级)
- ✅ `src/components/provider-model-selector.tsx` - 约 3 处
- ✅ `src/components/tool-approval-modal.tsx` - 需检查

## 📝 典型示例

### Skills 页面需要处理的文案
```typescript
// 当前 (硬编码)
<h1>Skills</h1>
<p>查看当前已加载的所有 Skills 及其工具能力、权限配置</p>
<Button>安装 Skill</Button>
toast.error('请先输入 GitHub 仓库地址')

// 应改为 (多语言)
<h1>{t('skills.title')}</h1>
<p>{t('skills.description')}</p>
<Button>{t('skills.install.button')}</Button>
toast.error(t('skills.install.errorNoRepo'))
```

### Help 页面需要处理的文案
```typescript
// 当前
<h2>应用更新</h2>
<Button>检查更新</Button>
toast.success('当前已是最新版本！')

// 应改为
<h2>{t('help.update.title')}</h2>
<Button>{t('help.update.checkUpdate')}</Button>
toast.success(t('help.toast.upToDate'))
```

## 🚀 实施建议

### 第一阶段: 核心页面 (1-2 天)
1. Skills 页面完整多语言化
2. Help 页面完整多语言化
3. Provider 页面完整多语言化

### 第二阶段: Chat 功能 (1 天)
1. Chat 相关所有页面
2. Message 相关组件

### 第三阶段: 其他组件 (0.5 天)
1. 通用组件
2. 工具提示和错误消息

### 第四阶段: 测试和完善 (0.5 天)
1. 语言切换测试
2. 文案审校
3. 补充遗漏项

## 📋 详细清单

详细的文案清单和建议的 i18n 结构请查看:
👉 `docs/I18N_CHECKLIST.md`
