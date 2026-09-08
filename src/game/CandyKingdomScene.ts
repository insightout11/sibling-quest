// Candy Kingdom vertical slice, Scenes 3-9 (§41).
// Canonical mission state (roomState reducer) + drawn vector art (art.ts).
// Reconstructs fully from snapshots: refresh/reconnect restores exact progress.
// World text is plain words; Layla is guided by voice + pulsing markers, not reading.
import Phaser from 'phaser';
import { getCtx } from './context';
import { actionFor } from './context';
import { makeHero, makeGummy, makeJelly, makeUnicorn, makeCrystal, makeStar, makeCrownPiece, type JellyFigure } from './art';
import { createTouchUI, type PadState, type TouchHandle } from './ui';
import { audio } from '../core/audioQueue';
import { CANDY_MISSIONS } from '../missions/candyKingdom';
import {
  applyAction, bridgeCrossable, unicornRescued, jellyDefeated, jellyHitsTotal, JELLY_HP,
  sharedStarsTotal
} from '../core/roomState';
import { syncSaveFromShared } from '../core/progression';
import { playlog } from '../core/playlog';
import { storeSave } from '../core/save';

const STAGES = [...CANDY_MISSIONS[0].stages, ...CANDY_MISSIONS[1].stages];
const JELLY_META = [
  { id: 'jelly-a', x: 900, shield: false },
  { id: 'jelly-shield', x: 1000, shield: true },
  { id: 'jelly-c', x: 1120, shield: false }
];
const RIVER = { x0: 670, x1: 930 };
const GROUND_Y = 480;

const stripEmoji = (s: string): string =>
  s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();

export class CandyKingdomScene extends Phaser.Scene {
  private pad: PadState = { mx: 0, my: 0, action: false, build: false, magic: false };
  private hero!: Phaser.GameObjects.Container;
  private buddy!: Phaser.GameObjects.Container;
  private buddyPos = { x: 300, y: 460 };
  private jellies = new Map<string, { fig: JellyFigure; x: number; vx: number; hitCd: number; pips: Phaser.GameObjects.Arc[] }>();
  private crystals = new Map<number, Phaser.GameObjects.Container>();
  private bridge!: Phaser.GameObjects.Rectangle;
  private bridgeLabel!: Phaser.GameObjects.Text;
  private bridgeWaitSpark: Phaser.GameObjects.Star | null = null;
  private gummy!: Phaser.GameObjects.Container;
  private cageBars: Phaser.GameObjects.Rectangle[] = [];
  private cageLock!: Phaser.GameObjects.Rectangle;
  private unicornFig: Phaser.GameObjects.Container | null = null;
  private unicornFree: Phaser.GameObjects.Container | null = null;
  private stairs: Phaser.GameObjects.Rectangle | null = null;
  private starFig: Phaser.GameObjects.Container | null = null;
  private gate!: Phaser.GameObjects.Rectangle;
  private gateBar!: Phaser.GameObjects.Rectangle;
  private gateGlowJ!: Phaser.GameObjects.Arc;
  private gateGlowL!: Phaser.GameObjects.Arc;
  private marker!: Phaser.GameObjects.Star; // pulsing objective marker (Layla-friendly)
  private powerText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private lastStage = -1;
  private lastPatch = 0;
  private fails = 0;
  private chargeTick = 0;
  private siblingReadyMe = false;
  private siblingReadyBuddy = false;
  private siblingOverlay: Phaser.GameObjects.Container | null = null;
  private returned = false;
  private rewardTimer = false;
  private touch!: TouchHandle;
  private gateBanner!: Phaser.GameObjects.Text;
  private leashArrow!: Phaser.GameObjects.Triangle;
  private separated = false;
  private lastWaitVoice = 0;
  private stageT0 = 0;
  private lastMilestone = 0;
  private lastNope = 0;

  constructor() { super('candy'); }

