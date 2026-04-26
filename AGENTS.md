# craftlions website

## Setup

Run these commands before making changes:

```shell
mise i
pn i
pn types
pn astro sync
```

## Hard Requirements

- Use inline Tailwind utility classes only; avoid standalone CSS rules or style blocks.
- Use CSS grid, never flexbox.
- Keep markup minimal and semantic.

## Validation

Run these commands after making changes:

```shell
pn biome check --write
pn types
pn astro sync
pn run check
```