// Treehouse home base (§9): relax, see pets/trophies, then alarm -> underground.
// Heroes + pets are drawn vector art (art.ts). Presence + snapshot aware.
import Phaser from 'phaser';
import { getCtx } from './context';
import { makeHero, makeUnicorn } from './art';
import { createTouchUI, type PadState } from './ui';
import { sharedStarsTotal } from '../core/roomState';
import { audio } from '../core/audioQueue';

export class TreehouseScene extends Phaser.Scene {
  private pad: PadState = { mx: 0, my: 0, action: false, build: false, magic: false };
  private hero!: Phaser.GameObjects.Container;
  private buddy!: Phaser.GameObjects.Container;
  private buddyTag!: Phaser.GameObjects.Container;
  private petsText!: Phaser.GameObjects.Text;
  private elapsed = 0;
  private alarmRang = false;

  constructor() { super('treehouse'); }

  create(): void {
    const c = getCtx();
    audio.setState('treehouse');
    const W = this.scale.width, H = this.scale.height;

    // cosy treehouse interior: timber walls, plank floor, round window, pet corner
    this.cameras.main.setBackgroundColor('#2d1f16');
    this.add.rectangle(W / 2, 80, W, 160, 0x5b3a1e);
    for (let i = 0; i < 6; i++) this.add.rectangle(W / 2, 20 + i * 26, W, 3, 0x3f2a14);
    this.add.rectangle(W / 2, H - 60, W, 160, 0x8b5a2b);
    for (let i = 0; i < 9; i++) this.add.rectangle(40 + i * ((W - 80) / 8), H - 60, 4, 160, 0x6b4226);
    // round window with night sky + stars
    this.add.circle(W - 150, 110, 58, 0x0f172a).setStrokeStyle(10, 0x6b4226);
    this.add.circle(W - 170, 95, 4, 0xffffff);
    this.add.circle(W - 130, 120, 3, 0xffffff);
    this.add.circle(W - 145, 135, 2, 0xfef08a);
    this.add.circle(W - 165, 125, 14, 0xfef08a, 0.9); // moon
    // trophy shelf
    this.add.rectangle(170, 120, 220, 12, 0x6b4226);
    const crowns = c.save.collections.crownPieces.length;
    for (let i = 0; i < Math.min(3, crowns); i++) {
      this.add.triangle(110 + i * 60, 96, 0, 0, -14, 0, 14, 0, 0xfacc15).setStrokeStyle(2, 0xffffff);
    }
    this.add.text(60, 30, 'Treehouse', { fontSize: '30px', color: '#ffe9c4', fontStyle: 'bold' });
    const petNames = c.save.pets.length ? c.save.pets.join(', ') : null;
    this.petsText = this.add.text(60, 64, petNames ? `Pets: ${petNames}` : 'Pet corner is empty… rescue someone!', { fontSize: '18px', color: '#ffd9a0' });
    if (c.save.pets.includes('candy-unicorn')) {
      const u = makeUnicorn(this, false);
      u.setPosition(220, H - 130).setScale(0.9);
    }
    if (crowns) {
      this.add.text(60, 90, `Crown pieces: ${crowns}`, { fontSize: '18px', color: '#fef08a' });
    }
    this.add.text(60, 114, `Stars: ${Math.max(sharedStarsTotal(c.shared), c.save.collections.stars)}`, { fontSize: '18px', color: '#fde047' });
    // stairwell door to the secret base
    const door = this.add.rectangle(W / 2, H - 190, 150, 170, 0x4c1d95).setStrokeStyle(6, 0xa855f7).setInteractive({ useHandCursor: true });
    this.add.circle(W / 2, H - 230, 26, 0x7c3aed).setStrokeStyle(4, 0xf0abfc);
    this.add.star(W / 2, H - 230, 5, 8, 17, 0xf0abfc);
    this.add.text(W / 2, H - 150, 'BASE', { fontSize: '26px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    door.on('pointerdown', () => this.scene.start('underground'));

    this.hero = makeHero(this, c.hero);
    this.hero.setPosition(W / 2 - 120, H - 130);
    this.buddy = makeHero(this, c.hero === 'jackson' ? 'layla' : 'jackson');
    this.buddy.setPosition(W / 2 + 120, H - 130).setAlpha(0.55);
    // name tags so kids instantly know who is theirs (§15)
    const me = c.hero === 'jackson' ? 'Jackson — YOU' : 'Layla — YOU';
    this.add.text(this.hero.x, this.hero.y - 130, me, { fontSize: '18px', color: '#fef08a', fontStyle: 'bold' }).setOrigin(0.5);
    this.buddyTag = this.add.container(this.buddy.x, this.buddy.y, [
      this.add.text(0, -132, c.hero === 'jackson' ? 'LAYLA' : 'JACKSON', { fontSize: '15px', color: '#fff', backgroundColor: '#0008', padding: { x: 6, y: 2 } }).setOrigin(0.5)
    ]);

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
    this.buddyTag.setPosition(this.buddy.x, this.buddy.y);
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
