import {
  EFFECTIVENESS_LABEL,
  EPISODE_TYPE_LABEL,
  type Episode,
  type Intensity,
  type MedicationDose,
} from './types'
import { durationMinutes } from './utils'

export type EventKind = 'start' | 'reading' | 'dose' | 'relief' | 'end'

export interface EpisodeEvent {
  id: string
  at: string
  kind: EventKind
  label: string
  detail?: string
  intensity?: Intensity
}

/**
 * Flattens an episode into the single ordered list of moments the timeline and
 * the day view both render: when it started, how the pain moved, every dose,
 * when relief arrived, and when it ended.
 */
export function buildEventTimeline(episode: Episode): EpisodeEvent[] {
  const events: EpisodeEvent[] = [
    {
      id: `${episode.id}-start`,
      at: episode.startTime,
      kind: 'start',
      label: `${EPISODE_TYPE_LABEL[episode.type]} begins`,
      intensity: episode.intensity,
    },
  ]

  for (const reading of episode.progression) {
    events.push({
      id: reading.id,
      at: reading.at,
      kind: 'reading',
      label: `Pain level ${reading.intensity}`,
      detail: reading.note,
      intensity: reading.intensity,
    })
  }

  for (const dose of episode.medications) {
    events.push({
      id: dose.id,
      at: dose.takenAt,
      kind: 'dose',
      label: describeDose(dose),
    })

    if (dose.reliefAt) {
      events.push({
        id: `${dose.id}-relief`,
        at: dose.reliefAt,
        kind: 'relief',
        label: `Relief from ${dose.name}`,
        detail: dose.effectiveness
          ? EFFECTIVENESS_LABEL[dose.effectiveness]
          : undefined,
      })
    }
  }

  if (episode.endTime) {
    events.push({
      id: `${episode.id}-end`,
      at: episode.endTime,
      kind: 'end',
      label: 'Headache ends',
    })
  }

  return events.sort((a, b) => a.at.localeCompare(b.at))
}

export function describeDose(dose: MedicationDose): string {
  const amount = Number.isFinite(dose.amount) ? dose.amount : 0
  return `${dose.name} — ${amount} ${dose.unit}`
}

/**
 * Pain level at a given moment, interpolated from the recorded readings as a
 * step function. Used to animate the timeline playback.
 */
export function intensityAt(episode: Episode, at: Date): Intensity | null {
  const time = at.getTime()
  const start = new Date(episode.startTime).getTime()
  if (Number.isNaN(start) || time < start) return null

  if (episode.endTime) {
    const end = new Date(episode.endTime).getTime()
    if (!Number.isNaN(end) && time > end) return null
  }

  const readings = [...episode.progression].sort((a, b) => a.at.localeCompare(b.at))
  let current: Intensity = episode.intensity

  // Before the first reading the episode sits at its recorded level.
  const firstReading = readings[0]
  if (firstReading && time < new Date(firstReading.at).getTime()) {
    return episode.intensity
  }

  for (const reading of readings) {
    if (new Date(reading.at).getTime() <= time) current = reading.intensity
    else break
  }
  return current
}

export function episodeDurationMinutes(episode: Episode): number | null {
  return durationMinutes(episode.startTime, episode.endTime)
}

export function isMigraine(episode: Episode): boolean {
  return episode.type === 'migraine' || episode.type === 'migraine-aura'
}

export function hasAura(episode: Episode): boolean {
  return episode.type === 'migraine-aura' || episode.auraSymptoms.length > 0
}
