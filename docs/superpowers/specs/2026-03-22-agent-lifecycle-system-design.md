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
- `initialize(): Promise<void>` - Initialize worker pool and register built-in agents

**Initialization and Registration:**

The AgentRunner is a singleton that must be initialized during application startup:

```typescript
// src/node/agents/runner.ts

let _instance: AgentRunner | null = null

export async function initializeAgentRunner(): Promise<AgentRunner> {
  if (_instance)
    return _instance

  _instance = new AgentRunner()
  await _instance.initialize() // Spawns workers, registers agents
  return _instance
}

export const agentRunner = await initializeAgentRunner()
```

**Startup Sequence:**
1. During app initialization (`src/main/index.ts` or similar entry point), call `initializeAgentRunner()`
2. `AgentRunner.initialize()` spawns worker threads based on `AGENT_WORKER_COUNT`
3. Built-in agents are registered by calling `registerBuiltinAgents()`
4. AgentRunner is ready to receive hook triggers

**Agent Registration:**
- Built-in agents registered during `initialize()` phase
- Each agent's `AgentHookConfig` specifies which hooks it responds to
- Agents are stored in a Map for O(1) lookup during hook execution

**Integration with Existing Agents Class:**
- The existing `Agents` class at `src/node/agents/index.ts` handles CRUD for agent configuration
- The new `AgentRunner` is a separate concern for lifecycle agent execution
- They coexist without conflict: one manages config, one manages execution

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
- **Pool Size**: 2 workers (configurable via environment variable `AGENT_WORKER_COUNT`)
- **Lifecycle**: Workers spawned on AgentRunner initialization, terminated on app shutdown
- **Load Balancing**: Round-robin distribution across workers
- **Message Passing**: Uses `worker.postMessage()` with structured clone of context
- **Timeout Enforcement**: 30s timer started on message send; on timeout, worker is terminated and recreated
- **Serialization**: Agent handler functions converted to strings, evaluated in worker context

**Location:** `src/node/agents/executor/`

### 4. Context Provider

Supplies agents with complete chat context.

**Provided Data:**
```typescript
interface AgentContext {
  chatUid: string
  messages: Message[] // Full message history
  chat: Chat // Chat configuration
  event: {
    hook: AgentHook
    data: unknown // Hook-specific data
  }
  tools: {
    callTool: (name, args) => Promise<unknown>
    listTools: () => Tool[]
  }
}
```

**Implementation Details:**

- **Database Access**: Reuses existing `db` instance from `src/node/database/index.ts`
- **Query Optimization**: Messages fetched with `LIMIT` based on `chat.contextSettings.maxMessages`
- **Large History Handling**: For chats with 500+ messages, fetches first 50 and last 50 (strategic sampling)
- **Tool Integration**:
  - `callTool`: Uses LangChain tool invocation via the chat session's tool registry. Delegates to existing tool calling mechanism that wraps skills with `wrapWithSkillInvocationLog()` (from `src/node/chat/tools/skill-invocation.ts`)
  - `listTools`: Aggregates from the session's available tools (includes skills from `src/node/chat/tools/skills.ts` and MCP tools)
- **Caching**: Context cached for 30s within same hook execution to avoid redundant DB queries

**Location:** `src/node/agents/context.ts`

### 5. Built-in Agents

| Agent | Hook | Mode | Complexity | Description |
|-------|------|------|------------|-------------|
| TitleGenerator | onMessageCompleted | auto | simple | Generate/update chat titles every 5 messages |
| ChatSummarizer | onChatIdle | suggest | complex | Suggest summary when messages > 20 |
| AgentRecommender | onMessageCompleted | suggest | simple | Analyze user intent, recommend agents |
| ToolAnalyzer | onToolCompleted | auto | simple | Track tool usage patterns |
| ErrorHandler | onMessageError | suggest | simple | Analyze errors, provide recovery steps |

#### Implementation Details

**TitleGenerator**
- **LLM**: Uses chat's configured model (from `chat.provider`, `chat.model`)
- **Prompt Template**: "Generate a concise title (max 10 words) for this conversation based on recent messages: [last 5 user messages]"
- **Update Condition**: Every 5 messages OR if current title is "新对话"
- **Direct DB Update**: Uses `db.update(chats).set({ title })`

