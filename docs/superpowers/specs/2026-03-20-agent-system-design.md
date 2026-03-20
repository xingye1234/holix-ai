# Agent System Design

**Date**: 2026-03-20
**Status**: Draft
**Author**: Claude + User Collaboration

## Overview

Design and implement a file-based Agent system for Holix AI that allows users to create, manage, and use custom AI agents. The system will store custom agents as JSON files in `.holixai/agents/` while keeping built-in agents defined in code.

## Requirements

### Functional Requirements

1. **File-based Storage**: Custom agents stored as individual JSON files in `.holixai/agents/`
2. **Built-in Agents**: Hardcoded in source, immutable, cannot be deleted
3. **CRUD Operations**: Create, Read, Update, Delete custom agents
4. **Organization**: Flat file structure, filename serves as agent ID
5. **Search & Filter**: Search by name/description, filter by category/tags
6. **Sorting**: Sort by name, creation time, last used time
7. **Favorites**: Mark agents as favorites
8. **Import/Export**: Export single/multiple agents, import from JSON
9. **Chat Integration**: Select and use agents in chat interface
10. **Manual Refresh**: User-triggered reload, invalid files logged as warnings

### Non-Functional Requirements

1. **Consistent Architecture**: Follow existing project patterns (tRPC, Store, Registry)
2. **Extensibility**: Design supports future database migration or advanced features
3. **Error Handling**: Invalid files ignored with console warnings
4. **Performance**: Lazy loading with caching, manual refresh

## Architecture

### File Structure

```
src/node/
├── agents/
│   ├── index.ts              # Main Agents class
│   ├── types.ts              # Type definitions
│   ├── builtin.ts            # Built-in agents
│   ├── validator.ts          # JSON schema validation
│   └── utils.ts              # Helper functions
├── server/
│   └── agent.ts              # tRPC router for agent API
├── database/
│   └── agent-metadata.ts     # Metadata storage (favorites, usage)
└── constant.ts               # Add AGENTS_PATH constant

.holixai/
└── agents/                   # Custom agents directory
    ├── code-reviewer.json
    ├── writer.json
    └── ...
```

### Component Design

#### 1. Agents Class (`src/node/agents/index.ts`)

Main class responsible for agent management.

```typescript
class Agents {
  private agentsDir: string
  private builtinAgents: Agent[]
  private cache: Map<string, Agent>

  // Lifecycle
  async init(): Promise<void>
  reload(): void

  // Queries
  list(options?: ListOptions): Agent[]
  get(name: string): Agent | undefined
  search(query: string): Agent[]

  // Mutations
  async create(agent: CreateAgentInput): Promise<Agent>
  async update(name: string, updates: Partial<Agent>): Promise<Agent>
  async delete(name: string): Promise<void>
  async duplicate(name: string, newName: string): Promise<Agent>

  // Import/Export
  async export(name: string): Promise<string>
  async import(json: string): Promise<Agent>
}
```

#### 2. Agent Router (`src/node/server/agent.ts`)

tRPC router exposing agent operations to the renderer process.

```typescript
export const agentRouter = router({
  list: procedure().input(ListOptionsSchema).query(...),
  get: procedure().input(z.object({ name: z.string() })).query(...),
  create: procedure().input(AgentSchema).mutation(...),
  update: procedure().input(UpdateAgentSchema).mutation(...),
  delete: procedure().input(z.object({ name: z.string() })).mutation(...),
  duplicate: procedure().input(DuplicateSchema).mutation(...),
  toggleFavorite: procedure().input(z.object({ name: z.string() })).mutation(...),
  export: procedure().input(z.object({ name: z.string() })).mutation(...),
  import: procedure().input(z.object({ json: z.string() })).mutation(...),
  reload: procedure().mutation(...),
})
```

#### 3. Metadata Storage (`src/node/database/agent-metadata.ts`)

Stores runtime metadata like favorites and usage statistics.

Options:
- **A**: SQLite table (recommended for consistency)
- **B**: lowdb file (simpler, matches configStore pattern)

## Data Models

### Agent File Format

