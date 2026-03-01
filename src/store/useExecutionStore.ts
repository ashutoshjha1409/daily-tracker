'use client'

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import {
  CorrectionEntry,
  DailyExecutionRecord,
  Habit,
  Task,
  UserSettings,
  WeeklyReport
} from '@/lib/models'
import { computeDisciplineScore, computeOverloadIndex } from '@/lib/score'
import { ExecutionLedgerDB, getExecutionDb } from '@/lib/db'

const todayIso = new Date().toISOString().split('T')[0]

const defaultSettings: UserSettings = {
  dailyCapacityMinutes: 420,
  maxTasksPerDay: 10,
  penaltyPhase: 'calibration'
}

const buildSampleTasks = (): Task[] => {
  const timestamp = new Date().toISOString()
  return [
    {
      id: 'task-1',
      title: 'Write brutal execution audit',
      projectId: 'project-1',
      estimatedMinutes: 60,
      actualMinutes: 58,
      completedAt: timestamp,
      context: 'work',
      tags: ['audit', 'analysis'],
      scheduledDate: todayIso,
      carryoverCount: 0,
      createdAt: timestamp
    },
    {
      id: 'task-2',
      title: 'Review carryover patterns',
      estimatedMinutes: 45,
      actualMinutes: 50,
      completedAt: timestamp,
      context: 'work',
      tags: ['carryover', 'metrics'],
      scheduledDate: todayIso,
      carryoverCount: 1,
      createdAt: timestamp
    },
    {
      id: 'task-3',
      title: 'Morning planning + capacity check',
      estimatedMinutes: 30,
      actualMinutes: 32,
      completedAt: timestamp,
      context: 'personal',
      tags: ['planning', 'discipline'],
      scheduledDate: todayIso,
      carryoverCount: 0,
      createdAt: timestamp
    }
  ]
}

const sampleHabits: Habit[] = [
  {
    id: 'habit-1',
    title: 'Morning execution review',
    frequencyRule: 'daily',
    streak: 14,
    reliabilityScore: 92
  },
  {
    id: 'habit-2',
    title: 'Evening discipline recap',
    frequencyRule: 'daily',
    streak: 7,
    reliabilityScore: 88
  }
]

function formatShortDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

function weekRangeFromDate(dateIso: string) {
  const date = new Date(dateIso)
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const range = `${formatShortDate(start)} - ${formatShortDate(end)}`
  return { range, start, end }
}

const aiNarrative = (range: string, recs: DailyExecutionRecord[]) => {
  const avgCompletion =
    recs.reduce((sum, record) => sum + record.completionRate, 0) / recs.length
  const avgCarryover = recs.reduce((sum, record) => sum + record.carryoverRate, 0) / recs.length
  const avgEstimation =
    recs.reduce((sum, record) => sum + record.estimationAccuracy, 0) / recs.length
  return `Week ${range}: Discipline settled at ${Number(avgCompletion.toFixed(0))}%, estimation accuracy ${Number(
    avgEstimation.toFixed(0)
  )}%, carryover ${Number(avgCarryover.toFixed(0))}%.`
}

function buildWeeklyReports(records: DailyExecutionRecord[]): WeeklyReport[] {
  const buckets = new Map<string, { records: DailyExecutionRecord[]; start: number }>()
  records.forEach((record) => {
    const { range, start } = weekRangeFromDate(record.date)
    if (!buckets.has(range)) {
      buckets.set(range, { records: [], start: start.getTime() })
    }
    buckets.get(range)?.records.push(record)
  })

  return Array.from(buckets.entries())
    .map(([weekRange, { records, start }]) => {
      const disciplineTotal = records.reduce((sum, record) => sum + record.disciplineScore, 0)
      const carryoverTotal = records.reduce((sum, record) => sum + record.carryoverRate, 0)
      const overloadTotal = records.reduce((sum, record) => sum + record.overloadIndex, 0)
      const reliabilityScore = Number((disciplineTotal / records.length).toFixed(2))
      const avgCarryover = Number((carryoverTotal / records.length).toFixed(2))
      const avgOverload = Number((overloadTotal / records.length).toFixed(2))
      const focusConsistency = Math.max(0, Number((100 - avgOverload * 0.6).toFixed(0)))
      const burnoutRisk = Math.min(100, Number(((avgCarryover + avgOverload) / 2).toFixed(0)))
      return {
        weekRange,
        reliabilityScore,
        focusConsistency,
        burnoutRisk,
        aiAnalysis: aiNarrative(weekRange, records),
        hash: uuidv4(),
        _start: start
      }
    })
    .sort((a, b) => a._start - b._start)
    .map(({ _start, ...report }) => report)
}

