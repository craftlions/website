---
name: craftlions website
description: A plain technical client portal with line-drawn controls, neutral surfaces, and exact project data.
colors:
  paper-neutral: "#fafafa"
  ink-neutral: "#0a0a0a"
  panel-neutral: "#f5f5f5"
  dashed-line: "#d4d4d4"
  dashed-line-strong: "#a3a3a3"
  muted-text: "#404040"
  soft-text: "#737373"
  inverse-paper: "#0a0a0a"
  inverse-ink: "#fafafa"
  inverse-panel: "#171717"
  inverse-line: "#404040"
  link-blue: "#0369a1"
  link-blue-dark: "#7dd3fc"
  status-info: "#0369a1"
  status-success: "#047857"
  status-error: "#b91c1c"
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
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0"
rounded:
  none: "0px"
  sm: "4px"
  md: "6px"
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
    typography: "{typography.label}"
  badge-info:
    backgroundColor: "transparent"
    textColor: "{colors.status-info}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
    typography: "{typography.label}"
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
- Grid-based layouts, compact page widths, and table-first project data.
- System sans typography with clear weights instead of display styling.
- Flat components with visible focus, hover, disabled, and loading states.

## 2. Colors

The palette is a restrained paper-and-ink system: neutral structure first, link and status colors only where the user needs action or state.

### Primary

- **Ink Neutral**: the primary text and active mark color. Use it for body copy, headings, progress fill, checked controls, and high-confidence interface states.
- **Paper Neutral**: the primary page surface. Use it for the body background and quiet page sections.

### Secondary

- **Link Blue**: the action-link color. Use it for text links such as password recovery and legal/contact references, not for decorative emphasis.

### Tertiary

- **Status Green**: success or paid state.
- **Status Red**: error, cancelled, or budget-risk state.
- **Status Info**: informational project and phase state.

### Neutral

- **Panel Neutral**: low-emphasis hover and grouped-surface color.
- **Dashed Line**: the default line color for borders, dividers, tables, inputs, and empty states.
- **Dashed Line Strong**: the headline rule and stronger structural line color.
- **Muted Text**: secondary body text and table values.
- **Soft Text**: labels, metadata, placeholders, pagination status, and helper text.
- **Inverse Paper / Inverse Ink / Inverse Panel / Inverse Line**: dark-mode equivalents used with the same hierarchy.

### Named Rules

**The Line Before Color Rule.** Structure is drawn with neutral dashed lines before color is introduced. Color is reserved for links, status, focus, risk, and progress.

**The State Color Rule.** Blue, green, and red must map to information, success, and error/risk. Do not use state colors as decoration.

## 3. Typography

**Display Font:** system sans (`ui-sans-serif, system-ui, sans-serif`)
**Body Font:** system sans (`ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** no distinct label or mono font; numeric data uses tabular numerals where needed.

**Character:** The typography is utilitarian and exact. It uses a single system sans family, moderate weights, and small size steps so headings and tables stay readable without turning the client portal into a brand showpiece.

### Hierarchy

- **Display** (600, 1.875rem, 1.25): page h1 headings with a dashed left rule.
- **Headline** (600, 1.5rem, 1.333): major public-page section headings.
- **Title** (600, 1.25rem, 1.4): article titles, card headings, and compact section titles.
- **Body** (400, 1rem, 1.5): prose and explanatory text, with public prose kept around 65-75ch.
- **Label** (600, 0.875rem or 0.75rem, uppercase only for table and metric labels): section labels, table headers, form labels, badges, and buttons.

### Named Rules

**The One-Family Rule.** Product UI stays in one system sans family. Do not introduce display fonts for labels, buttons, tables, or data.

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
- **Default:** transparent background, 1px dashed neutral border, neutral text, compact padding (4px 12px), inline-grid alignment.
- **Hover / Focus:** hover darkens the border and adds a neutral fill; focus uses a visible 2px outline with offset.
- **Disabled:** disabled buttons keep their shape and drop to 50% opacity with a not-allowed cursor.

### Chips

Badges are state labels, not decoration.

- **Style:** transparent background, 1px dashed border, compact horizontal padding (4px 10px), text-xs, semibold, capitalized.
- **State:** info uses blue, success uses green, error uses red, gray uses neutral. The badge color must match state meaning.

### Cards / Containers

Containers are simple line planes.

- **Corner Style:** square by default (0px radius).
- **Background:** transparent on the page surface.
- **Shadow Strategy:** no shadows; see Elevation.
- **Border:** 1px dashed neutral border for panels, empty states, tables, and legal information blocks.
- **Internal Padding:** 16px for panels and empty states; 12-16px table cells.

### Inputs / Fields

Inputs follow the same line vocabulary as buttons.

- **Style:** transparent background, 1px dashed neutral border, 8px 12px padding, small text.
- **Focus:** border shifts to stronger neutral; outline is avoided on the input only where the border state is clear.
- **Placeholder / Disabled:** placeholder text is muted but must remain readable against the active surface.
- **Error:** error text uses status red and should be placed near the field it explains.

### Navigation

Navigation is a responsive grid with the logo on the left and compact session links on the right at larger widths. On small screens it stacks into a centered single-column grid. The logo scales from a compact app height to a larger marketing height, but the navigation controls stay compact and button-like.

### Tables

Tables are the main product surface for project, phase, invoice, and budget data.

- **Structure:** full-width tables with dashed outer borders and dashed row dividers.
- **Density:** compact but readable cells (12-16px vertical rhythm).
- **Headers:** semibold labels, often uppercase at text-xs.
- **Rows:** hover fills are neutral and subtle; status is shown through badges.
- **Overflow:** horizontal overflow is acceptable for dense data; do not crush columns until labels become ambiguous.

### Progress

Progress is used for budget state and remains literal.

- **Track:** transparent track with dashed neutral border.
- **Fill:** ink neutral by default, status red only when budget use exceeds the budget.
- **Pace Marker:** a thin neutral marker may show calendar pace, but it must not compete with the actual value.

## 6. Do's and Don'ts

### Do:

- **Do** use inline Tailwind utilities and grid layouts to match the existing project conventions.
- **Do** use 1px dashed neutral borders for structure, panels, tables, inputs, empty states, and buttons.
- **Do** keep product data exact, scannable, and close to its label.
- **Do** use neutral hover fills and visible focus outlines on interactive controls.
- **Do** preserve reduced-motion behavior; view transitions are only enabled for users without reduced-motion preference.
- **Do** keep semantic color rare and tied to state: blue for info/link, green for success, red for error/risk.

### Don't:

- **Don't** introduce overdesigned SaaS gloss.
- **Don't** create decorative dashboards.
- **Don't** use marketing-heavy component patterns in the client portal.
- **Don't** add novelty interactions or decorative motion.
- **Don't** add visual noise that makes routine client review feel more complex than it is.
- **Don't** make the product feel like a generic startup template or a showpiece at the expense of clarity.
- **Don't** pair dashed borders with soft shadows, glassmorphism, gradient text, rounded card stacks, or decorative illustrations.
