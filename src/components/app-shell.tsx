import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity,
  CalendarDays,
  ChartColumnIncreasing,
  FileHeart,
  Plus,
  Search,
  Settings as SettingsIcon,
  Waypoints,
} from 'lucide-react'
import { getOngoingEpisode } from '@/lib/db'
import { Link, useRoutePath } from '@/lib/router'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Calendar', icon: CalendarDays },
  { to: '/timeline', label: 'Timeline', icon: Waypoints },
  { to: '/insights', label: 'Insights', icon: ChartColumnIncreasing },
  { to: '/doctor', label: 'Doctor', icon: FileHeart },
] as const

function isActive(path: string, to: string) {
  const base = path.split('?')[0]!
  return to === '/' ? base === '/' : base === to || base.startsWith(`${to}/`)
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
  const path = useRoutePath()

  return (
    <div className="min-h-svh md:flex">
      {!hideNav ? <SideNav path={path} /> : null}

      <div className="flex min-w-0 flex-1 flex-col">
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
      </div>

      {!hideNav ? <BottomNav path={path} /> : null}
    </div>
  )
}

/**
 * While an attack is in progress the main action is not "log something new",
 * it is "get me back to the screen I can use right now".
 */
function useMainAction() {
  const ongoing = useLiveQuery(getOngoingEpisode, [])
  return ongoing
    ? { to: '/attack', label: 'Open attack', icon: Activity }
    : { to: '/log', label: 'Log headache', icon: Plus }
}

/** Persistent rail on tablet and desktop. */
function SideNav({ path }: { path: string }) {
  const action = useMainAction()
  const ActionIcon = action.icon
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

      <Link
        to={action.to}
        className="mb-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <ActionIcon className="size-5" />
        {action.label}
      </Link>

      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          aria-current={isActive(path, to) ? 'page' : undefined}
          className={cn(
            'flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] transition-colors',
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
          to="/history"
          aria-current={isActive(path, '/history') ? 'page' : undefined}
          className={cn(
            'flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] transition-colors',
            isActive(path, '/history')
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Search className="size-5" />
          History
        </Link>
        <Link
          to="/settings"
          aria-current={isActive(path, '/settings') ? 'page' : undefined}
          className={cn(
            'flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] transition-colors',
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
  const action = useMainAction()
  const ActionIcon = action.icon

  return (
    <nav
      data-app-nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-lg md:hidden print:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5 pb-1">
        {left.map((item) => (
          <NavTab key={item.to} {...item} active={isActive(path, item.to)} />
        ))}

        <div className="flex justify-center">
          <Link
            to={action.to}
            aria-label={action.label}
            className="-mt-5 flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95"
          >
            <ActionIcon className="size-8" />
          </Link>
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
        'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[0.65rem] font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <Icon className={cn('size-[1.35rem]', active && 'stroke-[2.4]')} />
      {label}
    </Link>
  )
}
