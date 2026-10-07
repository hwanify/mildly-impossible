// Multiplayer rooms: one Durable Object per room, reached at /ws/<room> with a WebSocket.
// Each room runs a RoomHub (roomHub.ts) for its chore and keeps the shared state in storage.
// (A plain Durable Object class, without `cloudflare:workers`, so the Node dev server can load it.)
import type { DurableObjectNamespace, DurableObjectState, WebSocket as CfWebSocket } from "@cloudflare/workers-types";
import { RoomHub, type RoomKind } from "./roomHub";

// Every room a chore can open, by name. A chore adds its own (see roomHub.ts for what a room is).
const KINDS: Record<string, RoomKind<any>> = {};

const TICK_MS = 100;
const SAVE_MS = 2000;

declare const WebSocketPair: { new (): { 0: CfWebSocket; 1: CfWebSocket } };

/** Hand a /ws/<room> upgrade to that room's Durable Object; anything else returns null. */
export async function roomRequest(request: Request, env: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  const m = /^\/ws\/([a-z0-9-]{1,40})$/.exec(url.pathname);
  if (!m) return null;
  if (!KINDS[m[1]]) return new Response("No such room", { status: 404 });
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
  // The deploy names the binding after the class; find it rather than guess its exact name.
  const ns = Object.values((env ?? {}) as Record<string, unknown>).find(
    (v): v is DurableObjectNamespace => !!v && typeof (v as DurableObjectNamespace).idFromName === "function",
  );
  if (!ns) return new Response("Rooms are not set up", { status: 503 });
  const stub = ns.get(ns.idFromName(m[1]));
  return (await stub.fetch(request as never)) as unknown as Response;
}

export class Rooms {
  private hub: RoomHub<unknown> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private saved = 0;

  constructor(
    private ctx: DurableObjectState,
    private env: unknown,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const name = new URL(request.url).pathname.split("/")[2] ?? "";
    const kind = KINDS[name];
    if (!kind) return new Response("No such room", { status: 404 });
    if (!this.hub) {
      const stored = await this.ctx.storage.get("state");
      this.hub ??= new RoomHub(kind, stored, Date.now());
    }
    const hub = this.hub;
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    const member = hub.join((data) => server.send(data), Date.now());
    if (!member) {
      server.close(1013, "Room is full");
      return new Response(null, { status: 101, webSocket: client } as ResponseInit);
    }
    server.addEventListener("message", (e) => hub.message(member, e.data, Date.now()));
    const gone = () => {
      hub.leave(member);
      if (!hub.size) this.stop();
    };
    server.addEventListener("close", gone);
    server.addEventListener("error", gone);
    this.start();
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  private start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const hub = this.hub;
      if (!hub) return;
      const now = Date.now();
      hub.tick(now);
      if (hub.dirty && now - this.saved > SAVE_MS) this.save();
    }, TICK_MS);
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.save();
  }

  private save() {
    const hub = this.hub;
    if (!hub?.dirty) return;
    hub.dirty = false;
    this.saved = Date.now();
    void this.ctx.storage.put("state", hub.state);
  }
}
