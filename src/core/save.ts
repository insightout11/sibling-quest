// Save System (§7) — one persistent shared save, versioned with migration.
// Survives refresh / browser close / PWA restart. No wipes on version change.

export const SAVE_VERSION = 2;
const SAVE_KEY = 'sibling-quest-save-v1'; // stable key; version lives INSIDE payload

export type HeroId = 'jackson' | 'layla';

export interface SharedSave {
  version: number;
  profiles: { jacksonTablet: string | null; laylaTablet: string | null };
  heroCustom: Record<string, unknown>;
  unlockedWorlds: string[];
  completedMissions: string[];
  restoration: Record<string, number>; // worldId -> 0..100 colour restored
  treehouse: { rooms: string[]; decorations: string[] };
  underground: { rooms: string[]; portals: string[] };
  pets: string[];
  collections: { stars: number; crownPieces: string[]; trophies: string[] };
  jacksonGear: { weapon: string; tool: string; armour: string; pieces: string[] };
  laylaCosmetics: { crowns: string[]; dresses: string[]; wands: string[]; wings: boolean };
  resources: { candyBlocks: number; rainbowShards: number };
}

export function defaultSave(): SharedSave {
  return {
    version: SAVE_VERSION,
    profiles: { jacksonTablet: null, laylaTablet: null },
    heroCustom: {},
    unlockedWorlds: ['candy-kingdom'],
    completedMissions: [],
    restoration: { 'candy-kingdom': 0 },
    treehouse: { rooms: ['main'], decorations: [] },
    underground: { rooms: ['portal'], portals: ['candy-kingdom'] },
    pets: [],
    collections: { stars: 0, crownPieces: [], trophies: [] },
    jacksonGear: { weapon: 'stick-pick', tool: 'wood-hammer', armour: 'adventurer-vest', pieces: ['block', 'ramp'] },
    laylaCosmetics: { crowns: ['daisy'], dresses: ['pink-adventure'], wands: ['twig-wand'], wings: false },
    resources: { candyBlocks: 0, rainbowShards: 0 }
  };
}

function migrate(old: Partial<SharedSave> & { version?: number }): SharedSave {
  const base = defaultSave();
  const v = old.version ?? 0;
  // v0/v1 -> v2: merge over defaults so new fields never wipe progress
  if (v < 2) return { ...base, ...old, version: SAVE_VERSION };
  return { ...base, ...old, version: SAVE_VERSION };
}

export function loadSave(): SharedSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SharedSave>;
    return migrate(parsed);
  } catch {
    return defaultSave();
  }
}

export function storeSave(save: SharedSave): void {
  save.version = SAVE_VERSION;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch { /* storage full — keep playing in memory */ }
}

export function exportSave(save: SharedSave): string {
  return JSON.stringify(save);
}

export function importSave(json: string): SharedSave {
  const parsed = JSON.parse(json) as Partial<SharedSave>;
  const migrated = migrate(parsed);
  storeSave(migrated);
  return migrated;
}
