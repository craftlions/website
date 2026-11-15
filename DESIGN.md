---
name: craftlions website
description: A plain technical client portal with line-drawn controls, neutral surfaces, and exact project data.
colors:
  paper-neutral: "#fafafa"
  ink-neutral: "#0a0a0a"
  panel-neutral: "#f5f5f5"
  dashed-line: "#d4d4d4"
  dashed-line-strong: "#a3a3a3"
  dashed-line-control: "#737373"
  dashed-line-active: "#525252"
  focus-ring: "#404040"
  muted-text: "#525252"
  inverse-paper: "#0a0a0a"
  inverse-ink: "#fafafa"
  inverse-panel: "#171717"
  inverse-line: "#404040"
  inverse-line-strong: "#525252"
  inverse-line-control: "#737373"
  inverse-line-active: "#d4d4d4"
  inverse-muted: "#a3a3a3"
  inverse-focus-ring: "#d4d4d4"
  link-blue: "#0369a1"
  link-blue-dark: "#7dd3fc"
  status-info: "#0369a1"
  status-info-dark: "#7dd3fc"
  status-success: "#047857"
  status-success-dark: "#6ee7b7"
  status-error: "#b91c1c"
  status-error-dark: "#fca5a5"
  status-warning: "#b45309"
  status-warning-dark: "#fcd34d"
  status-line-error: "#ef4444"
  status-line-success: "#34d399"
  status-line-info: "#7dd3fc"
  fill-error: "#b91c1c"
  fill-error-dark: "#f87171"
  fill-success: "#10b981"
  fill-success-dark: "#34d399"
  fill-info: "#0ea5e9"
  fill-info-dark: "#38bdf8"
  info-subtle: "#e0f2fe99"
  info-subtle-dark: "#082f4980"
  chart-categorical: ["#1d4ed8", "#0e7490", "#c2410c", "#be185d", "#6d28d9", "#047857"]
  chart-categorical-dark: ["#93c5fd", "#67e8f9", "#fdba74", "#f9a8d4", "#c4b5fd", "#6ee7b7"]
  chart-unassigned: "#737373"
  chart-unassigned-dark: "#a3a3a3"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "0"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0"
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  body-small:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.429
    letterSpacing: "0"
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.429
    letterSpacing: "0"
  caption:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "0"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  page: "48px"
components:
  button-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink-neutral}"
    rounded: "{rounded.none}"
    padding: "4px 12px"
    typography: "{typography.label}"
  button-hover:
    backgroundColor: "{colors.panel-neutral}"
    textColor: "{colors.ink-neutral}"
    rounded: "{rounded.none}"
    padding: "4px 12px"
    typography: "{typography.label}"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink-neutral}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
    typography: "{typography.body-small}"
  badge-info:
    backgroundColor: "transparent"
    textColor: "{colors.status-info}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
    typography: "{typography.caption}"
---

# Design System: craftlions website

## 1. Overview

**Creative North Star: "The Technical Ledger"**

The craftlions interface should feel like a careful technical ledger: plain, exact, and useful under repeated client review. The system is intentionally restrained, with neutral surfaces, dashed linework, compact spacing, and direct labels carrying the experience instead of decorative treatments.

The visual language supports freelance clients who are checking project state, phases, invoices, and budget details. It should make the work easier to trust by making structure obvious: rows, sections, dividers, labels, and controls are drawn with the same light hand across the public site and authenticated portal.

This system explicitly rejects overdesigned SaaS gloss, decorative dashboards, marketing-heavy component patterns, novelty interactions, and visual noise. It is allowed to be quiet; it is not allowed to be vague.

**Key Characteristics:**

- Neutral light and dark surfaces with a small set of semantic state colors.
- Dashed borders as the primary structural material.
- Grid-based layouts with a wide two-column dashboard; public surfaces stay compact single-column.
- System sans typography with clear weights instead of display styling.
- Flat components with visible focus, hover, disabled, and loading states.

