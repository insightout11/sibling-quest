// Treehouse home base (§9): a magical shared treehouse interior.
// Logic unchanged: spawn spots, door trigger, alarm, presence sync.
import Phaser from 'phaser';
import { getCtx } from './context';
import {
  makeHero, makeUnicorn, makeTrunkWall, makeRoundWindow, makeLamp,
  makeShelf, makePetCorner, makeToolCorner, makeVanityCorner,
  makeRopeBridge, makeBunting, makeTrapdoor, makeStringLights,
  makeLeafPlant, makeBookshelf, heroIdle, heroFace, sticker
} from './art';
import { makePrompt } from './fx';
import { dustMotes, addGlow, addShadow } from './fx';
import { makeVignette } from './art';
import { createTouchUI, type PadState } from './ui';
import { sharedStarsTotal } from '../core/roomState';
import { audio } from '../core/audioQueue';

export class TreehouseScene extends Phaser.Scene {
  private pad: PadState = { mx: 0, my: 0, action: false, build: false, magic: false };
  private hero!: Phaser.GameObjects.Container;
  private buddy!: Phaser.GameObjects.Container;
  private buddyTag!: Phaser.GameObjects.Container;
  private heroShadow!: Phaser.GameObjects.Image;
  private buddyShadow!: Phaser.GameObjects.Image;
  private heroTag!: Phaser.GameObjects.Container;
  private petsText!: Phaser.GameObjects.Text;
  private elapsed = 0;
  private alarmRang = false;

  constructor() { super('treehouse'); }

