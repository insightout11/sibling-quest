// Touch controls (§playtest-6/7): drawn game icons, no emoji.
// Jackson gets icon + 1-word label; Layla gets bigger icons, no reading.
// Buttons dim when their interaction is unavailable and pulse when the game
// wants THAT hero to act — the UI itself teaches the roles.

import Phaser from 'phaser';
import type { HeroId } from '../core/save';

export interface PadState {
  mx: number; my: number; // -1..1 movement
  action: boolean; // primary (attack / wand)
  build: boolean; // jackson contextual
  magic: boolean; // layla contextual
}

export interface TouchHandle {
  setActionAvailable: (b: boolean) => void;
  setContextAvailable: (b: boolean) => void;
  pulseAction: () => void;
  pulseContext: () => void;
  onUnavailableTap: (cb: (which: 'action' | 'context') => void) => void;
}

function starPoints(cx: number, cy: number, rO: number, rI: number, n = 5): Phaser.Types.Math.Vector2Like[] {
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rO : rI;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

function ensureIcons(scene: Phaser.Scene): void {
  if (scene.textures.exists('icon-hit')) return;
  const g = scene.add.graphics();
  // sword (Jackson HIT)
  g.clear();
  g.fillStyle(0xe5e7eb, 1); g.fillRoundedRect(28, 6, 10, 34);
  g.fillTriangle(28, 6, 38, 6, 33, 0);
  g.fillStyle(0xfacc15, 1); g.fillRoundedRect(22, 40, 22, 6, 2);
  g.fillStyle(0x92400e, 1); g.fillRoundedRect(30, 46, 6, 14, 2);
  g.generateTexture('icon-hit', 64, 64);
  // hammer (Jackson BUILD)
  g.clear();
  g.fillStyle(0x8b5a2b, 1); g.fillRoundedRect(28, 18, 8, 40, 3);
  g.fillStyle(0x9ca3af, 1); g.fillRoundedRect(14, 6, 36, 16, 4);
  g.fillStyle(0xfbbf24, 1); g.fillRoundedRect(14, 6, 36, 5, 2);
  g.generateTexture('icon-build', 64, 64);
  // wand (Layla action)
  g.clear();
  g.fillStyle(0xa855f7, 1); g.fillRoundedRect(14, 30, 26, 7, 3);
  g.fillStyle(0xfef08a, 1); g.fillPoints(starPoints(46, 24, 14, 6), true);
  g.fillStyle(0xf0abfc, 1);
  g.fillCircle(12, 16, 3); g.fillCircle(54, 44, 3); g.fillCircle(20, 52, 2);
  g.generateTexture('icon-wand', 64, 64);
  // swirl (Layla magic context)
  g.clear();
  g.lineStyle(5, 0xef4444, 1); g.strokeCircle(32, 32, 22);
  g.lineStyle(5, 0xfacc15, 1); g.strokeCircle(32, 32, 15);
  g.lineStyle(5, 0x3b82f6, 1); g.strokeCircle(32, 32, 8);
  g.fillStyle(0xffffff, 1); g.fillCircle(32, 32, 3);
  g.generateTexture('icon-swirl', 64, 64);
  g.destroy();
}

export function createTouchUI(
  scene: Phaser.Scene,
  hero: HeroId,
  onChange: (p: PadState) => void
): TouchHandle {
  ensureIcons(scene);
  const pad: PadState = { mx: 0, my: 0, action: false, build: false, magic: false };
  const W = scene.scale.width, H = scene.scale.height;
  const isJ = hero === 'jackson';

  // joystick base + knob
  const base = scene.add.circle(110, H - 110, 62, 0x000000, 0.35).setScrollFactor(0).setDepth(100);
  const knob = scene.add.circle(110, H - 110, 28, 0xffffff, 0.75).setScrollFactor(0).setDepth(101);
  let joyId: number | null = null;

  const mkButton = (
    x: number, y: number, r: number, color: number,
    icon: string, label: string | null
  ): { root: Phaser.GameObjects.Container; btn: Phaser.GameObjects.Arc } => {
    const btn = scene.add.circle(0, 0, r, color, 0.95).setStrokeStyle(5, 0xffffff);
    const img = scene.add.image(0, label ? -6 : 0, icon).setDisplaySize(r * 1.05, r * 1.05);
    const parts: Phaser.GameObjects.GameObject[] = [btn, img];
    if (label) {
      parts.push(scene.add.text(0, r - 14, label, { fontSize: '15px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
    }
    const root = scene.add.container(x, y, parts).setScrollFactor(0).setDepth(100);
    btn.setInteractive({ useHandCursor: true });
    return { root, btn };
  };

  const primary = mkButton(W - 110, H - 120, isJ ? 50 : 58, isJ ? 0xb45309 : 0xec4899, isJ ? 'icon-hit' : 'icon-wand', isJ ? 'HIT' : null);
  const context = mkButton(W - 230, H - 80, isJ ? 44 : 52, isJ ? 0x16a34a : 0x8b5cf6, isJ ? 'icon-build' : 'icon-swirl', isJ ? 'BUILD' : null);

  let actionAvail = true;
  let contextAvail = true;
  let unavailableCb: ((which: 'action' | 'context') => void) | null = null;
  const pulseLoops = new Map<Phaser.GameObjects.Container, Phaser.Tweens.Tween>();

  const applyDim = (): void => {
    primary.root.setAlpha(actionAvail ? 1 : 0.35);
    context.root.setAlpha(contextAvail ? 1 : 0.35);
  };

  const stopLoop = (root: Phaser.GameObjects.Container): void => {
    pulseLoops.get(root)?.stop();
    pulseLoops.delete(root);
    root.setScale(1);
  };

  const pulse = (root: Phaser.GameObjects.Container, times = 0): void => {
    stopLoop(root);
    scene.tweens.killTweensOf(root);
    root.setScale(1);
    scene.tweens.add({ targets: root, scale: 1.14, duration: 320, yoyo: true, repeat: times === 0 ? 3 : times });
  };

  const setPulseWhile = (root: Phaser.GameObjects.Container, on: boolean): void => {
    if (on) {
      if (pulseLoops.has(root)) return;
      pulseLoops.set(root, scene.tweens.add({ targets: root, scale: 1.14, duration: 380, yoyo: true, repeat: -1 }));
    } else if (pulseLoops.has(root)) {
      stopLoop(root);
    }
  };

  const fire = (which: 'action' | 'context'): void => {
    if (which === 'action') {
      if (!actionAvail) { unavailableCb?.('action'); return; }
      pad.action = true; onChange(pad);
      setTimeout(() => { pad.action = false; onChange(pad); }, 150);
    } else {
      if (!contextAvail) { unavailableCb?.('context'); return; }
      if (isJ) { pad.build = true; onChange(pad); setTimeout(() => { pad.build = false; onChange(pad); }, 150); }
      else { pad.magic = true; onChange(pad); setTimeout(() => { pad.magic = false; onChange(pad); }, 150); }
    }
  };

  primary.btn.on('pointerdown', () => fire('action'));
  context.btn.on('pointerdown', () => fire('context'));

  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    if (p.x < W * 0.4 && p.y > H * 0.45 && joyId === null) { joyId = p.id; moveKnob(p); }
  });
  const moveKnob = (p: { x: number; y: number }) => {
    const dx = p.x - 110, dy = p.y - (H - 110);
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, 62);
    knob.x = 110 + (dx / len) * cl;
    knob.y = (H - 110) + (dy / len) * cl;
    pad.mx = dx / 62; pad.my = dy / 62;
    const m = Math.hypot(pad.mx, pad.my);
    if (m > 1) { pad.mx /= m; pad.my /= m; }
    onChange(pad);
  };
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (p.id === joyId && p.isDown) moveKnob(p);
  });
  const endJoy = (p: Phaser.Input.Pointer) => {
    if (p.id === joyId) {
      joyId = null;
      knob.x = 110; knob.y = H - 110;
      pad.mx = 0; pad.my = 0;
      onChange(pad);
    }
  };
  scene.input.on('pointerup', endJoy);
  scene.input.on('pointerupoutside', endJoy);

  // keyboard fallback (dev + desktop test)
  const keys = scene.input.keyboard?.addKeys('W,A,S,D,SPACE,E') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
  scene.events.on('update', () => {
    if (!keys) return;
    let kx = 0, ky = 0;
    if (keys.A.isDown) kx -= 1;
    if (keys.D.isDown) kx += 1;
    if (keys.W.isDown) ky -= 1;
    if (keys.S.isDown) ky += 1;
    if (kx || ky) { pad.mx = kx; pad.my = ky; onChange(pad); }
    if (Phaser.Input.Keyboard.JustDown(keys.SPACE)) fire('action');
    if (Phaser.Input.Keyboard.JustDown(keys.E)) fire('context');
  });

  void base;
  return {
    setActionAvailable: (b) => { actionAvail = b; applyDim(); },
    setContextAvailable: (b) => { contextAvail = b; applyDim(); setPulseWhile(context.root, b); },
    pulseAction: () => pulse(primary.root),
    pulseContext: () => pulse(context.root),
    onUnavailableTap: (cb) => { unavailableCb = cb; }
  };
}
