import { useEffect, useState } from 'react'

/**
 * Routage par hash, volontairement : GitHub Pages ne sait pas réécrire les URL,
 * donc `/basilico/stats` renverrait un 404 au rechargement. Le hash marche à
 * l'identique en local, sous `/basilico/`, et dans la fenêtre PWA installée.
 */
export const ROUTES = {
  timer: { hash: '#/', label: 'Timer' },
  stats: { hash: '#/stats', label: 'Stats' },
  settings: { hash: '#/settings', label: 'Settings' },
} as const

export type RouteName = keyof typeof ROUTES

function readRoute(): RouteName {
  const hash = window.location.hash
  const found = (Object.keys(ROUTES) as RouteName[]).find((name) => ROUTES[name].hash === hash)
  return found ?? 'timer'
}

export function useRoute(): RouteName {
  const [route, setRoute] = useState<RouteName>(readRoute)

  useEffect(() => {
    const onChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

export function navigate(route: RouteName): void {
  window.location.hash = ROUTES[route].hash
}
