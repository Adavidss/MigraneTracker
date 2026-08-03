import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronDown, ChevronLeft, Pill, SlidersHorizontal } from 'lucide-react'
import {
  addDoseNow,
  allMedications,
  endEpisodeNow,
  getOngoingEpisode,
  patchEpisode,
  setEpisodeIntensityNow,
} from '@/lib/db'
import {
  AURA_SYMPTOMS,
  EPISODE_TYPE_LABEL,
  INTENSITIES,
  INTENSITY_LABEL,
  INTENSITY_VAR,
  type AuraSymptom,
  type Episode,
  type EpisodeType,
  type Intensity,
  type MedicationDose,
  type MedicationPreset,
} from '@/lib/types'
import { cn, formatTime, normalizeMedName } from '@/lib/utils'
import { navigate } from '@/lib/router'
import { useSettings } from '@/store/useSettings'
import { ComfortControls } from '@/components/comfort'

/**
 * The screen for someone who is having a migraine right now.
 *
 * Everything here is shaped by what a migraine takes away. Light hurts, so it
 * is dark and dim-able. Reading is hard, so there is almost no text. Aim is
 * poor, so the targets are enormous. Concentration is gone, so the three
 * things that matter — how bad it is, a dose taken, it's over — are each a
 * single tap, and "it's over" is pinned to the bottom so it never scrolls away.
 *
 * Nothing here opens a form. The rest of the entry is reachable from the same
 * screen behind one tap, and can equally be left for later.
 */
export default function Attack() {
  const settings = useSettings()
  const episode = useLiveQuery(getOngoingEpisode, [])
  const presets = useLiveQuery(allMedications, []) ?? []
  const [elapsed, setElapsed] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)

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
        <p className="py-16 text-center text-lg text-muted-foreground">Loading…</p>
      </Shell>
    )
  }

  if (!episode) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
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

  const current = currentLevel(episode)
  const lastDose = latestDose(episode)

  return (
    <Shell>
      <div className="flex-1 space-y-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to the calendar"
            className="-ml-2 flex min-h-12 items-center gap-1 pr-3 pl-2 text-base text-muted-foreground"
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
                  style={active ? { backgroundColor: INTENSITY_VAR[level] } : undefined}
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

        {lastDose ? (
          <p className="text-center text-base text-muted-foreground">
            Last dose: <span className="font-semibold text-foreground">
              {lastDose.name}
            </span>
            , {describeElapsed(lastDose.takenAt)}
          </p>
        ) : null}

        {/* Every saved medication, most-used first. Each button carries its own
            last-dose time, so "can I take this again?" is answered by the
            button you are already looking at rather than by doing arithmetic. */}
        <div className="space-y-2">
          {presets.map((preset) => (
            <MedButton
              key={preset.id}
              preset={preset}
              episode={episode}
              use24h={settings.use24HourTime}
              onTake={() => addDoseNow(episode.id, preset)}
            />
          ))}
        </div>

        {/* The rest of the entry, without leaving this screen. */}
        <div className="overflow-hidden rounded-2xl border border-border">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="flex min-h-16 w-full items-center gap-3 px-4 text-left text-lg font-medium text-muted-foreground"
          >
            <SlidersHorizontal className="size-5 shrink-0" />
            <span className="flex-1">Add more</span>
            <ChevronDown
              className={cn('size-6 shrink-0', moreOpen && 'rotate-180')}
            />
          </button>

          {moreOpen ? (
            <div className="space-y-5 border-t border-border p-4">
              <Group label="What kind">
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(EPISODE_TYPE_LABEL) as EpisodeType[]).map((type) => (
                    <BigChip
                      key={type}
                      active={episode.type === type}
                      onClick={() => patchEpisode(episode.id, { type })}
                    >
                      {EPISODE_TYPE_LABEL[type]}
                    </BigChip>
                  ))}
                </div>
              </Group>

              <Group label="Aura">
                <div className="grid grid-cols-2 gap-2">
                  {AURA_SYMPTOMS.map((symptom) => {
                    const active = episode.auraSymptoms.includes(symptom.id)
                    return (
                      <BigChip
                        key={symptom.id}
                        active={active}
                        onClick={() => {
                          const next: AuraSymptom[] = active
                            ? episode.auraSymptoms.filter((s) => s !== symptom.id)
                            : [...episode.auraSymptoms, symptom.id]
                          patchEpisode(episode.id, {
                            auraSymptoms: next,
                            // Keep the type honest once aura is recorded.
                            type:
                              next.length && episode.type === 'migraine'
                                ? 'migraine-aura'
                                : episode.type,
                          })
                        }}
                      >
                        {symptom.label}
                      </BigChip>
                    )
                  })}
                </div>
              </Group>

              <Group label="Note">
                <textarea
                  rows={3}
                  defaultValue={episode.notes ?? ''}
                  placeholder="Anything worth remembering later…"
                  aria-label="Note"
                  onBlur={(e) =>
                    patchEpisode(episode.id, {
                      notes: e.target.value.trim() || undefined,
                    })
                  }
                  className="w-full rounded-xl border border-input bg-card p-3 text-base leading-relaxed focus:border-ring focus:outline-none"
                />
              </Group>

              <button
                type="button"
                onClick={() => navigate(`/log/${episode.id}`)}
                className="min-h-14 w-full rounded-xl border border-border text-base font-medium text-muted-foreground"
              >
                Open the full entry
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Pinned, so ending the attack is one tap no matter how far down the
          medication list runs. */}
      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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

function MedButton({
  preset,
  episode,
  use24h,
  onTake,
}: {
  preset: MedicationPreset
  episode: Episode
  use24h: boolean
  onTake: () => void
}) {
  const key = normalizeMedName(preset.name)
  const taken = episode.medications
    .filter((d) => normalizeMedName(d.name) === key)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
  const last = taken[taken.length - 1]

  // Spelled out, because the visible two-line label runs together when read
  // aloud: "Took Excedrin2 today".
  const spokenLabel = last
    ? `Take ${preset.name}. Last taken ${describeElapsed(last.takenAt)}${
        taken.length > 1 ? `, ${taken.length} doses so far` : ''
      }.`
    : `Take ${preset.name}. None taken yet.`

  return (
    <button
      type="button"
      onClick={onTake}
      aria-label={spokenLabel}
      className="flex min-h-18 w-full items-center gap-3 rounded-2xl bg-accent px-5 py-3 text-left text-accent-foreground"
    >
      <Pill className="size-6 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-semibold">Took {preset.name}</span>
        {last ? (
          <span className="mt-0.5 block text-base opacity-80">
            {taken.length > 1 ? `${taken.length} today · ` : ''}
            last {describeElapsed(last.takenAt)} at{' '}
            {formatTime(last.takenAt, use24h)}
          </span>
        ) : null}
      </span>
    </button>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-base font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function BigChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-14 rounded-xl px-3 text-base font-medium',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}

/** The pain level as of the most recent reading, falling back to the peak. */
function currentLevel(episode: Episode): Intensity {
  const readings = [...episode.progression].sort((a, b) =>
    a.at.localeCompare(b.at),
  )
  return readings[readings.length - 1]?.intensity ?? episode.intensity
}

function latestDose(episode: Episode): MedicationDose | undefined {
  const doses = [...episode.medications].sort((a, b) =>
    a.takenAt.localeCompare(b.takenAt),
  )
  return doses[doses.length - 1]
}

/** "just now", "40 minutes ago", "3h 20m ago" — no clock arithmetic needed. */
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
