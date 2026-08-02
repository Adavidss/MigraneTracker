import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { subMonths } from 'date-fns'
import { FilterX, SearchX } from 'lucide-react'
import { allEpisodes, allMedications } from '@/lib/db'
import { hasAura } from '@/lib/episode'
import {
  EFFECTIVENESS_LABEL,
  EPISODE_TYPE_LABEL,
  INTENSITY_LABEL,
  type Effectiveness,
  type Episode,
  type EpisodeType,
  type Intensity,
} from '@/lib/types'
import { dateKey, formatDayShort, normalizeMedName } from '@/lib/utils'
import { useSettings } from '@/store/useSettings'
import { AppShell } from '@/components/app-shell'
import { EpisodeRow } from '@/components/episode-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Collapsible, EmptyState } from '@/components/ui/section'

interface Filters {
  from: string
  to: string
  type: EpisodeType | 'any'
  auraOnly: boolean
  medication: string
  minIntensity: Intensity | 0
  minEffectiveness: Effectiveness | 0
  text: string
}

const BLANK: Filters = {
  from: '',
  to: '',
  type: 'any',
  auraOnly: false,
  medication: '',
  minIntensity: 0,
  minEffectiveness: 0,
  text: '',
}

function applyFilters(episodes: Episode[], filters: Filters): Episode[] {
  const needle = filters.text.trim().toLowerCase()
  const med = filters.medication ? normalizeMedName(filters.medication) : ''

  return episodes.filter((episode) => {
    if (filters.from && episode.date < filters.from) return false
    if (filters.to && episode.date > filters.to) return false
    if (filters.type !== 'any' && episode.type !== filters.type) return false
    if (filters.auraOnly && !hasAura(episode)) return false
    if (filters.minIntensity && episode.intensity < filters.minIntensity) return false

    if (med && !episode.medications.some((d) => normalizeMedName(d.name) === med)) {
      return false
    }

    if (
      filters.minEffectiveness &&
      !episode.medications.some(
        (d) => (d.effectiveness ?? 0) >= filters.minEffectiveness,
      )
    ) {
      return false
    }

    if (needle) {
      const haystack = [
        episode.notes,
        episode.auraNotes,
        EPISODE_TYPE_LABEL[episode.type],
        ...episode.medications.map((d) => d.name),
        ...episode.progression.map((r) => r.note ?? ''),
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }

    return true
  })
}

export default function History() {
  const settings = useSettings()
  const episodes = useLiveQuery(allEpisodes, [])
  const presets = useLiveQuery(allMedications, []) ?? []
  const [filters, setFilters] = useState<Filters>(BLANK)

  const patch = (changes: Partial<Filters>) =>
    setFilters((current) => ({ ...current, ...changes }))

  const results = useMemo(
    () =>
      applyFilters(episodes ?? [], filters).sort((a, b) =>
        b.startTime.localeCompare(a.startTime),
      ),
    [episodes, filters],
  )

  const active =
    filters.from !== '' ||
    filters.to !== '' ||
    filters.type !== 'any' ||
    filters.auraOnly ||
    filters.medication !== '' ||
    filters.minIntensity !== 0 ||
    filters.minEffectiveness !== 0 ||
    filters.text !== ''

  const grouped = useMemo(() => {
    const map = new Map<string, Episode[]>()
    for (const episode of results) {
      const list = map.get(episode.date) ?? []
      list.push(episode)
      map.set(episode.date, list)
    }
    return [...map.entries()]
  }, [results])

  return (
    <AppShell
      title="History"
      subtitle={
        episodes === undefined
          ? undefined
          : `${results.length} of ${episodes.length} headaches`
      }
      actions={
        active ? (
          <Button variant="ghost" size="sm" onClick={() => setFilters(BLANK)}>
            <FilterX /> Clear
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        <Input
          type="search"
          value={filters.text}
          placeholder="Search notes and medications…"
          aria-label="Search notes and medications"
          onChange={(e) => patch({ text: e.target.value })}
        />

        <Collapsible
          title="Filters"
          summary={active ? 'Narrowed' : 'Showing everything'}
          defaultOpen={active}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={filters.from}
                    max={filters.to || dateKey()}
                    onChange={(e) => patch({ from: e.target.value })}
                  />
                )}
              </Field>
              <Field label="To">
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={filters.to}
                    min={filters.from || undefined}
                    max={dateKey()}
                    onChange={(e) => patch({ to: e.target.value })}
                  />
                )}
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { label: 'Last 30 days', months: 1 },
                  { label: 'Last 3 months', months: 3 },
                  { label: 'Last year', months: 12 },
                ] as const
              ).map((preset) => (
                <Button
                  key={preset.label}
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    patch({
                      from: dateKey(subMonths(new Date(), preset.months)),
                      to: dateKey(),
                    })
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                {(id) => (
                  <Select
                    id={id}
                    value={filters.type}
                    onChange={(e) =>
                      patch({ type: e.target.value as Filters['type'] })
                    }
                  >
                    <option value="any">Any type</option>
                    {(Object.keys(EPISODE_TYPE_LABEL) as EpisodeType[]).map((t) => (
                      <option key={t} value={t}>
                        {EPISODE_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Medication">
                {(id) => (
                  <Select
                    id={id}
                    value={filters.medication}
                    onChange={(e) => patch({ medication: e.target.value })}
                  >
                    <option value="">Any medication</option>
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.name}>
                        {preset.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Pain at least">
                {(id) => (
                  <Select
                    id={id}
                    value={String(filters.minIntensity)}
                    onChange={(e) =>
                      patch({
                        minIntensity: Number(e.target.value) as Filters['minIntensity'],
                      })
                    }
                  >
                    <option value="0">Any level</option>
                    {([1, 2, 3, 4, 5] as Intensity[]).map((level) => (
                      <option key={level} value={level}>
                        {level} — {INTENSITY_LABEL[level]} or worse
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Relief at least">
                {(id) => (
                  <Select
                    id={id}
                    value={String(filters.minEffectiveness)}
                    onChange={(e) =>
                      patch({
                        minEffectiveness: Number(
                          e.target.value,
                        ) as Filters['minEffectiveness'],
                      })
                    }
                  >
                    <option value="0">Any result</option>
                    {([1, 2, 3, 4, 5] as Effectiveness[]).map((score) => (
                      <option key={score} value={score}>
                        {EFFECTIVENESS_LABEL[score]} or better
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            <label className="flex min-h-11 items-center gap-3 text-[0.95rem]">
              <input
                type="checkbox"
                checked={filters.auraOnly}
                onChange={(e) => patch({ auraOnly: e.target.checked })}
                className="size-5 accent-[var(--color-primary)]"
              />
              With aura only
            </label>
          </div>
        </Collapsible>

        {episodes === undefined ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : !episodes.length ? (
          <EmptyState
            title="No headaches logged yet"
            description="Entries you record will be searchable here."
          />
        ) : !results.length ? (
          <EmptyState
            icon={SearchX}
            title="Nothing matches"
            description="Try widening the date range or clearing a filter."
            action={
              <Button variant="secondary" onClick={() => setFilters(BLANK)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="space-y-5">
            {grouped.map(([date, dayEpisodes]) => (
              <section key={date} className="space-y-2">
                <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {formatDayShort(date)}
                </h2>
                <div className="space-y-2">
                  {dayEpisodes.map((episode) => (
                    <EpisodeRow
                      key={episode.id}
                      episode={episode}
                      use24h={settings.use24HourTime}
                      href={`/day/${episode.date}`}
                    />
                  ))}
                </div>
              </section>
            ))}

            <Card className="p-3 text-center text-xs text-muted-foreground">
              Showing {results.length} headache{results.length === 1 ? '' : 's'}
              {active ? ' matching your filters' : ''}.
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  )
}
