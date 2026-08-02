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
  Square,
} from 'lucide-react'
import {
  dayLogsInRange,
  episodesInRange,
  getOngoingEpisode,
  markHeadacheFree,
  saveEpisode,
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
import { EPISODE_TYPE_LABEL } from '@/lib/types'

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
  const { days, episodes, logs, from, to } = useMonthData(month)

  const today = dateKey()
  const todayCell = days.get(today)
  const ongoing = useLiveQuery(getOngoingEpisode, [episodes.length])

  const summary = useMemo(
    () => computeSummary({ episodes, dayLogs: logs, from, to }),
    [episodes, logs, from, to],
  )

  const atCurrentMonth = format(month, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  const endNow = async () => {
    if (!ongoing) return
    await saveEpisode({ ...ongoing, endTime: new Date().toISOString() })
    toast.success('Marked as ended')
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
            className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="size-5" />
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SettingsIcon className="size-5" />
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {ongoing ? (
          <Card className="border-primary/40 bg-accent/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-accent-foreground">
                  {EPISODE_TYPE_LABEL[ongoing.type]} in progress
                </p>
                <p className="mt-0.5 text-xs text-accent-foreground/80">
                  Started {formatTime(ongoing.startTime, settings.use24HourTime)} ·
                  level {ongoing.intensity}
                </p>
              </div>
              <Button size="sm" onClick={endNow}>
                <Square /> End now
              </Button>
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            onClick={() => navigate(`/log?date=${today}`)}
            className="h-16"
          >
            <Plus /> Log headache
          </Button>
          <Button
            size="lg"
            variant={todayCell?.headacheFree ? 'accent' : 'outline'}
            className="h-16"
            disabled={!!todayCell && todayCell.episodes > 0}
            onClick={toggleClearDay}
          >
            <CheckCircle2 />
            {todayCell?.headacheFree ? 'Clear day ✓' : 'No headache'}
          </Button>
        </div>

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
                  className="text-[0.7rem] text-primary"
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
