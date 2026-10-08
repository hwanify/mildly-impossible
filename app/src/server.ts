import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { roomRequest } from "./lib/rooms.server";
import { jigsawApi, d1Store } from "./chores/jigsaw/api";
import { scoreApi } from "./lib/scores";
import type { D1Database } from "@cloudflare/workers-types";

// The multiplayer rooms' Durable Object class (app.manifest.json "durableObject": "Rooms").
export { Rooms } from "./lib/rooms.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // WebSocket upgrades for multiplayer rooms go straight to their room, before SSR.
      const room = await roomRequest(request, env);
      if (room) return room;
      // The worldwide tally of scores lives in D1 too.
      const score = await scoreApi(request, (env as { DB?: D1Database } | undefined)?.DB);
      if (score) return score;
      // The shared jigsaw's board lives in D1.
      if (new URL(request.url).pathname.startsWith("/api/jigsaw")) {
        const db = (env as { DB?: D1Database } | undefined)?.DB;
        if (!db) return new Response("No database", { status: 503 });
        const res = await jigsawApi(request, d1Store(db));
        if (res) return res;
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