async function refreshWeeklyReports(db: ExecutionLedgerDB, records: DailyExecutionRecord[]) {
  const reports = buildWeeklyReports(records)
  await db.weeklyReports.clear()
  if (reports.length) {
    await db.weeklyReports.bulkAdd(reports)
  }
  return reports
}

function createDailyRecord(
  tasks: Task[],
  habits: Habit[],
  settings: UserSettings,
  previousHash?: string
): DailyExecutionRecord {
  const completedTasks = tasks.filter((task) => Boolean(task.completedAt))
  const completionRate = tasks.length
    ? Number(((completedTasks.length / tasks.length) * 100).toFixed(2))
    : 0
  const totalCarryovers = tasks.reduce((sum, task) => sum + task.carryoverCount, 0)
  const carryoverRate = tasks.length ? Number(((totalCarryovers / tasks.length) * 100).toFixed(2)) : 0
  const estimationAccuracy = tasks.length
    ? Number(
        (
          tasks.reduce((sum, task) => {
            if (!task.actualMinutes || task.estimatedMinutes === 0) {
              return sum
            }
            const accuracy =
              100 - (Math.abs(task.estimatedMinutes - task.actualMinutes) / task.estimatedMinutes) * 100
            return sum + Math.max(0, accuracy)
          }, 0) / tasks.length
        ).toFixed(2)
      )
    : 0
  const overloadIndex = computeOverloadIndex(
    tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
    settings.dailyCapacityMinutes
  )
  const habitReliability = habits.length
    ? Number(
        (habits.reduce((sum, habit) => sum + habit.reliabilityScore, 0) / habits.length).toFixed(2)
      )
    : 0
  let xp = completedTasks.length * 5
  if (totalCarryovers === 0) xp += 10
  if (estimationAccuracy >= 85) xp += 10
  if (overloadIndex > 120) xp -= 10
  xp -= totalCarryovers * 5
  const record: DailyExecutionRecord = {
    date: todayIso,
    tasksSnapshot: tasks.map((task) => ({ ...task })),
    completionRate,
    carryoverRate,
    estimationAccuracy,
    overloadIndex,
    habitReliability,
    disciplineScore: 0,
    xp: Math.max(0, xp),
    previousHash,
    hash: uuidv4(),
    locked: false
  }
  const disciplineScore = computeDisciplineScore(record)
  record.disciplineScore = disciplineScore
  if (disciplineScore >= 80) {
    record.xp += 15
  }
  return record
}

async function ensureDailyRecord(db: ExecutionLedgerDB, settings: UserSettings) {
  const existing = await db.dailyRecords.get(todayIso)
  if (existing) {
    return existing
  }
  const tasks = await db.tasks.toArray()
  const habits = await db.habits.toArray()
  const prevRecord = await db.dailyRecords.orderBy('date').last()
  const record = createDailyRecord(tasks, habits, settings, prevRecord?.hash)
  await db.dailyRecords.put(record)
  return record
}

async function ensureDefaults(db: ExecutionLedgerDB) {
  const storedSettings = await db.settings.get('settings')
  if (!storedSettings) {
    await db.settings.put({ id: 'settings', ...defaultSettings })
  }

  if ((await db.tasks.count()) === 0) {
    await db.tasks.bulkAdd(buildSampleTasks())
  }

  if ((await db.habits.count()) === 0) {
    await db.habits.bulkAdd(sampleHabits)
  }

  await ensureDailyRecord(db, storedSettings ?? defaultSettings)
  const records = await db.dailyRecords.orderBy('date').toArray()
  await refreshWeeklyReports(db, records)
}

