import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Pill, Plus, Trash2, X } from 'lucide-react'
import {
  allMedications,
  deleteEpisode,
  getEpisode,
  saveEpisode,
} from '@/lib/db'
import {
  AURA_SYMPTOMS,
  DOSE_UNITS,
  EFFECTIVENESS_LABEL,
  EPISODE_TYPE_LABEL,
  type AuraSymptom,
  type DoseUnit,
  type Effectiveness,
  type Episode,
  type EpisodeType,
  type Intensity,
  type PainPoint,
  type Settings,
} from '@/lib/types'
import {
  dateKey,
  fromDateAndTimeInput,
  toTimeInput,
  uid,
} from '@/lib/utils'
import { back, navigate } from '@/lib/router'
import { useSettingsQuery } from '@/store/useSettings'
import { toast } from '@/store/useToast'
import { AppShell } from '@/components/app-shell'
import { HeadMap } from '@/components/head-map'
import { IntensityPicker } from '@/components/intensity'
import { Button } from '@/components/ui/button'
import { Field, Input, Label, Select, Textarea } from '@/components/ui/field'
import { ChipGroup, ChipToggles, Collapsible, Section } from '@/components/ui/section'
import { ConfirmModal } from '@/components/ui/modal'

interface DoseForm {
  id: string
  name: string
  amount: string
  unit: DoseUnit
  time: string
  effectiveness?: Effectiveness
  reliefTime: string
}

interface ReadingForm {
  id: string
  time: string
  intensity: Intensity
  note: string
}

interface FormState {
  date: string
  startTime: string
  ongoing: boolean
  endTime: string
  type: EpisodeType
  intensity: Intensity
  painMap: PainPoint[]
  auraSymptoms: AuraSymptom[]
  auraNotes: string
  medications: DoseForm[]
  progression: ReadingForm[]
  notes: string
}

function nowTime(): string {
  return toTimeInput(new Date().toISOString())
}

function blankForm(settings: Settings, day?: string): FormState {
  return {
    date: day ?? dateKey(),
    startTime: nowTime(),
    ongoing: true,
    endTime: '',
    type: settings.defaultType,
    intensity: 3,
    // Pre-selecting the usual location removes the most repetitive tap.
    painMap: settings.defaultRegions.map((region) => ({ region, intensity: 3 })),
    auraSymptoms: [],
    auraNotes: '',
    medications: [],
    progression: [],
    notes: '',
  }
}

function fromEpisode(episode: Episode): FormState {
  return {
    date: episode.date,
    startTime: toTimeInput(episode.startTime),
    ongoing: !episode.endTime,
    endTime: episode.endTime ? toTimeInput(episode.endTime) : '',
    type: episode.type,
    intensity: episode.intensity,
    painMap: episode.painMap,
    auraSymptoms: episode.auraSymptoms,
    auraNotes: episode.auraNotes ?? '',
    medications: episode.medications.map((dose) => ({
      id: dose.id,
      name: dose.name,
      amount: String(dose.amount),
      unit: dose.unit,
      time: toTimeInput(dose.takenAt),
      effectiveness: dose.effectiveness,
      reliefTime: dose.reliefAt ? toTimeInput(dose.reliefAt) : '',
    })),
    progression: episode.progression.map((reading) => ({
      id: reading.id,
      time: toTimeInput(reading.at),
      intensity: reading.intensity,
      note: reading.note ?? '',
    })),
    notes: episode.notes ?? '',
  }
}

/**
 * Turns an `HH:mm` field into a timestamp. Headaches routinely run past
 * midnight, so a time that lands before the episode began is read as the
 * following day rather than rejected.
 */
function resolveTime(day: string, value: string, notBefore?: string): string {
  const iso = fromDateAndTimeInput(day, value)
  if (notBefore && iso < notBefore) {
    const rolled = new Date(iso)
    rolled.setDate(rolled.getDate() + 1)
    return rolled.toISOString()
  }
  return iso
}

