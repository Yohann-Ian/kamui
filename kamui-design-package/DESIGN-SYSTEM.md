# KAMUI design system

This is the visual specification for KAMUI. It is the single source of truth for
every screen, including ones not yet built.

Two reference files sit beside this one in `reference/`. They are static HTML,
fixed at 1440x980, showing the target look with real data:

    reference/home.html        the homepage
    reference/discovery.html   a Battlefield's Discovery screen

Open them in a browser. They are the target. They are NOT responsive and they are
NOT the implementation. Read them for colour, type, spacing and behaviour, then
build the real thing in Tailwind against this document.

---

## 1. The idea

A dark translucent panel floating over a photograph. The photo is always visible
at the edges of the screen and softly through the panel. Everything the user
reads sits inside the panel.

Three layers, bottom to top:

1. **The photograph**, full bleed, fixed.
2. **A tint layer** over it, dark, so the photo never overwhelms.
3. **The glass panel**, translucent with a heavy backdrop blur, inset from the
   screen edge, holding all content.

The user controls layers 2 and 3 with three sliders. See section 6.

---

## 2. Type

Two families plus Japanese. Self-hosted, see section 8.

- **Neutralface** for the wordmark, page headings, and Battlefield names.
- **Aspekta** for everything else: navigation, body, labels, buttons.
- **Noto Sans JP** for the kana.
- A monospace for all numbers: scores, counts, slider values. Numbers must use
  tabular figures so digits align down a column.

The reference HTML substitutes Archivo for Neutralface and Figtree for Aspekta,
because the canvas could only load Google Fonts. Ignore those two names.

### The scale

Only these sizes. Do not invent new ones.

| Size | Weight | Used for |
|---|---|---|
| 78px | 400 | the kana banner on the homepage |
| 42px | 700 | the homepage H1, "Welcome" |
| 40px | 600 | the big numbers: a selected job's score, a homepage tile's counts |
| 23px | 700 | a page heading, e.g. the Battlefield name on Discovery |
| 22px | 600 | the Grade value on the selected-job card |
| 21px | 600 | the selected job's title, a card's headline number |
| 18px | 500 | scores in the job list |
| 17px | 700 | the "KAMUI" wordmark under the kana banner, tracked out 0.44em |
| 16px | 700 | the sidebar wordmark, tracked out 0.16em |
| 15px | 500/600 | the homepage subhead, homepage tile names |
| 14px | 600 | sidebar section headers, "Battlefields" and "Frost" |
| 13.5px | 500 | every sidebar item, job titles in the list, body copy in the detail panel |
| 13px | 600/700 | buttons |
| 12.5px | 500/600 | secondary metadata, the company and location line, grade words |
| 11.5px | 500/600 | slider labels, small uppercase section labels, card sub-lines |
| 11px | 400/500 | sidebar counts, the small kana in the sidebar |

### The hard rule on text colour

**All text over the glass is #FFFFFF.** Not a shade of it. Not a grey.

Faint grey text over a photograph is the failure mode this design keeps falling
into. If something needs to recede, reduce it with `opacity` (never below 0.8) or
with size and weight. Never with a lower-contrast colour.

The only exceptions:

- Slider value readouts, which use the frost cyan `#A0DBF2`.
- The highlighted count in the homepage subhead, which uses the autumn accent.
- Dark text on a light ground, which does not occur anywhere in the current design
  because every coloured card is dark enough to carry white.

There is no 10px text anywhere. It does not survive over a photograph.

---

## 3. Colour

### Palette

| Hex | Name | Used for |
|---|---|---|
| `#A96E3C` | autumn, deep | primary buttons, the AI/ML tile |
| `#B47C4A` | autumn | the Score card |
| `#C08A55` | autumn, light | the selected Battlefield in the sidebar |
| `#D39A63` | autumn, bright | a highlighted number in body copy |
| `#6E7486` | slate | the Grade card, the B2B tile |
| `#8E7BB0` | lavender, deep | the Pay card |
| `#4C515B` | charcoal | a dormant tile |
| `#A0DBF2` | frost cyan | slider accents and their readouts only |
| `#FFFFFF` | white | all text |

Every coloured surface is dark enough to carry white text. If a new surface colour
is added and white fails on it, darken the surface. Do not switch to dark text.

### Status dots

The job list shows grade as a 10px solid circle, no border, no ring, no shadow.

