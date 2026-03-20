import type { Agent } from './types'

/**
 * Built-in agents defined in code
 * These cannot be modified or deleted by users
 */
export const BUILTIN_AGENTS: Agent[] = [
  {
    id: 'general-assistant',
    name: 'General Assistant',
    description: 'Balanced default assistant for common Q&A and daily tasks.',
    category: 'general',
    tags: ['general', 'productivity'],
    prompt: 'You are a helpful and concise assistant.',
    skills: [],
    mcps: [],
    provider: '',
    model: '',
    variables: [],
    map: {
      planning: 0.6,
      reasoning: 0.6,
      toolUse: 0.5,
    },
    version: '1.0.0',
    isBuiltin: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'code-copilot',
    name: 'Code Copilot',
    description: 'Focused on coding, debugging and code review tasks.',
    category: 'development',
    tags: ['coding', 'debugging', 'review'],
    prompt: 'You are a senior software engineer helping with coding tasks. Provide clear, well-commented code solutions and explain your reasoning.',
    skills: ['code-reader', 'file-system'],
    mcps: [],
    provider: '',
    model: '',
    variables: [
      {
        name: 'language',
        type: 'string',
        default: 'TypeScript',
        description: 'Primary programming language',
      },
    ],
    map: {
      planning: 0.7,
      reasoning: 0.9,
      toolUse: 0.8,
    },
    version: '1.0.0',
    isBuiltin: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]