interface ExecutionState {
  isReady: boolean
  settings: UserSettings
  tasks: Task[]
  habits: Habit[]
  dailyRecords: DailyExecutionRecord[]
  weeklyReports: WeeklyReport[]
  corrections: CorrectionEntry[]
  latestRecord: DailyExecutionRecord | null
  disciplineScore: number
  capacityUsage: number
  carryoverCount: number
  xp: number
  recordLocked: boolean
  init: () => Promise<void>
  markTaskComplete: (taskId: string, actualMinutes: number) => Promise<void>
  lockDay: () => Promise<void>
  addCorrectionEntry: (note: string) => Promise<void>
}

const useExecutionStore = create<ExecutionState>((set, get) => {
  const reloadState = async () => {
    const db = getExecutionDb()
    if (!db) {
      return
    }
    const settings = (await db.settings.get('settings')) ?? defaultSettings
    const tasks = await db.tasks.toArray()
    const habits = await db.habits.toArray()
    const dailyRecords = await db.dailyRecords.orderBy('date').toArray()
    const weeklyReports = await refreshWeeklyReports(db, dailyRecords)
    const corrections = await db.corrections.where('date').equals(todayIso).toArray()
    const latestRecord = dailyRecords[dailyRecords.length - 1] ?? null
    const scheduledMinutes = tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0)
    const capacityUsage = settings.dailyCapacityMinutes
      ? Number(((scheduledMinutes / settings.dailyCapacityMinutes) * 100).toFixed(2))
      : 150
    set({
      settings,
      tasks,
      habits,
      dailyRecords,
      weeklyReports,
      corrections,
      latestRecord,
      disciplineScore: latestRecord?.disciplineScore ?? 0,
      capacityUsage,
      carryoverCount: tasks.filter((task) => task.carryoverCount > 0).length,
      xp: latestRecord?.xp ?? 0,
      recordLocked: latestRecord?.locked ?? false
    })
  }

  return {
    isReady: false,
    settings: defaultSettings,
    tasks: [],
    habits: [],
    dailyRecords: [],
    weeklyReports: [],
    corrections: [],
    latestRecord: null,
    disciplineScore: 0,
    capacityUsage: 0,
    carryoverCount: 0,
    xp: 0,
    recordLocked: false,
    init: async () => {
      const db = getExecutionDb()
      if (!db) {
        return
      }
      await ensureDefaults(db)
      await reloadState()
      set({ isReady: true })
    },
    markTaskComplete: async (taskId, actualMinutes) => {
      if (get().recordLocked) {
        return
      }
      const db = getExecutionDb()
      if (!db) {
        return
      }
      const task = await db.tasks.get(taskId)
      if (!task) {
        return
      }
      const updated: Task = {
        ...task,
        actualMinutes,
        completedAt: new Date().toISOString(),
        carryoverCount: actualMinutes > task.estimatedMinutes ? task.carryoverCount + 1 : task.carryoverCount
      }
      await db.tasks.put(updated)
      const settings = (await db.settings.get('settings')) ?? defaultSettings
      const [tasks, habits] = await Promise.all([db.tasks.toArray(), db.habits.toArray()])
      const prevRecord = await db.dailyRecords.get(todayIso)
      const newRecord = createDailyRecord(tasks, habits, settings, prevRecord?.hash)
      await db.dailyRecords.put(newRecord)
      await reloadState()
      set({ isReady: true })
    },
    lockDay: async () => {
      if (get().recordLocked) {
        return
      }
      const db = getExecutionDb()
      const latest = get().latestRecord
      if (!db || !latest) {
        return
      }
      await db.dailyRecords.put({ ...latest, locked: true })
      await reloadState()
    },
    addCorrectionEntry: async (note) => {
      if (!note.trim()) {
        return
      }
      const db = getExecutionDb()
      if (!db) {
        return
      }
      if (!get().recordLocked) {
        return
      }
      await db.corrections.put({
        id: uuidv4(),
        date: todayIso,
        note,
        createdAt: new Date().toISOString()
      })
      await reloadState()
    }
  }
})

export default useExecutionStore
