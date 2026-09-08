// Realtime multiplayer (§1–§8).
//
//   Transport
//   ├── LocalTransport      (dev/split-test, snapshot in localStorage)
//   └── FirebaseTransport   (production: Firebase RTDB session + family nodes,
//                            anonymous-auth identity, presence with onDisconnect,
//                            host-approved membership; localStorage snapshot cache)
//
// Production automatically uses Firebase when VITE_FIREBASE_* env exists.
// Mission-critical convergence lives in roomState.ts (monotonic reducer);
// transports only move bytes + snapshots.

import type { HeroId } from './save';
import {
  initialShared as baseInitial,
  mergeSnapshot,
  serializeSnapshot,
  deserializeSnapshot,
  snapshotKey,
  type SharedState
} from './roomState';
import { getFirebaseDb, hasFirebase, ensureAnonAuth } from './firebaseClient';
import {
  roomPaths,
  memberPath,
  presencePath,
  joinRequestPath,
  splitSharedState,
  isFamilyKey,
  validateJoinRequest,
  validateNetEventShape,
  isSlotTaken,
  pruneableEvents,
  type PresenceRow,
  type MemberRow,
  type SessionSlice
} from './firebaseRoom';

export type { SharedState };
export { initialShared } from './roomState';
export { makeEventId } from './ids';
export type { MissionEventType } from './roomState';

// ---- wire event (§5): every mission action carries identity + idempotency key ----
export interface NetEvent {
  eventId: string; // idempotency key — processing twice has no effect
  roomId: string;
  playerId: string;
  hero: HeroId | 'system';
  eventType: string; // canonical name (== kind)
  kind: string; // legacy alias kept for scene compat
  from: HeroId | 'system'; // legacy alias kept for scene compat
  payload: Record<string, unknown>;
  timestamp: number;
  at: number; // legacy alias
}

export interface PresencePeer {
  playerId: string;
  hero: HeroId;
}

export type ConnStatus = 'connected' | 'reconnecting' | 'waiting';

export interface Transport {
  readonly name: string;
  readonly roomCode: string;
  readonly playerId: string;
  /** Stable authenticated identity once connected (anon-auth uid); else the construction id. */
  identityId?(): string;
  connect(): Promise<void>;
  broadcastState(patch: Partial<SharedState>): void;
  broadcastEvent(ev: Partial<NetEvent> & { kind: string }): void;
  /** Ask peers/host for the canonical snapshot (safe to call any time). */
  requestResync(): void;
  /** Persist current full snapshot now (called on important transitions). */
  snapshotNow(state: SharedState): void;
  onState(cb: (patch: Partial<SharedState>) => void): void;
  onEvent(cb: (ev: NetEvent) => void): void;
  onSnapshot(cb: (snap: SharedState) => void): void;
  onPresence(cb: (peers: PresencePeer[]) => void): void;
  onStatus(cb: (s: ConnStatus) => void): void;
  /** First-claim-wins hero slot; prevents two Jacksons in family flow (§6).
   *  isHost creates the room (and its secret); joiners receive it via the join flow. */
  claimHero(hero: HeroId, isHost?: boolean): Promise<'ok' | 'taken'>;
  heartbeat(hero: HeroId): void;
  /** Test hook (§8 Test H): artificial outbound latency, 0 = off. */
  setLatencyMs(ms: number): void;
  dispose(): void;
}

function normalizeEvent(roomId: string, playerId: string, ev: Partial<NetEvent> & { kind: string }): NetEvent {
  const now = Date.now();
  const hero = (ev.hero ?? ev.from ?? 'system') as HeroId | 'system';
  return {
    eventId: ev.eventId ?? `${now}-${Math.random().toString(36).slice(2, 8)}`,
    roomId: ev.roomId ?? roomId,
    playerId: ev.playerId ?? playerId,
    hero,
    eventType: ev.eventType ?? ev.kind,
    kind: ev.kind,
    from: (ev.from ?? hero) as HeroId | 'system',
    payload: ev.payload ?? {},
    timestamp: ev.timestamp ?? ev.at ?? now,
    at: ev.at ?? ev.timestamp ?? now
  };
}

