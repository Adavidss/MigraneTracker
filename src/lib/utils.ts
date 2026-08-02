import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parse } from 'date-fns'
import type { Intensity } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Stable id that works without a secure context (file://, older Safari). */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/* ---------------------------------------------------------------- dates --- */

/** The local-calendar day key (`YYYY-MM-DD`) for a Date. */
export function dateKey(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd')
}

/** Parse a `YYYY-MM-DD` key back into a Date at local midnight. */
export function keyToDate(key: string): Date {
  return parse(key, 'yyyy-MM-dd', new Date())
}

export function isSameDayKey(a: string | undefined, b: string | undefined) {
  return !!a && a === b
}

/** `2:05 PM` or `14:05`, respecting the user's clock preference. */
export function formatTime(iso: string | Date, use24h = false): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, use24h ? 'HH:mm' : 'h:mm a')
}

export function formatDayLong(key: string): string {
  return format(keyToDate(key), 'EEEE, d MMMM yyyy')
}

export function formatDayShort(key: string): string {
  return format(keyToDate(key), 'd MMM yyyy')
}

/**
 * `2h 45m`, `45m`, `3d 2h`. Returns `null` for non-finite or negative spans so
 * callers can render an "ongoing" state instead of a nonsense number.
 */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return null
  const total = Math.round(minutes)
  if (total < 60) return `${total}m`
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours ? `${days}d ${remHours}h` : `${days}d`
}

/** Minutes between two ISO timestamps, or null if the end is missing/invalid. */
export function durationMinutes(
  startIso: string,
  endIso: string | undefined,
): number | null {
  if (!endIso) return null
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return (end - start) / 60000
}

/** `HH:mm` for `<input type="time">`. */
export function toTimeInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, 'HH:mm')
}

/**
 * Combine a `YYYY-MM-DD` key with an `HH:mm` input value into an ISO string.
 * Invalid input falls back to the day's midnight so a bad keystroke can never
 * produce an `Invalid Date` in storage.
 */
export function fromDateAndTimeInput(dayKey: string, timeValue: string): string {
  const base = keyToDate(dayKey)
  const [h, m] = timeValue.split(':').map(Number)
  if (Number.isFinite(h) && Number.isFinite(m)) {
    base.setHours(h as number, m as number, 0, 0)
  } else {
    base.setHours(0, 0, 0, 0)
  }
  return base.toISOString()
}

/* --------------------------------------------------------------- values --- */

export function clampIntensity(n: number): Intensity {
  const v = Math.round(n)
  if (v <= 1) return 1
  if (v >= 5) return 5
  return v as Intensity
}

/** Averages, returning null rather than NaN for an empty set. */
export function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function round(value: number | null, places = 1): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const f = 10 ** places
  return Math.round(value * f) / f
}

/** Medication names are user-typed; group them case- and space-insensitively. */
export function normalizeMedName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function titleCase(value: string): string {
  return value
    .split(' ')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** Trigger a client-side file download from a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give Safari a beat to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
