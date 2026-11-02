import { useSyncExternalStore } from 'react'
import { ROUTES, useRoute, type RouteName } from './lib/router'
import { TimerScreen } from './features/timer/TimerScreen'
import { TaskList } from './features/tasks/TaskList'
import { StatsScreen } from './features/stats/StatsScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { useTimerRuntime } from './features/timer/runtime'
import { useKeyboardShortcuts } from './features/timer/shortcuts'
import { useDocumentTitle } from './platform/title'
import { useAlerts } from './platform/alerts'
import { useTheme } from './platform/theme'
import { useExtensionBridge } from './platform/extension'
import { ThemeToggle } from './ui/ThemeToggle'
import { storageFailed, subscribeStorage } from './platform/storage'

export function App() {
  const route = useRoute()

  useTheme()
  useTimerRuntime()
  useKeyboardShortcuts()
  useDocumentTitle()
  useAlerts()
  useExtensionBridge()

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5">
      <TopBar route={route} />
      <StorageWarning />

      <main className="flex-1">
        {route === 'timer' && (
          <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-14">
            <TimerScreen />
            <aside className="lg:pt-10">
              <TaskList />
            </aside>
          </div>
        )}
        {route === 'stats' && <StatsScreen />}
        {route === 'settings' && <SettingsScreen />}
      </main>

      <Footer />
    </div>
  )
}

/**
 * The browser refused the last save. The origin is shared with other sites,
 * whose data counts against the same quota: saying nothing would let someone
 * keep working on a history that disappears at the next reload.
 */
function StorageWarning() {
  const failed = useSyncExternalStore(subscribeStorage, storageFailed)
  if (!failed) return null
  return (
    <p role="alert" className="border-danger text-danger mb-4 rounded-lg border px-4 py-3 text-sm">
      Storage for this site is full or blocked — your latest changes will be lost on reload.{' '}
      <a href={ROUTES.settings.hash} className="underline underline-offset-4">
        Export a backup
      </a>{' '}
      to keep them.
    </p>
  )
}

/**
 * Says the two things a stranger cannot verify by looking: that the code is
 * open, and that nothing leaves the browser. Both are the point of the project,
 * and a claim nobody can check is worth stating next to the source that proves it.
 */
function Footer() {
  return (
    <footer className="border-ink-800 text-ink-600 mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t py-6 text-xs">
      <p>
        Open source ·{' '}
        <a
          href="https://github.com/maxgfr/basilico"
          target="_blank"
          rel="noreferrer"
          className="hover:text-ink-100 underline underline-offset-4"
        >
          github.com/maxgfr/basilico
        </a>
      </p>
      <p>
        No account, no server, no tracking — your sessions never leave this browser.{' '}
        <a
          href={`${ROUTES.settings.hash}`}
          className="hover:text-ink-100 underline underline-offset-4"
        >
          Export them
        </a>{' '}
        whenever you like.
      </p>
    </footer>
  )
}

function TopBar({ route }: { route: RouteName }) {
  return (
    <header className="flex items-center justify-between gap-4 py-5">
      <a href={ROUTES.timer.hash} className="text-lg font-semibold tracking-tight">
        basilico
      </a>

      <div className="flex items-center gap-2">
        <nav aria-label="Sections">
          <ul className="bg-ink-900 flex items-center gap-1 rounded-lg p-1">
            {(Object.keys(ROUTES) as RouteName[]).map((name) => (
              <li key={name}>
                <a
                  href={ROUTES[name].hash}
                  aria-current={route === name ? 'page' : undefined}
                  className={`block rounded-md px-3 py-1.5 text-sm transition-colors duration-150 motion-reduce:transition-none ${
                    route === name
                      ? 'bg-ink-800 text-ink-100'
                      : 'text-ink-600 hover:text-ink-300 hover:bg-ink-800/60'
                  }`}
                >
                  {ROUTES[name].label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  )
}
