// Progression layers (§playtest-2): SESSION vs FAMILY SAVE.
// Session state (live, ephemeral — never persisted to the family save):
//   connected players, positions, HP, current mission/stage, combat temps,
//   gate charge/ready, presence.
// Persistent shared save (canonical in room state, mirrored to local SharedSave):
//   completed missions, crown pieces, pets, restoration, shared stars,
//   decorations, portals, trophies.
// Player-specific items (per-device only, never synced):
//   Jackson gear/cosmetics, Layla crowns/dresses/makeup/wings/wands.

import type { SharedSave } from './save';
import { initialShared, sharedStarsTotal, type SharedState } from './roomState';

/** Copy canonical shared progression into the local family save. Returns true if changed. */
export function syncSaveFromShared(save: SharedSave, s: SharedState): boolean {
  let changed = false;
  const unionInto = (arr: string[], vals: string[]): void => {
    for (const v of vals) {
      if (!arr.includes(v)) { arr.push(v); changed = true; }
    }
  };
  unionInto(save.pets, s.pets ?? []);
  unionInto(save.collections.crownPieces, s.crownPieces ?? []);
  unionInto(save.collections.trophies, s.trophies ?? []);
  unionInto(save.treehouse.decorations, s.decorations ?? []);
  unionInto(save.completedMissions, s.completedMissions ?? []);
  const stars = sharedStarsTotal(s);
  if (stars > save.collections.stars) { save.collections.stars = stars; changed = true; }
  const rest = Math.max(save.restoration['candy-kingdom'] ?? 0, s.restoration ?? 0);
  if (rest !== (save.restoration['candy-kingdom'] ?? 0)) { save.restoration['candy-kingdom'] = rest; changed = true; }
  if (unicornHome(s) && !save.underground.portals.includes('dino-tease')) {
    // teaser portal flickers to life after the demo — progression, not session
    save.underground.portals.push('dino-tease');
    changed = true;
  }
  return changed;
}

function unicornHome(s: SharedState): boolean {
  return (s.completedMissions ?? []).includes('grey-kingdom');
}

/** Fresh demo mission state that KEEPS family progression (parent "restart demo"). */
export function freshDemoKeepingFamily(room: string, keep: SharedState): SharedState {
  const fresh = initialShared(room);
  fresh.pets = [...(keep.pets ?? [])];
  fresh.starLedger = { ...(keep.starLedger ?? {}) };
  fresh.restoration = keep.restoration ?? 0;
  fresh.decorations = [...(keep.decorations ?? [])];
  fresh.trophies = [...(keep.trophies ?? [])];
  fresh.completedMissions = [...(keep.completedMissions ?? [])];
  fresh.claimed = [...(keep.claimed ?? [])];
  fresh.crownPieces = [...(keep.crownPieces ?? [])];
  return fresh;
}

/** Prerequisite flags for parent "jump to stage N" (all stages < N completed). */
export function prereqsFor(stage: number, room: string): SharedState {
  const s = initialShared(room);
  const give = (id: string, stars: number): void => {
    if (!s.claimed.includes(id)) { s.claimed.push(id); s.starLedger[id] = stars; }
  };
  if (stage >= 1) { /* gummy met = just stage */ }
  if (stage >= 2) {
    s.crystalsMined = [0, 1, 2]; s.jacksonBlocks = 3;
    s.bridgeBuilt = true; s.enchantRequested = true; s.bridgeEnchanted = true;
    s.bridgeStates['candy-bridge'] = 'enchanted';
    give('stage-1', 5);
  }
  if (stage >= 3) {
    s.jellyShieldBroken = true;
    s.jellyHitsJackson = { 'jelly-a': 3, 'jelly-shield': 3, 'jelly-c': 3 };
    s.jelliesDefeated = ['jelly-a', 'jelly-shield', 'jelly-c'];
    if (!s.crownPieces.includes('candy-1')) s.crownPieces.push('candy-1');
    give('stage-2', 5); give('crown-candy-1', 8);
  }
  if (stage >= 4) give('stage-3', 5);
  if (stage >= 5) { give('stage-4', 5); }
  if (stage >= 6) {
    s.starReachable = true; s.starCollected = true;
    give('stage-5', 5); give('star', 6);
  }
  if (stage >= 7) {
    s.cageHits = 3; s.cageBroken = true; s.unicornCalmed = true;
    if (!s.pets.includes('candy-unicorn')) s.pets.push('candy-unicorn');
    if (!s.decorations.includes('unicorn-habitat')) s.decorations.push('unicorn-habitat');
    if (!s.trophies.includes('unicorn-friend')) s.trophies.push('unicorn-friend');
    give('stage-6', 5); give('unicorn', 8);
  }
  if (stage >= 8) {
    s.gateJacksonReady = true; s.gateLaylaReady = true;
    s.gateCharge = 100; s.gateOpen = true; s.doorStates['candy-gate'] = true;
    if (!s.crownPieces.includes('candy-2')) s.crownPieces.push('candy-2');
    s.siblingPower = 0;
    give('stage-7', 5); give('crown-candy-2', 8);
  }
  s.stageId = Math.min(stage, 8);
  s.currentStage = s.stageId;
  s.restoration = Math.min(100, s.stageId * 14);
  return s;
}
