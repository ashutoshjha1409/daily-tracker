'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { getDb } from '@/lib/db'
import type { Task } from '@/lib/models'

const TODAY = new Date().toISOString().split('T')[0]

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isPast(dateStr: string): boolean {
  return dateStr < TODAY
}

type FilterMode = 'all' | 'missed' | 'streak'

export default function TrackerPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [completions, setCompletions] = useState<Set<string>>(new Set())
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const [filter, setFilter] = useState<FilterMode>('all')
  const [taskFilter, setTaskFilter] = useState<Set<string>>(new Set()) // empty = all
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [ready, setReady] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [taskSelectOpen, setTaskSelectOpen] = useState(false)
  const [taskSearch, setTaskSearch] = useState('')

  const db = typeof window !== 'undefined' ? getDb() : null

  const PREFS_KEY = 'daily-tracker-prefs'
  const savePrefs = useCallback((filterVal: FilterMode, taskIds: string[]) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ filter: filterVal, taskFilterIds: taskIds }))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!db) return
    let cancelled = false
    Promise.all([
      db.tasks.orderBy('order').toArray(),
      db.completions.toArray()
    ]).then(([t, c]) => {
      if (cancelled) return
      setTasks(t)
      setCompletions(new Set(c.map((x) => `${x.taskId}|${x.date}`)))
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(PREFS_KEY) : null
        if (raw) {
          const p = JSON.parse(raw) as { filter?: FilterMode; taskFilterIds?: string[] }
          if (p.filter) setFilter(p.filter)
          if (Array.isArray(p.taskFilterIds) && p.taskFilterIds.length > 0) {
            const taskIds = new Set(t.map((x) => x.id))
            const valid = p.taskFilterIds.filter((id) => taskIds.has(id))
            if (valid.length > 0) setTaskFilter(new Set(valid))
          }
        }
      } catch {
        // ignore
      }
      setReady(true)
    })
    return () => { cancelled = true }
  }, [db])

  useEffect(() => {
    if (!ready) return
    savePrefs(filter, Array.from(taskFilter))
  }, [ready, filter, taskFilter, savePrefs])

  const daysInView = getDaysInMonth(viewMonth.year, viewMonth.month)
  const viewMonthLabel = useMemo(
    () =>
      new Date(viewMonth.year, viewMonth.month - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      }),
    [viewMonth]
  )

  const toggleCompletion = useCallback(
    async (taskId: string, date: string) => {
      if (!db) return
      const key = `${taskId}|${date}`
      if (completions.has(key)) {
        await db.completions.delete([taskId, date])
        setCompletions((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      } else {
        await db.completions.put({ taskId, date })
        setCompletions((prev) => new Set(prev).add(key))
      }
    },
    [db, completions]
  )

  const addTask = useCallback(async () => {
    const title = newTaskTitle.trim()
    if (!title || !db) return
    const task: Task = {
      id: uuidv4(),
      title,
      order: tasks.length,
      createdAt: new Date().toISOString()
    }
    await db.tasks.add(task)
    setTasks((prev) => [...prev, task].sort((a, b) => a.order - b.order))
    setNewTaskTitle('')
  }, [newTaskTitle, db, tasks.length])

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!db) return
      await db.tasks.delete(taskId)
      await db.completions.where('taskId').equals(taskId).delete()
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      setCompletions((prev) => {
        const next = new Set(prev)
        for (const k of next) {
          if (k.startsWith(taskId + '|')) next.delete(k)
        }
        return next
      })
      setEditingTaskId(null)
    },
    [db]
  )

  const updateTaskTitle = useCallback(
    async (taskId: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed || !db) return
      await db.tasks.update(taskId, { title: trimmed })
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t)))
      setEditingTaskId(null)
      setEditingTitle('')
    },
    [db]
  )

  const completionSet = completions
  const filteredTasks = useMemo(() => {
    let list = tasks
    if (taskFilter.size > 0) {
      list = list.filter((t) => taskFilter.has(t.id))
    }
    if (filter === 'all') return list
    return list.filter((task) => {
      let hasMiss = false
      let hasStreak = false
      let run = 0
      for (let d = 1; d <= daysInView; d++) {
        const dateStr = dateKey(viewMonth.year, viewMonth.month, d)
        if (dateStr > TODAY) break
        const done = completionSet.has(`${task.id}|${dateStr}`)
        if (done) {
          run++
          if (run >= 2) hasStreak = true
        } else {
          run = 0
          hasMiss = true
        }
      }
      if (filter === 'missed') return hasMiss
      if (filter === 'streak') return hasStreak
      return true
    })
  }, [tasks, taskFilter, filter, viewMonth, daysInView, completionSet])

  const metrics = useMemo(() => {
    let totalCells = 0
    let doneCells = 0
    const byDay: Record<number, number> = {}
    for (let d = 1; d <= daysInView; d++) {
      byDay[d] = 0
    }
    for (const task of tasks) {
      for (let d = 1; d <= daysInView; d++) {
        const dateStr = dateKey(viewMonth.year, viewMonth.month, d)
        if (dateStr > TODAY) continue
        totalCells++
        const done = completionSet.has(`${task.id}|${dateStr}`)
        if (done) {
          doneCells++
          byDay[d] = (byDay[d] ?? 0) + 1
        }
      }
    }
    const chartData = Array.from({ length: daysInView }, (_, i) => i + 1).map((d) => {
      const done = byDay[d] ?? 0
      const total = tasks.length
      const pct = total ? Math.round((done / total) * 100) : 0
      return { day: d, done, total, pct }
    })
    const pct = totalCells ? Math.round((doneCells / totalCells) * 100) : 0
    let maxStreak = 0
    const taskStats: { taskId: string; title: string; done: number; total: number; pct: number }[] = []
    for (const task of tasks) {
      let run = 0
      let taskDone = 0
      let taskTotal = 0
      for (let d = 1; d <= daysInView; d++) {
        const dateStr = dateKey(viewMonth.year, viewMonth.month, d)
        if (dateStr > TODAY) break
        taskTotal++
        const done = completionSet.has(`${task.id}|${dateStr}`)
        if (done) {
          taskDone++
          run++
          maxStreak = Math.max(maxStreak, run)
        } else run = 0
      }
      taskStats.push({
        taskId: task.id,
        title: task.title,
        done: taskDone,
        total: taskTotal,
        pct: taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0
      })
    }
    return { pct, doneCells, totalCells, maxStreak, chartData, taskStats }
  }, [tasks, viewMonth, daysInView, completionSet])

  const getCellState = useCallback(
    (taskId: string, dateStr: string) => {
      const done = completions.has(`${taskId}|${dateStr}`)
      const past = isPast(dateStr)
      if (done) return 'done'
      if (past) return 'missed'
      return 'upcoming'
    },
    [completions]
  )

  const goPrevMonth = () => {
    setViewMonth((m) => {
      if (m.month === 1) return { year: m.year - 1, month: 12 }
      return { year: m.year, month: m.month - 1 }
    })
  }

  const goNextMonth = () => {
    setViewMonth((m) => {
      if (m.month === 12) return { year: m.year + 1, month: 1 }
      return { year: m.year, month: m.month + 1 }
    })
  }

  if (!ready) {
    return (
      <div className="grid h-full min-h-screen place-items-center text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="shrink-0 border-b border-slate-700 bg-slate-900/80 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-white">Daily Tracker</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrevMonth}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm hover:bg-slate-700"
            >
              ←
            </button>
            <span className="min-w-[7rem] text-center text-sm font-medium">{viewMonthLabel}</span>
            <button
              type="button"
              onClick={goNextMonth}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm hover:bg-slate-700"
            >
              →
            </button>
          </div>
        </div>
      </header>

      <section className="shrink-0 border-b border-slate-700 bg-slate-900/50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{metrics.pct}%</div>
              <div className="text-xs text-slate-500">Done this month</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-sky-400">{metrics.maxStreak}</div>
              <div className="text-xs text-slate-500">Best streak (days)</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Status:</span>
            {(['all', 'missed', 'streak'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  filter === f
                    ? 'bg-sky-600 text-white'
                    : 'border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {f === 'all' ? 'All' : f === 'missed' ? 'With misses' : 'On streak'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-24 shrink-0">
            <p className="mb-0.5 text-xs text-slate-500">Completions per day</p>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart
                data={metrics.chartData.length ? metrics.chartData : [{ day: 1, done: 0, total: 1, pct: 0 }]}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip
                  content={({ payload }) =>
                    payload?.[0] ? (
                      <span className="rounded bg-slate-800 px-2 py-1 text-xs">
                        Day {payload[0].payload.day}: {payload[0].payload.done}/{payload[0].payload.total} ({payload[0].payload.pct}%)
                      </span>
                    ) : null
                  }
                />
                <Bar dataKey="done" radius={2}>
                  {metrics.chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.done === entry.total
                          ? 'rgb(52 211 153)'
                          : entry.done > 0
                            ? 'rgb(56 189 248)'
                            : 'rgb(71 85 105)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-24 shrink-0">
            <p className="mb-0.5 text-xs text-slate-500">Daily completion %</p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart
                data={metrics.chartData.length ? metrics.chartData : [{ day: 1, pct: 0 }]}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  content={({ payload }) =>
                    payload?.[0] ? (
                      <span className="rounded bg-slate-800 px-2 py-1 text-xs">
                        Day {payload[0].payload.day}: {payload[0].payload.pct}%
                      </span>
                    ) : null
                  }
                />
                <Line type="monotone" dataKey="pct" stroke="rgb(56 189 248)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-24 shrink-0">
            <p className="mb-0.5 text-xs text-slate-500">Per-task completion %</p>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart
                layout="vertical"
                data={metrics.taskStats.length ? metrics.taskStats.slice(0, 8) : [{ title: '—', pct: 0 }]}
                margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
              >
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="title" width={80} tick={{ fontSize: 9 }} />
                <Tooltip
                  content={({ payload }) =>
                    payload?.[0] ? (
                      <span className="rounded bg-slate-800 px-2 py-1 text-xs">
                        {payload[0].payload.title}: {payload[0].payload.pct}%
                      </span>
                    ) : null
                  }
                />
                <Bar dataKey="pct" fill="rgb(52 211 153)" radius={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="shrink-0 border-b border-slate-700 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="New task (e.g. Wake 5am, 2L water…)"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            className="w-56 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={addTask}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Add task
          </button>
          <div className="relative flex items-center gap-2 border-l border-slate-600 pl-2">
            <span className="text-xs text-slate-500">Tasks:</span>
            <button
              type="button"
              onClick={() => setTaskSelectOpen((o) => !o)}
              className="flex min-w-[7rem] items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-left text-sm text-slate-200"
            >
              {taskFilter.size === 0 ? 'All' : `${taskFilter.size} selected`}
              <span className="ml-auto shrink-0">▾</span>
            </button>
            {taskSelectOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  aria-hidden
                  onClick={() => setTaskSelectOpen(false)}
                />
                <div className="absolute left-2 top-full z-30 mt-1 w-72 rounded border border-slate-600 bg-slate-800 shadow-lg">
                  <input
                    type="text"
                    placeholder="Search tasks…"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="w-full border-b border-slate-600 bg-slate-800 px-2 py-2 text-sm placeholder:text-slate-500"
                  />
                  <div className="max-h-48 overflow-auto py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTaskFilter(new Set())
                        setTaskSelectOpen(false)
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm ${
                        taskFilter.size === 0 ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      All tasks
                    </button>
                    {tasks
                      .filter((t) => !taskSearch.trim() || t.title.toLowerCase().includes(taskSearch.trim().toLowerCase()))
                      .map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTaskFilter((prev) => {
                              const next = new Set(prev)
                              if (next.has(t.id)) next.delete(t.id)
                              else next.add(t.id)
                              return next.size === 0 ? new Set() : next
                            })
                          }}
                          className={`w-full truncate px-3 py-1.5 text-left text-sm ${
                            taskFilter.has(t.id) ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {t.title}
                        </button>
                      ))}
                  </div>
                </div>
              </>
            )}
            {taskFilter.size > 0 && (
              <>
                {tasks
                  .filter((t) => taskFilter.has(t.id))
                  .map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-700 px-2 py-0.5 text-xs text-slate-200"
                    >
                      {t.title}
                      <button
                        type="button"
                        onClick={() =>
                          setTaskFilter((prev) => {
                            const next = new Set(prev)
                            next.delete(t.id)
                            return next.size === 0 ? new Set() : next
                          })
                        }
                        className="hover:text-red-300"
                        aria-label={`Remove ${t.title} from filter`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </>
            )}
          </div>
        </div>
      </section>

      <div className="flex-1 px-3 py-2">
        <div className="max-md:overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-40 max-w-[60vw] border border-slate-700 bg-slate-800 px-2 py-1.5 text-left text-xs font-medium text-slate-400 md:max-w-none">
                  Task
                </th>
                {Array.from({ length: daysInView }, (_, i) => i + 1).map((d) => {
                  const dateStr = dateKey(viewMonth.year, viewMonth.month, d)
                  const isTodayDate = dateStr === TODAY
                  return (
                    <th
                      key={d}
                      className={`min-w-[2rem] border border-slate-700 px-1 py-1 text-center text-xs ${
                        isTodayDate ? 'bg-sky-900/50 font-medium text-sky-300' : 'bg-slate-800/80 text-slate-500'
                      }`}
                    >
                      {d}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={daysInView + 1}
                    className="border border-slate-700 bg-slate-800/50 px-2 py-6 text-center text-slate-500"
                  >
                    No tasks yet. Add a task above, or change the filter.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task.id} className="group">
                    <td className="sticky left-0 z-10 w-40 max-w-[60vw] border border-slate-700 bg-slate-800/90 px-2 py-1 md:max-w-none">
                      <div className="flex min-w-0 items-center justify-between gap-1">
                        {editingTaskId === task.id ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={() => updateTaskTitle(task.id, editingTitle)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updateTaskTitle(task.id, editingTitle)
                              if (e.key === 'Escape') {
                                setEditingTaskId(null)
                                setEditingTitle('')
                              }
                            }}
                            autoFocus
                            className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 text-sm text-slate-100"
                          />
                        ) : (
                          <span className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTaskId(task.id)
                                setEditingTitle(task.title)
                              }}
                              className="whitespace-nowrap text-left text-slate-200 hover:underline"
                              title="Click to edit"
                            >
                              {task.title}
                            </button>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeTask(task.id)}
                          className="shrink-0 rounded p-0.5 text-slate-500 opacity-0 hover:bg-red-900/50 hover:text-red-400 group-hover:opacity-100"
                          title="Remove task"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                    {Array.from({ length: daysInView }, (_, i) => i + 1).map((d) => {
                      const dateStr = dateKey(viewMonth.year, viewMonth.month, d)
                      const state = getCellState(task.id, dateStr)
                      const done = state === 'done'
                      return (
                        <td
                          key={d}
                          className={`min-w-[2rem] border border-slate-700 p-0.5 text-center ${
                            state === 'done'
                              ? 'bg-emerald-900/60'
                              : state === 'missed'
                                ? 'bg-red-900/30'
                                : 'bg-slate-800/50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCompletion(task.id, dateStr)}
                            className={`flex h-6 w-full min-w-[1.5rem] items-center justify-center rounded ${
                              done
                                ? 'bg-emerald-600 text-white'
                                : state === 'missed'
                                  ? 'bg-red-600/90 text-red-100 hover:bg-red-500/90'
                                  : 'bg-slate-700/50 text-slate-500 hover:bg-slate-600'
                            }`}
                            title={state === 'missed' ? `${dateStr} — Not done (click to mark done)` : dateStr}
                          >
                            {done ? (
                              <span className="text-sm font-medium">✓</span>
                            ) : state === 'missed' ? (
                              <span className="text-sm font-bold" aria-label="Not done">×</span>
                            ) : null}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
