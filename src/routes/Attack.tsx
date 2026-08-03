import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, Pill, Plus } from 'lucide-react'
import {
  addDoseNow,
  allMedications,
  endEpisodeNow,
  getOngoingEpisode,
  setEpisodeIntensityNow,
} from '@/lib/db'
import {
  INTENSITIES,
  INTENSITY_LABEL,
  INTENSITY_VAR,
  type Episode,
  type Intensity,
  type MedicationDose,
} from '@/lib/types'
import { cn, formatTime } from '@/lib/utils'
import { navigate } from '@/lib/router'
import { useSettings } from '@/store/useSettings'
import { ComfortControls } from '@/components/comfort'

/**
 * The screen for someone who is having a migraine right now.
 *
 * Everything here is shaped by what a migraine takes away. Light hurts, so it
 * is dark and dim-able. Reading is hard, so there is almost no text. Aim is
 * poor, so the targets are enormous and the important ones sit at the bottom
 * where a thumb reaches. Concentration is gone, so there are exactly three
 * things to do — say how bad it is, record a dose, say it has ended — and
 * every one of them is a single tap.
 *
 * Everything else about the entry can be filled in later, from the calendar,
 * when the person feels well enough to care.
 */
export default function Attack() {
  const settings = useSettings()
  const episode = useLiveQuery(getOngoingEpisode, [])
  const presets = useLiveQuery(allMedications, []) ?? []
  const [elapsed, setElapsed] = useState('')

  // "Going 40 minutes" is more use than a start time when you have lost track.
  useEffect(() => {
    if (!episode) return
    const tick = () => setElapsed(describeElapsed(episode.startTime))
    tick()
    const timer = setInterval(tick, 30_000)
    return () => clearInterval(timer)
  }, [episode])

  if (episode === undefined) {
    return (
      <Shell>
        <p className="text-center text-lg text-muted-foreground">Loading…</p>
      </Shell>
    )
  }

  if (!episode) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="text-xl font-medium">Nothing in progress</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="min-h-16 rounded-2xl bg-primary px-8 text-lg font-semibold text-primary-foreground"
          >
            Back to the calendar
          </button>
        </div>
      </Shell>
    )
  }

  const lastDose = latestDose(episode)
  const current = currentLevel(episode)
  const quickMeds = presets.slice(0, 2)

  return (
    <Shell>
      <div className="flex min-h-svh flex-col gap-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to the calendar"
            className="flex min-h-12 items-center gap-1 pr-3 text-base text-muted-foreground"
          >
            <ChevronLeft className="size-6" />
            Back
          </button>
          <p className="text-right text-base text-muted-foreground">
            Started {formatTime(episode.startTime, settings.use24HourTime)}
            <span className="block text-sm">{elapsed}</span>
          </p>
        </div>

        <ComfortControls settings={settings} />

        {/* How bad is it — the only question worth asking mid-attack. */}
        <div>
          <h1 className="mb-3 text-center text-2xl font-semibold tracking-tight">
            How bad is it?
          </h1>
          <div className="grid grid-cols-5 gap-2">
            {INTENSITIES.map((level) => {
              const active = level === current
              return (
                <button
                  key={level}
                  type="button"
                  aria-label={`${level} — ${INTENSITY_LABEL[level]}`}
                  aria-pressed={active}
                  onClick={() => setEpisodeIntensityNow(episode.id, level)}
                  className={cn(
                    'flex min-h-20 items-center justify-center rounded-2xl text-3xl font-bold transition-none',
                    active ? 'text-white' : 'bg-muted text-muted-foreground',
                  )}
                  style={
                    active
                      ? { backgroundColor: INTENSITY_VAR[level] }
                      : undefined
                  }
                >
                  {level}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-center text-lg text-muted-foreground">
            {INTENSITY_LABEL[current]}
          </p>
        </div>

        {/* Time since the last dose, so a foggy head does not double up. */}
        {lastDose ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-base text-muted-foreground">Last dose</p>
            <p className="mt-1 text-xl font-semibold">
              {lastDose.name} · {describeElapsed(lastDose.takenAt)}
            </p>
            <p className="mt-0.5 text-base text-muted-foreground">
              at {formatTime(lastDose.takenAt, settings.use24HourTime)}
            </p>
          </div>
        ) : null}

        {/* Bottom-weighted: the actions sit where a thumb already is. */}
        <div className="mt-auto space-y-3">
          {quickMeds.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => addDoseNow(episode.id, preset)}
              className="flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl bg-accent px-5 text-xl font-semibold text-accent-foreground"
            >
              <Pill className="size-6 shrink-0" />
              Took {preset.name}
            </button>
          ))}

          <button
            type="button"
            onClick={() => navigate(`/log/${episode.id}`)}
            className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 text-lg font-medium text-muted-foreground"
          >
            <Plus className="size-5 shrink-0" />
            Something else
          </button>

          <button
            type="button"
            onClick={async () => {
              await endEpisodeNow(episode.id)
              navigate(`/day/${episode.date}`)
            }}
            className="flex min-h-24 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-2xl font-bold text-primary-foreground"
          >
            <Check className="size-7 shrink-0" />
            It's over
          </button>
        </div>
      </div>
    </Shell>
  )
}

/** No app chrome at all: no tab bar, no header, nothing to read past. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-safe min-h-svh bg-background px-4 pt-4">
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col">
        {children}
      </div>
    </div>
  )
}

/** The pain level as of the most recent reading, falling back to the peak. */
function currentLevel(episode: Episode): Intensity {
  const latest = [...episode.progression].sort((a, b) =>
    a.at.localeCompare(b.at),
  )[episode.progression.length - 1]
  return latest?.intensity ?? episode.intensity
}

function latestDose(episode: Episode): MedicationDose | undefined {
  return [...episode.medications].sort((a, b) =>
    a.takenAt.localeCompare(b.takenAt),
  )[episode.medications.length - 1]
}

/** "just now", "40 minutes ago", "3 hours ago" — no clock arithmetic needed. */
function describeElapsed(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (!Number.isFinite(minutes) || minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes} minutes ago`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) {
    if (rest === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
    return `${hours}h ${rest}m ago`
  }

  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}