**ChatSummarizer**
- **LLM**: Uses chat's configured model
- **Threshold**: Triggered when `messages.length >= 20`
- **Prompt Template**: "Summarize this conversation in 3-5 bullet points covering: main topics, decisions made, action items. Conversation: [full message history]"
- **Suggestion Format**: Returns `AgentResult` with `suggestion.type = 'summary'`

**AgentRecommender**
- **LLM**: Uses lightweight model (e.g., gpt-4o-mini or claude-haiku)
- **Analysis**: Extracts intent from last user message using keyword matching + LLM classification
- **Categories**: code, writing, analysis, planning, creative, research
- **Recommendation Logic**: Maps intent to existing agent by reading from the `Agents` class
  - Reads available agents via `agents.list()`
  - Matches intent category to agent `category` field (e.g., "code" → agents with `category: 'coding'`)
  - Returns agent with highest `useCount` in that category (from agent metadata)
  - Returns suggestion with `type: 'agent'` and agent metadata

**ToolAnalyzer**
- **No LLM**: Pure logging and pattern detection
- **Metrics**: Tracks tool call frequency, success rate, average duration per tool
- **Storage**: Writes to `agent_execution_log` with aggregated stats

**ErrorHandler**
- **LLM**: Uses lightweight model for error classification
- **Error Types**: API error, timeout, permission denied, tool failure, unknown
- **Recovery Suggestions**: Predefined mapping from error type to recovery steps (e.g., timeout → "Check network connection and retry")

**Location:** `src/node/agents/builtin/`

## Type Definitions

### Agent Configuration

