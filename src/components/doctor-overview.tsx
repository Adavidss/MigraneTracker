import { useMemo } from 'react'
import { AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ClinicalProfile, MedicationDayUse, StatsInput } from '@/lib/stats'
import {
  computeAuraCounts,
  computeMedicationStats,
  computeMonthly,
  computeSummary,
  filterToWindow,
} from '@/lib/stats'
import {
  AURA_LABEL,
  EPISODE_TYPE_SHORT,
  HEAD_REGION_LABEL,
  INTENSITY_LABEL,
  MEDICATION_CLASS_LABEL,
  type Episode,
  type HeadRegionId,
} from '@/lib/types'
import { episodeDurationMinutes, hasAura } from '@/lib/episode'
import { cn, formatDayShort, formatDuration, formatTime, round } from '@/lib/utils'
import { Card } from './ui/card'
import {
  AXIS_PROPS,
  ChartLegend,
  ChartTooltip,
  GRID_PROPS,
} from './chart-kit'
import { HeadMapFrequency } from './head-map'
import { IntensityDot } from './intensity'

/**
 * The screen a doctor actually reads. Ordered the way a consultation tends to
 * go — how often, how bad, what has been tried — and written so it can be
 * handed across a desk on a phone without any explaining.
 *
 * Every figure is the patient's own record compared against widely published
 * thresholds. Nothing here is a diagnosis, and the wording keeps saying so.
 */
