import { writeFile } from 'node:fs/promises'
import { dialog } from 'electron'
import { z } from 'zod'
import { procedure, router } from './trpc'

export const dialogRouter = router({
  // 选择文件
  selectFile: procedure()
    .input(
      z.object({
        title: z.string().optional(),
        defaultPath: z.string().optional(),
        buttonLabel: z.string().optional(),
        filters: z
          .array(
            z.object({
              name: z.string(),
              extensions: z.array(z.string()),
            }),
          )
          .optional(),
        properties: z.array(z.enum(['openFile', 'multiSelections', 'showHiddenFiles'])).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await dialog.showOpenDialog({
        title: input.title || '选择文件',
        defaultPath: input.defaultPath,
        buttonLabel: input.buttonLabel || '选择',
        filters: input.filters,
        properties: input.properties || ['openFile'],
      })

      if (result.canceled) {
        return { canceled: true, filePaths: [] }
      }

      return { canceled: false, filePaths: result.filePaths }
    }),

  // 保存文件
  saveFile: procedure()
    .input(
      z.object({
        title: z.string().optional(),
        defaultPath: z.string().optional(),
        defaultFileName: z.string().optional(),
        filters: z
          .array(
            z.object({
              name: z.string(),
              extensions: z.array(z.string()),
            }),
          )
          .optional(),
        content: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await dialog.showSaveDialog({
        title: input.title || '保存文件',
        defaultPath: input.defaultPath || input.defaultFileName,
        filters: input.filters,
      })

      if (result.canceled || !result.filePath) {
        return { canceled: true, filePath: null }
      }

      await writeFile(result.filePath, input.content, 'utf-8')
      return { canceled: false, filePath: result.filePath }
    }),

  // 选择文件夹
  selectFolder: procedure()
    .input(
      z.object({
        title: z.string().optional(),
        defaultPath: z.string().optional(),
        buttonLabel: z.string().optional(),
        properties: z.array(z.enum(['openDirectory', 'multiSelections', 'showHiddenFiles', 'createDirectory'])).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await dialog.showOpenDialog({
        title: input.title || '选择文件夹',
        defaultPath: input.defaultPath,
        buttonLabel: input.buttonLabel || '选择',
        properties: input.properties || ['openDirectory'],
      })

      if (result.canceled) {
        return { canceled: true, filePaths: [] }
      }

      return { canceled: false, filePaths: result.filePaths }
    }),
})
