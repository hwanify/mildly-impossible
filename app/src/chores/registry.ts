import type { Chore } from "./types";

// Every chore lives in its own folder, `src/chores/<slug>/index.tsx`, exporting `chore`.
// The hub, the `/$slug` game route and the sitemap all read from this list, so adding
// a chore never touches a shared file.
const modules = import.meta.glob<{ chore: Chore }>("./*/index.tsx", { eager: true });

export const chores: Chore[] = Object.values(modules)
  .map((m) => m.chore)
  .sort((a, b) => (a.status === b.status ? b.added.localeCompare(a.added) : a.status === "live" ? -1 : 1));

export const liveChores = chores.filter((c) => c.status === "live" && c.Game);

export const newestSlug = liveChores[0]?.slug;

export const findChore = (slug: string) => liveChores.find((c) => c.slug === slug);
