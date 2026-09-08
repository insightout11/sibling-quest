// Procedural toy-box art: chunky sticker-style shapes, big readable heroes,
// paintable (grey <-> colour) landmarks, treehouse + underground set pieces.
// Conventions: builders return Containers with feet/ground at y=0 unless noted.
// Paintable landmarks return { root, paint(grey) }.

import Phaser from 'phaser';

export const OUTLINE = 0xffffff;

export function sticker<T extends Phaser.GameObjects.Shape>(s: T, w = 4): T {
  s.setStrokeStyle(w, OUTLINE, 1);
  return s;
}

/** Grey <-> colour swap helper for landmark parts. */
interface Swatch { o: Phaser.GameObjects.Shape; grey: number; color: number }
function paintSwatches(parts: Swatch[], grey: boolean): void {
  for (const p of parts) p.o.setFillStyle(grey ? p.grey : p.color);
}

// ============================ JACKSON ============================
// Blocky builder/adventurer hero, ~150px tall. Right arm is a pivoted
// sub-container (root.getData('armR')) so heroSwing() can rotate it.

export function makeJackson(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const OL = 0x4a2f18; // warm dark outline (reference look, not sticker-white)
  const out = <T extends Phaser.GameObjects.Shape>(s: T, w = 4): T => { s.setStrokeStyle(w, OL, 1); return s; };
  const parts: Phaser.GameObjects.GameObject[] = [];
  // chunky boots with toe caps + straps
  for (const sx of [-1, 1]) {
    parts.push(out(scene.add.rectangle(sx * 20, -13, 30, 26, 0x6b4226)));
    parts.push(scene.add.rectangle(sx * 20 + 6, -8, 18, 12, 0x8b5a2b));
    parts.push(scene.add.rectangle(sx * 20, -16, 30, 6, 0xfbbf24));
  }
  // khaki work pants with side pocket
  parts.push(out(scene.add.rectangle(-17, -38, 26, 28, 0xd9a441), 3));
  parts.push(out(scene.add.rectangle(17, -38, 26, 28, 0xd9a441), 3));
  parts.push(scene.add.rectangle(30, -36, 14, 12, 0xb57e1e));
  // belt + brass buckle
  parts.push(scene.add.rectangle(0, -54, 70, 12, 0x5b3a1e));
  parts.push(out(scene.add.rectangle(0, -54, 18, 15, 0xfacc15), 2));
  // orange shirt torso with shade side + collar
  parts.push(out(scene.add.rectangle(0, -80, 70, 46, 0xf97316)));
  parts.push(scene.add.rectangle(24, -80, 12, 46, 0xea580c));
  parts.push(scene.add.triangle(-16, -102, 0, 0, -13, 13, 13, 13, 0xc2410c));
  parts.push(scene.add.triangle(16, -102, 0, 0, -13, 13, 13, 13, 0xc2410c));
  parts.push(out(scene.add.circle(0, -72, 8, 0xfbbf24), 2));
  // blue backpack + straps + bedroll (his signature look)
  parts.push(out(scene.add.rectangle(-48, -82, 24, 42, 0x2563eb)));
  parts.push(scene.add.rectangle(-48, -82, 24, 10, 0x1d4ed8));
  parts.push(out(scene.add.circle(-48, -108, 11, 0x16a34a), 3));
  parts.push(scene.add.rectangle(-30, -80, 8, 40, 0x1e40af));
  parts.push(scene.add.rectangle(30, -80, 8, 40, 0x1e40af));
  // left arm resting near hip
  const armL = scene.add.container(-44, -92, [
    out(scene.add.rectangle(0, 12, 18, 36, 0xf97316), 3),
    out(scene.add.circle(-2, 34, 11, 0xfcd9a8), 3)
  ]);
  armL.setAngle(14);
  parts.push(armL);
  // right arm rig, hammer raised high
  const armR = scene.add.container(46, -94, [
    out(scene.add.rectangle(0, 6, 18, 34, 0xf97316), 3),
    out(scene.add.circle(4, 28, 12, 0xfcd9a8), 3),
    scene.add.rectangle(22, -12, 10, 62, 0x8b5a2b).setAngle(-24),
    out(scene.add.rectangle(40, -38, 46, 24, 0x9ca3af), 3),
    scene.add.rectangle(40, -44, 46, 8, 0xe5e7eb),
    scene.add.rectangle(40, -38, 46, 5, 0xfacc15)
  ]);
  parts.push(armR);
  // big head with ears
  parts.push(out(scene.add.rectangle(0, -126, 58, 44, 0xfcd9a8)));
  parts.push(out(scene.add.circle(-30, -126, 7, 0xfcd9a8), 2));
  parts.push(out(scene.add.circle(30, -126, 7, 0xfcd9a8), 2));
  // messy brown hair tufts + sideburns
  const hairC = 0x6b3f1d;
  parts.push(out(scene.add.triangle(-20, -152, 0, 0, -18, 22, 18, 22, hairC), 3));
  parts.push(out(scene.add.triangle(2, -156, 0, 0, -19, 24, 19, 24, hairC), 3));
  parts.push(out(scene.add.triangle(24, -150, 0, 0, -16, 20, 16, 20, hairC), 3));
  parts.push(scene.add.rectangle(-32, -132, 10, 22, hairC));
  parts.push(scene.add.rectangle(32, -132, 10, 22, hairC));
  // big glossy eyes with glints + brows (whites/irises registered for blinking)
  const pupils: Phaser.GameObjects.GameObject[] = [];
  for (const sx of [-1, 1]) {
    const white = out(scene.add.ellipse(sx * 14, -128, 17, 21, 0xffffff), 2);
    const iris = scene.add.circle(sx * 14 + 2, -126, 6, 0x274060);
    const core = scene.add.circle(sx * 14 + 2, -126, 2.6, 0x0f172a);
    parts.push(white, iris, core);
    pupils.push(white, iris, core);
    parts.push(scene.add.circle(sx * 14, -131, 2.4, 0xffffff));
    parts.push(scene.add.rectangle(sx * 14, -141, 15, 5, 0x4a2f18).setAngle(sx * -6));
  }
  // open happy smile + blush
  parts.push(out(scene.add.ellipse(0, -110, 22, 14, 0x7c2d12), 2));
  parts.push(scene.add.ellipse(0, -107, 12, 6, 0xf87171));
  parts.push(scene.add.circle(-22, -116, 5, 0xf9a8d4, 0.8));
  parts.push(scene.add.circle(22, -116, 5, 0xf9a8d4, 0.8));
  const root = scene.add.container(0, 0, parts);
  root.setData('armR', armR);
  root.setData('hero', 'jackson');
  root.setData('pupils', pupils);
  return root;
}

// ============================ LAYLA ============================
// Princess-fairy adventurer, ~155px tall. Wand lives in a pivoted right-arm
// rig (root.getData('armR')); star tip at root.getData('wandStar').

