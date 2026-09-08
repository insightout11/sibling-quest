// Secret underground base (§9) + portal room (§10).
// Both heroes stand on their pads (Dual Buttons, generous window).
// Reconstructs from canonical snapshot: an open portal stays open after resync.
import Phaser from 'phaser';
import { getCtx } from './context';
import { makeHero } from './art';
import { createTouchUI, type PadState } from './ui';
import { audio } from '../core/audioQueue';

export class UndergroundScene extends Phaser.Scene {
  private pad: PadState = { mx: 0, my: 0, action: false, build: false, magic: false };
  private hero!: Phaser.GameObjects.Container;
  private buddy!: Phaser.GameObjects.Container;
  private buddyPos = { x: 0, y: 0 };
  private jacksonHold = 0;
  private laylaHold = 0;
  private opened = false;

  constructor() { super('underground'); }

  create(): void {
    const c = getCtx();
    audio.setState('underground');
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor('#0b1226');
    // riveted metal floor + pipes
    this.add.rectangle(W / 2, H / 2, W, H, 0x111c36);
    for (let i = 0; i < 5; i++) this.add.rectangle(W / 2, 60 + i * 110, W, 6, 0x1e2a4a);
    this.add.rectangle(W / 2, 34, W, 26, 0x24335c);
    for (let i = 0; i < 8; i++) this.add.circle(60 + i * 130, 34, 8, 0x38bdf8, 0.8);
    // mysterious doors: candy open, second flickers as a teaser AFTER the demo (§playtest-12)
    const demoDone = getCtx().save.completedMissions.includes('grey-kingdom');
    for (let i = 0; i < 3; i++) {
      this.add.rectangle(90 + i * 110, 130, 88, 120, 0x1e293b).setStrokeStyle(4, 0x475569);
      if (i === 0) {
        const candy = this.add.circle(90, 130, 22, 0xf472b6);
        this.tweens.add({ targets: candy, scale: 1.15, duration: 800, yoyo: true, repeat: -1 });
      } else if (i === 1 && demoDone) {
        const tease = this.add.circle(200, 130, 22, 0x22c55e);
        this.tweens.add({ targets: tease, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
        this.add.text(200, 200, 'coming soon…', { fontSize: '14px', color: '#a7f3d0' }).setOrigin(0.5);
      } else {
        this.add.rectangle(90 + i * 110, 130, 22, 28, 0xfacc15).setStrokeStyle(3, 0x92400e);
      }
    }
    if (demoDone) {
      audio.say('tease', 'Ooh… a new adventure is coming…', { hostOnly: true });
    }
    this.add.text(W - 280, 66, 'PORTAL ROOM', { fontSize: '26px', color: '#c4b5fd', fontStyle: 'bold' });
    // candy portal: swirling rings
    const px = W / 2, py = H / 2 + 10;
    this.add.circle(px, py, 104, 0x2e1065);
    const ring1 = this.add.circle(px, py, 90, 0x7c3aed, 0).setStrokeStyle(10, 0x7c3aed);
    const ring2 = this.add.circle(px, py, 68, 0xa855f7, 0.35).setStrokeStyle(8, 0xf0abfc);
    const core = this.add.circle(px, py, 46, 0xf5d0fe);
    this.add.star(px, py, 5, 12, 26, 0xec4899);
    this.tweens.add({ targets: ring1, angle: 360, duration: 6000, repeat: -1 });
    this.tweens.add({ targets: [ring2, core], scale: 1.1, duration: 700, yoyo: true, repeat: -1 });

    this.hero = makeHero(this, c.hero);
    this.hero.setPosition(W / 2 - 160, H - 120);
    this.buddy = makeHero(this, c.hero === 'jackson' ? 'layla' : 'jackson');
    this.buddyPos = { x: W / 2 + 160, y: H - 120 };
    this.buddy.setPosition(this.buddyPos.x, this.buddyPos.y).setAlpha(0.55);

    // two floor pads — brown hammer sigil / pink crown sigil (drawn, not emoji)
    this.drawPad(W / 2 - 110, H / 2 + 150, 0xb45309, 'hammer');
    this.drawPad(W / 2 + 110, H / 2 + 150, 0xec4899, 'crown');

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

    createTouchUI(this, c.hero, (p) => { this.pad = { ...p }; }).setContextAvailable(false);
    // (action button stays live here: harmless; context dims until Candy Kingdom)
  }

  private drawPad(x: number, y: number, color: number, sigil: 'hammer' | 'crown'): void {
    this.add.circle(x, y, 46, color, 0.45).setStrokeStyle(5, 0xffffff);
    if (sigil === 'hammer') {
      this.add.rectangle(x - 4, y, 8, 34, 0xfff7ed).setAngle(30);
      this.add.rectangle(x + 8, y - 12, 26, 10, 0xfff7ed);
    } else {
      this.add.polygon(x, y + 4, [-14, 8, -14, -6, -7, 0, 0, -10, 7, 0, 14, -6, 14, 8], 0xfff7ed);
    }
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
    this.buddy.x += (this.buddyPos.x - this.buddy.x) * 0.15;
    this.buddy.y += (this.buddyPos.y - this.buddy.y) * 0.15;
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
