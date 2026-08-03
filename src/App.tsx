import { Suspense, lazy, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { initDb } from '@/lib/db'
import { matchPath, useRoutePath } from '@/lib/router'
import { useSettings } from '@/store/useSettings'
import { Toaster } from '@/components/ui/toaster'
import Home from '@/routes/Home'
import LogEpisode from '@/routes/LogEpisode'
import DayDetail from '@/routes/DayDetail'

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
  useSettings()

  useEffect(() => {
    initDb()
      .catch((error) => {
        console.error('Could not open the local database', error)
      })
      .finally(() => setReady(true))
  }, [])

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
    </>
  )
}