export function makeLayla(scene: Phaser.Scene, opts?: { wings?: boolean }): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  // boots with straps + bows
  const bootL = sticker(scene.add.rectangle(-16, -11, 23, 22, 0x9d174d));
  const bootR = sticker(scene.add.rectangle(16, -11, 23, 22, 0x9d174d));
  const bowL = scene.add.circle(-16, -14, 5, 0xf9a8d4).setStrokeStyle(2, OUTLINE);
  const bowR = scene.add.circle(16, -14, 5, 0xf9a8d4).setStrokeStyle(2, OUTLINE);
  // layered adventure skirt
  const skirtBack = sticker(scene.add.triangle(0, -46, 0, 0, 62, 48, -31, 48, 0xc026d3));
  const skirt = sticker(scene.add.triangle(0, -52, 0, 0, 54, 42, -27, 42, 0xec4899));
  const hem1 = scene.add.circle(-16, -14, 6, 0xf9a8d4);
  const hem2 = scene.add.circle(2, -12, 6, 0xf9a8d4);
  const hem3 = scene.add.circle(18, -14, 6, 0xf9a8d4);
  // bodice + sash + gem
  const bodice = sticker(scene.add.rectangle(0, -78, 46, 34, 0xf9a8d4));
  const sash = scene.add.rectangle(0, -70, 48, 10, 0xfacc15);
  const gem = sticker(scene.add.circle(0, -70, 7, 0x38bdf8), 2);
  // puffy sleeves + arms
  const sleeveL = sticker(scene.add.circle(-28, -86, 11, 0xfbcfe8), 3);
  const armL = sticker(scene.add.rectangle(-30, -66, 13, 28, 0xfcd9a8), 3);
  // right arm rig with wand (pivot at shoulder)
  const wandStar = sticker(scene.add.star(26, -34, 5, 8, 16, 0xfef08a), 2);
  const wandGlow = scene.add.circle(26, -34, 22, 0xfef08a, 0.35);
  const armR = scene.add.container(30, -88, [
    sticker(scene.add.rectangle(0, 10, 13, 30, 0xfcd9a8), 3),
    scene.add.rectangle(12, -8, 7, 42, 0xa855f7).setAngle(-16).setStrokeStyle(2, OUTLINE),
    wandGlow, wandStar
  ]);
  // head
  const head = sticker(scene.add.circle(0, -112, 24, 0xfcd9a8));
  // big glossy fairy eyes (whites + irises registered for blinking)
  const pupils: Phaser.GameObjects.GameObject[] = [];
  for (const sx of [-1, 1]) {
    const white = sticker(scene.add.ellipse(sx * 10, -114, 14, 17, 0xffffff), 2);
    const iris = scene.add.circle(sx * 10 + 1, -113, 5, 0x7c3aed);
    const core = scene.add.circle(sx * 10 + 1, -113, 2.2, 0x1f2937);
    const glint = scene.add.circle(sx * 10, -116, 2, 0xffffff);
    parts.push(white, iris, core, glint);
    pupils.push(white, iris, core, glint);
  }
  // lashes
  parts.push(scene.add.rectangle(-17, -122, 9, 3, 0x4a2f18).setAngle(-18));
  parts.push(scene.add.rectangle(17, -122, 9, 3, 0x4a2f18).setAngle(18));
  const cheekL = scene.add.circle(-16, -106, 5, 0xf9a8d4);
  const cheekR = scene.add.circle(16, -106, 5, 0xf9a8d4);
  const smile = scene.add.circle(0, -104, 6, 0x9d174d);
  // hair: back mass + side puffs + fringe
  const hairBack = sticker(scene.add.circle(0, -108, 29, 0x92400e));
  const hairL = sticker(scene.add.circle(-25, -112, 12, 0xa16207), 3);
  const hairR = sticker(scene.add.circle(25, -112, 12, 0xa16207), 3);
  const fringe = scene.add.ellipse(0, -128, 40, 14, 0xa16207);
  const tieL = scene.add.circle(-25, -100, 4, 0xf472b6);
  const tieR = scene.add.circle(25, -100, 4, 0xf472b6);
  // crown with gems
  const crownPts = [
    new Phaser.Geom.Point(-20, -130), new Phaser.Geom.Point(-20, -148),
    new Phaser.Geom.Point(-10, -137), new Phaser.Geom.Point(0, -151),
    new Phaser.Geom.Point(10, -137), new Phaser.Geom.Point(20, -148),
    new Phaser.Geom.Point(20, -130)
  ];
  const crown = sticker(scene.add.polygon(0, 0, crownPts, 0xfacc15));
  const cg1 = scene.add.circle(-10, -137, 4, 0xef4444);
  const cg2 = scene.add.circle(0, -140, 4, 0x38bdf8);
  const cg3 = scene.add.circle(10, -137, 4, 0x22c55e);
  parts.push(hairBack, bootL, bootR, bowL, bowR, skirtBack, skirt, hem1, hem2, hem3,
    bodice, sash, gem, sleeveL, armL, armR, head,
    cheekL, cheekR, smile, hairL, hairR, fringe, tieL, tieR, crown, cg1, cg2, cg3);
  // fairy wings are part of Layla's heroic silhouette (visual only, no flight change)
  {
    const wingL = scene.add.ellipse(-36, -84, 26, 46, 0xc4b5fd, 0.9).setStrokeStyle(3, OUTLINE).setAngle(-18);
    const wingR = scene.add.ellipse(36, -84, 26, 46, 0xc4b5fd, 0.9).setStrokeStyle(3, OUTLINE).setAngle(18);
    const sparkL = scene.add.circle(-40, -100, 4, 0xffffff, 0.9);
    const sparkR = scene.add.circle(40, -100, 4, 0xffffff, 0.9);
    parts.unshift(wingL, wingR, sparkL, sparkR);
    scene.tweens.add({ targets: [wingL, wingR], scaleX: 0.72, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    void opts;
  }
  const root = scene.add.container(0, 0, parts);
  root.setData('armR', armR);
  root.setData('wandStar', wandStar);
  root.setData('hero', 'layla');
  root.setData('pupils', pupils);
  // crown shimmer
  scene.tweens.add({ targets: crown, y: -2, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return root;
}

export function makeHero(scene: Phaser.Scene, hero: 'jackson' | 'layla'): Phaser.GameObjects.Container {
  return hero === 'jackson' ? makeJackson(scene) : makeLayla(scene);
}

/** Gentle idle bob + periodic eye blink (pupils registered via setData). Safe to call once per hero root. */
export function heroIdle(scene: Phaser.Scene, root: Phaser.GameObjects.Container, amp = 6): void {
  scene.tweens.add({ targets: root, y: `-=${amp}`, duration: 850 + Math.random() * 250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const pupils = root.getData('pupils') as Phaser.GameObjects.GameObject[] | undefined;
  if (!pupils || pupils.length === 0) return;
  const blink = (): void => {
    scene.tweens.add({
      targets: pupils, scaleY: 0.12, duration: 70, yoyo: true, hold: 60,
      onComplete: () => scene.time.delayedCall(2000 + Math.random() * 2200, blink)
    });
  };
  scene.time.delayedCall(1200 + Math.random() * 1500, blink);
}

/** Face travel direction (pickaxe/wand side leads). Preserves base scale. */
export function heroFace(root: Phaser.GameObjects.Container, dir: number): void {
  const s = (root.getData('scl') as number | undefined) ?? 1;
  if (dir > 0.2) root.setScale(s, s);
  else if (dir < -0.2) root.setScale(-s, s);
}

/** Jackson-style tool swing: raise then strike. */
export function heroSwing(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  const arm = root.getData('armR') as Phaser.GameObjects.Container | undefined;
  const baseY = root.scaleY || 1;
  if (!arm) { scene.tweens.add({ targets: root, scaleY: baseY * 0.9, duration: 110, yoyo: true }); return; }
  scene.tweens.killTweensOf(arm);
  arm.setAngle(0);
  scene.tweens.add({
    targets: arm, angle: -58, duration: 120, ease: 'Quad.easeOut',
    onComplete: () => scene.tweens.add({ targets: arm, angle: 34, duration: 130, ease: 'Quad.easeIn',
      onComplete: () => scene.tweens.add({ targets: arm, angle: 0, duration: 220 }) })
  });
  scene.tweens.add({ targets: root, scaleY: baseY * 0.9, duration: 110, yoyo: true });
}

/** Layla-style wand flourish + sparkle pop at the wand tip. */
export function heroCast(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  const arm = root.getData('armR') as Phaser.GameObjects.Container | undefined;
  if (arm) {
    scene.tweens.killTweensOf(arm);
    arm.setAngle(0);
    scene.tweens.add({ targets: arm, angle: -30, duration: 150, yoyo: true, ease: 'Sine.easeInOut' });
  }
  const facing = root.scaleX >= 0 ? 1 : -1;
  const tipX = root.x + facing * 62;
  const tipY = root.y - 118;
  const flash = scene.add.circle(tipX, tipY, 10, 0xffffff, 1).setDepth(92);
  scene.tweens.add({ targets: flash, scale: 3.2, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
}

/** Happy hop (rescues, rewards). */
export function heroCheer(scene: Phaser.Scene, root: Phaser.GameObjects.Container): void {
  scene.tweens.add({ targets: root, y: '-=36', duration: 220, yoyo: true, ease: 'Quad.easeOut' });
}

// ============================ GUMMY BEAR ============================

export function makeGummy(scene: Phaser.Scene, grey: boolean): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  const footL = sticker(scene.add.ellipse(-18, -6, 22, 14, grey ? 0x9ca3af : 0xf472b6), 3);
  const footR = sticker(scene.add.ellipse(18, -6, 22, 14, grey ? 0x9ca3af : 0xf472b6), 3);
  const armL = sticker(scene.add.ellipse(-30, -34, 16, 30, grey ? 0x9ca3af : 0xf472b6), 3).setAngle(18);
  const armR = sticker(scene.add.ellipse(30, -34, 16, 30, grey ? 0x9ca3af : 0xf472b6), 3).setAngle(-18);
  const bodyC = grey ? 0x9ca3af : 0xf472b6;
  const dark = grey ? 0x6b7280 : 0xdb2777;
  const light = grey ? 0xd1d5db : 0xfbcfe8;
  parts.push(
    footL, footR, armL, armR,
    sticker(scene.add.circle(-24, -70, 12, bodyC)),
    sticker(scene.add.circle(24, -70, 12, bodyC)),
    sticker(scene.add.circle(-24, -70, 5, light)),
    sticker(scene.add.circle(24, -70, 5, light)),
    sticker(scene.add.ellipse(0, -32, 62, 70, bodyC), 4),
    scene.add.ellipse(0, -20, 36, 38, light),
    sticker(scene.add.circle(0, -68, 27, bodyC)),
    scene.add.ellipse(0, -60, 28, 17, 0xfce7f3, grey ? 0.4 : 1),
    scene.add.circle(-10, -72, 5, 0x1f2937),
    scene.add.circle(10, -72, 5, 0x1f2937),
    scene.add.circle(-8, -73, 2, 0xffffff),
    scene.add.circle(12, -73, 2, 0xffffff),
    scene.add.rectangle(-10, -82, 12, 5, dark).setAngle(18),
    scene.add.rectangle(10, -82, 12, 5, dark).setAngle(-18),
    scene.add.circle(0, -62, 4, dark),
    scene.add.ellipse(-14, -44, 12, 8, 0xffffff, 0.4)
  );
  const root = scene.add.container(0, 0, parts.filter(Boolean));
  scene.tweens.add({ targets: root, scaleX: 1.05, scaleY: 0.95, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return root;
}

// ============================ JELLY ============================

export interface JellyFigure {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Ellipse;
  ring: Phaser.GameObjects.Arc;
  setShielded: (on: boolean, grey: boolean) => void;
}

export function makeJelly(scene: Phaser.Scene, shielded: boolean, grey: boolean): JellyFigure {
  const bodyColor = grey ? 0x9ca3af : 0x4ade80;
  const parts: Phaser.GameObjects.GameObject[] = [];
  const footL = sticker(scene.add.ellipse(-18, -4, 22, 12, bodyColor), 3);
  const footR = sticker(scene.add.ellipse(18, -4, 22, 12, bodyColor), 3);
  const body = sticker(scene.add.ellipse(0, -34, 72, 62, bodyColor), 4);
  const bump1 = sticker(scene.add.circle(-16, -62, 10, bodyColor), 3);
  const bump2 = sticker(scene.add.circle(4, -66, 12, bodyColor), 3);
  const bump3 = sticker(scene.add.circle(22, -60, 9, bodyColor), 3);
  const shine = scene.add.ellipse(-18, -46, 20, 12, 0xffffff, 0.5);
  const eyeL = sticker(scene.add.circle(-13, -38, 7, 0xffffff), 2);
  const eyeR = sticker(scene.add.circle(13, -38, 7, 0xffffff), 2);
  const pupL = scene.add.circle(-13, -36, 3, 0x1f2937);
  const pupR = scene.add.circle(13, -36, 3, 0x1f2937);
  const browL = scene.add.rectangle(-13, -48, 12, 4, 0x14532d).setAngle(14);
  const browR = scene.add.rectangle(13, -48, 12, 4, 0x14532d).setAngle(-14);
  const mouth = scene.add.ellipse(0, -22, 16, 9, 0x1f2937);
  const tooth = scene.add.triangle(4, -24, 0, 0, -5, 0, 5, 0, 0xffffff);
  const ring = scene.add.circle(0, -34, 52, 0xc4b5fd, 0).setStrokeStyle(8, 0xf0abfc, 1);
  const ringGlow = scene.add.circle(0, -34, 62, 0xf0abfc, 0.22);
  parts.push(footL, footR, body, bump1, bump2, bump3, shine, eyeL, eyeR, pupL, pupR, browL, browR, mouth, tooth, ringGlow, ring);
  const root = scene.add.container(0, 0, parts);
  const setShielded = (on: boolean, g: boolean): void => {
    ring.setStrokeStyle(8, on ? 0xf0abfc : 0xffffff, on ? 1 : 0.22);
    ringGlow.setVisible(on);
    body.setFillStyle(g ? 0x9ca3af : on ? 0xc4b5fd : 0x4ade80);
    const feet = [footL, footR, bump1, bump2, bump3];
    for (const f of feet) (f as Phaser.GameObjects.Ellipse).setFillStyle(g ? 0x9ca3af : on ? 0xc4b5fd : 0x4ade80);
  };
  setShielded(shielded, grey);
  scene.tweens.add({ targets: root, scaleY: 0.94, scaleX: 1.05, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return { root, body, ring, setShielded };
}

// ============================ UNICORN ============================

export function makeUnicorn(scene: Phaser.Scene, grey: boolean): Phaser.GameObjects.Container {
  const coat = grey ? 0xd1d5db : 0xffffff;
  const cream = grey ? 0xe5e7eb : 0xfce7f3;
  const mane = grey ? 0x9ca3af : 0xf472b6;
  const mane2 = grey ? 0x9ca3af : 0xa855f7;
  const parts: Phaser.GameObjects.GameObject[] = [
    sticker(scene.add.rectangle(-30, -18, 13, 36, coat), 3),
    sticker(scene.add.rectangle(-10, -18, 13, 36, coat), 3),
    sticker(scene.add.rectangle(10, -18, 13, 36, coat), 3),
    sticker(scene.add.rectangle(30, -18, 13, 36, coat), 3),
    sticker(scene.add.rectangle(-30, -4, 13, 8, 0xfacc15), 2),
    sticker(scene.add.rectangle(30, -4, 13, 8, 0xfacc15), 2),
    sticker(scene.add.ellipse(0, -46, 92, 42, coat), 4),
    scene.add.ellipse(-8, -48, 52, 26, cream),
    sticker(scene.add.rectangle(38, -72, 20, 38, coat), 3).setAngle(-12),
    sticker(scene.add.circle(46, -94, 15, coat)),
    scene.add.ellipse(40, -92, 20, 12, cream),
    sticker(scene.add.triangle(46, -118, 0, 0, -10, 16, 10, 16, 0xfacc15), 2),
    scene.add.circle(50, -96, 3, 0x1f2937),
    scene.add.circle(42, -96, 3, 0x1f2937),
    scene.add.circle(51, -97, 1, 0xffffff),
    scene.add.circle(43, -97, 1, 0xffffff),
    scene.add.circle(52, -88, 3, 0xf9a8d4),
    sticker(scene.add.ellipse(30, -78, 15, 32, mane), 3).setAngle(-14),
    sticker(scene.add.ellipse(22, -58, 13, 26, mane2), 3),
    sticker(scene.add.ellipse(-46, -56, 14, 32, mane), 3).setAngle(28),
    sticker(scene.add.ellipse(-52, -38, 11, 24, mane2), 3).setAngle(28),
    scene.add.star(-14, -52, 5, 4, 9, grey ? 0x9ca3af : 0xfacc15)
  ];
  const root = scene.add.container(0, 0, parts);
  scene.tweens.add({ targets: root, y: '-=5', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return root;
}

// ============================ PROPS ============================

/** Candy crystal: faceted diamond on a rock base. */
export function makeCrystal(scene: Phaser.Scene, grey: boolean): Phaser.GameObjects.Container {
  const c = grey ? 0x9ca3af : 0x22d3ee;
  const gem = sticker(scene.add.polygon(0, -6, [0, -30, 20, -6, 0, 22, -20, -6], c), 4);
  const facet = scene.add.polygon(0, -6, [0, -30, 8, -6, 0, 22, -8, -6], 0xffffff, 0.35);
  const base = scene.add.ellipse(0, 24, 44, 12, 0x78350f);
  return scene.add.container(0, 0, [base, gem, facet]);
}

/** Cluster of three crystals, centre one tall. Repaintable grey <-> colour. */
export function makeCrystalCluster(scene: Phaser.Scene, grey: boolean, s = 1): Landmark {
  const a = makeCrystal(scene, grey); a.setPosition(-34 * s, 6 * s).setScale(0.7 * s);
  const b = makeCrystal(scene, grey); b.setScale(1.15 * s);
  const c = makeCrystal(scene, grey); c.setPosition(36 * s, 8 * s).setScale(0.55 * s);
  const root = scene.add.container(0, 0, [a, b, c]);
  const gems = [a, b, c].map((fig) => fig.list[1] as Phaser.GameObjects.Polygon);
  return {
    root,
    paint(g: boolean): void {
      for (const gem of gems) gem.setFillStyle(g ? 0x9aa1ad : 0x22d3ee);
    }
  };
}

/** Fairy star: gold star with glow + orbiting twinkles. */
export function makeStar(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const glow = scene.add.circle(0, 0, 34, 0xfef08a, 0.4);
  const star = sticker(scene.add.star(0, 0, 5, 15, 30, 0xfacc15), 3);
  const tw1 = scene.add.star(-30, -18, 5, 4, 9, 0xffffff);
  const tw2 = scene.add.star(28, 16, 5, 4, 9, 0xffffff);
  const root = scene.add.container(0, 0, [glow, star, tw1, tw2]);
  scene.tweens.add({ targets: [tw1, tw2], alpha: 0.2, scale: 0.6, duration: 500, yoyo: true, repeat: -1 });
  return root;
}

/** Night Rainbow Crown fragment with pulsing glow. */
export function makeCrownPiece(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const glow = scene.add.circle(0, 0, 40, 0xfacc15, 0.35);
  const band = sticker(scene.add.rectangle(0, 0, 64, 20, 0xfacc15));
  const p1 = sticker(scene.add.triangle(-21, -18, 0, 0, -13, 0, 13, 0, 0xfacc15));
  const p2 = sticker(scene.add.triangle(0, -23, 0, 0, -14, 0, 14, 0, 0xfacc15));
  const p3 = sticker(scene.add.triangle(21, -18, 0, 0, -13, 0, 13, 0, 0xfacc15));
  const g1 = sticker(scene.add.circle(-21, -13, 5, 0xef4444), 2);
  const g2 = sticker(scene.add.circle(0, -18, 5, 0x22c55e), 2);
  const g3 = sticker(scene.add.circle(21, -13, 5, 0x3b82f6), 2);
  const root = scene.add.container(0, 0, [glow, band, p1, p2, p3, g1, g2, g3]);
  scene.tweens.add({ targets: glow, scale: 1.35, alpha: 0.15, duration: 800, yoyo: true, repeat: -1 });
  return root;
}

/** Rainbow burst: expanding concentric rings (tweened by caller via burst()). */
export function rainbowColors(): number[] {
  return [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x3b82f6, 0xa855f7];
}

// ============================ CANDY LANDMARKS ============================

export interface Landmark { root: Phaser.GameObjects.Container; paint(grey: boolean): void }

/** Gummy tree: bark trunk + gumdrop canopy. */
export function makeGummyTree(scene: Phaser.Scene, grey: boolean, s = 1): Landmark {
  const trunk = sticker(scene.add.rectangle(0, -70 * s, 44 * s, 140 * s, 0x8b5a2b), 4);
  const trunkDark = scene.add.rectangle(0, -70 * s, 14 * s, 140 * s, 0x6b4226);
  const rootL = sticker(scene.add.ellipse(-30 * s, -8 * s, 44 * s, 18 * s, 0x8b5a2b), 3);
  const rootR = sticker(scene.add.ellipse(30 * s, -8 * s, 44 * s, 18 * s, 0x8b5a2b), 3);
  const knot = scene.add.circle(0, -80 * s, 10 * s, 0x5b3a1e);
  const canopy: Array<{ o: Phaser.GameObjects.Shape; c: number }> = [];
  const spots: Array<[number, number, number, number]> = [
    [0, -190, 62, 0xf472b6], [-52, -160, 48, 0xef4444], [52, -160, 48, 0xfb923c],
    [-30, -215, 44, 0xf9a8d4], [30, -215, 44, 0xf472b6], [0, -160, 54, 0xfb7185]
  ];
  const parts: Phaser.GameObjects.GameObject[] = [rootL, rootR, trunk, trunkDark, knot];
  for (const [x, y, r, col] of spots) {
    const puff = sticker(scene.add.circle(x * s, y * s, (r / 2) * s, col), 4);
    const shine = scene.add.circle((x - r / 4) * s, (y - r / 4) * s, (r / 6) * s, 0xffffff, 0.55);
    parts.push(puff, shine);
    canopy.push({ o: puff, c: col });
  }
  // fallen gumdrops
  const dropCols = [0xef4444, 0xfacc15, 0x3b82f6];
  dropCols.forEach((dc, i) => {
    const d = sticker(scene.add.circle((-44 + i * 44) * s, -10 * s, 11 * s, dc), 3);
    parts.push(d);
    canopy.push({ o: d as unknown as Phaser.GameObjects.Ellipse, c: dc });
  });
  const root = scene.add.container(0, 0, parts);
  return {
    root,
    paint(g: boolean): void {
      for (const p of canopy) p.o.setFillStyle(g ? 0x9aa1ad : p.c);
      trunk.setFillStyle(g ? 0x8a8f99 : 0x8b5a2b);
    }
  };
}

/** Giant lollipop: striped stick + swirl disc + bow. */
export function makeLollipop(scene: Phaser.Scene, grey: boolean, c1 = 0xef4444, c2 = 0xffffff, s = 1): Landmark {
  const stick = sticker(scene.add.rectangle(0, -80 * s, 18 * s, 160 * s, 0xfef3c7), 3);
  const stripes: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < 4; i++) stripes.push(scene.add.rectangle(0, (-130 + i * 34) * s, 18 * s, 10 * s, 0xf472b6));
  const disc = sticker(scene.add.circle(0, -190 * s, 56 * s, c1), 5);
  const swirl1 = scene.add.circle(0, -190 * s, 40 * s, c2);
  const swirl2 = scene.add.circle(0, -190 * s, 24 * s, c1);
  const swirl3 = scene.add.circle(0, -190 * s, 10 * s, c2);
  const shine = scene.add.circle(-18 * s, -208 * s, 9 * s, 0xffffff, 0.6);
  const bowL = sticker(scene.add.triangle(-16 * s, -128 * s, 0, 0, -22 * s, 12 * s, 0, 22 * s, 0xa855f7), 3);
  const bowR = sticker(scene.add.triangle(16 * s, -128 * s, 0, 0, 22 * s, 12 * s, 0, 22 * s, 0xa855f7), 3);
  const knot = sticker(scene.add.circle(0, -128 * s, 8 * s, 0x7c3aed), 2);
  const root = scene.add.container(0, 0, [stick, ...stripes, disc, swirl1, swirl2, swirl3, shine, bowL, bowR, knot]);
  return {
    root,
    paint(g: boolean): void {
      disc.setFillStyle(g ? 0x9aa1ad : c1);
      swirl1.setFillStyle(g ? 0xc3c9d4 : c2);
      swirl2.setFillStyle(g ? 0x9aa1ad : c1);
    }
  };
}

/** Cookie ruin: broken chocolate-chip cookie wall chunks. */
export function makeCookieRuin(scene: Phaser.Scene, grey: boolean, flip = false): Landmark {
  const cookie = grey ? 0x9aa1ad : 0xe0a869;
  const chip = grey ? 0x6b7280 : 0x5b3a1e;
  const tall = sticker(scene.add.rectangle(-34, -52, 56, 104, cookie), 4);
  const short = sticker(scene.add.rectangle(34, -30, 60, 60, cookie), 4);
  const chips: Phaser.GameObjects.Arc[] = [
    scene.add.circle(-40, -70, 7, chip), scene.add.circle(-24, -40, 6, chip),
    scene.add.circle(28, -40, 7, chip), scene.add.circle(48, -22, 5, chip)
  ];
  const crack = scene.add.rectangle(-34, -52, 6, 104, grey ? 0x6b7280 : 0xb97f45).setAngle(12);
  const crumbs = [
    scene.add.circle(-70, -8, 7, cookie), scene.add.circle(70, -6, 9, cookie), scene.add.circle(8, -6, 6, cookie)
  ];
  const root = scene.add.container(0, 0, [tall, short, ...chips, crack, ...crumbs]);
  if (flip) root.setScale(-1, 1);
  return {
    root,
    paint(g: boolean): void {
      tall.setFillStyle(g ? 0x9aa1ad : 0xe0a869);
      short.setFillStyle(g ? 0x9aa1ad : 0xe0a869);
      for (const c of chips) c.setFillStyle(g ? 0x8a8f99 : 0x5b3a1e);
      for (const c of crumbs) c.setFillStyle(g ? 0x8a8f99 : 0xe0a869);
      crack.setFillStyle(g ? 0x6b7280 : 0xb97f45);
    }
  };
}

/** Marshmallow cloud: drifting puffy cluster. */
export function makeMarshmallowCloud(scene: Phaser.Scene, drift = 60): Phaser.GameObjects.Container {
  const puffs: Phaser.GameObjects.Ellipse[] = [];
  const spots: Array<[number, number, number, number]> = [[0, 0, 90, 44], [-52, 8, 60, 36], [52, 8, 64, 38], [-20, -22, 56, 34], [24, -24, 60, 36]];
  for (const [x, y, w, h] of spots) puffs.push(scene.add.ellipse(x, y, w, h, 0xffffff).setStrokeStyle(3, 0xfbcfe8));
  const face1 = scene.add.circle(-12, -2, 3, 0xf9a8d4);
  const face2 = scene.add.circle(12, -2, 3, 0xf9a8d4);
  const root = scene.add.container(0, 0, [...puffs, face1, face2]);
  scene.tweens.add({ targets: root, x: `+=${drift}`, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return root;
}

/** Rainbow arc: concentric candy-colour arcs (hidden until restoration). */
export function makeRainbowArc(scene: Phaser.Scene, r = 150, thick = 13): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const cols = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x3b82f6, 0xa855f7];
  cols.forEach((c, i) => {
    g.lineStyle(thick, c, 1);
    g.beginPath();
    g.arc(0, 0, r - i * thick, Math.PI, 0, false);
    g.strokePath();
  });
  const potL = scene.add.ellipse(-r - 8, 0, 44, 30, 0x57534e).setStrokeStyle(3, OUTLINE);
  const potR = scene.add.ellipse(r + 8, 0, 44, 30, 0x57534e).setStrokeStyle(3, OUTLINE);
  const goldL = scene.add.circle(-r - 8, -4, 12, 0xfacc15);
  const goldR = scene.add.circle(r + 8, -4, 12, 0xfacc15);
  return scene.add.container(0, 0, [g, potL, potR, goldL, goldR]);
}

// ============================ BRIDGE ============================

export type BridgeLook = 'broken' | 'built' | 'enchanted' | 'waiting';

/** Candy bridge figure: broken stubs always; chocolate-block deck rises on
 *  build (crown emblem on the keystone); sprinkles + glow on enchant. */
export interface BridgeFigure {
  root: Phaser.GameObjects.Container;
  setLook(look: BridgeLook, animate: boolean): void;
}

export function makeBridgeFigure(scene: Phaser.Scene, span = 240): BridgeFigure {
  const parts: Phaser.GameObjects.GameObject[] = [];
  // candy-cane anchor posts with striped segments + gumdrop caps
  for (const sx of [-1, 1]) {
    const px = sx * (span / 2 + 26);
    parts.push(sticker(scene.add.rectangle(px, -46, 30, 96, 0xfef3c7), 4));
    for (let i = 0; i < 4; i++) {
      parts.push(scene.add.rectangle(px, -84 + i * 26, 30, 11, 0xef4444));
    }
    parts.push(sticker(scene.add.circle(px, -100, 15, 0xf472b6), 3));
    parts.push(scene.add.circle(px - 5, -105, 5, 0xffffff, 0.6));
    const rope = scene.add.rectangle(sx * (span / 2 - 30), -92, 90, 8, 0xfef3c7).setAngle(sx * 8);
    rope.setStrokeStyle(2, 0xdb2777);
    parts.push(rope);
  }
  // broken stub planks jutting from each side
  const stubs: Phaser.GameObjects.Rectangle[] = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const st = scene.add.rectangle(sx * (span / 2 - 24 - i * 30), -34, 44, 12, i % 2 ? 0x5b3a1e : 0x6b4226).setStrokeStyle(2, OUTLINE).setAngle(sx * (6 + i * 7));
      stubs.push(st);
      parts.push(st);
    }
  }
  // deck: chocolate blocks; keystone carries a gold crown
  const deck: Phaser.GameObjects.Rectangle[] = [];
  const sprinkles: Phaser.GameObjects.Shape[] = [];
  const sprinkleCols = [0xef4444, 0xfacc15, 0x22c55e, 0x3b82f6, 0xffffff];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + 30 + (i * (span - 60)) / (n - 1);
    const p = sticker(scene.add.rectangle(x, -34, 30, 14, 0x6b4226), 3);
    p.setVisible(false);
    deck.push(p);
    parts.push(p);
    if (i === Math.floor(n / 2)) {
      const crown = scene.add.triangle(x, -34, 0, 0, -9, 6, 9, 6, 0xfacc15).setStrokeStyle(2, 0x92400e);
      crown.setVisible(false);
      parts.push(crown);
      sprinkles.push(crown);
    }
    for (let k = 0; k < 2; k++) {
      const sp = scene.add.circle(x - 7 + k * 14, -36 + (k % 2) * 5, 3, sprinkleCols[(i + k) % sprinkleCols.length]);
      sp.setVisible(false);
      sprinkles.push(sp);
      parts.push(sp);
    }
  }
  const glow = scene.add.ellipse(0, -34, span + 30, 46, 0xf0abfc, 0);
  parts.push(glow);
  // magic-waiting sparkles (Layla tapped early)
  const waiters: Phaser.GameObjects.Star[] = [];
  for (let i = 0; i < 3; i++) {
    const s = scene.add.star(-60 + i * 60, -70, 5, 6, 13, 0xf0abfc).setVisible(false);
    waiters.push(s);
    parts.push(s);
    scene.tweens.add({ targets: s, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
  }
  const root = scene.add.container(0, 0, parts);
  let look: BridgeLook = 'broken';
  const paint = (l: BridgeLook): void => {
    const enchanted = l === 'enchanted';
    for (const p of deck) {
      p.setVisible(l !== 'broken');
      p.setFillStyle(enchanted ? 0xf0abfc : 0x6b4226);
    }
    for (const s of sprinkles) s.setVisible(enchanted);
    for (const s of stubs) s.setVisible(l === 'broken' || l === 'waiting');
    for (const w of waiters) w.setVisible(l === 'waiting');
    glow.setAlpha(enchanted ? 0.4 : 0);
  };
  return {
    root,
    setLook(l: BridgeLook, animate: boolean): void {
      const firstDeck = look === 'broken' || look === 'waiting';
      look = l;
      if (animate && (l === 'built' || l === 'enchanted') && firstDeck) {
        paint('built');
        deck.forEach((p, i) => {
          const y = p.y;
          p.y = y + 60; p.setAlpha(0); p.setVisible(true);
          scene.tweens.add({ targets: p, y, alpha: 1, duration: 260, delay: i * 90, ease: 'Back.easeOut' });
        });
        if (l === 'enchanted') scene.time.delayedCall(deck.length * 90 + 200, () => paint('enchanted'));
      } else {
        paint(l);
      }
      if (l === 'enchanted' && animate) {
        scene.tweens.add({ targets: glow, alpha: { from: 0.15, to: 0.5 }, duration: 500, yoyo: true, repeat: 3 });
      }
    }
  };
}

// ============================ TREEHOUSE SET ============================

/** Giant trunk wall segment with bark grooves. */
export function makeTrunkWall(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0x6b4226, 1); g.fillRect(x - w / 2, y - h / 2, w, h);
  g.fillStyle(0x7c4f2c, 1);
  for (let i = 0; i < Math.floor(w / 46); i++) g.fillRect(x - w / 2 + 12 + i * 46, y - h / 2 + 8, 12, h - 16);
  g.lineStyle(4, 0x4a2f18, 1);
  for (let i = 0; i <= Math.floor(w / 46); i++) g.lineBetween(x - w / 2 + i * 46, y - h / 2, x - w / 2 + i * 46, y + h / 2);
  return scene.add.container(0, 0, [g]);
}

/** Round window with sky, sun/moon, sill + curtains. */
export function makeRoundWindow(scene: Phaser.Scene, x: number, y: number, r: number, night: boolean): Phaser.GameObjects.Container {
  const sky = night ? 0x0f172a : 0x7dd3fc;
  const parts: Phaser.GameObjects.GameObject[] = [
    sticker(scene.add.circle(x, y, r + 12, 0x6b4226), 4),
    scene.add.circle(x, y, r, sky),
  ];
  if (night) {
    parts.push(scene.add.circle(x - 18, y - 14, 5, 0xffffff));
    parts.push(scene.add.circle(x + 14, y + 6, 4, 0xffffff));
    parts.push(scene.add.circle(x + 22, y - 20, 14, 0xfef08a));
  } else {
    parts.push(scene.add.circle(x + 16, y - 16, 15, 0xfde047));
    parts.push(scene.add.ellipse(x - 20, y + 12, 52, 20, 0xffffff, 0.9));
    parts.push(scene.add.ellipse(x + 22, y + 18, 40, 15, 0xffffff, 0.9));
  }
  parts.push(scene.add.rectangle(x, y, 8, r * 2, 0x6b4226));
  parts.push(scene.add.rectangle(x, y, r * 2, 8, 0x6b4226));
  const sill = sticker(scene.add.rectangle(x, y + r + 14, r * 1.5, 14, 0x8b5a2b), 3);
  parts.push(sill);
  // curtains
  const curL = scene.add.rectangle(x - r - 8, y - 10, 22, r * 1.5, 0xc94f6d).setStrokeStyle(2, OUTLINE);
  const curR = scene.add.rectangle(x + r + 8, y - 10, 22, r * 1.5, 0xc94f6d).setStrokeStyle(2, OUTLINE);
  parts.push(curL, curR);
  return scene.add.container(0, 0, parts);
}

/** Hanging lantern with warm glow + sway. */
export function makeLamp(scene: Phaser.Scene, x: number, y: number, s = 1): Phaser.GameObjects.Container {
  const glow = scene.add.circle(x, y + 18 * s, 44 * s, 0xffd97a, 0.28);
  const chain = scene.add.rectangle(x, y - 26 * s, 5 * s, 34 * s, 0x4a2f18);
  const cap = sticker(scene.add.triangle(x, y - 6 * s, 0, 0, -18 * s, 14 * s, 18 * s, 14 * s, 0x92400e), 3);
  const glass = sticker(scene.add.circle(x, y + 14 * s, 15 * s, 0xffe9a8), 3);
  const flame = scene.add.circle(x, y + 14 * s, 6 * s, 0xf59e0b);
  const base = scene.add.rectangle(x, y + 30 * s, 24 * s, 6 * s, 0x92400e);
  const root = scene.add.container(0, 0, [glow, chain, cap, glass, flame, base]);
  scene.tweens.add({ targets: root, angle: 2.5, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: flame, scale: 1.25, duration: 400, yoyo: true, repeat: -1 });
  return root;
}

/** Wall shelf with toys/trophies. items: 'star' | 'gem' | 'cup' | 'plush' */
export function makeShelf(scene: Phaser.Scene, x: number, y: number, w: number, items: string[]): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [sticker(scene.add.rectangle(x, y, w, 12, 0x6b4226), 3)];
  const cols = [0xfacc15, 0x38bdf8, 0xf472b6, 0x4ade80];
  items.forEach((kind, i) => {
    const ix = x - w / 2 + 34 + i * 52;
    if (kind === 'star') parts.push(sticker(scene.add.star(ix, y - 22, 5, 7, 15, 0xfacc15), 2));
    else if (kind === 'gem') {
      parts.push(sticker(scene.add.polygon(ix, y - 20, [0, -14, 11, 0, 0, 14, -11, 0], cols[i % 4]), 2));
    } else if (kind === 'cup') {
      parts.push(sticker(scene.add.rectangle(ix, y - 22, 22, 26, 0xfbbf24), 2));
      parts.push(scene.add.rectangle(ix, y - 38, 30, 8, 0xf59e0b));
    } else {
      parts.push(sticker(scene.add.circle(ix, y - 20, 13, cols[i % 4]), 2));
      parts.push(scene.add.circle(ix - 5, -22 + y - 0, 3, 0x1f2937));
      parts.push(scene.add.circle(ix + 5, y - 22, 3, 0x1f2937));
    }
  });
  return scene.add.container(0, 0, parts);
}

/** Pet corner: rug + bowl + chew toy + sign. */
export function makePetCorner(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const rug = sticker(scene.add.ellipse(x, y, 220, 64, 0xc94f6d), 4);
  const rugIn = scene.add.ellipse(x, y, 160, 42, 0xf9a8d4);
  const bowl = sticker(scene.add.ellipse(x - 60, y - 8, 56, 30, 0x38bdf8), 3);
  const food = scene.add.ellipse(x - 60, y - 12, 40, 16, 0xfbbf24);
  const bone1 = scene.add.rectangle(x + 56, y - 6, 40, 10, 0xfef3c7).setStrokeStyle(2, OUTLINE).setAngle(18);
  const bone2a = scene.add.circle(x + 38, y - 12, 7, 0xfef3c7).setStrokeStyle(2, OUTLINE);
  const bone2b = scene.add.circle(x + 74, y - 2, 7, 0xfef3c7).setStrokeStyle(2, OUTLINE);
  const signPost = scene.add.rectangle(x + 92, y - 34, 8, 52, 0x6b4226);
  const sign = sticker(scene.add.rectangle(x + 92, y - 62, 76, 30, 0x8b5a2b), 3);
  const paw = scene.add.circle(x + 92, y - 62, 9, 0xfef3c7);
  return scene.add.container(0, 0, [rug, rugIn, bowl, food, bone1, bone2a, bone2b, signPost, sign, paw]);
}

/** Jackson's corner: tool rack with hammer/wrench + block chest. */
export function makeToolCorner(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const rack = sticker(scene.add.rectangle(x, y - 60, 120, 14, 0x6b4226), 3);
  const hamH = scene.add.rectangle(x - 32, y - 88, 10, 44, 0x8b5a2b);
  const hamT = sticker(scene.add.rectangle(x - 32, y - 112, 40, 18, 0x9ca3af), 3);
  const wrench = scene.add.circle(x + 8, y - 92, 12, 0x9ca3af).setStrokeStyle(4, 0x6b7280);
  const wrenchH = scene.add.rectangle(x + 8, y - 66, 10, 30, 0x9ca3af);
  const saw = sticker(scene.add.triangle(x + 40, y - 88, 0, 0, -16, 26, 16, 26, 0xe5e7eb), 2);
  const chest = sticker(scene.add.rectangle(x, y - 24, 110, 48, 0xb45309), 4);
  const lid = sticker(scene.add.rectangle(x, y - 50, 110, 16, 0xd97706), 3);
  const block1 = sticker(scene.add.rectangle(x - 26, y - 70, 24, 24, 0x4ade80), 2);
  const block2 = sticker(scene.add.rectangle(x + 4, y - 70, 24, 24, 0x38bdf8), 2);
  const block3 = sticker(scene.add.rectangle(x + 32, y - 70, 24, 24, 0xfacc15), 2);
  return scene.add.container(0, 0, [rack, hamH, hamT, wrench, wrenchH, saw, chest, lid, block1, block2, block3]);
}

/** Layla's corner: vanity table + mirror + dress stand. */
export function makeVanityCorner(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const table = sticker(scene.add.rectangle(x, y - 24, 110, 16, 0xf9a8d4), 3);
  const legL = scene.add.rectangle(x - 46, y - 8, 10, 26, 0xec4899);
  const legR = scene.add.rectangle(x + 46, y - 8, 10, 26, 0xec4899);
  const mirror = sticker(scene.add.ellipse(x - 22, y - 66, 44, 56, 0xbfe6ff), 3);
  const shine = scene.add.ellipse(x - 28, y - 74, 14, 22, 0xffffff, 0.7);
  const brush = scene.add.rectangle(x + 22, y - 40, 26, 8, 0xa855f7).setAngle(-14);
  const gemBox = sticker(scene.add.rectangle(x + 30, y - 52, 30, 18, 0xfacc15), 2);
  const standPole = scene.add.rectangle(x + 78, y - 50, 8, 100, 0x92400e);
  const dress = sticker(scene.add.triangle(x + 78, y - 66, 0, 0, 30, 52, -30, 52, 0xec4899), 3);
  const dressTop = sticker(scene.add.circle(x + 78, y - 70, 10, 0xf9a8d4), 2);
  return scene.add.container(0, 0, [table, legL, legR, mirror, shine, brush, gemBox, standPole, dress, dressTop]);
}

/** Rope bridge segment across the top of the treehouse. */
export function makeRopeBridge(scene: Phaser.Scene, x: number, y: number, w: number): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  const n = Math.max(4, Math.floor(w / 56));
  for (let i = 0; i < n; i++) {
    const px = x - w / 2 + 28 + (i * (w - 56)) / (n - 1);
    const sag = Math.sin((i / (n - 1)) * Math.PI) * 14;
    parts.push(sticker(scene.add.rectangle(px, y + sag, 40, 12, 0xa06a35), 3));
  }
  parts.push(scene.add.rectangle(x, y - 6, w, 6, 0xd6a87c));
  parts.push(scene.add.rectangle(x, y + 34, w, 6, 0xd6a87c));
  for (const sx of [-1, 1]) parts.push(sticker(scene.add.rectangle(x + sx * (w / 2 + 8), y - 20, 16, 110, 0x6b4226), 3));
  return scene.add.container(0, 0, parts);
}

/** Bunting flag strand. */
export function makeBunting(scene: Phaser.Scene, x: number, y: number, w: number, colors = [0xef4444, 0xfacc15, 0x22c55e, 0x3b82f6, 0xf472b6]): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(x, y, w, 5, 0x6b4226)];
  const n = Math.max(3, Math.floor(w / 64));
  for (let i = 0; i < n; i++) {
    const fx = x - w / 2 + 32 + (i * (w - 64)) / (n - 1);
    const sag = Math.sin((i / (n - 1)) * Math.PI) * 10;
    parts.push(scene.add.triangle(fx, y + 20 + sag, 0, 0, -13, -18, 13, -18, colors[i % colors.length]).setStrokeStyle(2, OUTLINE));
  }
  const root = scene.add.container(0, 0, parts);
  scene.tweens.add({ targets: root, angle: 0.8, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return root;
}

/** Floor trapdoor to the secret base: wooden hatch, metal bands, ring handle,
 *  warm light leaking from below, mini sign, rising sparkles. */
export function makeTrapdoor(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  const leak = scene.add.ellipse(x, y + 8, w + 70, h + 44, 0xffb84d, 0.32);
  scene.tweens.add({ targets: leak, alpha: 0.18, duration: 1100, yoyo: true, repeat: -1 });
  const frame = sticker(scene.add.rectangle(x, y, w + 30, h + 30, 0x4a2f18), 5);
  const dark = scene.add.rectangle(x, y, w, h, 0x170b26);
  // hatch planks (two doors, seam down the middle)
  const hatchL = sticker(scene.add.rectangle(x - w / 4, y, w / 2 - 4, h - 10, 0x8b5a2b), 3);
  const hatchR = sticker(scene.add.rectangle(x + w / 4, y, w / 2 - 4, h - 10, 0x8b5a2b), 3);
  const bandT = scene.add.rectangle(x, y - h / 2 + 16, w - 8, 10, 0x3b4f7a);
  const bandB = scene.add.rectangle(x, y + h / 2 - 16, w - 8, 10, 0x3b4f7a);
  const ringH = sticker(scene.add.circle(x, y + 6, 13, 0x9ca3af), 3);
  const ringHole = scene.add.circle(x, y + 6, 6, 0x170b26);
  const bolts: Phaser.GameObjects.Arc[] = [];
  for (const bx of [-1, 1]) for (const by of [-1, 1]) {
    bolts.push(scene.add.circle(x + bx * (w / 2 + 6), y + by * (h / 2 + 6), 5, 0xfbbf24));
  }
  // mini sign above: "Bigger Adventures Below"
  const sign = sticker(scene.add.rectangle(x, y - h / 2 - 44, 190, 56, 0xa06a35), 3);
  const signT1 = scene.add.text(x, y - h / 2 - 56, 'Bigger Adventures', { fontSize: '17px', color: '#3f2a14', fontStyle: 'bold' }).setOrigin(0.5);
  const signT2 = scene.add.text(x, y - h / 2 - 34, 'Below ▼', { fontSize: '17px', color: '#3f2a14', fontStyle: 'bold' }).setOrigin(0.5);
  const postL = scene.add.rectangle(x - 80, y - h / 2 - 20, 8, 48, 0x6b4226);
  const postR = scene.add.rectangle(x + 80, y - h / 2 - 20, 8, 48, 0x6b4226);
  const sparks: Phaser.GameObjects.Star[] = [];
  for (let i = 0; i < 4; i++) {
    const s = scene.add.star(x - 50 + i * 34, y - 20, 5, 4, 9, 0xfde68a);
    sparks.push(s);
    scene.tweens.add({ targets: s, alpha: 0.2, y: '-=22', duration: 900 + i * 200, yoyo: true, repeat: -1 });
  }
  return scene.add.container(0, 0, [leak, frame, dark, hatchL, hatchR, bandT, bandB, ringH, ringHole, ...bolts, sign, signT1, signT2, postL, postR, ...sparks]);
}

/** Festoon string lights sagging between two points, warm twinkling bulbs. */
export function makeStringLights(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number, bulbs = 9): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  let prevX = x1, prevY = y1;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const sag = Math.sin(t * Math.PI) * 34;
    pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + sag]);
  }
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const cx = (ax + bx) / 2, cy = (ay + by) / 2;
    const len = Math.hypot(bx - ax, by - ay);
    const seg = scene.add.rectangle(cx, cy, len + 2, 3, 0x3f2a14);
    seg.setRotation(Math.atan2(by - ay, bx - ax));
    parts.push(seg);
  }
  void prevX; void prevY;
  for (let i = 0; i < bulbs; i++) {
    const t = (i + 0.5) / bulbs;
    const sag = Math.sin(t * Math.PI) * 34;
    const bx = x1 + (x2 - x1) * t, by = y1 + (y2 - y1) * t + sag + 8;
    parts.push(scene.add.rectangle(bx, by - 8, 4, 8, 0x3f2a14));
    const glow = scene.add.circle(bx, by + 4, 14, 0xffd97a, 0.3);
    const bulb = scene.add.circle(bx, by + 4, 6, 0xffe9a8).setStrokeStyle(2, 0xb45309);
    parts.push(glow, bulb);
    scene.tweens.add({ targets: [bulb, glow], alpha: 0.45, duration: 700 + (i % 4) * 220, yoyo: true, repeat: -1 });
  }
  return scene.add.container(0, 0, parts);
}

/** Leafy potted plant. */
export function makeLeafPlant(scene: Phaser.Scene, x: number, y: number, s = 1): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [
    sticker(scene.add.rectangle(x, y - 14 * s, 44 * s, 30 * s, 0xb45309), 3),
    scene.add.rectangle(x, y - 30 * s, 50 * s, 10 * s, 0xd97706)
  ];
  const greens = [0x16a34a, 0x22c55e, 0x3e9e4f, 0x4ade80];
  const leaves: Array<[number, number, number, number, number]> = [
    [0, -66, 26, 52, 0], [-24, -54, 22, 44, -28], [24, -54, 22, 44, 28],
    [-12, -84, 20, 40, -8], [14, -82, 20, 40, 10], [0, -46, 24, 30, 0]
  ];
  leaves.forEach(([dx, dy, w, h, a], i) => {
    parts.push(scene.add.ellipse(x + dx * s, y + dy * s, w * s, h * s, greens[i % greens.length]).setStrokeStyle(2, 0x14532d).setAngle(a));
  });
  parts.push(scene.add.circle(x - 8 * s, y - 70 * s, 4 * s, 0xbbf7d0));
  return scene.add.container(0, 0, parts);
}

/** Bookshelf with colourful book rows, a globe and a tiny plant on top. */
export function makeBookshelf(scene: Phaser.Scene, x: number, y: number, w: number): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [
    sticker(scene.add.rectangle(x, y - 70, w, 150, 0x6b4226), 4),
    scene.add.rectangle(x, y - 70, w - 16, 134, 0x3f2a14)
  ];
  const bookCols = [0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xa855f7, 0xf97316, 0x38bdf8];
  for (let shelf = 0; shelf < 2; shelf++) {
    const sy = y - 100 + shelf * 62;
    parts.push(scene.add.rectangle(x, sy + 26, w - 16, 8, 0x8b5a2b));
    let bx = x - w / 2 + 22;
    let bi = shelf * 3;
    while (bx < x + w / 2 - 26) {
      const bw = 13 + (bi % 3) * 4, bh = 40 + (bi % 4) * 5;
      parts.push(scene.add.rectangle(bx + bw / 2, sy + 26 - bh / 2, bw, bh, bookCols[bi % bookCols.length]).setStrokeStyle(2, 0x3f2a14));
      parts.push(scene.add.rectangle(bx + bw / 2, sy + 26 - bh / 2 - 8, bw, 4, 0xffffff, 0.5));
      bx += bw + 4;
      bi++;
    }
  }
  // globe on top
  parts.push(scene.add.rectangle(x - w / 4, y - 152, 8, 18, 0x92400e));
  parts.push(sticker(scene.add.circle(x - w / 4, y - 172, 20, 0x38bdf8), 3));
  parts.push(scene.add.ellipse(x - w / 4 - 6, y - 176, 18, 12, 0x22c55e));
  // tiny plant on top
  parts.push(scene.add.rectangle(x + w / 4, y - 152, 26, 18, 0xb45309));
  parts.push(scene.add.ellipse(x + w / 4, y - 172, 30, 26, 0x16a34a));
  return scene.add.container(0, 0, parts);
}

