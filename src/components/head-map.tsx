import { useId, useMemo, useState } from 'react'
import {
  HEAD_REGION_LABEL,
  HEAD_REGION_SIDE,
  INTENSITY_VAR,
  type HeadRegionId,
  type Intensity,
  type PainPoint,
} from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The head map is drawn as two silhouettes — front and back — with the regions
 * laid out as simple rectangles clipped to the head outline. Clipping keeps the
 * region shapes trivial to reason about while the rendered result still follows
 * the contour of the head.
 *
 * Orientation is anatomical, the convention a clinician expects: in the front
 * view the patient's left is on the viewer's right, and in the back view it is
 * on the viewer's left. Both diagrams carry printed L/R markers so the reader
 * never has to work that out.
 */

type Box = { x: number; y: number; w: number; h: number }

const VIEW_W = 200
const VIEW_H = 214

const FRONT_OUTLINE =
  'M100,14 C136,14 160,42 160,80 C160,100 157,114 152,126 C147,146 132,168 112,180 C108,183 104,185 100,185 C96,185 92,183 88,180 C68,168 53,146 48,126 C43,114 40,100 40,80 C40,42 64,14 100,14 Z'

const BACK_OUTLINE =
  'M100,12 C138,12 164,42 164,84 C164,118 150,144 132,154 C130,160 129,166 129,172 L129,206 L71,206 L71,172 C71,166 70,160 68,154 C50,144 36,118 36,84 C36,42 62,12 100,12 Z'

/** Front view: viewer-left (x < 100) is the patient's right. */
const FRONT_REGIONS: { id: HeadRegionId; box: Box }[] = [
  { id: 'vertex', box: { x: 0, y: 0, w: 200, h: 46 } },
  { id: 'frontal-right', box: { x: 0, y: 46, w: 100, h: 42 } },
  { id: 'frontal-left', box: { x: 100, y: 46, w: 100, h: 42 } },
  { id: 'temporal-right', box: { x: 0, y: 88, w: 66, h: 44 } },
  { id: 'orbital-right', box: { x: 66, y: 88, w: 34, h: 30 } },
  { id: 'orbital-left', box: { x: 100, y: 88, w: 34, h: 30 } },
  { id: 'temporal-left', box: { x: 134, y: 88, w: 66, h: 44 } },
  { id: 'sinus', box: { x: 66, y: 118, w: 68, h: 40 } },
]

/** Back view: viewer-left (x < 100) is the patient's left. */
const BACK_REGIONS: { id: HeadRegionId; box: Box }[] = [
  { id: 'parietal-left', box: { x: 0, y: 0, w: 100, h: 92 } },
  { id: 'parietal-right', box: { x: 100, y: 0, w: 100, h: 92 } },
  { id: 'occipital-left', box: { x: 0, y: 92, w: 100, h: 58 } },
  { id: 'occipital-right', box: { x: 100, y: 92, w: 100, h: 58 } },
  { id: 'neck-left', box: { x: 0, y: 150, w: 100, h: 64 } },
  { id: 'neck-right', box: { x: 100, y: 150, w: 100, h: 64 } },
]

export const FRONT_REGION_IDS = FRONT_REGIONS.map((r) => r.id)
export const BACK_REGION_IDS = BACK_REGIONS.map((r) => r.id)

function toMap(points: PainPoint[]): Map<HeadRegionId, Intensity> {
  return new Map(points.map((p) => [p.region, p.intensity]))
}

function HeadFace({ muted }: { muted: string }) {
  // Light facial guides so the front view is instantly recognisable as a face.
  return (
    <g
      stroke={muted}
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
      opacity={0.5}
      pointerEvents="none"
    >
      <path d="M68,101 C73,95 84,95 89,101" />
      <path d="M111,101 C116,95 127,95 132,101" />
      <path d="M100,112 L100,136 C100,140 96,142 93,141" />
      <path d="M88,158 C94,162 106,162 112,158" />
    </g>
  )
}

