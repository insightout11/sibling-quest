// Pure Firebase room helpers — NO firebase SDK imports, so networking tests
// can exercise them in plain node. The transport (net.ts) uses these for all
// path layout, session/family splitting, and membership validation, mirroring
// database.rules.json.
//
// Data model (RTDB):
//   rooms/{code}/meta                  { hostUid, createdAt }
//   rooms/{code}/members/{uid}         { hero, at }        (membership records)
//   rooms/{code}/presence/{uid}        { hero, at }        (ephemeral, onDisconnect-cleared)
//   rooms/{code}/joinRequests/{uid}    { hero, at }        (host-approved)
//   rooms/{code}/session               live session slice of SharedState
//   rooms/{code}/family                persistent family-progression slice
//   rooms/{code}/events/{pushId}       NetEvent fan-out log (pruned)

import type { HeroId } from './save';
import type { SharedState } from './roomState';

// ---- room codes: kids type 4 digits; the code is rendezvous, NOT auth ----
export function sanitizeRoomCode(code: string): string | null {
  const c = (code ?? '').trim();
  return /^\d{4}$/.test(c) ? c : null;
}

// ---- path layout ----
export interface RoomPaths {
  room: string;
  meta: string;
  members: string;
  presence: string;
  joinRequests: string;
  session: string;
  family: string;
  events: string;
}

export function roomPaths(code: string): RoomPaths {
  const clean = sanitizeRoomCode(code);
  if (!clean) throw new Error(`bad room code: ${code}`);
  const room = `rooms/${clean}`;
  return {
    room,
    meta: `${room}/meta`,
    members: `${room}/members`,
    presence: `${room}/presence`,
    joinRequests: `${room}/joinRequests`,
    session: `${room}/session`,
    family: `${room}/family`,
    events: `${room}/events`
  };
}

export function memberPath(code: string, uid: string): string {
  return `${roomPaths(code).members}/${uid}`;
}

export function presencePath(code: string, uid: string): string {
  return `${roomPaths(code).presence}/${uid}`;
}

export function joinRequestPath(code: string, uid: string): string {
  return `${roomPaths(code).joinRequests}/${uid}`;
}

// ---- session vs family split ----
// Family = persistent progression mirrored into the local SharedSave.
// Session = everything live/ephemeral. The two sets must partition SharedState.
export const FAMILY_KEYS = [
  'pets',
  'starLedger',
  'restoration',
  'decorations',
  'trophies',
  'completedMissions',
  'claimed',
  'crownPieces'
] as const;

export type FamilyKey = (typeof FAMILY_KEYS)[number];

export type SessionSlice = Omit<SharedState, FamilyKey>;
export type FamilySlice = Pick<SharedState, FamilyKey>;

export function isFamilyKey(k: string): k is FamilyKey {
  return (FAMILY_KEYS as readonly string[]).includes(k);
}

export function splitSharedState(s: SharedState): { session: SessionSlice; family: FamilySlice } {
  const session = {} as Record<string, unknown>;
  const family = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(s)) {
    if (isFamilyKey(k)) family[k] = v;
    else session[k] = v;
  }
  return { session: session as SessionSlice, family: family as FamilySlice };
}

export function joinSlices(session: Partial<SessionSlice>, family: Partial<FamilySlice>): Partial<SharedState> {
  return { ...(session as object), ...(family as object) } as Partial<SharedState>;
}

// ---- validators (mirror database.rules.json; tested, then enforced server-side) ----
const HEROS = ['jackson', 'layla'] as const;

export function isHero(v: unknown): v is HeroId {
  return v === 'jackson' || v === 'layla';
}

interface RowShape {
  hero?: unknown;
  at?: unknown;
}

function hasHeroAt(v: unknown): v is RowShape & { hero: HeroId; at: number } {
  if (!v || typeof v !== 'object') return false;
  const r = v as RowShape;
  return isHero(r.hero) && typeof r.at === 'number' && Number.isFinite(r.at);
}

export function validateMember(v: unknown): boolean {
  return hasHeroAt(v);
}

export function validatePresence(v: unknown): boolean {
  return hasHeroAt(v);
}

export function validateJoinRequest(v: unknown): boolean {
  return hasHeroAt(v);
}

export function validateNetEventShape(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e['eventId'] === 'string' && (e['eventId'] as string).length > 0 &&
    typeof e['kind'] === 'string' &&
    (e['hero'] === 'jackson' || e['hero'] === 'layla' || e['hero'] === 'system') &&
    typeof e['timestamp'] === 'number' && Number.isFinite(e['timestamp']) &&
    (!('payload' in e) || (typeof e['payload'] === 'object' && e['payload'] !== null))
  );
}

// ---- presence-based hero occupancy (pure; transport feeds it live snapshots) ----
export interface PresenceRow {
  hero: HeroId;
  at: number;
}

export interface MemberRow {
  hero: HeroId;
  at?: number;
}

/** A hero slot counts as taken only by ANOTHER uid with live presence.
 *  Stale/offline membership rows alone never block (reinstall-safe). */
export function isSlotTaken(
  presence: Record<string, PresenceRow>,
  hero: HeroId,
  selfUid: string,
  nowMs: number,
  staleAfterMs = 120_000
): boolean {
  for (const [uid, row] of Object.entries(presence)) {
    if (uid === selfUid) continue;
    if (!row || row.hero !== hero) continue;
    const age = nowMs - (typeof row.at === 'number' ? row.at : 0);
    if (age < 0 || age < staleAfterMs) return true; // live (or clock-skewed): taken
  }
  return false;
}

// ---- event-log pruning (pure; transport executes the deletes) ----
export function pruneableEvents(
  events: Record<string, { timestamp?: unknown }>,
  nowMs: number,
  maxAgeMs = 120_000
): string[] {
  const out: string[] = [];
  for (const [id, e] of Object.entries(events)) {
    const ts = e?.timestamp;
    if (typeof ts !== 'number' || !Number.isFinite(ts) || nowMs - ts > maxAgeMs) out.push(id);
  }
  return out;
}
