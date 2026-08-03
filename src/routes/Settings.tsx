import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Download,
  HardDriveDownload,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  addMedicationPreset,
  allDayLogs,
  allEpisodes,
  allMedications,
  clearAllData,
  getSettings,
  mergeData,
  replaceAllData,
  deleteMedicationPreset,
  setMedicationClass,
  updateSettings,
} from '@/lib/db'
import { buildBackup, downloadBackup, parseBackup } from '@/lib/export'
import {
  DOSE_UNITS,
  EPISODE_TYPE_LABEL,
  guessMedicationClass,
  HEAD_REGIONS,
  MEDICATION_CLASS_LABEL,
  OVERUSE_THRESHOLD_DAYS,
  type DoseUnit,
  type EpisodeType,
  type HeadRegionId,
  type MedicationClass,
  type ThemePreference,
} from '@/lib/types'
import { useSettings } from '@/store/useSettings'
import { toast } from '@/store/useToast'
import { AppShell } from '@/components/app-shell'
import { ComfortControls } from '@/components/comfort'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { ChipGroup, ChipToggles, Collapsible, Section } from '@/components/ui/section'
import { ConfirmModal } from '@/components/ui/modal'

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

/**
 * iOS never fires an install prompt, so on iPhone the only way to get the app
 * onto the home screen is to tell people where the button is. Hidden once the
 * app is already running standalone.
 */
function InstallHint() {
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // Safari's own flag, which predates display-mode.
      (window.navigator as { standalone?: boolean }).standalone === true)

  if (standalone) return null

  const isIos =
    typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <Card className="flex gap-3 p-4">
      <Smartphone className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 text-sm leading-relaxed">
        <p className="font-medium">Add it to your home screen</p>
        <p className="mt-1 text-muted-foreground">
          {isIos ? (
            <>
              Tap the Share button in Safari, then <b>Add to Home Screen</b>. It
              opens full screen, works offline, and keeps your journal in one
              place.
            </>
          ) : (
            <>
              Use your browser’s install or “Add to Home Screen” option. The app
              then opens full screen and works offline.
            </>
          )}
        </p>
      </div>
    </Card>
  )
}

