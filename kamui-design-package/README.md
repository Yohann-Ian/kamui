# KAMUI design package

Four things in here.

    DESIGN-SYSTEM.md            the specification, the source of truth
    CLAUDE-CODE-PROMPTS.md      what to paste into Claude Code, in order
    reference/home.html         the homepage, as it should look
    reference/discovery.html    a Battlefield's Discovery screen, as it should look
    reference/background-source.jpg   the photograph

## What to do

1. Copy `DESIGN-SYSTEM.md` and the whole `reference/` folder into the root of
   `E:\CODING\KAMUI`, beside CLAUDE.md.
2. Commit, so you can roll back if a phase goes wrong.
3. Open `CLAUDE-CODE-PROMPTS.md` and work through the phases one at a time.
4. Commit after each phase that works.

## About the reference HTML

Open both in a browser. They are fixed at 1440x980 and will not resize, because
they are a photograph of the target rather than a working prototype. The real build
is responsive.

The Frost sliders in them do work, and they do remember their positions, so you can
feel the range before it gets built. Drag Focus to zero to see how much of the
legibility comes from blur rather than opacity.

Explore and Battlefield settings are dead links in the reference. Only the two
screens exist.

The files are around 340KB each because the photograph is embedded inside them.
That is deliberate, so they work with no other files present. The real build must
not do that, section 7 of the design system says how.

## The three things most likely to get lost

Watch for these specifically, because they are the ones that quietly slide back.

**White text.** Every piece of copy over the glass is #FFFFFF. Not a grey, not a
tint. If something needs to recede, use opacity or size, never a dimmer colour.
This rule exists because faint grey over a photograph was the recurring failure.

**Frost persistence.** The three slider values must survive closing the browser.
Test it by setting them somewhere odd, quitting entirely, and reopening.

**Dots, not pills.** Grade shows as a solid coloured circle in lists. Pills were
tried and rejected.
