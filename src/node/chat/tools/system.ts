import os from 'node:os'
import process from 'node:process'
import { tool } from 'langchain'
import z from 'zod'
import { logger } from '../../platform/logger'

export const systemPlatformTool = tool(
  async () => {
    logger.info('Fetching system platform information...')
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpus: os.cpus().length,
    }
  },
  {
    name: 'system_platform',
    description: 'Get operating system and hardware platform information.',
    schema: z.object({}),
  },
)

export const systemEnvTool = tool(
  async () => {
    logger.info('Fetching system environment information...')
    return {
      nodeVersion: process.version,
      env: process.env.NODE_ENV ?? 'unknown',
    }
  },
  {
    name: 'system_env',
    description: 'Get basic runtime environment information.',
    schema: z.object({}),
  },
)

export const systemTimezoneTool = tool(
  async () => {
    const timezone
      = Intl.DateTimeFormat().resolvedOptions().timeZone

    logger.info('Fetching system timezone information...', { timezone })

    return {
      timezone,
      offsetMinutes: new Date().getTimezoneOffset(),
    }
  },
  {
    name: 'system_timezone',
    description: 'Get the current system timezone information.',
    schema: z.object({}),
  },
)

export const systemTimeTool = tool(
  async () => {
    const now = new Date()

    logger.info('Fetching current system time...', { now: now.toISOString() })

    return {
      timestamp: now.getTime(),
      iso: now.toISOString(),
      locale: now.toString(),
    }
  },
  {
    name: 'system_time',
    description: 'Get the current system time.',
    schema: z.object({}),
  },
)
