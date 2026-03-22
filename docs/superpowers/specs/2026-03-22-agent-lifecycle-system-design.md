# Agent Lifecycle System Design

**Date:** 2026-03-22
**Status:** Draft
**Author:** Claude

## Overview

A comprehensive agent lifecycle system for Holix AI that enables built-in agents to execute at key points in the chat conversation. The system uses a hook-based architecture (via `hookable`) to allow agents to plug into the conversation flow, performing tasks like title generation, summarization, tool analysis, and agent recommendations.

## Goals

1. Provide a lifecycle system with hooks at key conversation points
2. Support automatic and manual agent execution
3. Enable agents to access full chat context (messages, tools, metadata)
4. Allow parallel execution of multiple agents per hook
5. Support agent recommendations for tool and agent selection
6. Maintain execution logs and suggestions for user review

## Non-Goals

- Frontend UI implementation (deferred to future phase)
- Custom agent creation by end users
- Distributed agent execution across multiple machines

## Architecture

### High-Level Diagram

```
Frontend (Renderer)
    │
    │ tRPC / IPC
    ▼
Main Process (Node.js)
    │
    ├── Chat System (Session Orchestrator)
    │       │
    │       └── triggers ─────────────────────┐
    │                                       │
    ▼                                       │
Agent Runner System                         │
    │                                       │
    ├── Hookable Lifecycle                  │
    ├── Agent Executor Pool                 │
    │   ├── Main Process Executor           │
    │   └── Worker Thread Executor          │
    ├── Built-in Agents                     │
    │   ├── TitleGenerator                  │
    │   ├── ChatSummarizer                  │
    │   ├── AgentRecommender                │
    │   ├── ToolAnalyzer                    │
    │   └── ErrorHandler                    │
    └── Context Provider                    │
                                            │
                                            ▼
                                      Database
                                      - agent_execution_log
                                      - agent_suggestion
```

### Directory Structure

```
src/node/agents/
├── index.ts                    # Existing Agents class (CRUD)
├── runner.ts                   # AgentRunner core class
├── hooks.ts                    # Lifecycle hooks definitions
├── executor/
│   ├── index.ts                # Executor interfaces and pool
│   ├── main.ts                 # Main process executor
│   └── worker.ts               # Worker thread executor
├── builtin/
│   ├── index.ts                # Export all built-in agents
│   ├── title-generator.ts      # Auto-generate chat titles
│   ├── chat-summarizer.ts      # Summarize long conversations
│   ├── agent-recommender.ts    # Recommend appropriate agents
│   ├── tool-analyzer.ts        # Analyze tool usage patterns
│   └── error-handler.ts        # Handle and analyze errors
├── context.ts                  # ContextProvider for full chat state
├── error-handler.ts            # Error handling and retry logic
├── performance.ts              # Caching, throttling, batching
└── types.ts                    # Extended type definitions
```

## Core Components

### 1. AgentRunner

The central orchestrator for agent execution.

**Responsibilities:**
- Register agents and their hook subscriptions
- Trigger hooks from the chat system
- Route agents to appropriate executors
- Manage execution lifecycle

**Key Methods:**
- `registerAgent(agent: AgentExecutable): void` - Register an agent
- `triggerHook(hook: AgentHook, chatUid: string, data?: unknown): Promise<AgentResult[]>` - Trigger a hook
- `listAgents(): AgentExecutable[]` - List all registered agents

### 2. Hookable Lifecycle

Based on the `hookable` library, defines 7 hooks:

| Hook | Trigger Point | Use Cases |
|------|---------------|-----------|
| `onChatCreated` | New chat created | Initial title generation, agent setup |
| `onMessageStreaming` | Message streaming | Real-time analysis, prepare suggestions |
| `onMessageCompleted` | Message finished | Title update, agent recommendations |
| `onChatIdle` | User inactive (30s) | Summarization, archival suggestions |
| `onMessageError` | Message error | Error analysis, recovery suggestions |
| `onToolCalled` | Tool invoked | Usage tracking, preparation |
| `onToolCompleted` | Tool finished | Result analysis, next-step suggestions |

**Features:**
- Parallel execution of all subscribed agents
- Priority-based ordering
- Hook-specific throttling

### 3. Agent Executor Pool

Manages execution environments based on agent complexity.

**Executor Types:**
- **Main Process Executor**: For simple agents (title generation, simple analysis)
- **Worker Thread Executor**: For complex agents (summarization, deep analysis)

**Selection Logic:**
```typescript
complexity === 'simple' → Main Process
complexity === 'complex' → Worker Thread
```

**Worker Pool:**
- Configurable number of worker threads
- Simple load balancing (round-robin)
- 30s timeout per execution

### 4. Context Provider

Supplies agents with complete chat context.

**Provided Data:**
```typescript
interface AgentContext {
  chatUid: string
  messages: Message[]           // Full message history
  chat: Chat                    // Chat configuration
  event: {
    hook: AgentHook
    data: unknown               // Hook-specific data
  }
  tools: {
    callTool: (name, args) => Promise<unknown>
    listTools: () => Tool[]
  }
}
```

### 5. Built-in Agents

| Agent | Hook | Mode | Complexity | Description |
|-------|------|------|------------|-------------|
| TitleGenerator | onMessageCompleted | auto | simple | Generate/update chat titles every 5 messages |
| ChatSummarizer | onChatIdle | suggest | complex | Suggest summary when messages > 20 |
| AgentRecommender | onMessageCompleted | suggest | simple | Analyze user intent, recommend agents |
| ToolAnalyzer | onToolCompleted | auto | simple | Track tool usage patterns |
| ErrorHandler | onMessageError | suggest | simple | Analyze errors, provide recovery steps |

