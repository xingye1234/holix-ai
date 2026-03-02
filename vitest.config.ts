import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 在 Node.js 环境下运行（不依赖浏览器/Electron）
    environment: 'node',
    // 只包含 node 侧的测试文件
    include: ['src/node/**/__tests__/**/*.test.ts'],
    // 全局 mock 模块（electron / electron-log 需要在 Electron 外 stub）
    globals: true,
    // 测试超时（命令执行类测试可能稍慢）
    testTimeout: 15000,
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      include: ['src/node/chat/skills/**/*.ts'],
      exclude: ['src/node/chat/skills/**/__tests__/**'],
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
})
