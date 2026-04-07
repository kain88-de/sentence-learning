# Design Redesign Doc

## Scope

This document defines a redesign direction for the dictation practice app in `app/`.

Constraints:

- keep the app pure HTML5, CSS, and browser-side JavaScript
- keep the app fully static
- target laptop and tablet first
- preserve the current three areas: practice, words, manage
- improve clarity for children without adding framework or heavy UI chrome

## Goals

- make the practice task the obvious center of the product
- reduce visual nesting and unnecessary framing
- replace icon-guessing with readable actions
- make the app feel warmer, simpler, and more intentional
- preserve the current lightweight architecture

## Non-Goals

- no mobile-first redesign work
- no server or build pipeline changes
- no feature expansion beyond the current practice, words, and manage flows
- no game layer, scoring system, avatars, or rewards system in this pass

## Current Problems

### 1. Too much framing

The first screen uses a title area, then a large outer panel, then an inner card, then a reveal card. The main learning action occupies a relatively small area inside that stack.

Effect:

- the screen feels padded rather than purposeful
- the child’s eye is drawn to containers instead of the task
- the exercise looks smaller and less important than it should

### 2. Primary actions are icon-led

The main controls rely on `▶`, `☼`, and `↺`.

Effect:

- the child has to infer meaning instead of reading it
- the actions do not feel instructional
- the interaction looks more like a toy control strip than a guided activity

### 3. Split visual personality

The large serif headline and the rest of the utility UI do not form one coherent visual system.

Effect:

- the title feels formal
- the interface feels generic
- the app does not yet have a distinct child-friendly identity

### 4. Navigation competes with the main task

`Ueben`, `Woerter`, and `Verwalten` currently have equal visual weight.

Effect:

- the practice view is not dominant enough
- management feels too prominent for a child-facing default surface

## Redesign Thesis

The app should feel like a calm practice board on a desk: warm paper tones, one clear working surface, large readable actions, and minimal distraction.

This is not a dashboard and not a landing page. It is a focused learning tool. The redesign should reduce UI furniture and make the task sequence obvious at a glance.

## Visual Direction

### Mood

- warm
- quiet
- tactile
- encouraging
- structured without feeling school-admin heavy

### Composition

Use one dominant practice surface per view. Avoid a panel inside a panel unless the inner element is a true interactive module.

For the practice view, the first viewport should contain:

- a compact top navigation
- a short title and instruction
- one large exercise surface with the task steps, main actions, and reveal area

### Typography

Use one strong display voice and one simple UI face.

Recommended approach:

- display: a rounded or friendly serif only if it still feels clear and modern
- UI text: a clean sans or humanist sans with high legibility

Guidance:

- reduce the `h1` size slightly on tablet
- keep body and button labels visually larger than they are now
- emphasize action labels over decorative headings

### Color

Keep the existing warm palette family, but simplify the system.

Recommended token roles:

- background: warm paper wash
- surface: light cream
- accent: coral or apricot for active state and primary action
- support accent: muted green for step/status elements
- ink: deep slate rather than pure black
- border: soft low-contrast linework

Avoid introducing more accent colors than necessary.

### Shape Language

Keep rounded corners, but use them with more restraint.

Guidance:

- one main radius for large surfaces
- one smaller radius for buttons and secondary fields
- reduce the sense that every element is independently pill-shaped

## Layout Plan

### Global Structure

Recommended page structure:

1. top nav
2. compact heading block
3. primary work surface

Avoid a large generic outer panel around the whole page. Let the practice surface itself be the main visual object.

### Navigation

Keep the three tabs, but reduce emphasis on `Verwalten`.

Recommended behavior:

- `Ueben` remains the default active tab
- `Woerter` remains easy to reach
- `Verwalten` appears quieter, more utility-like

Recommended styling:

- segmented control or tab row
- active state clearly filled
- inactive states quieter
- no oversized chrome around the tab row

### Practice View

The practice view should become one large board with four functional zones:

1. step guidance
2. current instruction
3. primary actions
4. reveal area

Recommended order:

