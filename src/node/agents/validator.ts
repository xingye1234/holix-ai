import { readFile } from 'node:fs/promises'
import z from 'zod'

/**
 * Zod schema for validating agent files
 */
export const AgentVariableSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean']),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().optional(),
})

export const AgentFileSchema = z.object({
  version: z.string().default('1.0.0'),
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('general'),
  tags: z.array(z.string()).default([]),
  prompt: z.string().min(1),
  skills: z.array(z.string()).default([]),
  mcps: z.array(z.string()).default([]),
  provider: z.string().default(''),
  model: z.string().default(''),
  variables: z.array(AgentVariableSchema).default([]),
  map: z.record(z.string(), z.number()).default({}),
})

export type AgentFileInput = z.infer<typeof AgentFileSchema>

/**
 * Validate and parse an agent file
 */
export async function loadAndValidateAgentFile(filePath: string): Promise<{
  success: boolean
  data?: AgentFileInput
  error?: string
}> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const json = JSON.parse(content)
    const result = AgentFileSchema.safeParse(json)

    if (result.success) {
      return { success: true, data: result.data }
    }
    else {
      // Format zod error
      const errorList = result.error.issues?.map(e =>
        `${e.path.length > 0 ? e.path.join('.') : 'root'}: ${e.message}`,
      ).join(', ') || result.error.message || 'Unknown validation error'
      return {
        success: false,
        error: `Validation failed: ${errorList}`,
      }
    }
  }
  catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Validate agent data without file I/O
 */
export function validateAgentData(data: unknown): {
  success: boolean
  data?: AgentFileInput
  error?: string
} {
  const result = AgentFileSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }
  else {
    // Format zod error
    const errorList = result.error.issues?.map(e =>
      `${e.path.length > 0 ? e.path.join('.') : 'root'}: ${e.message}`,
    ).join(', ') || result.error.message || 'Unknown validation error'
    return {
      success: false,
      error: `Validation failed: ${errorList}`,
    }
  }
}

/**
 * Validate map structure
 */
export function validateMap(map: unknown): {
  valid: boolean
  error?: string
} {
  if (typeof map !== 'object' || map === null) {
    return { valid: false, error: 'map must be an object' }
  }

  const keys = ['planning', 'reasoning', 'toolUse']
  for (const key of keys) {
    if (!(key in map)) {
      return { valid: false, error: `Missing required key: ${key}` }
    }
    const value = (map as Record<string, unknown>)[key]
    if (typeof value !== 'number' || value < 0 || value > 1) {
      return { valid: false, error: `${key} must be a number between 0 and 1` }
    }
  }

  return { valid: true }
}
