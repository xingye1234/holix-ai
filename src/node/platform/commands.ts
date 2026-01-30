import type { HolixProtocolRouter } from '@holix/router'
import type { CommandBatch, CommandNames, Commands } from '@/types/commands'

/**
 * Handler for a specific command name `N` - receives typed payload and full command.
 */
export type SpecificCommandHandler<N extends CommandNames> = (
  payload: Extract<Commands, { name: N }>['payload'],
  command: Extract<Commands, { name: N }>,
) => void | Promise<void>

/**
 * Generic handler that receives the full `Commands` union (for logging/fallbacks).
 */
export type GenericCommandHandler = (command: Commands) => void | Promise<void>

const handlersByName = new Map<CommandNames, Set<SpecificCommandHandler<any>>>()
const genericHandlers = new Set<GenericCommandHandler>()

/**
 * Register a handler for a specific command name.
 * Returns an unsubscribe function.
 */
export function onCommand<N extends CommandNames>(
  name: N,
  fn: SpecificCommandHandler<N>,
) {
  const set = handlersByName.get(name) ?? new Set()
  set.add(fn as SpecificCommandHandler<any>)
  handlersByName.set(name, set)
  return () => set.delete(fn as SpecificCommandHandler<any>)
}

/**
 * Register a generic handler that receives every command.
 * Returns an unsubscribe function.
 */
export function onCommandAny(fn: GenericCommandHandler) {
  genericHandlers.add(fn)
  return () => genericHandlers.delete(fn)
}

/**
 * Dispatch an incoming batch of commands to matching handlers.
 */
export async function dispatchCommands(commands: CommandBatch) {
  for (const command of commands) {
    const name = command.name as CommandNames

    // specific handlers
    const set = handlersByName.get(name)
    if (set) {
      for (const h of Array.from(set)) {
        try {
          await (h as any)(command.payload, command)
        }
        catch (err) {
          // don't break other handlers

          console.error('specific command handler error:', err)
        }
      }
    }

    // generic handlers
    for (const gh of Array.from(genericHandlers)) {
      try {
        await gh(command)
      }
      catch (err) {
        console.error('generic command handler error:', err)
      }
    }
  }
}

export function onCommandForClient(router: HolixProtocolRouter) {
  router.post('/command', async (ctx, next) => {
    const commands: CommandBatch = await ctx.req.json()
    ctx.status(200).json({ success: true })
    // dispatch to any registered in-process command handlers
    void dispatchCommands(commands)
    await next()
  })
}