**Layout:** Public pages and the settings area stay compact and single-column at a `max-w-3xl` container with a `pl-3` left gutter. The authenticated dashboard widens to `max-w-6xl`. Client pages render through `ClientShell` (navigation, breadcrumbs, a `header` slot, footer), the way admin pages use `AdminShell`; an organization's pages render through `ClientOrgShell`, which adds the organization heading and its section tabs (Overview, Invoices, Spend by year). The overview puts the full-width Worklist first, then a two-column grid at `lg` and up: Projects in a wide leading column (`2fr`) and Budget in a narrow one (`1fr`). Below `lg` they stack in that order.

## 2. Colors

The palette is a restrained paper-and-ink system: neutral structure first, link and status colors only where the user needs action or state.

### Primary

- **Ink Neutral**: the primary text and active mark color. Use it for body copy, headings, progress fill, checked controls, and high-confidence interface states.
- **Paper Neutral**: the primary page surface. Use it for the body background and quiet page sections.

### Secondary

- **Link Blue**: the action-link color. Use it for text links such as password recovery and legal/contact references, not for decorative emphasis.

### Tertiary

- **Status Green**: success or paid state.
- **Status Red**: error, cancelled, or budget-risk state. Its outline (`line-danger`) is the boundary of an invalid or destructive input, so it holds 3:1 on canvas.
- **Status Info**: informational project and phase state.
- **Status Warning** (amber, `text-fg-warning`): needs attention, not an error. It marks something the admin should check, such as an invoice total that differs from its cost part or attached invoices Stripe cannot return right now; text only, with no outline or fill.

### Neutral

- **Panel Neutral**: low-emphasis hover and grouped-surface color.
- **Dashed Line**: the default line color for borders, dividers, tables, and empty states.
- **Dashed Line Strong**: the headline rule and stronger structural line color.
- **Dashed Line Control**: the boundary of a control the user operates: input and select borders, the checkbox outline, and the progress track. It holds 3:1 against canvas and panel in both schemes, because that line is the only thing that shows the control is there.
- **Dashed Line Active**: the hover, focus, and pressed border of a control.
- **Focus Ring**: the global `:focus-visible` outline.
- **Muted Text**: secondary text of every kind: body copy, table values, labels, metadata, placeholders, and helper text. There is one muted tier; express further hierarchy with size or weight.
- **Inverse Paper / Inverse Ink / Inverse Panel / Inverse Line / Inverse Line Strong / Inverse Line Control / Inverse Line Active / Inverse Muted / Inverse Focus Ring**: dark-mode equivalents used with the same hierarchy.

### Named Rules

**The Line Before Color Rule.** Structure is drawn with neutral dashed lines before color is introduced. Color is reserved for links, status, focus, risk, progress, and categorical data in charts. Structural lines stay light; the line that alone marks a control is `line-control`, which holds 3:1 (WCAG 1.4.11).

**The State Color Rule.** Blue, green, amber, and red must map to information, success, needs-attention, and error/risk. Amber means needs attention, not an error: use red when something is wrong or overdue. Do not use state colors as decoration. The one exception is the spend chart's categorical hatch marks, which use the chart palette and encode data, not state (see Data Visualization).

### Role Tokens

Classes say what something is, never how it looks. Values live in `src/styles/tokens.css` as plain custom properties with `light-dark()`, so one class covers both color schemes; `src/styles/global.css` maps them to Tailwind utilities. Each role exists only on its own utility, so `text-fg` works and `bg-fg` does not. The Tailwind color palette is removed: a class such as `text-neutral-500` renders nothing, and `aubr design:lint` rejects it. That command also runs Impeccable's detector and fails if a `tokens.css` value is missing from this file's frontmatter, so token changes land in both places.

Biome is excluded from this file because it flattens the YAML frontmatter that Impeccable reads.

