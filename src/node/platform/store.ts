import type { HolixProtocolRouter } from '@holix/router'
import type { Low } from 'lowdb'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { JSONFilePreset } from 'lowdb/node'
import { dirname, join } from 'pathe'
import { APP_DATA_PATH } from '../constant'
import { logger } from './logger'

export interface StoreOptions<T = any> {
  name: string
  defaultData: T
  basePath?: string
}

const nameSet = new Set<string>()

export class Store<D> {
  db: Low<D> | null = null
  path: string
  name: string
  defaultData: D
  isInitialized = false

  basePath?: string

  constructor(opt: StoreOptions<D>) {
    this.name = opt.name
    if (nameSet.has(this.name)) {
      throw new Error(`Store name ${this.name} already exists`)
    }

    this.basePath = opt.basePath

    nameSet.add(this.name)
    this.defaultData = opt.defaultData
    this.path = join(APP_DATA_PATH, `${opt.name}.json`)
  }

  async init() {
    if (this.isInitialized) {
      return
    }
    logger.info(`Initializing store: ${this.name} at path: ${this.path}`)
    await ensureFile(this.path, JSON.stringify(this.defaultData))
    logger.info(`Store file ensured at path: ${this.path}`)
    const db: Low<D> = await JSONFilePreset(this.path, this.defaultData)
    logger.info(`LowDB instance created for store: ${this.name}`)
    this.db = db
    this.isInitialized = true
  }

  getStore() {
    if (this.db) {
      return this.db
    }
    throw new Error('Store not initialized')
  }

  get<K extends keyof D>(key: K): D[K] {
    return this.getStore().data[key]
  }

  saveStore() {
    return this.getStore().write()
  }

  set<K extends keyof D>(key: K, value: D[K]) {
    this.getStore().data[key] = value
    return this.saveStore()
  }

  getFilePath() {
    return this.path
  }

  use(router: HolixProtocolRouter) {
    const _path = this.basePath ? `/${this.basePath}` : `/${this.name}`
    router.get(_path, async (ctx) => {
      ctx.json(this.getStore().data)
    })
    router.post(_path, async (ctx) => {
      const reqBody = await ctx.req.json()
      this.mutate(reqBody.key, reqBody.value)
    })
  }

  query() {
    return this.getStore().data
  }

  mutate<K extends keyof D>(key: K, value: D[K]) {
    this.set(key, value)
    this.saveStore()
    return this.getStore().data
  }
}

async function ensureFile(path: string, data: string = '{}') {
  if (!existsSync(path)) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, data, { flag: 'wx', encoding: 'utf-8' })
  }
}
