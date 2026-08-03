import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card text-card-foreground print-avoid-break',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-start justify-between gap-3 p-4 pb-2', className)}
      {...props}
    />
  )
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-sm font-semibold tracking-tight', className)}
      {...props}
    >
      {children}
    </h2>
  )
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)} {...props} />
  )
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-2', className)} {...props} />
}

/** A single headline figure with its label — the building block of the dashboard. */
export function Stat({
  label,
  value,
  hint,
  accent,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  accent?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-3.5 print-avoid-break',
        className,
      )}
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className="mt-1 text-2xl font-semibold tabular-nums tracking-tight"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  )
}
