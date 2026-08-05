import { useState, type ReactNode } from 'react'
import {
  Activity,
  CalendarDays,
  ChartColumnIncreasing,
  FileHeart,
  Plus,
  Search,
  Settings as SettingsIcon,
  Zap,
} from 'lucide-react'
import { startEpisodeNow } from '@/lib/db'
import { useOngoingEpisode } from '@/store/useOngoingEpisode'
import { toast } from '@/store/useToast'
import { Link, navigate } from '@/lib/router'
import { cn } from '@/lib/utils'

/**
 * Four destinations. The calendar and the timeline were separate tabs but are
 * two readings of the same thing — your history over time — so they share one
 * tab and a switch at the top of it.
 */
const NAV = [
  { to: '/', label: 'History', icon: CalendarDays },
  { to: '/insights', label: 'Insights', icon: ChartColumnIncreasing },
  { to: '/doctor', label: 'Doctor', icon: FileHeart },
  { to: '/history', label: 'Search', icon: Search },
] as const

function isActive(path: string, to: string) {
  const base = path.split('?')[0]!
  // The timeline is a view of the calendar screen, so it lights the same tab.
  if (to === '/') return base === '/' || base === '/timeline'
  return base === to || base.startsWith(`${to}/`)
}

/** Screens that take over the whole display carry no tab bar. */
export function showsNav(path: string): boolean {
  const base = path.split('?')[0]!
  if (base === '/attack' || base === '/log') return false
  return !base.startsWith('/log/')
}

/** Mounted once, above the router, so navigating never rebuilds it. */
export function AppNav({ path }: { path: string }) {
  return (
    <>
      <SideNav path={path} />
      <BottomNav path={path} />
    </>
  )
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  hideNav,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  hideNav?: boolean
}) {
  return (
    <>
      <header className="pt-safe sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg print:static print:border-0 print:bg-white">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {title}
              </h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1 print:hidden">
              {actions}
            </div>
          </div>
      </header>

      <main
        className={cn(
          'mx-auto w-full max-w-3xl flex-1 px-4 pt-4',
          // Clear the tab bar and, on an iPhone, the home indicator under it.
          hideNav
            ? 'pb-8'
            : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-10',
        )}
      >
        {children}
      </main>
    </>
  )
}

/**
 * While an attack is in progress the main action is not "log something new",
 * it is "get me back to the screen I can use right now".
 */
function useQuickAction() {
  const ongoing = useOngoingEpisode()
  return ongoing
    ? { label: 'Open the attack in progress', icon: Activity, ongoing: true }
    : { label: 'Log a headache now', icon: Zap, ongoing: false }
}

/**
 * The red button. It writes the entry from the saved defaults and goes straight
 * to attack mode, so starting a log is one tap with nothing to read — and once
 * something is running it becomes the way back to that screen.
 */
function QuickButton({ className }: { className?: string }) {
  const action = useQuickAction()
  const Icon = action.icon
  const [busy, setBusy] = useState(false)

  const press = async () => {
    if (action.ongoing) {
      navigate('/attack')
      return
    }
    setBusy(true)
    try {
      await startEpisodeNow()
      navigate('/attack')
    } catch (error) {
      console.error(error)
      toast.error('Could not start. Nothing was saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={press}
      disabled={busy}
      aria-label={action.label}
      className={cn(
        'flex items-center justify-center rounded-full bg-urgent text-urgent-foreground shadow-lg shadow-urgent/25 transition-transform active:scale-95 disabled:opacity-70',
        className,
      )}
    >
      <Icon className="size-7" />
    </button>
  )
}

/** Persistent rail on tablet and desktop. */
function SideNav({ path }: { path: string }) {
  const quick = useQuickAction()
  return (
    <nav
      data-app-nav
      aria-label="Main"
      className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col gap-1 border-r border-border bg-card/40 p-3 md:flex print:hidden"
    >
      <div className="mb-4 px-2 pt-3">
        <div className="text-base font-semibold tracking-tight">MigraineTracker</div>
        <div className="text-xs text-muted-foreground">Private headache journal</div>
      </div>

      <div className="mb-2 flex gap-2">
        <Link
          to="/log"
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-5" />
          Details
        </Link>
        <QuickButton className="size-12 shrink-0" />
      </div>
      <p className="mb-3 px-1 text-xs text-muted-foreground">
        {quick.ongoing ? 'Red reopens the attack' : 'Red logs one instantly'}
      </p>

      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          aria-current={isActive(path, to) ? 'page' : undefined}
          className={cn(
            'flex h-11 items-center gap-3 rounded-xl px-3 text-base transition-colors',
            isActive(path, to)
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="size-5" />
          {label}
        </Link>
      ))}

      <div className="mt-auto space-y-1">
        <Link
          to="/settings"
          aria-current={isActive(path, '/settings') ? 'page' : undefined}
          className={cn(
            'flex h-11 items-center gap-3 rounded-xl px-3 text-base transition-colors',
            isActive(path, '/settings')
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <SettingsIcon className="size-5" />
          Settings
        </Link>
      </div>
    </nav>
  )
}

/** Tab bar with a raised log button, the primary control on a phone. */
function BottomNav({ path }: { path: string }) {
  const left = NAV.slice(0, 2)
  const right = NAV.slice(2)

  return (
    <nav
      data-app-nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-lg md:hidden print:hidden"
    >
      {/*
       * The centre column sizes to its contents rather than taking a fifth of
       * the bar, so the two raised buttons get the room they need and the four
       * tabs share what is left.
       */}
      <div className="mx-auto grid max-w-md grid-cols-[1fr_1fr_auto_1fr_1fr] items-end gap-x-0.5 px-1.5 pt-2 pb-1.5">
        {left.map((item) => (
          <NavTab key={item.to} {...item} active={isActive(path, item.to)} />
        ))}

        <div className="flex justify-center gap-2 px-1">
          <Link
            to="/log"
            aria-label="Log a headache with details"
            className="-mt-5 flex size-[3.75rem] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95"
          >
            <Plus className="size-7" />
          </Link>
          <QuickButton className="-mt-5 size-[3.75rem]" />
        </div>

        {right.map((item) => (
          <NavTab key={item.to} {...item} active={isActive(path, item.to)} />
        ))}
      </div>
    </nav>
  )
}

function NavTab({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string
  label: string
  icon: typeof CalendarDays
  active: boolean
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-center text-2xs leading-tight font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <Icon className={cn('size-6', active && 'stroke-[2.4]')} />
      {label}
    </Link>
  )
}
