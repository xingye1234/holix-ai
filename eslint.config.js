import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    // skills/ 目录下的 TS 文件在 VM 沙箱中以 CJS 格式运行，
    // 需要使用 require() 而非 ESM import，规则不适用
    'skills/**',
  ],
  rules: {
    // 为测试文件禁用导入顺序规则
    'import/first': 'off',
    'perfectionist/sort-named-imports': 'off',
    'perfectionist/sort-exports': 'off',
    'perfectionist/sort-enums': 'off',
    'perfectionist/sort-classes': 'off',
    'perfectionist/sort-interfaces': 'off',
    'perfectionist/sort-object-types': 'off',
    'perfectionist/sort-imports': 'off',
  },
}, {
  // 为测试文件应用不同的规则
  files: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/__tests__/**/*',
  ],
  rules: {
    // 测试文件需要 vi.hoisted() 在导入之前
    'import/first': 'off',
    'perfectionist/sort-named-imports': 'off',
    'perfectionist/sort-imports': 'off',
    // 测试文件标题可以使用大写
    'test/prefer-lowercase-title': 'off',
  },
})
