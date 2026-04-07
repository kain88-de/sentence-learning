# HTML-Only Redesign Spec

## Product Intent

A static dictation practice app for children on tablets and laptops.

The interface should feel like one calm work surface with one clear next action and very little interpretation required.

Primary device priority:

- tablet landscape
- laptop
- tablet portrait as supported fallback

Implementation constraints:

- plain HTML
- plain CSS
- browser-side JavaScript only
- no framework
- no build step
- keep the three areas: `Üben`, `Wörter`, `Verwalten`

## Design Principles

- Instruction beats decoration.
- One dominant action per screen.
- Text labels are primary; icons are secondary.
- The active task should occupy most of the visible area.
- `Verwalten` should feel secondary to practice.
- Children should not need to decode symbols or UI metaphors.

## Information Architecture

Keep three top-level modes:

- `Üben`
- `Wörter`
- `Verwalten`

Global shell:

1. compact top tabs
2. short heading and instruction block
3. one active workspace surface

Do not introduce:

- sidebar navigation
- card-heavy dashboard layouts
- multiple stacked content sections competing for attention

## Screen 1: Üben

Purpose:

- hear a sentence
- write it down off-screen
- reveal and check it

### Layout

- top tabs
- short title and one-line instruction
- one large practice board

Inside the practice board:

1. step row
2. current instruction text
3. main action cluster
4. reveal area

### Content

Steps:

- `1 Hören`
- `2 Schreiben`
- `3 Prüfen`

Instruction examples:

- idle: `Höre den Satz an und schreibe ihn auf.`
- playing: `Schreibe auf, was du hörst.`
- paused: `Pausiert. Drücke auf Abspielen, wenn du bereit bist.`
- no sentence: `Füge unter Verwalten einen Satz hinzu, um zu beginnen.`

Controls:

- primary: `Abspielen`
- secondary: `Nochmal`
- secondary: `Lösung zeigen`

If pause remains necessary, the button text can switch:

- `Abspielen`
- `Pausieren`

The overall layout should still emphasize playback as the main action.

### Visual Behavior

- `Abspielen` is visibly larger than the other buttons.
- The reveal area is part of the same board, not a separate floating card.
- The revealed sentence uses large text and generous spacing.

## Screen 2: Wörter

Purpose:

- hear single words
- remember them
- reveal them

This view should be a sibling to `Üben`, not a separate visual system.

### Layout

Same shell as `Üben`.

Inside the board:

1. step row
2. one short instruction
3. word tile grid
4. action row
5. reveal area

### Content

Steps:

- `1 Hören`
- `2 Merken`
- `3 Prüfen`

Instruction examples:

- idle: `Tippe auf ein Feld und höre das Wort.`
- after a word: `Höre weiter oder prüfe danach die Wörter.`
- empty: `Es sind noch keine Wörter verfügbar.`

Actions:

- `Wörter zeigen`
- `Neue Wörter`

### Word Tiles

- 4 to 6 tiles visible comfortably on landscape tablet and laptop
- each tile shows a number and a play icon
- tiles must look obviously tappable or clickable

### Reveal Area

- same treatment as sentence reveal
- same spacing and same visual logic as `Üben`

## Screen 3: Verwalten

Purpose:

- add and remove sentences
- prepare the audio model if needed
- adjust playback speed
- keep debug secondary

Audience:

- likely parent, teacher, or helper, not the child in the main flow

This screen should be clearer and denser, but still belong to the same design system.

### Layout

Default structure:

- short heading block
- main content area
- secondary controls grouped separately

On laptop and tablet landscape:

- two-column workspace
- main column: sentence work
- secondary column: audio and settings

On tablet portrait:

- stack to one column

### Main Column

1. `Neuen Satz anlegen`
2. sentence form
3. `Verfügbare Sätze`
4. sentence list

### Secondary Column

1. `Stimme vorbereiten`
2. model status and progress
3. `Wiedergabe anpassen`
4. speed control
5. collapsed `Debug`

### Content

Heading support:

- `Bereite Audio vor, speichere neue Sätze und behalte deine Sammlung im Blick.`

Section labels:

- `Satzwerkstatt`
- `Sammlung`
- `Audio`
- `Tempo`

Section headings:

- `Neuen Satz anlegen`
- `Verfügbare Sätze`
- `Stimme vorbereiten`
- `Wiedergabe anpassen`

### Sentence Rows

- built-in entries: `Vorlage`
- user entries: `Eigen`
- delete button text: `Löschen`
- built-in rows use quiet status text like `Nur lesen`

## Visual System

### Color Roles

