import { CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { useToast } from '@/store/useToast'
import { cn } from '@/lib/utils'

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: TriangleAlert,
} as const

export function Toaster() {
  const toasts = useToast((s) => s.toasts)
  const dismiss = useToast((s) => s.dismiss)

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 print:hidden"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone]
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={cn(
              'pointer-events-auto flex max-w-sm animate-fade-in items-center gap-2.5 rounded-full border border-border py-2.5 pr-4 pl-3 text-sm shadow-lg backdrop-blur',
              t.tone === 'error'
                ? 'bg-destructive text-white'
                : 'bg-card/95 text-card-foreground',
            )}
          >
            <Icon
              className={cn(
                'size-4 shrink-0',
                t.tone === 'success' && 'text-[var(--color-pain-1)]',
                t.tone === 'info' && 'text-primary',
              )}
            />
            <span className="text-left leading-snug">{t.message}</span>
          </button>
        )
      })}
    </div>
  )
}
