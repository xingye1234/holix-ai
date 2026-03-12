# Version Management & Changelog Generation Guide

This project uses automated scripts to manage version numbers and generate changelogs based on [Conventional Commits](https://www.conventionalcommits.org/) specification.

## 📋 Table of Contents

- [Commit Convention](#commit-convention)
- [Available Commands](#available-commands)
- [Workflow](#workflow)
- [File Descriptions](#file-descriptions)

## 📝 Commit Convention

The project follows Conventional Commits specification. Commit message format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Common Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation update
- `style`: Code style changes (no functional changes)
- `refactor`: Code refactoring
- `perf`: Performance optimization
- `test`: Test related
- `chore`: Build/toolchain related

### Examples

```bash
feat(chat): add message streaming support
fix(database): resolve connection timeout issue
docs(readme): update installation instructions
refactor(ui): simplify component structure
```

## 🛠️ Available Commands

### 1. Generate Complete CHANGELOG

```bash
pnpm run changelog
```

Generates or updates `CHANGELOG.md` file with all historical version records.

### 2. Generate Release Notes for Current Version

```bash
pnpm run release-notes
```

Generates `RELEASE_NOTES.md` file with current version updates, suitable for GitHub Release.

### 3. Version Bump

```bash
# Patch version (0.0.2 -> 0.0.3)
pnpm run version:patch

# Minor version (0.0.2 -> 0.1.0)
pnpm run version:minor

# Major version (0.0.2 -> 1.0.0)
pnpm run version:major
```

Version bump commands automatically:
1. Update version number in `package.json`
2. Generate `CHANGELOG.md`
3. Generate `RELEASE_NOTES.md`

## 🔄 Workflow

### Complete Release Process

1. **Ensure all changes are committed**
   ```bash
   git status
   ```

2. **Bump version and generate documentation**
   ```bash
   # Choose appropriate version bump based on changes
   pnpm run version:patch  # or minor/major
   ```

3. **Review generated files**
   - Check `CHANGELOG.md` for update records
   - Check `RELEASE_NOTES.md` for release notes
   - Verify version number in `package.json`

4. **Commit changes**
   ```bash
   git add .
   git commit -m "chore: release v0.0.3"
   ```

5. **Create Git tag**
   ```bash
   git tag v0.0.3
   ```

6. **Push to remote repository**
   ```bash
   git push
   git push --tags
   ```

7. **Build and release**
   ```bash
   pnpm run release
   ```

8. **Create GitHub Release**
   - Visit GitHub repository Releases page
   - Click "Create a new release"
   - Select the tag you just created
   - Copy content from `RELEASE_NOTES.md` to release description
   - Upload built installers
   - Publish

## 📄 File Descriptions

### CHANGELOG.md

Complete version history including:
- All version updates
- Grouped by type (Features, Bug Fixes, etc.)
- Commit hash and links for each change

### RELEASE_NOTES.md

Release notes for current version including:
- Version number and date
- List of new features
- List of bug fixes
- Other changes

Suitable for:
- GitHub Release description
- User notifications
- Update announcements

## 🔧 Script Descriptions

### scripts/generate-changelog.js

Uses `conventional-changelog` to parse git commit history and generate standard CHANGELOG.md.

### scripts/generate-release-notes.js

Extracts current version updates from CHANGELOG.md or git commit history, generates release-ready format.

### scripts/bump-version.js

Automates version bump process:
1. Calculate new version number
2. Update package.json
3. Generate CHANGELOG.md
4. Generate RELEASE_NOTES.md
5. Provide next steps guidance

## 💡 Best Practices

1. **Follow commit convention**: Ensure all commit messages follow Conventional Commits specification
2. **Commit regularly**: Organize related changes into meaningful commits
3. **Clear descriptions**: Clearly describe changes in commit messages
4. **Release regularly**: Release new versions after accumulating meaningful changes
5. **Review generated docs**: Carefully review CHANGELOG and Release Notes before publishing

## 🔗 Related Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
