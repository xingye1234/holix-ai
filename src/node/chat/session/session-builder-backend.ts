import type { createDeepAgent } from 'deepagents'
import {
  CompositeBackend,
  FilesystemBackend,
  StoreBackend,
} from 'deepagents'
import type {
  BackendProtocol,
  EditResult,
  ExecuteResponse,
  FileData,
  FileDownloadResponse,
  FileInfo,
  FileUploadResponse,
  GrepMatch,
  WriteResult,
} from 'deepagents'
import type {
  deepAgentLongTermMemoryStore,
} from '../../database/deepagents-store'
import {
  DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE,
} from '../../database/deepagents-store'
import { auditedOperation } from '../runtime/runtime-audit'

type DeepAgentParams = NonNullable<Parameters<typeof createDeepAgent>[0]>
export type SessionDeepAgentStore = NonNullable<DeepAgentParams['store']>

class AuditedBackend implements BackendProtocol {
  constructor(private readonly backend: BackendProtocol) {}

  lsInfo(path: string): Promise<FileInfo[]> {
    return auditedOperation({
      toolName: 'fs.ls',
      description: 'List the contents of a local directory for the current chat session.',
      args: { path },
      execute: () => this.backend.lsInfo(path),
      formatResult: result => JSON.stringify({ entries: result }, null, 2),
      onDenied: () => [],
      requireApproval: false,
    })
  }

  read(filePath: string, offset?: number, limit?: number): Promise<string> {
    return auditedOperation({
      toolName: 'fs.read',
      description: 'Read a local file through the session filesystem backend.',
      args: { filePath, offset, limit },
      execute: () => this.backend.read(filePath, offset, limit),
      formatResult: result => result,
      onDenied: () => '[操作被拒绝：未读取文件内容。]',
      requireApproval: false,
    })
  }

  readRaw(filePath: string): Promise<FileData> {
    return auditedOperation({
      toolName: 'fs.read_raw',
      description: 'Read raw file data through the session filesystem backend.',
      args: { filePath },
      execute: () => this.backend.readRaw(filePath),
      formatResult: result => JSON.stringify(result, null, 2),
      onDenied: async () => ({
        content: ['[操作被拒绝：未读取文件内容。]'],
        created_at: new Date(0).toISOString(),
        modified_at: new Date(0).toISOString(),
      }),
      requireApproval: false,
    })
  }

  grepRaw(pattern: string, path?: string | null, glob?: string | null): Promise<GrepMatch[] | string> {
    return auditedOperation({
      toolName: 'fs.grep',
      description: 'Search file contents in the local workspace.',
      args: { pattern, path, glob },
      execute: () => this.backend.grepRaw(pattern, path, glob),
      formatResult: result => typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      onDenied: () => '[操作被拒绝：未执行内容搜索。]',
      requireApproval: false,
    })
  }

  globInfo(pattern: string, path?: string): Promise<FileInfo[]> {
    return auditedOperation({
      toolName: 'fs.glob',
      description: 'Match local files by glob pattern in the current chat session.',
      args: { pattern, path },
      execute: () => this.backend.globInfo(pattern, path),
      formatResult: result => JSON.stringify({ entries: result }, null, 2),
      onDenied: () => [],
      requireApproval: false,
    })
  }

  write(filePath: string, content: string): Promise<WriteResult> {
    return auditedOperation({
      toolName: 'fs.write',
      description: 'Write a local file through the session filesystem backend.',
      args: { filePath, contentLength: content.length },
      execute: () => this.backend.write(filePath, content),
      formatResult: result => JSON.stringify(result, null, 2),
      onDenied: async () => ({ error: 'operation denied by user' }),
      requireApproval: true,
    })
  }

  edit(filePath: string, oldString: string, newString: string, replaceAll?: boolean): Promise<EditResult> {
    return auditedOperation({
      toolName: 'fs.edit',
      description: 'Edit a local file through the session filesystem backend.',
      args: {
        filePath,
        oldStringPreview: oldString.slice(0, 120),
        newStringPreview: newString.slice(0, 120),
        replaceAll,
      },
      execute: () => this.backend.edit(filePath, oldString, newString, replaceAll),
      formatResult: result => JSON.stringify(result, null, 2),
      onDenied: async () => ({ error: 'operation denied by user' }),
      requireApproval: true,
    })
  }

  uploadFiles?(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    return this.backend.uploadFiles ? this.backend.uploadFiles(files) : Promise.resolve([])
  }

  downloadFiles?(paths: string[]): Promise<FileDownloadResponse[]> {
    return this.backend.downloadFiles ? this.backend.downloadFiles(paths) : Promise.resolve([])
  }

  execute?(command: string): Promise<ExecuteResponse> {
    const executable = this.backend as BackendProtocol & { execute?: (command: string) => Promise<ExecuteResponse> }
    if (!executable.execute) {
      return Promise.reject(new Error('Backend does not support command execution'))
    }

    return auditedOperation({
      toolName: 'fs.execute',
      description: 'Execute a local command for the current chat session.',
      args: { command },
      execute: () => executable.execute!(command),
      formatResult: result => JSON.stringify(result, null, 2),
      onDenied: async () => ({
        output: '[操作被拒绝：未执行命令。]',
        exitCode: -1,
        truncated: false,
      }),
      requireApproval: true,
    })
  }
}

export function createSessionBackend(backendRoot: string) {
  return (config: { store?: unknown }) =>
    new AuditedBackend(new CompositeBackend(
      new FilesystemBackend({ rootDir: backendRoot }),
      {
        '/memories/': new StoreBackend(config, {
          namespace: DEEP_AGENT_LONG_TERM_MEMORY_NAMESPACE,
        }),
      },
    ))
}

export function asDeepAgentStore(
  store: typeof deepAgentLongTermMemoryStore,
): SessionDeepAgentStore {
  return store as unknown as SessionDeepAgentStore
}
