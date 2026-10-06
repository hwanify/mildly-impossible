# Mildly Impossible

Mouse-only browser toys about small household tasks that are technically possible (neal.fun style).
English UI, calm design, dry deadpan copy. Live at https://impossible-chores.higgsfield.app

## Stack and commands

- TanStack Start (React 19) app in `app/`, server-rendered into one Cloudflare Worker. Package manager: bun.
- In `app/`: `bun install`, `bun run dev`, `bun run typecheck`, `bun run build`.

## Where things are

- `app/src/routes/index.tsx`: hub page (task cards)
- `app/src/routes/mug.tsx`, `app/src/routes/fitted-sheet.tsx`: game pages
- `app/src/game/*.ts`: game engines. Pure TypeScript + canvas 2D, fixed 1000x640 world scaled to the canvas.
  - `mug.ts`: Carry a Full Mug (hand spring, slosh model, spills and stains, swinging lamp, plant, cat, drop and shatter)
  - `fittedSheet.ts`: Fold a Fitted Sheet (verlet cloth on a triangle grid, elastic corners, fold layering, scoring)
- `app/src/components/chores/`: React wrappers (canvas, pointer events, toasts, result card) and hub thumbnails (`ChoreArt.tsx`)
- `app/src/site.css`: all site styles, colour tokens on `:root`
- `app/src/app-meta.json`: site title, description, share image, favicon
- `app/public/assets/`: `og.png` (share image), `favicon.svg`
- `app/design-brief.md`: palette, type and tone

## Conventions

- Games are mouse-only via pointer events, so touch works too. Engines must not touch `window` or `document` at import time (SSR).
- Palette: warm paper `#F6F4EF`, ink `#1C1C1A`, muted `#6B6A65`, line `#E2DFD8`, denim `#4A5F78`. Fonts: Instrument Serif (display), Inter Tight (UI).
- Every game has a step checklist, short toast lines for events, and a result card with a big number plus a one-line tier.
- New routes go into `app/src/routes/sitemap[.]xml.ts`. Refresh `app/public/assets/og.png` when the hub changes.

## Shipping (Higgsfield)

The live site is hosted by Higgsfield (website_id `ccd8efc1-8cac-46a0-8f07-44bdd8c0505c`). This GitHub repo is the working copy; Higgsfield keeps its own copy and only deploys from that one. With the Higgsfield MCP server connected:

1. Commit and push changes to this GitHub repo (`main`).
2. Call `website_repo_access` with `checkout`, then in `sandbox_exec` run `git pull https://github.com/hwanify/mildly-impossible.git main` inside the checkout path it returns.
3. Call `website_repo_access` with `push`, then `deploy_website`.

Leave the deploy values in `app/wrangler.jsonc` alone; Higgsfield's CI generates the real config. `.github/workflows` belongs to the Higgsfield template CI and needs a runner GitHub doesn't have, so Actions can be disabled on GitHub.
