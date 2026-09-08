// Secret underground base (§9) + portal room (§10).
// Both heroes stand on their pads (Dual Buttons, generous window).
// Reconstructs from canonical snapshot: an open portal stays open after resync.
// Logic + positions unchanged; all visuals rebuilt as an adventure hideout.
import Phaser from 'phaser';
import { getCtx } from './context';
import {
  makeHero, makeStoneWall, makeMetalFloor, makePipeRun, makeGlowCrystals,
  makeMapTable, makeTreasureShelf, makeStoneDoor, makePortalMachine, makePad,
  makeWallBanner, heroIdle, heroFace
} from './art';
import { makePrompt, dustMotes } from './fx';
import { makeVignette } from './art';
import { createTouchUI, type PadState } from './ui';
import { audio } from '../core/audioQueue';

export class UndergroundScene extends Phaser.Scene {
  private pad: PadState = { mx: 0, my: 0, action: false, build: false, magic: false };
  private hero!: Phaser.GameObjects.Container;
  private buddy!: Phaser.GameObjects.Container;
  private buddyPos = { x: 0, y: 0 };
  private heroTag!: Phaser.GameObjects.Container;
  private buddyTag!: Phaser.GameObjects.Container;
  private jacksonHold = 0;
  private laylaHold = 0;
  private opened = false;

  constructor() { super('underground'); }

