/**
 * Lightweight tRPC-like Implementation
 * 类型安全的 RPC 框架，使用 Zod 进行参数验证
 */

import type { z } from 'zod'

export type AnyZodSchema = z.ZodTypeAny

/**
 * Procedure 上下文类型
 */
export interface Context {
  [key: string]: any
}

/**
 * Procedure 配置
 */
export interface ProcedureConfig<TInput = unknown, TOutput = unknown> {
  input?: AnyZodSchema
  handler: (opts: { input: TInput, ctx: Context }) => Promise<TOutput> | TOutput
}

/**
 * Procedure 实例
 */
export class Procedure<TInput = unknown, TOutput = unknown> {
  constructor(
    private config: ProcedureConfig<TInput, TOutput>,
    private ctx: Context = {},
  ) {}

  async call(rawInput: unknown): Promise<TOutput> {
    // 验证输入
    const input = this.config.input
      ? this.config.input.parse(rawInput)
      : rawInput

    // 执行处理器
    return await this.config.handler({
      input: input as TInput,
      ctx: this.ctx,
    })
  }
}

/**
 * 创建 Procedure
 */
export function procedure() {
  return {
    input<TSchema extends AnyZodSchema>(schema: TSchema) {
      return {
        mutation<TOutput>(
          handler: (opts: {
            input: z.infer<TSchema>
            ctx: Context
          }) => Promise<TOutput> | TOutput,
        ) {
          return new Procedure<z.infer<TSchema>, TOutput>({
            input: schema,
            handler,
          })
        },
        query<TOutput>(
          handler: (opts: {
            input: z.infer<TSchema>
            ctx: Context
          }) => Promise<TOutput> | TOutput,
        ) {
          return new Procedure<z.infer<TSchema>, TOutput>({
            input: schema,
            handler,
          })
        },
      }
    },
    mutation<TOutput>(
      handler: (opts: { ctx: Context }) => Promise<TOutput> | TOutput,
    ) {
      return new Procedure<void, TOutput>({
        handler: async opts => handler({ ctx: opts.ctx }),
      })
    },
    query<TOutput>(
      handler: (opts: { ctx: Context }) => Promise<TOutput> | TOutput,
    ) {
      return new Procedure<void, TOutput>({
        handler: async opts => handler({ ctx: opts.ctx }),
      })
    },
  }
}

/**
 * Router 定义
 */
export interface Router {
  [key: string]: Procedure<any, any> | Router
}

/**
 * 推断 Router 的类型
 */
export type InferRouterInput<T extends Router> = {
  [K in keyof T]: T[K] extends Procedure<infer TInput, any> ? TInput : never;
}

export type InferRouterOutput<T extends Router> = {
  [K in keyof T]: T[K] extends Procedure<any, infer TOutput>
    ? TOutput
    : never;
}

/**
 * 创建 Router
 */
export function router<T extends Router>(routes: T): T {
  return routes
}

/**
 * Caller 返回类型
 */
export type CallerType<T extends Router> = {
  [K in keyof T]: T[K] extends Procedure<infer TInput, infer TOutput>
    ? undefined extends TInput
      ? (input?: TInput) => Promise<TOutput>
      : (input: TInput) => Promise<TOutput>
    : T[K] extends Router
      ? CallerType<T[K]>
      : never;
}

/**
 * 创建客户端调用器
 */
export function createCaller<T extends Router>(
  routerDef: T,
  ctx: Context = {},
): CallerType<T> {
  const caller: any = {}

  for (const [key, value] of Object.entries(routerDef)) {
    if (value instanceof Procedure) {
      caller[key] = async (input?: unknown) => {
        const proc = new Procedure(
          (value as any).config,
          ctx,
        )
        return await proc.call(input)
      }
    }
    else {
      // 嵌套路由
      caller[key] = createCaller(value as Router, ctx)
    }
  }

  return caller
}

/**
 * 合并多个 Router
 */
export function mergeRouters<T extends Router[]>(...routers: T): Router {
  const merged: Router = {}

  for (const r of routers) {
    Object.assign(merged, r)
  }

  return merged
}
