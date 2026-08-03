import { CircleDot, Clock, Pencil, Pill, Sparkles } from 'lucide-react'
import {
  AURA_LABEL,
  EFFECTIVENESS_LABEL,
  EPISODE_TYPE_LABEL,
  HEAD_REGION_LABEL,
  INTENSITY_VAR,
  type Episode,
} from '@/lib/types'
import {
  buildEventTimeline,
  describeDose,
  episodeDurationMinutes,
  type EpisodeEvent,
} from '@/lib/episode'
import { cn, formatDuration, formatTime } from '@/lib/utils'
import { Link } from '@/lib/router'
import { Card } from './ui/card'
import { HeadGlyph, HeadMapPreview } from './head-map'
import { IntensityBadge } from './intensity'

const EVENT_COLOR: Record<EpisodeEvent['kind'], string> = {
  start: 'var(--color-muted-foreground)',
  reading: 'var(--color-primary)',
  dose: 'var(--color-accent-foreground)',
  relief: 'var(--color-pain-1)',
  end: 'var(--color-muted-foreground)',
}

/** Compact row for history lists and day summaries. */
export function EpisodeRow({
  episode,
  use24h,
  href,
}: {
  episode: Episode
  use24h: boolean
  href?: string
}) {
  const duration = formatDuration(episodeDurationMinutes(episode))
  const className = cn(
    'flex items-center gap-3 rounded-2xl border border-border bg-card p-3',
    href && 'transition-colors hover:bg-muted',
  )

  const body = (
    <>
      <HeadGlyph
        points={episode.painMap}
        fallback={episode.intensity}
        size={34}
        className="shrink-0 text-muted-foreground"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-medium">
            {EPISODE_TYPE_LABEL[episode.type]}
          </span>
          <IntensityBadge intensity={episode.intensity} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatTime(episode.startTime, use24h)}
          {episode.endTime ? ` – ${formatTime(episode.endTime, use24h)}` : ' · ongoing'}
          {duration ? ` · ${duration}` : ''}
          {episode.medications.length
            ? ` · ${episode.medications.length} dose${episode.medications.length === 1 ? '' : 's'}`
            : ''}
        </p>
      </div>
    </>
  )

  return href ? (
    <Link to={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** Everything recorded for one episode. */
export function EpisodeDetail({
  episode,
  use24h,
  editable = true,
  className,
}: {
  episode: Episode
  use24h: boolean
  editable?: boolean
  className?: string
}) {
  const events = buildEventTimeline(episode)
  const duration = formatDuration(episodeDurationMinutes(episode))
  const regions = episode.painMap
    .slice()
    .sort((a, b) => b.intensity - a.intensity)
    .map((p) => HEAD_REGION_LABEL[p.region])

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">
              {EPISODE_TYPE_LABEL[episode.type]}
            </h3>
            <IntensityBadge intensity={episode.intensity} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {formatTime(episode.startTime, use24h)}
            {episode.endTime
              ? ` – ${formatTime(episode.endTime, use24h)}`
              : ' · still going'}
            {duration ? <span>· {duration}</span> : null}
          </p>
        </div>
        {editable ? (
          <Link
            to={`/log/${episode.id}`}
            aria-label="Edit this entry"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground print:hidden"
          >
            <Pencil className="size-4" />
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[9rem_1fr]">
        <div className="mx-auto w-36 sm:mx-0">
          <HeadMapPreview points={episode.painMap} />
        </div>

        <div className="space-y-4">
          {regions.length ? (
            <div>
              <SectionLabel>Pain location</SectionLabel>
              <p className="text-sm">{regions.join(', ')}</p>
            </div>
          ) : null}

          {episode.auraSymptoms.length || episode.auraNotes ? (
            <div>
              <SectionLabel>
                <Sparkles className="mr-1 inline size-3" />
                Aura
              </SectionLabel>
              <p className="text-sm">
                {episode.auraSymptoms.map((s) => AURA_LABEL[s]).join(', ') || '—'}
              </p>
              {episode.auraNotes ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {episode.auraNotes}
                </p>
              ) : null}
            </div>
          ) : null}

          {episode.medications.length ? (
            <div>
              <SectionLabel>
                <Pill className="mr-1 inline size-3" />
                Medication
              </SectionLabel>
              <ul className="space-y-1.5">
                {episode.medications.map((dose) => (
                  <li key={dose.id} className="text-sm">
                    <span className="font-medium">{describeDose(dose)}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      at {formatTime(dose.takenAt, use24h)}
                    </span>
                    {dose.effectiveness ? (
                      <span className="text-muted-foreground">
                        {' · '}
                        {EFFECTIVENESS_LABEL[dose.effectiveness]}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {episode.notes ? (
            <div>
              <SectionLabel>Notes</SectionLabel>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {episode.notes}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {events.length > 1 ? (
        <div className="border-t border-border p-4">
          <SectionLabel>How it went</SectionLabel>
          <EventTimeline events={events} use24h={use24h} />
        </div>
      ) : null}
    </Card>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </div>
  )
}

/** Vertical list of moments — the per-episode view of the timeline feature. */
export function EventTimeline({
  events,
  use24h,
  className,
}: {
  events: EpisodeEvent[]
  use24h: boolean
  className?: string
}) {
  return (
    <ol className={cn('relative space-y-3 pl-5', className)}>
      <span
        className="absolute top-1.5 bottom-1.5 left-[0.3rem] w-px bg-border"
        aria-hidden
      />
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className="absolute top-1 -left-[1.05rem] size-2.5 rounded-full ring-2 ring-card"
            style={{
              backgroundColor: event.intensity
                ? INTENSITY_VAR[event.intensity]
                : EVENT_COLOR[event.kind],
            }}
            aria-hidden
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {formatTime(event.at, use24h)}
            </span>
            <span className="text-sm">{event.label}</span>
          </div>
          {event.detail ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

export function NoHeadacheCard({ note }: { note?: string }) {
  return (
    <Card className="flex items-center gap-3 border-transparent bg-clear p-4 text-clear-foreground">
      <CircleDot className="size-5 shrink-0" />
      <div>
        <p className="text-base font-medium">No headache</p>
        {note ? <p className="mt-0.5 text-sm opacity-80">{note}</p> : null}
      </div>
    </Card>
  )
}
