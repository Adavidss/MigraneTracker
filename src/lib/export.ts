import { format } from 'date-fns'
import {
  AURA_LABEL,
  EFFECTIVENESS_LABEL,
  EPISODE_TYPE_LABEL,
  HEAD_REGION_LABEL,
  type BackupFile,
  type DayLog,
  type Episode,
  type MedicationPreset,
  type Settings,
} from './types'
import { episodeDurationMinutes, hasAura } from './episode'
import { downloadBlob, formatTime } from './utils'

/* ------------------------------------------------------------------ CSV --- */

function csvCell(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows: unknown[][]): string {
  // The BOM keeps Excel from mangling accented characters.
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function episodesCsv(episodes: Episode[], use24h = false): string {
  const rows: unknown[][] = [
    [
      'Date',
      'Start',
      'End',
      'Duration (minutes)',
      'Type',
      'Peak pain (1-5)',
      'Aura',
      'Aura symptoms',
      'Pain locations',
      'Medications',
      'Doses',
      'Best relief (1-5)',
      'Notes',
    ],
  ]

  for (const episode of episodes) {
    const relief = episode.medications.reduce<number>(
      (best, dose) => Math.max(best, dose.effectiveness ?? 0),
      0,
    )

    rows.push([
      episode.date,
      formatTime(episode.startTime, use24h),
      episode.endTime ? formatTime(episode.endTime, use24h) : '',
      episodeDurationMinutes(episode) ?? '',
      EPISODE_TYPE_LABEL[episode.type],
      episode.intensity,
      hasAura(episode) ? 'yes' : 'no',
      episode.auraSymptoms.map((s) => AURA_LABEL[s]).join('; '),
      episode.painMap
        .map((p) => `${HEAD_REGION_LABEL[p.region]} (${p.intensity})`)
        .join('; '),
      [...new Set(episode.medications.map((d) => d.name))].join('; '),
      episode.medications.length,
      relief || '',
      episode.notes ?? '',
    ])
  }

  return toCsv(rows)
}

export function dosesCsv(episodes: Episode[], use24h = false): string {
  const rows: unknown[][] = [
    [
      'Date',
      'Headache start',
      'Peak pain (1-5)',
      'Medication',
      'Amount',
      'Unit',
      'Time taken',
      'Effectiveness (1-5)',
      'Effectiveness label',
      'Relief felt at',
    ],
  ]

  for (const episode of episodes) {
    for (const dose of episode.medications) {
      rows.push([
        episode.date,
        formatTime(episode.startTime, use24h),
        episode.intensity,
        dose.name,
        dose.amount,
        dose.unit,
        formatTime(dose.takenAt, use24h),
        dose.effectiveness ?? '',
        dose.effectiveness ? EFFECTIVENESS_LABEL[dose.effectiveness] : '',
        dose.reliefAt ? formatTime(dose.reliefAt, use24h) : '',
      ])
    }
  }

  return toCsv(rows)
}

export function daysCsv(dayLogs: DayLog[]): string {
  return toCsv([
    ['Date', 'Status', 'Note'],
    ...dayLogs.map((log) => [log.date, 'no headache', log.note ?? '']),
  ])
}

export function downloadCsv(content: string, filename: string) {
  downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8' }), filename)
}

/* ----------------------------------------------------------------- JSON --- */

export function buildBackup(
  episodes: Episode[],
  dayLogs: DayLog[],
  medications: MedicationPreset[],
  settings: Settings,
): BackupFile {
  return {
    format: 'migrainetracker-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    episodes,
    dayLogs,
    medications,
    settings,
  }
}

export function downloadBackup(backup: BackupFile) {
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    `migrainetracker-backup-${format(new Date(), 'yyyy-MM-dd')}.json`,
  )
}

/**
 * Validates an uploaded backup before anything touches the database. An import
 * replaces or merges real medical history, so a malformed file must fail loudly
 * rather than silently write partial records.
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new Error('That file does not look like a MigraineTracker backup.')
  }

  const data = raw as Partial<BackupFile>
  if (data.format !== 'migrainetracker-backup') {
    throw new Error('That file does not look like a MigraineTracker backup.')
  }
  if (data.version !== 1) {
    throw new Error(`Unsupported backup version: ${String(data.version)}.`)
  }
  if (!Array.isArray(data.episodes) || !Array.isArray(data.dayLogs)) {
    throw new Error('The backup is missing its episode or day records.')
  }

  const episodes = data.episodes.filter(
    (e): e is Episode =>
      !!e &&
      typeof e.id === 'string' &&
      typeof e.date === 'string' &&
      typeof e.startTime === 'string' &&
      Array.isArray(e.painMap) &&
      Array.isArray(e.medications),
  )

  if (episodes.length !== data.episodes.length) {
    throw new Error('Some entries in that backup are damaged. Nothing was imported.')
  }

  return {
    format: 'migrainetracker-backup',
    version: 1,
    exportedAt: data.exportedAt ?? new Date().toISOString(),
    episodes,
    dayLogs: data.dayLogs.filter(
      (d): d is DayLog => !!d && typeof d.date === 'string',
    ),
    medications: Array.isArray(data.medications)
      ? data.medications.filter(
          (m): m is MedicationPreset => !!m && typeof m.name === 'string',
        )
      : [],
    settings: data.settings as Settings,
  }
}
