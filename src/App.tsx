import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getOngoingEpisode, initDb } from '@/lib/db'
import { matchPath, navigate, useRoutePath } from '@/lib/router'
import { useSettings } from '@/store/useSettings'
import { Toaster } from '@/components/ui/toaster'
import { DimIndicator, DimOverlay, useComfort } from '@/components/comfort'
import { AppNav, showsNav } from '@/components/app-shell'
import Home from '@/routes/Home'
import LogEpisode from '@/routes/LogEpisode'
import DayDetail from '@/routes/DayDetail'
import Attack from '@/routes/Attack'
import History from '@/routes/History'
import Settings from '@/routes/Settings'

/**
 * Only the two screens that pull in the charting library are split out. Keeping
 * the rest in the main bundle costs little and means most navigation never
 * suspends at all.
 */
const Insights = lazy(() => import('@/routes/Insights'))
const Doctor = lazy(() => import('@/routes/Doctor'))

/**
 * Warm the split chunks once the app is idle, so the first visit to Insights or
 * the doctor summary is instant rather than a wait on a 110 kB download.
 */
function prefetchRoutes() {
  const warm = () => {
    void import('@/routes/Insights')
    void import('@/routes/Doctor')
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, { timeout: 3000 })
  } else {
    setTimeout(warm, 1200)
  }
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

/**
 * Shown only if a split chunk is somehow not warm yet. It holds the page's
 * shape rather than blanking to a spinner, so nothing jumps when it resolves.
 */
function PageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-3xl animate-pulse space-y-3 px-4 pt-4"
      aria-hidden
    >
      <div className="h-11 rounded-xl bg-muted" />
      <div className="h-28 rounded-2xl bg-muted" />
      <div className="h-44 rounded-2xl bg-muted" />
      <div className="h-32 rounded-2xl bg-muted" />
    </div>
  )
}

function Router() {
  const path = useRoutePath()

  const editMatch = matchPath('/log/:id', path)
  if (editMatch) return <LogEpisode episodeId={editMatch.id!} />

  const dayMatch = matchPath('/day/:date', path)
  if (dayMatch) return <DayDetail date={dayMatch.date!} />

  const base = path.split('?')[0]
  switch (base) {
    case '/attack':
      return <Attack />
    case '/log':
      return <LogEpisode />
    // The timeline is a view of the calendar screen rather than its own tab.
    case '/timeline':
      return <Home view="timeline" />
    case '/insights':
      return <Insights />
    case '/history':
      return <History />
    // `/report` was the original path; keep it working for an installed PWA.
    case '/doctor':
    case '/report':
      return <Doctor />
    case '/settings':
      return <Settings />
    case '/':
      return <Home />
    default:
      return <Home />
  }
}

export default function App() {
  const [ready, setReady] = useState(false)
  // Reads settings and keeps the theme class on <html> in sync.
  const settings = useSettings()
  useComfort(settings)

  useEffect(() => {
    initDb()
      .catch((error) => {
        console.error('Could not open the local database', error)
      })
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (ready) prefetchRoutes()
  }, [ready])

  /**
   * Someone opening the app during an attack wants the screen built for that,
   * not the calendar. Only on the first load, and only from the home route, so
   * navigating to the calendar afterwards is never fought.
   */
  const redirected = useRef(false)
  useEffect(() => {
    if (!ready || redirected.current) return
    redirected.current = true
    if (window.location.hash.replace(/^#/, '') !== '') return

    getOngoingEpisode()
      .then((episode) => {
        if (episode) navigate('/attack', { replace: true })
      })
      .catch(() => {
        /* Falling through to the calendar is a fine outcome. */
      })
  }, [ready])

  // Deep links land mid-page otherwise.
  const path = useRoutePath()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [path])

  if (!ready) return <FullScreenLoader />

  const withNav = showsNav(path)

  return (
    <>
      <div className={withNav ? 'min-h-svh md:flex' : undefined}>
        {/*
         * The navigation lives here, above the router, so it is mounted once
         * for the life of the app. Rendering it inside each screen meant every
         * tap tore the tab bar down and rebuilt it, which is what made
         * navigation flash.
         */}
        {withNav ? <AppNav path={path} /> : null}

        <div className={withNav ? 'flex min-w-0 flex-1 flex-col' : undefined}>
          <Suspense fallback={<PageSkeleton />}>
            <Router />
          </Suspense>
        </div>
      </div>

      <Toaster />
      <DimOverlay level={settings.dimLevel} />
      {/* Attack mode carries the full comfort controls already. */}
      {path.split('?')[0] !== '/attack' ? (
        <DimIndicator level={settings.dimLevel} />
      ) : null}
    </>
  )
}
