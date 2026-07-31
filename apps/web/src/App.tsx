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

      <main className="flex-1 pb-16">
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
    </div>
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
