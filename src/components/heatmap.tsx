import { useMemo } from 'react'
import { addDays, format, isSameMonth, startOfWeek } from 'date-fns'
import { INTENSITY_VAR, type Intensity } from '@/lib/types'
import type { DayCell } from '@/lib/stats'
import { cn, dateKey, formatDayShort, keyToDate } from '@/lib/utils'

export type HeatmapMetric = 'episodes' | 'pain' | 'medication'

export const HEATMAP_METRICS: { value: HeatmapMetric; label: string }[] = [
  { value: 'episodes', label: 'Headaches' },
  { value: 'pain', label: 'Worst pain' },
  { value: 'medication', label: 'Medication' },
]

/**
 * Sequential single-hue ramp for count metrics — magnitude, so one hue stepped
 * light to dark. Both modes are defined in index.css, which keeps the colours
 * correct when the theme changes without this component re-rendering.
 */
const COUNT_STEPS = 5

function rampColor(level: number): string {
  return `var(--color-count-${Math.min(level, COUNT_STEPS - 1) + 1})`
}

function cellColor(
  cell: DayCell | undefined,
  metric: HeatmapMetric,
): { fill: string; label: string } {
  if (!cell) return { fill: 'var(--color-muted)', label: 'not logged' }
  if (cell.headacheFree) return { fill: 'var(--color-clear)', label: 'no headache' }

  switch (metric) {
    case 'pain': {
      const level = (cell.maxIntensity ?? 1) as Intensity
      return { fill: INTENSITY_VAR[level], label: `worst pain ${level}` }
    }
    case 'medication': {
      if (cell.doses === 0) {
        return { fill: 'var(--color-muted)', label: 'no medication' }
      }
      return {
        fill: rampColor(cell.doses - 1),
        label: `${cell.doses} dose${cell.doses === 1 ? '' : 's'}`,
      }
    }
    case 'episodes':
    default:
      return {
        fill: rampColor(cell.episodes - 1),
        label: `${cell.episodes} headache${cell.episodes === 1 ? '' : 's'}`,
      }
  }
}

/**
 * A GitHub-style year grid: one column per week, one row per weekday. Long
 * stretches of good and bad months become obvious without reading a number.
 */
export function Heatmap({
  from,
  to,
  cells,
  metric,
  onSelectDay,
  className,
}: {
  from: string
  to: string
  cells: Map<string, DayCell>
  metric: HeatmapMetric
  onSelectDay?: (date: string) => void
  className?: string
}) {
  const weeks = useMemo(() => {
    const start = startOfWeek(keyToDate(from), { weekStartsOn: 1 })
    const end = keyToDate(to)
    const out: Date[][] = []
    let cursor = start

    while (cursor <= end) {
      const week: Date[] = []
      for (let i = 0; i < 7; i += 1) week.push(addDays(cursor, i))
      out.push(week)
      cursor = addDays(cursor, 7)
    }
    return out
  }, [from, to])

  const today = dateKey()

  return (
    <div className={cn('no-scrollbar overflow-x-auto', className)}>
      <div className="inline-flex min-w-full flex-col gap-1">
        {/* Month labels sit above the first week that starts a new month. */}
        <div className="flex gap-[3px] pl-7">
          {weeks.map((week, i) => {
            const first = week[0]!
            const previous = weeks[i - 1]?.[0]
            const isNewMonth = !previous || !isSameMonth(first, previous)
            return (
              <div key={i} className="w-[11px] shrink-0">
                {isNewMonth ? (
                  <span className="block text-[0.6rem] leading-none text-muted-foreground">
                    {format(first, 'MMM')}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="flex gap-[3px]">
          <div className="flex w-7 shrink-0 flex-col gap-[3px] pr-1">
            {['M', '', 'W', '', 'F', '', 'S'].map((day, i) => (
              <span
                key={i}
                className="flex h-[11px] items-center justify-end text-[0.55rem] leading-none text-muted-foreground"
              >
                {day}
              </span>
            ))}
          </div>

          {weeks.map((week, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {week.map((date) => {
                const key = dateKey(date)
                const beyond = key > to || key < from
                const cell = cells.get(key)
                const { fill, label } = cellColor(cell, metric)

                if (beyond) {
                  return <span key={key} className="size-[11px]" aria-hidden />
                }

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!onSelectDay}
                    onClick={() => onSelectDay?.(key)}
                    title={`${formatDayShort(key)} — ${label}`}
                    aria-label={`${formatDayShort(key)}, ${label}`}
                    className={cn(
                      'size-[11px] shrink-0 rounded-[3px] transition-transform',
                      onSelectDay && 'hover:scale-125',
                      key === today && 'ring-1 ring-primary ring-offset-1 ring-offset-card',
                    )}
                    style={{ backgroundColor: fill }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function HeatmapLegend({ metric }: { metric: HeatmapMetric }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[0.65rem] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          className="size-[11px] rounded-[3px]"
          style={{ backgroundColor: 'var(--color-clear)' }}
        />
        No headache
      </span>
      <span className="flex items-center gap-1">
        Less
        {metric === 'pain'
          ? ([1, 2, 3, 4, 5] as Intensity[]).map((level) => (
              <span
                key={level}
                className="size-[11px] rounded-[3px]"
                style={{ backgroundColor: INTENSITY_VAR[level] }}
              />
            ))
          : [0, 1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className="size-[11px] rounded-[3px]"
                style={{ backgroundColor: rampColor(level) }}
              />
            ))}
        More
      </span>
    </div>
  )
}