// ============================ UNDERGROUND SET ============================

/** Stone block wall band. */
export function makeStoneWall(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0x273449, 1); g.fillRect(x - w / 2, y - h / 2, w, h);
  const bh = 34;
  let row = 0;
  for (let yy = y - h / 2 + 4; yy < y + h / 2 - 8; yy += bh, row++) {
    for (let xx = x - w / 2 + 4 - (row % 2) * 30; xx < x + w / 2 - 10; xx += 62) {
      g.fillStyle(row % 2 ? 0x3b4c66 : 0x334155, 1);
      g.fillRoundedRect(xx, yy, 56, bh - 6, 6);
      g.lineStyle(2, 0x1e293b, 1);
      g.strokeRoundedRect(xx, yy, 56, bh - 6, 6);
    }
  }
  void g;
  return scene.add.container(0, 0, [g]);
}

/** Riveted metal floor band. */
export function makeMetalFloor(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0x3b4a63, 1); g.fillRect(x - w / 2, y - h / 2, w, h);
  g.fillStyle(0x46587a, 1);
  for (let xx = x - w / 2 + 10; xx < x + w / 2; xx += 90) g.fillRect(xx, y - h / 2 + 6, 78, h - 12);
  g.fillStyle(0x8fa3c4, 1);
  for (let xx = x - w / 2 + 16; xx < x + w / 2; xx += 90) {
    g.fillCircle(xx, y - h / 2 + 14, 3); g.fillCircle(xx + 66, y - h / 2 + 14, 3);
    g.fillCircle(xx, y + h / 2 - 14, 3); g.fillCircle(xx + 66, y + h / 2 - 14, 3);
  }
  return scene.add.container(0, 0, [g]);
}

