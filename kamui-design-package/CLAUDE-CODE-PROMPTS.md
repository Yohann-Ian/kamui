# Prompts for Claude Code

Copy `DESIGN-SYSTEM.md` and the `reference/` folder into the repo root first, so
the paths below resolve. Then feed these one at a time. Do not paste more than one
phase at once. After each, look at the result before continuing.

---

## Phase 0, orientation

> Read DESIGN-SYSTEM.md and open reference/home.html and reference/discovery.html.
>
> Then tell me, before changing anything:
> 1. Which existing components and pages will this design replace or rewrite.
> 2. Anything in the design that conflicts with how the app currently works, or
>    that the current data model cannot supply.
> 3. Anything in the design that is ambiguous enough that you would be guessing.
>
> Do not write any code yet.

Read the answer properly. If it flags data the design assumes but the database does
not have (a job's salary, for instance, or a last-searched timestamp per
Battlefield), decide whether to add it or drop that piece of the design before
building on top of it.

---

## Phase 1, the shell

> Implement the shell from DESIGN-SYSTEM.md sections 1, 3, 4 and 7.
>
> - Put the background image in place as described in section 7. The source is
>   reference/background-source.jpg.
> - Build the three-layer structure: photograph, tint, glass panel.
> - Build the sidebar exactly as section 4 describes, reading real Battlefields
>   from the database, with the unranked count per Battlefield.
> - Put it all in the shared layout so every route sits inside it.
> - Use the type scale and colours from sections 2 and 3. Set up the Tailwind
>   theme so the palette and the glass fills are named tokens, not repeated hex
>   values.
>
> Do not touch any page content yet. Existing pages should render inside the new
> shell even if they look wrong.

---

## Phase 2, the fonts

> Implement section 8. The font files are at E:\CODING\KAMUI\fonts. Copy them into
> web/app/fonts, load them with next/font/local, wire them into the Tailwind theme,
> and apply the display face to headings and the interface face to everything else
> per the scale in section 2.
>
> Tell me what font files you found and which weights are available, before
> deciding how to map them.

---

## Phase 3, the Frost controls

> Implement section 6 in full.
>
> Three sliders in the sidebar: View, Strength, Focus, with the ranges, defaults
> and behaviour described. Drive the panel through the three CSS custom properties.
>
> Persistence is the part that matters most: the values must survive a reload, a
> navigation between pages, and closing the browser. Store them in localStorage
> under the keys named in section 6, read them on mount, and avoid a flash of the
> default values before the stored ones apply.
>
> The controls live in the shared layout and are global. Changing Frost on one page
> changes it everywhere.
>
> Cap View at 68 and do not allow any path to exceed it.

Test it yourself: set the sliders somewhere odd, close the browser entirely,
reopen the site. If it comes back where you left it, it works.

---

## Phase 4, Discovery

> Rebuild the Discovery screen to match reference/discovery.html, following
> DESIGN-SYSTEM.md section 4.
>
> - The header with its stat line and the Search New and Rank buttons.
> - The selected-job card row: the wide card, then Score, Grade and Pay as
>   coloured stat cards. These describe the selected job only.
> - The "Why this grade" card.
> - The job list with the row pattern in section 4 and the status dots in
>   section 3.
>
> Keep every piece of existing behaviour intact: the search progress polling, the
> rank confirmation that shows how many are unranked before spending anything,
> status setting, notes, hiding applied jobs. This is a visual rebuild, not a
> behavioural one.
>
> If the database has no salary for a job, hide the Pay card rather than showing
> an empty one.

---

## Phase 5, the homepage

> Build a new homepage at the app root, matching reference/home.html and section 4.
>
> - The kana banner "カムイ" with "KAMUI" beneath it, then an H1 reading "Welcome".
> - A subhead saying how many Battlefields are in play and how many new jobs there
>   are since the user last looked, with that number in the autumn accent.
> - One tile per Battlefield, each a solid palette colour with white text, showing
>   exactly two numbers: new, and applied. Plus when it was last searched.
>
> "New" means jobs added since the user last opened that Battlefield. If nothing
> tracks that yet, add what you need to the schema and tell me what you added.
> This number is the reason the homepage exists, so it has to be real.
>
> Move whatever is currently at the root to wherever it belongs.

---

## Phase 6, the remaining screens

> Apply the design system to Tracking, Explore and Battlefield settings, following
> DESIGN-SYSTEM.md section 9.
>
> There are no reference files for these three. Derive them from the system: same
> shell, same type scale, all text white, the list row pattern for lists, glass
> cards rather than solid ones, coloured cards only for a single selected item.
>
> Before you build each one, tell me in two or three lines how you are applying
> the system to it, so I can correct you before you write the code.
>
> Keep all existing behaviour. Battlefield settings in particular must keep its
> rubric editor, its versioning, and both automation toggles working exactly as
> they do now.

---

## Phase 7, the audit

> Audit the whole app against DESIGN-SYSTEM.md and report, without fixing anything
> yet:
>
> 1. Every font size in use that is not in the section 2 scale, and where.
> 2. Every text colour that is not #FFFFFF, and where, and whether it is one of
>    the listed exceptions.
> 3. Every hardcoded hex that should be a theme token.
> 4. Any text at 10px or below.
> 5. Anywhere a grade is shown as a pill rather than a dot.
> 6. Any page where the Frost controls are missing or not reading the stored
>    values.
>
> Then I will tell you which to fix.

That last phase is the one that keeps the design from drifting. Run it again after
any future feature work.
