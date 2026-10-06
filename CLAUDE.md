# Mildly Impossible

Mouse-only browser toys about small household tasks that are technically possible (neal.fun style).
English UI, calm design, dry deadpan copy. Live at https://impossible-chores.higgsfield.app

## Stack and commands

- TanStack Start (React 19) app in `app/`, server-rendered into one Cloudflare Worker. Package manager: bun.
- In `app/`: `bun install`, `bun run dev`, `bun run typecheck`, `bun run build`.

## Where things are

- `app/src/chores/<slug>/index.tsx`: one folder per chore, exporting `chore` (title, blurb, description, `added` date, `status`, `Thumb`, `Game`). See `app/src/chores/types.ts`.
- `app/src/chores/registry.ts`: collects every chore folder with `import.meta.glob`. The hub, the game route and the sitemap all read from it.
- `app/src/routes/index.tsx`: hub page, renders the registry (live first, newest first; the newest live chore gets the "New" badge)
- `app/src/routes/$slug.tsx`: the single game route, `/<slug>` renders that chore's `Game` and sets its title/description
- `app/src/routes/sitemap[.]xml.ts`: lists `/` plus every live chore
- `app/src/game/*.ts`: engines for the first two games. Pure TypeScript + canvas 2D, fixed 1000x640 world scaled to the canvas.
  - `mug.ts`: Carry a Full Mug (hand spring, slosh model, spills and stains, swinging lamp, plant, cat, drop and shatter)
  - `fittedSheet.ts`: Fold a Fitted Sheet (verlet cloth on a triangle grid, elastic corners, fold layering, scoring)
- `app/src/components/chores/`: React wrappers and thumbnails for the first two games (they predate the per-chore folders and stay where they are)
- `app/src/site.css`: shared site styles, colour tokens on `:root`
- `app/src/app-meta.json`: site title, description, share image, favicon
- `app/public/assets/`: `og.png` (share image), `favicon.svg`
- `app/design-brief.md`: palette, type and tone

## Conventions

- Games are mouse-only via pointer events, so touch works too. Engines must not touch `window` or `document` at import time (SSR).
- Palette: warm paper `#F6F4EF`, ink `#1C1C1A`, muted `#6B6A65`, line `#E2DFD8`, denim `#4A5F78`. Fonts: Instrument Serif (display), Inter Tight (UI).
- Every game has a step checklist, short toast lines for events, and a result card with a big number plus a one-line tier. Reuse the shared classes in `site.css` (`.play`, `.stage`, `.steps`, `.toast`, `.result*`, `.btn-*`) so games look like one site.

## Adding a chore (several sessions work in parallel, one chore each)

Each session builds exactly one chore, on its own branch, touching only its own folder. That is what keeps parallel PRs from conflicting.

1. Branch from fresh `main`: `git fetch origin main && git checkout -b chore/<slug> origin/main`.
2. Create `app/src/chores/<slug>/` (lowercase, dashes; it becomes the URL) with:
   - `index.tsx`: `export const chore: Chore = { slug, title, blurb, description, added: "<today>", status: "live", Thumb, Game }`
   - `engine.ts`: game logic and canvas drawing (pure TS, no `window`/`document` at import time)
   - `Game.tsx`: React wrapper (canvas, pointer events, steps, toasts, result card). Copy the shape of `components/chores/MugGame.tsx`.
   - `Thumb.tsx`: hub card art, ideally a still frame drawn by the engine (see `components/chores/ChoreArt.tsx`)
   - `style.css` (only if needed): import as `import stylesheet from "./style.css?url"` and set `stylesheet` in `chore`. Prefix every class with the slug.
   - To build a chore that is listed as "soon" (e.g. `duvet-cover`), take over its existing folder and switch it to `"live"`.
3. Do not edit shared files: `routes/`, `chores/registry.ts`, `chores/types.ts`, `site.css`, `__root.tsx`, `app-meta.json`, `public/assets/og.png`, other chores' folders. If a shared change is really needed, make it a separate small PR so it does not ride along with a game.
4. Before opening the PR, in `app/`: `bun run build` (regenerates `src/routeTree.gen.ts`), then `bun run typecheck`. Both must pass. `bun run preview` serves the production build for a manual check; `bun run dev` currently fails at SSR (`module is not defined` from react) even on `main`, so use preview.
5. Open a PR to `main`. Before merging, merge the latest `main` into the branch and re-run build + typecheck.
6. Do not deploy from a game session. Deploys happen from one session, after merges (below).

## Shipping (Higgsfield)

Only one session deploys, and only from merged `main`, so two deploys never race on Higgsfield's checkout. Refresh `app/public/assets/og.png` (a screenshot of the hub) in that session when the hub has changed.

The live site is hosted by Higgsfield (website_id `ccd8efc1-8cac-46a0-8f07-44bdd8c0505c`). This GitHub repo is the working copy; Higgsfield keeps its own copy and only deploys from that one. With the Higgsfield MCP server connected:

1. Commit and push changes to this GitHub repo (`main`).
2. Call `website_repo_access` with `checkout`, then in `sandbox_exec` run `git pull https://github.com/hwanify/mildly-impossible.git main` inside the checkout path it returns.
3. Call `website_repo_access` with `push`, then `deploy_website`.

Leave the deploy values in `app/wrangler.jsonc` alone; Higgsfield's CI generates the real config. `.github/workflows` belongs to the Higgsfield template CI and needs a runner GitHub doesn't have, so Actions can be disabled on GitHub.
