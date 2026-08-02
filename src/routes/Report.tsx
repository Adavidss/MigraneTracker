import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addMonths,
  differenceInCalendarMonths,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { FileDown, Image, Printer, Sheet } from 'lucide-react'
import { allDayLogs, allEpisodes } from '@/lib/db'
import {
  computeMedicationHeadline,
  computeMedicationStats,
  computeMonthly,
  computeSummary,
} from '@/lib/stats'
import { daysCsv, dosesCsv, downloadCsv, episodesCsv } from '@/lib/export'
import { episodeDurationMinutes, hasAura } from '@/lib/episode'
import {
  AURA_LABEL,
  EPISODE_TYPE_SHORT,
  type Episode,
} from '@/lib/types'
import {
  dateKey,
  downloadBlob,
  formatDayShort,
  formatDuration,
  formatTime,
  keyToDate,
  round,
} from '@/lib/utils'
import { useSettings } from '@/store/useSettings'
import { toast } from '@/store/useToast'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Card, Stat } from '@/components/ui/card'
import { EmptyState, Section } from '@/components/ui/section'
import { Segmented } from '@/components/ui/field'
import { CalendarLegend, MonthCalendar } from '@/components/month-calendar'
import type { CalendarDayData } from '@/components/month-calendar'
import { IntensityLegend } from '@/components/intensity'

type Range = '1m' | '3m' | '6m' | '12m'

const RANGES: { value: Range; label: string; months: number }[] = [
  { value: '1m', label: '1 month', months: 1 },
  { value: '3m', label: '3 months', months: 3 },
  { value: '6m', label: '6 months', months: 6 },
  { value: '12m', label: '12 months', months: 12 },
]

export default function Report() {
  const settings = useSettings()
  const [range, setRange] = useState<Range>('3m')
  const [busy, setBusy] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  const episodes = useLiveQuery(allEpisodes, [])
  const dayLogs = useLiveQuery(allDayLogs, [])

  const months = RANGES.find((r) => r.value === range)!.months
  const from = dateKey(startOfMonth(subMonths(new Date(), months - 1)))
  const to = dateKey()

  const input = useMemo(
    () => ({ episodes: episodes ?? [], dayLogs: dayLogs ?? [], from, to }),
    [episodes, dayLogs, from, to],
  )

  const summary = useMemo(() => computeSummary(input), [input])
  const medStats = useMemo(() => computeMedicationStats(input), [input])
  const medHeadline = useMemo(
    () => computeMedicationHeadline(input, medStats),
    [input, medStats],
  )
  const monthly = useMemo(() => computeMonthly(input), [input])

  const inRange = useMemo(
    () =>
      (episodes ?? [])
        .filter((e) => e.date >= from && e.date <= to)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [episodes, from, to],
  )

  const auraTotals = useMemo(() => {
    const counts = new Map<string, number>()
    for (const episode of inRange) {
      for (const symptom of episode.auraSymptoms) {
        counts.set(symptom, (counts.get(symptom) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [inRange])

  const calendarMonths = useMemo(() => {
    const start = startOfMonth(keyToDate(from))
    const count = differenceInCalendarMonths(new Date(), start) + 1
    return Array.from({ length: Math.max(1, count) }, (_, i) => addMonths(start, i))
  }, [from])

  const dayData = useMemo(() => {
    const map = new Map<string, CalendarDayData>()
    for (const log of dayLogs ?? []) {
      map.set(log.date, {
        date: log.date,
        episodes: 0,
        maxIntensity: null,
        doses: 0,
        headacheFree: true,
        painMap: [],
      })
    }
    for (const episode of episodes ?? []) {
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
  }, [episodes, dayLogs])

  const savePng = async () => {
    if (!sheetRef.current) return
    setBusy(true)
    try {
      // Loaded on demand — it is only needed for this one button.
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(sheetRef.current, {
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
      })
      const blob = await (await fetch(dataUrl)).blob()
      downloadBlob(blob, `headache-summary-${from}-to-${to}.png`)
      toast.success('Image saved')
    } catch (error) {
      console.error(error)
      toast.error('Could not create the image.')
    } finally {
      setBusy(false)
    }
  }

  const savePdf = async () => {
    setBusy(true)
    try {
      // jsPDF is a large dependency; fetch it only when a PDF is asked for.
      const { downloadSummaryPdf } = await import('@/lib/pdf')
      downloadSummaryPdf(input, {
        patientName: settings.patientName,
        from,
        to,
        use24h: settings.use24HourTime,
      })
      toast.success('PDF saved')
    } catch (error) {
      console.error(error)
      toast.error('Could not create the PDF.')
    } finally {
      setBusy(false)
    }
  }

  if (episodes === undefined || dayLogs === undefined) {
    return (
      <AppShell title="Doctor visit">
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    )
  }

  if (!episodes.length && !dayLogs.length) {
    return (
      <AppShell title="Doctor visit">
        <EmptyState
          title="Nothing to report yet"
          description="Once you have logged some headaches, this page becomes a summary you can hand to your doctor."
        />
      </AppShell>
    )
  }

  return (
    <AppShell
      title="Doctor visit"
      subtitle="A summary to bring to your appointment"
      actions={
        <Button size="sm" onClick={() => window.print()}>
          <Printer /> Print
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="space-y-3 print:hidden">
          <Segmented
            ariaLabel="Report range"
            value={range}
            onChange={setRange}
            options={RANGES.map(({ value, label }) => ({ value, label }))}
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="outline" disabled={busy} onClick={savePdf}>
              <FileDown /> PDF
            </Button>
            <Button variant="outline" disabled={busy} onClick={savePng}>
              <Image /> {busy ? 'Saving…' : 'Image'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadCsv(
                  episodesCsv(inRange, settings.use24HourTime),
                  `headaches-${from}-to-${to}.csv`,
                )
                toast.success('Episode CSV saved')
              }}
            >
              <Sheet /> Episodes
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadCsv(
                  dosesCsv(inRange, settings.use24HourTime),
                  `medication-${from}-to-${to}.csv`,
                )
                toast.success('Medication CSV saved')
              }}
            >
              <Sheet /> Doses
            </Button>
          </div>

          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              const logs = (dayLogs ?? []).filter(
                (d) => d.date >= from && d.date <= to,
              )
              downloadCsv(daysCsv(logs), `headache-free-days-${from}-to-${to}.csv`)
              toast.success('Headache-free days CSV saved')
            }}
          >
            Also export headache-free days as CSV
          </button>
        </div>

        {/* Everything below is what prints and what the image capture sees. */}
        <div ref={sheetRef} className="space-y-6 bg-background">
          <header className="print-avoid-break">
            <h2 className="text-lg font-semibold">Headache summary</h2>
            <p className="text-sm text-muted-foreground">
              {settings.patientName ? `${settings.patientName} · ` : ''}
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
                rows={inRange.map((episode) => episodeRow(episode, settings.use24HourTime))}
              />
            </Section>
          ) : null}

          <p className="pb-4 text-[0.7rem] leading-relaxed text-muted-foreground">
            All figures come from entries the patient recorded themselves. Pain is
            rated 1 (mild) to 5 (extreme); relief is rated 1 (no relief) to 5
            (complete relief).
          </p>
        </div>
      </div>
    </AppShell>
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
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-md border-collapse text-left text-xs">
        <thead>
          <tr className="bg-muted/60">
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-3 py-2 font-semibold whitespace-nowrap"
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
                      ? 'px-3 py-1.5 whitespace-nowrap tabular-nums'
                      : 'px-3 py-1.5'
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