```typescript
type ExecutionMode = 'auto' | 'suggest' | 'manual'
type AgentComplexity = 'simple' | 'complex'

type AgentHook
  = | 'onChatCreated'
    | 'onMessageStreaming'
    | 'onMessageCompleted'
    | 'onChatIdle'
    | 'onMessageError'
    | 'onToolCalled'
    | 'onToolCompleted'

interface AgentHookConfig {
  hook: AgentHook
  priority: number // Lower = earlier execution
  mode: ExecutionMode
  complexity: AgentComplexity
}

// Note: LifecycleAgent (this system) is separate from the existing Agent type
// in src/node/agents/types.ts which is for agent configuration CRUD.
// LifecycleAgent is for executable agents that respond to hooks.
interface LifecycleAgent {
  id: string // Unique agent ID (e.g., 'builtin:title-generator')
  name: string // Human-readable name
  description: string // What this agent does
  version: string // Agent version (default: '1.0.0')
  hooks: Record<AgentHook, AgentHookConfig | undefined>
  handler: (context: AgentContext) => Promise<AgentResult>
}

// Type alias for clarity in this spec
type AgentExecutable = LifecycleAgent
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

### Integration and Migration

**Schema Location:** `src/node/database/schema/agent.ts`

**Export:** Add to `src/node/database/schema/index.ts`:
```typescript
export * from './agent'
```

**Migration:** Create Drizzle migration:
```bash
pnpm drizzle-kit generate:sqlite
```

**Operations Layer:** Create `src/node/database/operations/agent-operations.ts`:
```typescript
export class AgentOperations {
  async logExecution(data: ExecutionLogInsert): Promise<void>
  async createSuggestion(data: SuggestionInsert): Promise<void>
  async getSuggestions(chatUid: string): Promise<Suggestion[]>
  async updateSuggestionStatus(uid: string, status: SuggestionStatus): Promise<void>
  async cleanupExpiredSuggestions(): Promise<void>
  async getExecutionStats(agentId: string): Promise<ExecutionStats>
}
```

## Error Handling

### Retry Strategy

- **Max Retries:** 3
- **Retry Delay:** 1000ms × (retryCount + 1)
- **Retryable Errors:** timeout, ECONNREFUSED, ETIMEDOUT, fetch failed
- **Non-retryable:** Validation errors, permission errors, agent handler errors

### Error Logging

All errors are logged to `agent_execution_log` with full context.

### Error Callback

Optional callback for custom error handling:
```typescript
onError?: (error: Error, agentId: string, retryCount: number) => void
```

### Error Recovery Flow

**When an agent fails:**
1. Error is caught by `AgentExecutorWrapper`
2. If retryable and retries < max: retry with exponential backoff
3. If retries exhausted or non-retryable:
   - Log to `agent_execution_log` with status='error'
   - Call `onError` callback if provided
   - Return `AgentResult` with status='error'

**User-facing behavior:**
- Auto-mode agents: Fail silently, logged only
- Suggest-mode agents: Failed suggestions are marked as expired, not shown to user
- Manual trigger: Error returned via tRPC response

**Error Recovery Suggestions (from ErrorHandler agent):**
| Error Type | Recovery Step |
|------------|---------------|
| API timeout | "Check network connection and retry" |
| Permission denied | "Verify API credentials in settings" |
| Tool not found | "Tool may have been removed; refresh tool list" |
| Rate limit | "Wait a few minutes before retrying" |

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

**Integration Points:**

| Location in SessionOrchestrator | Hook | Execution Mode | Error Handling |
|--------------------------------|------|----------------|----------------|
| `createChat()` after DB insert | onChatCreated | Async (non-blocking) | Log error, don't block chat creation |
| `handleMessageStreaming()` during stream | onMessageStreaming | Async (fire-and-forget) | Log error, continue streaming |
| `handleMessageComplete()` after DB update | onMessageCompleted | Async (non-blocking) | Log error, don't block message completion |
| `handleError()` before returning to user | onMessageError | Async (non-blocking) | Log error, propagate original error |
| `callTool()` before tool invocation | onToolCalled | Async (non-blocking) | Log error, proceed with tool call |
| `handleToolResult()` after tool returns | onToolCompleted | Async (non-blocking) | Log error, return tool result |
| Idle detector (separate timer) | onChatIdle | Async (non-blocking) | Log error |

**Performance Impact:**
- Hooks execute asynchronously, never blocking chat operations
- AgentRunner has internal throttling to prevent excessive execution
- Context queries are cached and optimized with LIMIT
- Worker thread isolation prevents main process blocking

**Error Handling:**
- Agent execution failures are logged to `agent_execution_log`
- Chat flow continues even if all agents fail
- Users see agent suggestions via separate channel (not in chat stream)

**Idle Detection Implementation:**
```typescript
// Separate timer per chat
private idleTimers: Map<string, NodeJS.Timeout> = new Map()

scheduleIdleCheck(chatUid: string): void {
  this.resetIdleCheck(chatUid) // Clear existing timer
  const timer = setTimeout(async () => {
    await agentRunner.triggerHook('onChatIdle', chatUid, {})
    this.idleTimers.delete(chatUid)
  }, 30000) // 30 seconds
  this.idleTimers.set(chatUid, timer)
}

// Call on any user activity: message send, tool invoke, etc.
```

## Manual Trigger API

Users can manually trigger hooks via tRPC.

**Integration:** Extend the existing `agentRouter` at `src/node/server/agent.ts` with lifecycle agent procedures.

**Add to existing agentRouter:**
```typescript
import { agentRunner } from '../agents/runner'
import { db } from '../database'
import { agentExecutionLog } from '../database/schema/agent'
import { eq, desc } from 'drizzle-orm'

