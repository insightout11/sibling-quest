// Procedural vector art (§12): real drawn game assets, no emoji placeholders.
// Toy-like, chunky shapes with white outline stickers so heroes read at a glance.
// All builders return Containers centred at (0,0), feet at y=0.

import Phaser from 'phaser';

const OUTLINE = 0xffffff;

function sticker<T extends Phaser.GameObjects.Shape>(s: T, w = 3): T {
  s.setStrokeStyle(w, OUTLINE, 1);
  return s;
}

/** Jackson — blocky builder/adventurer: helmet, vest, backpack, boots, pickaxe. */
export function makeJackson(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  // boots
  const bootL = sticker(scene.add.rectangle(-13, -8, 18, 16, 0x5b3a1e));
  const bootR = sticker(scene.add.rectangle(13, -8, 18, 16, 0x5b3a1e));
  // legs
  const legL = scene.add.rectangle(-12, -22, 16, 16, 0x3b5bdb);
  const legR = scene.add.rectangle(12, -22, 16, 16, 0x3b5bdb);
  // torso vest (adventurer orange-brown with pocket)
  const torso = sticker(scene.add.rectangle(0, -46, 46, 36, 0xb45309));
  const pocket = scene.add.rectangle(0, -40, 22, 12, 0xfbbf24);
  // arms
  const armL = scene.add.rectangle(-29, -46, 12, 28, 0xd97706);
  const armR = scene.add.rectangle(29, -46, 12, 28, 0xd97706);
  const gloveR = sticker(scene.add.circle(29, -30, 9, 0x92400e));
  // head
  const head = sticker(scene.add.rectangle(0, -78, 34, 28, 0xfcd9a8));
  const eyeL = scene.add.rectangle(-8, -80, 6, 8, 0x1f2937);
  const eyeR = scene.add.rectangle(8, -80, 6, 8, 0x1f2937);
  const smile = scene.add.rectangle(0, -69, 14, 4, 0x92400e);
  // builder helmet
  const helmet = sticker(scene.add.rectangle(0, -95, 42, 14, 0xf59e0b));
  const lamp = scene.add.circle(0, -95, 6, 0xfef08a).setStrokeStyle(2, 0x92400e);
  // square backpack
  const pack = sticker(scene.add.rectangle(-32, -52, 14, 26, 0x78716c));
  const bedroll = scene.add.circle(-32, -68, 8, 0x16a34a).setStrokeStyle(2, OUTLINE);
  // pickaxe in right hand
  const handle = scene.add.rectangle(44, -38, 6, 34, 0x8b5a2b).setAngle(24);
  const axeHead = sticker(scene.add.rectangle(52, -54, 26, 8, 0x9ca3af));
  parts.push(bootL, bootR, legL, legR, torso, pocket, armL, armR, gloveR, head, eyeL, eyeR, smile, helmet, lamp, pack, bedroll, handle, axeHead);
  return scene.add.container(0, 0, parts);
}