function HeadHair({ muted }: { muted: string }) {
  return (
    <g stroke={muted} strokeWidth={1.6} fill="none" opacity={0.45} pointerEvents="none">
      <path d="M68,154 C80,162 120,162 132,154" />
      <path d="M71,178 L129,178" />
    </g>
  )
}

interface HeadViewProps {
  view: 'front' | 'back'
  values: Map<HeadRegionId, Intensity>
  onRegionClick?: (region: HeadRegionId) => void
  onRegionHover?: (region: HeadRegionId | null) => void
  interactive?: boolean
  className?: string
}

function HeadView({
  view,
  values,
  onRegionClick,
  onRegionHover,
  interactive,
  className,
}: HeadViewProps) {
  const outline = view === 'front' ? FRONT_OUTLINE : BACK_OUTLINE
  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS
  // Several head maps can share a page (the doctor report renders one per
  // episode), so the clip path needs an id unique to this instance.
  const clipId = `head-clip-${view}-${useId().replace(/:/g, '')}`

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={cn('w-full', className)}
      role={interactive ? 'group' : 'img'}
      aria-label={
        interactive
          ? `${view} of head, tap a region to mark pain`
          : `${view} of head showing marked pain regions`
      }
    >
      <defs>
        <clipPath id={clipId}>
          <path d={outline} />
        </clipPath>
      </defs>

      {/* Base silhouette. */}
      <path d={outline} fill="var(--color-muted)" />

      <g clipPath={`url(#${clipId})`}>
        {regions.map(({ id, box }) => {
          const intensity = values.get(id)
          const label = HEAD_REGION_LABEL[id]
          const fill = intensity ? INTENSITY_VAR[intensity] : 'transparent'

          const shared = {
            x: box.x,
            y: box.y,
            width: box.w,
            height: box.h,
            fill,
            stroke: 'var(--color-card)',
            strokeWidth: 1.5,
          }

          if (!interactive) {
            return <rect key={id} {...shared} pointerEvents="none" />
          }

          return (
            <rect
              key={id}
              {...shared}
              role="checkbox"
              aria-checked={intensity != null}
              aria-label={label}
              tabIndex={0}
              className="cursor-pointer transition-[fill] duration-150 hover:brightness-95"
              onClick={() => onRegionClick?.(id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onRegionClick?.(id)
                }
              }}
              onPointerEnter={() => onRegionHover?.(id)}
              onPointerLeave={() => onRegionHover?.(null)}
            />
          )
        })}
      </g>

      {view === 'front' ? (
        <HeadFace muted="var(--color-muted-foreground)" />
      ) : (
        <HeadHair muted="var(--color-muted-foreground)" />
      )}

      <path
        d={outline}
        fill="none"
        stroke="var(--color-muted-foreground)"
        strokeWidth={2}
        opacity={0.55}
        pointerEvents="none"
      />

      {/* Side markers sit on the diagram itself: the front and back views mirror
          one another, and a caption underneath is too easy to misread. */}
      <g
        fill="var(--color-muted-foreground)"
        fontSize={15}
        fontWeight={700}
        pointerEvents="none"
      >
        <text x={4} y={16} textAnchor="start">
          {view === 'front' ? 'R' : 'L'}
        </text>
        <text x={196} y={16} textAnchor="end">
          {view === 'front' ? 'L' : 'R'}
        </text>
      </g>
    </svg>
  )
}

export interface HeadMapProps {
  points: PainPoint[]
  onChange: (next: PainPoint[]) => void
  /** Intensity applied when painting a region. */
  brush: Intensity
  className?: string
}

