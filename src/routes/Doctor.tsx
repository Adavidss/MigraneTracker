import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { startOfMonth, subMonths } from 'date-fns'
import {
  ChevronDown,
  FileDown,
  Image,
  Printer,
  Share,
  Sheet,
} from 'lucide-react'
import { allDayLogs, allEpisodes, allMedications } from '@/lib/db'
import { computeClinicalProfile } from '@/lib/stats'
import { daysCsv, dosesCsv, downloadCsv, episodesCsv } from '@/lib/export'
import { dateKey, downloadBlob } from '@/lib/utils'
import { useSettings } from '@/store/useSettings'
import { toast } from '@/store/useToast'
import { AppShell } from '@/components/app-shell'
import { DoctorOverview } from '@/components/doctor-overview'
import { DoctorRecord } from '@/components/doctor-record'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/section'
import { Segmented } from '@/components/ui/field'

type Range = '1m' | '3m' | '6m' | '12m'
type Mode = 'overview' | 'record'

const RANGES: { value: Range; label: string; months: number }[] = [
  { value: '1m', label: '1 mo', months: 1 },
  { value: '3m', label: '3 mo', months: 3 },
  { value: '6m', label: '6 mo', months: 6 },
  { value: '12m', label: '12 mo', months: 12 },
]

/** iOS and Android can hand a PDF straight to Messages, Mail or AirDrop. */
function canShareFiles(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function'
  )
}