export function DoctorOverview({
  input,
  profile,
  patientName,
  use24h,
}: {
  input: StatsInput
  profile: ClinicalProfile
  patientName?: string
  use24h: boolean
}) {
  const summary = useMemo(() => computeSummary(input), [input])
  const auraCounts = useMemo(() => computeAuraCounts(input), [input])
  const medStats = useMemo(() => computeMedicationStats(input), [input])

  // `input.episodes` is the whole history; everything shown here has to be the
  // selected window, or region counts end up larger than the attack total.
  const windowed = useMemo(() => filterToWindow(input).episodes, [input])

  const regionCounts = useMemo(() => {
    const counts = new Map<HeadRegionId, number>()
    for (const episode of windowed) {
      // Count each region once per attack, not once per painted level.
      for (const region of new Set(episode.painMap.map((p) => p.region))) {
        counts.set(region, (counts.get(region) ?? 0) + 1)
      }
    }
    return counts
  }, [windowed])

  const topRegions = useMemo(
    () =>
      [...regionCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([region, count]) => ({ region, count })),
    [regionCounts],
  )

  /**
   * Headache days split into migraine and everything else. Days rather than
   * attacks, because days per month is the figure treatment decisions turn on,
   * and a day with both counts once — as a migraine day.
   */
  const monthly = useMemo(() => {
    const base = computeMonthly(input)
    const migraineDays = new Map<string, Set<string>>()
    const allDays = new Map<string, Set<string>>()

    for (const episode of windowed) {
      const month = episode.date.slice(0, 7)
      if (!allDays.has(month)) allDays.set(month, new Set())
      allDays.get(month)!.add(episode.date)

      if (episode.type === 'migraine' || episode.type === 'migraine-aura') {
        if (!migraineDays.has(month)) migraineDays.set(month, new Set())
        migraineDays.get(month)!.add(episode.date)
      }
    }

    return base.map((month) => {
      const migraine = migraineDays.get(month.month)?.size ?? 0
      const total = allDays.get(month.month)?.size ?? 0
      return { ...month, migraineDays: migraine, otherDays: Math.max(0, total - migraine) }
    })
  }, [input, windowed])

  const recent = useMemo(
    () =>
      [...windowed]
        .sort((a, b) => b.startTime.localeCompare(a.startTime))
        .slice(0, 5),
    [windowed],
  )

  const lateralityText = describeLaterality(profile.laterality)

  return (
    <div className="space-y-6">
      <header className="print-avoid-break">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Headache diary summary
        </p>
        <h2 className="mt-0.5 text-lg font-semibold">
          {patientName || 'Patient'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {summary.firstRecord ? formatDayShort(summary.firstRecord) : '—'} to{' '}
          {input.to ? formatDayShort(input.to) : '—'} · {profile.monthsCovered}{' '}
          months · self-reported
        </p>
      </header>

      {/* The number a clinician reads first. */}
      <Card className="print-avoid-break p-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Headache days per month
            </div>
            <div className="text-4xl leading-none font-semibold tracking-tight">
              {profile.headacheDaysPerMonth ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Migraine days
            </div>
            <div className="text-2xl leading-none font-semibold tracking-tight">
              {profile.migraineDaysPerMonth ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Acute medication days
            </div>
            <div className="text-2xl leading-none font-semibold tracking-tight">
              {profile.acuteMedDaysPerMonth ?? '—'}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PatternChip pattern={profile.pattern} />
          {profile.trend && profile.trend.direction !== 'stable' ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                profile.trend.direction === 'worsening'
                  ? 'bg-[color-mix(in_oklab,var(--color-pain-4)_16%,transparent)] text-[var(--color-pain-4)]'
                  : 'bg-clear text-clear-foreground',
              )}
            >
              {profile.trend.direction === 'worsening' ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {profile.trend.direction === 'worsening' ? 'Worsening' : 'Improving'}
            </span>
          ) : null}
        </div>
      </Card>

      {profile.flags.length ? (
        <section className="space-y-2 print-avoid-break">
          <h3 className="text-sm font-semibold tracking-tight">Worth discussing</h3>
          <ul className="space-y-2">
            {profile.flags.map((flag) => (
              <li key={flag.id}>
                <Card
                  className={cn(
                    'flex gap-3 p-3.5',
                    flag.severity === 'high' &&
                      'border-[color-mix(in_oklab,var(--color-pain-4)_40%,transparent)]',
                  )}
                >
                  {flag.severity === 'info' ? (
                    <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0"
                      style={{
                        color:
                          flag.severity === 'high'
                            ? 'var(--color-pain-4)'
                            : 'var(--color-pain-3)',
                      }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-base font-medium">{flag.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {flag.detail}
                    </p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {monthly.length > 1 ? (
        <section className="space-y-2 print-avoid-break">
          <h3 className="text-sm font-semibold tracking-tight">Trend</h3>

          <Card className="p-4">
            <p className="mb-1 text-sm font-medium">Days with a headache</p>
            <ChartLegend
              className="mb-2"
              items={[
                { label: 'Migraine days', color: 'var(--color-series-1)' },
                { label: 'Other headache days', color: 'var(--color-series-2)' },
              ]}
            />
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="label" {...AXIS_PROPS} />
                <YAxis allowDecimals={false} {...AXIS_PROPS} />
                <Tooltip
                  cursor={{ fill: 'var(--color-muted)', opacity: 0.5 }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <ChartTooltip
                        title={label as string}
                        rows={[
                          {
                            label: 'Migraine days',
                            value: payload[0]?.payload?.migraineDays ?? 0,
                            color: 'var(--color-series-1)',
                          },
                          {
                            label: 'Other headache days',
                            value: payload[0]?.payload?.otherDays ?? 0,
                            color: 'var(--color-series-2)',
                          },
                          {
                            label: 'Attacks',
                            value: payload[0]?.payload?.episodes ?? 0,
                          },
                        ]}
                      />
                    ) : null
                  }
                />
                <Bar
                  dataKey="migraineDays"
                  stackId="d"
                  fill="var(--color-series-1)"
                  stroke="var(--color-card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="otherDays"
                  stackId="d"
                  fill="var(--color-series-2)"
                  stroke="var(--color-card)"
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-sm font-medium">Average pain each month</p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={monthly} margin={{ top: 6, right: 8, left: -26, bottom: 0 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="label" {...AXIS_PROPS} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...AXIS_PROPS} />
                <Tooltip
                  cursor={{ stroke: 'var(--color-border)' }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <ChartTooltip
                        title={label as string}
                        rows={[
                          {
                            label: 'Average pain',
                            value: payload[0]?.value ?? '—',
                            color: 'var(--color-series-1)',
                          },
                        ]}
                      />
                    ) : null
                  }
                />
                <Line
                  type="monotone"
                  dataKey="averageIntensity"
                  stroke="var(--color-series-1)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: 'var(--color-series-1)' }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </section>
      ) : null}

      <section className="space-y-2 print-avoid-break">
        <h3 className="text-sm font-semibold tracking-tight">Attack profile</h3>
        <Card className="divide-y divide-border">
          <Row
            label="Typical severity"
            value={
              profile.typicalSeverity ? (
                <span className="inline-flex items-center gap-1.5">
                  <IntensityDot intensity={profile.typicalSeverity} size={8} />
                  {profile.typicalSeverity} — {INTENSITY_LABEL[profile.typicalSeverity]}
                </span>
              ) : (
                '—'
              )
            }
          />
          <Row
            label="Usual length"
            value={
              profile.duration
                ? `${profile.duration.median} h (range ${profile.duration.shortest}–${profile.duration.longest} h)`
                : '—'
            }
          />
          <Row
            label="Aura"
            value={
              profile.auraShare != null
                ? `${Math.round(profile.auraShare * 100)}% of attacks`
                : 'None recorded'
            }
          />
          <Row label="Side" value={lateralityText} />
          <Row
            label="Attacks recorded"
            value={`${summary.totalEpisodes} over ${summary.daysTracked} days`}
          />
        </Card>
      </section>

      {regionCounts.size ? (
        <section className="space-y-2 print-avoid-break">
          <h3 className="text-sm font-semibold tracking-tight">Where it hurts</h3>
          <Card className="p-4">
            <div className="mx-auto max-w-64">
              <HeadMapFrequency
                counts={regionCounts}
                totalEpisodes={summary.totalEpisodes}
              />
            </div>
            {topRegions.length ? (
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                {topRegions.map(({ region, count }) => (
                  <li key={region} className="flex justify-between gap-3">
                    <span>{HEAD_REGION_LABEL[region]}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {count} of {summary.totalEpisodes}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </section>
      ) : null}

      {auraCounts.length ? (
        <section className="space-y-2 print-avoid-break">
          <h3 className="text-sm font-semibold tracking-tight">Aura symptoms</h3>
          <Card className="divide-y divide-border">
            {auraCounts.map((entry) => (
              <Row
                key={entry.symptom}
                label={AURA_LABEL[entry.symptom]}
                value={`${entry.count} attack${entry.count === 1 ? '' : 's'}`}
              />
            ))}
          </Card>
        </section>
      ) : null}

      {profile.medicationUse.length ? (
        <section className="space-y-2 print-avoid-break">
          <h3 className="text-sm font-semibold tracking-tight">
            Acute medication use
          </h3>
          <Card className="space-y-3 p-4">
            {profile.medicationUse.map((med) => (
              <MedicationBar key={med.name} med={med} />
            ))}
            <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              Counted in days, not doses. The marker shows the monthly frequency
              at which published guidance says frequent use of that class can
              start to sustain headaches on its own.
            </p>
          </Card>
        </section>
      ) : null}

      {medStats.some((m) => m.averageEffectiveness != null) ? (
        <section className="space-y-2 print-avoid-break">
          <h3 className="text-sm font-semibold tracking-tight">What has helped</h3>
          <Card className="divide-y divide-border">
            {medStats
              .filter((m) => m.averageEffectiveness != null)
              .sort(
                (a, b) =>
                  (b.averageEffectiveness ?? 0) - (a.averageEffectiveness ?? 0),
              )
              .map((med) => (
                <Row
                  key={med.name}
                  label={med.name}
                  value={
                    <span className="text-right">
                      {med.averageEffectiveness}/5 relief
                      <span className="block text-xs text-muted-foreground">
                        {med.ratedDoses} rated
                        {med.averageTimeToReliefMinutes != null
                          ? ` · ${formatDuration(med.averageTimeToReliefMinutes)} to relief`
                          : ''}
                      </span>
                    </span>
                  }
                />
              ))}
          </Card>
        </section>
      ) : null}

      {recent.length ? (
        <section className="space-y-2 print-avoid-break">
          <h3 className="text-sm font-semibold tracking-tight">Most recent attacks</h3>
          <Card className="divide-y divide-border">
            {recent.map((episode) => (
              <RecentRow key={episode.id} episode={episode} use24h={use24h} />
            ))}
          </Card>
        </section>
      ) : null}

      <section className="space-y-2 print-avoid-break">
        <h3 className="text-sm font-semibold tracking-tight">About this record</h3>
        <Card className="space-y-2 p-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Kept by the patient in a headache diary app. Pain is self-rated 1
            (mild) to 5 (extreme); relief is self-rated 1 (no relief) to 5
            (complete relief).
          </p>
          <p>
            {summary.daysTracked - summary.unloggedDays} of {summary.daysTracked}{' '}
            days carry an entry ({round(summary.coverage * 100, 0)}%), including{' '}
            {summary.headacheFreeDays} days recorded as headache-free. Days with
            no entry are treated as headache-free, so the frequency figures are
            a floor rather than an estimate.
          </p>
          <p>
            Thresholds quoted here are general published figures shown for
            context. They are not a diagnosis and do not account for anything
            outside this diary.
          </p>
        </Card>
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="shrink-0 text-right text-sm font-medium">{value}</span>
    </div>
  )
}

function PatternChip({ pattern }: { pattern: ClinicalProfile['pattern'] }) {
  const map = {
    chronic: {
      label: 'Chronic pattern (15+ days/month)',
      className:
        'bg-[color-mix(in_oklab,var(--color-pain-4)_16%,transparent)] text-[var(--color-pain-4)]',
    },
    episodic: {
      label: 'Episodic pattern (under 15 days/month)',
      className: 'bg-accent text-accent-foreground',
    },
    'insufficient-data': {
      label: 'Not enough history to characterise yet',
      className: 'bg-muted text-muted-foreground',
    },
  } as const

  const entry = map[pattern]
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
        entry.className,
      )}
    >
      {entry.label}
    </span>
  )
}

/** Monthly days of use drawn against the threshold for that drug class. */
function MedicationBar({ med }: { med: MedicationDayUse }) {
  const threshold = med.thresholdPerMonth
  // Scale so the threshold always sits at 75% of the track.
  const scaleMax = threshold ? threshold / 0.75 : Math.max(med.daysPerMonth, 1)
  const width = Math.min(100, (med.daysPerMonth / scaleMax) * 100)
  const markerAt = threshold ? 75 : null

  const tone = med.atOrOverThreshold
    ? 'var(--color-pain-4)'
    : med.approachingThreshold
      ? 'var(--color-pain-3)'
      : 'var(--color-series-1)'

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium">
          {med.name}{' '}
          <span className="text-xs font-normal text-muted-foreground">
            {MEDICATION_CLASS_LABEL[med.medClass].toLowerCase()}
          </span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {med.daysPerMonth} {med.daysPerMonth === 1 ? 'day' : 'days'}/mo
          {threshold ? ` · limit ${threshold}` : ''}
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(2, width)}%`, backgroundColor: tone }}
        />
        {markerAt != null ? (
          <span
            className="absolute inset-y-0 w-0.5 bg-foreground/45"
            style={{ left: `${markerAt}%` }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  )
}

function RecentRow({ episode, use24h }: { episode: Episode; use24h: boolean }) {
  const duration = formatDuration(episodeDurationMinutes(episode))
  const meds = [...new Set(episode.medications.map((d) => d.name))].join(', ')

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{formatDayShort(episode.date)}</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm">
          <IntensityDot intensity={episode.intensity} size={7} />
          {episode.intensity}/5
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {EPISODE_TYPE_SHORT[episode.type]} · {formatTime(episode.startTime, use24h)}
        {duration ? ` · ${duration}` : ' · ongoing'}
        {hasAura(episode) ? ' · aura' : ''}
        {meds ? ` · ${meds}` : ' · untreated'}
      </p>
    </div>
  )
}

function describeLaterality(l: ClinicalProfile['laterality']): string {
  const total = l.left + l.right + l.bilateral
  if (!total) return 'Not recorded'
  const parts: string[] = []
  if (l.left) parts.push(`${l.left} left`)
  if (l.right) parts.push(`${l.right} right`)
  if (l.bilateral) parts.push(`${l.bilateral} both sides`)

  const lead =
    l.dominant === 'left'
      ? 'Predominantly left-sided'
      : l.dominant === 'right'
        ? 'Predominantly right-sided'
        : 'Varies'

  return `${lead} — ${parts.join(', ')}`
}
