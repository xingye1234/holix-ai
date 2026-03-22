/**
 * Agent Lifecycle System - Public API
 */

// Core components
export { HookRegistry } from './hook-registry'
export { AgentOrchestrator, getOrchestrator, initializeOrchestrator } from './orchestrator'
export { MainProcessExecutor } from './executor/main'
export { contextProvider } from './context'

// Types
export * from './types'
