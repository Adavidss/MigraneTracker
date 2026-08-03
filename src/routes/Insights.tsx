import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { subMonths, subYears } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { allDayLogs, allEpisodes } from '@/lib/db'
import {
  computeAuraCounts,
  computeDayCells,
  computeIntensityDistribution,
  computeMedicationHeadline,
  computeMedicationStats,
  computeMonthly,
  computeRegionFrequency,
  computeSummary,
} from '@/lib/stats'
import {
  AURA_LABEL,
  HEAD_REGION_LABEL,
  INTENSITY_LABEL,
  INTENSITY_VAR,
  type AuraSymptom,
  type HeadRegionId,
  type Intensity,
} from '@/lib/types'
import { dateKey, formatDuration, round } from '@/lib/utils'
import { navigate } from '@/lib/router'
import { AppShell } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle, Stat } from '@/components/ui/card'
import { EmptyState, Section } from '@/components/ui/section'
import { Segmented } from '@/components/ui/field'
import {
  AXIS_PROPS,
  ChartLegend,
  ChartTooltip,
  GRID_PROPS,
  RankedBars,
} from '@/components/chart-kit'
import {
  Heatmap,
  HeatmapLegend,
  HEATMAP_METRICS,
  type HeatmapMetric,
} from '@/components/heatmap'

type Range = '3m' | '6m' | '12m' | 'all'

const RANGES: { value: Range; label: string }[] = [
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '12m', label: '12 months' },
  { value: 'all', label: 'All time' },
]

function rangeStart(range: Range, earliest: string | null): string {
  const now = new Date()
  switch (range) {
    case '3m':
      return dateKey(subMonths(now, 3))
    case '6m':
      return dateKey(subMonths(now, 6))
    case '12m':
      return dateKey(subYears(now, 1))
    case 'all':
      return earliest ?? dateKey(subYears(now, 1))
  }
}

