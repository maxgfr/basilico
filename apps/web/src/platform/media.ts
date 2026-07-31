import { useEffect, useState } from 'react'

/**
 * Whether the device has a real pointer that can hover.
 *
 * This is decided in JavaScript rather than with a CSS media variant on purpose.
 * Gating the hover overlay with `[@media(hover:none)]:hidden` looked equivalent
 * but was not: tapping put focus inside the row, `group-focus-within` re-showed
 * the overlay, and it then sat on top of the touch button and swallowed its
 * click. Rendering one branch or the other also keeps a single set of actions in
 * the DOM — the CSS approach left two, so a screen reader announced every action
 * twice.
 */
export function useHoverCapable(): boolean {
  const [hoverCapable, setHoverCapable] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
    return window.matchMedia('(hover: hover)').matches
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(hover: hover)')
    const update = () => setHoverCapable(media.matches)
    update()
    // Plugging a mouse into a tablet flips this mid-session.
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return hoverCapable
}