- background: warm paper wash
- surface: light cream
- primary action: coral or apricot
- support accent: muted green
- ink: deep slate or navy
- borders: soft low-contrast lines

Avoid more accent colors.

### Typography

- display face: friendly serif for title only
- UI face: legible sans for everything else

Use:

- smaller title than a landing page
- larger button labels than before
- operational copy, not promotional copy

### Shape Language

- rounded, but restrained
- one radius for large surfaces
- one smaller radius for controls
- avoid giving every element a separate pill personality

## Component Spec

### Top Tabs

- centered segmented row
- active tab filled
- inactive tabs quiet
- `Verwalten` slightly quieter when inactive

### Practice Surface

- max width narrower than a full desktop page
- centered
- generous vertical spacing
- should feel like a single board

### Buttons

- text-first buttons
- optional supporting icon
- primary button larger than peers
- minimum comfortable tablet tap size
- no symbol-only controls

### Reveal Panel

- integrated into board
- hidden or blurred by default
- stronger background shift when revealed
- text large enough to read at writing distance

### Word Tiles

- equal size
- readable numbers
- clear click and tap affordance
- consistent spacing

### Manage Sections

- bordered sections, not dashboard cards
- section heading plus brief support text
- controls grouped logically
- debug visually demoted

## Motion

Minimal only:

- soft fade or slide on surface appearance
- clear reveal-state transition
- subtle hover and focus feedback on desktop

Avoid:

- bounce
- float
- parallax
- ornamental animations

## Responsive Behavior

Primary target widths:

- laptop: `1200-1440`
- tablet landscape: `1024-1180`
- tablet portrait: `768-900`

Rules:

- `Üben` and `Wörter` should remain one centered board
- on wide screens, do not stretch the board too much horizontally
- on portrait, reduce headline size and keep content vertically stacked
- `Verwalten` becomes one column earlier than pure desktop dashboards would

## HTML Structure Proposal

For `Üben` and `Wörter`:

```html
<main class="deck">
  <nav class="top-tabs">...</nav>

  <header class="hero">
    <h1>Schreibübung</h1>
    <p class="intro">Höre zu und prüfe danach die Lösung.</p>
  </header>

  <section class="practice-view" data-view="practice">
    <article class="practice-surface">
      <div class="step-strip">...</div>
      <p class="prompt-state">...</p>
      <div class="control-row">...</div>
      <div class="reveal-panel">...</div>
    </article>
  </section>
</main>
```

For `Verwalten`:

```html
<section class="panel manage-view" data-view="manage" hidden>
  <div class="manage-head">...</div>

  <div class="manage-grid">
    <div class="manage-main">
      <section class="manage-section composer-section">...</section>
      <section class="manage-section sentence-library">...</section>
    </div>

    <aside class="manage-side">
      <section class="manage-section audio-lab">...</section>
      <section class="manage-section tune-section">...</section>
      <details class="debug">...</details>
    </aside>
  </div>
</section>
```

## CSS Strategy

Use a small, stable class system:

- `.deck`
- `.top-tabs`
- `.hero`
- `.practice-surface`
- `.step-strip`
- `.control-row`
- `.reveal-panel`
- `.manage-grid`
- `.manage-main`
- `.manage-side`
- `.manage-section`

Prefer:

- CSS Grid for macro layout
- Flex for rows and controls
- a narrow max width for practice boards
- a two-column manage layout only when width truly supports it

## JavaScript Expectations

No architecture change needed.

Keep:

- current tab switching
- current play and pause logic
- current reveal logic
- current sentence storage and deletion
- current speed and model preparation behavior

UI logic additions allowed:

- button text updates with play state
- clearer prompt strings
- maybe distinct `Nochmal` behavior if desired

## Copy Rules

Use short, direct German.
Avoid repeating the same instruction in multiple places.

Good:

- `Höre den Satz an und schreibe ihn auf.`
- `Tippe auf ein Feld und höre das Wort.`
- `Lösung zeigen`
- `Neue Wörter`

Avoid:

- long explanatory paragraphs
- abstract UI labels
- decorative text

## QA Acceptance Criteria

The redesign passes if:

- the first viewport shows one dominant board in `Üben`
- a child can understand the actions without decoding icons
- `Wörter` feels like the same app as `Üben`
- `Verwalten` is clearer and more secondary
- tablet landscape works comfortably
- tablet portrait remains clean and readable
- no framework or build tooling is introduced

## Implementation Plan

1. finalize shell and width strategy
2. finalize `Üben` board hierarchy
3. align `Wörter` to the same shell
4. restructure `Verwalten`
5. tighten copy and labels
6. run browser QA on laptop, tablet landscape, and portrait
