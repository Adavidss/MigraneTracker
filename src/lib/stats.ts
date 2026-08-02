import { differenceInCalendarDays, format } from 'date-fns'
import {
  type AuraSymptom,
  type DayLog,
  type Episode,
  type Intensity,
  type MedicationDose,
} from './types'
import {
  dateKey,
  durationMinutes,
  keyToDate,
  mean,
  normalizeMedName,
  round,
  titleCase,
} from './utils'

/**
 * Every figure the app reports is derived here, so the dashboard, the doctor
 * summary and the CSV export can never disagree with one another.
 */

export interface StatsInput {
  episodes: Episode[]
  dayLogs: DayLog[]
  /** Window the statistics describe; defaults to first record → today. */
  from?: string
  to?: string
}

export interface Summary {
  totalEpisodes: number
  /** Distinct days carrying at least one episode. */
  headacheDays: number
  /** Distinct days carrying at least one migraine (with or without aura). */
  migraineDays: number
  /** Days explicitly confirmed headache-free. */
  headacheFreeDays: number
  /** Days in the window with neither an episode nor a headache-free mark. */
  unloggedDays: number
  daysTracked: number
  /** Share of days in the window with any record at all, 0–1. */
  coverage: number
  averageIntensity: number | null
  averageDurationMinutes: number | null
  /** Episodes still without an end time; excluded from the duration average. */
  ongoingCount: number
  longestClearStreak: number
  currentClearStreak: number
  episodesWithAura: number
  auraRate: number | null
  /** Episodes per 30 days across the window. */
  frequencyPer30Days: number | null
  firstRecord: string | null
  lastRecord: string | null
}

export interface MedicationStat {
  name: string
  /** Number of individual doses logged. */
  doses: number
  /** Number of distinct episodes it was used in. */
  episodes: number
  averageEffectiveness: number | null
  ratedDoses: number
  /** Share of rated doses scoring 4 or 5, 0–1. */
  successRate: number | null
  averageTimeToReliefMinutes: number | null
  /** Most common amount + unit, for the doctor summary. */
  typicalDose: string | null
}

export interface MonthPoint {
  /** `YYYY-MM`. */
  month: string
  label: string
  episodes: number
  migraines: number
  headacheDays: number
  averageIntensity: number | null
  auraEpisodes: number
  doses: number
  averageEffectiveness: number | null
}

export interface DayCell {
  date: string
  episodes: number
  maxIntensity: Intensity | null
  doses: number
  headacheFree: boolean
}

export interface IntensityBucket {
  intensity: Intensity
  count: number
}

export interface AuraCount {
  symptom: AuraSymptom
  count: number
}

const MIGRAINE_TYPES = new Set(['migraine', 'migraine-aura'])

