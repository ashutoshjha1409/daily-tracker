import Dexie, { Table } from 'dexie'
import type { Task, Completion } from './models'

export class TrackerDB extends Dexie {
  tasks!: Table<Task, string>
  completions!: Table<Completion, [string, string]>

  constructor() {
    super('DailyTaskTracker')
    this.version(1).stores({
      tasks: '&id,order',
      completions: '&[taskId+date],taskId,date'
    })
  }
}

let db: TrackerDB | null = null

export function getDb(): TrackerDB | null {
  if (typeof window === 'undefined') return null
  if (!db) db = new TrackerDB()
  return db
}
