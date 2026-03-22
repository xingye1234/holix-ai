/**
 * @fileoverview Global test setup for Node (Electron process) tests
 *
 * Loaded via vitest setupFiles for the 'node' project.
 * Provides common mocks for Electron, logger, database, etc.
 */

// ─── Mock electron（electron-log/renderer 依赖链）────────────────────────────
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/tmp'),
    setLoginItemSettings: vi.fn(),
  },
  net: { fetch: vi.fn() },
}))

// ─── Mock better-sqlite3（避免原生模块加载问题）────────────────────────────────
vi.mock('better-sqlite3', () => ({
  default: vi.fn(),
}))

// ─── Mock database/connect（防止 top-level 代码执行）──────────────────────────
vi.mock('./database/connect', () => ({
  sqlite: {},
  db: {},
  getDatabase: vi.fn(),
  migrateDb: vi.fn(),
}))

// ─── Mock 前端 logger（@/lib/logger）────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ─── Mock 平台 logger（./platform/logger）────────────────────────────────────────
vi.mock('./platform/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  getLogPath: vi.fn(),
  getMainLogFile: vi.fn(),
}))

// ─── 测试数据库设置 ────────────────────────────────────────────────────────────
// 注意：测试数据库仅在需要的测试文件中手动初始化
// 这样可以避免所有测试都承担数据库初始化的开销
