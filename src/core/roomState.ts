// Canonical shared mission state (§2, §3) — PURE module, no window access.
// Design: every mission-critical flag is MONOTONIC (false→true only, sets only
// grow, numbers only take max). This makes convergence trivial: any order of
// delivery, any duplicates, any latency → all clients end in the same state.
//
// Derived gates (single source of truth, used by ALL scenes):
//   bridgeCrossable   = bridgeBuilt && bridgeEnchanted
//   jellyDamageAllowed(jelly) = jellyShieldBroken OR shield was never on that jelly
//   unicornRescued    = cageBroken && unicornCalmed

import type { HeroId } from './save';

export interface RoomMission {
  world: string;
  missionId: string;
  stageId: number;
  // §2 room architecture — mission-critical flags
  bridgeBuilt: boolean;
  bridgeEnchanted: boolean;
  enchantRequested: boolean; // Layla tapped magic before build finished — auto-completes on build (Test B)
  jellyShieldBroken: boolean;
  jelliesDefeated: string[];
  jellyHitsJackson: Record<string, number>; // per-hero cumulative hits — max-merge (idempotent, order-free)
  jellyHitsLayla: Record<string, number>;
  crystalsMined: number[];
  jacksonBlocks: number;
  starReachable: boolean; // stairs built
  starCollected: boolean;
  cageHits: number;
  cageBroken: boolean;
  unicornCalmed: boolean;
  gateJacksonReady: boolean;
  gateLaylaReady: boolean;
  gateCharge: number; // 0..100, max-wins
  gateOpen: boolean;
  crownPieces: string[];
  siblingPower: number; // 0..100, max-wins per event (reset is explicit op)
  bossHealth: number; // min-wins (damage only decreases)
  missionComplete: boolean;
  // ---- shared family progression (§playtest-1): canonical, persisted, synced ----
  // Player-specific gear/cosmetics stay per-device in SharedSave; everything
  // below belongs to "their world" and converges across tablets.
  pets: string[]; // rescued shared pets
  starLedger: Record<string, number>; // achievementId -> stars (max-merge; total = sum)
  restoration: number; // world colour 0..100 (max-wins)
  decorations: string[]; // shared unlocks (union)
  trophies: string[]; // shared trophies (union)
  completedMissions: string[]; // (union)
  claimed: string[]; // one-time reward ids already granted (union)
}

export interface SharedState extends RoomMission {
  session: string; // room code (legacy name, kept for scene compat)
  currentWorld: string;
  currentMission: string;
  currentStage: number; // mirrors mission.stageId
  rev: number; // snapshot revision — higher wins for non-monotonic fields (HP, positions)
  jacksonPos: { x: number; y: number };
  laylaPos: { x: number; y: number };
  jacksonHP: number;
  laylaHP: number;
  sharedObjective: string;
  bridgeStates: Record<string, 'broken' | 'built' | 'enchanted'>;
  doorStates: Record<string, boolean>;
  worldEvents: string[];
}

export function initialShared(room: string): SharedState {
  return {
    session: room,
    currentWorld: 'home',
    currentMission: 'none',
    currentStage: 0,
    rev: 0,
    world: 'home',
    missionId: 'none',
    stageId: 0,
    jacksonPos: { x: 200, y: 420 },
    laylaPos: { x: 300, y: 420 },
    jacksonHP: 5,
    laylaHP: 5,
    sharedObjective: 'Explore the treehouse!',
    bossHealth: 100,
    siblingPower: 0,
    bridgeStates: { 'candy-bridge': 'broken' },
    doorStates: { 'candy-gate': false, 'portal-candy': false },
    crownPieces: [],
    missionComplete: false,
    worldEvents: [],
    // canonical flags
    bridgeBuilt: false,
    bridgeEnchanted: false,
    enchantRequested: false,
    jellyShieldBroken: false,
    jelliesDefeated: [],
    jellyHitsJackson: {},
    jellyHitsLayla: {},
    crystalsMined: [],
    jacksonBlocks: 0,
    starReachable: false,
    starCollected: false,
    cageHits: 0,
    cageBroken: false,
    unicornCalmed: false,
    gateJacksonReady: false,
    gateLaylaReady: false,
    gateCharge: 0,
    gateOpen: false,
    // shared family progression (fresh room starts empty)
    pets: [],
    starLedger: {},
    restoration: 0,
    decorations: [],
    trophies: [],
    completedMissions: [],
    claimed: []
  };
}

