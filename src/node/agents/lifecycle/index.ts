/**
 * Agent Lifecycle System - Public API
 */

// Core components
export { HookRegistry } from './hook-registry'
export { AgentOrchestrator, initializeOrchestrator, getOrchestrator } from './orchestrator'
export { MainProcessExecutor } from './executor/main'
export { contextProvider } from './context'

// Types
export * from './types'