export default function Doctor() {
  const settings = useSettings()
  const [range, setRange] = useState<Range>('3m')
  const [mode, setMode] = useState<Mode>('overview')
  const [busy, setBusy] = useState<string | null>(null)
  const [exportsOpen, setExportsOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  const episodes = useLiveQuery(allEpisodes, [])
  const dayLogs = useLiveQuery(allDayLogs, [])
  const presets = useLiveQuery(allMedications, []) ?? []

  const months = RANGES.find((r) => r.value === range)!.months
  const from = dateKey(startOfMonth(subMonths(new Date(), months - 1)))
  const to = dateKey()

  const input = useMemo(
    () => ({ episodes: episodes ?? [], dayLogs: dayLogs ?? [], from, to }),
    [episodes, dayLogs, from, to],
  )

  const profile = useMemo(
    () => computeClinicalProfile(input, presets),
    [input, presets],
  )

  const inRange = useMemo(
    () => (episodes ?? []).filter((e) => e.date >= from && e.date <= to),
    [episodes, from, to],
  )

  const buildPdfBlob = async () => {
    const { buildSummaryPdf } = await import('@/lib/pdf')
    const doc = buildSummaryPdf(input, {
      patientName: settings.patientName,
      from,
      to,
      use24h: settings.use24HourTime,
    })
    return doc.output('blob') as Blob
  }

  const pdfName = `headache-summary-${from}-to-${to}.pdf`

  /**
   * Sending this to a doctor is the whole point of the screen, so it goes
   * through the system share sheet where that exists — on an iPhone that means
   * Messages, Mail or AirDrop without leaving the app.
   */
  const shareSummary = async () => {
    setBusy('share')
    try {
      const blob = await buildPdfBlob()
      const file = new File([blob], pdfName, { type: 'application/pdf' })

      if (canShareFiles() && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Headache diary summary',
          text: settings.patientName
            ? `Headache diary summary for ${settings.patientName}.`
            : 'Headache diary summary.',
        })
      } else {
        downloadBlob(blob, pdfName)
        toast.success('Summary saved — attach it to an email or message')
      }
    } catch (error) {
      // Dismissing the share sheet is a normal outcome, not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error(error)
      toast.error('Could not prepare the summary.')
    } finally {
      setBusy(null)
    }
  }

  const savePdf = async () => {
    setBusy('pdf')
    try {
      downloadBlob(await buildPdfBlob(), pdfName)
      toast.success('PDF saved')
    } catch (error) {
      console.error(error)
      toast.error('Could not create the PDF.')
    } finally {
      setBusy(null)
    }
  }

  const savePng = async () => {
    if (!sheetRef.current) return
    setBusy('png')
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(sheetRef.current, {
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
      })
      const blob = await (await fetch(dataUrl)).blob()
      downloadBlob(blob, `headache-summary-${from}-to-${to}.png`)
      toast.success('Image saved')
    } catch (error) {
      console.error(error)
      toast.error('Could not create the image.')
    } finally {
      setBusy(null)
    }
  }

  if (episodes === undefined || dayLogs === undefined) {
    return (
      <AppShell title="For your doctor">
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    )
  }

  if (!episodes.length && !dayLogs.length) {
    return (
      <AppShell title="For your doctor">
        <EmptyState
          title="Nothing to show yet"
          description="Once you have logged some headaches, this becomes a summary you can hand to a doctor or send ahead of an appointment."
        />
      </AppShell>
    )
  }

  return (
    <AppShell
      title="For your doctor"
      subtitle="A summary to show or send"
      actions={
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={shareSummary}
          className="gap-1.5"
        >
          <Share />
          {busy === 'share' ? 'Preparing…' : 'Send'}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2 print:hidden">
          <Segmented
            ariaLabel="Time covered"
            value={range}
            onChange={setRange}
            options={RANGES.map(({ value, label }) => ({ value, label }))}
          />
          <Segmented
            ariaLabel="Level of detail"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'record', label: 'Full record' },
            ]}
          />
        </div>

        {/* Both views are rendered so a printed copy carries the whole picture,
            while the screen shows only the one that was asked for. */}
        <div ref={sheetRef} className="bg-background">
          <div className={mode === 'overview' ? '' : 'hidden print:block'}>
            <DoctorOverview
              input={input}
              profile={profile}
              patientName={settings.patientName}
              use24h={settings.use24HourTime}
            />
          </div>
          <div
            className={
              mode === 'record'
                ? ''
                : 'hidden print:block print-break-before print:pt-6'
            }
          >
            <DoctorRecord
              input={input}
              episodes={episodes}
              dayLogs={dayLogs}
              patientName={settings.patientName}
              use24h={settings.use24HourTime}
            />
          </div>
        </div>

        <div className="space-y-2 print:hidden">
          <Button
            variant="secondary"
            block
            onClick={() => setExportsOpen((v) => !v)}
            aria-expanded={exportsOpen}
          >
            Other ways to share
            <ChevronDown
              className={exportsOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </Button>

          {exportsOpen ? (
            <div className="animate-fade-in grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={busy !== null} onClick={savePdf}>
                <FileDown /> {busy === 'pdf' ? 'Saving…' : 'PDF'}
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer /> Print
              </Button>
              <Button variant="outline" disabled={busy !== null} onClick={savePng}>
                <Image /> {busy === 'png' ? 'Saving…' : 'Image'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  downloadCsv(
                    episodesCsv(inRange, settings.use24HourTime),
                    `headaches-${from}-to-${to}.csv`,
                  )
                  toast.success('Episode CSV saved')
                }}
              >
                <Sheet /> Episodes
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  downloadCsv(
                    dosesCsv(inRange, settings.use24HourTime),
                    `medication-${from}-to-${to}.csv`,
                  )
                  toast.success('Medication CSV saved')
                }}
              >
                <Sheet /> Doses
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const logs = dayLogs.filter((d) => d.date >= from && d.date <= to)
                  downloadCsv(
                    daysCsv(logs),
                    `headache-free-days-${from}-to-${to}.csv`,
                  )
                  toast.success('Headache-free days CSV saved')
                }}
              >
                <Sheet /> Clear days
              </Button>
            </div>
          ) : null}

          <p className="px-2 pb-2 text-center text-xs leading-relaxed text-muted-foreground">
            Printing includes both the overview and the full record.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