// ---- derived gates (use these, never re-derive inline) ----
export const JELLY_HP = 3;
export const bridgeCrossable = (s: RoomMission): boolean => s.bridgeBuilt && s.bridgeEnchanted;
export const unicornRescued = (s: RoomMission): boolean => s.cageBroken && s.unicornCalmed;
export const jellyHitsTotal = (s: RoomMission, id: string): number =>
  (s.jellyHitsJackson[id] ?? 0) + (s.jellyHitsLayla[id] ?? 0);
export const jellyDefeated = (s: RoomMission, id: string): boolean =>
  s.jelliesDefeated.includes(id) || jellyHitsTotal(s, id) >= JELLY_HP;
/** Shared star total = sum of per-achievement ledger (convergent under merge). */
export const sharedStarsTotal = (s: RoomMission): number =>
  Object.values(s.starLedger).reduce((a, b) => a + b, 0);

// ---- mission events (monotonic reducer) ----
export type MissionEventType =
  | 'mine' | 'bridge-built' | 'bridge-enchanted'
  | 'shield-break' | 'jelly-defeated'
  | 'stairs-built' | 'star-taken'
  | 'cage-hit' | 'unicorn-calm'
  | 'gate-charge' | 'gate-ready' | 'gate-open'
  | 'stage-done' | 'crown' | 'sibling-ready' | 'sibling-burst'
  | 'revive' | 'portal-hold' | 'portal-open' | 'freeze' | 'hit' | 'hit-jelly'
  | 'reward' | 'pet-add' | 'trophy-add' | 'decoration-add' | 'mission-done';

export interface MissionAction {
  type: MissionEventType;
  blocks?: number;
  idx?: number;
  jelly?: string;
  /** Absolute per-hero cumulative hits (max-wins → redelivery is a no-op). */
  n?: number;
  stage?: number;
  crownId?: string;
  power?: number;
  charge?: number;
  hero?: HeroId;
  /** reward/pet/trophy/decoration/mission payloads */
  id?: string;
  stars?: number;
}