/** Wall pipe run with glowing joints. */
export function makePipeRun(scene: Phaser.Scene, x: number, y: number, w: number, glowColor = 0x38bdf8): Phaser.GameObjects.Container {
  const pipe = scene.add.rectangle(x, y, w, 26, 0x24335c).setStrokeStyle(3, 0x111c36);
  const parts: Phaser.GameObjects.GameObject[] = [pipe];
  const n = Math.max(2, Math.floor(w / 150));
  for (let i = 0; i < n; i++) {
    const jx = x - w / 2 + 60 + (i * (w - 120)) / Math.max(1, n - 1);
    parts.push(scene.add.rectangle(jx, y, 18, 34, 0x3b4f7a).setStrokeStyle(2, 0x111c36));
    const dot = scene.add.circle(jx, y, 7, glowColor);
    parts.push(dot);
    scene.tweens.add({ targets: dot, alpha: 0.35, duration: 800 + i * 220, yoyo: true, repeat: -1 });
  }
  return scene.add.container(0, 0, parts);
}

/** Glowing crystal cluster with flickering light. */
export function makeGlowCrystals(scene: Phaser.Scene, x: number, y: number, s = 1, color = 0x22d3ee): Phaser.GameObjects.Container {
  const glow = scene.add.circle(x, y - 30 * s, 70 * s, color, 0.22);
  const c1 = sticker(scene.add.polygon(x - 26 * s, y, [0, -64 * s, 16 * s, -10 * s, 0, 14 * s, -16 * s, -10 * s], color), 3);
  const c2 = sticker(scene.add.polygon(x + 4 * s, y, [0, -88 * s, 20 * s, -12 * s, 0, 16 * s, -20 * s, -12 * s], 0xa5f3fc), 3);
  const c3 = sticker(scene.add.polygon(x + 32 * s, y, [0, -48 * s, 13 * s, -8 * s, 0, 12 * s, -13 * s, -8 * s], color), 3);
  const rock = scene.add.ellipse(x, y + 6, 110 * s, 26 * s, 0x1e293b).setStrokeStyle(3, 0x0f172a);
  const root = scene.add.container(0, 0, [glow, rock, c1, c2, c3]);
  scene.tweens.add({ targets: glow, alpha: 0.1, scale: 1.15, duration: 1200, yoyo: true, repeat: -1 });
  return root;
}

