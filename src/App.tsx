import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getOngoingEpisode, initDb } from '@/lib/db'
import { matchPath, navigate, useRoutePath } from '@/lib/router'
import { useSettings } from '@/store/useSettings'
import { Toaster } from '@/components/ui/toaster'
import { DimIndicator, DimOverlay, useComfort } from '@/components/comfort'
import Home from '@/routes/Home'
import LogEpisode from '@/routes/LogEpisode'
import DayDetail from '@/routes/DayDetail'
import Attack from '@/routes/Attack'

// Charting and PDF generation are only needed on a few screens, so they load
// on demand rather than blocking the first paint.
const Timeline = lazy(() => import('@/routes/Timeline'))
const Insights = lazy(() => import('@/routes/Insights'))
const History = lazy(() => import('@/routes/History'))
const Doctor = lazy(() => import('@/routes/Doctor'))
const Settings = lazy(() => import('@/routes/Settings'))

function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <span className="sr-only">Loading</span>
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
    case '/timeline':
      return <Timeline />
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

  if (!ready) return <Loading />

  return (
    <>
      <Suspense fallback={<Loading />}>
        <Router />
      </Suspense>
      <Toaster />
      <DimOverlay level={settings.dimLevel} />
      {/* Attack mode carries the full comfort controls already. */}
      {path.split('?')[0] !== '/attack' ? (
        <DimIndicator level={settings.dimLevel} />
      ) : null}
    </>
  )
}
