type SSEEventHandler = (data: any, rawEvent: MessageEvent) => void
type SSEVoidHandler = (event: Event) => void

class HolixSSEClient {
  private readonly url: string = 'holix://app/channel'
  private source: EventSource | null = null
  private listeners = new Map<string, Set<SSEEventHandler>>()
  private openHandlers = new Set<SSEVoidHandler>()
  private errorHandlers = new Set<SSEVoidHandler>()
  /** 确保连接只建立一次 */
  private ensureConnected() {
    if (this.source)
      return
    this.source = new EventSource(this.url)

    this.source.addEventListener('open', (e) => {
      this.openHandlers.forEach(h => h(e))
    })

    this.source.addEventListener('error', (e) => {
      this.errorHandlers.forEach(h => h(e))
    })

    // 默认 message 事件
    this.source.addEventListener('message', (e) => {
      this.dispatch('message', e)
    })
  }

  /** 分发事件 */
  private dispatch(type: string, event: MessageEvent) {
    const handlers = this.listeners.get(type)
    if (!handlers || handlers.size === 0)
      return

    let payload = event.data
    try {
      payload = JSON.parse(event.data)
    }
    catch {
      // 允许非 JSON
    }

    handlers.forEach((handler) => {
      handler(payload, event)
    })
  }

  /** 监听自定义事件 */
  on(event: string, handler: SSEEventHandler) {
    this.ensureConnected()

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)?.add(handler)

    return () => {
      this.listeners.get(event)?.delete(handler)
    }
  }

  onOpen(handler: SSEVoidHandler) {
    this.ensureConnected()
    this.openHandlers.add(handler)
    return () => this.openHandlers.delete(handler)
  }

  onError(handler: SSEVoidHandler) {
    this.ensureConnected()
    this.errorHandlers.add(handler)
    return () => this.errorHandlers.delete(handler)
  }

  /** 主动关闭（一般不建议用，除非窗口销毁） */
  close() {
    this.source?.close()
    this.source = null
  }
}

export const holixSSE = new HolixSSEClient()
