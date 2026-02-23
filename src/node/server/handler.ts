/**
 * tRPC 路由处理
 * 将 HTTP 请求路由到对应的 tRPC procedures
 */

import type { HolixProtocolRouter } from '@holix/router'
import { logger } from '../platform/logger'
import { appRouter } from './router'
import { createCaller } from './trpc'

/**
 * 注册 tRPC 路由处理
 */
export function trpcRouter(router: HolixProtocolRouter) {
  const caller = createCaller(appRouter)

  router.post('/trpc/:path', async (ctx, next) => {
    try {
      // 获取路由路径，例如 "chat.create"
      const path = ctx.params.path as string
      const pathParts = path.split('.')

      if (pathParts.length !== 2) {
        ctx.status(400).json({
          error: 'Invalid route path',
          message: 'Path must be in format: namespace.method',
        })
        return
      }

      const [namespace, method] = pathParts

      // 检查路由是否存在
      if (!(namespace in caller)) {
        ctx.status(404).json({
          error: 'Namespace not found',
          message: `Namespace '${namespace}' does not exist`,
        })
        return
      }

      const namespaceCaller = caller[namespace as keyof typeof caller]
      if (typeof namespaceCaller !== 'object' || namespaceCaller === null) {
        ctx.status(500).json({
          error: 'Invalid namespace',
          message: `'${namespace}' is not a valid router`,
        })
        return
      }

      if (!(method in namespaceCaller)) {
        ctx.status(404).json({
          error: 'Method not found',
          message: `Method '${method}' does not exist in '${namespace}'`,
        })
        return
      }

      // 获取请求体
      const input = await ctx.req.json()

      // 调用对应的 procedure
      const procedureFn
        = namespaceCaller[method as keyof typeof namespaceCaller]
      if (typeof procedureFn !== 'function') {
        ctx.status(500).json({
          error: 'Invalid procedure',
          message: `'${namespace}.${method}' is not callable`,
        })
        return
      }

      const result = await (procedureFn as (...args: unknown[]) => Promise<unknown>)(input)

      // 返回结果
      ctx.status(200).json(result)
    }
    catch (error) {
      logger.error('tRPC route error:', error)

      // 处理错误
      if (error instanceof Error) {
        ctx.status(500).json({
          error: error.name,
          message: error.message,
        })
      }
      else {
        ctx.status(500).json({
          error: 'Internal Server Error',
          message: 'An unknown error occurred',
        })
      }
    }

    await next()
  })
}