## Type Definitions

### Agent Configuration

```typescript
type ExecutionMode = 'auto' | 'suggest' | 'manual'
type AgentComplexity = 'simple' | 'complex'

type AgentHook =
  | 'onChatCreated'
  | 'onMessageStreaming'
  | 'onMessageCompleted'
  | 'onChatIdle'
  | 'onMessageError'
  | 'onToolCalled'
  | 'onToolCompleted'

interface AgentHookConfig {
  hook: AgentHook
  priority: number              // Lower = earlier execution
  mode: ExecutionMode
  complexity: AgentComplexity
}

interface AgentExecutable extends Agent {
  hooks: Record<AgentHook, AgentHookConfig | undefined>
  handler: (context: AgentContext) => Promise<AgentResult>
}
```

### Execution Results

```typescript
interface AgentResult {
  agentId: string
  status: 'success' | 'error' | 'suggest'
  data?: unknown
  suggestion?: {
    type: 'title' | 'summary' | 'tool' | 'agent' | 'action'
    content: string
    metadata?: Record<string, unknown>
  }
  error?: string
}
```

## Database Schema

### agent_execution_log

Records every agent execution for debugging and analytics.

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| uid | text | Unique ID |
| chatUid | text | Associated chat |
| agentId | text | Agent identifier |
| hook | text | Triggered hook |
| status | text | pending/running/success/error/suggest |
| resultData | json | Result data |
| suggestion | json | Suggestion data (if any) |
| error | text | Error message (if failed) |
| duration | integer | Execution time (ms) |
| createdAt | integer | Start timestamp |
| completedAt | integer | End timestamp |

**Indexes:** chatUid, agentId, hook, status, createdAt

### agent_suggestion

Persists user-pending suggestions.

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| uid | text | Unique ID |
| chatUid | text | Associated chat |
| agentId | text | Agent identifier |
| type | text | Suggestion type |
| content | text | Suggestion content |
| metadata | json | Additional metadata |
| status | text | pending/accepted/dismissed/expired |
| expiresAt | integer | Expiration timestamp |
| createdAt | integer | Creation timestamp |

**Indexes:** chatUid, status, expiresAt

## Error Handling

### Retry Strategy

- **Max Retries:** 3
- **Retry Delay:** 1000ms × (retryCount + 1)
- **Retryable Errors:** timeout, ECONNREFUSED, ETIMEDOUT, fetch failed

### Error Logging

All errors are logged to `agent_execution_log` with full context.

### Error Callback

Optional callback for custom error handling:
```typescript
onError?: (error: Error, agentId: string, retryCount: number) => void
```

## Performance Optimizations

### 1. Execution Cache

- **Key:** `agentId:chatUid:lastMessageSeq`
- **TTL:** 60 seconds (configurable)
- **Invalidation:** On new message or manual clear

### 2. Hook Throttling

Prevents excessive agent execution:

| Hook | Throttle Window |
|------|-----------------|
| onMessageCompleted | 2 seconds |
| onChatIdle | 30 seconds |
| onMessageStreaming | 500ms |

### 3. Batch Processing

Merges identical hook triggers within 100ms window to avoid redundant execution.

## Chat System Integration

The `SessionOrchestrator` triggers hooks at key points:

```typescript
// Create chat
await agentRunner.triggerHook('onChatCreated', chat.uid, { chat })

// Message completed
await agentRunner.triggerHook('onMessageCompleted', chatUid, { message })

// Message streaming
await agentRunner.triggerHook('onMessageStreaming', chatUid, { message })

// Message error
await agentRunner.triggerHook('onMessageError', chatUid, { error })

// Tool called/completed
await agentRunner.triggerHook('onToolCalled', chatUid, { toolCall })
await agentRunner.triggerHook('onToolCompleted', chatUid, { result })

// Idle detection (30s after user activity)
await agentRunner.triggerHook('onChatIdle', chatUid, {})
```

## Manual Trigger API

Users can manually trigger hooks via tRPC:

```typescript
// tRPC route
agentRouter.triggerHook({
  chatUid: string,
  hook: AgentHook
})
```

This enables frontend actions like:
- "Generate title now"
- "Summarize conversation"
- "Analyze with agent X"

## Security Considerations

### Agent Isolation

- Worker threads for complex agents prevent main process blocking
- Agent execution is bounded (30s timeout)
- No direct file system access from agents

### Approval Flow

High-risk operations use `mode: 'suggest'` requiring user approval.

### Tool Access

Agents can call tools through the context provider, which respects existing tool approval systems.

## Future Enhancements

1. **Custom Agents**: Allow users to define custom agents
2. **Agent Marketplace**: Share and discover agents
3. **Agent Composition**: Chain multiple agents
4. **Streaming Results**: Real-time agent output streaming
5. **Agent Permissions**: Fine-grained access control
6. **Agent Telemetry**: Usage analytics and optimization

## Dependencies

- `hookable` - Lifecycle hook system
- `drizzle-orm` - Database operations
- `worker_threads` - Worker thread execution
- Existing chat, skills, and MCP systems

## Testing Strategy

1. **Unit Tests**: Individual agent handlers
2. **Integration Tests**: Hook execution and routing
3. **Performance Tests**: Concurrent agent execution
4. **Database Tests**: Log and suggestion persistence
