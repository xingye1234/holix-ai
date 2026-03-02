import * as t from 'drizzle-orm/sqlite-core'
import { sqliteTableCreator } from 'drizzle-orm/sqlite-core'

export const sqliteTable = sqliteTableCreator(name => name)

export const ky = sqliteTable(
  'ky',
  {
    key: t.text().primaryKey(),
    value: t.text(),
  },
)
