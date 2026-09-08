// Central narration / audio queue (§26).
// Rules: one spoken instruction at a time, no overlap, no duplicates,
// cancel obsolete queued instructions when game state changes.

import type { HeroId } from './save';

type SpeechJob = { id: string; text: string; stateTag: string; forHero: HeroId | 'both' };

class AudioQueue {
  private queue: SpeechJob[] = [];
  private speaking = false;
  private lastSpoken: Record<string, number> = {};
  private currentTag = '';
  private me: HeroId | 'both' = 'both';
  private host = false;
  private audioCtx: AudioContext | null = null;

  /** Which hero is on THIS tablet — narration for the other hero is dropped (§14). */
  setHero(h: HeroId): void {
    this.me = h;
  }

  /** Only the room host speaks shared story lines — prevents echo across two tablets side-by-side. */
  setHost(isHost: boolean): void {
    this.host = isHost;
  }

  /** Declare current game state so stale narration is dropped. */
  setState(tag: string): void {
    this.currentTag = tag;
    this.queue = this.queue.filter((j) => j.stateTag === tag);
  }

  /** Drop everything (reconnect/resync must not replay a stale queue — §14). */
  clear(): void {
    this.queue = [];
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  }

  /** Queue narration; drops duplicates within 8s and stale-state items. */
  say(id: string, text: string, opts?: { urgent?: boolean; for?: HeroId | 'both'; hostOnly?: boolean }): void {
    const forHero = opts?.for ?? 'both';
    if (opts?.hostOnly && !this.host) return; // one tablet speaks story lines — no echo
    if (forHero !== 'both' && this.me !== 'both' && forHero !== this.me) return; // not for this tablet
    const now = Date.now();
    if (this.lastSpoken[id] && now - this.lastSpoken[id] < 8000) return; // prevent duplicate triggers
    this.lastSpoken[id] = now;
    const job: SpeechJob = { id, text, stateTag: this.currentTag, forHero };
    if (opts?.urgent) {
      this.queue.unshift(job);
    } else if (!this.queue.some((j) => j.id === id)) {
      this.queue.push(job);
    }
    void this.pump();
  }

  /** Short non-speech blip (WebAudio, no assets). Always safe to call. */
  blip(freq = 660, durMs = 90): void {
    try {
      this.audioCtx ??= new AudioContext();
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durMs / 1000);
    } catch { /* audio locked until first tap — fine */ }
  }

  private async pump(): Promise<void> {
    if (this.speaking) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const job = this.queue.shift();
    if (!job) return;
    if (job.stateTag !== this.currentTag) { void this.pump(); return; } // obsolete
    this.speaking = true;
    try {
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(job.text);
        u.rate = 0.95; u.pitch = 1.15;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        synth.cancel(); // never overlap: one voice at a time
        synth.speak(u);
        setTimeout(resolve, 6000); // safety: never hang queue
      });
    } finally {
      this.speaking = false;
      void this.pump();
    }
  }
}

export const audio = new AudioQueue();
