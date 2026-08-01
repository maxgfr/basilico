import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  addInterruption,
  advance,
  annotateSession,
  appendSession,
  applySettings,
  createBackup,
  createTask,
  createTimerState,
  creditPomodoro,
  defaultSettings,
  finish,
  isRunOpen,
  lastSession,
  pause,
  parseSettings,
  carryOver,
  dayKey,
  normalizeTask,
  parseTaskInput,
  planTask as planTaskCore,
  removeTask as removeTaskCore,
  renameTask as renameTaskCore,
  reorderTasks,
  resume,
  reset as resetCore,
  setTaskStatus,
  startPhase,
  updateTask as updateTaskCore,
  type Backup,
  type InterruptionKind,
  type SessionAnnotation,
  type SessionRecord,
  type Settings,
  type Task,
  type TaskStatus,
  type TimerEvent,
  type TimerState,
} from '@basilico/core'

/**
 * `maxgfr.github.io` is an origin shared by every Pages project on the account:
 * each key is prefixed so it cannot collide with another repository.
 */
export const STORAGE_KEY = 'basilico:v1:app'

export type EndedSession = { record: SessionRecord; lateByMs: number }

/**
 * Resets recorded by day, so the count rolls over at midnight like every other
 * "today" figure. A reset writes nothing to the log — that is deliberate, and
 * it is why this has to be carried separately.
 */
export type ResetTally = { day: string; count: number }

