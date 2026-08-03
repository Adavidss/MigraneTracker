import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addMonths,
  endOfMonth,
  format,
  isFuture,
  startOfMonth,
  subMonths,
} from 'date-fns'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Settings as SettingsIcon,
  Zap,
} from 'lucide-react'
import {
  dayLogsInRange,
  episodesInRange,
  getOngoingEpisode,
  markHeadacheFree,
  startEpisodeNow,
  unmarkHeadacheFree,
} from '@/lib/db'
import { computeSummary } from '@/lib/stats'
import type { CalendarDayData } from '@/components/month-calendar'
import { CalendarLegend, MonthCalendar } from '@/components/month-calendar'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Card, Stat } from '@/components/ui/card'
import { IntensityLegend } from '@/components/intensity'
import { Link, navigate } from '@/lib/router'
import { dateKey, formatDuration, formatTime, round } from '@/lib/utils'
import { useSettings } from '@/store/useSettings'
import { toast } from '@/store/useToast'
import { EPISODE_TYPE_LABEL, INTENSITY_VAR } from '@/lib/types'

/** Calendar data for one month, keyed by day. */
function useMonthData(month: Date) {
  const from = dateKey(startOfMonth(month))
  const to = dateKey(endOfMonth(month))

  const episodes = useLiveQuery(() => episodesInRange(from, to), [from, to])
  const logs = useLiveQuery(() => dayLogsInRange(from, to), [from, to])

  const days = useMemo(() => {
    const map = new Map<string, CalendarDayData>()
    if (!episodes || !logs) return map

    for (const log of logs) {
      map.set(log.date, {
        date: log.date,
        episodes: 0,
        maxIntensity: null,
        doses: 0,
        headacheFree: true,
        painMap: [],
      })
    }

    for (const episode of episodes) {
      const existing = map.get(episode.date)
      const cell: CalendarDayData =
        existing && !existing.headacheFree
          ? existing
          : {
              date: episode.date,
              episodes: 0,
              maxIntensity: null,
              doses: 0,
              headacheFree: false,
              painMap: [],
            }

      cell.episodes += 1
      cell.doses += episode.medications.length
      // The glyph should show the worst episode of the day.
      if (cell.maxIntensity == null || episode.intensity > cell.maxIntensity) {
        cell.maxIntensity = episode.intensity
        cell.painMap = episode.painMap
      }
      map.set(episode.date, cell)
    }

    return map
  }, [episodes, logs])

  return { days, episodes: episodes ?? [], logs: logs ?? [], from, to }
}

export default function Home() {
  const settings = useSettings()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [starting, setStarting] = useState(false)
  const { days, episodes, logs, from, to } = useMonthData(month)

  const today = dateKey()
  const todayCell = days.get(today)
  const ongoing = useLiveQuery(getOngoingEpisode, [episodes.length])

  const summary = useMemo(
    () => computeSummary({ episodes, dayLogs: logs, from, to }),
    [episodes, logs, from, to],
  )

  const atCurrentMonth = format(month, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  const startNow = async () => {
    setStarting(true)
    try {
      await startEpisodeNow()
      navigate('/attack')
    } catch (error) {
      console.error(error)
      toast.error('Could not start. Nothing was saved.')
    } finally {
      setStarting(false)
    }
  }

  const toggleClearDay = async () => {
    if (todayCell?.headacheFree) {
      await unmarkHeadacheFree(today)
      toast.info('Removed today’s headache-free mark')
      return
    }
    try {
      await markHeadacheFree(today)
      toast.success('Logged a headache-free day')
    } catch {
      toast.error('Today already has a headache logged.')
    }
  }

  return (
    <AppShell
      title="MigraineTracker"
      subtitle={format(new Date(), 'EEEE d MMMM')}
      actions={
        <>
          <Link
            to="/history"
            aria-label="Search history"
            className="flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="size-5" />
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            className="flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SettingsIcon className="size-5" />
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {ongoing ? (
          /* One tap back into attack mode, and nothing to read first. */
          <button
            type="button"
            onClick={() => navigate('/attack')}
            className="flex w-full items-center gap-4 rounded-2xl bg-accent p-5 text-left text-accent-foreground"
          >
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: INTENSITY_VAR[ongoing.intensity] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold">
                {EPISODE_TYPE_LABEL[ongoing.type]} in progress
              </span>
              <span className="mt-0.5 block text-sm opacity-80">
                Since {formatTime(ongoing.startTime, settings.use24HourTime)} · tap
                to update or end it
              </span>
            </span>
            <ChevronRight className="size-6 shrink-0 opacity-70" />
          </button>
        ) : (
          <div className="space-y-2">
            {/* The urgent path: no form, no decisions. It records the headache
                immediately and opens the screen built for using mid-attack. */}
            <Button
              size="lg"
              disabled={starting}
              onClick={startNow}
              className="h-20 w-full text-xl font-semibold"
            >
              <Zap className="size-6" />
              {starting ? 'Starting…' : 'Headache now'}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-14"
                onClick={() => navigate(`/log?date=${today}`)}
              >
                <Plus /> Add details
              </Button>
              <Button
                variant={todayCell?.headacheFree ? 'accent' : 'outline'}
                className="h-14"
                disabled={!!todayCell && todayCell.episodes > 0}
                onClick={toggleClearDay}
              >
                <CheckCircle2 />
                {todayCell?.headacheFree ? 'Clear day ✓' : 'No headache'}
              </Button>
            </div>
          </div>
        )}

        <Card>
          <div className="flex items-center justify-between px-3 py-2.5">
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Previous month"
              onClick={() => setMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft />
            </Button>
            <div className="text-center">
              <div className="text-sm font-semibold">{format(month, 'MMMM yyyy')}</div>
              {!atCurrentMonth ? (
                <button
                  type="button"
                  className="text-xs text-primary"
                  onClick={() => setMonth(startOfMonth(new Date()))}
                >
                  Back to today
                </button>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Next month"
              disabled={isFuture(startOfMonth(addMonths(month, 1)))}
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight />
            </Button>
          </div>

          <div className="px-2.5 pb-3">
            <MonthCalendar
              month={month}
              days={days}
              onSelectDay={(date) => navigate(`/day/${date}`)}
            />
          </div>

          <div className="space-y-2 border-t border-border px-3 py-3">
            <CalendarLegend />
            <IntensityLegend />
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Headaches" value={summary.totalEpisodes} hint="this month" />
          <Stat
            label="Headache days"
            value={summary.headacheDays}
            hint={`${summary.migraineDays} with migraine`}
          />
          <Stat
            label="Average pain"
            value={summary.averageIntensity ?? '—'}
            hint="out of 5"
          />
          <Stat
            label="Average length"
            value={formatDuration(summary.averageDurationMinutes) ?? '—'}
            hint={
              summary.ongoingCount
                ? `${summary.ongoingCount} still open`
                : 'completed episodes'
            }
          />
        </div>

        {summary.totalEpisodes === 0 && summary.headacheFreeDays === 0 ? (
          <p className="pt-2 text-center text-sm text-muted-foreground">
            Nothing logged for {format(month, 'MMMM')} yet.
          </p>
        ) : (
          <p className="pt-1 text-center text-xs text-muted-foreground">
            {summary.headacheFreeDays} day
            {summary.headacheFreeDays === 1 ? '' : 's'} confirmed headache-free ·{' '}
            {round(summary.coverage * 100, 0) ?? 0}% of this month logged
          </p>
        )}
      </div>
    </AppShell>
  )
}
