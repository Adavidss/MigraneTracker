import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './button'
import { cn } from '@/lib/utils'

/**
 * Built on the native `<dialog>` element, which brings focus trapping, escape
 * handling and inertness for free — all the parts a hand-rolled modal usually
 * gets wrong.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // Clicks land on the dialog itself only when they hit the backdrop.
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        'w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm',
        'm-auto open:animate-fade-in',
        className,
      )}
    >
      <div className="p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? (
          <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </div>
        ) : null}
        {children}
      </div>
    </dialog>
  )
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  destructive?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" block onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'primary'}
          block
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
