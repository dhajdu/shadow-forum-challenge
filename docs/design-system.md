# Shadow Forum design system

The source of truth for how the web app looks. It codifies the UI as shipped; it is not a redesign.
Tokens live in [`app/globals.css`](../app/globals.css) `:root`. The iOS app mirrors the core palette in
[`ios/ShadowForum/Theme/Theme.swift`](../ios/ShadowForum/Theme/Theme.swift).
Browsable reference (tokens, brand book): https://claude.ai/artifact/K8kPJELdj1AoFzUXi8M2kX

## Rules

1. **No new literals.** Use a token for every color, radius and font size. If nothing fits, add a token here and in `:root` in the same PR.
2. **Copy a component, don't hand-roll one.** Reuse the classes below before writing a new card, chip, button or list row.
3. **Dark only.** The app is a single dark "night city" theme. There is no light mode.
4. **Numbers are tabular.** Any digits that line up or update (scores, KPIs, deltas) get `font-variant-numeric: tabular-nums`.
5. **Semantic color is separate from accent.** Blue is the action color. Green, amber and red mean good, warning and bad.

## Color

| Token | Value | Use |
|---|---|---|
| `--bg` | `#06080f` | Page background |
| `--bg-2` | `#0b1020` | Raised background, hero gradient base |
| `--ink` | `#e8ecff` | Primary text |
| `--ink-soft` | `#cdd5f5` | Card headings (`h2`, `h3`), gradient-title end |
| `--muted` | `#8a93b2` | Secondary text, labels, captions |
| `--line` | `rgba(255,255,255,.08)` | All borders and dividers |
| `--blue` | `#2f7dff` | Primary action, selected state, links ("right neon") |
| `--navy` | `#1d3a7a` | Button gradient end ("deep steel") |
| `--blue-edge` | `rgba(47,125,255,.6)` | Hover and open border |
| `--amber` | `#f5a524` | Highlight, recent data, warnings |
| `--red` | `#ff4326` | Bad, missed, "left neon" |
| `--orange` | `#ff7a1a` | Gradient stop |
| `--green` | `#57d38c` | Good, live, positive deltas |
| `--gold` | `#ffcf5a` | First place only |

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--surface` | `rgba(18,22,35,.6)` | `.zone-card` |
| `--surface-2` | `rgba(18,22,35,.62)` | `.board`, race `.kpis .kpi` (legacy twin of `--surface`; prefer `--surface` for new work) |
| `--well` | `rgba(10,14,26,.5)` | Inset tiles, segmented buttons, drop zone |
| `--well-soft` | `rgba(10,14,26,.4)` | List rows inside a card |
| `--popover` | `#0c101c` | Dropdown panels (upload panel) |
| `--avatar-from` / `--avatar-to` | `#1a2136` / `#0e1424` | Avatar and icon placeholder gradient |

### Score scale

Scores (0 to 100) map to a red, amber, blue ramp: 40 and below is `--red`, 65 is `--amber`, 90 and above is `--blue`, interpolated between.
Web: `scoreColor()` in [`app/me/page.tsx`](../app/me/page.tsx). iOS: `Color.score()`. Keep the stops identical in both.

Goal status: web chips are on track = green, at risk = amber, behind = red, hit = soft blue (`.chip.*`). iOS uses blue for on track and ink for hit.

## Typography

One family: the system UI stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, ...`). No web fonts.

| Token | Size | Use |
|---|---|---|
| `--fs-2xs` | 10px | Tiny sub-labels under numbers |
| `--fs-xs` | 11px | Captions, eyebrows, KPI labels, badges |
| `--fs-sm` | 12px | Form labels, secondary text, segmented buttons |
| `--fs-md` | 13px | Default UI text, lists, nav |
| `--fs-base` | 14px | Card headings, body copy |
| `--fs-lg` | 15px | Buttons, inputs, section titles |
| `--fs-xl` | 18px | Emphasis numbers |
| `--fs-2xl` | 22px | KPI numbers |
| `--fs-3xl` | 30px | Page titles (`/me`, zone pages) |

Hero and race titles use `clamp()` and stay literal. Weights: 600 for labels and names, 700 for headings and buttons, 800 for big numbers and titles.

- **Page title:** 800 weight, gradient `#fff` to `--ink-soft`, clipped to text. See `.zone-head h1`, `.race-head h1`.
- **Eyebrow:** `.eyebrow`, `--fs-xs`, uppercase, wide letter-spacing, `--muted`.
- **Card heading:** `.zone-card h2` / `.card h3`, `--fs-base` (13px for `h3`), 700, `.03em` tracking, `--ink-soft`.