| Grade | Hex |
|---|---|
| Fit | `#22C55E` traffic-light green |
| Possible | `#2563EB` blue-screen blue |
| Improbable | `#B9A7D6` muted lavender |
| Unfit | `#EF4444` traffic-light red |
| unranked | `#8C99A6` grey |

A dot, not a pill. Pills were tried and rejected: at forty rows they become a wall
of colour. The dot carries the same information at a fraction of the weight.

### Glass surfaces

| Surface | Fill | Blur |
|---|---|---|
| Tint over the photo | `rgba(8,12,17,0.26)` | none |
| The main panel | `rgba(12,17,23,0.40)` | 64px, saturate 135% |
| The sidebar, inside the panel | `rgba(0,0,0,0.22)` | inherits |
| Cards inside the panel | `rgba(0,0,0,0.26)` | 14px |
| Panel border | `rgba(255,255,255,0.22)` | |
| Dividers | `rgba(255,255,255,0.15)` | |
| Dashed control borders | `rgba(255,255,255,0.45)` | |

The panel values above are the defaults. They are driven by CSS variables, see
section 6.

---

## 4. Layout

    screen (the photograph)
      26px padding
        panel, border-radius 22px
          sidebar, 218px fixed
          content area, fills the rest

The sidebar is on every screen. Its contents, top to bottom:

1. Wordmark: "KAMUI" at 16px 700, and "カムイ" at 11px beside it.
2. Section header "Battlefields" at 14px 600.
3. One row per Battlefield: name on the left, count of unranked jobs on the right
   in monospace. The active one has a filled background and a 2px left border in
   the autumn accent.
4. "+ New Battlefield", a dashed-border action.
5. A divider.
6. Explore, Tracking, Battlefield settings. All three identical: 13.5px, 500,
   white. Settings is not a lesser item and is not pushed to the bottom.
7. A flexible gap.
8. The Frost section, pinned to the bottom. See section 6.

### Discovery content area

- Header: Battlefield name, a stat line beneath it, and two buttons on the right.
  Search New is primary (solid autumn), Rank is secondary (translucent with a
  white border).
- A row of cards describing the **currently selected job only**: a wide card with
  its title and actions, then Score, Grade and Pay as coloured blocks.
- A "Why this grade" card.
- The job list, filling the remaining height.

The coloured cards describe one job. Never colour-block the list rows themselves.

### Job list rows

    [score]  [dot]  Title
                    Company - Location                    [grade word]

- Score: 28px wide, right-aligned, monospace, 18px.
- Dot: 10px, as specified above.
- Title at 13.5px 500, company and location at 12.5px 500, both white, both
  truncating with an ellipsis rather than wrapping.
- The selected row has a `rgba(255,255,255,0.07)` fill.
- Unranked rows show a dash for the score and "unranked" as the grade word.
- Unfit rows sit at `opacity: 0.72`.

### Homepage content area

1. The kana banner "カムイ" at 78px, with "KAMUI" at 17px 700 tracked out beneath.
2. H1 "Welcome" at 42px 700.
3. A subhead stating how many Battlefields are in play and how many new jobs
   there are, with the number in the autumn accent.
4. A grid of Battlefield tiles, one per Battlefield, each a solid palette colour
   with white text, showing exactly two numbers: **new** and **applied**. Nothing
   else. No grade breakdown. Beneath them, when the Battlefield was last searched.
5. Actions at the bottom.

---

## 5. Components

**Primary button.** Solid `#A96E3C`, white text, 13px 700, radius 9px.

**Secondary button.** `rgba(255,255,255,0.15)` fill, `rgba(255,255,255,0.30)`
border, white text, 13px 600, radius 9px.

**Dashed action.** Transparent, `rgba(255,255,255,0.45)` dashed border, white text,
13.5px 500.

**Card.** `rgba(0,0,0,0.26)`, 14px backdrop blur, `rgba(255,255,255,0.16)` border,
radius 16px.

**Coloured stat card.** Solid palette colour, radius 16px, 152px wide. An 11.5px
600 uppercase label at 85% opacity, a large value in white, and a sub-line at
11.5px 500 at 85% opacity.

---

## 6. The Frost controls

Three sliders in the sidebar, under a "Frost" header at 14px 600, sentence case,
with 20px of space beneath it before the first slider.

| Slider | Range | Default | Controls |
|---|---|---|---|
| View | 10 to 68 | 40 | the panel's fill opacity, as a percentage |
| Strength | 0 to 100 | 35 | how far the panel's tint shifts toward `#A0DBF2` |
| Focus | 0 to 64 | 64 | the panel's backdrop blur, in pixels |