export default function LogEpisode({ episodeId }: { episodeId?: string }) {
  const settings = useSettingsQuery()
  const existing = useLiveQuery(
    () => (episodeId ? getEpisode(episodeId) : Promise.resolve(undefined)),
    [episodeId],
  )
  const presets = useLiveQuery(allMedications, []) ?? []

  const [form, setForm] = useState<FormState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  // Seed the form once the stored values it depends on have loaded.
  useEffect(() => {
    if (form || !settings) return
    if (episodeId) {
      if (existing) setForm(fromEpisode(existing))
      return
    }
    const requestedDay = new URLSearchParams(
      window.location.hash.split('?')[1] ?? '',
    ).get('date')
    setForm(blankForm(settings, requestedDay ?? undefined))
  }, [form, settings, episodeId, existing])

  const patch = (changes: Partial<FormState>) =>
    setForm((current) => (current ? { ...current, ...changes } : current))

  /** Peak severity across the headline level, the map and every reading. */
  const peak = useMemo<Intensity>(() => {
    if (!form) return 3
    const values: number[] = [
      form.intensity,
      ...form.painMap.map((p) => p.intensity),
      ...form.progression.map((r) => r.intensity),
    ]
    return Math.max(...values) as Intensity
  }, [form])

  if (!form) {
    return (
      <AppShell title={episodeId ? 'Edit headache' : 'Log headache'} hideNav>
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    )
  }

  const addDose = (name: string, amount: number, unit: DoseUnit) => {
    patch({
      medications: [
        ...form.medications,
        {
          id: uid(),
          name,
          amount: String(amount),
          unit,
          time: nowTime(),
          reliefTime: '',
        },
      ],
    })
  }

  const updateDose = (id: string, changes: Partial<DoseForm>) =>
    patch({
      medications: form.medications.map((dose) =>
        dose.id === id ? { ...dose, ...changes } : dose,
      ),
    })

  const removeDose = (id: string) =>
    patch({ medications: form.medications.filter((dose) => dose.id !== id) })

  const handleSave = async () => {
    setSaving(true)
    try {
      const startIso = resolveTime(form.date, form.startTime)
      const endIso =
        !form.ongoing && form.endTime
          ? resolveTime(form.date, form.endTime, startIso)
          : undefined

      await saveEpisode({
        id: episodeId,
        createdAt: existing?.createdAt,
        date: form.date,
        startTime: startIso,
        endTime: endIso,
        type: form.type,
        intensity: peak,
        painMap: form.painMap,
        auraSymptoms: form.auraSymptoms,
        auraNotes: form.auraNotes.trim() || undefined,
        medications: form.medications
          .filter((dose) => dose.name.trim())
          .map((dose) => {
            const takenAt = resolveTime(form.date, dose.time, startIso)
            return {
              id: dose.id,
              name: dose.name.trim(),
              amount: Number.parseFloat(dose.amount) || 0,
              unit: dose.unit,
              takenAt,
              effectiveness: dose.effectiveness,
              reliefAt: dose.reliefTime
                ? resolveTime(form.date, dose.reliefTime, takenAt)
                : undefined,
            }
          }),
        progression: form.progression.map((reading) => ({
          id: reading.id,
          at: resolveTime(form.date, reading.time, startIso),
          intensity: reading.intensity,
          note: reading.note.trim() || undefined,
        })),
        notes: form.notes.trim() || undefined,
      })

      toast.success(episodeId ? 'Headache updated' : 'Headache logged')
      navigate(`/day/${form.date}`, { replace: true })
    } catch (error) {
      console.error(error)
      toast.error('Could not save. Your data was not changed.')
    } finally {
      setSaving(false)
    }
  }

  const medSummary = form.medications.length
    ? form.medications
        .filter((d) => d.name.trim())
        .map((d) => d.name.trim())
        .join(', ')
    : 'None logged'

  return (
    <AppShell
      hideNav
      title={episodeId ? 'Edit headache' : 'Log headache'}
      subtitle={episodeId ? undefined : 'Only the pain level is required'}
      actions={
        <Button variant="ghost" size="iconSm" onClick={back} aria-label="Close">
          <X />
        </Button>
      }
    >
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={back}
          className="-ml-2 -mt-1 text-muted-foreground"
        >
          <ArrowLeft /> Back
        </Button>

        <Section title="How bad is it?">
          <IntensityPicker
            value={form.intensity}
            onChange={(intensity) => patch({ intensity })}
          />
        </Section>

        <Section
          title="Where does it hurt?"
          description="Tap to mark a region at the pain level above. Tap again to clear it."
        >
          <HeadMap
            points={form.painMap}
            brush={form.intensity}
            onChange={(painMap) => patch({ painMap })}
            className="mx-auto max-w-sm"
          />
          {form.painMap.length ? (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => patch({ painMap: [] })}
              >
                Clear map
              </Button>
            </div>
          ) : null}
        </Section>

        <Section title="Type">
          <ChipGroup
            ariaLabel="Headache type"
            value={form.type}
            onChange={(type) => patch({ type })}
            options={(
              Object.keys(EPISODE_TYPE_LABEL) as EpisodeType[]
            ).map((value) => ({ value, label: EPISODE_TYPE_LABEL[value] }))}
          />
        </Section>

        <Section title="When">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={form.date}
                  max={dateKey()}
                  onChange={(e) => patch({ date: e.target.value })}
                />
              )}
            </Field>
            <Field label="Started">
              {(id) => (
                <Input
                  id={id}
                  type="time"
                  value={form.startTime}
                  onChange={(e) => patch({ startTime: e.target.value })}
                />
              )}
            </Field>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <ChipGroup
              ariaLabel="Is it over?"
              value={form.ongoing ? 'ongoing' : 'ended'}
              onChange={(value) =>
                patch({
                  ongoing: value === 'ongoing',
                  endTime:
                    value === 'ended' && !form.endTime ? nowTime() : form.endTime,
                })
              }
              options={[
                { value: 'ongoing', label: 'Still going' },
                { value: 'ended', label: 'It ended' },
              ]}
            />
            {!form.ongoing ? (
              <Field label="Ended" className="min-w-32 flex-1">
                {(id) => (
                  <Input
                    id={id}
                    type="time"
                    value={form.endTime}
                    onChange={(e) => patch({ endTime: e.target.value })}
                  />
                )}
              </Field>
            ) : null}
          </div>
        </Section>

        <Section title="Medication" description="Tap one to add it at the current time.">
          <div className="flex flex-wrap gap-2">
            {presets.slice(0, 8).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  addDose(preset.name, preset.defaultAmount, preset.defaultUnit)
                }
                className="flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Plus className="size-3.5 text-muted-foreground" />
                {preset.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addDose('', 1, 'tablets')}
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <Pill className="size-3.5" />
              Other
            </button>
          </div>

          {form.medications.length ? (
            <ul className="space-y-2">
              {form.medications.map((dose) => (
                <li
                  key={dose.id}
                  className="space-y-3 rounded-2xl border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={dose.name}
                      placeholder="Medication name"
                      list="medication-presets"
                      aria-label="Medication name"
                      onChange={(e) => updateDose(dose.id, { name: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label={`Remove ${dose.name || 'medication'}`}
                      onClick={() => removeDose(dose.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={dose.amount}
                      aria-label="Dose amount"
                      onChange={(e) => updateDose(dose.id, { amount: e.target.value })}
                    />
                    <Select
                      value={dose.unit}
                      aria-label="Dose unit"
                      onChange={(e) =>
                        updateDose(dose.id, { unit: e.target.value as DoseUnit })
                      }
                    >
                      {DOSE_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="time"
                      value={dose.time}
                      aria-label="Time taken"
                      onChange={(e) => updateDose(dose.id, { time: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Did it help?</Label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {([1, 2, 3, 4, 5] as Effectiveness[]).map((score) => {
                        const active = dose.effectiveness === score
                        return (
                          <button
                            key={score}
                            type="button"
                            aria-pressed={active}
                            title={EFFECTIVENESS_LABEL[score]}
                            onClick={() =>
                              updateDose(dose.id, {
                                effectiveness: active ? undefined : score,
                              })
                            }
                            className={
                              active
                                ? 'min-h-10 rounded-lg bg-primary text-sm font-semibold text-primary-foreground'
                                : 'min-h-10 rounded-lg bg-muted text-sm font-medium text-muted-foreground hover:brightness-95'
                            }
                          >
                            {score}
                          </button>
                        )
                      })}
                    </div>
                    {dose.effectiveness ? (
                      <p className="text-xs text-muted-foreground">
                        {EFFECTIVENESS_LABEL[dose.effectiveness]}
                      </p>
                    ) : null}
                  </div>

                  {dose.effectiveness && dose.effectiveness > 1 ? (
                    <Field
                      label="Relief felt at"
                      hint="Optional — used to work out how quickly it acts."
                    >
                      {(id) => (
                        <Input
                          id={id}
                          type="time"
                          value={dose.reliefTime}
                          onChange={(e) =>
                            updateDose(dose.id, { reliefTime: e.target.value })
                          }
                        />
                      )}
                    </Field>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <datalist id="medication-presets">
            {presets.map((preset) => (
              <option key={preset.id} value={preset.name} />
            ))}
          </datalist>
        </Section>

        <Collapsible
          title="Aura"
          summary={
            form.auraSymptoms.length
              ? `${form.auraSymptoms.length} symptom${form.auraSymptoms.length === 1 ? '' : 's'}`
              : 'None'
          }
          defaultOpen={form.auraSymptoms.length > 0}
        >
          <div className="space-y-3">
            <ChipToggles
              ariaLabel="Aura symptoms"
              values={form.auraSymptoms}
              onChange={(auraSymptoms) => {
                patch({
                  auraSymptoms,
                  // Keep the type honest when aura is recorded on a migraine.
                  type:
                    auraSymptoms.length && form.type === 'migraine'
                      ? 'migraine-aura'
                      : form.type,
                })
              }}
              options={AURA_SYMPTOMS.map((s) => ({ id: s.id, label: s.label }))}
            />
            <Field label="Aura notes">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={form.auraNotes}
                  placeholder="Anything worth describing…"
                  onChange={(e) => patch({ auraNotes: e.target.value })}
                />
              )}
            </Field>
          </div>
        </Collapsible>

        <Collapsible
          title="Pain over time"
          summary={
            form.progression.length
              ? `${form.progression.length} reading${form.progression.length === 1 ? '' : 's'}`
              : 'Add readings to chart how it developed'
          }
          defaultOpen={form.progression.length > 0}
        >
          <div className="space-y-3">
            {form.progression.length ? (
              <ul className="space-y-2">
                {form.progression.map((reading) => (
                  <li key={reading.id} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={reading.time}
                      aria-label="Reading time"
                      className="w-32"
                      onChange={(e) =>
                        patch({
                          progression: form.progression.map((r) =>
                            r.id === reading.id ? { ...r, time: e.target.value } : r,
                          ),
                        })
                      }
                    />
                    <Select
                      value={String(reading.intensity)}
                      aria-label="Pain level"
                      onChange={(e) =>
                        patch({
                          progression: form.progression.map((r) =>
                            r.id === reading.id
                              ? {
                                  ...r,
                                  intensity: Number(e.target.value) as Intensity,
                                }
                              : r,
                          ),
                        })
                      }
                    >
                      {[1, 2, 3, 4, 5].map((level) => (
                        <option key={level} value={level}>
                          Level {level}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label="Remove reading"
                      onClick={() =>
                        patch({
                          progression: form.progression.filter(
                            (r) => r.id !== reading.id,
                          ),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                patch({
                  progression: [
                    ...form.progression,
                    {
                      id: uid(),
                      time: nowTime(),
                      intensity: form.intensity,
                      note: '',
                    },
                  ],
                })
              }
            >
              <Plus /> Add reading
            </Button>
          </div>
        </Collapsible>

        <Collapsible title="Notes" summary={form.notes || 'None'}>
          <Textarea
            rows={4}
            value={form.notes}
            placeholder="Triggers, context, anything to mention to your doctor…"
            aria-label="Notes"
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </Collapsible>

        {peak !== form.intensity ? (
          <p className="text-center text-xs text-muted-foreground">
            Peak pain will be recorded as {peak}, the worst level marked anywhere on
            this entry.
          </p>
        ) : null}

        {/* Reachable from anywhere in the form without scrolling to the end. */}
        <div className="sticky bottom-0 z-20 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pt-6 pb-4">
          <Button
            size="lg"
            block
            onClick={handleSave}
            disabled={saving}
            className="shadow-lg shadow-primary/20"
          >
            {saving ? 'Saving…' : episodeId ? 'Save changes' : 'Save headache'}
          </Button>
        </div>

        {episodeId ? (
          <>
            <Button
              variant="ghost"
              block
              className="text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> Delete this entry
            </Button>
            <ConfirmModal
              open={confirmDelete}
              onClose={() => setConfirmDelete(false)}
              onConfirm={async () => {
                await deleteEpisode(episodeId)
                toast.info('Entry deleted')
                navigate(`/day/${form.date}`, { replace: true })
              }}
              title="Delete this headache?"
              description="This removes the entry and everything logged with it. It cannot be undone."
              confirmLabel="Delete"
              destructive
            />
          </>
        ) : null}

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Medication logged: {medSummary}
        </p>
      </div>
    </AppShell>
  )
}