## Radius

| Token | Value | Use |
|---|---|---|
| `--r-xs` | 6px | Small icon buttons |
| `--r-sm` | 8px | Icon tiles, delete buttons |
| `--r-md` | 10px | Buttons, fields, list rows |
| `--r-lg` | 12px | Tiles, inset panels, chat bubbles |
| `--r-xl` | 16px | Cards and floating panels |
| `--r-pill` | 20px | Chips, segmented buttons, badges |

Legacy values still in the CSS: `9px` (nav links, `.btn-ghost`, file rows, race track) and `14px` (race KPIs, popover). Use `--r-sm` / `--r-md` and `--r-lg` / `--r-xl` for new work.

## Elevation and glow

Flat by default; borders (`--line`) do the separating. Shadows are reserved for:
- **Floating layers** (popover, chat panel, board): `0 20px 60px rgba(0,0,0,.4 to .5)`.
- **Primary action glow:** `.btn` `0 8px 30px rgba(47,125,255,.22)`; selected `.seg-btn.on` `0 0 14px rgba(47,125,255,.4)`.
- **Focus:** `0 0 0 3px rgba(47,125,255,.15)` plus a blue border on `.field:focus`.

## Spacing

No token scale yet; these are the values in use. Stick to them.
- Card padding `20px 22px`; list rows `10px 12px`; tiles `12px 14px`.
- Gaps: 8px inside controls, 10 to 12px between rows, 16px between cards.
- Page container: `max-width` 1080 to 1120px, `20px` side padding, `60px` bottom.

## Components

Global classes in `app/globals.css` unless noted. Copy these.

| Component | Class / file | Notes |
|---|---|---|
| Card | `.zone-card` (member pages), `.card` (race page) | `h2`/`h3` inside are styled |
| Primary button | `.btn` | Full width by default; add `width: auto` inline contexts |
| Ghost button | `.btn-ghost` | Secondary actions, header actions |
| Text field | `.field` | Inputs, selects, textareas |
| Password field | `components/PasswordField.tsx` | Field with show/hide toggle |
| Segmented control | `.seg` + `.seg-btn` / `.seg-btn.on` | View toggles, status pickers |
| Status chip | `.chip.on_track` / `.at_risk` / `.behind` / `.hit` | Goal status |
| KPI tile | `.kpi-row .kpi`, `.kpis .kpi` | Big number + `--fs-xs` label |
| List row | `.xc-item`, `.notelist li`, `.filerow` | `--well-soft` background, `--r-md` |
| Eyebrow | `.eyebrow` | Section kicker above a title |
| Nav bar | `components/NavBar.tsx` (`.bar`) | Every signed-in page |
| Race board | `components/RaceBoard.tsx` | Lanes, medals, runners |
| Goal progress | `components/GoalProgress.tsx` (`.goalprog`) | Business goal card body |
| Extra credit | `components/ExtraCredit.tsx` (`.xc-*`) | Personal goals list + add form |
| Upload | `components/UploadWhoop.tsx` (`.upload .drop`) | Drop zone + file list |
| Trend sparkline | `components/ScoreTrend.tsx` (`.trend`) | Inside `.trend-wrap` or `.trend-card` |
| Assistant | `components/Assistant.tsx`, `ChatLauncher.tsx` | `.bubble`, `.chat-fab`, `.chat-panel` |
| Empty state | `.trend-empty` | Centered muted line |

Page-specific layout lives in CSS modules next to the page (`app/me/me.module.css`, `app/race/race.module.css`, `app/rider/[id]/rider.module.css`, `components/RaceBoard.module.css`). Those must use tokens too.

## iOS mapping

| Web token | iOS |
|---|---|
| `--bg` | `Color.sfBackground` |
| `--bg-2` | `Color.sfSurface` |
| `--ink` | `Color.sfText` |
| `--muted` | `Color.sfMuted` |
| `--blue` | `Color.sfSteel` |
| `--navy` | `Color.sfDeepSteel` |
| `--amber` | `Color.sfAmber` |
| `--red` | `Color.sfRed` |
| `--line` | `Color.sfLine` (opaque `#1A2240`, close to `--line` over `--bg`) |

When a token changes, update both files in the same PR.
