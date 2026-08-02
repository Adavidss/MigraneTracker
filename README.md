# MigraineTracker

A private, local-first visual journal for headaches and migraines.

Logging an episode takes a few seconds; the point of the app is what comes
after — a calendar you can read at a glance, a time-lapse of how each headache
unfolded, and a summary you can hand to a doctor.

**Live:** https://kidsdc.org/MigraneTracker/

> The repository name is spelled `MigraneTracker`, which is also the deployed
> path. The application is called MigraineTracker.

## Privacy

Everything lives in the browser's IndexedDB on the device that recorded it.
There is no account, no server, no analytics, no third party. The app is a bag
of static files; nothing it holds ever leaves the machine.

The consequence is that clearing browser data deletes the journal, so
**Settings → Download backup** writes a single JSON file holding every entry.
That backup is the only copy that survives.

## Features

**Logging.** Pain level 1–5, an interactive head map, headache type, start and
end time, aura symptoms, unlimited medication doses with times, how well each
one worked, optional pain readings over the course of the episode, and notes.
Only the pain level is required — the usual location is pre-marked and the type
defaults to whatever is set in Settings, so the common case is one tap.

**Head pain map.** Front and back silhouettes split into fourteen anatomical
regions. Tap to paint at the current pain level, tap again to clear. Orientation
is anatomical — in the front view the patient's left is on the viewer's right —
and both diagrams carry printed L/R markers.

**Calendar.** Each day is a coloured head rather than a number: saturated for a
headache, a pale tile for a day confirmed clear, nothing for a day never logged.
Days with more than one episode carry a count badge.

**Headache-free days.** Logged explicitly, so "no headache" and "no record" stay
distinguishable and the frequency figures mean something.

**Timeline.** Every recorded moment in a window becomes a frame — start, each
pain reading, each dose, relief, end — and the head map animates through them.
Scrub or press play.

**Insights.** Headache and migraine counts, average pain and duration, longest
clear run, medication effectiveness and time to relief, monthly trends, pain
distribution, aura frequency, region frequency, and a GitHub-style year heatmap
that can show headaches, worst pain, or medication use.

**Doctor visit mode.** A print-optimised summary covering 1–12 months: headline
figures, month calendars, a month-by-month table, medication effectiveness, aura
history and the full episode log. Exports as PDF, PNG, or CSV (episodes, doses,
and headache-free days separately), and prints cleanly to paper.

**History.** Filter by date range, type, aura, medication, minimum pain and
minimum relief, plus free-text search across notes and medication names.

**PWA.** Installable, works fully offline, updates itself after a deploy.

## Design notes

**The pain ramp is monotone in lightness.** A naive green→yellow→orange→red
scale collapses under colour blindness: level 1 and level 4 measure ΔE 5.4 apart
under simulated deuteranopia, which on a head map means mild and severe look
identical. The ramp here keeps the familiar hues but steps lightness downward at
every level, so the order survives every kind of colour vision deficiency —
level 1 vs 4 now sits at ΔE 23.0 (light) / 17.8 (dark), and adjacent levels clear
the ΔE 8 target. Each mode has its own steps, because no single ramp clears 3:1
against both a white and a near-black surface. Values and rationale are in
`src/lib/types.ts`; the ramps live in `src/index.css`.

**Statistics are honest about gaps.** Streaks and frequency treat unlogged days
as headache-free — the same assumption a paper diary makes — so every surface
that reports them also reports how much of the window actually carries a record.

## Development

```bash
npm install
npm run dev
```

The dev server runs on port 3130 at http://localhost:3130/MigraneTracker/.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type check, then build to `dist/` |
| `npm run typecheck` | Type check only |
| `npm run lint` | Oxlint |
| `npm run preview` | Serve the production build |
| `npm run icons` | Rasterise `public/favicon.svg` into the PWA icon set |

## Architecture

```
src/
  lib/          types, Dexie schema and repositories, statistics,
                episode helpers, exports, PDF builder, hash router
  store/        Zustand stores for settings and toasts
  components/   head map, calendar, heatmap, chart kit, episode views, UI kit
  routes/       Home · LogEpisode · DayDetail · Timeline · Insights ·
                History · Report · Settings
```

- **React + TypeScript + Vite**, built to a fully static bundle.
- **Dexie** over IndexedDB, read through `useLiveQuery` so every view updates
  the moment anything is written.
- **Tailwind CSS v4** with the theme driven by a class on `<html>`.
- **Recharts** for trend charts; the heatmap, head map and ranked bars are
  hand-rolled SVG and CSS.
- **Hash routing**, hand-written in ~120 lines. GitHub Pages has no rewrite
  rules, so a path router would 404 on refresh, and no router dependency
  currently ships without open advisories.
- **jsPDF**, loaded on demand, generating a text-native PDF rather than a
  screenshot so the summary stays sharp and searchable.

All statistics are computed in `src/lib/stats.ts`, so the dashboard, the doctor
summary and the CSV exports can never disagree with one another.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which type checks, lints,
builds and publishes `dist/` to GitHub Pages. The Vite `base` is
`/MigraneTracker/`; change it in `vite.config.ts` if the repository is renamed.

Enable Pages once under **Settings → Pages → Source → GitHub Actions**.
