import Dexie, { Table } from 'dexie'
import {
  CorrectionEntry,
  DailyExecutionRecord,
  Habit,
  Project,
  Task,
  UserSettings,
  WeeklyReport
} from './models'

export class ExecutionLedgerDB extends Dexie {
  tasks!: Table<Task, string>
  projects!: Table<Project, string>
  habits!: Table<Habit, string>
  dailyRecords!: Table<DailyExecutionRecord, string>
  weeklyReports!: Table<WeeklyReport, string>
  settings!: Table<UserSettings & { id: string }, string>
  corrections!: Table<CorrectionEntry, string>

  constructor() {
    super('DailyExecutionLedger')
    this.version(1).stores({
      tasks: '&id,scheduledDate,context',
      projects: '&id,active',
      habits: '&id',
      dailyRecords: '&date,disciplineScore',
      weeklyReports: '&weekRange',
      settings: 'id',
      corrections: '&id,date'
    })
  }
}

let executionDb: ExecutionLedgerDB | null = null

export function getExecutionDb() {
  if (typeof window === 'undefined') {
    return null
  }

  if (!executionDb) {
    executionDb = new ExecutionLedgerDB()
  }

  return executionDb
}
