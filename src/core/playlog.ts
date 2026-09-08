// Lightweight playtest instrumentation (§playtest-13).
// No analytics SDK: a capped in-memory + localStorage session log the parent
// can export from the debug menu. Goal: find where the kids get confused.

import type { HeroId } from './save';

export type PlayKind =
  | 'stage-enter' | 'stage-time'
  | 'tap-unavailable' | 'failed-action'
  | 'separation-start' | 'separation-end'
  | 'reconnect' | 'resync' | 'hint' | 'reward' | 'note';

export interface PlayEntry {
  t: number; // ms since session start
  at: string; // wall clock ISO
  room: string;
  hero: HeroId | 'both';
  kind: PlayKind;
  data: string;
}

const KEY = 'sq-playlog';
const CAP = 500;

class PlayLog {
  private t0 = Date.now();
  private entries: PlayEntry[] = [];
  private room = '';
  private hero: HeroId | 'both' = 'both';

  start(room: string, hero: HeroId): void {
    this.room = room;
    this.hero = hero;
    this.t0 = Date.now();
    this.entries = [];
    this.log('note', `session start (${hero}, room ${room})`);
  }

  log(kind: PlayKind, data: string): void {
    this.entries.push({
      t: Date.now() - this.t0,
      at: new Date().toISOString(),
      room: this.room,
      hero: this.hero,
      kind,
      data
    });
    if (this.entries.length > CAP) this.entries.splice(0, this.entries.length - CAP);
    try { localStorage.setItem(KEY, JSON.stringify(this.entries)); } catch { /* ignore */ }
  }

  download(): void {
    try {
      const blob = new Blob([JSON.stringify(this.entries, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sibling-quest-playlog-${this.room || 'noroom'}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch { /* ignore */ }
  }

  summary(): string {
    const counts: Record<string, number> = {};
    for (const e of this.entries) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    const stages = this.entries.filter((e) => e.kind === 'stage-time').map((e) => e.data).join('; ');
    return `entries=${this.entries.length} ${JSON.stringify(counts)} stages: ${stages || 'none yet'}`;
  }
}

export const playlog = new PlayLog();