/** Layla — princess-fairy adventurer: crown, adventure dress, boots, wand, sash. */
export function makeLayla(scene: Phaser.Scene, opts?: { wings?: boolean }): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  // boots
  const bootL = sticker(scene.add.rectangle(-11, -8, 16, 16, 0x9d174d));
  const bootR = sticker(scene.add.rectangle(11, -8, 16, 16, 0x9d174d));
  // adventure dress (trapezoid via two rects + skirt triangle)
  const skirt = sticker(scene.add.triangle(0, -34, 0, 0, 44, 34, -22, 34, 0xec4899));
  const bodice = sticker(scene.add.rectangle(0, -56, 34, 26, 0xf9a8d4));
  const sash = scene.add.rectangle(0, -50, 36, 8, 0xfacc15);
  const gem = scene.add.circle(0, -50, 5, 0x38bdf8).setStrokeStyle(2, OUTLINE);
  // arms
  const armL = scene.add.rectangle(-23, -54, 10, 24, 0xfbcfe8);
  const armR = scene.add.rectangle(23, -54, 10, 24, 0xfbcfe8);
  // head
  const head = sticker(scene.add.circle(0, -82, 17, 0xfcd9a8));
  const eyeL = scene.add.circle(-6, -84, 3, 0x1f2937);
  const eyeR = scene.add.circle(6, -84, 3, 0x1f2937);
  const cheekL = scene.add.circle(-11, -78, 3, 0xf9a8d4);
  const cheekR = scene.add.circle(11, -78, 3, 0xf9a8d4);
  const smile = scene.add.circle(0, -76, 4, 0x9d174d);
  // hair puffs
  const hairL = scene.add.circle(-17, -86, 9, 0x92400e).setStrokeStyle(2, OUTLINE);
  const hairR = scene.add.circle(17, -86, 9, 0x92400e).setStrokeStyle(2, OUTLINE);
  // crown (gold zigzag)
  const crownPts = [new Phaser.Geom.Point(-14, -96), new Phaser.Geom.Point(-14, -108), new Phaser.Geom.Point(-7, -100), new Phaser.Geom.Point(0, -110), new Phaser.Geom.Point(7, -100), new Phaser.Geom.Point(14, -108), new Phaser.Geom.Point(14, -96)];
  const crown = sticker(scene.add.polygon(0, 0, crownPts, 0xfacc15));
  const crownGem = scene.add.circle(0, -101, 3, 0xec4899);
  // wand in right hand: stick + star tip
  const wand = scene.add.rectangle(36, -44, 5, 30, 0xa855f7).setAngle(-18).setStrokeStyle(2, OUTLINE);
  const wandStar = sticker(scene.add.star(44, -62, 5, 6, 12, 0xfef08a), 2);
  parts.push(bootL, bootR, skirt, bodice, sash, gem, armL, armR, head, eyeL, eyeR, cheekL, cheekR, smile, hairL, hairR, crown, crownGem, wand, wandStar);
  if (opts?.wings) {
    const wingL = scene.add.ellipse(-26, -60, 20, 34, 0xc4b5fd, 0.85).setStrokeStyle(2, OUTLINE).setAngle(-18);
    const wingR = scene.add.ellipse(26, -60, 20, 34, 0xc4b5fd, 0.85).setStrokeStyle(2, OUTLINE).setAngle(18);
    parts.unshift(wingL, wingR);
  }
  return scene.add.container(0, 0, parts);
}

export function makeHero(scene: Phaser.Scene, hero: 'jackson' | 'layla'): Phaser.GameObjects.Container {
  return hero === 'jackson' ? makeJackson(scene) : makeLayla(scene);
}

/** Gummy bear NPC: translucent-look round bear with belly + worried brows. */
export function makeGummy(scene: Phaser.Scene, grey: boolean): Phaser.GameObjects.Container {
  const body = grey ? 0x9ca3af : 0xf472b6;
  const dark = grey ? 0x6b7280 : 0xdb2777;
  const parts: Phaser.GameObjects.GameObject[] = [
    sticker(scene.add.circle(-20, -52, 10, body)),
    sticker(scene.add.circle(20, -52, 10, body)),
    sticker(scene.add.ellipse(0, -24, 52, 60, body)),
    scene.add.ellipse(0, -14, 30, 32, grey ? 0xd1d5db : 0xfbcfe8),
    sticker(scene.add.circle(0, -52, 22, body)),
    scene.add.ellipse(0, -46, 22, 14, grey ? 0xd1d5db : 0xfce7f3),
    scene.add.circle(-8, -56, 4, 0x1f2937),
    scene.add.circle(8, -56, 4, 0x1f2937),
    scene.add.rectangle(-8, -64, 10, 4, dark).setAngle(18),
    scene.add.rectangle(8, -64, 10, 4, dark).setAngle(-18),
    scene.add.circle(0, -48, 3, dark)
  ];
  return scene.add.container(0, 0, parts);
}

/** Jelly monster: wobbly blob with eyes; shielded gets a glowing ring. */
export interface JellyFigure {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Ellipse;
  ring: Phaser.GameObjects.Arc;
  setShielded: (on: boolean, grey: boolean) => void;
}

export function makeJelly(scene: Phaser.Scene, shielded: boolean, grey: boolean): JellyFigure {
  const bodyColor = grey ? 0x9ca3af : 0x4ade80;
  const body = sticker(scene.add.ellipse(0, -20, 56, 48, bodyColor), 4);
  const shine = scene.add.ellipse(-12, -30, 16, 10, 0xffffff, 0.5);
  const eyeL = scene.add.circle(-10, -24, 5, 0xffffff).setStrokeStyle(2, 0x1f2937);
  const eyeR = scene.add.circle(10, -24, 5, 0xffffff).setStrokeStyle(2, 0x1f2937);
  const pupL = scene.add.circle(-10, -23, 2, 0x1f2937);
  const pupR = scene.add.circle(10, -23, 2, 0x1f2937);
  const mouth = scene.add.ellipse(0, -12, 12, 7, 0x1f2937);
  const ring = scene.add.circle(0, -20, 40, 0xc4b5fd, 0).setStrokeStyle(6, 0xf0abfc, 1);
  const root = scene.add.container(0, 0, [ring, body, shine, eyeL, eyeR, pupL, pupR, mouth]);
  const setShielded = (on: boolean, g: boolean): void => {
    ring.setStrokeStyle(6, on ? 0xf0abfc : 0xffffff, on ? 1 : 0.25);
    body.setFillStyle(g ? 0x9ca3af : on ? 0xc4b5fd : 0x4ade80);
  };
  setShielded(shielded, grey);
  return { root, body, ring, setShielded };
}

