import Dexie, { type EntityTable } from 'dexie'
import {
  DEFAULT_MEDICATIONS,
  DEFAULT_SETTINGS,
  guessMedicationClass,
  type DayLog,
  type Episode,
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
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
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
 * The episode still in progress, if any. Used by the home screen to offer
 * "end this headache" instead of starting a duplicate entry.
 */
export async function getOngoingEpisode(): Promise<Episode | undefined> {
  const recent = await db.episodes
    .where('date')
    .between(dateKey(new Date(Date.now() - 3 * 86400000)), dateKey(), true, true)
    .toArray()
  return recent
    .filter((e) => !e.endTime)
    .sort((a, b) => b.startTime.localeCompare(a.startTime))[0]
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