- step row at top
- one sentence of guidance under it
- large action buttons in the center
- reveal area anchored below

### Words View

The words view should feel like a sibling of practice, not a separate app.

Keep:

- same overall structure
- same main surface treatment
- same action language

Refine:

- make word tiles more obviously tappable
- use readable labels or numbers consistently
- keep reveal behavior visually parallel with sentence reveal behavior

### Manage View

The manage screen can remain more utility-oriented, but it should still use the same design system.

Recommended changes:

- reduce decorative card stacking
- treat controls as rows and sections rather than many separate cards
- visually separate “audio setup” from “sentence management”
- keep debug visually demoted

## Interaction Direction

## Primary Principle

The interface should instruct, not imply.

### Practice Controls

Replace icon-only buttons with labeled buttons.

Recommended labels:

- `Abspielen`
- `Loesung zeigen`
- `Neuer Satz`

Optional:

- keep icons as supporting marks inside the buttons
- labels must remain primary

### Step Guidance

Keep the three steps, but make them feel like instructional progress rather than decorative chips.

Recommended treatment:

- numbered or clearly ordered
- lighter visual presence than the main controls
- same position across practice and words

Example wording:

- `1 Hoeren`
- `2 Schreiben`
- `3 Pruefen`

### Reveal Interaction

The reveal area should feel like part of the same board, not like a separate card dropped below it.

Recommended behavior:

- hidden or softly blurred until requested
- clearer state change when revealed
- enough padding and text size for quick checking from a writing posture

## Content Strategy

### Heading

Keep the title short and direct.

Recommended heading block:

- title: `Schreibuebung`
- support line: one short instruction only

Avoid repeating the same instruction in multiple places on screen.

### Practice Copy

The main copy should be short and operational.

Good examples:

- `Hoere den Satz an und schreibe ihn auf.`
- `Spiele den Satz ab und pruefe danach die Loesung.`

Avoid longer explanatory copy once the child is already in the task.

## Motion

Keep motion minimal and meaningful.

Recommended motion only:

- soft entrance fade/slide for the main practice surface
- quick visual state change when reveal is toggled
- subtle hover/focus response on desktop

Avoid:

- bouncing controls
- decorative floating effects
- large parallax or attention-seeking transitions

## Pure HTML5 Implementation Plan

This redesign should be implemented with the current static structure.

### HTML Changes

In `app/index.html`:

- flatten the practice structure so the outer `.panel` and inner `.practice-card` do not both act as major framed surfaces
- introduce visible text labels inside the primary action buttons
- keep semantic sections and buttons
- preserve accessibility labels even when visible labels are added

Possible structure direction:

- `.top-tabs`
- `.hero`
- `.practice-surface`
- `.practice-steps`
- `.practice-actions`
- `.reveal-panel`

### CSS Changes

In `app/style.css`:

- simplify surface hierarchy
- create a smaller set of spacing and radius rules
- enlarge button labels and reduce decorative padding
- rebalance heading size for tablet
- keep the layout centered and stable for laptop/tablet widths

### JavaScript Changes

In `app/app.js`:

- no major architecture change required
- update button text if playback state changes
- keep current tab logic
- keep current reveal logic
- preserve current audio and sentence data behavior

## QA Checklist

Review the redesign against these checks:

- the first laptop viewport shows one dominant exercise surface
- the title and instruction do not overpower the task
- the child can understand the three main actions without decoding icons
- the practice and words views feel like the same product
- the manage view feels secondary but visually consistent
- the tablet layout remains centered and spacious without excessive empty framing
- no framework, build step, or server dependency was introduced

## Suggested Implementation Order

1. simplify the practice view structure and spacing
2. replace icon-only controls with labeled actions
3. rebalance type scale and page hierarchy
4. align words view with the new practice surface
5. tidy manage view to match the new system

## Success Criteria

The redesign is successful if:

- the app feels like one focused dictation tool instead of nested cards
- the main action area is immediately legible on laptop and tablet
- the controls read as instructions, not symbols
- the UI stays lightweight and fully static
- the implementation remains plain HTML, CSS, and browser JavaScript
