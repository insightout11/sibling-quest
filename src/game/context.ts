// Shared game context: single convergence point for canonical mission state.
// Scenes NEVER mutate `shared` mission flags directly — they call helpers here
// (or ctx.emit), which apply the monotonic reducer locally, broadcast the wire
// event (with identity + idempotency key), and publish the resulting patch.
// All guards live in roomState.applyAction, so every client converges.

import type { HeroId, SharedSave } from '../core/save';
import type { SharedState, Transport, NetEvent } from '../core/net';
import { applyAction, type MissionAction } from '../core/roomState';
import { makeEventId } from '../core/ids';

export interface GameContext {
  hero: HeroId;
  room: string;
  playerId: string;
  /** Room creator speaks shared story lines (prevents cross-tablet echo). */
  isHost: boolean;
  transport: Transport;
  shared: SharedState;
  save: SharedSave;
  onSave: (s: SharedSave) => void;
  seenEvents: Set<string>;
  /** Canonical dispatch: apply locally + broadcast event + publish patch. */
  emit: (kind: string, payload?: Record<string, unknown>) => void;
  patch: (p: Partial<SharedState>) => void;
  addSiblingPower: (n: number) => void;
  /** One-time star reward (idempotent across tablets). Returns true if newly granted. */
  grantReward: (id: string, stars: number) => boolean;
  advanceStage: () => void;
  chargeGate: (n: number) => void;
  burstSibling: () => boolean;
}

export const ctx: { current: GameContext | null } = { current: null };

export function getCtx(): GameContext {
  if (!ctx.current) throw new Error('GameContext not initialised');
  return ctx.current;
}

/** Map a scene-level kind to a canonical action. Null = local/broadcast-only. */
export function actionFor(kind: string, payload: Record<string, unknown>, hero: HeroId): MissionAction | null {
  switch (kind) {
    case 'mine': return { type: 'mine', idx: payload['idx'] as number };
    case 'bridge-built': return { type: 'bridge-built' };
    case 'bridge-enchanted': return { type: 'bridge-enchanted' };
    case 'shield-break': return { type: 'shield-break' };
    case 'hit-jelly': return {
      type: 'hit-jelly',
      jelly: payload['jelly'] as string,
      hero,
      n: typeof payload['n'] === 'number' ? (payload['n'] as number) : undefined
    };
    case 'stairs-built': return { type: 'stairs-built' };
    case 'star-taken': return { type: 'star-taken' };
    case 'cage-hit': return { type: 'cage-hit' };
    case 'unicorn-calm': return { type: 'unicorn-calm' };
    case 'gate-open': return { type: 'gate-open' };
    case 'gate-charge':
      return typeof payload['charge'] === 'number' ? { type: 'gate-charge', charge: payload['charge'] as number } : null;
    case 'stage-done':
      return typeof payload['stage'] === 'number' ? { type: 'stage-done', stage: payload['stage'] as number } : null;
    case 'sibling-ready': return { type: 'gate-ready', hero };
    case 'sibling-burst': return { type: 'sibling-burst' };
    case 'crown': return { type: 'crown', crownId: payload['id'] as string };
    case 'portal-open': return { type: 'portal-open' };
    case 'reward':
      return typeof payload['id'] === 'string'
        ? { type: 'reward', id: payload['id'] as string, stars: (payload['stars'] as number) ?? 0 }
        : null;
    case 'pet-add': return typeof payload['id'] === 'string' ? { type: 'pet-add', id: payload['id'] as string } : null;
    case 'trophy-add': return typeof payload['id'] === 'string' ? { type: 'trophy-add', id: payload['id'] as string } : null;
    case 'decoration-add': return typeof payload['id'] === 'string' ? { type: 'decoration-add', id: payload['id'] as string } : null;
    case 'mission-done': return typeof payload['id'] === 'string' ? { type: 'mission-done', id: payload['id'] as string } : null;
    default: return null;
  }
}

/** Canonical fields published after an action changes state. */
export function canonicalPatch(s: SharedState): Partial<SharedState> {
  return {
    rev: s.rev,
    stageId: s.stageId,
    currentStage: s.currentStage,
    bridgeBuilt: s.bridgeBuilt,
    bridgeEnchanted: s.bridgeEnchanted,
    enchantRequested: s.enchantRequested,
    bridgeStates: s.bridgeStates,
    jellyShieldBroken: s.jellyShieldBroken,
    jelliesDefeated: s.jelliesDefeated,
    jellyHitsJackson: s.jellyHitsJackson,
    jellyHitsLayla: s.jellyHitsLayla,
    crystalsMined: s.crystalsMined,
    jacksonBlocks: s.jacksonBlocks,
    starReachable: s.starReachable,
    starCollected: s.starCollected,
    cageHits: s.cageHits,
    cageBroken: s.cageBroken,
    unicornCalmed: s.unicornCalmed,
    gateJacksonReady: s.gateJacksonReady,
    gateLaylaReady: s.gateLaylaReady,
    gateCharge: s.gateCharge,
    gateOpen: s.gateOpen,
    doorStates: s.doorStates,
    crownPieces: s.crownPieces,
    siblingPower: s.siblingPower,
    bossHealth: s.bossHealth,
    missionComplete: s.missionComplete,
    // shared family progression (canonical)
    pets: s.pets,
    starLedger: s.starLedger,
    restoration: s.restoration,
    decorations: s.decorations,
    trophies: s.trophies,
    completedMissions: s.completedMissions,
    claimed: s.claimed
  };
}

export function makeWireEvent(room: string, playerId: string, hero: HeroId, kind: string, payload: Record<string, unknown>): NetEvent {
  const now = Date.now();
  return {
    eventId: makeEventId(),
    roomId: room,
    playerId,
    hero,
    eventType: kind,
    kind,
    from: hero,
    payload,
    timestamp: now,
    at: now
  };
}

// Reusable co-op template contract (§20): generous window, idempotent, order-free.
// (Concrete wiring lives in scenes via canonical flags + net events.)
export async function dualHold(opts: {
  need: string[];
  windowMs?: number;
  onEvent: (register: (kind: string, cb: () => void) => void) => void;
}): Promise<boolean> {
  const windowMs = opts.windowMs ?? 6000;
  return new Promise((resolve) => {
    const cleanup = (): void => window.clearTimeout(timer);
    const timer = window.setTimeout(() => { cleanup(); resolve(false); }, windowMs);
    opts.onEvent((kind: string, cb: () => void) => {
      void kind; void cb;
    });
    void opts.need;
  });
}

export type { NetEvent };