| Utility                                           | Use for                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `text-fg`                                         | Primary text and values                                                      |
| `text-fg-muted`                                   | All secondary text, including placeholders                                   |
| `text-fg-danger`, `-success`, `-info`, `-warning` | Status text and text links (`-info`)                                         |
| `bg-canvas`                                       | The page, and anything that must cover it                                    |
| `bg-panel`                                        | Hover and grouped fills                                                      |
| `bg-ink`                                          | Solid marks: progress fill, checked controls, pace marker                    |
| `bg-fill-danger`, `-success`, `-info`             | Status fills; also on `border-`                                              |
| `bg-info-subtle`                                  | Tinted highlight of a linked target                                          |
| `outline-fill-info`                               | Dashed outline of a linked target, with `bg-info-subtle`                     |
| `border-line`                                     | Default structure, also `divide-line`                                        |
| `border-line-strong`                              | Headline rules, gray badges, also `bg-` and `decoration-`                    |
| `border-line-control`                             | Input, select and checkbox outlines and the progress track (3:1)             |
| `border-line-active`                              | Hover, focus, and pressed borders                                            |
| `border-line-danger`, `-success`, `-info`         | Status outlines                                                              |
| `border-canvas`                                   | Pace marker edge                                                             |
| `text-chart-1`…`6`, `text-chart-unassigned`       | Spend chart only                                                             |

A new token is a design decision: add it to `tokens.css`, `global.css`, and this table together. The dev-only `/design` page reads `tokens.css`, so it shows the new token with its contrast ratios automatically; add new primitives to it by hand.

Give an element one role per property, and choose between roles with a ternary. Tailwind orders utilities itself, not by class order, so stacking `text-fg-muted` with a conditional `text-fg-danger` lets the wrong one win.

Focus is global. Every focusable element gets the `:focus-visible` outline in `--focus` from the base layer; do not remove it or restyle it per component.

### Data Visualization

The spend chart is the portal's single colored data surface. It stays a chart, not a dashboard carnival: one categorical palette, assigned in stable order, with meaning carried by pattern plus the legend and the exact-amounts table.

- **Categorical series** (`chart-categorical`, dark `chart-categorical-dark`): project segments render as **diagonal hatching** (a 135° repeating linear gradient) in muted ink colors at reduced opacity (70% light, 80% dark), cycled in stable order; repeat when a year holds more projects than the palette. The hatch pattern, not a solid fill, separates one project from another.
- **Unassigned** (`chart-unassigned`): phase-less spend stays a neutral gray so it reads as "not a project" and is drawn open (no fill).
- **State colors keep their meaning everywhere, including the chart**: never use status hues for segments or fills.
- **Color is never the only code**: bars carry their exact year total as text, each bar labels its year, the legend maps a hatch swatch to its project name, and the exact-amounts table holds the numbers.
- **Negative adjustments**: the chart cannot draw them. When any bar holds negative spend, a note appears and directs the reader to the exact amounts for the complete breakdown.

## 3. Typography

