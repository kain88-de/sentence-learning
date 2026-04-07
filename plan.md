# File-by-File Build Plan

## `app/index.html`

Goal: make the HTML match the redesign shell and section structure without changing the app architecture.

Planned work:

- keep the top-level tab navigation as the only persistent navigation
- keep one compact hero block with:
  - `h1`
  - one short supporting sentence
- standardize `Üben` and `Wörter` to use the same board structure:
  - `.practice-surface`
  - `.step-strip`
  - `.prompt-state`
  - `.control-row`
  - `.reveal-panel`
- in `Üben`, adjust the controls so the visible labels follow the spec:
  - `Abspielen`
  - `Nochmal`
  - `Lösung zeigen`
- in `Wörter`, align the visible labels to the same language pattern:
  - `Wörter zeigen`
  - `Neue Wörter`
- keep the reveal areas as part of the same board markup, not separate outer cards
- restructure `Verwalten` into:
  - `.manage-head`
  - `.manage-grid`
  - `.manage-main`
  - `.manage-side`
  - sentence form section
  - sentence library section
  - audio section
  - playback tuning section
  - collapsed debug section
- preserve IDs already used by JavaScript unless there is a strong reason to rename them

Expected outcome:

- HTML becomes semantically cleaner and easier to style
- practice and words share a visibly consistent skeleton
- manage becomes structurally separate from practice without becoming a new app

## `app/style.css`

Goal: define the full visual system and responsive behavior from the spec.

Planned work:

- create or normalize the core tokens:
  - background
  - surface
  - panel
  - accent
  - support accent
  - ink
  - border
  - shadow
- set the shell layout:
  - narrow centered deck
  - compact top tabs
  - compact heading block
  - one dominant board for `Üben` and `Wörter`
- tune typography:
  - serif only for title
  - sans for UI
  - larger button labels
  - smaller, calmer hero than before
- style tabs so:
  - active tab is clearly filled
  - inactive tabs are quieter
  - `Verwalten` is visually more secondary when inactive
- style `.practice-surface` as the main board:
  - centered
  - stable max width
  - generous spacing
  - integrated reveal panel
- make the action hierarchy explicit:
  - primary button larger
  - secondary buttons smaller but still readable
  - no symbol-led appearance
- make `.step-strip` instructional rather than decorative:
  - numbered chips
  - lower emphasis than main controls
- style `.word-grid` and `.word-tile` to feel parallel to practice
- style `Verwalten` as a workspace:
  - one-column by default for narrower or taller layouts
  - two columns only when width clearly supports it
  - audio and settings visibly secondary
- add restrained transitions:
  - reveal state
  - hover and focus
  - optional board entrance effect
- finalize breakpoints for:
  - laptop
  - tablet landscape
  - tablet portrait

Expected outcome:

- the product feels like one coherent tool
- landscape tablet and laptop work well
- portrait remains readable
- controls are obvious for children

## `app/app.js`

Goal: keep the existing behavior but update the UI strings and control behavior to match the redesign.

Planned work:

- update prompt copy to the shorter operational wording from the spec
- update visible button labels to match the new HTML:
  - play and pause text
  - repeat text if `Nochmal` is introduced
  - reveal text
  - words actions
- keep tab switching logic unchanged
- keep reveal logic unchanged
- keep sentence loading, saving, and deleting unchanged
- keep audio model preparation and speed logic unchanged
- if needed, split the current random or reload action into clearer UI language:
  - practice: `Nochmal` vs `Neuer Satz`
  - words: `Neue Wörter`
- ensure the state text still reflects:
  - idle
  - preparing
  - paused
  - playing
  - empty state
- avoid introducing architecture changes or new dependencies

Expected outcome:

- the JavaScript stays small and stable
- the UI language becomes clearer
- state changes remain easy to follow

## `docs/html-redesign-spec.md`

Goal: keep this as the source of truth while implementing.

Planned use:

- validate naming and layout decisions against the spec
- keep copy aligned
- use the QA section as signoff criteria

## Execution Order

1. update `app/index.html` to match the target structure
2. rebuild `app/style.css` around the final shell, board, and manage workspace
3. adjust `app/app.js` labels and prompt strings to fit the new markup
4. run `bun run check`
5. review in browser at:
   - laptop
   - tablet landscape
   - tablet portrait