/** Map table: wooden table + treasure map with X + pins. */
export function makeMapTable(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const top = sticker(scene.add.rectangle(x, y - 30, 170, 20, 0x8b5a2b), 3);
  const legL = scene.add.rectangle(x - 70, y - 5, 14, 40, 0x6b4226);
  const legR = scene.add.rectangle(x + 70, y - 5, 14, 40, 0x6b4226);
  const map = sticker(scene.add.rectangle(x, y - 52, 120, 66, 0xfef3c7), 2);
  const path = scene.add.circle(x - 20, y - 52, 4, 0xd97706);
  const path2 = scene.add.circle(x + 2, y - 60, 4, 0xd97706);
  const x1 = scene.add.rectangle(x + 26, y - 56, 18, 6, 0xef4444).setAngle(45);
  const x2 = scene.add.rectangle(x + 26, y - 56, 18, 6, 0xef4444).setAngle(-45);
  const pin = sticker(scene.add.circle(x - 34, y - 44, 6, 0xef4444), 2);
  const candle = scene.add.rectangle(x + 62, y - 48, 10, 28, 0xfef3c7).setStrokeStyle(2, 0x92400e);
  const flame = scene.add.circle(x + 62, y - 66, 6, 0xf59e0b);
  scene.tweens.add({ targets: flame, scale: 1.3, duration: 350, yoyo: true, repeat: -1 });
  return scene.add.container(0, 0, [top, legL, legR, map, path, path2, x1, x2, pin, candle, flame]);
}

