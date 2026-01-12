/**
 * tRPC 客户端
 * 提供类型安全的 API 调用
 */

import type { AppRouter } from '../node/server/router'
import type { CallerType } from '../node/server/trpc'
import { kyInstance } from './ky'

export type InferProcedureInput<T> = T extends (...args: infer P) => any
  ? P[0]
  : never

export type InferProcedureOutput<T> = T extends (...args: any[]) => Promise<infer R>
  ? R
  : never

/**
 * 创建客户端代理，将方法调用转换为 HTTP 请求
 */
function createClientProxy<T extends Record<string, any>>(
  path: string[] = [],
): T {
  return new Proxy(
    {} as T,
    {
      get(_target, prop: string) {
        const currentPath = [...path, prop]

        // 返回一个函数，该函数发送 HTTP 请求
        return (input?: any) => {
          const routePath = currentPath.join('.')

          return kyInstance
            .post(`trpc/${routePath}`, {
              json: input ?? {},
            })
            .json()
        }
      },
    },
  )
}

/**
 * 创建嵌套路由客户端
 */
function createNestedClient<T extends Record<string, any>>(
  basePath: string[] = [],
): T {
  return new Proxy(
    {} as T,
    {
      get(_target, prop: string) {
        const currentPath = [...basePath, prop]

        // 创建嵌套代理，支持链式调用
        return new Proxy(
          {} as any,
          {
            get(_nestedTarget, nestedProp: string) {
              const fullPath = [...currentPath, nestedProp]

              // 返回一个函数，发送 HTTP 请求
              return (input?: any) => {
                const routePath = fullPath.join('.')

                return kyInstance
                  .post(`trpc/${routePath}`, {
                    json: input ?? {},
                  })
                  .json()
              }
            },
          },
        )
      },
    },
  )
}

/**
 * 导出类型安全的客户端实例
 */
export const trpcClient = createNestedClient<CallerType<AppRouter>>()
