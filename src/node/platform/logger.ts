import { dirname, join } from 'node:path'
import process from 'node:process'
import { app } from 'electron'
import logger from 'electron-log/main'

/**
 * 获取日志文件路径
 */
function getLogPath(): string {
  const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development'
  if (isDev) {
    return join(process.cwd(), '.holixai', 'logs')
  }
  else {
    const appPath = app.isPackaged
      ? dirname(process.execPath)
      : app.getAppPath()
    return join(appPath, 'logs')
  }
}

let isInitialized = false

if (!isInitialized) {
  // ============================================
  // 日志路径配置
  // ============================================
  const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development'
  const logPath = getLogPath()

  // ============================================
  // 初始化日志配置
  // ============================================
  logger.initialize()

  // 设置日志文件路径
  logger.transports.file.resolvePathFn = () => join(logPath, 'main.log')

  // ============================================
  // 日志级别配置
  // ============================================
  if (isDev) {
    // 开发模式：显示所有级别的日志
    logger.transports.file.level = 'debug'
    logger.transports.console.level = 'debug'
  }
  else {
    // 生产模式：只记录 info 及以上级别
    logger.transports.file.level = 'info'
    logger.transports.console.level = 'info'
  }

  // ============================================
  // 日志格式配置
  // ============================================
  logger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
  logger.transports.console.format = '{h}:{i}:{s}.{ms} > {text}'

  // ============================================
  // 日志文件管理
  // ============================================
  // 最大日志文件大小（10MB）
  logger.transports.file.maxSize = 10 * 1024 * 1024

  // 日志文件归档配置（保留最近 7 天的日志）
  logger.transports.file.archiveLogFn = (_file) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    return join(logPath, 'archive', `main-${timestamp}.log`)
  }

  // ============================================
  // 捕获未处理的错误
  // ============================================
  logger.errorHandler.startCatching({
    showDialog: false,
    onError: (error) => {
      logger.error('[Uncaught Error]', error)
    },
  })

  // ============================================
  // 启动日志
  // ============================================
  logger.info('='.repeat(60))
  logger.info('Logger initialized')
  logger.info(`Environment: ${isDev ? 'Development' : 'Production'}`)
  logger.info(`Log path: ${logPath}`)
  logger.info(`App version: ${app.getVersion()}`)
  logger.info(`Electron version: ${process.versions.electron}`)
  logger.info(`Node version: ${process.versions.node}`)
  logger.info(`Platform: ${process.platform} ${process.arch}`)
  logger.info('='.repeat(60))

  isInitialized = true
}

/**
 * 获取主日志文件完整路径
 */
function getMainLogFile(): string {
  return join(getLogPath(), 'main.log')
}

export { getLogPath, getMainLogFile, logger }