// Add these procedures to the existing agentRouter export
export const agentRouter = router({
  // ... existing procedures (list, get, create, update, delete, etc.)

  /**
   * Manually trigger a lifecycle agent hook
   */
  triggerLifecycleHook: procedure()
    .input(z.object({
      chatUid: z.string().min(1),
      hook: z.enum([
        'onChatCreated',
        'onMessageStreaming',
        'onMessageCompleted',
        'onChatIdle',
        'onMessageError',
        'onToolCalled',
        'onToolCompleted'
      ])
    }))
    .mutation(async ({ input }) => {
      try {
        const results = await agentRunner.triggerHook(input.hook, input.chatUid)
        return { success: true, results }
      }
      catch (error) {
        console.error('Manual lifecycle hook trigger failed:', error)
        throw new Error('Failed to trigger lifecycle hook')
      }
    }),

  /**
   * List all registered lifecycle agents
   */
  listLifecycleAgents: procedure()
    .query(async () => {
      return agentRunner.listAgents()
    }),

  /**
   * Get execution history for a chat
   */
  getLifecycleExecutionHistory: procedure()
    .input(z.object({
      chatUid: z.string(),
      limit: z.number().optional().default(50)
    }))
    .query(async ({ input }) => {
      return db.select()
        .from(agentExecutionLog)
        .where(eq(agentExecutionLog.chatUid, input.chatUid))
        .orderBy(desc(agentExecutionLog.createdAt))
        .limit(input.limit)
    }),
})
```

**This enables frontend actions like:**
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

## Configuration

Agent system behavior can be configured via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_WORKER_COUNT` | 2 | Number of worker threads for complex agents |
| `AGENT_CACHE_TTL` | 60000 | Execution cache TTL in milliseconds |
| `AGENT_TIMEOUT` | 30000 | Agent execution timeout in milliseconds |
| `AGENT_MAX_RETRIES` | 3 | Maximum retry attempts for failed agents |
| `AGENT_THROTTLE_MESSAGE_COMPLETED` | 2000 | Throttle window for onMessageCompleted (ms) |
| `AGENT_THROTTLE_CHAT_IDLE` | 30000 | Throttle window for onChatIdle (ms) |
| `AGENT_THROTTLE_MESSAGE_STREAMING` | 500 | Throttle window for onMessageStreaming (ms) |

**Configuration Loading:** In `src/node/agents/config.ts`
```typescript
export const agentConfig = {
  workerCount: Number.parseInt(process.env.AGENT_WORKER_COUNT || '2'),
  cacheTtl: Number.parseInt(process.env.AGENT_CACHE_TTL || '60000'),
  timeout: Number.parseInt(process.env.AGENT_TIMEOUT || '30000'),
  maxRetries: Number.parseInt(process.env.AGENT_MAX_RETRIES || '3'),
  throttleWindows: {
    onMessageCompleted: Number.parseInt(process.env.AGENT_THROTTLE_MESSAGE_COMPLETED || '2000'),
    onChatIdle: Number.parseInt(process.env.AGENT_THROTTLE_CHAT_IDLE || '30000'),
    onMessageStreaming: Number.parseInt(process.env.AGENT_THROTTLE_MESSAGE_STREAMING || '500'),
  }
}
```

## Testing Strategy

### Unit Tests

**Location:** `src/node/agents/**/__tests__/*.test.ts`

| File | Tests |
|------|-------|
| `runner.test.ts` | Agent registration, hook triggering, executor routing |
| `executor/main.test.ts` | Main process execution, error handling |
| `builtin/title-generator.test.ts` | Title generation logic, update conditions |
| `builtin/chat-summarizer.test.ts` | Summary generation, threshold checking |
| `context.test.ts` | Context provision, database queries |
| `performance.test.ts` | Cache hit/miss, throttling, batching |

**Scenarios:**
- Agent registration with multiple hooks
- Hook execution with multiple agents (parallel)
- Error retry mechanism
- Cache invalidation
- Throttle window enforcement

### Integration Tests

**Location:** `src/node/agents/__tests__/integration.test.ts`

**Scenarios:**
- Full hook flow: trigger → context fetch → agent execution → result → DB log
- Worker thread execution (message passing, timeout)
- Chat system integration: SessionOrchestrator → AgentRunner
- tRPC manual trigger API

### Performance Tests

**Location:** `src/node/agents/__tests__/performance.test.ts`

**Scenarios:**
- Concurrent execution of 10+ agents
- Large chat history (1000+ messages) handling
- Memory usage over 100 hook triggers
- Worker pool load balancing

### Database Tests

**Location:** `src/node/database/__tests__/agent-operations.test.ts`

**Scenarios:**
- Insert and query execution logs
- Suggestion lifecycle (pending → accepted/dismissed)
- Index performance with 10k+ log entries

### Coverage Requirements

- Unit tests: 80%+ coverage
- Integration tests: All critical paths covered
- Performance: No regressions vs baseline (established in first run)