/** Apply one action. Idempotent: applying twice === applying once. Order-free for flags. */
export function applyAction(s: SharedState, a: MissionAction): boolean {
  switch (a.type) {
    case 'mine':
      if (a.idx === undefined || s.crystalsMined.includes(a.idx)) return false;
      s.crystalsMined.push(a.idx);
      s.jacksonBlocks = Math.max(s.jacksonBlocks, s.crystalsMined.length);
      return true;
    case 'bridge-built':
      if (s.bridgeBuilt) return false;
      if (s.jacksonBlocks < 3) return false; // guard: no build without blocks
      s.bridgeBuilt = true;
      if (s.enchantRequested) s.bridgeEnchanted = true; // Test B: early enchant fulfils on build
      s.bridgeStates['candy-bridge'] = s.bridgeEnchanted ? 'enchanted' : 'built';
      return true;
    case 'bridge-enchanted': {
      const isNew = !s.enchantRequested;
      s.enchantRequested = true; // always remember intent (idempotent)
      if (s.bridgeEnchanted) return false;
      if (!s.bridgeBuilt) return isNew; // Test B: intent stored; completes when built
      s.bridgeEnchanted = true;
      s.bridgeStates['candy-bridge'] = 'enchanted';
      return true;
    }
    case 'shield-break':
      if (s.jellyShieldBroken) return false;
      s.jellyShieldBroken = true;
      return true;
    case 'jelly-defeated':
    case 'hit-jelly': {
      // Shielded jelly ('jelly-shield') takes no damage until shield broken.
      if (a.jelly === 'jelly-shield' && !s.jellyShieldBroken) return false;
      if (!a.jelly) return false;
      if (s.jelliesDefeated.includes(a.jelly)) return false;
      // per-hero cumulative counter, max-merge: redelivery & cross-client sums stay correct.
      // Senders transmit ABSOLUTE counts (n), so the same event applied twice is a no-op.
      const map = a.hero === 'layla' ? s.jellyHitsLayla : s.jellyHitsJackson;
      const cur = map[a.jelly] ?? 0;
      const want = a.n ?? cur + 1;
      const wasDefeated = s.jelliesDefeated.includes(a.jelly);
      map[a.jelly] = Math.max(cur, want);
      const now = (s.jellyHitsJackson[a.jelly] ?? 0) + (s.jellyHitsLayla[a.jelly] ?? 0);
      if (now >= JELLY_HP && !wasDefeated) s.jelliesDefeated.push(a.jelly);
      return map[a.jelly] !== cur || (!wasDefeated && s.jelliesDefeated.includes(a.jelly));
    }
    case 'stairs-built':
      if (s.starReachable) return false;
      s.starReachable = true;
      return true;
    case 'star-taken':
      if (s.starCollected) return false;
      if (!s.starReachable) return false;
      s.starCollected = true;
      return true;
    case 'cage-hit': {
      const next = Math.min(3, s.cageHits + 1);
      if (next === s.cageHits) return false;
      s.cageHits = next;
      if (s.cageHits >= 3) s.cageBroken = true;
      return true;
    }
    case 'unicorn-calm':
      if (s.unicornCalmed) return false;
      if (!s.cageBroken) return false;
      s.unicornCalmed = true;
      // shared rescue bundle — deterministic side-effects stay convergent
      if (!s.pets.includes('candy-unicorn')) s.pets.push('candy-unicorn');
      if (!s.decorations.includes('unicorn-habitat')) s.decorations.push('unicorn-habitat');
      if (!s.trophies.includes('unicorn-friend')) s.trophies.push('unicorn-friend');
      return true;
    case 'gate-charge':
      if (s.gateOpen) return false;
      if (a.charge === undefined) return false;
      if (a.charge <= s.gateCharge) return false;
      s.gateCharge = Math.min(100, a.charge);
      return true;
    case 'gate-ready':
      if (!a.hero) return false;
      if (a.hero === 'jackson' && !s.gateJacksonReady) { s.gateJacksonReady = true; return true; }
      if (a.hero === 'layla' && !s.gateLaylaReady) { s.gateLaylaReady = true; return true; }
      return false;
    case 'gate-open':
      if (s.gateOpen) return false;
      s.gateOpen = true;
      s.doorStates['candy-gate'] = true;
      return true;
    case 'stage-done':
      if (a.stage === undefined || a.stage <= s.stageId) return false;
      s.stageId = a.stage;
      s.currentStage = a.stage;
      // world visibly heals as stages complete (persisted + synced)
      s.restoration = Math.max(s.restoration, Math.min(100, a.stage * 14));
      return true;
    case 'crown':
      if (!a.crownId || s.crownPieces.includes(a.crownId)) return false;
      s.crownPieces.push(a.crownId);
      return true;
    case 'sibling-burst':
      if (s.siblingPower < 100) return false;
      s.siblingPower = 0;
      s.bossHealth = Math.max(0, s.bossHealth - (a.power ?? 34));
      return true;
    case 'portal-open':
      if (s.doorStates['portal-candy']) return false;
      s.doorStates['portal-candy'] = true;
      return true;
    // ---- shared progression (all idempotent, all convergent) ----
    case 'reward': {
      if (!a.id) return false;
      if (s.claimed.includes(a.id)) return false;
      s.claimed.push(a.id);
      s.starLedger[a.id] = Math.max(s.starLedger[a.id] ?? 0, a.stars ?? 0);
      return true;
    }
    case 'pet-add':
      if (!a.id || s.pets.includes(a.id)) return false;
      s.pets.push(a.id);
      return true;
    case 'trophy-add':
      if (!a.id || s.trophies.includes(a.id)) return false;
      s.trophies.push(a.id);
      return true;
    case 'decoration-add':
      if (!a.id || s.decorations.includes(a.id)) return false;
      s.decorations.push(a.id);
      return true;
    case 'mission-done':
      if (!a.id || s.completedMissions.includes(a.id)) return false;
      s.completedMissions.push(a.id);
      return true;
    default:
      return false; // revive/hit/freeze/portal-hold/sibling-ready handled locally, not canonical
  }
}

