import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * The popover behind every menu in the app.
 *
 * Extracted rather than written twice: the interruption menu and the task row
 * menu need the same four things, and the hard parts — Escape handing focus
 * back, a pointer-down outside closing, and a panel that cannot end up off
 * screen — are exactly the parts that quietly drift apart when copied.
 *
 * The panel is `fixed` to the viewport, never absolutely positioned inside the
 * row. A task list lives in a scrolling column with `overflow` on ancestors, and
 * an absolute panel gets clipped by the first one of them.
 */

/** Where the panel sits relative to its trigger. */
type Align = 'center' | 'end'

type Placement = {
  top?: number
  bottom?: number
  left?: number
  right?: number
  maxHeight?: number
}

/** Breathing room kept between the panel and the edge of the screen. */
const EDGE = 12

export function useMenu(align: Align = 'end') {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<Placement>({ top: 0 })
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const close = (refocus = false) => {
    setOpen(false)
    // Handing focus back matters on Escape and after choosing an item: the row
    // the menu belonged to may be gone, and focus would fall to <body>.
    if (refocus) trigger.current?.focus()
  }

  const place = useCallback(() => {
    const box = trigger.current?.getBoundingClientRect()
    if (!box) return

    // `scrollHeight`, not `offsetHeight`: once a `maxHeight` has been applied the
    // panel measures as the cap, and re-placing it would keep it there forever.
    const wanted = panel.current?.scrollHeight ?? 0
    const roomBelow = window.innerHeight - box.bottom - 8 - EDGE
    const roomAbove = box.top - 8 - EDGE

    // Below whenever it fits, otherwise whichever side has more room — and
    // capped to that room, so a menu longer than the screen scrolls inside
    // itself instead of running off the bottom of a phone.
    const below = wanted <= roomBelow || roomBelow >= roomAbove
    const vertical: Placement = below
      ? { top: box.bottom + 8, maxHeight: Math.max(120, roomBelow) }
      : { bottom: window.innerHeight - box.top + 8, maxHeight: Math.max(120, roomAbove) }

    // Centring on the trigger pushes a panel flush against the edge on a narrow
    // screen, and clamping its width does not help — the overflow comes from
    // where it is centred, not how wide it is. So a centred trigger centres on
    // the viewport, and a row trigger aligns its right edge and stays put.
    setPlacement(
      align === 'center'
        ? { ...vertical, left: window.innerWidth / 2 }
        : { ...vertical, right: Math.max(12, window.innerWidth - box.right) },
    )
  }, [align])

  // Layout effect: measured and placed before the browser paints, so the panel
  // never appears at the wrong end of the screen for one frame.
  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (container.current?.contains(target) || panel.current?.contains(target)) return
      close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      close(true)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    // Follow the trigger rather than close. A phone scrolls on its own — the
    // address bar collapsing is a scroll event — and a menu that shuts itself
    // the moment you reach for it is worse than one that moves.
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  return {
    open,
    close,
    container,
    panelRef: panel,
    triggerProps: {
      ref: trigger,
      'aria-expanded': open,
      'aria-haspopup': 'dialog' as const,
      onClick: () => setOpen((v) => !v),
    },
    panelProps: {
      ref: panel,
      role: 'dialog' as const,
      style: placement,
      className: `border-ink-800 bg-ink-950 fixed z-30 w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border p-2 shadow-2xl ${
        placement.left === undefined ? '' : '-translate-x-1/2'
      }`,
    },
  }
}

/**
 * One action, with what it does written under it.
 *
 * The meaning is not decoration. These menus exist because a row of bare
 * controls kept prompting "what does this one do?", and a label alone was what
 * failed the first time.
 */
export function MenuItem({
  label,
  meaning,
  count,
  danger,
  disabled,
  onClick,
}: {
  label: string
  meaning?: string
  count?: number
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const describedBy = useId()

  return (
    <button
      type="button"
      onClick={onClick}
      // The name is the action alone. Left to the content, it would swallow the
      // meaning too — "Delete Cannot be undone." is a sentence, not a command,
      // and it is the label a screen reader would read out on focus. The meaning
      // becomes the description, which is what it is.
      aria-label={label}
      aria-describedby={meaning ? describedBy : undefined}
      // `aria-disabled` rather than `disabled`: a disabled control drops the
      // focus it is holding, which inside an open menu closes the menu.
      aria-disabled={disabled || undefined}
      className={`focus-visible:outline-ink-300 block w-full rounded-lg px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-2 motion-reduce:transition-none ${
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-ink-900'
      } ${danger ? 'text-danger' : ''}`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="text-ink-600 tabular text-xs">{count}</span>
        )}
      </span>
      {meaning && (
        <span id={describedBy} className="text-ink-600 mt-0.5 block text-xs leading-relaxed">
          {meaning}
        </span>
      )}
    </button>
  )
}

/** A labelled rule between groups of items, so a menu reads in sections. */
export function MenuSeparator({ children }: { children?: ReactNode }) {
  return (
    <div
      role="separator"
      className="border-ink-800 text-ink-600 mt-1 mb-0.5 border-t px-3 pt-2 text-[0.6875rem] tracking-wide uppercase"
    >
      {children}
    </div>
  )
}
