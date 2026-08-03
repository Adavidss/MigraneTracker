import { addMonths, differenceInCalendarMonths, format, startOfMonth } from 'date-fns'
import type { DayLog, Episode } from '@/lib/types'
import { AURA_LABEL, EPISODE_TYPE_SHORT } from '@/lib/types'
import type { StatsInput } from '@/lib/stats'
import {
  computeMedicationHeadline,
  computeMedicationStats,
  computeMonthly,
  computeSummary,
} from '@/lib/stats'
import { episodeDurationMinutes, hasAura } from '@/lib/episode'
import {
  formatDayShort,
  formatDuration,
  formatTime,
  keyToDate,
  round,
} from '@/lib/utils'
import { Card, Stat } from './ui/card'
import { Section } from './ui/section'
import { CalendarLegend, MonthCalendar } from './month-calendar'
import type { CalendarDayData } from './month-calendar'
import { IntensityLegend } from './intensity'

/**
 * The long form: every calendar, table and episode in the window. Kept apart
 * from the overview so the first thing a doctor sees is the summary, with the
 * underlying record one tap away and on the same printed page.
 */
export function DoctorRecord({
  input,
  episodes,
  dayLogs,
  patientName,
  use24h,
}: {
  input: StatsInput
  episodes: Episode[]
  dayLogs: DayLog[]
  patientName?: string
  use24h: boolean
}) {
  const from = input.from ?? ''
  const to = input.to ?? ''
  const summary = computeSummary(input)
  const medStats = computeMedicationStats(input)
  const medHeadline = computeMedicationHeadline(input, medStats)
  const monthly = computeMonthly(input)

  const inRange = [...episodes]
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const auraTotals = (() => {
    const counts = new Map<string, number>()
    for (const episode of inRange) {
      for (const symptom of episode.auraSymptoms) {
        counts.set(symptom, (counts.get(symptom) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  })()

  const calendarMonths = (() => {
    const start = startOfMonth(keyToDate(from || to))
    const count = differenceInCalendarMonths(keyToDate(to), start) + 1
    return Array.from({ length: Math.max(1, count) }, (_, i) => addMonths(start, i))
  })()

  const dayData = (() => {
    const map = new Map<string, CalendarDayData>()
    for (const log of dayLogs) {
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
      if (cell.maxIntensity == null || episode.intensity > cell.maxIntensity) {
        cell.maxIntensity = episode.intensity
        cell.painMap = episode.painMap
      }
      map.set(episode.date, cell)
    }
    return map
  })()

  return (
        <div className="space-y-6">
      <header className="print-avoid-break">
        <h2 className="text-lg font-semibold">Headache summary</h2>
        <p className="text-sm text-muted-foreground">
          {patientName ? `${patientName} · ` : ''}
          {formatDayShort(from)} to {formatDayShort(to)} · generated{' '}
          {format(new Date(), 'd MMM yyyy')}
        </p>
      </header>

      <Section title="At a glance">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Headaches" value={summary.totalEpisodes} />
          <Stat label="Headache days" value={summary.headacheDays} />
          <Stat label="Migraine days" value={summary.migraineDays} />
          <Stat
            label="Frequency"
            value={
              summary.frequencyPer30Days != null
                ? summary.frequencyPer30Days
                : '—'
            }
            hint="per 30 days"
          />
          <Stat
            label="Average pain"
            value={summary.averageIntensity ?? '—'}
            hint="out of 5"
          />
          <Stat
            label="Average length"
            value={formatDuration(summary.averageDurationMinutes) ?? '—'}
          />
          <Stat
            label="Headache-free"
            value={summary.headacheFreeDays}
            hint="days confirmed"
          />
          <Stat
            label="Longest clear run"
            value={`${summary.longestClearStreak}d`}
          />
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          Self-reported diary covering {summary.daysTracked} days.{' '}
          {summary.daysTracked - summary.unloggedDays} of those days carry a
          record ({round(summary.coverage * 100, 0)}%)
          {summary.unloggedDays
            ? `; the remaining ${summary.unloggedDays} were not logged either way and are counted as headache-free in frequency and streak figures.`
            : '.'}
        </p>
      </Section>

      <Section title="Calendar">
        <div className="grid gap-4 sm:grid-cols-2">
          {calendarMonths.map((month) => (
            <Card key={month.toISOString()} className="p-3">
              <div className="mb-2 text-center text-xs font-semibold">
                {format(month, 'MMMM yyyy')}
              </div>
              <MonthCalendar month={month} days={dayData} compact />
            </Card>
          ))}
        </div>
        <div className="space-y-1.5">
          <CalendarLegend />
          <IntensityLegend />
        </div>
      </Section>

      {monthly.length ? (
        <Section title="Month by month">
          <ReportTable
            headers={[
              'Month',
              'Headaches',
              'Migraines',
              'Headache days',
              'Avg pain',
              'Aura',
              'Doses',
            ]}
            rows={monthly.map((m) => [
              m.label,
              String(m.episodes),
              String(m.migraines),
              String(m.headacheDays),
              m.averageIntensity?.toString() ?? '—',
              String(m.auraEpisodes),
              String(m.doses),
            ])}
          />
        </Section>
      ) : null}

      {medStats.length ? (
        <Section
          title="Medication"
          description={`Most used ${medHeadline.mostUsed?.name ?? '—'} · most effective ${
            medHeadline.mostEffective?.name ?? '—'
          } · average relief ${medHeadline.averageEffectiveness ?? '—'}/5`}
        >
          <ReportTable
            headers={[
              'Medication',
              'Doses',
              'Episodes',
              'Typical dose',
              'Relief',
              'Time to relief',
            ]}
            rows={medStats.map((m) => [
              m.name,
              String(m.doses),
              String(m.episodes),
              m.typicalDose ?? '—',
              m.averageEffectiveness != null
                ? `${m.averageEffectiveness}/5 (${m.ratedDoses} rated)`
                : '—',
              formatDuration(m.averageTimeToReliefMinutes) ?? '—',
            ])}
          />
        </Section>
      ) : null}

      {auraTotals.length ? (
        <Section
          title="Aura"
          description={`${summary.episodesWithAura} of ${summary.totalEpisodes} headaches involved aura`}
        >
          <ReportTable
            headers={['Symptom', 'Times reported']}
            rows={auraTotals.map(([symptom, count]) => [
              AURA_LABEL[symptom as keyof typeof AURA_LABEL] ?? symptom,
              String(count),
            ])}
          />
        </Section>
      ) : null}

      {inRange.length ? (
        <Section title="Episode log" className="print-break-before">
          <ReportTable
            headers={[
              'Date',
              'Start',
              'Length',
              'Type',
              'Pain',
              'Aura',
              'Medication',
            ]}
            rows={inRange.map((episode) => episodeRow(episode, use24h))}
          />
        </Section>
      ) : null}

      <p className="pb-4 text-[0.7rem] leading-relaxed text-muted-foreground">
        All figures come from entries the patient recorded themselves. Pain is
        rated 1 (mild) to 5 (extreme); relief is rated 1 (no relief) to 5
        (complete relief).
      </p>
    </div>
  )
}

function episodeRow(episode: Episode, use24h: boolean): string[] {
  return [
    episode.date,
    formatTime(episode.startTime, use24h),
    formatDuration(episodeDurationMinutes(episode)) ?? 'ongoing',
    EPISODE_TYPE_SHORT[episode.type],
    String(episode.intensity),
    hasAura(episode) ? 'yes' : '—',
    [...new Set(episode.medications.map((d) => d.name))].join(', ') || '—',
  ]
}

/** Plain bordered table — the shape a clinician can scan in seconds. */
function ReportTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    // Dense enough to need sideways scrolling on a phone, so the scrollbar is
    // left visible as the cue that there is more to the right. Prints in full.
    <div className="overflow-x-auto rounded-2xl border border-border print:overflow-visible">
      <table className="w-full min-w-md border-collapse text-left text-xs">
        <thead>
          <tr className="bg-muted/60">
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-2 py-2 font-semibold whitespace-nowrap sm:px-3"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border print-avoid-break">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={
                    j === 0
                      ? 'px-2 py-1.5 whitespace-nowrap tabular-nums sm:px-3'
                      : 'px-2 py-1.5 sm:px-3'
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
