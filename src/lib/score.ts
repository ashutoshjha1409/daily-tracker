import { DailyExecutionRecord } from './models'

export function computeDisciplineScore(record: DailyExecutionRecord): number {
  const score =
    record.completionRate * 0.3 +
    (100 - record.carryoverRate) * 0.2 +
    record.estimationAccuracy * 0.2 +
    (100 - record.overloadIndex) * 0.15 +
    record.habitReliability * 0.15

  if (Number.isNaN(score)) {
    return 0
  }

  return Math.min(100, Math.max(0, Number(score.toFixed(2))))
}

export function computeOverloadIndex(scheduledMinutes: number, capacityMinutes: number): number {
  if (capacityMinutes === 0) {
    return 150
  }
  return Math.min(150, Number(((scheduledMinutes / capacityMinutes) * 100).toFixed(2)))
}