export default function Insights() {
  const [range, setRange] = useState<Range>('6m')
  const [metric, setMetric] = useState<HeatmapMetric>('episodes')

  const episodes = useLiveQuery(allEpisodes, [])
  const dayLogs = useLiveQuery(allDayLogs, [])

  const loading = episodes === undefined || dayLogs === undefined

  const earliest = useMemo(() => {
    const dates = [
      ...(episodes ?? []).map((e) => e.date),
      ...(dayLogs ?? []).map((d) => d.date),
    ].sort()
    return dates[0] ?? null
  }, [episodes, dayLogs])

  const from = rangeStart(range, earliest)
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
  const distribution = useMemo(() => computeIntensityDistribution(input), [input])
  const auraCounts = useMemo(() => computeAuraCounts(input), [input])
  const regions = useMemo(() => computeRegionFrequency(input), [input])
  const dayCells = useMemo(() => computeDayCells(input), [input])

  const monthlyChartData = useMemo(
    () => monthly.map((m) => ({ ...m, other: m.episodes - m.migraines })),
    [monthly],
  )
  const distributionChartData = useMemo(
    () =>
      distribution.map((d) => ({
        ...d,
        label: `${d.intensity} ${INTENSITY_LABEL[d.intensity]}`,
      })),
    [distribution],
  )

  const heatmapFrom = useMemo(
    () => (range === 'all' ? (earliest ?? dateKey(subYears(new Date(), 1))) : from),
    [range, earliest, from],
  )

  if (loading) {
    return (
      <AppShell title="Insights">
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    )
  }

  if (!episodes.length && !dayLogs.length) {
    return (
      <AppShell title="Insights">
        <EmptyState
          title="No data yet"
          description="Log a few headaches and headache-free days, and your patterns will show up here."
        />
      </AppShell>
    )
  }

  const hasMonthly = monthly.length > 0

  return (
    <AppShell title="Insights" subtitle="Patterns across your history">
      <div className="space-y-6">
        <Segmented
          ariaLabel="Time range"
          value={range}
          onChange={setRange}
          options={RANGES}
        />

        <Section
          title="Summary"
          description={
            summary.daysTracked
              ? `${summary.daysTracked} days in range · ${round(summary.coverage * 100, 0)}% logged`
              : undefined
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Headaches" value={summary.totalEpisodes} />
            <Stat
              label="Headache days"
              value={summary.headacheDays}
              hint={`${summary.migraineDays} migraine days`}
            />
            <Stat
              label="Headache-free"
              value={summary.headacheFreeDays}
              hint="days confirmed clear"
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
            <Stat
              label="Longest clear run"
              value={`${summary.longestClearStreak}d`}
              hint={`now ${summary.currentClearStreak}d`}
            />
          </div>
          {summary.unloggedDays > 0 ? (
            <p className="text-xs leading-snug text-muted-foreground">
              {summary.unloggedDays} day{summary.unloggedDays === 1 ? '' : 's'} in
              this range have no record at all. Streaks and frequency treat those as
              headache-free, so logging clear days makes these figures firmer.
            </p>
          ) : null}
        </Section>

        <Section title="Year at a glance">
          <Card>
            {/* Stacked: three metric labels plus a title do not fit across a
                phone once the type is at a readable size. */}
            <CardHeader className="flex-col items-stretch gap-2">
              <CardTitle>Every day in range</CardTitle>
              <Segmented
                ariaLabel="Heatmap metric"
                value={metric}
                onChange={setMetric}
                options={HEATMAP_METRICS}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <Heatmap
                from={heatmapFrom}
                to={to}
                cells={dayCells}
                metric={metric}
                onSelectDay={(date) => navigate(`/day/${date}`)}
              />
              <HeatmapLegend metric={metric} />
            </CardContent>
          </Card>
        </Section>

        {hasMonthly ? (
          <Section title="Trends by month">
            <Card>
              <CardHeader>
                <CardTitle>Headaches each month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ChartLegend
                  items={[
                    { label: 'Migraine', color: 'var(--color-series-1)' },
                    { label: 'Other headache', color: 'var(--color-series-2)' },
                  ]}
                />
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart
                    data={monthlyChartData}
                    margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
                  >
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
                                label: 'Migraine',
                                value: payload[0]?.payload?.migraines ?? 0,
                                color: 'var(--color-series-1)',
                              },
                              {
                                label: 'Other headache',
                                value: payload[0]?.payload?.other ?? 0,
                                color: 'var(--color-series-2)',
                              },
                              {
                                label: 'Headache days',
                                value: payload[0]?.payload?.headacheDays ?? 0,
                              },
                            ]}
                          />
                        ) : null
                      }
                    />
                    <Bar
                      dataKey="migraines"
                      stackId="a"
                      fill="var(--color-series-1)"
                      // A hairline in the surface colour separates the segments.
                      stroke="var(--color-card)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="other"
                      stackId="a"
                      fill="var(--color-series-2)"
                      stroke="var(--color-card)"
                      strokeWidth={2}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average pain each month</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart
                    data={monthly}
                    margin={{ top: 6, right: 8, left: -26, bottom: 0 }}
                  >
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
                      activeDot={{ r: 5 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Section>
        ) : null}

        <Section title="How bad they get">
          <Card>
            <CardHeader>
              <CardTitle>Pain level distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart
                  data={distributionChartData}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                >
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="intensity" {...AXIS_PROPS} />
                  <YAxis allowDecimals={false} {...AXIS_PROPS} />
                  <Tooltip
                    cursor={{ fill: 'var(--color-muted)', opacity: 0.5 }}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <ChartTooltip
                          title={payload[0]?.payload?.label as string}
                          rows={[
                            {
                              label: 'Headaches',
                              value: payload[0]?.value ?? 0,
                              color:
                                INTENSITY_VAR[
                                  payload[0]?.payload?.intensity as Intensity
                                ],
                            },
                          ]}
                        />
                      ) : null
                    }
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {distribution.map((d) => (
                      <Cell key={d.intensity} fill={INTENSITY_VAR[d.intensity]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Pain level, 1 mild to 5 extreme
              </p>
            </CardContent>
          </Card>
        </Section>

        <Section title="Medication">
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Most used"
              value={medHeadline.mostUsed?.name ?? '—'}
              hint={
                medHeadline.mostUsed
                  ? `${medHeadline.mostUsed.doses} dose${medHeadline.mostUsed.doses === 1 ? '' : 's'}`
                  : undefined
              }
            />
            <Stat
              label="Most effective"
              value={medHeadline.mostEffective?.name ?? '—'}
              hint={
                medHeadline.mostEffective?.averageEffectiveness
                  ? `${medHeadline.mostEffective.averageEffectiveness} / 5 average`
                  : 'needs relief ratings'
              }
            />
            <Stat
              label="Average relief"
              value={medHeadline.averageEffectiveness ?? '—'}
              hint="out of 5"
            />
            <Stat
              label="Doses per headache"
              value={medHeadline.averageDosesPerEpisode ?? '—'}
              hint={`${medHeadline.untreatedEpisodes} untreated`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>How well each one worked</CardTitle>
            </CardHeader>
            <CardContent>
              <RankedBars
                max={5}
                items={medStats
                  .filter((m) => m.averageEffectiveness != null)
                  .map((m) => ({
                    label: m.name,
                    value: m.averageEffectiveness ?? 0,
                    hint: `/5 · ${m.ratedDoses} rated`,
                  }))}
                formatValue={(v) => v.toFixed(1)}
                emptyLabel="Rate how well a medication worked and it will appear here."
              />
            </CardContent>
          </Card>

          {medStats.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Times taken</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <RankedBars
                  items={medStats.map((m) => ({
                    label: m.name,
                    value: m.doses,
                    hint: m.typicalDose ? `· usually ${m.typicalDose}` : undefined,
                  }))}
                />
                {medStats.some((m) => m.averageTimeToReliefMinutes != null) ? (
                  <ul className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                    {medStats
                      .filter((m) => m.averageTimeToReliefMinutes != null)
                      .map((m) => (
                        <li key={m.name} className="flex justify-between gap-3">
                          <span>{m.name} — time to relief</span>
                          <span className="tabular-nums">
                            {formatDuration(m.averageTimeToReliefMinutes)}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </Section>

        {auraCounts.length ? (
          <Section
            title="Aura"
            description={`${summary.episodesWithAura} of ${summary.totalEpisodes} headaches involved aura`}
          >
            <Card>
              <CardContent className="pt-4">
                <RankedBars
                  items={auraCounts.map((a) => ({
                    label: AURA_LABEL[a.symptom as AuraSymptom],
                    value: a.count,
                  }))}
                />
              </CardContent>
            </Card>
          </Section>
        ) : null}

        {regions.length ? (
          <Section title="Where it hurts most">
            <Card>
              <CardContent className="pt-4">
                <RankedBars
                  items={regions.slice(0, 8).map((r) => ({
                    label: HEAD_REGION_LABEL[r.region as HeadRegionId] ?? r.region,
                    value: r.count,
                    hint: r.averageIntensity
                      ? `· avg level ${r.averageIntensity}`
                      : undefined,
                  }))}
                />
              </CardContent>
            </Card>
          </Section>
        ) : null}
      </div>
    </AppShell>
  )
}