/** Treasure shelf: chest + gems + trophy cup. */
export function makeTreasureShelf(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const shelf = sticker(scene.add.rectangle(x, y, 210, 12, 0x6b4226), 3);
  const chestB = sticker(scene.add.rectangle(x - 60, y - 26, 70, 40, 0x92400e), 3);
  const chestL = sticker(scene.add.rectangle(x - 60, y - 44, 70, 16, 0xd97706), 3);
  const clasp = sticker(scene.add.rectangle(x - 60, y - 34, 14, 18, 0xfacc15), 2);
  const gems = [0xef4444, 0x38bdf8, 0x22c55e].map((col, i) =>
    sticker(scene.add.polygon(x - 2 + i * 26, y - 22, [0, -12, 10, 0, 0, 12, -10, 0], col), 2));
  const cup = sticker(scene.add.rectangle(x + 78, y - 26, 24, 30, 0xfbbf24), 2);
  const cupTop = scene.add.rectangle(x + 78, y - 44, 34, 9, 0xf59e0b);
  return scene.add.container(0, 0, [shelf, chestB, chestL, clasp, ...gems, cup, cupTop]);
}

/** Heavy stone future door with lock (or teaser glow). */
export function makeStoneDoor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, tease: 'locked' | 'candy' | 'tease'): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [
    sticker(scene.add.rectangle(x, y, w + 18, h + 18, 0x1e293b), 4),
    sticker(scene.add.rectangle(x, y, w, h, 0x475569), 3)
  ];
  // stone seams
  for (let i = 1; i < 3; i++) parts.push(scene.add.rectangle(x, y - h / 2 + (i * h) / 3, w, 4, 0x334155));
  if (tease === 'candy') {
    const orb = scene.add.circle(x, y - 10, 24, 0xf472b6);
    parts.push(orb);
    scene.tweens.add({ targets: orb, scale: 1.15, duration: 800, yoyo: true, repeat: -1 });
    const sw = scene.add.circle(x, y - 10, 13, 0xfce7f3);
    parts.push(sw);
  } else if (tease === 'tease') {
    const orb = scene.add.circle(x, y - 10, 24, 0x22c55e);
    parts.push(orb);
    scene.tweens.add({ targets: orb, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
  } else {
    const plate = sticker(scene.add.rectangle(x, y - 6, 30, 38, 0x1e293b), 3);
    const hole = scene.add.circle(x, y - 12, 6, 0x0f172a);
    const slot = scene.add.rectangle(x, y - 2, 8, 14, 0x0f172a);
    parts.push(plate, hole, slot);
  }
  return scene.add.container(0, 0, parts);
}

/** Portal machine arch behind the portal rings: struts + coils + gauges. */
export function makePortalMachine(scene: Phaser.Scene, x: number, y: number, r: number): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  for (const sx of [-1, 1]) {
    parts.push(sticker(scene.add.rectangle(x + sx * (r + 34), y + 10, 30, 190, 0x3b4f7a), 4));
    for (let i = 0; i < 3; i++) {
      const coil = scene.add.circle(x + sx * (r + 34), y - 50 + i * 52, 11, 0x22d3ee);
      parts.push(coil);
      scene.tweens.add({ targets: coil, alpha: 0.4, duration: 700 + i * 200, yoyo: true, repeat: -1 });
    }
    parts.push(sticker(scene.add.rectangle(x + sx * (r + 34), y + 116, 54, 18, 0x24335c), 3));
    const gauge = sticker(scene.add.circle(x + sx * (r + 34), y + 60, 10, 0x14532d), 2);
    const needle = scene.add.rectangle(x + sx * (r + 34), y + 60, 3, 9, 0x4ade80).setOrigin(0.5, 1);
    parts.push(gauge, needle);
    scene.tweens.add({ targets: needle, angle: 38, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  parts.push(sticker(scene.add.rectangle(x, y - r - 62, (r + 34) * 2 + 30, 26, 0x3b4f7a), 4));
  const lampL = scene.add.circle(x - r - 10, y - r - 62, 8, 0xfacc15);
  const lampR = scene.add.circle(x + r + 10, y - r - 62, 8, 0xfacc15);
  parts.push(lampL, lampR);
  scene.tweens.add({ targets: [lampL, lampR], alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
  return scene.add.container(0, 0, parts);
}

/** Hero floor pad: gear-tooth ring + sigil + name pill. */
export function makePad(scene: Phaser.Scene, x: number, y: number, color: number, sigil: 'hammer' | 'heart', name: string): Phaser.GameObjects.Container {
  const glow = scene.add.circle(x, y, 62, color, 0.22);
  const ring = scene.add.circle(x, y, 48, color, 0.35).setStrokeStyle(6, color, 1);
  const ring2 = scene.add.circle(x, y, 38, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.7);
  const parts: Phaser.GameObjects.GameObject[] = [glow, ring, ring2];
  // gear teeth around the rim (portal machinery feel)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.push(scene.add.rectangle(x + Math.cos(a) * 56, y + Math.sin(a) * 56, 14, 14, color).setStrokeStyle(2, 0xffffff, 0.8).setAngle((a * 180) / Math.PI));
  }
  if (sigil === 'hammer') {
    parts.push(scene.add.rectangle(x - 5, y, 10, 40, 0xfff7ed).setAngle(30));
    parts.push(scene.add.rectangle(x + 10, y - 15, 32, 12, 0xfff7ed));
  } else {
    // heart sigil for Layla's pad
    parts.push(scene.add.circle(x - 8, y - 4, 11, 0xfff7ed));
    parts.push(scene.add.circle(x + 8, y - 4, 11, 0xfff7ed));
    parts.push(scene.add.triangle(x, y + 8, 0, 0, -19, -8, 19, -8, 0xfff7ed));
  }
  const pill = scene.add.text(x, y + 66, name, { fontSize: '17px', color: '#fff', fontStyle: 'bold', backgroundColor: '#0009', padding: { x: 10, y: 4 } }).setOrigin(0.5);
  parts.push(pill);
  const root = scene.add.container(0, 0, parts);
  scene.tweens.add({ targets: ring, scale: 1.07, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return root;
}

/** Wooden signpost with 1-2 boards; optional arrow or heart. */
export function makeSignpost(
  scene: Phaser.Scene, x: number, y: number,
  lines: string[], opts: { arrow?: 'left' | 'right' | 'none'; heart?: boolean; flip?: boolean } = {}
): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [
    sticker(scene.add.rectangle(x, y - 60, 18, 130, 0x6b4226), 3),
    sticker(scene.add.ellipse(x, y + 4, 60, 16, 0x5b3a1e), 3)
  ];
  lines.forEach((line, i) => {
    const by = y - 108 + i * 46;
    parts.push(sticker(scene.add.rectangle(x, by, 150, 38, 0xa06a35), 3));
    parts.push(scene.add.text(x, by - (opts.arrow && i === lines.length - 1 ? 4 : 0), line, {
      fontSize: lines.length > 1 ? '17px' : '20px', color: '#3f2a14', fontStyle: 'bold'
    }).setOrigin(0.5));
  });
  if (opts.arrow && opts.arrow !== 'none') {
    const ax = x + (opts.arrow === 'right' ? 58 : -58);
    const ay = y - 108 + (lines.length - 1) * 46 + 12;
    parts.push(scene.add.triangle(ax, ay, 0, 0,
      opts.arrow === 'right' ? -14 : 14, -10,
      opts.arrow === 'right' ? -14 : 14, 10, 0x3f2a14));
  }
  if (opts.heart) parts.push(scene.add.circle(x, y - 108 + (lines.length - 1) * 46 + 12, 8, 0x9d174d));
  const root = scene.add.container(0, 0, parts);
  if (opts.flip) root.setScale(-1, 1);
  return root;
}

/** Grey castle silhouette for the unrestored far hills (hidden on restore). */
export function makeGreyCastle(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const c = 0x6f7683;
  const parts: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(-90, -70, 60, 140, c),
    scene.add.rectangle(0, -95, 80, 190, c),
    scene.add.rectangle(90, -70, 60, 140, c),
    scene.add.triangle(-90, -170, 0, 0, -36, 30, 36, 30, 0x7d8492),
    scene.add.triangle(0, -215, 0, 0, -48, 40, 48, 40, 0x7d8492),
    scene.add.triangle(90, -170, 0, 0, -36, 30, 36, 30, 0x7d8492),
    scene.add.rectangle(0, -60, 34, 60, 0x565d6b),
    scene.add.circle(-90, -140, 8, 0x565d6b),
    scene.add.circle(90, -140, 8, 0x565d6b)
  ];
  return scene.add.container(0, 0, parts);
}

/** Vertical wall banner with stacked motto lines. */
export function makeWallBanner(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  lines: string[], bg: number, fg = '#ffffff'
): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(x, y - h / 2 - 8, w + 30, 10, 0x6b4226),
    sticker(scene.add.rectangle(x, y, w, h, bg), 3),
    scene.add.triangle(x - w / 4, y + h / 2 + 12, 0, 0, -w / 4, -24, w / 4, -24, bg),
    scene.add.triangle(x + w / 4, y + h / 2 + 12, 0, 0, -w / 4, -24, w / 4, -24, bg)
  ];
  lines.forEach((line, i) => {
    parts.push(scene.add.text(x, y - h / 2 + 30 + i * 30, line, {
      fontSize: '20px', color: fg, fontStyle: 'bold'
    }).setOrigin(0.5, 0));
  });
  return scene.add.container(0, 0, parts);
}

/** Camera vignette via WebGL postFX (replaces the old graphics-bar overlay).
 *  Safe to call on every scene (re)start: clears stale pipelines first. */
export function makeVignette(scene: Phaser.Scene, strength = 0.42): void {
  try {
    const fx = scene.cameras.main.postFX;
    if (!fx) return;
    fx.clear();
    fx.addVignette(0.5, 0.5, 0.62, Math.min(0.9, strength + 0.06));
  } catch {
    /* non-WebGL fallback: no vignette */
  }
}
