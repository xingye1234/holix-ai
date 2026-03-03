import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    // skills/ 目录下的 TS 文件在 VM 沙箱中以 CJS 格式运行，
    // 需要使用 require() 而非 ESM import，规则不适用
    'skills/**',
  ],
})
