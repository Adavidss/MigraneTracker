import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Titled block used to group the form and dashboard into readable chunks. */
export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-2.5', className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

/**
 * Optional detail, folded away by default so the core logging path stays a
 * single short screen.
 */
export function Collapsible({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
}: {
  title: ReactNode
  summary?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card',
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[0.95rem] font-medium">{title}</span>
          {summary ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {summary}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            'size-5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <div id={id} className="animate-fade-in border-t border-border p-4">
          {children}
        </div>
      ) : null}
    </div>
  )
}

/** Neutral placeholder shown wherever there is nothing to display yet. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-10 text-center',
        className,
      )}
    >
      {Icon ? <Icon className="mb-3 size-7 text-muted-foreground/60" /> : null}
      <p className="text-[0.95rem] font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/** Row of single-choice chips — the fastest control to hit on a phone. */
export function ChipGroup<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T
  onChange: (next: T) => void
  options: readonly { value: T; label: ReactNode }[]
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-10 rounded-xl border px-3.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Multi-select variant of {@link ChipGroup}. */
export function ChipToggles<T extends string>({
  values,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  values: T[]
  onChange: (next: T[]) => void
  options: readonly { id: T; label: ReactNode }[]
  ariaLabel: string
  className?: string
}) {
  const toggle = (id: T) =>
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id])

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((option) => {
        const active = values.includes(option.id)
        return (
          <button
            key={option.id}
            type="button"
            role="checkbox"
            aria-checked={active}
            onClick={() => toggle(option.id)}
            className={cn(
              'min-h-10 rounded-xl border px-3.5 text-sm font-medium transition-colors',
              active
                ? 'border-accent-foreground/30 bg-accent text-accent-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
