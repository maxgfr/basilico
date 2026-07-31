import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'icon' | 'sm' | 'md' | 'lg'

// `whitespace-nowrap`: a label that wraps inside a fixed-height button spills its
// second line above and below the box, which is what a two-word action in a
// narrow column does by default.
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ' +
  'disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

const VARIANTS: Record<Variant, string> = {
  // A `hover:bg-white` would invert in the light theme; opacity works both ways.
  primary: 'bg-ink-100 text-ink-950 hover:opacity-90 active:opacity-80',
  secondary: 'bg-ink-800 text-ink-100 hover:bg-ink-600/60 active:bg-ink-800',
  // `bg-ink-800`, not `900`: ghost buttons sit on hovered rows and panels that
  // are themselves `ink-900`, where an `ink-900` hover is invisible.
  ghost: 'text-ink-300 hover:bg-ink-800 hover:text-ink-100 active:bg-ink-600/40',
  danger: 'text-danger hover:bg-danger-soft/60 active:bg-danger-soft',
}

const SIZES: Record<Size, string> = {
  icon: 'h-7 w-7 shrink-0 text-sm leading-none',
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-8 text-base',
}

// `ComponentProps<'button'>` rather than `ButtonHTMLAttributes`: React 19 hands
// `ref` through as an ordinary prop, and only the former's type admits it.
type Props = ComponentProps<'button'> & {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...rest }: Props) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest} />
}