export default function Settings() {
  const settings = useSettings()
  const medications = useLiveQuery(allMedications, []) ?? []
  const episodes = useLiveQuery(allEpisodes, [])
  const dayLogs = useLiveQuery(allDayLogs, [])

  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<{
    text: string
    episodes: number
  } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [newMed, setNewMed] = useState({ name: '', amount: '400', unit: 'mg' as DoseUnit })

  const exportBackup = async () => {
    const current = await getSettings()
    downloadBackup(
      buildBackup(episodes ?? [], dayLogs ?? [], medications, current),
    )
    toast.success('Backup downloaded')
  }

  const readFile = async (file: File) => {
    try {
      const text = await file.text()
      const backup = parseBackup(text)
      setPendingImport({ text, episodes: backup.episodes.length })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read that file.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const runImport = async (mode: 'merge' | 'replace') => {
    if (!pendingImport) return
    try {
      const backup = parseBackup(pendingImport.text)
      if (mode === 'replace') {
        await replaceAllData(backup)
        toast.success(`Restored ${backup.episodes.length} headaches`)
      } else {
        const added = await mergeData(backup)
        toast.success(
          `Added ${added.episodes} headache${added.episodes === 1 ? '' : 's'} and ${added.dayLogs} clear day${added.dayLogs === 1 ? '' : 's'}`,
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      setPendingImport(null)
    }
  }

  return (
    <AppShell title="Settings">
      <div className="space-y-6">
        <Card className="flex gap-3 border-transparent bg-accent p-4 text-accent-foreground">
          <ShieldCheck className="size-5 shrink-0" />
          <p className="text-sm leading-relaxed">
            Everything you log stays in this browser on this device. There is no
            account, no server and no analytics. Clearing your browser data will
            delete it, so keep a backup.
          </p>
        </Card>

        <InstallHint />

        <Section
          title="Comfort"
          description="For using the app during an attack. Also on the attack screen itself."
        >
          <ComfortControls settings={settings} compact />
          <Card className="divide-y divide-border px-3">
            <Switch
              label="Reduce motion"
              description="Removes every animation and transition"
              checked={settings.reduceMotion}
              onCheckedChange={(reduceMotion) => updateSettings({ reduceMotion })}
            />
          </Card>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dimming goes darker than your phone’s own brightness slider allows.
            It stays on until you turn it down, so remember it is there if the
            screen looks wrong later.
          </p>
        </Section>

        <Section title="Appearance">
          <ChipGroup
            ariaLabel="Theme"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={THEMES.map((t) => ({ value: t.value, label: t.label }))}
          />
          <Card className="px-3 py-1">
            <Switch
              label="24-hour time"
              description="Show 14:30 instead of 2:30 PM"
              checked={settings.use24HourTime}
              onCheckedChange={(use24HourTime) => updateSettings({ use24HourTime })}
            />
          </Card>
        </Section>

        <Section
          title="Logging defaults"
          description="What a new entry starts with, so the common case takes one tap."
        >
          <Field label="Headache type">
            {() => (
              <ChipGroup
                ariaLabel="Default headache type"
                value={settings.defaultType}
                onChange={(defaultType) => updateSettings({ defaultType })}
                options={(
                  Object.keys(EPISODE_TYPE_LABEL) as EpisodeType[]
                ).map((value) => ({ value, label: EPISODE_TYPE_LABEL[value] }))}
              />
            )}
          </Field>

          <Field
            label="Usual pain location"
            hint="Pre-selected on the head map for every new entry."
          >
            {() => (
              <ChipToggles
                ariaLabel="Default pain regions"
                values={settings.defaultRegions}
                onChange={(defaultRegions) =>
                  updateSettings({ defaultRegions: defaultRegions as HeadRegionId[] })
                }
                options={HEAD_REGIONS.map((r) => ({ id: r.id, label: r.label }))}
              />
            )}
          </Field>
        </Section>

        <Section title="Doctor report">
          <Field
            label="Name on the report"
            hint="Optional. Only ever appears on summaries you export or print yourself."
          >
            {(id) => (
              <Input
                id={id}
                value={settings.patientName ?? ''}
                placeholder="Your name"
                onChange={(e) =>
                  updateSettings({ patientName: e.target.value || undefined })
                }
              />
            )}
          </Field>
        </Section>

        <Collapsible
          title="Medications"
          summary={`${medications.length} saved for quick logging`}
        >
          <div className="space-y-4">
            <ul className="space-y-2">
              {medications.map((med) => (
                <li
                  key={med.id}
                  className="space-y-2 rounded-xl border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{med.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {med.defaultAmount} {med.defaultUnit}
                        {med.useCount ? ` · used ${med.useCount}×` : ''}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label={`Remove ${med.name}`}
                      onClick={async () => {
                        await deleteMedicationPreset(med.id)
                        toast.info(`Removed ${med.name}`)
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <Select
                    value={med.medClass ?? guessMedicationClass(med.name)}
                    aria-label={`Type of medication for ${med.name}`}
                    onChange={(e) =>
                      setMedicationClass(
                        med.id,
                        e.target.value as MedicationClass,
                      )
                    }
                  >
                    {(
                      Object.keys(MEDICATION_CLASS_LABEL) as MedicationClass[]
                    ).map((cls) => (
                      <option key={cls} value={cls}>
                        {MEDICATION_CLASS_LABEL[cls]}
                        {OVERUSE_THRESHOLD_DAYS[cls] != null
                          ? ` — limit ${OVERUSE_THRESHOLD_DAYS[cls]} days/mo`
                          : ''}
                      </option>
                    ))}
                  </Select>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-muted-foreground">
              The type is guessed from the name and only affects one thing: how
              many days a month of use your doctor summary flags as worth
              discussing. Simple painkillers are flagged from 15 days a month,
              combination painkillers and triptans from 10. Correct anything
              that looks wrong.
            </p>

            <div className="grid grid-cols-[1fr_5rem_5.5rem] gap-2">
              <Input
                value={newMed.name}
                placeholder="Medication"
                aria-label="New medication name"
                onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={newMed.amount}
                aria-label="Default amount"
                onChange={(e) => setNewMed({ ...newMed, amount: e.target.value })}
              />
              <Select
                value={newMed.unit}
                aria-label="Default unit"
                onChange={(e) =>
                  setNewMed({ ...newMed, unit: e.target.value as DoseUnit })
                }
              >
                {DOSE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="secondary"
              block
              disabled={!newMed.name.trim()}
              onClick={async () => {
                await addMedicationPreset(
                  newMed.name,
                  Number.parseFloat(newMed.amount) || 0,
                  newMed.unit,
                )
                toast.success(`Saved ${newMed.name.trim()}`)
                setNewMed({ name: '', amount: '400', unit: 'mg' })
              }}
            >
              <Plus /> Add medication
            </Button>
          </div>
        </Collapsible>

        <Section
          title="Your data"
          description={
            episodes && dayLogs
              ? `${episodes.length} headaches · ${dayLogs.length} headache-free days`
              : undefined
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={exportBackup}>
              <Download /> Download backup
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <Upload /> Restore from backup
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void readFile(file)
            }}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            A backup is a single JSON file holding every entry. Keep one somewhere
            safe — it is the only copy that survives clearing your browser.
          </p>

          <Button
            variant="ghost"
            block
            className="text-destructive"
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 /> Delete everything
          </Button>
        </Section>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          MigraineTracker · a private headache journal
        </p>
      </div>

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={async () => {
          await clearAllData()
          toast.info('All data deleted')
        }}
        title="Delete everything?"
        description="This permanently removes every headache, headache-free day and saved medication from this device. There is no undo — download a backup first if you might want it back."
        confirmLabel="Delete all"
        destructive
      />

      <ConfirmModal
        open={!!pendingImport}
        onClose={() => setPendingImport(null)}
        onConfirm={() => void runImport('replace')}
        title={`Restore ${pendingImport?.episodes ?? 0} headaches?`}
        description={
          <>
            <span className="block">
              Replacing overwrites everything currently on this device.
            </span>
            <Button
              variant="secondary"
              block
              className="mt-3"
              onClick={() => void runImport('merge')}
            >
              <HardDriveDownload /> Merge instead — keep what is here
            </Button>
          </>
        }
        confirmLabel="Replace all"
        destructive
      />
    </AppShell>
  )
}