function loadCachedSnapshot(room: string): SharedState | null {
  try {
    const raw = localStorage.getItem(snapshotKey(room));
    return raw ? deserializeSnapshot(raw) : null;
  } catch {
    return null;
  }
}

function cacheSnapshot(room: string, s: SharedState): void {
  try {
    localStorage.setItem(snapshotKey(room), serializeSnapshot(s));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------- Local ---
export class LocalTransport implements Transport {
  readonly name = 'local';
  readonly roomCode: string;
  readonly playerId: string;
  private hero: HeroId = 'jackson';
  private ch: BroadcastChannel | null = null;
  private stateCbs: Array<(p: Partial<SharedState>) => void> = [];
  private eventCbs: Array<(e: NetEvent) => void> = [];
  private snapshotCbs: Array<(s: SharedState) => void> = [];
  private presenceCbs: Array<(p: PresencePeer[]) => void> = [];
  private statusCbs: Array<(s: ConnStatus) => void> = [];
  private seenEvents = new Set<string>();
  private peers = new Map<string, { hero: HeroId; at: number }>();
  private timer = 0;
  private latencyMs = 0;
  private full: SharedState;

  constructor(room: string, playerId = 'local-dev', hero: HeroId = 'jackson') {
    this.roomCode = room;
    this.playerId = playerId;
    this.hero = hero;
    this.full = { ...baseInitial(room) };
    const cached = loadCachedSnapshot(room);
    if (cached) this.full = mergeSnapshot(this.full, cached);
  }

  async connect(): Promise<void> {
    try {
      this.ch = new BroadcastChannel(`sq-${this.roomCode}`);
      this.ch.onmessage = (m) => this.handle(m.data);
    } catch {
      this.ch = null;
    }
    window.addEventListener('storage', this.onStorage);
    this.timer = window.setInterval(() => this.prune(), 3000);
    this.emitStatus('connected');
    // stagger to let the other tab answer with its snapshot
    window.setTimeout(() => this.requestResync(), 400);
  }

  private onStorage = (e: StorageEvent): void => {
    if (e.key === `sq-${this.roomCode}` && e.newValue) {
      try { this.handle(JSON.parse(e.newValue)); } catch { /* ignore */ }
    }
  };

  private send(msg: unknown): void {
    const deliver = (): void => {
      try { this.ch?.postMessage(msg); } catch { /* closed */ }
      try { localStorage.setItem(`sq-${this.roomCode}`, JSON.stringify(msg)); } catch { /* ignore */ }
    };
    if (this.latencyMs > 0) window.setTimeout(deliver, this.latencyMs);
    else deliver();
  }

  private handle(msg: { t: string; [k: string]: unknown }): void {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'state') {
      this.full = { ...this.full, ...(msg.patch as Partial<SharedState>) };
      this.stateCbs.forEach((cb) => cb(msg.patch as Partial<SharedState>));
    } else if (msg.t === 'event') {
      const ev = msg.ev as NetEvent;
      if (!ev || this.seenEvents.has(ev.eventId)) return; // idempotent (§5)
      this.seenEvents.add(ev.eventId);
      this.eventCbs.forEach((cb) => cb(ev));
    } else if (msg.t === 'beat') {
      const p = msg.peer as PresencePeer;
      if (p && p.playerId !== this.playerId) {
        this.peers.set(p.playerId, { hero: p.hero, at: Date.now() });
        this.emitPresence();
      }
    } else if (msg.t === 'snapshot-request') {
      if (msg.fromId !== this.playerId) {
        this.send({ t: 'snapshot-state', toId: msg.fromId, snap: this.full });
      }
    } else if (msg.t === 'snapshot-state') {
      if ((msg.toId as string) === this.playerId || (msg.toId as string) === '*') {
        const snap = msg.snap as SharedState;
        if (snap && snap.session === this.roomCode) {
          this.full = mergeSnapshot(this.full, snap);
          this.snapshotCbs.forEach((cb) => cb(this.full));
        }
      }
    }
  }

  broadcastState(patch: Partial<SharedState>): void {
    this.full = { ...this.full, ...patch, rev: (this.full.rev ?? 0) + 1 };
    cacheSnapshot(this.roomCode, this.full);
    this.send({ t: 'state', patch });
  }

  broadcastEvent(ev: Partial<NetEvent> & { kind: string }): void {
    const full = normalizeEvent(this.roomCode, this.playerId, ev);
    if (!ev.hero && !ev.from) full.hero = this.hero;
    if (!ev.from && ev.hero) full.from = ev.hero as HeroId | 'system';
    if (this.seenEvents.has(full.eventId)) return;
    this.seenEvents.add(full.eventId);
    this.send({ t: 'event', ev: full });
  }

  requestResync(): void {
    this.send({ t: 'snapshot-request', fromId: this.playerId });
  }

  snapshotNow(state: SharedState): void {
    this.full = { ...state, rev: Math.max(this.full.rev ?? 0, state.rev ?? 0) + 1 };
    cacheSnapshot(this.roomCode, this.full);
    this.send({ t: 'snapshot-state', toId: '*', snap: this.full });
  }

  onState(cb: (p: Partial<SharedState>) => void): void { this.stateCbs.push(cb); }
  onEvent(cb: (e: NetEvent) => void): void { this.eventCbs.push(cb); }
  onSnapshot(cb: (s: SharedState) => void): void { this.snapshotCbs.push(cb); }
  onPresence(cb: (p: PresencePeer[]) => void): void { this.presenceCbs.push(cb); }
  onStatus(cb: (s: ConnStatus) => void): void { this.statusCbs.push(cb); }
  identityId(): string { return this.playerId; }

  async claimHero(hero: HeroId): Promise<'ok' | 'taken'> {
    this.hero = hero;
    try {
      const key = `sq-claim-${this.roomCode}`;
      const raw = localStorage.getItem(key);
      const claims = (raw ? JSON.parse(raw) : {}) as Record<string, string>;
      if (claims[hero] && claims[hero] !== this.playerId) return 'taken';
      claims[hero] = this.playerId;
      localStorage.setItem(key, JSON.stringify(claims));
    } catch { /* ignore */ }
    return 'ok';
  }

  heartbeat(hero: HeroId): void {
    this.hero = hero;
    this.send({ t: 'beat', peer: { playerId: this.playerId, hero } });
    this.emitPresence();
  }

  setLatencyMs(ms: number): void { this.latencyMs = ms; }

  private emitPresence(): void {
    const list: PresencePeer[] = [...this.peers.entries()].map(([playerId, p]) => ({ playerId, hero: p.hero }));
    this.presenceCbs.forEach((cb) => cb(list));
  }

  private emitStatus(s: ConnStatus): void {
    this.statusCbs.forEach((cb) => cb(s));
  }

  private prune(): void {
    const now = Date.now();
    let changed = false;
    for (const [k, t] of this.peers) {
      if (now - t.at > 12000) { this.peers.delete(k); changed = true; }
    }
    if (changed) this.emitPresence();
  }

  dispose(): void {
    clearInterval(this.timer);
    window.removeEventListener('storage', this.onStorage);
    this.ch?.close();
  }
}

// ------------------------------------------------------------- Firebase ---
// Room isolation: the 4-digit code is rendezvous, NOT authorization.
// Identity is Firebase Anonymous Auth (stable per-tablet uid, no login).
// Game data (session + family) is gated by membership records enforced in
// database.rules.json; a code alone only lets a tablet file a join request,
// which the host tablet approves. Presence uses connection state +
// onDisconnect() so ghosts clear even on crash/sleep.

import {
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue,
  onChildAdded,
  onDisconnect,
  runTransaction,
  serverTimestamp,
  query,
  orderByChild,
  startAt,
  type Database,
  type Unsubscribe
} from 'firebase/database';

const PRESENCE_STALE_MS = 120_000;
const EVENT_PRUNE_MS = 120_000;
const JOIN_WAIT_MS = 20_000;

export class FirebaseTransport implements Transport {
  readonly name = 'firebase';
  readonly roomCode: string;
  playerId: string;
  private hero: HeroId;
  private authUid: string | null = null;
  private db: Database | null = null;
  private unsubs: Unsubscribe[] = [];
  private wiringDone = false;
  private isMember = false;
  private stateCbs: Array<(p: Partial<SharedState>) => void> = [];
  private eventCbs: Array<(e: NetEvent) => void> = [];
  private snapshotCbs: Array<(s: SharedState) => void> = [];
  private presenceCbs: Array<(p: PresencePeer[]) => void> = [];
  private statusCbs: Array<(s: ConnStatus) => void> = [];
  private seenEvents = new Set<string>();
  private full: SharedState;
  private latencyMs = 0;
  private pruneTimer = 0;
  private presenceCache: Record<string, PresenceRow> = {};
  private membersCache: Record<string, MemberRow> = {};
  private membershipWaiters: Array<() => void> = [];

  constructor(room: string, playerId: string, hero: HeroId = 'jackson') {
    this.roomCode = room;
    this.playerId = playerId;
    this.hero = hero;
    this.full = { ...baseInitial(room) };
    const cached = loadCachedSnapshot(room);
    if (cached) this.full = mergeSnapshot(this.full, cached);
  }

  async connect(): Promise<void> {
    this.emitStatus('reconnecting');
    // Stable authenticated identity: anonymous auth, no kid login step.
    try {
      const user = await ensureAnonAuth();
      this.authUid = user.uid;
      this.playerId = user.uid;
    } catch {
      // Offline: lobby proceeds on the local snapshot cache (offline-first).
      this.emitStatus('waiting');
      window.setTimeout(() => this.requestResync(), 300);
      return;
    }
    const db = getFirebaseDb();
    if (!db) {
      this.emitStatus('waiting');
      window.setTimeout(() => this.requestResync(), 300);
      return;
    }
    this.db = db;
    if (!this.wiringDone) {
      this.wiringDone = true;
      this.wireConnectionState();
      this.wireSession();
      this.wireFamily();
      this.wireEvents();
      this.wirePresenceList();
      this.wireMembers();
      this.wireOwnMembership();
      this.pruneTimer = window.setInterval(() => void this.pruneEvents(), 60_000);
    }
    await this.assertPresence();
    await this.pullSnapshots();
    this.requestResync();
  }

  // ---- listeners (attached once; re-fire automatically on reconnect) ----

  private track(unsub: Unsubscribe): void {
    this.unsubs.push(unsub);
  }

  private wireConnectionState(): void {
    const db = this.db;
    if (!db) return;
    this.track(
      onValue(ref(db, '.info/connected'), (snap) => {
        if (snap.val() === true) {
          this.emitStatus('connected');
          void this.assertPresence();
          void this.pullSnapshots();
        } else {
          this.emitStatus('reconnecting');
        }
      })
    );
  }

  private wireSession(): void {
    const db = this.db;
    if (!db) return;
    const P = roomPaths(this.roomCode);
    this.track(
      onValue(ref(db, P.session), (snap) => {
        const v = snap.val() as Record<string, unknown> | null;
        if (!v || typeof v !== 'object') return;
        const patch = diffSession(this.full, v);
        if (Object.keys(patch).length === 0) return; // own echo or no-op
        this.full = { ...this.full, ...patch };
        cacheSnapshot(this.roomCode, this.full);
        this.stateCbs.forEach((cb) => cb(patch));
      })
    );
  }

  private wireFamily(): void {
    const db = this.db;
    if (!db) return;
    const P = roomPaths(this.roomCode);
    this.track(
      onValue(ref(db, P.family), (snap) => {
        const v = snap.val() as Record<string, unknown> | null;
        if (!v || typeof v !== 'object') return;
        const merged = mergeSnapshot(this.full, { ...this.full, ...v } as SharedState);
        if (JSON.stringify(pickFamily(merged)) === JSON.stringify(pickFamily(this.full))) return;
        this.full = merged;
        cacheSnapshot(this.roomCode, this.full);
        this.snapshotCbs.forEach((cb) => cb(this.full));
      })
    );
  }

  private wireEvents(): void {
    const db = this.db;
    if (!db) return;
    const P = roomPaths(this.roomCode);
    // Only events created after we attach: state converges via session/family,
    // so a missed delta only ever costs a cosmetic effect, never progress.
    const recent = query(ref(db, P.events), orderByChild('timestamp'), startAt(Date.now()));
    this.track(
      onChildAdded(recent, (snap) => {
        const ev = snap.val() as NetEvent | null;
        if (!ev || !validateNetEventShape(ev)) return;
        if (this.seenEvents.has(ev.eventId)) return; // idempotent
        this.seenEvents.add(ev.eventId);
        if (this.seenEvents.size > 2000) this.seenEvents.clear();
        this.eventCbs.forEach((cb) => cb(ev));
      })
    );
  }

  private wirePresenceList(): void {
    const db = this.db;
    if (!db) return;
    const P = roomPaths(this.roomCode);
    this.track(
      onValue(ref(db, P.presence), (snap) => {
        const v = (snap.val() ?? {}) as Record<string, PresenceRow>;
        this.presenceCache = v && typeof v === 'object' ? v : {};
        this.emitPresence();
      })
    );
  }

  private wireMembers(): void {
    const db = this.db;
    if (!db) return;
    const P = roomPaths(this.roomCode);
    this.track(
      onValue(ref(db, P.members), (snap) => {
        const v = (snap.val() ?? {}) as Record<string, MemberRow>;
        this.membersCache = v && typeof v === 'object' ? v : {};
      })
    );
  }

  private wireOwnMembership(): void {
    const db = this.db;
    if (!db) return;
    this.track(
      onValue(ref(db, memberPath(this.roomCode, this.authUid ?? this.playerId)), (snap) => {
        if (!snap.exists()) return;
        const first = !this.isMember;
        this.isMember = true;
        for (const w of this.membershipWaiters.splice(0)) {
          try { w(); } catch { /* ignore */ }
        }
        if (first) {
          void this.assertPresence();
          void this.pullSnapshots();
        }
      })
    );
  }

  private setStatus(s: ConnStatus): void {
    this.emitStatus(s);
  }

  private emitStatus(s: ConnStatus): void {
    this.statusCbs.forEach((cb) => cb(s));
  }

  private emitPresence(): void {
    const list: PresencePeer[] = [];
    for (const [uid, row] of Object.entries(this.presenceCache)) {
      if (uid !== this.playerId && row && (row.hero === 'jackson' || row.hero === 'layla')) {
        list.push({ playerId: uid, hero: row.hero });
      }
    }
    this.presenceCbs.forEach((cb) => cb(list));
  }

  /** Assert our presence row + arm server-side clearing for crash/sleep. */
  private async assertPresence(): Promise<void> {
    const db = this.db;
    const uid = this.authUid;
    if (!db || !uid) return;
    const row = { hero: this.hero, at: serverTimestamp() as unknown as number };
    try {
      await set(ref(db, presencePath(this.roomCode, uid)), row);
    } catch {
      return; // room may not exist yet (host pre-create) — retried after claimHero
    }
    try {
      await onDisconnect(ref(db, presencePath(this.roomCode, uid))).remove();
    } catch { /* ignore */ }
  }

  private delayed(ms: number, run: () => void): void {
    if (this.latencyMs > 0) window.setTimeout(run, this.latencyMs);
    else run();
  }

  broadcastState(patch: Partial<SharedState>): void {
    // Optimistic local apply first (offline-safe); RTDB write-through after.
    this.full = { ...this.full, ...patch, rev: (this.full.rev ?? 0) + 1 };
    cacheSnapshot(this.roomCode, this.full);
    const db = this.db;
    if (!db) return;
    const P = roomPaths(this.roomCode);
    const sPatch: Record<string, unknown> = {};
    const fPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (isFamilyKey(k)) fPatch[k] = v;
      else sPatch[k] = v;
    }
    // Session and family live under separate nodes.
    this.delayed(0, () => {
      if (Object.keys(sPatch).length > 0) {
        void update(ref(db, P.session), sPatch).catch(() => undefined);
      }
      if (Object.keys(fPatch).length > 0) {
        void update(ref(db, P.family), fPatch).catch(() => undefined);
      }
    });
  }

  broadcastEvent(ev: Partial<NetEvent> & { kind: string }): void {
    const full = normalizeEvent(this.roomCode, this.playerId, { hero: this.hero, from: this.hero, ...ev });
    if (this.seenEvents.has(full.eventId)) return;
    this.seenEvents.add(full.eventId);
    const db = this.db;
    if (!db) return;
    const P = roomPaths(this.roomCode);
    this.delayed(0, () => {
      void push(ref(db, P.events), full as unknown as Record<string, unknown>).catch(() => undefined);
    });
  }

  requestResync(): void {
    // RTDB has no peer messaging: resync = re-read the canonical nodes.
    void this.pullSnapshots();
  }

  snapshotNow(state: SharedState): void {
    this.full = { ...state, rev: Math.max(this.full.rev ?? 0, state.rev ?? 0) + 1 };
    cacheSnapshot(this.roomCode, this.full);
    const db = this.db;
    if (!db) return;
    const P = roomPaths(this.roomCode);
    const { session, family } = splitSharedState(this.full);
    void set(ref(db, P.session), session as unknown as Record<string, unknown>).catch(() => undefined);
    void set(ref(db, P.family), family as unknown as Record<string, unknown>).catch(() => undefined);
    void this.pruneEvents();
  }

  private async pullSnapshots(): Promise<void> {
    const db = this.db;
    if (!db) return;
    try {
      const P = roomPaths(this.roomCode);
      const [ss, fs] = await Promise.all([get(ref(db, P.session)), get(ref(db, P.family))]);
      const sv = ss.val() as Record<string, unknown> | null;
      const fv = fs.val() as Record<string, unknown> | null;
      if ((!sv || typeof sv !== 'object') && (!fv || typeof fv !== 'object')) return;
      let next = this.full;
      if (sv && typeof sv === 'object') next = mergeSnapshot(next, { ...next, ...sv } as SharedState);
      if (fv && typeof fv === 'object') next = mergeSnapshot(next, { ...next, ...fv } as SharedState);
      if (JSON.stringify(next) === JSON.stringify(this.full)) return;
      this.full = next;
      cacheSnapshot(this.roomCode, this.full);
      this.snapshotCbs.forEach((cb) => cb(this.full));
    } catch {
      // Offline or not yet a member: the localStorage cache already merged. Retry later.
    }
  }

  private async pruneEvents(): Promise<void> {
    const db = this.db;
    if (!db || !this.isMember) return;
    try {
      const P = roomPaths(this.roomCode);
      const snap = await get(ref(db, P.events));
      const val = (snap.val() ?? {}) as Record<string, { timestamp?: unknown }>;
      if (!val || typeof val !== 'object') return;
      const ids = pruneableEvents(val, Date.now(), EVENT_PRUNE_MS);
      const entries = Object.entries(val).sort(
        (a, b) => Number((a[1] as { timestamp?: unknown })?.timestamp ?? 0) - Number((b[1] as { timestamp?: unknown })?.timestamp ?? 0)
      );
      if (entries.length > 250) {
        for (const [id] of entries.slice(0, entries.length - 200)) {
          if (!ids.includes(id)) ids.push(id);
        }
      }
      if (ids.length === 0) return;
      const nulled: Record<string, null> = {};
      for (const id of ids) nulled[id] = null;
      await update(ref(db, P.events), nulled);
    } catch { /* best effort */ }
  }

  async claimHero(hero: HeroId, isHost = false): Promise<'ok' | 'taken'> {
    this.hero = hero;
    try {
      const user = await ensureAnonAuth();
      this.authUid = user.uid;
      this.playerId = user.uid;
    } catch {
      return 'ok'; // offline-first: lobby proceeds on cache
    }
    const db = getFirebaseDb();
    if (!db) return 'ok';
    this.db = db;
    const uid = this.authUid as string;
    const P = roomPaths(this.roomCode);

    // Fast path: a live peer already holding this hero blocks the slot.
    try {
      const ps = (await get(ref(db, P.presence))).val() as Record<string, PresenceRow> | null;
      if (ps) this.presenceCache = ps;
      if (isSlotTaken(this.presenceCache, hero, uid, Date.now(), PRESENCE_STALE_MS)) return 'taken';
    } catch { /* room may not exist yet — host creates it below */ }

    if (isHost) {
      try {
        if (await this.createRoomOnce(hero)) {
          this.isMember = true;
          this.attachApprover();
          await this.assertPresence();
          await this.pullSnapshots();
          return 'ok';
        }
      } catch { /* exists or denied → fall through to join path */ }
      // Re-run as host if the stored meta names us (e.g. after refresh).
      try {
        const meta = (await get(ref(db, P.meta))).val() as { hostUid?: unknown } | null;
        if (meta && meta.hostUid === uid) {
          this.attachApprover();
        }
      } catch { /* ignore */ }
    }
    return this.joinRoom(hero);
  }

  /** Host creates the room exactly once (transaction). Returns true if WE created it. */
  private async createRoomOnce(hero: HeroId): Promise<boolean> {
    const db = this.db;
    const uid = this.authUid;
    if (!db || !uid) return false;
    const P = roomPaths(this.roomCode);
    const init = baseInitial(this.roomCode);
    const { session, family } = splitSharedState(init);
    try {
      const res = await runTransaction(ref(db, P.room), (cur: unknown) => {
        if (cur !== null && cur !== undefined) return undefined; // already exists — abort
        return {
          meta: { hostUid: uid, createdAt: Date.now() },
          members: { [uid]: { hero, at: Date.now() } },
          session: session as unknown as Record<string, unknown>,
          family: family as unknown as Record<string, unknown>
        };
      });
      return res.committed === true;
    } catch {
      return false;
    }
  }

  /** Joiner files a request; the host approves it into membership. */
  private async joinRoom(hero: HeroId): Promise<'ok' | 'taken'> {
    const db = this.db;
    const uid = this.authUid;
    if (!db || !uid) return 'ok';
    const deadline = Date.now() + JOIN_WAIT_MS;
    // 1. File the join request (retry while the host is still creating the room).
    let filed = false;
    while (!filed && Date.now() < deadline) {
      if (this.isMember) { filed = true; break; }
      try {
        await set(ref(db, joinRequestPath(this.roomCode, uid)), {
          hero,
          at: serverTimestamp() as unknown as number
        });
        filed = true;
      } catch {
        if (await this.slotTakenLive(hero)) return 'taken';
        await sleep(1500);
      }
    }
    if (!filed && !this.isMember) return 'ok'; // offline-ish: proceed on cache, approval lands later
    // 2. Wait for the host's approval to appear as our membership row.
    while (Date.now() < deadline) {
      if (this.isMember) break;
      try {
        const ms = (await get(ref(db, memberPath(this.roomCode, uid)))).val();
        if (ms) break;
      } catch { /* ignore */ }
      if (await this.slotTakenLive(hero)) {
        try {
          await remove(ref(db, joinRequestPath(this.roomCode, uid)));
        } catch { /* ignore */ }
        return 'taken';
      }
      await sleep(1000);
    }
    await this.assertPresence();
    await this.pullSnapshots();
    // Timeout with a free slot: proceed optimistically; the standing
    // membership listener completes the join (resync) when approval lands.
    return 'ok';
  }

  private async slotTakenLive(hero: HeroId): Promise<boolean> {
    const db = this.db;
    const uid = this.authUid;
    if (!db || !uid) return false;
    try {
      const P = roomPaths(this.roomCode);
      const ps = (await get(ref(db, P.presence))).val() as Record<string, PresenceRow> | null;
      if (ps) {
        this.presenceCache = ps;
        this.emitPresence();
      }
      return isSlotTaken(this.presenceCache, hero, uid, Date.now(), PRESENCE_STALE_MS);
    } catch {
      return false;
    }
  }

  /** Host approves join requests into membership (code alone grants nothing). */
  private approverAttached = false;

  private attachApprover(): void {
    const db = this.db;
    if (!db || this.approverAttached) return;
    this.approverAttached = true;
    const P = roomPaths(this.roomCode);
    this.track(
      onValue(ref(db, P.joinRequests), (snap) => {
        const reqs = (snap.val() ?? {}) as Record<string, { hero?: unknown; at?: unknown }>;
        if (!reqs || typeof reqs !== 'object') return;
        void this.approveRequests(reqs);
      })
    );
  }

  private async approveRequests(reqs: Record<string, { hero?: unknown; at?: unknown }>): Promise<void> {
    const db = this.db;
    const uid = this.authUid;
    if (!db || !uid) return;
    const P = roomPaths(this.roomCode);
    for (const [reqUid, req] of Object.entries(reqs)) {
      if (reqUid === uid) {
        try {
          await remove(ref(db, joinRequestPath(this.roomCode, reqUid)));
        } catch { /* ignore */ }
        continue;
      }
      if (!validateJoinRequest(req)) {
        try {
          await remove(ref(db, joinRequestPath(this.roomCode, reqUid)));
        } catch { /* ignore */ }
        continue;
      }
      const hero = req.hero as HeroId;
      const heldByOther = Object.entries(this.membersCache).some(
        ([mUid, m]) => mUid !== reqUid && m && (m.hero as HeroId) === hero
      );
      const liveTaken = isSlotTaken(this.presenceCache, hero, reqUid, Date.now(), PRESENCE_STALE_MS);
      try {
        if (!heldByOther && !liveTaken) {
          await set(ref(db, memberPath(this.roomCode, reqUid)), {
            hero,
            at: serverTimestamp() as unknown as number
          });
        }
        await remove(ref(db, joinRequestPath(this.roomCode, reqUid)));
      } catch { /* rules or offline — request stays pending for next pass */ }
    }
  }

  onState(cb: (p: Partial<SharedState>) => void): void { this.stateCbs.push(cb); }
  onEvent(cb: (e: NetEvent) => void): void { this.eventCbs.push(cb); }
  onSnapshot(cb: (s: SharedState) => void): void { this.snapshotCbs.push(cb); }
  onPresence(cb: (p: PresencePeer[]) => void): void { this.presenceCbs.push(cb); }
  onStatus(cb: (s: ConnStatus) => void): void { this.statusCbs.push(cb); }
  identityId(): string { return this.authUid ?? this.playerId; }

  heartbeat(hero: HeroId): void {
    this.hero = hero;
    void this.assertPresence();
  }

  setLatencyMs(ms: number): void { this.latencyMs = ms; }

  dispose(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = 0;
    }
    for (const off of this.unsubs.splice(0)) {
      try { off(); } catch { /* ignore */ }
    }
    // Best-effort goodbye; onDisconnect also clears us server-side on crash.
    try {
      const db = this.db;
      const uid = this.authUid;
      if (db && uid) {
        void remove(ref(db, presencePath(this.roomCode, uid))).catch(() => undefined);
        void onDisconnect(ref(db, presencePath(this.roomCode, uid))).cancel().catch(() => undefined);
      }
    } catch { /* ignore */ }
    this.db = null;
  }
}

// ---- module helpers (pure) ----

function sleep(ms: number): Promise<void> {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Shallow diff of an incoming session slice against local state. */
function diffSession(full: SharedState, incoming: Record<string, unknown>): Partial<SharedState> {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (isFamilyKey(k)) continue;
    const cur = (full as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(cur) !== JSON.stringify(v)) patch[k] = v;
  }
  return patch as Partial<SharedState>;
}

function pickFamily(s: SharedState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const rec = s as unknown as Record<string, unknown>;
  out['pets'] = rec['pets'];
  out['starLedger'] = rec['starLedger'];
  out['restoration'] = rec['restoration'];
  out['decorations'] = rec['decorations'];
  out['trophies'] = rec['trophies'];
  out['completedMissions'] = rec['completedMissions'];
  out['claimed'] = rec['claimed'];
  out['crownPieces'] = rec['crownPieces'];
  return out;
}

export function createTransport(room: string, playerId = 'local-dev', hero: HeroId = 'jackson'): Transport {
  if (hasFirebase()) return new FirebaseTransport(room, playerId, hero);
  return new LocalTransport(room, playerId, hero);
}
