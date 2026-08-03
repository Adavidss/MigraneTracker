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

**Attack mode.** The screen for someone who is having a migraine right now, and
the reason the rest of the app can afford to be detailed.

**Headache now** on the home screen records the attack immediately from your
saved defaults — no form, no decisions — and opens a stripped screen with three
things on it, each one tap: how bad it is, a dose taken, and it's over. Targets
are enormous and sit at the bottom where a thumb already is. Changing the pain
level quietly records a reading, so the pain curve builds itself just by using
the app. The time since your last dose is shown in words, because a foggy head
double-doses.

Comfort controls sit at the top of that screen and in Settings: a dimmer that
goes darker than the phone's own brightness slider for photophobia, a text-size
scale, and a reduce-motion switch. The dim overlay is deliberately
click-through, so every control stays reachable at any darkness — including the
one that undoes it.

If an attack is running when you open the app, it opens there. Everything else
about the entry can be filled in from the calendar once you feel well enough to
care.

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

**For your doctor.** A tab built to be handed over or sent ahead of an
appointment, in two levels of detail.

*Overview* leads with the numbers that change treatment decisions: headache days
per month, migraine days, acute medication days, and whether the pattern is
episodic or chronic. Below that, a "worth discussing" list surfaces things the
diary shows but a person is unlikely to spot — crossing the four-days-a-month
mark where preventives come into the conversation, acute medication use nearing
the frequency at which it starts driving headaches, a worsening trend. Then the
attack profile (typical severity, usual length, aura share, which side), a head
map of where pain concentrates across the whole history, aura symptoms, acute
medication use drawn against its per-class limit, what has actually helped, and
the most recent attacks.

*Full record* is the long form: month calendars, a month-by-month table,
medication effectiveness, aura history and every episode.

**Send** hands the PDF to the system share sheet, so on an iPhone it goes
straight to Messages, Mail or AirDrop without leaving the app. Also exports as
PDF, PNG, or CSV (episodes, doses and headache-free days separately). Printing
includes both levels of detail.

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

**Thresholds are shown, not applied.** The doctor overview compares the diary
against widely published figures — 15 headache days a month for a chronic
pattern, 10 or 15 days of acute medication depending on drug class — and says
so in those words. Nothing is labelled a diagnosis, because a headache diary
cannot make one. Medication classes are guessed from the name and correctable
in Settings, since the limit depends on the class. A trend is only reported over
three months or more; below that the two halves are too short to mean anything.

**Designed around the worst moment, not the calm one.** The app gets opened
mid-attack, when light hurts, reading is effortful and aim is poor. That is why
the urgent path records first and asks later, why attack mode has three controls
rather than a form, and why dimming exists at all. Anything that needs thought —
aura symptoms, exact times, how well a drug worked — is deliberately left for
afterwards.

**Built for a phone first.** Every control clears 44px, controls opt out of
double-tap zoom and long-press callouts, fields are 16px so Safari does not zoom
on focus, and layouts respect the safe-area insets so nothing hides behind the
home indicator. iOS never fires an install prompt, so Settings explains where
Safari's Add to Home Screen button is.

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

The icon set is committed, so `npm run icons` is only needed after editing the
source SVG. It uses sharp, which is deliberately not a dependency — install it
for the one run with `npm install --no-save sharp`.

## Architecture

```
src/
  lib/          types, Dexie schema and repositories, statistics,
                episode helpers, exports, PDF builder, hash router
  store/        Zustand stores for settings and toasts
  components/   head map, calendar, heatmap, chart kit, episode views, UI kit
  routes/       Home · Attack · LogEpisode · DayDetail · Timeline ·
                Insights · History · Doctor · Settings
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
