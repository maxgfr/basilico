import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  addInterruption,
  advance,
  appendSession,
  applySettings,
  createBackup,
  createTask,
  createTimerState,
  creditPomodoro,
  defaultSettings,
  finish,
  pause,
  parseSettings,
  removeTask as removeTaskCore,
  reorderTasks,
  resume,
  reset as resetCore,
  setTaskStatus,
  startPhase,
  updateTask as updateTaskCore,
  type Backup,
  type InterruptionKind,
  type NewTask,
  type SessionRecord,
  type Settings,
  type Task,
  type TaskStatus,
  type TimerEvent,
  type TimerState,
} from '@basilico/core'

/**
 * `maxgfr.github.io` est une origine partagée par tous les projets Pages du compte :
 * chaque clé est préfixée pour ne pas entrer en collision avec un autre dépôt.
 */
export const STORAGE_KEY = 'basilico:v1:app'

export type EndedSession = { record: SessionRecord; lateByMs: number }

type AppState = {
  settings: Settings
  timer: TimerState
  sessions: SessionRecord[]
  tasks: Task[]
  activeTaskId: string | null
  /** Dernière session close, pour le bandeau de rattrapage. */
  lastEnded: EndedSession | null
  /** File d'effets de bord (son, notification) drainée par le runtime. */
  pending: TimerEvent[]
  hydrated: boolean

  tick: (now: number) => void
  toggle: (now: number) => void
  startNow: (now: number) => void
  resetPhase: (now: number) => void
  skipPhase: (now: number) => void
  voidPhase: (now: number) => void
  interrupt: (kind: InterruptionKind) => void
  dismissEnded: () => void
  drainEvents: () => TimerEvent[]

  updateSettings: (patch: Partial<Settings>) => void
  addTask: (input: NewTask, now: number) => void
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

      /** Applique les événements du noyau : journal, compteurs, file d'effets. */
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
        pending: [],
        hydrated: false,

        tick: (now) => commit(advance(get().timer, ctx(now))),

        startNow: (now) => {
          const state = get()
          set({
            timer: startPhase(state.timer, ctx(now), { taskId: state.activeTaskId }),
            lastEnded: null,
            pending: [...state.pending, { type: 'phase-started', mode: state.timer.mode }],
          })
        },

        toggle: (now) => {
          const { timer, startNow } = get()
          if (timer.status === 'idle') return startNow(now)
          if (timer.status === 'paused') return set({ timer: resume(timer, ctx(now)) })
          set({ timer: pause(timer, ctx(now)) })
        },

        resetPhase: (now) => set({ timer: resetCore(get().timer, ctx(now)), lastEnded: null }),
        skipPhase: (now) => commit(finish(get().timer, ctx(now), 'skipped')),
        voidPhase: (now) => commit(finish(get().timer, ctx(now), 'voided')),

        interrupt: (kind) => set({ timer: addInterruption(get().timer, kind) }),
        dismissEnded: () => set({ lastEnded: null }),
        drainEvents: () => {
          const { pending } = get()
          if (pending.length > 0) set({ pending: [] })
          return pending
        },

        updateSettings: (patch) => {
          const settings = { ...get().settings, ...patch }
          // Les nouvelles durées ne s'appliquent qu'à l'arrêt : on ne rallonge
          // jamais une phase déjà en cours sous les pieds de l'utilisateur.
          set({ settings, timer: applySettings(get().timer, settings) })
        },

        addTask: (input, now) => {
          const { tasks, activeTaskId } = get()
          const task = createTask(tasks, input, now, uid())
          set({
            tasks: [...tasks, task],
            activeTaskId: activeTaskId ?? task.id,
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
          }),

        clearEverything: () =>
          set({
            sessions: [],
            tasks: [],
            activeTaskId: null,
            lastEnded: null,
            timer: createTimerState(get().settings),
          }),
      }
    },
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // `pending` et `hydrated` sont éphémères : les persister rejouerait un son
      // au rechargement et mentirait sur l'état d'hydratation.
      //
      // `lastEnded`, en revanche, est persisté exprès : c'est le message
      // « ta session s'est terminée il y a X ». Sans lui, quelqu'un qui ferme
      // l'onglet pendant un focus et revient plus tard ne verrait jamais
      // l'information pour laquelle le rattrapage existe.
      partialize: (state) => ({
        settings: state.settings,
        timer: state.timer,
        sessions: state.sessions,
        tasks: state.tasks,
        activeTaskId: state.activeTaskId,
        lastEnded: state.lastEnded,
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
          tasks: saved.tasks ?? [],
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
