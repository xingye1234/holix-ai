import type { HolixProtocolRouter } from '@holix/router'
import type { Low } from 'lowdb'
import { join } from 'node:path'
import { JSONFilePreset } from 'lowdb/node'
import { APP_DATA_PATH } from '../constant'
import { ensureFile } from './utils/file'

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
    await ensureFile(this.path, JSON.stringify(this.defaultData))
    const db: Low<D> = await JSONFilePreset(this.path, this.defaultData)
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
