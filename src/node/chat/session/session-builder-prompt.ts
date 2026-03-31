import type { Workspace } from '../../database/schema/chat'

interface BuildSessionSystemPromptOptions {
  systemMessages?: string[]
  workspace?: Workspace[]
}

export function buildSessionSystemPrompt(options: BuildSessionSystemPromptOptions): string {
  const parts: string[] = []

  if (options.systemMessages) {
    parts.push(...options.systemMessages)
  }

  const workspacePrompt = buildWorkspacePrompt(options.workspace)
  if (workspacePrompt) {
    parts.push(workspacePrompt)
  }

  parts.push(buildLongTermMemoryPrompt())

  return parts.join('\n\n')
}

function buildWorkspacePrompt(workspace?: Workspace[]): string | null {
  if (!workspace || workspace.length === 0) {
    return null
  }

  const dirs = workspace
    .filter(w => w.type === 'directory')
    .map(w => `  - ${w.value}`)

  const files = workspace
    .filter(w => w.type === 'file')
    .map(w => `  - ${w.value}`)

  const lines: string[] = [
    '## Workspace',
    '',
    'The user has configured the following local paths for this conversation.',
    'You can use the filesystem tools (`ls`, `glob`, `grep`, `read_file`, `write_file`, `edit_file`) to inspect or modify these paths when needed:',
  ]

  if (dirs.length > 0) {
    lines.push('', '**Directories:**', ...dirs)
  }

  if (files.length > 0) {
    lines.push('', '**Files:**', ...files)
  }

  lines.push(
    '',
    'When the user asks about code, files, or project structure, look in these paths first.',
    'Always prefer reading the actual files rather than guessing their content.',
  )

  return lines.join('\n')
}

function buildLongTermMemoryPrompt() {
  return [
    '## Long-Term Memory',
    '',
    'You have a durable memory directory at `/memories/` that persists across conversations.',
    'Use it to keep stable user preferences, recurring project conventions, and other facts that are likely to matter again later.',
    '',
    'Before answering requests that depend on durable preferences or prior facts, check the relevant files under `/memories/`.',
    'When the user explicitly asks you to remember something, or clearly shares a durable preference or profile fact, update an appropriate file under `/memories/`.',
    '',
    'Suggested files:',
    '- `/memories/user_preferences.md` for communication style and recurring preferences',
    '- `/memories/profile.md` for stable user background information',
    '- `/memories/project_notes.md` for cross-conversation project conventions',
    '',
    'Store concise, useful, non-sensitive information by default. Do not save secrets unless the user explicitly asks you to do so.',
  ].join('\n')
}
