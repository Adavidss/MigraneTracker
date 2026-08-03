import Dexie, { type EntityTable } from 'dexie'
import {
  DEFAULT_MEDICATIONS,
  DEFAULT_SETTINGS,
  guessMedicationClass,
  type DayLog,
  type DoseUnit,
  type Effectiveness,
  type Episode,
  type Intensity,
  type MedicationClass,
  type MedicationPreset,
  type Settings,
} from './types'
import { dateKey, normalizeMedName, uid } from './utils'

/**
 * The entire application database. Nothing here is ever sent anywhere — it
 * lives in the browser's IndexedDB and is only readable by this origin.
 */
class MigraineDB extends Dexie {
  episodes!: EntityTable<Episode, 'id'>
  dayLogs!: EntityTable<DayLog, 'date'>
  medications!: EntityTable<MedicationPreset, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('migrainetracker')
    this.version(1).stores({
      // `date` is the hot index: calendars, heatmaps and range filters all
      // query by day. `[date+startTime]` keeps a day's episodes in order.
      episodes: 'id, date, type, intensity, startTime, [date+startTime]',
      dayLogs: 'date',
      medications: 'id, name, useCount',
      settings: 'id',
    })
  }
}

export const db = new MigraineDB()

/** Seeds the medication presets and settings row on first run. */
export async function initDb(): Promise<void> {
  await db.transaction('rw', db.settings, db.medications, async () => {
    const existing = await db.settings.get('settings')
    if (!existing) await db.settings.put(DEFAULT_SETTINGS)

    const medCount = await db.medications.count()
    if (medCount === 0) {
      await db.medications.bulkPut(
        DEFAULT_MEDICATIONS.map((m) => ({ ...m, id: uid() })),
      )
    }
  })
}

/* ------------------------------------------------------------- settings --- */

export async function getSettings(): Promise<Settings> {
  // Merged, not substituted: rows written before a setting existed lack the key.
  const stored = await db.settings.get('settings')
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'settings' })
}

/* ------------------------------------------------------------- episodes --- */

export type EpisodeDraft = Omit<Episode, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<Episode, 'id' | 'createdAt'>>

export async function saveEpisode(draft: EpisodeDraft): Promise<string> {
  const now = new Date().toISOString()
  const id = draft.id ?? uid()
  const episode: Episode = {
    ...draft,
    id,
    createdAt: draft.createdAt ?? now,
    updatedAt: now,
  }

  await db.transaction('rw', db.episodes, db.dayLogs, db.medications, async () => {
    await db.episodes.put(episode)
    // A day cannot be both headache-free and hold an episode.
    await db.dayLogs.delete(episode.date)
    await rememberMedications(episode)
  })

  return id
}

export async function deleteEpisode(id: string): Promise<void> {
  await db.episodes.delete(id)
}

export async function getEpisode(id: string): Promise<Episode | undefined> {
  return db.episodes.get(id)
}

export function episodesForDay(date: string): Promise<Episode[]> {
  return db.episodes.where('date').equals(date).sortBy('startTime')
}

/** Inclusive on both ends; both bounds are `YYYY-MM-DD` keys. */
export function episodesInRange(from: string, to: string): Promise<Episode[]> {
  return db.episodes.where('date').between(from, to, true, true).sortBy('startTime')
}

export function allEpisodes(): Promise<Episode[]> {
  return db.episodes.orderBy('date').toArray()
}

/**
 * The episode still in progress, or null when there is none.
 *
 * Null rather than undefined on purpose: callers use `undefined` to mean "the
 * query has not answered yet", and the two states need different handling —
 * see useOngoingEpisode.
 */
export async function getOngoingEpisode(): Promise<Episode | null> {
  const recent = await db.episodes
    .where('date')
    .between(dateKey(new Date(Date.now() - 3 * 86400000)), dateKey(), true, true)
    .toArray()
  return (
    recent
      .filter((e) => !e.endTime)
      .sort((a, b) => b.startTime.localeCompare(a.startTime))[0] ?? null
  )
}

/* --------------------------------------------------------- attack mode --- */

/**
 * The whole point of these four helpers is that each is a single tap during an
 * attack, when reading and precise aiming are hard. Everything else about the
 * entry can be filled in afterwards.
 */

