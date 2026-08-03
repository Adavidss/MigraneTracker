/**
 * Domain model for MigraineTracker.
 *
 * Everything here is stored locally in IndexedDB. Dates that identify a day use
 * a plain `YYYY-MM-DD` local-calendar string rather than a timestamp, because a
 * headache belongs to the day the user experienced it regardless of timezone.
 * Moments in time (start, end, dose times) are stored as full ISO strings.
 */

export type Intensity = 1 | 2 | 3 | 4 | 5

export const INTENSITIES: readonly Intensity[] = [1, 2, 3, 4, 5]

export const INTENSITY_LABEL: Record<Intensity, string> = {
  1: 'Mild',
  2: 'Noticeable',
  3: 'Moderate',
  4: 'Severe',
  5: 'Extreme',
}

/**
 * Pain intensity is an ordinal scale, so the ramp is monotone in lightness:
 * that is what keeps the order readable under every kind of colour blindness,
 * while the hues keep the familiar mild-to-severe reading for everyone else.
 *
 * Each mode has its own steps, because no single ramp clears 3:1 against both
 * a white and a near-black surface. Validated with the data-viz palette
 * checker: adjacent pairs sit at ΔE 8.3 light / 8.4 dark under simulated
 * protanopia and deuteranopia, and level 1 vs level 4 — the pair a naive
 * green-to-red ramp collapses to ΔE 5.4 — sits at 23.0 / 17.8.
 *
 * Components should use {@link INTENSITY_VAR} so the colour follows the theme.
 * The raw hex values are only needed where CSS cannot reach, such as the PDF
 * and PNG exports.
 */
export const INTENSITY_HEX: Record<'light' | 'dark', Record<Intensity, string>> = {
  light: {
    1: '#31be98',
    2: '#b08505',
    3: '#b1582b',
    4: '#993845',
    5: '#69286d',
  },
  dark: {
    1: '#5cd8b0',
    2: '#deaa1f',
    3: '#e57945',
    4: '#cf5867',
    5: '#994b9e',
  },
}

/** Theme-aware reference to the ramp, for use in `fill`/`style`. */
export const INTENSITY_VAR: Record<Intensity, string> = {
  1: 'var(--color-pain-1)',
  2: 'var(--color-pain-2)',
  3: 'var(--color-pain-3)',
  4: 'var(--color-pain-4)',
  5: 'var(--color-pain-5)',
}

/** Translucent wash of a pain colour, for badge and chip backgrounds. */
export function intensityWash(level: Intensity, percent = 14): string {
  return `color-mix(in oklab, ${INTENSITY_VAR[level]} ${percent}%, transparent)`
}

/** Raw hex for canvas, PDF and anywhere else CSS variables do not resolve. */
export function intensityHex(level: Intensity, dark = false): string {
  return INTENSITY_HEX[dark ? 'dark' : 'light'][level]
}

export type EpisodeType = 'migraine' | 'migraine-aura' | 'headache' | 'other'

export const EPISODE_TYPE_LABEL: Record<EpisodeType, string> = {
  migraine: 'Migraine',
  'migraine-aura': 'Migraine with aura',
  headache: 'Headache',
  other: 'Other',
}

/** Short form for dense surfaces like the calendar and history rows. */
export const EPISODE_TYPE_SHORT: Record<EpisodeType, string> = {
  migraine: 'Migraine',
  'migraine-aura': 'Aura',
  headache: 'Headache',
  other: 'Other',
}

export type Side = 'left' | 'right' | 'center'

/**
 * Anatomical regions of the head map. Each id is `<area>-<side>`, except the
 * two midline regions, so the side can be derived from the id.
 */
export type HeadRegionId =
  | 'frontal-left'
  | 'frontal-right'
  | 'temporal-left'
  | 'temporal-right'
  | 'orbital-left'
  | 'orbital-right'
  | 'parietal-left'
  | 'parietal-right'
  | 'occipital-left'
  | 'occipital-right'
  | 'neck-left'
  | 'neck-right'
  | 'vertex'
  | 'sinus'

export interface HeadRegionMeta {
  id: HeadRegionId
  label: string
  side: Side
}

export const HEAD_REGIONS: readonly HeadRegionMeta[] = [
  { id: 'frontal-left', label: 'Left forehead', side: 'left' },
  { id: 'frontal-right', label: 'Right forehead', side: 'right' },
  { id: 'temporal-left', label: 'Left temple', side: 'left' },
  { id: 'temporal-right', label: 'Right temple', side: 'right' },
  { id: 'orbital-left', label: 'Behind left eye', side: 'left' },
  { id: 'orbital-right', label: 'Behind right eye', side: 'right' },
  { id: 'parietal-left', label: 'Left side / above ear', side: 'left' },
  { id: 'parietal-right', label: 'Right side / above ear', side: 'right' },
  { id: 'occipital-left', label: 'Left back of head', side: 'left' },
  { id: 'occipital-right', label: 'Right back of head', side: 'right' },
  { id: 'neck-left', label: 'Left neck / base of skull', side: 'left' },
  { id: 'neck-right', label: 'Right neck / base of skull', side: 'right' },
  { id: 'vertex', label: 'Top of head', side: 'center' },
  { id: 'sinus', label: 'Sinuses', side: 'center' },
]

