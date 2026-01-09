import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * 确保文件存在，如果不存在则创建文件及其所在目录
 * @param path 文件路径
 * @param data 文件初始内容，默认为空对象 '{}'
 */
export async function ensureFile(path: string, data: string = '{}') {
  if (!existsSync(path)) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, data, { flag: 'wx', encoding: 'utf-8' })
  }
}