  create(): void {
    const c = getCtx();
    audio.setState('treehouse');
    const W = this.scale.width, H = this.scale.height;

    // ---- backdrop: warm hollow + trunk walls ----
    this.cameras.main.setBackgroundColor('#241610');
    this.add.rectangle(W / 2, H / 2, W, H, 0x2e1e12).setDepth(-11);
    makeTrunkWall(this, 48, H / 2, 110, H);
    makeTrunkWall(this, W - 48, H / 2, 110, H);
    // leaf canopy peeking over the top
    for (let i = 0; i < 10; i++) {
      const lx = 60 + (i * (W - 120)) / 9;
      this.add.circle(lx, -14, 34 + (i % 3) * 10, i % 2 ? 0x2f7a3d : 0x3e9e4f).setDepth(-9);
    }

    // ---- floor platform ----
    this.add.rectangle(W / 2, H - 62, W - 150, 150, 0x8b5a2b).setDepth(-5);
    for (let i = 0; i < 12; i++) {
      this.add.rectangle(110 + (i * (W - 220)) / 11, H - 62, 5, 150, 0x6b4226).setDepth(-5);
    }
    this.add.rectangle(W / 2, H + 6, W - 150, 26, 0x4a2f18).setDepth(-4);
    // centre rug with crown-star emblem
    this.add.ellipse(W / 2, H - 70, 300, 84, 0xc94f6d).setDepth(-4).setStrokeStyle(4, 0xffffff, 0.9);
    this.add.ellipse(W / 2, H - 70, 210, 54, 0xf9a8d4).setDepth(-4);
    this.add.star(W / 2, H - 70, 5, 10, 24, 0xfacc15).setDepth(-3).setStrokeStyle(3, 0xffffff);

    // ---- rope bridge + bunting + festoon lights across the top ----
    makeRopeBridge(this, W / 2, 66, W - 260).setDepth(-4);
    makeBunting(this, W / 2, 150, W - 420).setDepth(-3);
    makeStringLights(this, 110, 128, W / 2 - 190, 186).setDepth(-3);
    makeStringLights(this, W / 2 + 190, 186, W - 110, 128).setDepth(-3);

    // ---- big round window: the focal point ----
    makeRoundWindow(this, W / 2, 228, 78, true).setDepth(-3);

    // ---- hanging sign with live stats ----
    const signY = 368;
    this.add.rectangle(W / 2 - 130, 292, 8, 60, 0x4a2f18).setDepth(-3);
    this.add.rectangle(W / 2 + 130, 292, 8, 60, 0x4a2f18).setDepth(-3);
    sticker(this.add.rectangle(W / 2, signY, 330, 128, 0x7c4f2c), 4).setDepth(-2);
    this.add.rectangle(W / 2, signY, 330, 128, 0x8b5a2b, 0).setStrokeStyle(2, 0xa06a35).setDepth(-2);
    this.add.text(W / 2, signY - 42, 'Jackson & Layla’s Treehouse', { fontSize: '23px', color: '#ffe9c4', fontStyle: 'bold' }).setOrigin(0.5).setDepth(-1);
    const petNames = c.save.pets.length ? c.save.pets.join(', ') : null;
    this.petsText = this.add.text(W / 2, signY - 8, petNames ? `Pets: ${petNames}` : 'Pet corner is empty… rescue someone!', { fontSize: '17px', color: '#ffd9a0' }).setOrigin(0.5).setDepth(-1);
    const crowns = c.save.collections.crownPieces.length;
    if (crowns) {
      this.add.text(W / 2, signY + 18, `Crown pieces: ${crowns}`, { fontSize: '17px', color: '#fef08a' }).setOrigin(0.5).setDepth(-1);
    }
    this.add.text(W / 2, signY + 42, `Stars: ${Math.max(sharedStarsTotal(c.shared), c.save.collections.stars)}`, { fontSize: '17px', color: '#fde047' }).setOrigin(0.5).setDepth(-1);

    // ---- lamps, shelves, corners, plants ----
    makeLamp(this, W / 2 - 250, 128).setDepth(-2);
    makeLamp(this, W / 2 + 250, 118, 0.9).setDepth(-2);
    // warm light pools under the lamps
    this.add.ellipse(W / 2 - 250, H - 80, 190, 56, 0xffd97a, 0.14).setDepth(-4);
    this.add.ellipse(W / 2 + 250, H - 80, 190, 56, 0xffd97a, 0.14).setDepth(-4);
    // moonbeam shaft from the window to the floor
    this.add.rectangle(W / 2 + 40, 420, 130, 340, 0xbfe6ff, 0.07).setAngle(12).setDepth(-4);
    makeShelf(this, 215, 315, 250, ['star', 'plush', 'gem', 'cup']).setDepth(-2);
    makeShelf(this, W - 215, 315, 250, ['cup', 'gem', 'star', 'plush']).setDepth(-2);
    makeBookshelf(this, W - 200, 560, 220).setDepth(-2);
    makeLeafPlant(this, 128, H - 130, 1.1).setDepth(-2);
    makeLeafPlant(this, W - 108, 445, 0.9).setDepth(-2);
    // framed crown portrait on the left trunk
    this.add.ellipse(48, 265, 64, 78, 0x8b5a2b).setStrokeStyle(4, 0xfacc15).setDepth(-2);
    this.add.star(48, 258, 5, 8, 17, 0xfacc15).setDepth(-1);
    this.add.circle(48, 282, 8, 0xec4899).setDepth(-1);
    makePetCorner(this, 320, H - 108).setDepth(-3);
    if (c.save.pets.includes('candy-unicorn')) {
      const u = makeUnicorn(this, false);
      u.setPosition(320, H - 148);
    }
    makeVanityCorner(this, 205, 520).setDepth(-2);
    makeToolCorner(this, W - 285, H - 96).setDepth(-2);

    // ---- secret trapdoor entrance (same trigger zone as before) ----
    makeTrapdoor(this, W / 2, H - 190, 150, 170).setDepth(-2);
    const doorHit = this.add.rectangle(W / 2, H - 190, 150, 170, 0xffffff, 0).setInteractive({ useHandCursor: true });
    doorHit.on('pointerdown', () => this.scene.start('underground'));

    // ---- heroes, big and expressive ----
    this.hero = makeHero(this, c.hero);
    this.hero.setPosition(W / 2 - 120, H - 130);
    this.hero.setScale(1.28).setData('scl', 1.28);
    this.buddy = makeHero(this, c.hero === 'jackson' ? 'layla' : 'jackson');
    this.buddy.setPosition(W / 2 + 120, H - 130).setAlpha(0.6);
    this.buddy.setScale(1.28).setData('scl', 1.28);
    heroIdle(this, this.hero);
    // grounding contact shadows (repositioned each frame below)
    this.heroShadow = addShadow(this, this.hero.x, this.hero.y - 2, 130);
    this.buddyShadow = addShadow(this, this.buddy.x, this.buddy.y - 2, 130);
    // name pills that follow each hero
    this.heroTag = makePrompt(this, this.hero.x, this.hero.y - 215,
      c.hero === 'jackson' ? 'Jackson • YOU' : 'Layla • YOU',
      { bg: c.hero === 'jackson' ? 0xb45309 : 0xbe185d, fontSize: '19px', pulse: false });
    this.buddyTag = makePrompt(this, this.buddy.x, this.buddy.y - 215,
      c.hero === 'jackson' ? 'Layla' : 'Jackson',
      { bg: 0x374151, fontSize: '18px', pulse: false });

    this.setHint(c.hero === 'jackson' ? 'Walk around! Go to the glowing BASE door!' : 'Walk to the glowy door! Follow the sparkles!');
    // sparkle trail for Layla (no reading needed)
    if (c.hero === 'layla') {
      for (let i = 0; i < 4; i++) {
        const s = this.add.star(W / 2 - 120 + i * 60, H - 220 - (i % 2) * 20, 5, 5, 11, 0xf0abfc);
        this.tweens.add({ targets: s, alpha: 0.2, duration: 600 + i * 120, yoyo: true, repeat: -1 });
      }
    }
    audio.say('tree-hello', c.hero === 'jackson'
      ? 'Welcome home, Jackson! Explore, then head down to the secret base!'
      : 'Welcome home, Layla! Sparkles! Go to the glowy door!',
      { urgent: true, for: c.hero });

    // home base: movement only — powers stay dim until the adventure needs them
    // (kept visible so kids learn where the buttons live).
    const touch = createTouchUI(this, c.hero, (p) => { this.pad = { ...p }; });
    touch.setActionAvailable(false);
    touch.setContextAvailable(false);

    dustMotes(this, W / 2, H / 2, W - 200, H - 200);
    // warm light overlays: lamps, moon window, trapdoor leak
    addGlow(this, W / 2 - 250, 150, { scale: 3.2, color: 0xffd97a, alpha: 0.5, depth: 6 });
    addGlow(this, W / 2 + 250, 140, { scale: 2.8, color: 0xffd97a, alpha: 0.5, depth: 6 });
    addGlow(this, W / 2, 228, { scale: 4.5, color: 0xbfe6ff, alpha: 0.35, depth: 5 });
    addGlow(this, W / 2, H - 180, { scale: 4, color: 0xffb84d, alpha: 0.4, depth: 6 });
    makeVignette(this);

    c.transport.onState((patch) => {
      if (c.hero === 'jackson' && patch.laylaPos) this.buddy.setPosition(patch.laylaPos.x, patch.laylaPos.y);
      if (c.hero === 'layla' && patch.jacksonPos) this.buddy.setPosition(patch.jacksonPos.x, patch.jacksonPos.y);
    });
    c.transport.onSnapshot(() => {
      const names = getCtx().save.pets;
      if (names.length && this.petsText) this.petsText.setText(`Pets: ${names.join(', ')}`);
    });
  }