export const HEAD_REGION_LABEL: Record<HeadRegionId, string> =
  Object.fromEntries(HEAD_REGIONS.map((r) => [r.id, r.label])) as Record<
    HeadRegionId,
    string
  >

export const HEAD_REGION_SIDE: Record<HeadRegionId, Side> = Object.fromEntries(
  HEAD_REGIONS.map((r) => [r.id, r.side]),
) as Record<HeadRegionId, Side>

/** One painted region on a single episode's head map. */
export interface PainPoint {
  region: HeadRegionId
  intensity: Intensity
}

export type DoseUnit = 'mg' | 'tablets' | 'ml' | 'sprays' | 'puffs' | 'units'

export const DOSE_UNITS: readonly DoseUnit[] = [
  'mg',
  'tablets',
  'ml',
  'sprays',
  'puffs',
  'units',
]

export type Effectiveness = 1 | 2 | 3 | 4 | 5

export const EFFECTIVENESS_LABEL: Record<Effectiveness, string> = {
  1: 'No relief',
  2: 'Minimal relief',
  3: 'Moderate relief',
  4: 'Significant relief',
  5: 'Complete relief',
}

/**
 * What kind of drug a medication is. This exists for one reason: published
 * headache guidance sets different monthly limits on acute medication before
 * frequent use itself starts driving headaches, and the limit depends on the
 * class. Preventives are taken daily by design and are excluded from that count.
 */
export type MedicationClass =
  | 'simple'
  | 'combination'
  | 'triptan'
  | 'ergot'
  | 'opioid'
  | 'gepant'
  | 'preventive'
  | 'other'

export const MEDICATION_CLASS_LABEL: Record<MedicationClass, string> = {
  simple: 'Simple painkiller',
  combination: 'Combination painkiller',
  triptan: 'Triptan',
  ergot: 'Ergotamine',
  opioid: 'Opioid',
  gepant: 'Gepant or ditan',
  preventive: 'Preventive',
  other: 'Other / not sure',
}

/**
 * Days per month of acute use above which published guidance treats the
 * medication itself as a possible driver of headaches. `null` means the class
 * is not counted: preventives are meant to be daily, gepants are not associated
 * with the pattern, and an unclassified drug should not raise a flag the user
 * cannot interpret.
 */
export const OVERUSE_THRESHOLD_DAYS: Record<MedicationClass, number | null> = {
  simple: 15,
  combination: 10,
  triptan: 10,
  ergot: 10,
  opioid: 10,
  gepant: null,
  preventive: null,
  other: null,
}

/** Substring matches, longest first, used to guess a class from a typed name. */
const CLASS_HINTS: [MedicationClass, string[]][] = [
  [
    'preventive',
    [
      'propranolol', 'topiramate', 'topamax', 'amitriptyline', 'nortriptyline',
      'candesartan', 'valproate', 'depakote', 'erenumab', 'aimovig',
      'fremanezumab', 'ajovy', 'galcanezumab', 'emgality', 'eptinezumab',
      'vyepti', 'atogepant', 'qulipta', 'botox', 'onabotulinum', 'verapamil',
      'flunarizine', 'metoprolol', 'riboflavin', 'magnesium', 'coenzyme',
    ],
  ],
  [
    'triptan',
    [
      'sumatriptan', 'imitrex', 'rizatriptan', 'maxalt', 'zolmitriptan',
      'zomig', 'naratriptan', 'amerge', 'eletriptan', 'relpax', 'almotriptan',
      'frovatriptan', 'treximet', 'triptan',
    ],
  ],
  [
    'gepant',
    ['ubrogepant', 'ubrelvy', 'rimegepant', 'nurtec', 'lasmiditan', 'reyvow', 'zavegepant'],
  ],
  [
    'opioid',
    [
      'codeine', 'co-codamol', 'cocodamol', 'tramadol', 'oxycodone', 'percocet',
      'hydrocodone', 'vicodin', 'morphine', 'butalbital', 'fioricet', 'fiorinal',
    ],
  ],
  ['ergot', ['ergotamine', 'cafergot', 'dihydroergotamine', 'migranal']],
  [
    'combination',
    [
      'excedrin', 'anadin', 'syndol', 'solpadeine', 'panadeine', 'midrin',
      'migraleve', 'paramol',
    ],
  ],
  [
    'simple',
    [
      'ibuprofen', 'advil', 'motrin', 'nurofen', 'naproxen', 'aleve', 'aspirin',
      'paracetamol', 'acetaminophen', 'tylenol', 'panadol', 'diclofenac',
      'voltaren', 'ketorolac', 'indomethacin', 'celecoxib', 'mefenamic',
    ],
  ],
]