function inWindow(date: string, from?: string, to?: string) {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function filterToWindow({ episodes, dayLogs, from, to }: StatsInput) {
  return {
    episodes: episodes.filter((e) => inWindow(e.date, from, to)),
    dayLogs: dayLogs.filter((d) => inWindow(d.date, from, to)),
  }
}

/* -------------------------------------------------------------- summary --- */

export function computeSummary(input: StatsInput): Summary {
  const { episodes, dayLogs } = filterToWindow(input)

  const episodeDays = new Set(episodes.map((e) => e.date))
  const migraineDays = new Set(
    episodes.filter((e) => MIGRAINE_TYPES.has(e.type)).map((e) => e.date),
  )
  const freeDays = new Set(dayLogs.map((d) => d.date))

  const allRecordDays = [...episodeDays, ...freeDays].sort()
  const firstRecord = input.from ?? allRecordDays[0] ?? null
  const todayKey = dateKey()
  const lastRecord =
    input.to ?? (allRecordDays.length ? allRecordDays[allRecordDays.length - 1]! : null)

  // The window runs to today unless the caller pinned an explicit end, so an
  // ongoing clear streak keeps counting.
  const windowEnd = input.to ?? todayKey
  const daysTracked =
    firstRecord && windowEnd >= firstRecord
      ? differenceInCalendarDays(keyToDate(windowEnd), keyToDate(firstRecord)) + 1
      : 0

  const durations = episodes
    .map((e) => durationMinutes(e.startTime, e.endTime))
    .filter((d): d is number => d != null)

  const auraEpisodes = episodes.filter(
    (e) => e.type === 'migraine-aura' || e.auraSymptoms.length > 0,
  ).length

  const { longest, current } = clearStreaks(episodeDays, firstRecord, windowEnd)

  const loggedDays = new Set([...episodeDays, ...freeDays]).size

  return {
    totalEpisodes: episodes.length,
    headacheDays: episodeDays.size,
    migraineDays: migraineDays.size,
    headacheFreeDays: freeDays.size,
    unloggedDays: Math.max(0, daysTracked - loggedDays),
    daysTracked,
    coverage: daysTracked ? loggedDays / daysTracked : 0,
    averageIntensity: round(mean(episodes.map((e) => e.intensity))),
    averageDurationMinutes: round(mean(durations), 0),
    ongoingCount: episodes.filter((e) => !e.endTime).length,
    longestClearStreak: longest,
    currentClearStreak: current,
    episodesWithAura: auraEpisodes,
    auraRate: episodes.length ? auraEpisodes / episodes.length : null,
    frequencyPer30Days: daysTracked
      ? round((episodes.length / daysTracked) * 30)
      : null,
    firstRecord,
    lastRecord,
  }
}

/**
 * Streaks of consecutive days carrying no episode, measured across the whole
 * tracking window. Days the user never logged count as clear — the same
 * assumption a paper diary makes — which is why the summary also reports
 * coverage so the gaps stay visible.
 */
function clearStreaks(
  episodeDays: Set<string>,
  from: string | null,
  to: string,
): { longest: number; current: number } {
  if (!from || to < from) return { longest: 0, current: 0 }

  let longest = 0
  let running = 0
  const cursor = keyToDate(from)
  const end = keyToDate(to)

  while (cursor <= end) {
    if (episodeDays.has(dateKey(cursor))) {
      running = 0
    } else {
      running += 1
      if (running > longest) longest = running
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return { longest, current: running }
}

/* ---------------------------------------------------------- medications --- */

/**
 * Minutes from a dose to the first sign of relief. Uses the explicitly logged
 * relief time when there is one, otherwise the first pain reading after the
 * dose that is lower than the level recorded when it was taken.
 */
export function timeToRelief(
  episode: Episode,
  dose: MedicationDose,
): number | null {
  if (dose.reliefAt) return durationMinutes(dose.takenAt, dose.reliefAt)

  const doseAt = new Date(dose.takenAt).getTime()
  if (Number.isNaN(doseAt)) return null

  const readings = [...episode.progression].sort((a, b) => a.at.localeCompare(b.at))
  const before = readings.filter((r) => new Date(r.at).getTime() <= doseAt).pop()
  const baseline = before?.intensity ?? episode.intensity

  const relief = readings.find(
    (r) => new Date(r.at).getTime() > doseAt && r.intensity < baseline,
  )
  return relief ? durationMinutes(dose.takenAt, relief.at) : null
}

export function computeMedicationStats(input: StatsInput): MedicationStat[] {
  const { episodes } = filterToWindow(input)

  interface Acc {
    name: string
    doses: number
    episodes: Set<string>
    scores: number[]
    reliefTimes: number[]
    doseStrings: Map<string, number>
  }
  const acc = new Map<string, Acc>()

  for (const episode of episodes) {
    for (const dose of episode.medications) {
      const key = normalizeMedName(dose.name)
      if (!key) continue

      let entry = acc.get(key)
      if (!entry) {
        entry = {
          name: titleCase(key),
          doses: 0,
          episodes: new Set(),
          scores: [],
          reliefTimes: [],
          doseStrings: new Map(),
        }
        acc.set(key, entry)
      }

      entry.doses += 1
      entry.episodes.add(episode.id)
      if (dose.effectiveness) entry.scores.push(dose.effectiveness)

      const relief = timeToRelief(episode, dose)
      if (relief != null) entry.reliefTimes.push(relief)

      const label = `${dose.amount} ${dose.unit}`
      entry.doseStrings.set(label, (entry.doseStrings.get(label) ?? 0) + 1)
    }
  }

  return [...acc.values()]
    .map((entry): MedicationStat => {
      const typical = [...entry.doseStrings.entries()].sort((a, b) => b[1] - a[1])[0]
      const good = entry.scores.filter((s) => s >= 4).length
      return {
        name: entry.name,
        doses: entry.doses,
        episodes: entry.episodes.size,
        averageEffectiveness: round(mean(entry.scores)),
        ratedDoses: entry.scores.length,
        successRate: entry.scores.length ? good / entry.scores.length : null,
        averageTimeToReliefMinutes: round(mean(entry.reliefTimes), 0),
        typicalDose: typical ? typical[0] : null,
      }
    })
    .sort((a, b) => b.doses - a.doses)
}

export interface MedicationHeadline {
  mostUsed: MedicationStat | null
  mostEffective: MedicationStat | null
  averageEffectiveness: number | null
  averageDosesPerEpisode: number | null
  episodesTreated: number
  untreatedEpisodes: number
}

export function computeMedicationHeadline(
  input: StatsInput,
  stats: MedicationStat[],
): MedicationHeadline {
  const { episodes } = filterToWindow(input)
  const allScores = episodes.flatMap((e) =>
    e.medications
      .map((m) => m.effectiveness)
      .filter((s): s is NonNullable<typeof s> => s != null),
  )
  const treated = episodes.filter((e) => e.medications.length > 0)

  // "Most effective" is only meaningful once a medication has been rated a few
  // times, so single lucky doses cannot top the chart.
  const MIN_RATINGS = 2
  const eligible = stats.filter(
    (s) => s.averageEffectiveness != null && s.ratedDoses >= MIN_RATINGS,
  )
  const pool = eligible.length
    ? eligible
    : stats.filter((s) => s.averageEffectiveness != null)

  const mostEffective =
    [...pool].sort(
      (a, b) =>
        (b.averageEffectiveness ?? 0) - (a.averageEffectiveness ?? 0) ||
        b.ratedDoses - a.ratedDoses,
    )[0] ?? null

  return {
    mostUsed: stats[0] ?? null,
    mostEffective,
    averageEffectiveness: round(mean(allScores)),
    averageDosesPerEpisode: treated.length
      ? round(mean(treated.map((e) => e.medications.length)))
      : null,
    episodesTreated: treated.length,
    untreatedEpisodes: episodes.length - treated.length,
  }
}

/* --------------------------------------------------------------- trends --- */

export function computeMonthly(input: StatsInput): MonthPoint[] {
  const { episodes } = filterToWindow(input)

  interface Acc {
    episodes: number
    migraines: number
    days: Set<string>
    intensities: number[]
    aura: number
    doses: number
    scores: number[]
  }
  const acc = new Map<string, Acc>()

  const bucket = (month: string) => {
    let entry = acc.get(month)
    if (!entry) {
      entry = {
        episodes: 0,
        migraines: 0,
        days: new Set(),
        intensities: [],
        aura: 0,
        doses: 0,
        scores: [],
      }
      acc.set(month, entry)
    }
    return entry
  }

  for (const episode of episodes) {
    const entry = bucket(episode.date.slice(0, 7))
    entry.episodes += 1
    if (MIGRAINE_TYPES.has(episode.type)) entry.migraines += 1
    entry.days.add(episode.date)
    entry.intensities.push(episode.intensity)
    if (episode.type === 'migraine-aura' || episode.auraSymptoms.length) {
      entry.aura += 1
    }
    entry.doses += episode.medications.length
    for (const dose of episode.medications) {
      if (dose.effectiveness) entry.scores.push(dose.effectiveness)
    }
  }

  return [...acc.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, entry]) => ({
      month,
      label: format(keyToDate(`${month}-01`), 'MMM yy'),
      episodes: entry.episodes,
      migraines: entry.migraines,
      headacheDays: entry.days.size,
      averageIntensity: round(mean(entry.intensities)),
      auraEpisodes: entry.aura,
      doses: entry.doses,
      averageEffectiveness: round(mean(entry.scores)),
    }))
}

export function computeIntensityDistribution(input: StatsInput): IntensityBucket[] {
  const { episodes } = filterToWindow(input)
  const counts = new Map<Intensity, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ])
  for (const e of episodes) counts.set(e.intensity, (counts.get(e.intensity) ?? 0) + 1)
  return [...counts.entries()].map(([intensity, count]) => ({ intensity, count }))
}