/** Starts an episode from the saved defaults, right now. */
export async function startEpisodeNow(): Promise<string> {
  const settings = await getSettings()
  const now = new Date().toISOString()
  return saveEpisode({
    date: dateKey(),
    startTime: now,
    type: settings.defaultType,
    intensity: 3,
    painMap: settings.defaultRegions.map((region) => ({ region, intensity: 3 })),
    auraSymptoms: [],
    medications: [],
    progression: [],
  })
}

/**
 * Records how bad it is right now. Each change also lands in the progression,
 * so simply using the app during an attack builds the pain curve for free.
 */
export async function setEpisodeIntensityNow(
  id: string,
  intensity: Intensity,
): Promise<void> {
  const episode = await db.episodes.get(id)
  if (!episode) return

  const now = new Date().toISOString()
  const progression = [
    ...episode.progression,
    { id: uid(), at: now, intensity },
  ]

  await db.episodes.put({
    ...episode,
    progression,
    // `intensity` is the peak, so it only ever climbs.
    intensity: (Math.max(episode.intensity, intensity) as Intensity),
    updatedAt: now,
  })
}

export async function addDoseNow(
  id: string,
  preset: Pick<MedicationPreset, 'name' | 'defaultAmount' | 'defaultUnit'>,
): Promise<void> {
  const episode = await db.episodes.get(id)
  if (!episode) return

  const now = new Date().toISOString()
  await saveEpisode({
    ...episode,
    medications: [
      ...episode.medications,
      {
        id: uid(),
        name: preset.name,
        amount: preset.defaultAmount,
        unit: preset.defaultUnit,
        takenAt: now,
      },
    ],
  })
}

/**
 * Partial update for the handful of fields attack mode edits in place, so the
 * aura checklist and a note never require opening the full form.
 */
