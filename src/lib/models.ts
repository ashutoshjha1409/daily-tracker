export type PenaltyPhase = 'calibration' | 'soft' | 'full'

export interface UserSettings {
  dailyCapacityMinutes: number
  maxTasksPerDay: number
  penaltyPhase: PenaltyPhase
}

export type TaskContext = 'work' | 'personal' | 'learning'

export interface Task {
  id: string
  title: string
  projectId?: string
  estimatedMinutes: number
  actualMinutes?: number
  deadline?: string
  recurringRule?: string
  context: TaskContext
  tags: string[]
  scheduledDate: string
  completedAt?: string
  carryoverCount: number
  createdAt: string
}

export interface Project {
  id: string
  name: string
  active: boolean
  createdAt: string
}

export interface Habit {
  id: string
  title: string
  frequencyRule: string
  streak: number
  reliabilityScore: number
}

export interface DailyExecutionRecord {
  date: string
  tasksSnapshot: Task[]
  completionRate: number
  carryoverRate: number
  estimationAccuracy: number
  overloadIndex: number
  habitReliability: number
  disciplineScore: number
  xp: number
  previousHash?: string
  hash: string
  locked: boolean
}

export interface WeeklyReport {
  weekRange: string
  reliabilityScore: number
  focusConsistency: number
  burnoutRisk: number
  aiAnalysis: string
  hash: string
}

export interface CorrectionEntry {
  id: string
  date: string
  note: string
  createdAt: string
}