  create(): void {
    const c = getCtx();
    const W = 1700, H = 600;
    // reset per-run scene state (scene object is reused across restarts)
    this.jellies.clear();
    this.crystals.clear();
    this.cageBars = [];
    this.lastStage = -1;
    this.returned = false;
    this.rewardTimer = false;
    this.siblingOverlay = null;
    this.siblingReadyMe = this.siblingReadyBuddy = false;
    this.stairs = null;
    this.starFig = null;
    this.unicornFree = null;

    const grey = c.shared.stageId < 3;
    this.cameras.main.setBackgroundColor(grey ? '#6b7280' : '#7dd3fc');
    // candy meadow ground with gumdrops
    this.add.rectangle(W / 2, H - 30, W, 90, grey ? 0x9ca3af : 0x86efac);
    for (let i = 0; i < 12; i++) {
      const gx = 80 + i * 140;
      this.add.circle(gx, H - 70, 14, grey ? 0x9ca3af : [0xef4444, 0xfacc15, 0x3b82f6][i % 3]).setStrokeStyle(3, 0xffffff);
    }
    // chocolate river
    this.add.rectangle(800, H - 30, 260, 92, 0x4b2b1b);
    this.add.ellipse(800, H - 40, 220, 40, 0x6b4226);
    this.add.text(800, H - 96, 'chocolate river', { fontSize: '16px', color: '#e7c9a9' }).setOrigin(0.5);
    this.bridge = this.add.rectangle(800, H - 70, 240, 26, 0x52525b).setStrokeStyle(4, 0xffffff);
    this.bridgeLabel = this.add.text(800, H - 116, '', { fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

    // candy crystals (Jackson mines these)
    [320, 450, 580].forEach((x, i) => {
      const fig = makeCrystal(this, grey);
      fig.setPosition(x, H - 130);
      this.crystals.set(i, fig);
    });

    // gummy NPC
    this.gummy = makeGummy(this, grey);
    this.gummy.setPosition(1050, H - 90);
    this.add.text(1050, H - 190, 'Help!', { fontSize: '20px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.tweens.add({ targets: this.gummy, y: H - 98, duration: 700, yoyo: true, repeat: -1, ease: 'sine.inout' });

    // jellies
    for (const m of JELLY_META) {
      const fig = makeJelly(this, m.shield, grey);
      fig.root.setPosition(m.x, H - 100).setVisible(false);
      const pips: Phaser.GameObjects.Arc[] = [];
      for (let i = 0; i < JELLY_HP; i++) {
        pips.push(this.add.circle(m.x - 16 + i * 16, H - 190, 7, 0xef4444).setStrokeStyle(2, 0xffffff).setVisible(false));
      }
      this.jellies.set(m.id, { fig, x: m.x, vx: 40 + Math.random() * 30, hitCd: 0, pips });
    }

    // star ledge + light beam so the destination is obvious
    this.add.rectangle(1280, H - 260, 150, 24, grey ? 0x6b7280 : 0xc084fc).setStrokeStyle(4, 0xffffff);
    this.add.rectangle(1210, H - 200, 16, 120, grey ? 0x6b7280 : 0xa855f7);
    this.add.ellipse(1280, H - 300, 90, 130, 0xfef08a, 0.22);
    this.starFig = makeStar(this);
    this.starFig.setPosition(1280, H - 310);
    this.tweens.add({ targets: this.starFig, y: H - 330, duration: 800, yoyo: true, repeat: -1 });

    // unicorn cage: thick bars that break one by one + gold lock plate
    this.add.text(1470, H - 230, 'cage', { fontSize: '18px', color: '#fff' }).setOrigin(0.5);
    this.unicornFig = makeUnicorn(this, true);
    this.unicornFig.setPosition(1470, H - 110).setScale(0.9);
    for (let i = -1; i <= 1; i++) {
      const bar = this.add.rectangle(1470 + i * 34, H - 140, 14, 110, 0x44403c).setStrokeStyle(3, 0xffffff);
      this.cageBars.push(bar);
    }
    this.cageLock = this.add.rectangle(1470, H - 100, 30, 24, 0xfacc15).setStrokeStyle(3, 0x92400e);

    // rainbow gate: stone arch + charge bar + per-hero ready glows
    this.gate = this.add.rectangle(1620, H - 160, 44, 230, grey ? 0x78716c : 0xa78bfa).setStrokeStyle(6, 0xfbbf24);
    this.add.rectangle(1620, H - 290, 120, 26, 0xfbbf24).setStrokeStyle(3, 0xffffff);
    this.gateBar = this.add.rectangle(1620, H - 262, 1, 10, 0x4ade80).setOrigin(0.5);
    this.gateGlowJ = this.add.circle(1580, H - 120, 20, 0xb45309, 0.25).setStrokeStyle(4, 0xffffff);
    this.gateGlowL = this.add.circle(1660, H - 120, 20, 0xec4899, 0.25).setStrokeStyle(4, 0xffffff);
    this.add.text(1580, H - 80, 'HOLD', { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(1660, H - 80, 'MAGIC', { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

    // heroes (drawn, named)
    this.hero = makeHero(this, c.hero);
    this.hero.setPosition(c.hero === 'jackson' ? 180 : 260, GROUND_Y);
    this.buddy = makeHero(this, c.hero === 'jackson' ? 'layla' : 'jackson');
    this.buddyPos = c.hero === 'jackson'
      ? { ...c.shared.laylaPos } : { ...c.shared.jacksonPos };
    if (!this.buddyPos.x) this.buddyPos = { x: c.hero === 'jackson' ? 260 : 180, y: GROUND_Y };
    this.buddy.setPosition(this.buddyPos.x, this.buddyPos.y).setAlpha(0.65);
    const buddyName = c.hero === 'jackson' ? 'LAYLA' : 'JACKSON';
    const tag = this.add.text(0, -132, buddyName, { fontSize: '15px', color: '#fff', backgroundColor: '#0008', padding: { x: 6, y: 2 } }).setOrigin(0.5);
    const tagWrap = this.add.container(this.buddy.x, this.buddy.y, [tag]);
    this.tweens.add({ targets: tagWrap, x: this.buddy.x, y: this.buddy.y, duration: 1 });
    tagWrap.setData('follow', true);
    this.buddy.setData('tag', tagWrap);

    // pulsing objective marker (guides Layla without reading)
    this.marker = this.add.star(800, 300, 5, 10, 20, 0xfef08a).setStrokeStyle(3, 0xffffff);
    this.tweens.add({ targets: this.marker, scale: 1.35, duration: 600, yoyo: true, repeat: -1 });

    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.hero, true, 0.08, 0.08);

    this.powerText = this.add.text(16, 52, '', { fontSize: '20px', color: '#fef08a', fontStyle: 'bold' }).setScrollFactor(0);
    this.stageText = this.add.text(16, 80, '', { fontSize: '16px', color: '#fff' }).setScrollFactor(0);
    // gate role banner (hidden until the climax) + sibling-trail arrow (hidden until separated)
    this.gateBanner = this.add.text(this.scale.width / 2, 120, '', { fontSize: '44px', color: '#fde047', fontStyle: 'bold', backgroundColor: '#0009', padding: { x: 18, y: 10 } }).setOrigin(0.5).setScrollFactor(0).setVisible(false).setDepth(150);
    this.leashArrow = this.add.triangle(0, 0, 0, 26, 44, 0, 0, -26, 0xfacc15).setStrokeStyle(3, 0xffffff).setVisible(false).setDepth(150);

    this.touch = createTouchUI(this, c.hero, (p) => {
      if (p.build && !this.pad.build) this.onBuildButton();
      if (p.magic && !this.pad.magic) this.onMagicButton();
      if (p.action && !this.pad.action) this.onActionButton();
      this.pad = { ...p };
    });
    this.touch.setContextAvailable(false);
    this.touch.onUnavailableTap((which) => {
      playlog.log('tap-unavailable', `${which} stage=${this.stage()}`);
      const now = Date.now();
      if (now - this.lastNope < 4000) return;
      this.lastNope = now;
      audio.blip(180, 120);
      this.setHintTemp(c.hero === 'jackson' ? 'Not here — follow the star!' : 'Not here — follow the sparkles!');
    });
    this.stageT0 = Date.now();

    // ---- net wiring ----
    c.transport.onState(() => {
      // main.ts already merged monotonically; re-render from canonical truth
      this.renderAll();
      this.checkStageProgress();
      this.checkStageChanged();
    });
    c.transport.onEvent((ev) => {
      const cc = getCtx();
      if (cc.seenEvents.has(ev.eventId)) return; // idempotent (§5)
      cc.seenEvents.add(ev.eventId);
      this.handleEvent(ev.eventType ?? ev.kind, ev.payload, (ev.hero ?? ev.from) as 'jackson' | 'layla' | 'system');
    });
    c.transport.onSnapshot(() => {
      this.reconstruct();
      this.checkStageChanged();
      this.checkStageProgress();
    });

    this.reconstruct();
    this.enterStage(c.shared.stageId, true);
    this.renderAll();
  }

  // ================= canonical rendering =================

  private stage(): number { return getCtx().shared.stageId; }

  /** Full rebuild from canonical state (create + resync Test D/E/F). */
  private reconstruct(): void {
    const s = getCtx().shared;
    // crystals
    for (const [idx, fig] of this.crystals) {
      if (s.crystalsMined.includes(idx)) { fig.destroy(); this.crystals.delete(idx); }
    }
    // jellies
    for (const [id, j] of this.jellies) {
      const dead = jellyDefeated(s, id);
      j.fig.root.setVisible(this.stage() >= 2 && !dead);
      const shielded = id === 'jelly-shield' && !s.jellyShieldBroken;
      j.fig.setShielded(shielded, s.stageId < 3);
      this.renderPips(id);
    }
    // stairs + star
    if (s.starReachable && !this.stairs) this.drawStairs(true);
    if (s.starCollected && this.starFig) { this.starFig.destroy(); this.starFig = null; }
    // cage
    for (let i = 0; i < this.cageBars.length; i++) {
      this.cageBars[i].setVisible(i >= Math.min(3, s.cageHits));
    }
    this.cageLock?.setVisible(!s.cageBroken);
    if (s.cageBroken && this.unicornFig && !s.unicornCalmed) {
      this.unicornFig.setScale(1);
    }
    if (s.unicornCalmed) this.showFreedUnicorn();
    // gate + bridge + power
    this.renderBridge();
    this.renderGate();
    this.renderPower();
  }

  private renderAll(): void {
    this.renderBridge();
    const s = getCtx().shared;
    for (const [id] of this.jellies) {
      const j = this.jellies.get(id)!;
      const dead = jellyDefeated(s, id);
      if (dead) { j.fig.root.setVisible(false); j.pips.forEach((p) => p.setVisible(false)); continue; }
      if (this.stage() >= 2) j.fig.root.setVisible(true);
      j.fig.setShielded(id === 'jelly-shield' && !s.jellyShieldBroken, s.stageId < 3);
      this.renderPips(id);
    }
    this.renderGate();
    this.renderPower();
  }

  private renderPips(id: string): void {
    const s = getCtx().shared;
    const j = this.jellies.get(id);
    if (!j) return;
    const left = Math.max(0, JELLY_HP - jellyHitsTotal(s, id));
    const show = j.fig.root.visible && left > 0;
    j.pips.forEach((p, i) => {
      p.setVisible(show && i < left);
      p.setPosition(j.fig.root.x - 16 + i * 16, j.fig.root.y - 70);
    });
  }

  private renderBridge(): void {
    const s = getCtx().shared;
    if (!s.bridgeBuilt) {
      this.bridge.setFillStyle(0x52525b);
      this.bridgeLabel.setText(s.enchantRequested ? 'bridge: magic waiting…' : 'bridge: broken');
      if (s.enchantRequested && !this.bridgeWaitSpark) {
        this.bridgeWaitSpark = this.add.star(800, 420, 5, 8, 16, 0xf0abfc).setStrokeStyle(2, 0xffffff);
        this.tweens.add({ targets: this.bridgeWaitSpark, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
      }
    } else if (!s.bridgeEnchanted) {
      this.bridge.setFillStyle(0xa8a29e);
      this.bridgeLabel.setText('bridge: built, needs magic…');
    } else {
      this.bridge.setFillStyle(0xf0abfc);
      this.bridgeLabel.setText('rainbow bridge!');
      this.bridgeWaitSpark?.destroy();
      this.bridgeWaitSpark = null;
    }
  }

  private renderGate(): void {
    const s = getCtx().shared;
    this.gate.setFillStyle(s.gateOpen ? 0x4ade80 : s.stageId < 3 ? 0x78716c : 0xa78bfa);
    this.gateBar.setDisplaySize(Math.max(1, (s.gateCharge / 100) * 100), 10);
    this.gateGlowJ.setAlpha(s.gateJacksonReady ? 1 : 0.25);
    this.gateGlowL.setAlpha(s.gateLaylaReady ? 1 : 0.25);
  }

  private renderPower(): void {
    const s = getCtx().shared;
    const p = Math.round(s.siblingPower);
    this.powerText.setText(`Sibling Power: ${p}${p >= 100 ? ' — HIGH FIVE!' : ''}   Stars: ${sharedStarsTotal(s)}`);
    if (p >= 100 && !this.siblingOverlay) this.showSiblingPower();
  }

  /** Mirror canonical shared progression into the local family save (receiver side). */
  private mirrorSave(): void {
    const c = getCtx();
    if (syncSaveFromShared(c.save, c.shared)) storeSave(c.save);
  }

  private drawStairs(silent: boolean): void {
    if (this.stairs) return;
    this.stairs = this.add.rectangle(1210, 470, 130, 90, 0xb45309).setStrokeStyle(4, 0xffffff);
    this.add.rectangle(1210, 430, 130, 10, 0x8b5a2b);
    if (!silent) {
      getCtx().addSiblingPower(8);
      audio.say('stairs', 'Stairs! Layla, climb up and grab the star!', { for: 'layla' });
    }
  }

  private showFreedUnicorn(): void {
    if (this.unicornFree) return;
    this.cageBars.forEach((b) => b.setVisible(false));
    this.cageLock?.setVisible(false);
    if (this.unicornFig) { this.unicornFig.destroy(); this.unicornFig = null; }
    const free = makeUnicorn(this, false);
    free.setPosition(1470, 430);
    this.unicornFree = free;
    this.mirrorSave(); // canonical pets/decorations/trophies → family save
  }

  // ================= stage machine =================

  private enterStage(i: number, force = false): void {
    if (i === this.lastStage && !force) return;
    const first = this.lastStage === -1;
    if (!first && this.lastStage >= 0) {
      playlog.log('stage-time', `stage ${this.lastStage} took ${Math.round((Date.now() - this.stageT0) / 1000)}s`);
    }
    this.stageT0 = Date.now();
    playlog.log('stage-enter', `stage ${i}`);
    this.lastStage = i;
    const c = getCtx();
    const s = STAGES[Math.min(i, STAGES.length - 1)];
    audio.setState(`candy-${s.id}`); // invalidate obsolete speech (§14)
    if (!first || force) {
      audio.say(`stage-${s.id}`, s.voice, { hostOnly: true }); // story: host tablet only (no echo)
      if (c.hero === 'layla' && stripEmoji(s.laylaHint)) {
        audio.say(`lh-${s.id}`, stripEmoji(s.laylaHint), { for: 'layla' });
      }
    }
    const hint = c.hero === 'jackson' ? s.jacksonHint : s.laylaHint;
    document.querySelector('.hint-bar')!.textContent = hint;
    playlog.log('hint', `stage ${i}: ${hint}`);
    this.stageText.setText(`${s.id}`);
    // one-time stage reward, idempotent across tablets
    if (i >= 1 && i <= 7) c.grantReward(`stage-${i}`, 5);
    this.renderPower();
    this.jellies.forEach((j) => {
      const dead = jellyDefeated(c.shared, [...this.jellies.entries()].find(([, v]) => v === j)?.[0] ?? '');
      j.fig.root.setVisible(i >= 2 && !dead);
    });
    this.cameras.main.setBackgroundColor(i >= 3 ? '#7dd3fc' : '#6b7280');
    this.moveMarker(i);
    this.lastMilestone = 0;
    // gate climax role banner (§playtest-10): each hero sees their own job
    if (i === 7) {
      const role = c.hero === 'jackson' ? 'HOLD IT!' : 'CHARGE THE MAGIC!';
      this.gateBanner.setText(role).setVisible(true);
      audio.say('gate-role', c.hero === 'jackson'
        ? 'Hold the gate machine, Jackson! Layla is charging!'
        : 'Charge the magic, Layla! Jackson is holding!', { urgent: true, for: c.hero });
      this.time.delayedCall(3500, () => this.gateBanner.setVisible(false));
    } else {
      this.gateBanner.setVisible(false);
    }
    // celebration stages auto-advance on both tablets (idempotent)
    if ((i === 3 || i === 8) && !this.rewardTimer) {
      this.rewardTimer = true;
      this.time.delayedCall(3500, () => {
        if (i === 8) this.returnHome();
        else c.advanceStage();
      });
    }
  }

  private checkStageChanged(): void {
    if (getCtx().shared.stageId !== this.lastStage) this.enterStage(getCtx().shared.stageId);
  }

  private moveMarker(i: number): void {
    const spots: Record<number, { x: number; y: number }> = {
      0: { x: 1050, y: 340 },
      1: { x: 800, y: 380 },
      2: { x: 1000, y: 340 },
      3: { x: this.hero.x, y: this.hero.y - 120 },
      4: { x: 800, y: 380 },
      5: { x: 1280, y: 260 },
      6: { x: 1470, y: 320 },
      7: { x: 1620, y: 300 },
      8: { x: this.hero.x, y: this.hero.y - 120 }
    };
    const p = spots[Math.min(i, 8)];
    this.marker.setPosition(p.x, p.y);
  }

  /** Observe canonical state → advance when the co-op condition holds. Any tablet may trigger; max-wins. */
  private checkStageProgress(): void {
    const c = getCtx();
    const s = c.shared;
    const i = s.stageId;
    if (i === 1 && bridgeCrossable(s)) c.advanceStage();
    else if (i === 2 && s.jelliesDefeated.length >= 3 && !s.crownPieces.includes('candy-1')) this.collectCrown('candy-1');
    else if (i === 4 && s.siblingPower >= 20) c.advanceStage(); // freeze co-op done (see laylaMagic)
    else if (i === 5 && s.starCollected) c.advanceStage();
    else if (i === 6 && unicornRescued(s)) c.advanceStage();
    else if (i === 7 && s.gateOpen && !s.crownPieces.includes('candy-2')) this.collectCrown('candy-2');
  }

  private collectCrown(id: string): void {
    const c = getCtx();
    if (c.shared.crownPieces.includes(id)) return;
    c.emit('crown', { id });
    this.mirrorSave(); // crowns + restoration → family save on both tablets
    audio.say(`crown-${id}`, 'A piece of the Night Rainbow Crown! You are heroes!', { hostOnly: true });
    const crown = makeCrownPiece(this);
    crown.setPosition(this.hero.x, this.hero.y - 110);
    this.tweens.add({ targets: crown, y: crown.y - 40, alpha: 0, duration: 1800, onComplete: () => crown.destroy() });
    this.burst(this.hero.x, this.hero.y - 60, 0xfacc15);
    this.cameras.main.flash(400, 250, 204, 21);
    this.rewardStars(`crown-${id}`, 8);
    c.advanceStage();
  }

  private returnHome(): void {
    if (this.returned) return;
    this.returned = true;
    const c = getCtx();
    c.emit('mission-done', { id: 'grey-kingdom' });
    c.patch({ missionComplete: true, currentWorld: 'home' });
    this.mirrorSave();
    audio.say('home', 'Back to the treehouse! Your unicorn is waiting!', { hostOnly: true });
    this.scene.start('treehouse');
  }

  /** Shared star reward — canonical ledger, floating text only when newly granted. */
  private rewardStars(id: string, n: number): void {
    if (!getCtx().grantReward(id, n)) return;
    audio.blip(880, 120);
    const t = this.add.text(this.hero.x, this.hero.y - 120, `+${n} stars`, { fontSize: '24px', color: '#fde047', fontStyle: 'bold' }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    this.renderPower();
  }

  // ================= asymmetric actions =================

  private near(x: number, y: number, r: number): boolean {
    const zone = r + (this.fails >= 3 ? 40 : 0); // quiet assist
    return Phaser.Math.Distance.Between(this.hero.x, this.hero.y, x, y) < zone;
  }

  private buddyNear(x: number, y: number, r: number): boolean {
    return Phaser.Math.Distance.Between(this.buddy.x, this.buddy.y, x, y) < r;
  }

  /** Co-op interactions need both heroes in the area (§playtest-8). Gentle: hint + trail, never a hard lock. */
  private needBuddy(x: number, y: number, who: string): boolean {
    if (this.buddyNear(x, y, 900)) return true;
    const c = getCtx();
    this.setHintTemp(`Wait for ${who} — follow the arrow!`);
    audio.say('wait-sib', `Wait for ${who}!`, { for: c.hero });
    playlog.log('failed-action', `gated by sibling distance stage=${this.stage()}`);
    this.pointLeash();
    return false;
  }

  private logFail(what: string): void {
    playlog.log('failed-action', `${what} stage=${this.stage()}`);
  }

  private onActionButton(): void {
    const c = getCtx();
    audio.blip(c.hero === 'jackson' ? 300 : 990, 90);
    if (c.hero === 'jackson') {
      for (const [idx, fig] of [...this.crystals]) {
        if (this.near(fig.x, fig.y, 100)) {
          c.emit('mine', { idx });
          fig.destroy();
          this.crystals.delete(idx);
          this.rewardStars(`mine-${idx}`, 2);
          const n = c.shared.jacksonBlocks;
          audio.say(`block-${Math.min(n, 3)}`, n >= 3 ? 'Three blocks! Go build the bridge!' : `Block ${n} of 3!`, { for: 'jackson' });
          this.checkStageProgress();
          return;
        }
      }
      for (const [id, j] of this.jellies) {
        if (!j.fig.root.visible || jellyDefeated(c.shared, id)) continue;
        if (this.near(j.fig.root.x, j.fig.root.y, 105)) {
          if (id === 'jelly-shield' && !c.shared.jellyShieldBroken) {
            audio.say('need-layla', 'Magic shield! Layla, zap it so I can hit it!', { for: 'jackson' });
            audio.say('need-layla-l', 'Jackson needs you! Tap the shiny jelly with magic!', { for: 'layla' });
            this.setHintTemp('Shielded! Layla must break the shiny shield first!');
          } else {
            const n = (c.shared.jellyHitsJackson[id] ?? 0) + 1;
            c.emit('hit-jelly', { jelly: id, n });
            this.swipe(j.fig.root.x, j.fig.root.y);
            this.renderPips(id);
            if (jellyDefeated(getCtx().shared, id)) {
              this.burst(j.fig.root.x, j.fig.root.y, 0x4ade80);
              j.fig.root.setVisible(false);
              j.pips.forEach((p) => p.setVisible(false));
              this.rewardStars(`jelly-${id}`, 3);
              c.addSiblingPower(6);
            }
            this.checkStageProgress();
          }
          return;
        }
      }
      if (this.stage() >= 5 && !c.shared.cageBroken && this.near(1470, 440, 120)) {
        c.emit('cage-hit', {});
        this.cameras.main.shake(120, 0.004);
        audio.blip(180, 100);
        this.reconstruct();
        if (getCtx().shared.cageBroken) {
          audio.say('cage-open', 'Cage open! Layla, calm the unicorn gently!');
          this.setHintTemp('Good smashing! Now Layla calms it!');
        }
        return;
      }
      if (c.shared.laylaHP <= 0 && this.near(this.buddy.x, this.buddy.y, 120)) {
        c.emit('revive', { who: 'layla' });
        audio.say('revive', 'Jackson saved Layla! High five!');
      }
    } else {
      this.laylaMagic();
      if (c.shared.jacksonHP <= 0 && this.near(this.buddy.x, this.buddy.y, 120)) {
        c.emit('revive', { who: 'jackson' });
        audio.say('revive', 'Layla healed Jackson! Yay!');
      }
    }
  }

  private onBuildButton(): void {
    const c = getCtx();
    if (c.hero !== 'jackson') return;
    const s = c.shared;
    if (this.stage() === 1 && !s.bridgeBuilt && this.near(800, 480, 230)) {
      if (s.jacksonBlocks >= 3) {
        if (!this.needBuddy(800, 480, c.hero === 'jackson' ? 'Layla' : 'Jackson')) return;
        c.emit('bridge-built', {});
        this.renderBridge();
        audio.say('bridge-built', 'Bridge built! But it is grey… Layla, add magic!');
        this.checkStageProgress();
      } else {
        audio.say('need-blocks', 'Smash three sparkly crystals first, Jackson!', { for: 'jackson' });
        this.setHintTemp('Smash 3 crystals first, then BUILD!');
        this.logFail('build-without-blocks');
      }
      return;
    }
    if (this.stage() === 5 && !s.starReachable && this.near(1245, 470, 230)) {
      if (!this.needBuddy(1245, 470, 'Layla')) return;
      c.emit('stairs-built', {});
      this.drawStairs(false);
    }
  }

  private onMagicButton(): void {
    if (getCtx().hero !== 'layla') return;
    this.laylaMagic();
  }

  private laylaMagic(): void {
    const c = getCtx();
    const s = c.shared;
    audio.blip(990, 140);
    // enchant bridge (works whenever built; intent stored even if early — Test B)
    if ((this.stage() === 1 || s.bridgeBuilt) && this.near(800, 470, 240)) {
      const breathe = s.bridgeBuilt;
      if (breathe && !this.needBuddy(800, 470, 'Jackson')) return;
      c.emit('bridge-enchanted', {});
      this.renderBridge();
      if (breathe && getCtx().shared.bridgeEnchanted) {
        audio.say('bridge-magic', 'Rainbow bridge! You did it together!');
        this.burst(800, 480, 0xf0abfc);
      } else if (!breathe) {
        audio.say('enchant-wait', 'Magic is waiting! Jackson, finish building!', { for: 'layla' });
      }
      this.checkStageProgress();
      return;
    }
    // break jelly shield
    if (this.stage() >= 2 && !s.jellyShieldBroken) {
      const j = this.jellies.get('jelly-shield');
      if (j && !jellyDefeated(s, 'jelly-shield') && this.near(j.fig.root.x, j.fig.root.y, 220)) {
        c.emit('shield-break', {});
        j.fig.setShielded(false, s.stageId < 3);
        audio.say('shield-down', 'Shield down! Jackson, get it!');
        c.addSiblingPower(8);
        this.burst(j.fig.root.x, j.fig.root.y, 0xf0abfc);
        return;
      }
    }
    // freeze chocolate (stage 4 co-op: Layla freezes while Jackson stands by)
    if (this.stage() === 4 && this.near(800, 470, 240)) {
      c.emit('freeze', {});
      c.addSiblingPower(6);
      this.burst(this.hero.x, this.hero.y - 60, 0x7dd3fc);
      const buddyNear = Phaser.Math.Distance.Between(this.buddy.x, this.buddy.y, 800, 470) < 260;
      if (buddyNear) this.checkStageProgress();
      else this.setHintTemp('Jackson, come stand by the river too!');
      return;
    }
    // calm unicorn
    if (this.stage() >= 5 && s.cageBroken && !s.unicornCalmed && this.near(1470, 440, 170)) {
      if (!this.needBuddy(1470, 440, 'Jackson')) return;
      c.emit('unicorn-calm', {});
      this.showFreedUnicorn();
      audio.say('unicorn', 'The candy unicorn loves you! It will live in your treehouse!');
      this.rewardStars('unicorn', 8);
      this.checkStageProgress();
      return;
    }
    // charge gate crystal
    if (this.stage() === 7 && this.near(1620, 440, 210)) {
      c.chargeGate(25);
      this.burst(this.hero.x, this.hero.y - 60, 0xf0abfc);
      this.renderGate();
    }
  }

  // ================= wire events (receiver side) =================

  private handleEvent(kind: string, payload: Record<string, unknown>, from: 'jackson' | 'layla' | 'system'): void {
    const c = getCtx();
    if (kind === 'freeze' || kind === 'hit' || kind === 'portal-hold') return; // visual/local only
    if (kind === 'revive') {
      const who = payload['who'] as string;
      if (who === 'jackson') c.shared.jacksonHP = 3;
      else c.shared.laylaHP = 3;
      c.addSiblingPower(10);
      return;
    }
    if (kind === 'sibling-ready') {
      this.siblingReadyBuddy = true;
      this.renderGate();
      this.checkSiblingBurst();
      return;
    }
    if (kind === 'sibling-burst') {
      applyAction(c.shared, { type: 'sibling-burst' });
      this.burst(this.hero.x, this.hero.y - 60, 0xf0abfc);
      this.renderPower();
      return;
    }
    const action = actionFor(kind, payload, from === 'system' ? c.hero : from);
    if (action) {
      applyAction(c.shared, action);
      this.afterRemoteAction(kind);
      return;
    }
  }

  private afterRemoteAction(kind: string): void {
    const c = getCtx();
    // refresh visuals that the action affects
    if (kind === 'mine') {
      const idx = c.shared.crystalsMined[c.shared.crystalsMined.length - 1];
      this.crystals.get(idx)?.destroy();
      this.crystals.delete(idx);
      this.burst(400, 420, 0x22d3ee);
    }
    if (kind === 'bridge-built') {
      this.burst(800, 480, 0xd97706);
      this.touch.pulseContext();
    }
    if (kind === 'bridge-enchanted') this.notifyEnchanted();
    if (kind === 'shield-break') this.notifyShieldDown();
    if (kind === 'stairs-built') {
      this.drawStairs(true);
      this.burst(1210, 430, 0xd97706);
      this.touch.pulseContext();
      audio.say('stairs-see', 'Stairs! Climb up!', { for: 'layla' });
    }
    if (kind === 'star-taken') {
      if (this.starFig) { this.starFig.destroy(); this.starFig = null; }
      this.burst(1280, 300, 0xfacc15);
      audio.blip(1320, 200);
    }
    if (kind === 'cage-hit') {
      this.cameras.main.shake(120, 0.004);
      audio.blip(180, 100);
    }
    if (kind === 'unicorn-calm') {
      this.showFreedUnicorn();
      this.burst(1470, 400, 0xf9a8d4);
      this.burst(1470, 360, 0xf9a8d4);
      this.fanfare(false);
    }
    if (kind === 'crown') {
      this.fanfare(true);
      this.cameras.main.flash(400, 250, 204, 21);
    }
    if (kind === 'gate-charge') {
      audio.blip(500 + c.shared.gateCharge * 6, 90);
      this.renderGate();
    }
    if (kind === 'gate-open') {
      this.burst(1620, 440, 0x4ade80);
      this.fanfare(true);
    }
    this.mirrorSave();
    this.renderAll();
    this.checkStageChanged();
    this.checkStageProgress();
  }

  /** Layla broke the shield → Jackson SEES it explode and his HIT button pulses (§playtest-9). */
  private notifyShieldDown(): void {
    const j = this.jellies.get('jelly-shield');
    if (j) {
      j.fig.setShielded(false, getCtx().shared.stageId < 3);
      this.burst(j.fig.root.x, j.fig.root.y, 0xf0abfc);
      this.burst(j.fig.root.x, j.fig.root.y - 30, 0xffffff);
    }
    this.cameras.main.flash(200, 240, 171, 252);
    this.fanfare(false);
    if (getCtx().hero === 'jackson') {
      this.touch.pulseAction();
      audio.say('shield-down-j', 'Shield exploded! Hit it, Jackson!', { for: 'jackson' });
    }
  }

  private notifyEnchanted(): void {
    this.renderBridge();
    this.burst(740, 480, 0xef4444);
    this.burst(800, 470, 0xfacc15);
    this.burst(860, 480, 0x3b82f6);
    this.cameras.main.flash(350, 240, 171, 252);
    this.fanfare(true);
    audio.say('bridge-magic', 'Rainbow bridge! You did it together!');
  }

  /** Little ascending arpeggio — the "your sibling did something for you" sound. */
  private fanfare(big: boolean): void {
    const notes = big ? [523, 659, 784, 1047, 1319] : [660, 880, 1175];
    notes.forEach((f, i) => setTimeout(() => audio.blip(f, 140), i * 110));
  }

  // ================= sibling power =================

  private swipe(x: number, y: number): void {
    audio.blip(200, 80);
    const slash = this.add.rectangle(x, y, 60, 10, 0xffffff).setAngle(-30);
    this.tweens.add({ targets: slash, alpha: 0, x: x + 20, duration: 250, onComplete: () => slash.destroy() });
  }

  private burst(x: number, y: number, color: number): void {
    const p = this.add.circle(x, y, 10, color);
    this.tweens.add({ targets: p, scale: 4, alpha: 0, duration: 500, onComplete: () => p.destroy() });
  }

  private setHintTemp(t: string): void {
    const el = document.querySelector('.hint-bar');
    if (el) el.textContent = t;
  }

  private showSiblingPower(): void {
    const c = getCtx();
    audio.say('sib-ready', 'Sibling Power is ready! High five, then smash the button together!', { urgent: true });
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.rectangle(W / 2, H / 2, 480, 230, 0x000000, 0.78).setScrollFactor(0);
    const label = this.add.text(W / 2, H / 2 - 52, 'HIGH FIVE!', { fontSize: '42px', color: '#fde047', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);
    const btn = this.add.circle(W / 2, H / 2 + 52, 58, 0x22c55e).setScrollFactor(0).setInteractive({ useHandCursor: true });
    const handL = this.add.circle(W / 2 - 150, H / 2 + 52, 26, 0xb45309).setScrollFactor(0).setStrokeStyle(4, 0xffffff);
    const handR = this.add.circle(W / 2 + 150, H / 2 + 52, 26, 0xec4899).setScrollFactor(0).setStrokeStyle(4, 0xffffff);
    const txt = this.add.text(W / 2, H / 2 + 52, 'GO!', { fontSize: '32px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);
    this.siblingOverlay = this.add.container(0, 0, [bg, label, handL, handR, btn, txt]).setDepth(200);
    btn.on('pointerdown', () => {
      if (this.siblingReadyMe) return;
      this.siblingReadyMe = true;
      txt.setText('YES!');
      audio.blip(1200, 200);
      c.emit('sibling-ready', {});
      this.renderGate();
      this.checkSiblingBurst();
    });
  }

  private checkSiblingBurst(): void {
    const c = getCtx();
    if (!(this.siblingReadyMe && this.siblingReadyBuddy)) return;
    if (!c.burstSibling()) return;
    this.burst(this.hero.x, this.hero.y - 60, 0xf0abfc);
    this.cameras.main.flash(600, 240, 171, 252);
    audio.say('sib-go', 'Rainbow castle cannon! Boom! That was hilarious!');
    this.siblingOverlay?.destroy();
    this.siblingOverlay = null;
    this.siblingReadyMe = this.siblingReadyBuddy = false;
    this.renderPower();
    if (this.stage() === 7 && !c.shared.gateOpen) this.openGatePath();
  }

  private openGatePath(): void {
    const c = getCtx();
    if (c.shared.gateOpen) return;
    c.emit('gate-open', {});
    this.renderGate();
    // substantial payoff (§playtest-10): rainbow volley + fanfare + flash
    this.burst(1580, 420, 0xef4444);
    this.burst(1620, 400, 0xfacc15);
    this.burst(1660, 420, 0x3b82f6);
    this.burst(1620, 350, 0x4ade80);
    this.cameras.main.flash(600, 240, 171, 252);
    this.fanfare(true);
    audio.say('gate-open', 'The rainbow gate is OPEN! You did it together! High five!');
  }

  // ================= per-frame =================

  override update(_t: number, dt: number): void {
    const c = getCtx();
    const dtS = Math.min(dt / 1000, 0.05);
    const myHP = c.hero === 'jackson' ? c.shared.jacksonHP : c.shared.laylaHP;
    const knockedOut = myHP <= 0;
    const speed = knockedOut ? 0 : 280;
    const prevX = this.hero.x;
    this.hero.x = Phaser.Math.Clamp(this.hero.x + this.pad.mx * speed * dtS, 40, 1620);
    // river soft-block until the rainbow bridge is crossable (§3)
    if (!bridgeCrossable(c.shared) && this.hero.y > 420 && this.hero.x > RIVER.x0 && this.hero.x < RIVER.x1) {
      this.hero.x = prevX < 800 ? Math.min(prevX, RIVER.x0) : Math.max(prevX, RIVER.x1);
      if (this.stage() === 1 && Math.abs(_t - this.lastPatch) > 3000) {
        this.setHintTemp(c.hero === 'jackson' ? 'Build the bridge first!' : 'The bridge needs Jackson + your magic!');
      }
    }
    // gate soft-block until open
    if (!c.shared.gateOpen && this.hero.x > 1560) this.hero.x = 1560;
    const onStairs = this.stairs && Math.abs(this.hero.x - 1245) < 120;
    const targetY = onStairs ? 330 : GROUND_Y;
    this.hero.y += ((this.pad.my * 120) + (targetY - this.hero.y) * 3) * dtS;
    this.hero.y = Phaser.Math.Clamp(this.hero.y, 200, GROUND_Y);
    this.buddy.x += (this.buddyPos.x - this.buddy.x) * 0.12;
    this.buddy.y += (this.buddyPos.y - this.buddy.y) * 0.12;
    const tag = this.buddy.getData('tag') as Phaser.GameObjects.Container | undefined;
    tag?.setPosition(this.buddy.x, this.buddy.y);
    // freed unicorn follows Layla
    if (this.unicornFree) {
      const layla = c.hero === 'layla' ? this.hero : this.buddy;
      this.unicornFree.x += (layla.x - 70 - this.unicornFree.x) * 0.05;
      this.unicornFree.y = layla.y + 10;
    }

    if (_t - this.lastPatch > 150) {
      this.lastPatch = _t;
      c.patch(c.hero === 'jackson' ? { jacksonPos: { x: this.hero.x, y: this.hero.y } } : { laylaPos: { x: this.hero.x, y: this.hero.y } });
    }

    // jellies drift (quiet assist when struggling)
    const slow = this.fails >= 3 ? 0.45 : 1;
    for (const [id, j] of this.jellies) {
      if (!j.fig.root.visible || jellyDefeated(c.shared, id)) continue;
      j.fig.root.x += j.vx * slow * dtS;
      if (j.fig.root.x > 1160 || j.fig.root.x < 880) j.vx *= -1;
      // shield pulses unmistakably until broken
      if (id === 'jelly-shield' && !c.shared.jellyShieldBroken) {
        j.fig.ring.setAlpha(0.55 + 0.45 * Math.sin(_t / 280));
      } else {
        j.fig.ring.setAlpha(1);
      }
      j.hitCd -= dtS;
      this.renderPips(id);
      if (j.hitCd <= 0 && Phaser.Math.Distance.Between(this.hero.x, this.hero.y, j.fig.root.x, j.fig.root.y) < 62) {
        j.hitCd = 1.4;
        this.fails += 1;
        if (c.hero === 'jackson') c.patch({ jacksonHP: Math.max(0, c.shared.jacksonHP - 1) });
        else c.patch({ laylaHP: Math.max(0, c.shared.laylaHP - 1) });
        this.cameras.main.shake(150, 0.005);
        audio.blip(140, 150);
        const hp = c.hero === 'jackson' ? c.shared.jacksonHP : c.shared.laylaHP;
        if (hp <= 0) {
          audio.say('ko', c.hero === 'jackson' ? 'Jackson is dizzy! Layla, tap him with magic!' : 'Layla is in a bubble! Jackson, run to her!', { urgent: true });
          this.setHintTemp(c.hero === 'jackson' ? 'Layla! Go tap Jackson!' : 'Jackson! Go tap Layla!');
        }
      }
    }

    // gummy intro
    if (this.stage() === 0 && this.near(1050, 470, 130)) c.advanceStage();

    // star pickup (Layla climbs stairs Jackson built)
    if (!c.shared.starCollected && c.shared.starReachable && this.starFig && this.near(1280, 300, 130)) {
      if (c.hero === 'layla') {
        c.emit('star-taken', {});
        this.starFig.destroy();
        this.starFig = null;
        this.rewardStars('star', 6);
        c.addSiblingPower(10);
        audio.say('star', 'Fairy star! Jackson helped Layla reach it!');
        this.checkStageProgress();
      }
    }

    // dual gate: proximity charge + high-five path (§2 flags)
    if (this.stage() === 7 && !c.shared.gateOpen) {
      const meNear = this.near(1620, 440, 210);
      const buddyNear = Phaser.Math.Distance.Between(this.buddy.x, this.buddy.y, 1620, 440) < 230;
      if (meNear && buddyNear) {
        this.chargeTick += dtS;
        if (this.chargeTick > 0.8) {
          this.chargeTick = 0;
          c.chargeGate(10);
          this.burst(1620, 400, 0xf0abfc);
          this.renderGate();
        }
        // rising tension as the charge climbs (§playtest-10)
        const ch = c.shared.gateCharge;
        if (ch >= 75 && this.lastMilestone < 75) { this.lastMilestone = 75; audio.blip(900, 160); this.cameras.main.flash(120, 240, 171, 252); }
        else if (ch >= 50 && this.lastMilestone < 50) { this.lastMilestone = 50; audio.blip(700, 150); }
        else if (ch >= 25 && this.lastMilestone < 25) { this.lastMilestone = 25; audio.blip(520, 140); }
        if (c.shared.gateCharge >= 100) this.openGatePath();
        else if (c.shared.gateJacksonReady && c.shared.gateLaylaReady) this.openGatePath();
      } else {
        this.chargeTick = 0;
      }
      if (c.shared.gateOpen && !c.shared.crownPieces.includes('candy-2')) this.collectCrown('candy-2');
    }

    this.updateLeash(_t);
    this.updateButtonAvailability();

    if (this.siblingReadyBuddy && this.siblingReadyMe) this.checkSiblingBurst();
    this.hero.setAlpha(knockedOut ? 0.4 : 1);
  }

  // ================= sibling leash (§playtest-8) =================
  // Never hard-lock movement: point back with a glowing arrow + voice.

  private updateLeash(_t: number): void {
    const c = getCtx();
    const d = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, this.buddy.x, this.buddy.y);
    if (d > 800 && !this.separated) {
      this.separated = true;
      playlog.log('separation-start', `gap=${Math.round(d)} stage=${this.stage()}`);
      const who = c.hero === 'jackson' ? 'Layla' : 'Jackson';
      audio.say('wait-sib', `Wait for ${who}! Stay together!`, { for: c.hero });
      this.setHintTemp(`Wait for ${who}! Follow the arrow!`);
      this.lastWaitVoice = Date.now();
    } else if (d < 500 && this.separated) {
      this.separated = false;
      playlog.log('separation-end', `stage=${this.stage()}`);
      this.leashArrow.setVisible(false);
    }
    if (this.separated) {
      if (Date.now() - this.lastWaitVoice > 12000) {
        this.lastWaitVoice = Date.now();
        const who = c.hero === 'jackson' ? 'Layla' : 'Jackson';
        audio.say('wait-sib', `Stay with ${who}!`, { for: c.hero });
      }
      this.pointLeash();
    } else {
      this.leashArrow.setVisible(false);
    }
    void _t;
  }

  private pointLeash(): void {
    const a = Math.atan2(this.buddy.y - this.hero.y, this.buddy.x - this.hero.x);
    this.leashArrow.setVisible(true);
    this.leashArrow.setPosition(this.hero.x + Math.cos(a) * 95, this.hero.y - 60 + Math.sin(a) * 40);
    this.leashArrow.setRotation(a + Math.PI / 2);
  }

  // ================= contextual buttons (§playtest-7) =================
  // Jackson's BUILD glows only near something buildable; Layla's swirl glows
  // only when her magic is needed. HIT/wand stay live (harmless fun).

  private updateButtonAvailability(): void {
    const c = getCtx();
    const s = c.shared;
    if (c.hero === 'jackson') {
      const nearBuild = (this.stage() === 1 && !s.bridgeBuilt && this.near(800, 480, 260)) ||
        (this.stage() === 5 && !s.starReachable && this.near(1245, 470, 260));
      this.touch.setContextAvailable(nearBuild);
    } else {
      const nearMagic = ((this.stage() === 1 || s.bridgeBuilt) && !s.bridgeEnchanted && this.near(800, 470, 260)) ||
        (this.stage() >= 2 && !s.jellyShieldBroken && this.nearJellyShield()) ||
        (this.stage() === 4 && this.near(800, 470, 260)) ||
        (this.stage() >= 5 && s.cageBroken && !s.unicornCalmed && this.near(1470, 440, 190)) ||
        (this.stage() === 7 && this.near(1620, 440, 230));
      this.touch.setContextAvailable(nearMagic);
    }
  }

  private nearJellyShield(): boolean {
    const j = this.jellies.get('jelly-shield');
    if (!j || !j.fig.root.visible) return false;
    return this.near(j.fig.root.x, j.fig.root.y, 230);
  }
}