```json
{
  "version": "1.0.0",
  "name": "Code Reviewer",
  "description": "Expert at code review and best practices",
  "category": "development",
  "tags": ["coding", "review"],
  "prompt": "You are a senior code reviewer...",
  "skills": ["code-reader"],
  "mcps": [],
  "provider": "",
  "model": "",
  "variables": [
    {
      "name": "language",
      "type": "string",
      "default": "TypeScript",
      "description": "Primary programming language"
    }
  ],
  "map": {
    "planning": 0.8,
    "reasoning": 0.9,
    "toolUse": 0.7
  }
}
```

### Type Definitions

```typescript
interface Agent {
  // Identity
  id: string              // Derived from filename
  name: string            // From file
  version: string         // Default: "1.0.0"

  // Metadata
  description: string
  category: string        // Default: "general"
  tags: string[]

  // Core
  prompt: string
  skills: string[]
  mcps: string[]

  // Model configuration
  provider: string
  model: string

  // Advanced features (for future expansion)
  variables: Variable[]
  map: Record<string, number>

  // Runtime
  isBuiltin: boolean
  createdAt: number
  updatedAt: number
}
```

## Chat Integration

### UI Changes

1. **Agent Selector**: Dropdown/combobox in chat interface
2. **Agent Badge**: Display current agent when selected
3. **Agent Settings**: Quick access to agent configuration

### Backend Integration

When an agent is selected:

```typescript
// Agent configuration is applied to chat session
const agent = agents.get(selectedAgentName)
const sessionConfig = {
  systemPrompt: agent.prompt,
  skills: agent.skills,
  mcps: agent.mcps,
  map: agent.map,
  model: agent.model || currentModel,
}

// Track usage
updateAgentMetadata(agent.name, { lastUsedAt: Date.now(), useCount: +1 })
```

## Error Handling

### Invalid Files

- Parse errors: Log warning, skip file
- Missing required fields: Log warning, skip file
- Invalid JSON: Log warning, skip file
- Duplicate names: Last write wins, log warning

### User Feedback

- Create/update: Toast notifications
- Delete: Confirmation dialog
- Errors: User-friendly error messages via sonner

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Create `agents/` module structure
- [ ] Implement `Agents` class
- [ ] Define Agent types
- [ ] Create builtin agents
- [ ] Implement file I/O operations
- [ ] Add validation

### Phase 2: API Layer
- [ ] Create `agentRouter` (tRPC)
- [ ] Implement all CRUD procedures
- [ ] Add error handling
- [ ] Write unit tests

### Phase 3: UI Components
- [ ] Enhance agents page with edit/delete
- [ ] Add search/filter functionality
- [ ] Implement sorting
- [ ] Add favorites
- [ ] Add import/export UI
- [ ] Add refresh button

### Phase 4: Chat Integration
- [ ] Add agent selector to chat
- [ ] Implement agent application logic
- [ ] Track usage statistics
- [ ] Test agent execution

### Phase 5: Polish
- [ ] Add i18n support
- [ ] Write documentation
- [ ] Add E2E tests
- [ ] Performance optimization

## Testing Strategy

### Unit Tests
- Agent file loading/parsing
- Validation logic
- CRUD operations
- Search/filter logic
- Import/export

### Integration Tests
- tRPC API endpoints
- Chat integration
- File system operations

### E2E Tests
- Create agent flow
- Edit agent flow
- Use agent in chat
- Import/export flow

## Future Enhancements (Out of Scope)

- Agent versions and history
- Agent templates and inheritance
- Agent composition/chaining
- Conditional logic in agents
- Agent marketplace/sharing
- Database migration option
- Multi-language prompts
- Agent analytics dashboard

## Open Questions

1. **Metadata Storage**: SQLite vs lowdb for agent metadata?
2. **Agent Variables**: How should variables be substituted in prompts?
3. **Agent Testing**: Should we add a "test" feature in UI?

## Dependencies

- `zod`: Schema validation
- `drizzle-orm`: Metadata storage (if using SQLite)
- `lowdb`: Metadata storage (alternative)
- `nanoid`: Agent ID generation (for duplicates)
- Existing: `@holix/router`, tRPC, better-sqlite3

## Compatibility

- **Node Version**: >=22
- **Existing Systems**: Database, chat, skills, MCP
- **Breaking Changes**: None (pure addition)