export function computeAuraCounts(input: StatsInput): AuraCount[] {
  const { episodes } = filterToWindow(input)
  const counts = new Map<AuraSymptom, number>()
  for (const e of episodes) {
    for (const symptom of e.auraSymptoms) {
      counts.set(symptom, (counts.get(symptom) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([symptom, count]) => ({ symptom, count }))
    .sort((a, b) => b.count - a.count)
}

/** Which head regions get hit most often, weighted by how many times painted. */
export function computeRegionFrequency(
  input: StatsInput,
): { region: string; count: number; averageIntensity: number | null }[] {
  const { episodes } = filterToWindow(input)
  const counts = new Map<string, { count: number; intensities: number[] }>()

  for (const e of episodes) {
    for (const point of e.painMap) {
      const entry = counts.get(point.region) ?? { count: 0, intensities: [] }
      entry.count += 1
      entry.intensities.push(point.intensity)
      counts.set(point.region, entry)
    }
  }

  return [...counts.entries()]
    .map(([region, entry]) => ({
      region,
      count: entry.count,
      averageIntensity: round(mean(entry.intensities)),
    }))
    .sort((a, b) => b.count - a.count)
}

/** Day-level cells for the calendar and the yearly heatmap. */
export function computeDayCells(input: StatsInput): Map<string, DayCell> {
  const { episodes, dayLogs } = filterToWindow(input)
  const cells = new Map<string, DayCell>()

  for (const log of dayLogs) {
    cells.set(log.date, {
      date: log.date,
      episodes: 0,
      maxIntensity: null,
      doses: 0,
      headacheFree: true,
    })
  }

  for (const episode of episodes) {
    const existing = cells.get(episode.date)
    const cell: DayCell = existing?.headacheFree
      ? { date: episode.date, episodes: 0, maxIntensity: null, doses: 0, headacheFree: false }
      : (existing ?? {
          date: episode.date,
          episodes: 0,
          maxIntensity: null,
          doses: 0,
          headacheFree: false,
        })

    cell.episodes += 1
    cell.doses += episode.medications.length
    cell.maxIntensity =
      cell.maxIntensity == null
        ? episode.intensity
        : (Math.max(cell.maxIntensity, episode.intensity) as Intensity)
    cells.set(episode.date, cell)
  }

  return cells
}