/** Full editor: two views, tap to paint, tap again with the same level to clear. */
export function HeadMap({ points, onChange, brush, className }: HeadMapProps) {
  const [hovered, setHovered] = useState<HeadRegionId | null>(null)
  const values = useMemo(() => toMap(points), [points])

  const paint = (region: HeadRegionId) => {
    const current = values.get(region)
    if (current === brush) {
      onChange(points.filter((p) => p.region !== region))
      return
    }
    const without = points.filter((p) => p.region !== region)
    onChange([...without, { region, intensity: brush }])
  }

  const hoveredLabel = hovered ? HEAD_REGION_LABEL[hovered] : null
  const selected = points.length

  return (
    <div className={cn('space-y-2', className)}>
      <div className="grid grid-cols-2 gap-3">
        {(['front', 'back'] as const).map((view) => (
          <div key={view} className="space-y-1">
            <HeadView
              view={view}
              values={values}
              interactive
              onRegionClick={paint}
              onRegionHover={setHovered}
            />
            <div className="text-center text-[0.7rem] font-medium text-muted-foreground capitalize">
              {view}
            </div>
          </div>
        ))}
      </div>

      <p
        className="min-h-5 text-center text-xs text-muted-foreground"
        aria-live="polite"
      >
        {hoveredLabel ??
          (selected
            ? `${selected} region${selected === 1 ? '' : 's'} marked`
            : 'Tap the head to mark where it hurts')}
      </p>
    </div>
  )
}

/** Read-only rendering of a stored pain map, used on detail and report screens. */
export function HeadMapPreview({
  points,
  className,
  showLabels = true,
}: {
  points: PainPoint[]
  className?: string
  showLabels?: boolean
}) {
  const values = useMemo(() => toMap(points), [points])
  const usesBack = points.some((p) => BACK_REGION_IDS.includes(p.region))

  // A front-only map does not need the empty back view taking up space.
  const views = usesBack ? (['front', 'back'] as const) : (['front'] as const)

  return (
    <div
      className={cn(
        'grid gap-3',
        views.length === 2 ? 'grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {views.map((view) => (
        <div key={view} className="space-y-1">
          <HeadView view={view} values={values} />
          {showLabels ? (
            <div className="text-center text-[0.65rem] font-medium text-muted-foreground capitalize">
              {view}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/**
 * A head reduced to a few pixels for calendar cells and timeline frames.
 *
 * Individual regions are illegible at this size, so each half is filled with
 * the worst intensity recorded on that side — which preserves the one detail
 * that reads at a glance: which side of the head was affected.
 */
export function HeadGlyph({
  points,
  fallback,
  size = 24,
  className,
  title,
}: {
  points: PainPoint[]
  /** Used when an episode has no painted regions. */
  fallback?: Intensity
  size?: number
  className?: string
  title?: string
}) {
  const { left, right } = useMemo(() => {
    let l: Intensity | null = null
    let r: Intensity | null = null
    for (const point of points) {
      const side = HEAD_REGION_SIDE[point.region]
      if (side === 'left' || side === 'center') {
        l = l == null ? point.intensity : (Math.max(l, point.intensity) as Intensity)
      }
      if (side === 'right' || side === 'center') {
        r = r == null ? point.intensity : (Math.max(r, point.intensity) as Intensity)
      }
    }
    if (l == null && r == null && fallback) return { left: fallback, right: fallback }
    return { left: l, right: r }
  }, [points, fallback])

  const empty = 'var(--color-muted)'
  // A month view renders dozens of these, so each needs its own clip path id.
  const clipId = `glyph-clip-${useId().replace(/:/g, '')}`

  return (
    <svg
      // Cropped to the silhouette's bounding box so the head fills the glyph
      // instead of floating in whitespace at calendar sizes.
      viewBox="36 10 128 179"
      width={size}
      height={size}
      className={cn('overflow-visible', className)}
      role="img"
      aria-label={title ?? 'Pain location'}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={clipId}>
          <path d={FRONT_OUTLINE} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Front view, so the patient's left renders on the viewer's right. */}
        <rect
          x="0"
          y="0"
          width="100"
          height="200"
          fill={right ? INTENSITY_VAR[right] : empty}
        />
        <rect
          x="100"
          y="0"
          width="100"
          height="200"
          fill={left ? INTENSITY_VAR[left] : empty}
        />
      </g>
      <path
        d={FRONT_OUTLINE}
        fill="none"
        stroke="currentColor"
        strokeWidth={9}
        opacity={0.22}
      />
    </svg>
  )
}
