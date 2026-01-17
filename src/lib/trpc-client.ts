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
 * 请求配置选项
 */
export interface TRPCRequestOptions {
  /** 超时时间（毫秒） */
  timeout?: number
  /** 信号量，用于取消请求 */
  signal?: AbortSignal
}

/**
 * 全局默认配置
 */
let globalOptions: TRPCRequestOptions = {
  timeout: 10000, // 默认 10 秒
}

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
        return (input?: any, options?: TRPCRequestOptions) => {
          const routePath = currentPath.join('.')
          const mergedOptions = { ...globalOptions, ...options }

          return kyInstance
            .post(`trpc/${routePath}`, {
              json: input ?? {},
              timeout: mergedOptions.timeout,
              signal: mergedOptions.signal,
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
              return (input?: any, options?: TRPCRequestOptions) => {
                const routePath = fullPath.join('.')
                const mergedOptions = { ...globalOptions, ...options }

                return kyInstance
                  .post(`trpc/${routePath}`, {
                    json: input ?? {},
                    timeout: mergedOptions.timeout,
                    signal: mergedOptions.signal,
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

/**
 * 设置全局默认选项
 * @param options - 要设置的默认选项
 */
export function setTRPCOptions(options: Partial<TRPCRequestOptions>) {
  globalOptions = { ...globalOptions, ...options }
}

/**
 * 获取当前全局选项
 */
export function getTRPCOptions(): Readonly<TRPCRequestOptions> {
  return { ...globalOptions }
}

/**
 * 重置全局选项为默认值
 */
export function resetTRPCOptions() {
  globalOptions = {
    timeout: 10000,
  }
}