**Display Font:** system sans (`ui-sans-serif, system-ui, sans-serif`)
**Body Font:** system sans (`ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** no distinct label or mono font; numeric data uses tabular numerals where needed.

**Character:** The typography is utilitarian and exact. It uses a single system sans family, two weights, and small size steps so headings and tables stay readable without turning the client portal into a brand showpiece.

### Hierarchy

- **Display** (`text-display`; 600, 1.875rem, 1.25): page h1 headings with a dashed left rule, always through `src/components/PageHeading.astro`.
- **Headline** (`text-headline`; 600, 1.5rem, 1.333): major public-page section headings.
- **Title** (`text-title`; 600, 1.25rem, 1.4): article titles, card headings, and compact section titles.
- **Body** (400, 1rem, 1.5): prose and explanatory text, with public prose kept around 65-75ch.
- **Small body** (`text-sm`; 400, 0.875rem): table cells, inputs, metadata, and helper text.
- **Label** (`text-label` at 0.875rem; 600): form labels, buttons, and inline labels.
- **Label caps** (`label-caps`; 600, 0.75rem, uppercase, muted): page section headings (h2 and the h3 that heads a section's list), table headers, and metric labels. It already sets the muted color, so do not rebuild it from `text-label uppercase text-fg-muted`.
- **Caption** (`text-caption`; 600, 0.75rem, 1.333): badges and other single-word state marks.

Each role carries its size, weight, and line height together, so do not add `font-*` to it. The one `leading-*` exception is `leading-none`, in tight metric rows and in boxes sized around a single line: the badge (`text-caption leading-none`) and the hint button. Add it as `leading-none`, never as a `/none` size modifier, which drops the role's weight. Other text uses `text-sm` or `text-xs`; `aubr design:lint` rejects larger steps and arbitrary sizes.

### Named Rules

**The One-Family Rule.** Product UI stays in one system sans family. Do not introduce display fonts for labels, buttons, tables, or data.

**The Two Weights Rule.** Text is 400 or 600; there is no 500. 600 comes only from a role class (`text-display`, `text-headline`, `text-title`, `text-label`, `text-caption`, `label-caps`). Row names, item headings in dense lists, amounts, and totals are body text at 400; they stand out by `text-fg` against muted text and by size, not by weight. Table header cells take their weight from `label-caps`; row header cells are body text, because the base layer resets the browser's bold `th`. A muted note next to a label sits outside the role: wrap the label text in `text-label` instead of overriding the weight of a child.

**The Exact Numbers Rule.** Amounts, percentages, and invoice data use tabular numerals when they need comparison.

## 4. Elevation

This system is flat by default. It does not use shadows to create hierarchy; depth is conveyed with dashed borders, spacing, table rows, hover fills, and dark-mode tonal inversion. A surface that needs attention should gain clearer structure or better copy before it gains a shadow.

### Named Rules

**The No Shadow Rule.** Shadows are forbidden for normal cards, tables, buttons, and inputs. If a future overlay truly needs elevation, keep it structural and minimal, never glossy.

**The Dashed Plane Rule.** A container is a plane drawn with a 1px dashed neutral border and transparent background. Do not pair this with soft drop shadows.

## 5. Components

### Buttons

Buttons are compact, transparent, and line-drawn.

- **Shape:** square corners by default (0px radius).
- **Default:** transparent background, 1px dashed neutral border, neutral text in the label role (`text-label`, 600), compact padding (4px 12px), inline-grid alignment.
- **Hover / Focus:** hover darkens the border and adds a neutral fill; focus uses a visible 2px outline with offset.
- **Pressed:** set `aria-pressed` and the button styles itself, like hover.
- **Disabled:** disabled buttons keep their shape, drop to 50% opacity with a not-allowed cursor, and do not react to hover.
- **Component:** every action is `src/components/Button.astro`; `aubr design:lint` rejects a raw `<button>`. It renders `<a>` with `href`.
- **Danger:** `variant="danger"` draws the border and text in status red. It is for the one button that starts a destructive action, such as Delete client; inside dense rows a destructive trigger stays `quiet` and the danger style moves to the confirmation.
- **Quiet:** `variant="quiet"` is a muted text link (see Links) for secondary actions in dense admin rows.
- **Hint:** `variant="hint"` is the 1rem square that opens a tooltip.

### Links

A text link is its text with a dashed underline, never a box.

- **Recipe:** the `link` class in `src/styles/global.css` draws the dashed underline (4px offset); do not spell it out with `underline decoration-dashed`. The quiet Button and the breadcrumbs use it too.
- **Hover:** the underline turns solid and the text keeps its color, so primary, status and `text-fg-info` links keep their meaning. A link that can rest in muted text, including one that inherits it from a muted row, adds `hover:text-fg` as its only hover color. Only decoration and color change, so hovering never moves layout.
- **Color:** a link inherits its text color or takes one role by ternary; `text-fg-info` marks links in public and account prose.

### Disclosure

A form or extra panel opens from a button, never from a heading or a native `<details>` summary.

- **Component:** `src/components/DisclosureButton.astro` is a Button with `aria-expanded`, `aria-controls` and a chevron that turns when open. Pass the panel's id as `controls`; the page renders the panel with `hidden={!open}` and the same `open`.
- **Placement:** a section's primary action sits on the right of its heading row (`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3`), and its form opens below the heading and description. A row's extra panel spans the row.
- **Server state:** the panel renders open after its form failed, so the typed values and field errors are back in view, and a create form starts open while its list is empty.
- **Focus:** opening moves focus to the panel's first field. A quiet Cancel (`data-disclosure-cancel`) next to the submit resets the form, closes the panel and returns focus to the button. The submit repeats the button's label.

### Confirmations

Every destructive or irreversible action is confirmed in a native modal dialog.

- **Component:** `src/components/ConfirmAction.astro` renders the trigger Button and the dialog inside the action's form. Dialog ids are unique per page.
- **Copy:** the title names the action and its object ("Archive Website relaunch?"), the text names the consequence, and the confirm button repeats the trigger. Cancel reads "Keep …" for destructive actions and "Go back" for acting on a client's behalf.
- **Weight:** `confirmVariant="danger"` (default) for destructive actions, `default` for deliberate steps that destroy nothing. `typeToConfirm` adds a field the admin must fill with the given text; use it only when the dialog's button is the form's sole submit.
- **Validity:** the trigger reports the form's first invalid field before the dialog opens, because the open dialog makes the form behind it inert.

### Chips

Badges are state labels, not decoration.

- **Style:** transparent background, 1px dashed border, compact horizontal padding (4px 10px), `text-caption`, sentence case.
- **State:** info uses blue, success uses green, error uses red, gray uses neutral. The badge color must match state meaning.
- **Vocabulary:** admin labels and badge types come only from `src/lib/status.ts`. Info means the admin has to act, gray means waiting on the client or inactive, success means done, error means overdue or cancelled.

### Cards / Containers

Containers are simple line planes.

- **Corner Style:** square by default (0px radius).
- **Background:** transparent on the page surface.
- **Shadow Strategy:** no shadows; see Elevation.
- **Border:** 1px dashed neutral border for panels, empty states, tables, and legal information blocks.
- **Internal Padding:** 16px for panels and empty states; 12-16px table cells.

### Inputs / Fields

Inputs follow the same line vocabulary as buttons.

- **Style:** transparent background, 1px dashed `line-control` border, 8px 12px padding, small text.
- **Component:** use `src/components/Field.astro` for every labelled control: a `text-label` label, the `Input`, an optional hint and the error, linked with `aria-describedby`. Pass the action's result as `result`, and the field shows that action's error for its name and, after a failed submit, the value that was typed. `src/components/Input.astro` is the bare control, with `as="select"` for selects and `danger` for destructive confirmations.
- **Focus:** border shifts to stronger neutral, in addition to the global focus outline.
- **Placeholder / Disabled:** placeholder text is muted but must remain readable against the active surface.
- **Read-only:** `Input` draws a `readonly` input's value in `text-fg-muted` inside the same dashed box, like a calculated output, so it reads as shown rather than editable; it stays focusable and its value selectable. Its hint says why it is locked.
- **Error:** error text uses status red and should be placed near the field it explains.

### Action Feedback

A form action's outcome shows once, at the top of the page, below the page heading.

- **Component:** `src/components/ActionBanner.astro`, rendered by the admin shells from their `results` and `fieldLabels`. Pages never render their own result paragraph.
- **Success:** a `role="status"` line in status green that says what happened, as a sentence ending in a period ("Phase sent to client."). An action reports the same text on every page; never a generic "Saved.".
- **Error:** a `role="alert"` plane in status red. Input errors list each field by its label; server errors get a generic retry sentence instead of the raw message.

### Navigation

Navigation is a responsive grid with the logo on the left and compact session links on the right at larger widths. On small screens it stacks into a centered single-column grid. The logo scales from a compact app height to a larger marketing height, but the navigation controls stay compact and button-like. It sits in the shared `max-w-6xl` (dashboard) or `max-w-3xl` (public/settings) header, matching the page column it leads.

- **Groups:** signed-in links form two groups. Work destinations (Dashboard, and Admin for admins) are default Buttons; the account group (Account, Logout) is quiet Buttons, set apart by a wider gap. A future Search trigger sits between the two groups. Logout is hidden while viewing as a client.
- **Dashboard:** on a client page it leads to that organization's dashboard, otherwise to `/dash`, which lists the member's organizations.
- **Current:** a link to the page itself carries `aria-current="page"`; a link to the section the page lies in carries `aria-current="true"`. Both draw the pressed style; a quiet link turns primary with a solid underline.
- **Sections:** an area with several pages (an admin organization, a client organization, the account settings) tabs them below its heading with default Buttons, in `AdminOrgShell`, `ClientOrgShell` and `SettingsShell`. A client organization's overview answers what waits on the client, where the projects stand and how much budget is used; the full invoice history and spend by year are reference pages behind their own tabs.

**Breadcrumbs** (`src/components/Breadcrumbs.astro`) lead admin and client pages below the navigation: muted links (`link hover:text-fg`) separated by slashes, with the current page in primary text and `aria-current="page"`. They render only when there is a parent to go back to. Client pages start at the organization, with an Organizations crumb to `/dash` for members of several organizations.

### Tables

Tables are the main product surface for project, phase, invoice, and budget data.

- **Structure:** full-width tables with dashed outer borders and dashed row dividers.
- **Density:** compact but readable cells (12-16px vertical rhythm).
- **Headers:** semibold uppercase labels using the `label-caps` class.
- **Rows:** hover fills are neutral and subtle; status is shown through badges. Row headers and amounts are body text in `text-fg` (see The Two Weights Rule).
- **Overflow:** horizontal overflow is acceptable for dense data; do not crush columns until labels become ambiguous.

### Progress

Progress is used for budget state and remains literal.

- **Component:** `src/components/Progress.astro` takes the used `percent` and, for the pace marker, the months elapsed as `pace`; pass the accessible name as `aria-label`.
- **Track:** transparent track with a dashed `line-control` border.
- **Fill:** ink neutral by default, status red only when budget use exceeds the budget.
- **Pace Marker:** a thin neutral marker may show calendar pace, but it must not compete with the actual value.

## 6. Do's and Don'ts

### Do:

- **Do** use inline Tailwind utilities built on role tokens, and grid layouts, to match the existing project conventions.
- **Do** use 1px dashed neutral borders for structure, panels, tables, inputs, empty states, and buttons.
- **Do** keep product data exact, scannable, and close to its label.
- **Do** use neutral hover fills and visible focus outlines on interactive controls.
- **Do** preserve reduced-motion behavior; view transitions are only enabled for users without reduced-motion preference.
- **Do** keep semantic color rare and tied to state: blue for info/link, green for success, amber for needs attention, red for error/risk; only the spend chart adds muted ink hatch marks for data (see Data Visualization).

### Don't:

- **Don't** introduce overdesigned SaaS gloss.
- **Don't** create decorative dashboards.
- **Don't** use marketing-heavy component patterns in the client portal.
- **Don't** add novelty interactions or decorative motion.
- **Don't** add visual noise that makes routine client review feel more complex than it is.
- **Don't** make the product feel like a generic startup template or a showpiece at the expense of clarity.
- **Don't** pair dashed borders with soft shadows, glassmorphism, gradient text, rounded card stacks, or decorative illustrations.