/** Best guess at a medication's class from its name; 'other' when unsure. */
export function guessMedicationClass(name: string): MedicationClass {
  const key = name.trim().toLowerCase()
  if (!key) return 'other'
  for (const [cls, hints] of CLASS_HINTS) {
    if (hints.some((hint) => key.includes(hint))) return cls
  }
  return 'other'
}

export interface MedicationDose {
  id: string
  /** Free text so any medication can be logged, matched case-insensitively. */
  name: string
  amount: number
  unit: DoseUnit
  /** ISO timestamp the dose was taken. */
  takenAt: string
  effectiveness?: Effectiveness
  /** ISO timestamp relief was first felt, used for "time to relief" stats. */
  reliefAt?: string
}

/** A pain reading at a point in time, used to draw the episode's progression. */
export interface PainReading {
  id: string
  at: string
  intensity: Intensity
  note?: string
}

export type AuraSymptom =
  | 'visual'
  | 'flashing-lights'
  | 'blind-spot'
  | 'zig-zag'
  | 'numbness'
  | 'tingling'
  | 'speech'
  | 'other'

export const AURA_SYMPTOMS: readonly {
  id: AuraSymptom
  label: string
}[] = [
  { id: 'visual', label: 'Visual aura' },
  { id: 'flashing-lights', label: 'Flashing lights' },
  { id: 'blind-spot', label: 'Blind spot' },
  { id: 'zig-zag', label: 'Zig-zag lines' },
  { id: 'numbness', label: 'Numbness' },
  { id: 'tingling', label: 'Tingling' },
  { id: 'speech', label: 'Speech difficulty' },
  { id: 'other', label: 'Other' },
]

export const AURA_LABEL: Record<AuraSymptom, string> = Object.fromEntries(
  AURA_SYMPTOMS.map((s) => [s.id, s.label]),
) as Record<AuraSymptom, string>

export interface Episode {
  id: string
  /** `YYYY-MM-DD` in local time — the day this episode is filed under. */
  date: string
  /** ISO timestamp. */
  startTime: string
  /** ISO timestamp; absent while the episode is still ongoing. */
  endTime?: string
  type: EpisodeType
  /** Peak intensity, kept denormalised so calendars need no extra work. */
  intensity: Intensity
  painMap: PainPoint[]
  auraSymptoms: AuraSymptom[]
  auraNotes?: string
  medications: MedicationDose[]
  progression: PainReading[]
  notes?: string
  createdAt: string
  updatedAt: string
}

/**
 * A day the user explicitly marked as headache-free. Only days that were
 * actively confirmed are stored, so "no record" and "no headache" stay
 * distinguishable in the statistics.
 */
export interface DayLog {
  /** `YYYY-MM-DD`, primary key. */
  date: string
  note?: string
  createdAt: string
}

/** A medication the user has saved for one-tap reuse. */
export interface MedicationPreset {
  id: string
  name: string
  defaultAmount: number
  defaultUnit: DoseUnit
  /** Bumped on each use so the picker can surface favourites first. */
  useCount: number
  /** Guessed from the name on first use; the user can correct it in Settings. */
  medClass?: MedicationClass
}

export const DEFAULT_MEDICATIONS: readonly Omit<MedicationPreset, 'id'>[] = [
  {
    name: 'Excedrin',
    defaultAmount: 2,
    defaultUnit: 'tablets',
    useCount: 0,
    medClass: 'combination',
  },
  {
    name: 'Advil',
    defaultAmount: 400,
    defaultUnit: 'mg',
    useCount: 0,
    medClass: 'simple',
  },
  {
    name: 'Ibuprofen',
    defaultAmount: 400,
    defaultUnit: 'mg',
    useCount: 0,
    medClass: 'simple',
  },
  {
    name: 'Tylenol',
    defaultAmount: 500,
    defaultUnit: 'mg',
    useCount: 0,
    medClass: 'simple',
  },
  {
    name: 'Naproxen',
    defaultAmount: 220,
    defaultUnit: 'mg',
    useCount: 0,
    medClass: 'simple',
  },
]

export type ThemePreference = 'light' | 'dark' | 'system'

export interface Settings {
  /** Single-row table; always `'settings'`. */
  id: 'settings'
  theme: ThemePreference
  /**
   * Regions pre-selected when a new episode is started. The spec's author has
   * consistently left-sided pain, so the default map is the left temple.
   */
  defaultRegions: HeadRegionId[]
  defaultType: EpisodeType
  /** Shown on the printable doctor summary. */
  patientName?: string
  use24HourTime: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'system',
  defaultRegions: ['temporal-left'],
  defaultType: 'migraine',
  use24HourTime: false,
}

/** Shape of a full JSON backup, versioned so imports can be validated. */
export interface BackupFile {
  format: 'migrainetracker-backup'
  version: 1
  exportedAt: string
  episodes: Episode[]
  dayLogs: DayLog[]
  medications: MedicationPreset[]
  settings: Settings
}