/** Merge a full snapshot (resync): monotonic per-field merge so a stale snapshot can never undo progress. */
export function mergeSnapshot(local: SharedState, remote: SharedState): SharedState {
  const bool = (a: boolean, b: boolean) => a || b;
  const max = (a: number, b: number) => Math.max(a, b);
  const union = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])];
  const unionNum = (a: number[], b: number[]): number[] => [...new Set([...a, ...b])];
  const maxMap = (a: Record<string, number>, b: Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
    return out;
  };
  // Non-monotonic fields (HP, positions, objective, world): higher rev wins.
  const remoteWins = (remote.rev ?? 0) >= (local.rev ?? 0);
  return {
    ...(remoteWins ? remote : local),
    rev: max(local.rev ?? 0, remote.rev ?? 0),
    // monotonic guards — a stale snapshot must never undo progress
    stageId: max(local.stageId, remote.stageId),
    currentStage: max(local.currentStage, remote.currentStage),
    siblingPower: remote.siblingPower === 0 && local.siblingPower >= 100 ? 0 : max(local.siblingPower, remote.siblingPower),
    bossHealth: Math.min(local.bossHealth, remote.bossHealth),
    gateCharge: max(local.gateCharge, remote.gateCharge),
    cageHits: max(local.cageHits, remote.cageHits),
    jacksonBlocks: max(local.jacksonBlocks, remote.jacksonBlocks),
    bridgeBuilt: bool(local.bridgeBuilt, remote.bridgeBuilt),
    bridgeEnchanted: bool(local.bridgeEnchanted, remote.bridgeEnchanted),
    enchantRequested: bool(local.enchantRequested, remote.enchantRequested),
    jellyShieldBroken: bool(local.jellyShieldBroken, remote.jellyShieldBroken),
    starReachable: bool(local.starReachable, remote.starReachable),
    starCollected: bool(local.starCollected, remote.starCollected),
    cageBroken: bool(local.cageBroken, remote.cageBroken),
    unicornCalmed: bool(local.unicornCalmed, remote.unicornCalmed),
    gateJacksonReady: bool(local.gateJacksonReady, remote.gateJacksonReady),
    gateLaylaReady: bool(local.gateLaylaReady, remote.gateLaylaReady),
    gateOpen: bool(local.gateOpen, remote.gateOpen),
    missionComplete: bool(local.missionComplete, remote.missionComplete),
    jelliesDefeated: union(local.jelliesDefeated, remote.jelliesDefeated),
    jellyHitsJackson: maxMap(local.jellyHitsJackson, remote.jellyHitsJackson),
    jellyHitsLayla: maxMap(local.jellyHitsLayla, remote.jellyHitsLayla),
    crystalsMined: unionNum(local.crystalsMined, remote.crystalsMined),
    crownPieces: union(local.crownPieces, remote.crownPieces),
    worldEvents: union(local.worldEvents, remote.worldEvents),
    // shared progression — unions + maxes, never regress
    pets: union(local.pets ?? [], remote.pets ?? []),
    starLedger: maxMap(local.starLedger ?? {}, remote.starLedger ?? {}),
    restoration: max(local.restoration ?? 0, remote.restoration ?? 0),
    decorations: union(local.decorations ?? [], remote.decorations ?? []),
    trophies: union(local.trophies ?? [], remote.trophies ?? []),
    completedMissions: union(local.completedMissions ?? [], remote.completedMissions ?? []),
    claimed: union(local.claimed ?? [], remote.claimed ?? []),
    bridgeStates: {
      'candy-bridge': remote.bridgeBuilt
        ? remote.bridgeEnchanted || local.bridgeEnchanted ? 'enchanted' : 'built'
        : local.bridgeBuilt ? (local.bridgeEnchanted ? 'enchanted' : 'built') : 'broken'
    },
    doorStates: {
      'portal-candy': bool(!!local.doorStates['portal-candy'], !!remote.doorStates['portal-candy']),
      'candy-gate': bool(!!local.doorStates['candy-gate'], !!remote.doorStates['candy-gate'])
    }
  };
}

export function snapshotKey(room: string): string {
  return `sq-snapshot-${room}`;
}

const SNAPSHOT_V = 2;

/** Fill defaults for fields added after a snapshot was cached (never wipe progress). */
export function migrateSnapshot(s: SharedState): SharedState {
  const base = initialShared(s.session ?? '0000');
  return { ...base, ...s, session: s.session ?? base.session };
}

export function serializeSnapshot(s: SharedState): string {
  return JSON.stringify({ v: SNAPSHOT_V, savedAt: Date.now(), state: s });
}

export function deserializeSnapshot(json: string): SharedState | null {
  try {
    const o = JSON.parse(json) as { v: number; state: SharedState };
    if (!o || !o.state || typeof o.state !== 'object') return null;
    if (o.v !== SNAPSHOT_V) return migrateSnapshot(o.state);
    return migrateSnapshot(o.state);
  } catch {
    return null;
  }
}
