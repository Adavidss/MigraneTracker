import { useMemo } from 'react'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { INTENSITY_VAR, type PainPoint } from '@/lib/types'
import type { DayCell } from '@/lib/stats'
import { cn, dateKey, formatDayLong } from '@/lib/utils'
import { HeadGlyph } from './head-map'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface CalendarDayData extends DayCell {
  /** Pain map of the worst episode that day, so the glyph shows the real side. */
  painMap: PainPoint[]
}

/**
 * A month where every day is a visual summary rather than a number: a coloured
 * head for days with a headache, a pale tile for days confirmed clear, and
 * nothing at all for days never logged.
 */
export function MonthCalendar({
  month,
  days,
  onSelectDay,
  className,
  compact,
}: {
  month: Date
  days: Map<string, CalendarDayData>
  onSelectDay?: (date: string) => void
  className?: string
  compact?: boolean
}) {
  const today = dateKey()

  const grid = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const last = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    const out: Date[] = []
    for (let d = first; d <= last; d = addDays(d, 1)) out.push(d)
    return out
  }, [month])

  return (
    <div className={className}>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="pb-1 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {compact ? day[0] : day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((date) => {
          const key = dateKey(date)
          const outside = !isSameMonth(date, month)
          const data = days.get(key)
          const isToday = key === today

          const hasPain = !!data && data.episodes > 0
          const clear = !!data?.headacheFree

          const Tag = onSelectDay ? 'button' : 'div'

          return (
            <Tag
              key={key}
              {...(onSelectDay
                ? {
                    type: 'button' as const,
                    onClick: () => onSelectDay(key),
                    'aria-label': describeDay(key, data),
                  }
                : {})}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors',
                compact ? 'aspect-square' : 'aspect-square min-h-12',
                outside && 'opacity-30',
                clear
                  ? 'border-transparent bg-clear'
                  : hasPain
                    ? 'border-transparent bg-muted/60'
                    : 'border-transparent bg-muted/25',
                onSelectDay && 'hover:border-border',
                isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
              )}
            >
              <span
                className={cn(
                  'text-xs leading-none font-medium tabular-nums',
                  clear ? 'text-clear-foreground' : 'text-muted-foreground',
                  hasPain && 'text-foreground',
                )}
              >
                {date.getDate()}
              </span>

              {hasPain ? (
                <HeadGlyph
                  points={data.painMap}
                  fallback={data.maxIntensity ?? undefined}
                  size={compact ? 16 : 22}
                  className="text-muted-foreground"
                  title={describeDay(key, data)}
                />
              ) : clear ? (
                <span
                  className="block size-2 rounded-full bg-clear-foreground/60"
                  aria-hidden
                />
              ) : (
                <span className="block size-2" aria-hidden />
              )}

              {data && data.episodes > 1 ? (
                <span
                  className="absolute top-0.5 right-0.5 flex size-3.5 items-center justify-center rounded-full text-2xs font-bold text-white"
                  style={{
                    backgroundColor: data.maxIntensity
                      ? INTENSITY_VAR[data.maxIntensity]
                      : 'var(--color-muted-foreground)',
                  }}
                  aria-hidden
                >
                  {data.episodes}
                </span>
              ) : null}
            </Tag>
          )
        })}
      </div>
    </div>
  )
}

function describeDay(key: string, data: CalendarDayData | undefined): string {
  const day = formatDayLong(key)
  if (!data) return `${day} — nothing logged`
  if (data.headacheFree) return `${day} — no headache`
  const count = data.episodes === 1 ? '1 headache' : `${data.episodes} headaches`
  return `${day} — ${count}, worst level ${data.maxIntensity ?? '?'}`
}

export function CalendarLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground',
        className,
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-md bg-clear" />
        No headache
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-md bg-muted/25 ring-1 ring-border" />
        Not logged
      </span>
      <span className="flex items-center gap-1.5">
        <HeadGlyph points={[]} fallback={4} size={13} className="text-transparent" />
        Headache
      </span>
    </div>
  )
}