export async function patchEpisode(
  id: string,
  patch: Partial<
    Pick<Episode, 'type' | 'auraSymptoms' | 'auraNotes' | 'notes' | 'painMap'>
  >,
): Promise<void> {
  const episode = await db.episodes.get(id)
  if (!episode) return
  await db.episodes.put({
    ...episode,
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * How well a dose worked, answered while it is still fresh. Recording it during
 * the attack is the only time the answer is reliable.
 */
export async function setDoseEffectiveness(
  episodeId: string,
  doseId: string,
  effectiveness: Effectiveness | undefined,
): Promise<void> {
  const episode = await db.episodes.get(episodeId)
  if (!episode) return
  await db.episodes.put({
    ...episode,
    medications: episode.medications.map((dose) =>
      dose.id === doseId
        ? {
            ...dose,
            effectiveness,
            // Anything better than "no relief" implies relief arrived; stamp it
            // now so time-to-relief has something to work from.
            reliefAt:
              effectiveness && effectiveness > 1
                ? (dose.reliefAt ?? new Date().toISOString())
                : undefined,
          }
        : dose,
    ),
    updatedAt: new Date().toISOString(),
  })
}

/** A medication that is not one of the saved presets. */
export async function addCustomDoseNow(
  episodeId: string,
  name: string,
  amount: number,
  unit: DoseUnit,
): Promise<void> {
  const episode = await db.episodes.get(episodeId)
  if (!episode || !name.trim()) return
  await saveEpisode({
    ...episode,
    medications: [
      ...episode.medications,
      {
        id: uid(),
        name: name.trim(),
        amount,
        unit,
        takenAt: new Date().toISOString(),
      },
    ],
  })
}

export async function endEpisodeNow(id: string): Promise<void> {
  const episode = await db.episodes.get(id)
  if (!episode) return
  await db.episodes.put({
    ...episode,
    endTime: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

/* ------------------------------------------------------------- day logs --- */

export async function markHeadacheFree(date: string, note?: string): Promise<void> {
  const count = await db.episodes.where('date').equals(date).count()
  if (count > 0) {
    throw new Error('This day already has a headache logged.')
  }
  await db.dayLogs.put({ date, note, createdAt: new Date().toISOString() })
}

export async function unmarkHeadacheFree(date: string): Promise<void> {
  await db.dayLogs.delete(date)
}

export function dayLogsInRange(from: string, to: string): Promise<DayLog[]> {
  return db.dayLogs.where('date').between(from, to, true, true).toArray()
}

export function allDayLogs(): Promise<DayLog[]> {
  return db.dayLogs.orderBy('date').toArray()
}

/* ---------------------------------------------------------- medications --- */

export function allMedications(): Promise<MedicationPreset[]> {
  return db.medications.orderBy('useCount').reverse().toArray()
}

/**
 * Keeps the preset list in step with what the user actually types, so a
 * medication logged once is one tap away next time.
 */
async function rememberMedications(episode: Episode): Promise<void> {
  const presets = await db.medications.toArray()
  const byName = new Map(presets.map((p) => [normalizeMedName(p.name), p]))
  const seen = new Set<string>()

  for (const dose of episode.medications) {
    const key = normalizeMedName(dose.name)
    if (!key || seen.has(key)) continue
    seen.add(key)

    const existing = byName.get(key)
    if (existing) {
      await db.medications.update(existing.id, {
        useCount: existing.useCount + 1,
        defaultAmount: dose.amount,
        defaultUnit: dose.unit,
        // Fill in a class for presets saved before classes existed, but never
        // overwrite one the user has corrected.
        medClass: existing.medClass ?? guessMedicationClass(dose.name),
      })
    } else {
      await db.medications.put({
        id: uid(),
        name: dose.name.trim(),
        defaultAmount: dose.amount,
        defaultUnit: dose.unit,
        useCount: 1,
        medClass: guessMedicationClass(dose.name),
      })
    }
  }
}

export async function addMedicationPreset(
  name: string,
  defaultAmount: number,
  defaultUnit: MedicationPreset['defaultUnit'],
): Promise<void> {
  const key = normalizeMedName(name)
  const existing = (await db.medications.toArray()).find(
    (m) => normalizeMedName(m.name) === key,
  )
  if (existing) {
    await db.medications.update(existing.id, { defaultAmount, defaultUnit })
    return
  }
  await db.medications.put({
    id: uid(),
    name: name.trim(),
    defaultAmount,
    defaultUnit,
    useCount: 0,
    medClass: guessMedicationClass(name),
  })
}

export async function setMedicationClass(
  id: string,
  medClass: MedicationClass,
): Promise<void> {
  await db.medications.update(id, { medClass })
}

export async function deleteMedicationPreset(id: string): Promise<void> {
  await db.medications.delete(id)
}

/* --------------------------------------------------------- bulk / reset --- */

export async function replaceAllData(payload: {
  episodes: Episode[]
  dayLogs: DayLog[]
  medications: MedicationPreset[]
  settings?: Settings
}): Promise<void> {
  await db.transaction(
    'rw',
    db.episodes,
    db.dayLogs,
    db.medications,
    db.settings,
    async () => {
      await Promise.all([
        db.episodes.clear(),
        db.dayLogs.clear(),
        db.medications.clear(),
      ])
      await db.episodes.bulkPut(payload.episodes)
      await db.dayLogs.bulkPut(payload.dayLogs)
      await db.medications.bulkPut(payload.medications)
      if (payload.settings) {
        await db.settings.put({ ...payload.settings, id: 'settings' })
      }
    },
  )
}

/** Adds imported records without touching what is already stored. */
export async function mergeData(payload: {
  episodes: Episode[]
  dayLogs: DayLog[]
  medications: MedicationPreset[]
}): Promise<{ episodes: number; dayLogs: number }> {
  let addedEpisodes = 0
  let addedDays = 0

  await db.transaction('rw', db.episodes, db.dayLogs, db.medications, async () => {
    for (const episode of payload.episodes) {
      const clash = await db.episodes.get(episode.id)
      // Same id from an earlier backup of this device: keep the newer copy.
      if (clash && clash.updatedAt >= episode.updatedAt) continue
      await db.episodes.put(episode)
      addedEpisodes += 1
    }

    for (const log of payload.dayLogs) {
      const hasEpisode = await db.episodes.where('date').equals(log.date).count()
      if (hasEpisode) continue
      if (await db.dayLogs.get(log.date)) continue
      await db.dayLogs.put(log)
      addedDays += 1
    }

    const presets = await db.medications.toArray()
    const known = new Set(presets.map((p) => normalizeMedName(p.name)))
    for (const med of payload.medications) {
      if (known.has(normalizeMedName(med.name))) continue
      await db.medications.put({ ...med, id: uid() })
      known.add(normalizeMedName(med.name))
    }
  })

  return { episodes: addedEpisodes, dayLogs: addedDays }
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    db.episodes,
    db.dayLogs,
    db.medications,
    db.settings,
    async () => {
      await Promise.all([
        db.episodes.clear(),
        db.dayLogs.clear(),
        db.medications.clear(),
        db.settings.clear(),
      ])
    },
  )
  await initDb()
}
