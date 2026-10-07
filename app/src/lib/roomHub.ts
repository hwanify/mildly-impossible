// A shared room for multiplayer chores: everyone's position, plus one shared state that every
// visitor changes. Pure TypeScript (no Worker or browser APIs), so the Durable Object in
// rooms.server.ts runs it for real and a local stand-in can run it in development.
//
// Wire format, JSON both ways:
//   client → room  {t:"p", p:[numbers]}       my presence (position, facing, gesture…)
//                  {t:"do", ...}              an action on the shared state (the chore decides)
//   room → client  {t:"hi", id, now, s}       welcome: your id, the room's clock, the state
//                  {t:"ps", now, ps:[[id, ...p]]} everyone's presence, a few times a second
//                  {t:"s", now, s}            the shared state, when it changed
//                  {t:"ev", ...}              a one-off event (the chore decides)

export type Presence = number[];

export type RoomKind<S> = {
  /** A fresh state for a room nobody has been in. */
  init(now: number): S;
  /** A state read back from storage (may be from an older version), or null to start over. */
  revive(raw: unknown, now: number): S | null;
  /** Apply one action from a member. Return true if the state changed. */
  act(s: S, who: string, msg: Record<string, unknown>, now: number): boolean;
  /** Let time pass. Return whether the state changed, and any events to send everyone.
   *  `observer` is a page keeping its own copy up to date between updates from the room: it
   *  doesn't know where everybody is, so it mustn't act on who seems to be missing. */
  tick(s: S, now: number, people: Map<string, Presence>, observer?: boolean): { changed: boolean; events?: object[] };
};

export type Member = { id: string; send: (data: string) => void; p: Presence | null; budget: number; seen: number };

const MAX_MSG = 800;
const MAX_MEMBERS = 150;
const MAX_FIELDS = 8;
// messages a member may send per second, on average
const RATE = 24;
// the shared state goes out at most this often
const STATE_MS = 250;

export class RoomHub<S> {
  members = new Set<Member>();
  state: S;
  /** The state changed since it was last saved. */
  dirty = false;
  private sentState = true;
  private moved = false;
  private lastPs = 0;
  private lastState = 0;

  constructor(
    private kind: RoomKind<S>,
    stored: unknown,
    now: number,
  ) {
    this.state = (stored !== undefined && stored !== null && kind.revive(stored, now)) || kind.init(now);
  }

  get size() {
    return this.members.size;
  }

  join(send: (data: string) => void, now: number): Member | null {
    if (this.members.size >= MAX_MEMBERS) return null;
    const m: Member = { id: newId(), send, p: null, budget: RATE, seen: now };
    this.members.add(m);
    this.kind.tick(this.state, now, this.people());
    m.send(JSON.stringify({ t: "hi", id: m.id, now, s: this.state }));
    return m;
  }

  leave(m: Member) {
    this.members.delete(m);
    this.moved = true;
  }

  message(m: Member, raw: unknown, now: number) {
    if (typeof raw !== "string" || raw.length > MAX_MSG) return;
    // a leaky bucket: refills at RATE per second
    m.budget = Math.min(RATE, m.budget + ((now - m.seen) / 1000) * RATE);
    m.seen = now;
    if (m.budget < 1) return;
    m.budget -= 1;
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object" || Array.isArray(msg)) return;
    const o = msg as Record<string, unknown>;
    if (o.t === "p") {
      const p = o.p;
      if (!Array.isArray(p) || p.length > MAX_FIELDS || !p.every((v) => typeof v === "number" && Number.isFinite(v))) return;
      m.p = p.map((v) => Math.round(v * 10) / 10);
      this.moved = true;
    } else if (o.t === "do") {
      this.kind.tick(this.state, now, this.people());
      if (this.kind.act(this.state, m.id, o, now)) this.changed();
    }
  }

  /** Call a few times a second: lets time pass and sends out what changed. */
  tick(now: number) {
    const r = this.kind.tick(this.state, now, this.people());
    if (r.changed) this.changed();
    for (const ev of r.events ?? []) this.broadcast(JSON.stringify(ev));
    // the state when it changed, at most a few times a second
    if (!this.sentState && now - this.lastState >= STATE_MS) {
      this.sentState = true;
      this.lastState = now;
      this.broadcast(JSON.stringify({ t: "s", now, s: this.state }));
    }
    // presence when someone moved, and once a second regardless (it doubles as a clock sync)
    if (this.moved || now - this.lastPs > 1000) {
      this.moved = false;
      this.lastPs = now;
      const ps: (string | number)[][] = [];
      for (const m of this.members) if (m.p) ps.push([m.id, ...m.p]);
      this.broadcast(JSON.stringify({ t: "ps", now, ps }));
    }
  }

  people() {
    const out = new Map<string, Presence>();
    for (const m of this.members) if (m.p) out.set(m.id, m.p);
    return out;
  }

  private changed() {
    this.dirty = true;
    this.sentState = false;
  }

  private broadcast(data: string) {
    for (const m of this.members) {
      try {
        m.send(data);
      } catch {
        /* closing; the close handler removes it */
      }
    }
  }
}

function newId() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b, (v) => "abcdefghijkmnpqrstuvwxyz23456789"[v % 32]).join("");
}
