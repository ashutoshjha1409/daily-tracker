'use client'

import { useEffect, useMemo, useState } from 'react'
import MetricCard from '@/components/MetricCard'
import WeeklyChart from '@/components/WeeklyChart'
import useExecutionStore from '@/store/useExecutionStore'
import type { Task } from '@/lib/models'

export default function HomePage() {
  const init = useExecutionStore((state) => state.init)
  const isReady = useExecutionStore((state) => state.isReady)
  const disciplineScore = useExecutionStore((state) => state.disciplineScore)
  const capacityUsage = useExecutionStore((state) => state.capacityUsage)
  const carryoverCount = useExecutionStore((state) => state.carryoverCount)
  const xp = useExecutionStore((state) => state.xp)
  const weeklyReports = useExecutionStore((state) => state.weeklyReports)
  const tasks = useExecutionStore((state) => state.tasks)
  const latestRecord = useExecutionStore((state) => state.latestRecord)
  const recordLocked = useExecutionStore((state) => state.recordLocked)
  const markTaskComplete = useExecutionStore((state) => state.markTaskComplete)
  const corrections = useExecutionStore((state) => state.corrections)
  const lockDay = useExecutionStore((state) => state.lockDay)
  const addCorrectionEntry = useExecutionStore((state) => state.addCorrectionEntry)

  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [actualInput, setActualInput] = useState('')
  const [modalError, setModalError] = useState('')
  const [correctionNote, setCorrectionNote] = useState('')
  const [correctionFeedback, setCorrectionFeedback] = useState('')

  useEffect(() => {
    init()
  }, [init])

  const weeklyChartData = weeklyReports.map((report) => {
    const weekLabel = report.weekRange.includes('-')
      ? report.weekRange.split('-')[1].trim()
      : report.weekRange
    return {
      name: weekLabel,
      discipline: report.reliabilityScore,
      overload: Math.min(150, 120 - (report.reliabilityScore - report.burnoutRisk))
    }
  })

  const currentWeek = weeklyReports[weeklyReports.length - 1]

  const strongDayLabel = `Strongest day: ${latestRecord?.completionRate ?? 0}% completion (today)`
  const weakDayLabel = `Weakest day: ${latestRecord?.carryoverRate ?? 0}% carryover rate` +
    (carryoverCount ? ' — flag for correction' : '')

  const planningBias = useMemo(() => {
    if (!tasks.length) {
      return 'No tasks yet to shape a bias.'
    }
    const workShare = tasks.filter((task) => task.context === 'work').length / tasks.length
    return workShare > 0.6
      ? 'Planning bias toward work intensity; add buffer for personal/learning focus.'
      : 'Planning mix is balanced, keep inflating leisure windows carefully.'
  }, [tasks])

  const carryoverPattern = useMemo(() => {
    if (!carryoverCount) {
      return 'Zero carryovers this week; maintain the zero-tolerance streak.'
    }
    return `${carryoverCount} tasks carryover flagged, driving ${latestRecord?.carryoverRate ?? 0}% carryover rate.`
  }, [carryoverCount, latestRecord])

  const cognitiveTrend = latestRecord
    ? latestRecord.overloadIndex > 110
      ? `Cognitive load trending high (${latestRecord.overloadIndex}% overload).`
      : `Cognitive load staying stable (${latestRecord.overloadIndex}% overload).`
    : 'Cognitive load not yet recorded.'

  const directives = useMemo(
    () => [
      'Lock actual minutes per task before the day closes; missing logs count as failed estimation.',
      'Any plan that breaches 120% capacity is a planning failure — reset it before execution.',
      'Carryovers deduct XP automatically; push them to the next day with mandatory adjustment notes.'
    ],
    []
  )

  const openModal = (task: Task) => {
    if (recordLocked || task.completedAt) {
      return
    }
    setActiveTask(task)
    setActualInput(task.actualMinutes?.toString() ?? '')
    setModalError('')
  }

  const closeModal = () => {
    setActiveTask(null)
    setActualInput('')
    setModalError('')
  }

  const handleSave = async () => {
    if (!activeTask) {
      return
    }
    const minutes = Number(actualInput)
    if (!minutes || minutes <= 0) {
      setModalError('Actual minutes must be a positive number.')
      return
    }
    await markTaskComplete(activeTask.id, minutes)
    closeModal()
  }

  const handleCorrectionSubmit = async () => {
    if (!correctionNote.trim()) {
      setCorrectionFeedback('Correction note cannot be empty.')
      return
    }
    await addCorrectionEntry(correctionNote)
    setCorrectionNote('')
    setCorrectionFeedback('Correction logged. Immutable audit remains intact.')
  }

  if (!isReady) {
    return (
      <section>
        <p className="text-sm text-slate-400">Initializing ledger...</p>
      </section>
    )
  }

  return (
    <section className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Discipline score" value={`${disciplineScore.toFixed(1)} / 100`} density="Volatile" />
        <MetricCard label="Capacity usage" value={`${capacityUsage}%`} density="Compared to capacity" />
        <MetricCard label="Carryovers today" value={carryoverCount} density="Carryover is failure" accent="Punish inconsistency" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="XP total" value={xp} density="Execution experience" />
        <MetricCard label="Strong day streak" value={3} density="Maintaining focus" />
        <MetricCard label="Weak day streak" value={1} density="Track the failure signal" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr,2fr]">
        <WeeklyChart data={weeklyChartData} />
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-5">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Next brutal directive</p>
          <p className="mt-3 text-lg font-semibold text-white">
            Confirm today&apos;s capacity before scheduling. Anything over 120% is flagged as planning failure.
          </p>
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-slate-500">Immutable record locked once day closes</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr,1.2fr]">
        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Today&apos;s tasks</p>
            <span className="text-xs uppercase tracking-[0.3em] text-amber-400">Carryover flags</span>
          </div>
          <div className="mt-4 space-y-4">
            {tasks.map((task) => (
              <article
                key={task.id}
                className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{task.title}</p>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                    {task.context} · {task.estimatedMinutes} min planned
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className={task.carryoverCount ? 'text-amber-400' : 'text-slate-500'}>
                      {task.carryoverCount ? 'Carryover flagged' : 'On track'}
                    </span>
                    {task.completedAt && <span className="text-emerald-400">Actual logged</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openModal(task)}
                  disabled={recordLocked || Boolean(task.completedAt)}
                  className="rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {task.completedAt ? 'Logged' : 'Log actual'}
                </button>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">
            {recordLocked
              ? 'Day locked. Use a correction entry if a prior log needs adjustment.'
              : 'Actual minutes are mandatory when a task is marked complete; no skips.'}
          </p>
        </section>
        <section className="rounded-3xl border border-slate-800/60 bg-slate-900/80 p-5 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Daily ledger lock</p>
          <p className="mt-2 text-lg text-white">
            {recordLocked ? 'Immutability enforced. Day cannot be rewritten.' : 'Ledger still open. Lock at end of day.'}
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.3em] text-slate-500">Discipline snapshots</p>
          <ul className="mt-2 space-y-1">
            <li>Completion rate: {latestRecord?.completionRate ?? 0}%</li>
            <li>Carryover rate: {latestRecord?.carryoverRate ?? 0}%</li>
            <li>Estimation accuracy: {latestRecord?.estimationAccuracy ?? 0}%</li>
            <li>Overload index: {latestRecord?.overloadIndex ?? 0}%</li>
          </ul>
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={lockDay}
              disabled={recordLocked}
              className="rounded-full border border-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {recordLocked ? 'Day locked' : 'Lock day (end of execution)'}
            </button>
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-3 text-xs text-slate-400">
              <p className="uppercase tracking-[0.3em] text-slate-500">Correction entry</p>
              <p className="mt-2 text-[11px] text-slate-400">
                Locked days can only add correction notes; the immutable record stays sealed.
              </p>
              <textarea
                value={correctionNote}
                onChange={(event) => setCorrectionNote(event.target.value)}
                disabled={!recordLocked}
                className="mt-3 w-full rounded-xl border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-accent disabled:cursor-not-allowed"
                rows={3}
              />
              <button
                type="button"
                onClick={handleCorrectionSubmit}
                disabled={!recordLocked}
                className="mt-3 w-full rounded-full border border-slate-700/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Log correction
              </button>
              {correctionFeedback && <p className="mt-2 text-xs text-emerald-400">{correctionFeedback}</p>}
              {corrections.length > 0 ? (
                <div className="mt-3 space-y-1 text-[11px] text-slate-300">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-slate-500">Corrections today</p>
                  {corrections.map((correction) => (
                    <p key={correction.id}>
                      {correction.note} · {new Date(correction.createdAt).toLocaleTimeString('en-US')}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-slate-500">No corrections logged yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr,0.7fr]">
        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-5">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Weekly brutal AI audit</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800/60 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Execution summary</p>
              <p className="mt-2 text-sm text-white">
                {currentWeek?.aiAnalysis ?? 'No weekly analysis generated yet.'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/60 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Planning bias report</p>
              <p className="mt-2 text-sm text-white">{planningBias}</p>
            </div>
            <div className="rounded-2xl border border-slate-800/60 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Carryover pattern</p>
              <p className="mt-2 text-sm text-white">{carryoverPattern}</p>
            </div>
            <div className="rounded-2xl border border-slate-800/60 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Strongest / weakest day</p>
              <p className="mt-2 text-sm text-white">
                {strongDayLabel}
                <br />
                {weakDayLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/60 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Cognitive load trend</p>
              <p className="mt-2 text-sm text-white">{cognitiveTrend}</p>
            </div>
            <div className="rounded-2xl border border-slate-800/60 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Burnout risk %</p>
              <p className="mt-2 text-sm text-white">
                {currentWeek?.burnoutRisk ?? 0}% — {currentWeek?.focusConsistency ?? 0}% focus consistency
              </p>
            </div>
          </div>
        </section>
        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-5">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Corrective directives</p>
          <ol className="mt-4 list-decimal space-y-3 pl-4 text-sm text-slate-200">
            {directives.map((directive) => (
              <li key={directive}>{directive}</li>
            ))}
          </ol>
        </section>
      </div>

      {activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90">
          <div className="w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6">
            <header>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Task completion</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{activeTask.title}</h3>
              <p className="text-xs text-slate-500">Actual minutes entry is mandatory.</p>
            </header>
            <div className="mt-5 space-y-3">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500" htmlFor="actual-minutes">
                Actual minutes
              </label>
              <input
                id="actual-minutes"
                type="number"
                min={1}
                value={actualInput}
                onChange={(event) => setActualInput(event.target.value)}
                className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-accent"
              />
              {modalError && <p className="text-xs text-rose-400">{modalError}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-slate-700/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-full border border-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
              >
                Save actual
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {recordLocked
                ? 'Corrections only; once the day locks you cannot rewrite history.'
                : 'Completing this log feeds the immutable daily record.'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
