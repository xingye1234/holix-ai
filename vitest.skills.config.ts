import { defineConfig } from 'vitest/config'
import { scriptStringPlugin } from './build/script-string-plugin'

const alias = { '@': new URL('./src', import.meta.url).pathname }

export default defineConfig({
  plugins: [scriptStringPlugin({ tsconfig: 'tsconfig.json', alias }) as any],
  resolve: { alias },
  test: {
    name: 'skills-sandbox',
    environment: 'node',
    include: ['src/node/chat/skills/__tests__/builtin-skills-sandbox.test.ts'],
    globals: true,
    testTimeout: 15000,
  },
})
