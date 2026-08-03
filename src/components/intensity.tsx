import {
  INTENSITIES,
  INTENSITY_LABEL,
  INTENSITY_VAR,
  intensityWash,
  type Intensity,
} from '@/lib/types'
import { cn } from '@/lib/utils'

/** The 1–5 scale as a row of large, colour-coded targets. */
export function IntensityPicker({
  value,
  onChange,
  label = 'Pain level',
  className,
}: {
  value: Intensity
  onChange: (next: Intensity) => void
  label?: string
  className?: string
}) {
  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-5 gap-1.5"
      >
        {INTENSITIES.map((level) => {
          const active = level === value
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${level} — ${INTENSITY_LABEL[level]}`}
              onClick={() => onChange(level)}
              className={cn(
                'flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-lg font-semibold transition-all',
                active
                  ? 'text-white shadow-sm'
                  : 'border-transparent bg-muted text-muted-foreground hover:brightness-95',
              )}
              style={
                active
                  ? {
                      backgroundColor: INTENSITY_VAR[level],
                      borderColor: INTENSITY_VAR[level],
                    }
                  : undefined
              }
            >
              {level}
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">
        {value} — {INTENSITY_LABEL[value]}
      </p>
    </div>
  )
}

/** Small solid dot used in lists and legends. */
export function IntensityDot({
  intensity,
  size = 10,
  className,
}: {
  intensity: Intensity
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: INTENSITY_VAR[intensity],
      }}
      aria-hidden
    />
  )
}

export function IntensityBadge({
  intensity,
  className,
}: {
  intensity: Intensity
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{
        backgroundColor: intensityWash(intensity),
        color: INTENSITY_VAR[intensity],
      }}
    >
      <IntensityDot intensity={intensity} size={7} />
      {INTENSITY_LABEL[intensity]}
    </span>
  )
}

export function IntensityLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5',
        className,
      )}
    >
      {INTENSITIES.map((level) => (
        <span
          key={level}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <IntensityDot intensity={level} size={8} />
          {level} {INTENSITY_LABEL[level]}
        </span>
      ))}
    </div>
  )
}
