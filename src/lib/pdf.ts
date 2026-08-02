import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { EPISODE_TYPE_LABEL } from './types'
import { episodeDurationMinutes, hasAura } from './episode'
import {
  computeMedicationHeadline,
  computeMedicationStats,
  computeMonthly,
  computeSummary,
  type StatsInput,
} from './stats'
import { formatDayShort, formatDuration, formatTime, round } from './utils'

/**
 * Kept apart from the rest of the export helpers because jsPDF is large and
 * only ever needed the moment someone asks for a PDF.
 */
interface PdfOptions {
  patientName?: string
  from: string
  to: string
  use24h: boolean
}

/**
 * A text-native PDF rather than a screenshot, so the summary stays sharp,
 * searchable and small enough to email.
 */
export function buildSummaryPdf(input: StatsInput, options: PdfOptions): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const summary = computeSummary(input)
  const medStats = computeMedicationStats(input)
  const medHeadline = computeMedicationHeadline(input, medStats)
  const monthly = computeMonthly(input)

  const ensureRoom = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  const heading = (text: string) => {
    ensureRoom(14)
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(20, 20, 30)
    doc.text(text, margin, y)
    y += 2
    doc.setDrawColor(210, 210, 220)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5
  }

  const table = (headers: string[], rows: string[][], widths: number[]) => {
    const rowHeight = 6
    ensureRoom(rowHeight * 2)

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(90, 90, 105)
    let x = margin
    headers.forEach((header, i) => {
      doc.text(header, x, y)
      x += widths[i]!
    })
    y += 2
    doc.setDrawColor(225, 225, 232)
    doc.line(margin, y, pageWidth - margin, y)
    y += 4

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 40)

    for (const row of rows) {
      ensureRoom(rowHeight)
      x = margin
      row.forEach((cell, i) => {
        const width = widths[i]!
        // Clip rather than wrap, so a long note can never break the grid.
        const lines = doc.splitTextToSize(cell, width - 2) as string[]
        doc.text(lines[0] ?? '', x, y)
        x += width
      })
      y += rowHeight
    }
    y += 2
  }

  // Title block.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(20, 20, 30)
  doc.text('Headache summary', margin, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(95, 95, 110)
  if (options.patientName) {
    doc.text(options.patientName, margin, y)
    y += 5
  }
  doc.text(
    `${formatDayShort(options.from)} to ${formatDayShort(options.to)}  ·  generated ${format(new Date(), 'd MMM yyyy')}`,
    margin,
    y,
  )
  y += 6

  // Headline figures.
  heading('At a glance')
  const facts: [string, string][] = [
    ['Headaches recorded', String(summary.totalEpisodes)],
    ['Headache days', String(summary.headacheDays)],
    ['Migraine days', String(summary.migraineDays)],
    ['Days confirmed headache-free', String(summary.headacheFreeDays)],
    ['Average pain (1-5)', summary.averageIntensity?.toString() ?? 'n/a'],
    [
      'Average duration',
      formatDuration(summary.averageDurationMinutes) ?? 'n/a',
    ],
    ['Longest run without a headache', `${summary.longestClearStreak} days`],
    [
      'Frequency',
      summary.frequencyPer30Days != null
        ? `${summary.frequencyPer30Days} per 30 days`
        : 'n/a',
    ],
    [
      'Episodes with aura',
      `${summary.episodesWithAura}${
        summary.auraRate != null ? ` (${round(summary.auraRate * 100, 0)}%)` : ''
      }`,
    ],
    [
      'Days with any record',
      `${summary.daysTracked - summary.unloggedDays} of ${summary.daysTracked}`,
    ],
  ]

  doc.setFontSize(9.5)
  const colWidth = contentWidth / 2
  facts.forEach(([label, value], i) => {
    const col = i % 2
    if (col === 0) ensureRoom(6)
    const x = margin + col * colWidth
    doc.setTextColor(95, 95, 110)
    doc.text(label, x, y)
    doc.setTextColor(20, 20, 30)
    doc.setFont('helvetica', 'bold')
    doc.text(value, x + colWidth - 4, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    if (col === 1) y += 6
  })
  if (facts.length % 2 === 1) y += 6

  // Medication.
  if (medStats.length) {
    heading('Medication')
    doc.setFontSize(9.5)
    doc.setTextColor(95, 95, 110)
    ensureRoom(6)
    doc.text(
      `Most used: ${medHeadline.mostUsed?.name ?? 'n/a'}   ·   Most effective: ${
        medHeadline.mostEffective?.name ?? 'n/a'
      }   ·   Average relief: ${medHeadline.averageEffectiveness ?? 'n/a'} / 5`,
      margin,
      y,
    )
    y += 6

    table(
      ['Medication', 'Doses', 'Episodes', 'Typical dose', 'Relief', 'To relief'],
      medStats.map((m) => [
        m.name,
        String(m.doses),
        String(m.episodes),
        m.typicalDose ?? '—',
        m.averageEffectiveness != null
          ? `${m.averageEffectiveness}/5 (${m.ratedDoses})`
          : '—',
        formatDuration(m.averageTimeToReliefMinutes) ?? '—',
      ]),
      [42, 18, 22, 32, 34, 32],
    )
  }

  // Month by month.
  if (monthly.length) {
    heading('Month by month')
    table(
      ['Month', 'Headaches', 'Migraines', 'Headache days', 'Avg pain', 'Aura'],
      monthly.map((m) => [
        m.label,
        String(m.episodes),
        String(m.migraines),
        String(m.headacheDays),
        m.averageIntensity?.toString() ?? '—',
        String(m.auraEpisodes),
      ]),
      [30, 30, 30, 36, 27, 27],
    )
  }

  // Full log.
  const episodes = [...input.episodes]
    .filter(
      (e) =>
        (!options.from || e.date >= options.from) &&
        (!options.to || e.date <= options.to),
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  if (episodes.length) {
    heading('Episode log')
    table(
      ['Date', 'Start', 'Length', 'Type', 'Pain', 'Aura', 'Medication'],
      episodes.map((e) => [
        e.date,
        formatTime(e.startTime, options.use24h),
        formatDuration(episodeDurationMinutes(e)) ?? 'ongoing',
        EPISODE_TYPE_LABEL[e.type],
        String(e.intensity),
        hasAura(e) ? 'yes' : '—',
        [...new Set(e.medications.map((d) => d.name))].join(', ') || '—',
      ]),
      [22, 18, 20, 34, 14, 14, 58],
    )
  }

  // Footer on every page.
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFontSize(7.5)
    doc.setTextColor(140, 140, 155)
    doc.text(
      'Self-reported headache diary — MigraineTracker',
      margin,
      pageHeight - 8,
    )
    doc.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 8, {
      align: 'right',
    })
  }

  return doc
}

export function downloadSummaryPdf(input: StatsInput, options: PdfOptions) {
  const doc = buildSummaryPdf(input, options)
  doc.save(`headache-summary-${options.from}-to-${options.to}.pdf`)
}