/** Candy unicorn: white pony body, pink mane, gold horn. */
export function makeUnicorn(scene: Phaser.Scene, grey: boolean): Phaser.GameObjects.Container {
  const coat = grey ? 0xd1d5db : 0xffffff;
  const mane = grey ? 0x9ca3af : 0xf472b6;
  const parts: Phaser.GameObjects.GameObject[] = [
    sticker(scene.add.rectangle(-24, -14, 10, 28, coat)),
    sticker(scene.add.rectangle(-8, -14, 10, 28, coat)),
    sticker(scene.add.rectangle(8, -14, 10, 28, coat)),
    sticker(scene.add.rectangle(24, -14, 10, 28, coat)),
    sticker(scene.add.ellipse(0, -36, 72, 34, coat), 4),
    sticker(scene.add.ellipse(-6, -38, 40, 22, grey ? 0xe5e7eb : 0xfce7f3)),
    sticker(scene.add.rectangle(30, -58, 16, 30, coat)).setAngle?.(-12) as unknown as Phaser.GameObjects.GameObject,
    sticker(scene.add.circle(36, -74, 12, coat)),
    scene.add.triangle(36, -92, 0, 12, -8, 12, 8, 12, 0xfacc15).setStrokeStyle?.(2, OUTLINE) as unknown as Phaser.GameObjects.GameObject,
    scene.add.ellipse(24, -62, 12, 26, mane),
    scene.add.ellipse(-34, -44, 10, 24, mane).setAngle(30),
    scene.add.circle(39, -76, 2, 0x1f2937),
    scene.add.circle(33, -76, 2, 0x1f2937)
  ];
  return scene.add.container(0, 0, parts.filter(Boolean));
}

/** Candy crystal: faceted diamond. */
export function makeCrystal(scene: Phaser.Scene, grey: boolean): Phaser.GameObjects.Container {
  const c = grey ? 0x9ca3af : 0x22d3ee;
  const gem = sticker(scene.add.polygon(0, -6, [0, -30, 20, -6, 0, 22, -20, -6], c), 4);
  const facet = scene.add.polygon(0, -6, [0, -30, 8, -6, 0, 22, -8, -6], 0xffffff, 0.35);
  const base = scene.add.ellipse(0, 24, 44, 12, 0x78350f);
  return scene.add.container(0, 0, [base, gem, facet]);
}

/** Fairy star: 5-point gold star with glow. */
export function makeStar(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const glow = scene.add.circle(0, 0, 30, 0xfef08a, 0.35);
  const star = sticker(scene.add.star(0, 0, 5, 14, 28, 0xfacc15), 3);
  return scene.add.container(0, 0, [glow, star]);
}

/** Night Rainbow Crown fragment: small crown with rainbow gems. */
export function makeCrownPiece(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const glow = scene.add.circle(0, 0, 34, 0xfacc15, 0.3);
  const band = sticker(scene.add.rectangle(0, 0, 56, 18, 0xfacc15));
  const p1 = sticker(scene.add.triangle(-18, -16, 0, 0, -12, 0, 12, 0, 0xfacc15));
  const p2 = sticker(scene.add.triangle(0, -20, 0, 0, -13, 0, 13, 0, 0xfacc15));
  const p3 = sticker(scene.add.triangle(18, -16, 0, 0, -12, 0, 12, 0, 0xfacc15));
  const g1 = scene.add.circle(-18, -12, 4, 0xef4444);
  const g2 = scene.add.circle(0, -16, 4, 0x22c55e);
  const g3 = scene.add.circle(18, -12, 4, 0x3b82f6);
  return scene.add.container(0, 0, [glow, band, p1, p2, p3, g1, g2, g3]);
}

/** Rainbow burst: expanding concentric rings (tweened by caller via burst()). */
export function rainbowColors(): number[] {
  return [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x3b82f6, 0xa855f7];
}
