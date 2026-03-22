import type { LifecycleAgent, AgentContext, AgentResult, ExecutionRequest } from '../types'

/**
 * Main Process Executor
 *
 * Executes agents in the main process with:
 * - Timeout control
 * - Abort signal support
 * - Error isolation
 */
export class MainProcessExecutor {
  /**
   * Execute an agent with timeout
   */
  async execute(request: ExecutionRequest): Promise<AgentResult> {
    const { agent, context, timeout, signal } = request
    const startTime = Date.now()

    try {
      // Create abort controller if not provided
      const controller = new AbortController()
      const effectiveSignal = signal || controller.signal

      // Set timeout
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, timeout)

      // Execute agent
      const result = await this.executeWithAbort(
        agent,
        context,
        effectiveSignal
      )

      clearTimeout(timeoutId)

      return {
        ...result,
        duration: Date.now() - startTime
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          agentId: agent.id,
          status: 'error',
          error: 'Execution timeout',
          duration: Date.now() - startTime
        }
      }

      return {
        agentId: agent.id,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Execute agent with abort signal
   */
  private async executeWithAbort(
    agent: LifecycleAgent,
    context: AgentContext,
    signal: AbortSignal
  ): Promise<AgentResult> {
    return new Promise((resolve, reject) => {
      const abortHandler = () => {
        reject(new Error('AbortError'))
      }

      signal.addEventListener('abort', abortHandler)

      agent.handler(context)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          signal.removeEventListener('abort', abortHandler)
        })
    })
  }
}