  create(): void {
    const c = getCtx();
    audio.setState('underground');
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor('#0b1226');

    // ---- stone shell + metal floor ----
    makeStoneWall(this, W / 2, 120, W, 220).setDepth(-10);
    makeMetalFloor(this, W / 2, H - 70, W, 190).setDepth(-9);
    this.add.rectangle(W / 2, H - 165, W, 14, 0x1e293b).setDepth(-8);
    makePipeRun(this, W / 2, 26, W - 40).setDepth(-8);
    // wall torches
    for (const tx of [W / 2 - 320, W / 2 + 320]) {
      this.add.rectangle(tx, 130, 10, 30, 0x6b4226).setDepth(-8);
      const fl = this.add.circle(tx, 108, 11, 0xf59e0b).setDepth(-7);
      this.add.circle(tx, 108, 20, 0xf59e0b, 0.25).setDepth(-8);
      this.tweens.add({ targets: fl, scale: 1.3, duration: 380, yoyo: true, repeat: -1 });
    }

    // ---- future doors (same slots as before) ----
    const demoDone = getCtx().save.completedMissions.includes('grey-kingdom');
    makeStoneDoor(this, 90, 130, 88, 120, 'candy').setDepth(-7);
    makeStoneDoor(this, 200, 130, 88, 120, demoDone ? 'tease' : 'locked').setDepth(-7);
    if (demoDone) {
      this.add.text(200, 205, 'coming soon…', { fontSize: '15px', color: '#a7f3d0', fontStyle: 'bold' }).setOrigin(0.5).setDepth(-6);
    }
    makeStoneDoor(this, 310, 130, 88, 120, 'locked').setDepth(-7);
    if (demoDone) {
      audio.say('tease', 'Ooh… a new adventure is coming…', { hostOnly: true });
    }
    // carved plaque title instead of flat text
    const titlePlaque = this.add.rectangle(W - 250, 66, 250, 52, 0x1e293b).setStrokeStyle(4, 0xfbbf24).setDepth(-6);
    void titlePlaque;
    this.add.text(W - 250, 66, 'PORTAL ROOM', { fontSize: '25px', color: '#fde68a', fontStyle: 'bold' }).setOrigin(0.5).setDepth(-5);
    for (const rx of [W - 360, W - 140]) this.add.circle(rx, 66, 5, 0xfbbf24).setDepth(-5);

    // ---- hideout dressing ----
    makeMapTable(this, 175, H - 150).setDepth(-6);
    makeTreasureShelf(this, W - 175, 265).setDepth(-6);
    makeGlowCrystals(this, 120, H - 130, 0.9).setDepth(-6);
    makeGlowCrystals(this, W - 120, H - 200, 0.7, 0xa78bfa).setDepth(-6);
    // wall gear, slowly turning
    const gear = this.add.star(W - 90, 420, 8, 26, 40, 0x3b4f7a).setStrokeStyle(4, 0x8fa3c4).setDepth(-8);
    this.add.circle(W - 90, 420, 12, 0x24335c).setDepth(-7);
    this.tweens.add({ targets: gear, angle: 360, duration: 14000, repeat: -1 });

    // ---- portal machine + galaxy portal with rune ring (same centre) ----
    const px = W / 2, py = H / 2 + 10;
    makePortalMachine(this, px, py, 96).setDepth(-7);
    this.add.circle(px, py, 104, 0x1e1b4b).setDepth(-6);
    // galaxy swirl: layered discs + star specks, slow rotation
    const swirl = this.add.container(px, py).setDepth(-5);
    const sw1 = this.add.circle(0, 0, 78, 0x4c1d95);
    const sw2 = this.add.circle(0, 0, 58, 0x7c3aed);
    const sw3 = this.add.circle(0, 0, 38, 0x38bdf8);
    const sw4 = this.add.circle(0, 0, 20, 0xe0f2fe);
    swirl.add([sw1, sw2, sw3, sw4]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = 24 + (i % 3) * 16;
      const sp = this.add.star(Math.cos(a) * r, Math.sin(a) * r, 5, 3, 7, 0xffffff);
      swirl.add(sp);
      this.tweens.add({ targets: sp, alpha: 0.2, duration: 500 + i * 90, yoyo: true, repeat: -1 });
    }
    this.tweens.add({ targets: swirl, angle: 360, duration: 24000, repeat: -1 });
    // rune ring: alternating crown + star runes riding the outer ring
    const runes = this.add.container(px, py).setDepth(-4);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rx = Math.cos(a) * 90, ry = Math.sin(a) * 90;
      if (i % 2 === 0) runes.add(this.add.triangle(rx, ry, 0, 0, -8, 6, 8, 6, 0xfacc15));
      else runes.add(this.add.star(rx, ry, 5, 4, 9, 0xf0abfc));
    }
    this.tweens.add({ targets: runes, angle: -360, duration: 30000, repeat: -1 });
    const ring1 = this.add.circle(px, py, 90, 0x7c3aed, 0).setStrokeStyle(10, 0xfbbf24).setDepth(-4);
    const ring2 = this.add.circle(px, py, 68, 0xa855f7, 0.3).setStrokeStyle(8, 0xf0abfc).setDepth(-4);
    this.tweens.add({ targets: [ring1, ring2], scale: 1.06, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // motto banners + floor plaque (togetherness identity)
    makeWallBanner(this, 420, 300, 120, 150, ['BUILD', 'EXPLORE', 'IMAGINE', 'TOGETHER'], 0x1e3a8a).setDepth(-6);
    makeWallBanner(this, W - 420, 300, 120, 150, ['KINDER', 'BRAVER', 'BRIGHTER', 'TOGETHER'], 0x701a75).setDepth(-6);
    const plaque = this.add.rectangle(W / 2, H - 56, 330, 56, 0x1e293b).setStrokeStyle(3, 0xfbbf24).setDepth(-5);
    void plaque;
    this.add.text(W / 2, H - 56, 'SOME ADVENTURES ARE BETTER TOGETHER', { fontSize: '15px', color: '#fde68a', fontStyle: 'bold' }).setOrigin(0.5).setDepth(-4);

    this.hero = makeHero(this, c.hero);
    this.hero.setPosition(W / 2 - 160, H - 120);
    this.hero.setScale(1.28).setData('scl', 1.28);
    this.buddy = makeHero(this, c.hero === 'jackson' ? 'layla' : 'jackson');
    this.buddyPos = { x: W / 2 + 160, y: H - 120 };
    this.buddy.setPosition(this.buddyPos.x, this.buddyPos.y).setAlpha(0.6);
    this.buddy.setScale(1.28).setData('scl', 1.28);
    heroIdle(this, this.hero);
    this.heroTag = makePrompt(this, this.hero.x, this.hero.y - 218,
      c.hero === 'jackson' ? 'Jackson • YOU' : 'Layla • YOU',
      { bg: c.hero === 'jackson' ? 0xb45309 : 0xbe185d, fontSize: '19px', pulse: false });
    this.buddyTag = makePrompt(this, this.buddy.x, this.buddy.y - 218,
      c.hero === 'jackson' ? 'Layla' : 'Jackson', { bg: 0x374151, fontSize: '18px', pulse: false });

    // hero rune pads (same centres as the trigger zones)
    makePad(this, W / 2 - 110, H / 2 + 150, 0xd97706, 'hammer',
      c.hero === 'jackson' ? 'Jackson: STAND HERE' : "Jackson's pad").setDepth(-4);
    makePad(this, W / 2 + 110, H / 2 + 150, 0xec4899, 'heart',
      c.hero === 'layla' ? 'Layla: STAND HERE' : "Layla's pad").setDepth(-4);

    this.setHint(c.hero === 'jackson' ? 'Stand on YOUR brown pad, together with Layla!' : 'Stand on YOUR pink pad, together with Jackson!');
    audio.say('portal-need', 'The candy portal needs both heroes! Stand together!', { urgent: true, for: c.hero });

    c.transport.onState((patch) => {
      const s = getCtx().shared;
      if (c.hero === 'jackson' && patch.laylaPos) this.buddyPos = patch.laylaPos;
      if (c.hero === 'layla' && patch.jacksonPos) this.buddyPos = patch.jacksonPos;
      if (s.doorStates['portal-candy']) this.enterCandy();
    });
    c.transport.onEvent((ev) => {
      if (getCtx().seenEvents.has(ev.eventId)) return;
      getCtx().seenEvents.add(ev.eventId);
      if (ev.eventType === 'portal-hold' || ev.kind === 'portal-hold') {
        if (ev.hero === 'jackson' || ev.from === 'jackson') this.jacksonHold = Date.now();
        if (ev.hero === 'layla' || ev.from === 'layla') this.laylaHold = Date.now();
      }
      if (ev.eventType === 'portal-open' || ev.kind === 'portal-open') {
        getCtx().shared.doorStates['portal-candy'] = true;
        this.enterCandy();
      }
    });
    c.transport.onSnapshot(() => {
      if (getCtx().shared.doorStates['portal-candy']) this.enterCandy();
    });

    // already open (resync into base after portal opened)? skip ahead.
    if (c.shared.doorStates['portal-candy']) {
      this.enterCandy();
      return;
    }

    dustMotes(this, W / 2, H / 2, W - 160, H - 160, 0x9fd8ff);
    makeVignette(this);

    createTouchUI(this, c.hero, (p) => { this.pad = { ...p }; }).setContextAvailable(false);
    // (action button stays live here: harmless; context dims until Candy Kingdom)
  }

  private setHint(t: string): void {
    document.querySelector('.hint-bar')!.textContent = t;
  }

  private enterCandy(): void {
    if (this.opened) return;
    this.opened = true;
    const c = getCtx();
    c.patch({ currentWorld: 'candy-kingdom', currentMission: 'grey-kingdom', currentStage: 0, stageId: 0, sharedObjective: 'Save the Grey Kingdom!' });
    audio.say('portal-go', 'Candy Kingdom! Here we go!', { urgent: true });
    this.cameras.main.flash(500, 240, 171, 252);
    this.time.delayedCall(600, () => this.scene.start('candy'));
  }

  override update(_t: number, dt: number): void {
    if (this.opened) return;
    const c = getCtx();
    const dtS = dt / 1000;
    const speed = 260;
    const W = this.scale.width, H = this.scale.height;
    this.hero.x = Phaser.Math.Clamp(this.hero.x + this.pad.mx * speed * dtS, 40, W - 40);
    this.hero.y = Phaser.Math.Clamp(this.hero.y + this.pad.my * speed * dtS, 140, H - 100);
    heroFace(this.hero, this.pad.mx);
    heroFace(this.hero, this.pad.mx);
    this.buddy.x += (this.buddyPos.x - this.buddy.x) * 0.15;
    this.buddy.y += (this.buddyPos.y - this.buddy.y) * 0.15;
    this.heroTag.setPosition(this.hero.x, this.hero.y - 218);
    this.buddyTag.setPosition(this.buddy.x, this.buddy.y - 218);
    c.patch(c.hero === 'jackson' ? { jacksonPos: { x: this.hero.x, y: this.hero.y } } : { laylaPos: { x: this.hero.x, y: this.hero.y } });

    const padJ = { x: W / 2 - 110, y: H / 2 + 150 };
    const padL = { x: W / 2 + 110, y: H / 2 + 150 };
    const meOnMine = c.hero === 'jackson'
      ? Phaser.Math.Distance.Between(this.hero.x, this.hero.y, padJ.x, padJ.y) < 70
      : Phaser.Math.Distance.Between(this.hero.x, this.hero.y, padL.x, padL.y) < 70;
    const buddyOnTheirs = c.hero === 'jackson'
      ? Phaser.Math.Distance.Between(this.buddy.x, this.buddy.y, padL.x, padL.y) < 90
      : Phaser.Math.Distance.Between(this.buddy.x, this.buddy.y, padJ.x, padJ.y) < 90;

    if (meOnMine) {
      c.transport.broadcastEvent({ kind: 'portal-hold' });
      if (c.hero === 'jackson') this.jacksonHold = Date.now(); else this.laylaHold = Date.now();
    }
    // generous 6s sync window (Dual Buttons)
    const together = Date.now() - this.jacksonHold < 6000 && Date.now() - this.laylaHold < 6000 && (meOnMine || buddyOnTheirs);
    if (together) {
      this.setHint('TOGETHER! Opening…');
      c.emit('portal-open', {});
      this.enterCandy();
    }
  }
}
