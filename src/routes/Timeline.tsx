import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, subDays, subMonths, subYears } from 'date-fns'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { episodesInRange } from '@/lib/db'
import { buildEventTimeline, intensityAt, type EpisodeEvent } from '@/lib/episode'
import {
  EPISODE_TYPE_LABEL,
  INTENSITY_VAR,
  INTENSITY_LABEL,
  type Episode,
  type Intensity,
  type PainPoint,
} from '@/lib/types'
import {
  clampIntensity,
  dateKey,
  formatDayLong,
  formatTime,
} from '@/lib/utils'
import { useSettings } from '@/store/useSettings'
import { AppShell } from '@/components/app-shell'
import { HeadMapPreview } from '@/components/head-map'
import { EventTimeline } from '@/components/episode-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, Section } from '@/components/ui/section'
import { Segmented } from '@/components/ui/field'

type Window = 'week' | 'month' | 'year' | 'all'

const WINDOWS: { value: Window; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
]

function windowStart(window: Window): string {
  const now = new Date()
  switch (window) {
    case 'week':
      return dateKey(subDays(now, 6))
    case 'month':
      return dateKey(subMonths(now, 1))
    case 'year':
      return dateKey(subYears(now, 1))
    case 'all':
      return '0000-01-01'
  }
}

interface Frame {
  key: string
  at: string
  episode: Episode
  event: EpisodeEvent
  intensity: Intensity
  points: PainPoint[]
}

/**
 * Every recorded moment in the window, in order. Each event of each episode
 * becomes a frame, so scrubbing plays back how the pain actually moved rather
 * than just stepping between entries.
 */
function buildFrames(episodes: Episode[]): Frame[] {
  const frames: Frame[] = []

  for (const episode of episodes) {
    for (const event of buildEventTimeline(episode)) {
      const level = intensityAt(episode, new Date(event.at)) ?? episode.intensity
      // Shift the whole map by how far the pain has moved from its peak, so
      // regions keep their relative severity while the level animates.
      const delta = level - episode.intensity
      frames.push({
        key: `${episode.id}-${event.id}`,
        at: event.at,
        episode,
        event,
        intensity: level,
        points: episode.painMap.map((p) => ({
          region: p.region,
          intensity: clampIntensity(p.intensity + delta),
        })),
      })
    }
  }

  return frames.sort((a, b) => a.at.localeCompare(b.at))
}

export default function Timeline() {
  const settings = useSettings()
  const [window, setWindow] = useState<Window>('month')
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  const from = windowStart(window)
  const to = dateKey()
  const episodes = useLiveQuery(() => episodesInRange(from, to), [from, to])

  const frames = useMemo(() => buildFrames(episodes ?? []), [episodes])
  const total = frames.length

  // Land on the most recent moment whenever the window changes.
  const lastWindow = useRef(window)
  useEffect(() => {
    if (lastWindow.current !== window) {
      lastWindow.current = window
      setPlaying(false)
    }
    setIndex(total ? total - 1 : 0)
  }, [window, total])

  useEffect(() => {
    if (!playing || total === 0) return
    const timer = setInterval(() => {
      setIndex((current) => {
        if (current >= total - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 900)
    return () => clearInterval(timer)
  }, [playing, total])

  const frame = frames[Math.min(index, Math.max(total - 1, 0))]

  const play = () => {
    if (!total) return
    // Restarting from the end should replay from the beginning.
    if (index >= total - 1) setIndex(0)
    setPlaying(true)
  }

  return (
    <AppShell
      title="Timeline"
      subtitle="Play back how your headaches unfolded"
    >
      <div className="space-y-5">
        <Segmented
          ariaLabel="Time range"
          value={window}
          onChange={(next) => setWindow(next)}
          options={WINDOWS}
        />

        {episodes === undefined ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : !frame ? (
          <EmptyState
            title="Nothing to play back yet"
            description="Once you have logged a headache, this becomes a time-lapse of how it developed."
          />
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {formatDayLong(frame.episode.date)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(frame.at, settings.use24HourTime)} ·{' '}
                    {EPISODE_TYPE_LABEL[frame.episode.type]}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: INTENSITY_VAR[frame.intensity] }}
                >
                  {frame.intensity} · {INTENSITY_LABEL[frame.intensity]}
                </span>
              </div>

              <div className="flex flex-col items-center gap-3 p-4">
                <div className="w-full max-w-64">
                  {/* Keying on the frame remounts the node, replaying the
                      CSS fade so each step of the playback registers. */}
                  <div key={frame.key} className="animate-fade-in">
                    <HeadMapPreview points={frame.points} />
                  </div>
                </div>

                <p className="text-center text-sm">
                  <span className="font-medium">{frame.event.label}</span>
                  {frame.event.detail ? (
                    <span className="block text-xs text-muted-foreground">
                      {frame.event.detail}
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="space-y-3 border-t border-border p-4">
                <input
                  type="range"
                  min={0}
                  max={Math.max(total - 1, 0)}
                  value={Math.min(index, total - 1)}
                  aria-label="Scrub through time"
                  onChange={(e) => {
                    setPlaying(false)
                    setIndex(Number(e.target.value))
                  }}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                />

                <div className="flex items-center justify-between">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {index + 1} / {total}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label="Previous moment"
                      disabled={index === 0}
                      onClick={() => {
                        setPlaying(false)
                        setIndex((i) => Math.max(0, i - 1))
                      }}
                    >
                      <SkipBack />
                    </Button>
                    <Button
                      size="icon"
                      aria-label={playing ? 'Pause' : 'Play'}
                      onClick={() => (playing ? setPlaying(false) : play())}
                    >
                      {playing ? <Pause /> : <Play />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label="Next moment"
                      disabled={index >= total - 1}
                      onClick={() => {
                        setPlaying(false)
                        setIndex((i) => Math.min(total - 1, i + 1))
                      }}
                    >
                      <SkipForward />
                    </Button>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {format(new Date(frame.at), 'd MMM')}
                  </span>
                </div>
              </div>
            </Card>

            <Section
              title="This headache"
              description={`${EPISODE_TYPE_LABEL[frame.episode.type]} on ${formatDayLong(frame.episode.date)}`}
            >
              <Card className="p-4">
                <EventTimeline
                  events={buildEventTimeline(frame.episode)}
                  use24h={settings.use24HourTime}
                />
              </Card>
            </Section>

            <FrameStrip
              frames={frames}
              index={index}
              onSelect={(next) => {
                setPlaying(false)
                setIndex(next)
              }}
            />
          </>
        )}
      </div>
    </AppShell>
  )
}

/** Every frame as a colour bar, giving the window's shape at a glance. */
function FrameStrip({
  frames,
  index,
  onSelect,
}: {
  frames: Frame[]
  index: number
  onSelect: (index: number) => void
}) {
  return (
    <Section title="Whole range" description={`${frames.length} recorded moments`}>
      <div className="no-scrollbar flex items-end gap-0.5 overflow-x-auto rounded-2xl border border-border bg-card p-3">
        {frames.map((frame, i) => (
          <button
            key={frame.key}
            type="button"
            aria-label={`${formatDayLong(frame.episode.date)}, level ${frame.intensity}`}
            aria-current={i === index}
            onClick={() => onSelect(i)}
            className="w-1.5 shrink-0 rounded-full transition-opacity"
            style={{
              height: `${12 + frame.intensity * 7}px`,
              backgroundColor: INTENSITY_VAR[frame.intensity],
              opacity: i === index ? 1 : 0.4,
            }}
          />
        ))}
      </div>
    </Section>
  )
}
