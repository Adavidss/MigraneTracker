import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, isFuture, startOfDay } from 'date-fns'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  XCircle,
} from 'lucide-react'
import {
  db,
  episodesForDay,
  markHeadacheFree,
  unmarkHeadacheFree,
} from '@/lib/db'
import { dateKey, formatDayLong, keyToDate } from '@/lib/utils'
import { Link, navigate } from '@/lib/router'
import { useSettings } from '@/store/useSettings'
import { toast } from '@/store/useToast'
import { AppShell } from '@/components/app-shell'
import { EpisodeDetail, NoHeadacheCard } from '@/components/episode-card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/section'

export default function DayDetail({ date }: { date: string }) {
  const settings = useSettings()
  const episodes = useLiveQuery(() => episodesForDay(date), [date])
  const dayLog = useLiveQuery(() => db.dayLogs.get(date), [date])

  const previous = dateKey(addDays(keyToDate(date), -1))
  const nextDay = addDays(keyToDate(date), 1)
  const canGoForward = !isFuture(startOfDay(nextDay))

  const loading = episodes === undefined
  const hasEpisodes = !!episodes?.length

  const markClear = async () => {
    try {
      await markHeadacheFree(date)
      toast.success('Logged as headache-free')
    } catch {
      toast.error('This day already has a headache logged.')
    }
  }

  return (
    <AppShell
      title={formatDayLong(date)}
      subtitle={date === dateKey() ? 'Today' : undefined}
      actions={
        <>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label="Previous day"
            onClick={() => navigate(`/day/${previous}`)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label="Next day"
            disabled={!canGoForward}
            onClick={() => navigate(`/day/${dateKey(nextDay)}`)}
          >
            <ChevronRight />
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Link
          to="/"
          className="-ml-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Calendar
        </Link>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : hasEpisodes ? (
          <div className="space-y-4">
            {episodes.map((episode) => (
              <EpisodeDetail
                key={episode.id}
                episode={episode}
                use24h={settings.use24HourTime}
              />
            ))}
          </div>
        ) : dayLog ? (
          <NoHeadacheCard note={dayLog.note} />
        ) : (
          <EmptyState
            title="Nothing logged for this day"
            description="Record a headache, or confirm the day was clear so your statistics stay accurate."
          />
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={() => navigate(`/log?date=${date}`)}>
            <Plus /> {hasEpisodes ? 'Add another headache' : 'Log a headache'}
          </Button>

          {dayLog ? (
            <Button
              size="lg"
              variant="outline"
              onClick={async () => {
                await unmarkHeadacheFree(date)
                toast.info('Removed the headache-free mark')
              }}
            >
              <XCircle /> Undo headache-free
            </Button>
          ) : !hasEpisodes ? (
            <Button size="lg" variant="outline" onClick={markClear}>
              <CheckCircle2 /> Mark headache-free
            </Button>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