Each slider has a white 11.5px 500 label on the left and its current value on the
right in monospace `#A0DBF2`. Accent colour on the slider itself is `#A0DBF2`.

**View must never exceed 68.** Past roughly 70 the panel stops reading as glass and
becomes paint. The cap is deliberate, not arbitrary. Do not raise it.

### Implementation

Three CSS custom properties on `:root`:

    --frost-view    a decimal, e.g. 0.40
    --frost-rgb     three comma-separated channels, e.g. 12,17,23
    --frost-focus   a pixel value, e.g. 64px

The panel reads them:

    background: rgba(var(--frost-rgb), var(--frost-view));
    backdrop-filter: blur(var(--frost-focus)) saturate(135%);

Strength interpolates the tint from the base `12,17,23` toward `160,219,242` at
55% of the way, so even at full strength it stays a tint rather than a wash.

### Persistence, and this is not optional

The three values **must survive a page reload, a navigation, and closing the
browser.** Store them in `localStorage` under `kamui.frost.view`,
`kamui.frost.strength` and `kamui.frost.focus`. Read them on mount, before first
paint if possible, so the panel never flashes at the default and then jumps.

They are global, not per-page. Setting Frost on the homepage sets it on Discovery,
Tracking, Explore and Settings. Implement it once, in the shared layout, not per
screen.

---

## 7. The background image

The source photograph is `reference/background-source.jpg`, susuki grass against
water. It is embedded as a data URI inside the reference HTML, which is why those
files are large. Do not do that in the real build.

1. Put the image at `web/public/bg.jpg`. Anything in `public/` is served from the
   root, so it becomes `/bg.jpg`.
2. On the outermost layout wrapper:

       backgroundImage: "url('/bg.jpg')"
       backgroundSize: "cover"
       backgroundPosition: "center"

3. Directly over it, a full-bleed tint layer at `rgba(8,12,17,0.26)`.
4. Over that, the glass panel.

Because the image is fixed and the panel scrolls its own content, use
`background-attachment: fixed` or a fixed-position background layer so the photo
does not move with the page.

Make the image path a constant in one place, so swapping the photograph later is a
one-line change.

---

## 8. Fonts

The font files are at `E:\CODING\KAMUI\fonts`.

1. Copy them into `web/app/fonts/`.
2. Load them with `next/font/local` in `web/app/layout.tsx`:

       import localFont from "next/font/local";

       const display = localFont({
         src: "./fonts/Neutralface.woff2",
         variable: "--font-display",
         display: "swap",
       });

       const ui = localFont({
         src: "./fonts/Aspekta.woff2",
         variable: "--font-ui",
         display: "swap",
       });

   Adjust the filenames and add one `src` entry per weight if the family ships as
   separate files rather than a variable font.

3. Noto Sans JP comes from `next/font/google` with the `japanese` subset.

4. Put all three variables on the `<html>` element, then in
   `web/app/globals.css` map them into Tailwind's theme so they are usable as
   `font-display`, `font-ui` and `font-jp`.

5. `next/font` self-hosts and preloads, so there is no external request and no
   layout shift. Do not add a `<link>` to Google Fonts.

---

## 9. Carrying this to screens not shown

The two reference files cover the homepage and Discovery. Tracking, Explore,
Battlefield settings and anything built later must follow the same system. When
building a screen that has no reference:

- Same shell: photograph, tint, panel, sidebar. The sidebar never changes.
- Same type scale. Pick the nearest existing size rather than adding one.
- All text white.
- Lists follow the job-list row pattern: a number or marker on the left, a
  two-line text block, a quiet right-hand column.
- Coloured cards describe a single selected thing. Never a whole list.
- Panels and cards use the glass fills from section 3, never a solid colour.
- Empty states are a plain white sentence saying what is empty and what to do
  about it. No illustration.

If a screen seems to need something this document does not cover, add it to this
document first, then build it.

---

## 10. Explicitly rejected

Recording these so they do not creep back in.

- **Grey body text over the photo.** The reason for the white rule.
- **Grade pills on every row.** Tried, unreadable at volume. Dots replaced them.
- **Gamification.** No streaks, no levels, no badges, no leaderboard. The design
  reference this drew from had them; they are engagement bait for a consumer app.
- **10px text.** Too small over a photograph at any weight.
- **A fully opaque panel.** The View cap at 68 exists to prevent it.
- **Colour-blocked list rows.** The coloured card treatment is for one selected
  item only.
