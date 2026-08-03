import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared chart chrome. Axes and grid stay recessive so the marks carry the
 * reading, and every colour comes from a theme variable rather than a literal
 * so light and dark stay in step.
 */

export const AXIS_PROPS = {
  tick: { fill: 'var(--color-muted-foreground)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

export const GRID_PROPS = {
  vertical: false,
  stroke: 'var(--color-border)',
  strokeDasharray: '0',
} as const

export interface TooltipRow {
  label: string
  value: ReactNode
  color?: string
}

/** Tooltip body shared by every chart, styled with the app's own surfaces. */
export function ChartTooltip({
  title,
  rows,
}: {
  title: ReactNode
  rows: TooltipRow[]
}) {
  return (
    <div className="pointer-events-none rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold">{title}</div>
      <ul className="space-y-0.5">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center gap-2">
            {row.color ? (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
            ) : null}
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto font-medium tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Legend swatches — identity is never carried by colour alone. */
export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string }[]
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1', className)}>
      {items.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className="size-2.5 rounded-[3px]"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  )
}

/** Horizontal bars for ranked nominal categories, with values labelled. */
export function RankedBars({
  items,
  max,
  formatValue,
  emptyLabel = 'Nothing recorded yet',
}: {
  items: { label: string; value: number; hint?: string }[]
  max?: number
  formatValue?: (value: number) => string
  emptyLabel?: string
}) {
  if (!items.length) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
  }

  const ceiling = max ?? Math.max(...items.map((i) => i.value), 1)

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium">{item.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatValue ? formatValue(item.value) : item.value}
              {item.hint ? (
                <span className="ml-1.5 opacity-70">{item.hint}</span>
              ) : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (item.value / ceiling) * 100)}%`,
                backgroundColor: 'var(--color-series-1)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
