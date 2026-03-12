# 版本管理与更新日志生成指南

本项目使用自动化脚本来管理版本号和生成更新日志，基于 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

## 📋 目录

- [提交规范](#提交规范)
- [可用命令](#可用命令)
- [工作流程](#工作流程)
- [文件说明](#文件说明)

## 📝 提交规范

项目使用 Conventional Commits 规范，提交消息格式如下：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 常用类型 (type)

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链相关

### 示例

```bash
feat(chat): add message streaming support
fix(database): resolve connection timeout issue
docs(readme): update installation instructions
refactor(ui): simplify component structure
```

## 🛠️ 可用命令

### 1. 生成完整 CHANGELOG

```bash
pnpm run changelog
```

生成或更新 `CHANGELOG.md` 文件，包含所有历史版本的更新记录。

### 2. 生成当前版本的 Release Notes

```bash
pnpm run release-notes
```

生成 `RELEASE_NOTES.md` 文件，包含当前版本的更新内容，适合用于 GitHub Release。

### 3. 版本升级

```bash
# 补丁版本 (0.0.2 -> 0.0.3)
pnpm run version:patch

# 次版本 (0.0.2 -> 0.1.0)
pnpm run version:minor

# 主版本 (0.0.2 -> 1.0.0)
pnpm run version:major
```

版本升级命令会自动：
1. 更新 `package.json` 中的版本号
2. 生成 `CHANGELOG.md`
3. 生成 `RELEASE_NOTES.md`

## 🔄 工作流程

### 发布新版本的完整流程

1. **确保所有更改已提交**
   ```bash
   git status
   ```

2. **升级版本并生成文档**
   ```bash
   # 根据更改类型选择合适的版本升级
   pnpm run version:patch  # 或 minor/major
   ```

3. **检查生成的文件**
   - 查看 `CHANGELOG.md` 确认更新记录
   - 查看 `RELEASE_NOTES.md` 确认发布说明
   - 检查 `package.json` 中的版本号

4. **提交更改**
   ```bash
   git add .
   git commit -m "chore: release v0.0.3"
   ```

5. **创建 Git 标签**
   ```bash
   git tag v0.0.3
   ```

6. **推送到远程仓库**
   ```bash
   git push
   git push --tags
   ```

7. **构建并发布**
   ```bash
   pnpm run release
   ```

8. **创建 GitHub Release**
   - 访问 GitHub 仓库的 Releases 页面
   - 点击 "Create a new release"
   - 选择刚创建的标签
   - 将 `RELEASE_NOTES.md` 的内容复制到发布说明中
   - 上传构建好的安装包
   - 发布

## 📄 文件说明

### CHANGELOG.md

完整的版本历史记录，包含：
- 所有版本的更新内容
- 按类型分组（Features, Bug Fixes, etc.）
- 每个更改的 commit hash 和链接

### RELEASE_NOTES.md

当前版本的发布说明，包含：
- 版本号和日期
- 新功能列表
- Bug 修复列表
- 其他更改

适合用于：
- GitHub Release 描述
- 用户通知
- 更新公告

## 🔧 脚本说明

### scripts/generate-changelog.js

使用 `conventional-changelog` 解析 git 提交历史，生成标准的 CHANGELOG.md。

### scripts/generate-release-notes.js

从 CHANGELOG.md 或 git 提交历史中提取当前版本的更新内容，生成适合发布的格式。

### scripts/bump-version.js

自动化版本升级流程：
1. 计算新版本号
2. 更新 package.json
3. 生成 CHANGELOG.md
4. 生成 RELEASE_NOTES.md
5. 提供后续步骤提示

## 💡 最佳实践

1. **遵循提交规范**：确保所有提交消息都符合 Conventional Commits 规范
2. **及时提交**：将相关更改组织成有意义的提交
3. **清晰的描述**：在提交消息中清楚地描述更改内容
4. **定期发布**：积累一定数量的更改后及时发布新版本
5. **检查生成的文档**：发布前仔细检查 CHANGELOG 和 Release Notes

## 🔗 相关资源

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
