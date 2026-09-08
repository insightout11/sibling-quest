// Session Manager (§5, §6): CREATE / JOIN with 4-digit room code.
// Family build: each tablet remembers its hero + last room after first setup,
// so subsequent use offers CONTINUE ADVENTURE instead of full setup.

import type { HeroId } from './save';

const HERO_KEY = 'sq-hero';
const ROOM_KEY = 'sq-room';

export function rememberedHero(): HeroId | null {
  try {
    const h = localStorage.getItem(HERO_KEY);
    return h === 'jackson' || h === 'layla' ? h : null;
  } catch {
    return null;
  }
}

export function rememberHero(h: HeroId): void {
  try { localStorage.setItem(HERO_KEY, h); } catch { /* ignore */ }
}

export function makeRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function rememberedRoom(): string | null {
  try {
    return localStorage.getItem(ROOM_KEY);
  } catch {
    return null;
  }
}

export function rememberRoom(room: string): void {
  try { localStorage.setItem(ROOM_KEY, room); } catch { /* ignore */ }
}

export function forgetRoom(): void {
  try { localStorage.removeItem(ROOM_KEY); } catch { /* ignore */ }
}

/** True when this tablet can offer CONTINUE (same room still expected). */
export function canContinue(): boolean {
  return rememberedRoom() !== null && rememberedHero() !== null;
}

export function otherHero(h: HeroId): HeroId {
  return h === 'jackson' ? 'layla' : 'jackson';
}

export function heroDisplayName(h: HeroId): string {
  return h === 'jackson' ? 'Jackson' : 'Layla';
}