type AppState = {
  settings: Settings
  timer: TimerState
  sessions: SessionRecord[]
  tasks: Task[]
  activeTaskId: string | null
  /** Last closed session, for the catch-up banner. */
  lastEnded: EndedSession | null
  /**
   * Start of the current run — one contiguous stretch at the desk, which is
   * what people mean by "this session" and which the flat log cannot express.
   * `null` until the first start. See `isRunOpen` for what closes it.
   */
  runStartedAt: number | null
  /** Resets in the current run, and today. Neither is derivable from the log. */
  resetsInRun: number
  resetsToday: ResetTally
  /** Queue of side effects (sound, notification) drained by the runtime. */
  pending: TimerEvent[]
  hydrated: boolean

  tick: (now: number) => void
  toggle: (now: number) => void
  startNow: (now: number) => void
  setIntention: (intention: string | null) => void
  resetPhase: (now: number) => void
  skipPhase: (now: number) => void
  donePhase: (now: number) => void
  voidPhase: (now: number) => void
  interrupt: (kind: InterruptionKind) => void
  dismissEnded: () => void
  drainEvents: () => TimerEvent[]

  updateSettings: (patch: Partial<Settings>) => void
  addTask: (raw: string, estimatedPomodoros: number, now: number) => void
  renameTask: (id: string, raw: string) => void
  planTask: (id: string, day: string | null) => void
  annotateLast: (patch: SessionAnnotation) => void
  editTask: (id: string, patch: Partial<Task>) => void
  setStatus: (id: string, status: TaskStatus, now: number) => void
  dropTask: (id: string) => void
  moveTask: (id: string, to: number) => void
  setActiveTask: (id: string | null) => void

  exportBackup: (now: number) => Backup
  replaceAll: (backup: Backup) => void
  clearEverything: () => void
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const ctx = (now: number) => ({ now, settings: get().settings, uid })

      /** Applies the core's events: log, counters, side-effect queue. */
      const commit = (result: { state: TimerState; events: TimerEvent[] }) => {
        if (result.events.length === 0) {
          set({ timer: result.state })
          return
        }

        const state = get()
        let sessions = state.sessions
        let tasks = state.tasks
        let lastEnded = state.lastEnded

        for (const event of result.events) {
          if (event.type !== 'session-ended') continue
          sessions = appendSession(sessions, event.record)
          if (event.record.mode === 'focus' && event.record.outcome === 'completed') {
            tasks = creditPomodoro(tasks, event.record.taskId)
          }
          lastEnded = { record: event.record, lateByMs: event.lateByMs }
        }

        set({
          timer: result.state,
          sessions,
          tasks,
          lastEnded,
          pending: [...state.pending, ...result.events],
        })
      }

      return {
        settings: defaultSettings,
        timer: createTimerState(defaultSettings),
        sessions: [],
        tasks: [],
        activeTaskId: null,
        lastEnded: null,
        runStartedAt: null,
        resetsInRun: 0,
        resetsToday: { day: '', count: 0 },
        pending: [],
        hydrated: false,

        tick: (now) => commit(advance(get().timer, ctx(now))),

        startNow: (now) => {
          const state = get()
          const task = state.tasks.find((t) => t.id === state.activeTaskId) ?? null
          // Starting is the only moment a run can begin, and the only place
          // that needs to ask whether the previous one is still going.
          const open = isRunOpen({
            runStartedAt: state.runStartedAt,
            idle: true,
            lastEndedAt: lastSession(state.sessions)?.endedAt ?? null,
            now,
          })
          set({
            runStartedAt: open ? state.runStartedAt : now,
            resetsInRun: open ? state.resetsInRun : 0,
            // The tag travels with the session so the per-tag stats can exist at
            // all: reading it back from the task later would rewrite history
            // whenever a task is retagged.
            timer: startPhase(state.timer, ctx(now), {
              taskId: state.activeTaskId,
              tag: task?.tag ?? null,
            }),
            lastEnded: null,
            pending: [...state.pending, { type: 'phase-started', mode: state.timer.mode }],
          })
        },

        toggle: (now) => {
          const { timer, startNow } = get()
          if (timer.status === 'idle') return startNow(now)
          if (timer.status === 'paused') return set({ timer: resume(timer, ctx(now)) })
          // Past the deadline the button reads "Stop", and it has to actually
          // stop: pausing an overtime session leaves it open with no way to
          // close it as done, which is the state flowtime lives in permanently.
          if (timer.status === 'overtime') return commit(finish(timer, ctx(now), 'completed'))
          set({ timer: pause(timer, ctx(now)) })
        },

        /**
         * Reset records nothing in the log — that is the whole point of it —
         * so the only way to report "you bailed out three times this
         * afternoon" is to count it here. It does **not** close the run: a
         * count of the resets in a run a reset had just ended would always
         * read zero.
         */
        resetPhase: (now) => {
          const state = get()
          const day = dayKey(now)
          set({
            timer: resetCore(state.timer, ctx(now)),
            lastEnded: null,
            resetsInRun: state.resetsInRun + 1,
            resetsToday:
              state.resetsToday.day === day
                ? { day, count: state.resetsToday.count + 1 }
                : { day, count: 1 },
          })
        },
        skipPhase: (now) => commit(finish(get().timer, ctx(now), 'skipped')),
        donePhase: (now) => commit(finish(get().timer, ctx(now), 'completed')),
        voidPhase: (now) => commit(finish(get().timer, ctx(now), 'voided')),

        interrupt: (kind) => set({ timer: addInterruption(get().timer, kind) }),
        setIntention: (intention) => set({ timer: { ...get().timer, intention } }),
        dismissEnded: () => set({ lastEnded: null }),
        drainEvents: () => {
          const { pending } = get()
          if (pending.length > 0) set({ pending: [] })
          return pending
        },

        updateSettings: (patch) => {
          const settings = { ...get().settings, ...patch }
          // New durations only apply while idle: we never stretch a phase that
          // is already running out from under the user.
          set({ settings, timer: applySettings(get().timer, settings) })
        },

        addTask: (raw, estimatedPomodoros, now) => {
          const { tasks, activeTaskId } = get()
          const { title, tag } = parseTaskInput(raw)
          if (title === '') return
          const task = createTask(tasks, { title, tag, estimatedPomodoros }, now, uid())
          set({
            tasks: [...tasks, task],
            activeTaskId: activeTaskId ?? task.id,
          })
        },

        renameTask: (id, raw) => set({ tasks: renameTaskCore(get().tasks, id, raw) }),

        planTask: (id, day) => set({ tasks: planTaskCore(get().tasks, id, day) }),

        /**
         * Annotates the session that just ended. The only write the append-only
         * log accepts, and it never touches durations or outcome.
         */
        annotateLast: (patch) => {
          const { lastEnded, sessions } = get()
          if (!lastEnded) return
          set({
            sessions: annotateSession(sessions, lastEnded.record.id, patch),
            lastEnded: { ...lastEnded, record: { ...lastEnded.record, ...patch } },
          })
        },

        editTask: (id, patch) => set({ tasks: updateTaskCore(get().tasks, id, patch) }),

        setStatus: (id, status, now) => {
          const tasks = setTaskStatus(get().tasks, id, status, now)
          const activeTaskId =
            status === 'active' || get().activeTaskId !== id ? get().activeTaskId : null
          set({ tasks, activeTaskId })
        },

        dropTask: (id) =>
          set({
            tasks: removeTaskCore(get().tasks, id),
            activeTaskId: get().activeTaskId === id ? null : get().activeTaskId,
          }),

        moveTask: (id, to) => set({ tasks: reorderTasks(get().tasks, id, to) }),
        setActiveTask: (id) => set({ activeTaskId: id }),

        exportBackup: (now) => {
          const { settings, sessions, tasks } = get()
          return createBackup(settings, sessions, tasks, now)
        },

        replaceAll: (backup) =>
          set({
            settings: backup.settings,
            sessions: backup.sessions,
            tasks: backup.tasks,
            timer: createTimerState(backup.settings),
            activeTaskId: null,
            lastEnded: null,
            runStartedAt: null,
            resetsInRun: 0,
            resetsToday: { day: '', count: 0 },
          }),

        clearEverything: () =>
          set({
            sessions: [],
            tasks: [],
            activeTaskId: null,
            lastEnded: null,
            timer: createTimerState(get().settings),
            runStartedAt: null,
            resetsInRun: 0,
            resetsToday: { day: '', count: 0 },
          }),
      }
    },
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // `pending` and `hydrated` are ephemeral: persisting them would replay a
      // sound on reload and lie about the hydration state.
      //
      // `lastEnded`, on the other hand, is persisted on purpose: it is the
      // "your session ended X ago" message. Without it, someone who closes the
      // tab mid-focus and comes back later would never see the very information
      // the catch-up exists for.
      partialize: (state) => ({
        settings: state.settings,
        timer: state.timer,
        sessions: state.sessions,
        tasks: state.tasks,
        activeTaskId: state.activeTaskId,
        lastEnded: state.lastEnded,
        // Closing the tab in the middle of a run must not wipe its count.
        runStartedAt: state.runStartedAt,
        resetsInRun: state.resetsInRun,
        resetsToday: state.resetsToday,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>
        const settings = parseSettings(saved.settings)
        return {
          ...current,
          ...saved,
          settings,
          timer: saved.timer ?? createTimerState(settings),
          sessions: saved.sessions ?? [],
          // Normalised then rolled forward on load: a task planned for a past day
          // is a leftover, and left dated it would silently drop out of today.
          tasks: carryOver((saved.tasks ?? []).map(normalizeTask), dayKey(Date.now())),
          // Written by a version that did not have them, or by a corrupted
          // save: the defaults are the honest answer, not a crash.
          runStartedAt: saved.runStartedAt ?? null,
          resetsInRun: saved.resetsInRun ?? 0,
          resetsToday:
            typeof saved.resetsToday?.day === 'string' &&
            typeof saved.resetsToday.count === 'number'
              ? saved.resetsToday
              : { day: '', count: 0 },
          pending: [],
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.tick(Date.now())
        useApp.setState({ hydrated: true })
      },
    },
  ),
)
