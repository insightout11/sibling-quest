// Stable per-tablet player identity (§2: stable unique client/player IDs).
// Separate from hero names: a tablet owns a playerId forever; it CLAIMS a hero per room.

const PLAYER_KEY = 'sq-player-id';

export function myPlayerId(): string {
  try {
    let id = localStorage.getItem(PLAYER_KEY);
    if (!id) {
      id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(PLAYER_KEY, id);
    }
    return id;
  } catch {
    return `p-temp-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function makeEventId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