  private setHint(t: string): void {
    let el = document.querySelector('.hint-bar');
    if (!el) {
      el = document.createElement('div');
      el.className = 'hint-bar';
      document.getElementById('app')?.appendChild(el);
    }
    el.textContent = t;
  }

  override update(_t: number, dt: number): void {
    const c = getCtx();
    const dtS = dt / 1000;
    this.elapsed += dtS;
    const speed = 260;
    this.hero.x = Phaser.Math.Clamp(this.hero.x + this.pad.mx * speed * dtS, 40, this.scale.width - 40);
    this.hero.y = Phaser.Math.Clamp(this.hero.y + this.pad.my * speed * dtS, 200, this.scale.height - 120);
    heroFace(this.hero, this.pad.mx);
    this.buddyTag.setPosition(this.buddy.x, this.buddy.y - 215);
    this.heroTag.setPosition(this.hero.x, this.hero.y - 215);
    this.heroShadow.setPosition(this.hero.x, this.hero.y - 2);
    this.buddyShadow.setPosition(this.buddy.x, this.buddy.y - 2);
    c.patch(c.hero === 'jackson' ? { jacksonPos: { x: this.hero.x, y: this.hero.y } } : { laylaPos: { x: this.hero.x, y: this.hero.y } });

    if (!this.alarmRang && this.elapsed > 35) {
      this.alarmRang = true;
      audio.say('tree-alarm', 'Uh oh! The secret base is buzzing! Go downstairs!', { urgent: true });
      audio.blip(220, 300);
      this.setHint('Alarm! Go through the glowing door!');
      this.cameras.main.flash(400, 168, 85, 247);
    }
  }
}
