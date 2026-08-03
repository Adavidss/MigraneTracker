import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-[background-color,color,border-color,opacity,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:opacity-90',
        secondary: 'bg-muted text-foreground hover:bg-accent',
        outline:
          'border border-border bg-card text-foreground hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        accent: 'bg-accent text-accent-foreground hover:opacity-90',
        destructive: 'bg-destructive text-white hover:opacity-90',
      },
      size: {
        // 44px minimum keeps every control comfortably tappable on a phone.
        sm: 'h-11 px-3.5 text-sm [&_svg]:size-4',
        md: 'h-11 px-4 text-base [&_svg]:size-[1.1rem]',
        lg: 'h-14 px-6 text-base [&_svg]:size-5',
        icon: 'size-11 [&_svg]:size-5',
        iconSm: 'size-11 [&_svg]:size-[1.1rem]',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children?: ReactNode
}

export function Button({
  className,
  variant,
  size,
  block,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  )
}

export { buttonVariants }
