import type { EventEnvelope } from './base'

// 窗口最小化更新（无负载）
export type WindowMinimizeEnvelope = EventEnvelope<'window.minimize', {}>

// 窗口最大化/还原更新，payload 表示当前是否为最大化
export type WindowMaximizeEnvelope = EventEnvelope<
  'window.maximize',
  { maximized: boolean }
>

// 窗口关闭更新（无负载）
export type WindowCloseEnvelope = EventEnvelope<'window.close', {}>

// 可选：将三者合并为一个联合类型
export type WindowUpdateEnvelope
  = | WindowMinimizeEnvelope
    | WindowMaximizeEnvelope
    | WindowCloseEnvelope
