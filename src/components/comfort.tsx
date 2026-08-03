import { useEffect } from 'react'
import { Minus, Moon, Plus, Type } from 'lucide-react'
import {
  MAX_DIM,
  TEXT_SCALE_FACTOR,
  type Settings,
  type TextScale,
} from '@/lib/types'
import { updateSettings } from '@/lib/db'
import { cn } from '@/lib/utils'

/**
 * Comfort controls exist because this app is opened during a migraine, when
 * light hurts, small text is unreadable and movement is nauseating.
 */

/**
 * Darkens the whole app past what the phone's own brightness slider allows.
 * Deliberately `pointer-events: none` so every control underneath stays
 * tappable at any dim level — including the control that undoes the dimming.
 */
export function DimOverlay({ level }: { level: number }) {
  // A non-finite value here would render an invalid opacity, which browsers
  // resolve to fully opaque — a black screen with no way back. Never trust it.
  const clamped = Number.isFinite(level)
    ? Math.min(MAX_DIM, Math.max(0, level))
    : 0
  if (clamped <= 0) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] bg-black print:hidden"
      style={{ opacity: clamped }}
    />
  )
}

/** Applies text scale and the motion override to the document. */
export function useComfort(settings: Settings) {
  const { textScale, reduceMotion } = settings

  useEffect(() => {
    const root = document.documentElement
    // Tailwind sizes in rem, so scaling the root scales the whole interface.
    root.style.fontSize = `${TEXT_SCALE_FACTOR[textScale] * 100}%`
    return () => {
      root.style.fontSize = ''
    }
  }, [textScale])

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion)
  }, [reduceMotion])
}

/**
 * The dim and text-size controls, sized for a thumb and reachable without
 * leaving whatever screen the user is on.
 */
export function ComfortControls({
  settings,
  className,
  compact,
}: {
  settings: Settings
  className?: string
  compact?: boolean
}) {
  const step = 0.2
  const setDim = (next: number) =>
    updateSettings({ dimLevel: Math.min(MAX_DIM, Math.max(0, Number(next.toFixed(2)))) })

  const scales: TextScale[] = ['normal', 'large', 'larger']
  const nextScale = () => {
    const index = scales.indexOf(settings.textScale)
    return scales[(index + 1) % scales.length]!
  }

  const dimPercent = Math.round((settings.dimLevel / MAX_DIM) * 100)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex flex-1 items-center gap-1 rounded-2xl bg-muted p-1">
        <ComfortButton
          label="Less dim"
          onClick={() => setDim(settings.dimLevel - step)}
          disabled={settings.dimLevel <= 0}
          compact={compact}
        >
          <Minus />
        </ComfortButton>

        <span className="flex flex-1 items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Moon className="size-4" />
          {dimPercent > 0 ? `${dimPercent}%` : 'Dim'}
        </span>

        <ComfortButton
          label="More dim"
          onClick={() => setDim(settings.dimLevel + step)}
          disabled={settings.dimLevel >= MAX_DIM}
          compact={compact}
        >
          <Plus />
        </ComfortButton>
      </div>

      <button
        type="button"
        onClick={() => updateSettings({ textScale: nextScale() })}
        aria-label={`Text size: ${settings.textScale}. Tap to change.`}
        className={cn(
          'flex items-center justify-center gap-1 rounded-2xl bg-muted font-medium text-muted-foreground',
          compact ? 'h-11 px-4' : 'h-14 px-5',
        )}
      >
        <Type className="size-4" />
        <span className="text-sm">
          {settings.textScale === 'normal'
            ? 'A'
            : settings.textScale === 'large'
              ? 'A+'
              : 'A++'}
        </span>
      </button>
    </div>
  )
}

function ComfortButton({
  children,
  label,
  onClick,
  disabled,
  compact,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center rounded-xl text-muted-foreground transition-colors disabled:opacity-30',
        compact ? 'size-9' : 'size-12',
        !disabled && 'hover:bg-card active:bg-card',
      )}
    >
      <span className="[&_svg]:size-5">{children}</span>
    </button>
  )
}
