import { useId } from 'react'
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

const controlBase =
  'w-full rounded-xl border border-input bg-card px-3 text-[0.95rem] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-ring focus:outline-none disabled:opacity-50'

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'block text-xs font-semibold tracking-wide text-muted-foreground uppercase',
        className,
      )}
      {...props}
    />
  )
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, 'h-11', className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(controlBase, 'min-h-20 resize-y py-2.5 leading-relaxed', className)}
      {...props}
    />
  )
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      // Native select keeps the platform picker on mobile, which is faster to
      // use than any custom dropdown.
      className={cn(controlBase, 'h-11 appearance-none pr-8', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%239a95ab' stroke-width='1.6' stroke-linecap='round'><path d='M4 6.5 8 10.5 12 6.5'/></svg>\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.6rem center',
        backgroundSize: '1rem',
      }}
      {...props}
    />
  )
}

/** Label + control + optional hint, wired together with a generated id. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: ReactNode
  children: (id: string) => ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint ? (
        <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-2 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[0.95rem] font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-[left]',
            checked ? 'left-[1.375rem]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  )
}

/** Horizontal segmented control used for tabs and small enum pickers. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T
  onChange: (next: T) => void
  options: readonly { value: T; label: ReactNode }[]
  className?: string
  ariaLabel?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-muted p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-9 flex-1 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
