// FX system: particle textures, bursts, bolts, sweeps, fanfares, prompts.
// Presentation-only. All helpers are fire-and-forget and clean up after themselves.

import Phaser from 'phaser';

/** Generate shared particle/prompt textures once per scene (idempotent). */
export function ensureFxTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('fx-spark')) return;
  const g = scene.add.graphics();
  // soft white spark dot
  g.clear();
  g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 5);
  g.fillStyle(0xffffff, 0.45); g.fillCircle(8, 8, 8);
  g.generateTexture('fx-spark', 16, 16);
  // small 5-point star
  g.clear();
  g.fillStyle(0xfef08a, 1);
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 11 : 5;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: 12 + Math.cos(a) * r, y: 12 + Math.sin(a) * r });
  }
  g.fillPoints(pts, true);
  g.generateTexture('fx-star', 24, 24);
  // heart (two circles + triangle)
  g.clear();
  g.fillStyle(0xf472b6, 1);
  g.fillCircle(8, 9, 6); g.fillCircle(16, 9, 6);
  g.fillTriangle(2, 11, 22, 11, 12, 22);
  g.fillStyle(0xffffff, 0.5); g.fillCircle(7, 7, 2);
  g.generateTexture('fx-heart', 24, 24);
  // soft poof
  g.clear();
  g.fillStyle(0xffffff, 0.85); g.fillCircle(16, 16, 12);
  g.fillStyle(0xffffff, 0.35); g.fillCircle(16, 16, 16);
  g.generateTexture('fx-poof', 32, 32);
  // big soft glow
  g.clear();
  g.fillStyle(0xffffff, 0.5); g.fillCircle(32, 32, 22);
  g.fillStyle(0xffffff, 0.18); g.fillCircle(32, 32, 32);
  g.generateTexture('fx-glow', 64, 64);
  g.destroy();
}

export interface BurstOpts {
  texture?: string;
  colors?: number[];
  count?: number;
  speed?: number;
  lifespan?: number;
  scale?: number;
  gravity?: number;
}

/** One-shot particle explosion. */
export function burst(
  scene: Phaser.Scene, x: number, y: number,
  opts: BurstOpts = {}
): void {
  ensureFxTextures(scene);
  const e = scene.add.particles(x, y, opts.texture ?? 'fx-spark', {
    speed: opts.speed ?? 220,
    lifespan: opts.lifespan ?? 650,
    scale: { start: opts.scale ?? 1, end: 0 },
    quantity: opts.count ?? 14,
    emitting: false,
    gravityY: opts.gravity ?? 160
  });
  e.setDepth(90);
  e.setBlendMode(Phaser.BlendModes.ADD);
  if (opts.colors) e.setParticleTint(opts.colors);
  e.explode(opts.count ?? 14, x, y);
  scene.time.delayedCall((opts.lifespan ?? 650) + 150, () => e.destroy());
}

/** Expanding stroked ring pulse. */
export function ringPulse(
  scene: Phaser.Scene, x: number, y: number,
  color = 0xffffff, maxR = 90, dur = 550
): void {
  const ring = scene.add.circle(x, y, 12, 0xffffff, 0).setStrokeStyle(7, color, 1);
  ring.setDepth(90);
  scene.tweens.add({
    targets: ring, radius: maxR, alpha: 0, duration: dur, ease: 'Cubic.easeOut',
    onUpdate: () => ring.setStrokeStyle(7, color, ring.alpha),
    onComplete: () => ring.destroy()
  });
}

/** Magic bolt: projectile from wand to target, then impact burst. */
export function magicBolt(
  scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number,
  color = 0xf0abfc, onHit?: () => void
): void {
  ensureFxTextures(scene);
  const glow = scene.add.image(x1, y1, 'fx-glow').setTint(color).setScale(1.4).setDepth(89);
  glow.setBlendMode(Phaser.BlendModes.ADD);
  const bolt = scene.add.image(x1, y1, 'fx-star').setTint(color).setScale(1.2).setDepth(90);
  const trail = scene.add.particles(0, 0, 'fx-spark', {
    speed: 30, lifespan: 350, scale: { start: 0.9, end: 0 }, quantity: 2, frequency: 30
  });
  trail.setDepth(89);
  trail.setBlendMode(Phaser.BlendModes.ADD);
  trail.startFollow(bolt);
  scene.tweens.add({
    targets: [bolt, glow], x: x2, y: y2, duration: 320, ease: 'Quad.easeIn',
    onUpdate: () => glow.setPosition(bolt.x, bolt.y),
    onComplete: () => {
      trail.stop(); trail.destroy(); bolt.destroy(); glow.destroy();
      burst(scene, x2, y2, { colors: [color, 0xffffff], count: 16 });
      ringPulse(scene, x2, y2, color, 70);
      onHit?.();
    }
  });
}

/** Horizontal rainbow sweep (bridge transformation, restoration). */
export function rainbowSweep(scene: Phaser.Scene, x: number, y: number, w: number): void {
  const colors = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x3b82f6, 0xa855f7];
  colors.forEach((c, i) => {
    const band = scene.add.rectangle(x - w / 2, y, 26, 300, c, 0.85).setDepth(88);
    scene.tweens.add({
      targets: band, x: x + w / 2, duration: 700, delay: i * 70, ease: 'Cubic.easeOut',
      onComplete: () => {
        scene.tweens.add({ targets: band, alpha: 0, duration: 350, onComplete: () => band.destroy() });
      }
    });
  });
}

/** Celebration fanfare: rising stars + rays + glow pop. */
export function fanfareRays(scene: Phaser.Scene, x: number, y: number, big = true): void {
  ensureFxTextures(scene);
  const glow = scene.add.image(x, y, 'fx-glow').setScale(0.5).setDepth(88).setTint(0xfef08a);
  glow.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: glow, scale: 4, alpha: 0, duration: 800, onComplete: () => glow.destroy() });
  const rays = 8;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const ray = scene.add.rectangle(x, y, 10, big ? 150 : 100, 0xfef08a, 0.55)
      .setOrigin(0.5, 1).setRotation(a).setDepth(87);
    scene.tweens.add({
      targets: ray, alpha: 0, scaleY: 0.3, duration: 700, delay: i * 40,
      onComplete: () => ray.destroy()
    });
  }
  const e = scene.add.particles(x, y, 'fx-star', {
    speed: { min: 120, max: 320 }, lifespan: 1100, scale: { start: 1.1, end: 0 },
    quantity: big ? 26 : 14, emitting: false, gravityY: 60
  });
  e.setDepth(90);
  e.setBlendMode(Phaser.BlendModes.ADD);
  e.setParticleTint([0xfacc15, 0xf472b6, 0x7dd3fc, 0xffffff]);
  e.explode(big ? 26 : 14, x, y);
  scene.time.delayedCall(1300, () => e.destroy());
}

/** Vertical magic beam (gate climax, portal). */
export function gateBeam(scene: Phaser.Scene, x: number, yBottom: number, height: number, color = 0xc4b5fd): Phaser.GameObjects.Rectangle {
  const beam = scene.add.rectangle(x, yBottom - height / 2, 54, height, color, 0.75).setDepth(86);
  const core = scene.add.rectangle(x, yBottom - height / 2, 20, height, 0xffffff, 0.9).setDepth(87);
  scene.tweens.add({ targets: [beam], alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: beam, scaleX: 1.5, duration: 900, yoyo: true, repeat: -1 });
  beam.setData('core', core);
  return beam;
}

export function killBeam(scene: Phaser.Scene, beam: Phaser.GameObjects.Rectangle): void {
  const core = beam.getData('core') as Phaser.GameObjects.Rectangle | undefined;
  scene.tweens.add({
    targets: beam, alpha: 0, scaleX: 2.2, duration: 450,
    onComplete: () => { beam.destroy(); core?.destroy(); }
  });
}

/** Floating hearts fountain (unicorn rescue, healing). */
export function hearts(scene: Phaser.Scene, x: number, y: number, count = 12): void {
  ensureFxTextures(scene);
  const e = scene.add.particles(x, y, 'fx-heart', {
    speed: { min: 60, max: 180 }, angle: { min: 230, max: 310 },
    lifespan: 1300, scale: { start: 1, end: 0.2 }, quantity: count, emitting: false, gravityY: -60
  });
  e.setDepth(90);
  e.setBlendMode(Phaser.BlendModes.ADD);
  e.explode(count, x, y);
  scene.time.delayedCall(1500, () => e.destroy());
}

/** Rising dust poofs (building, landing, cage smash). */
export function poofs(scene: Phaser.Scene, x: number, y: number, count = 10, color = 0xd6a87c): void {
  ensureFxTextures(scene);
  const e = scene.add.particles(x, y, 'fx-poof', {
    speed: { min: 60, max: 200 }, lifespan: 700, scale: { start: 0.8, end: 0 },
    quantity: count, emitting: false, gravityY: -40
  });
  e.setDepth(89);
  e.setParticleTint(color);
  e.explode(count, x, y);
  scene.time.delayedCall(900, () => e.destroy());
}

/** Ambient floating dust motes for cosy/magical interiors. */
export function dustMotes(scene: Phaser.Scene, x: number, y: number, w: number, h: number, tint = 0xffe9a8): void {
  ensureFxTextures(scene);
  const e = scene.add.particles(x, y, 'fx-spark', {
    x: { min: x - w / 2, max: x + w / 2 },
    y: { min: y - h / 2, max: y + h / 2 },
    speedY: { min: -14, max: -4 }, speedX: { min: -8, max: 8 },
    lifespan: 3200, scale: { min: 0.25, max: 0.6 }, alpha: { min: 0.25, max: 0.7 },
    quantity: 1, frequency: 420
  });
  e.setDepth(5);
  e.setBlendMode(Phaser.BlendModes.ADD);
  e.setParticleTint(tint);
}

/** True radial-gradient light textures via CanvasTexture (WebGL-tinted).
 *  Graphics.fillGradientStyle is linear-only, so glows need the canvas API. */
export function ensureLightTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('tex-glow-soft')) return;
  const make = (
    key: string, w: number, h: number,
    paint: (ctx: CanvasRenderingContext2D) => void
  ): void => {
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, w, h);
    paint(ctx);
    tex.refresh();
  };
  // soft white radial glow (tintable to any light colour)
  make('tex-glow-soft', 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  // dark contact shadow blob
  make('tex-shadow', 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, 'rgba(10,5,20,0.55)');
    g.addColorStop(0.7, 'rgba(10,5,20,0.28)');
    g.addColorStop(1, 'rgba(10,5,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  // vertical light shaft, bright top fading down
  make('tex-shaft', 64, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
  });
}

export interface GlowOpts {
  scale?: number;
  color?: number;
  alpha?: number;
  depth?: number;
}

/** Additive light glow sprite (WebGL bloom-style overlay). */
export function addGlow(
  scene: Phaser.Scene, x: number, y: number, opts: GlowOpts = {}
): Phaser.GameObjects.Image {
  ensureLightTextures(scene);
  const img = scene.add.image(x, y, 'tex-glow-soft');
  img.setBlendMode(Phaser.BlendModes.ADD);
  img.setScale(opts.scale ?? 2);
  if (opts.color !== undefined) img.setTint(opts.color);
  img.setAlpha(opts.alpha ?? 0.55);
  img.setDepth(opts.depth ?? 40);
  return img;
}

/** Soft contact shadow blob. Caller repositions it each frame near its target. */
export function addShadow(
  scene: Phaser.Scene, x: number, y: number, w = 110, alpha = 0.5
): Phaser.GameObjects.Image {
  ensureLightTextures(scene);
  const img = scene.add.image(x, y, 'tex-shadow');
  img.setDisplaySize(w, w * 0.36);
  img.setAlpha(alpha);
  img.setDepth(-1);
  return img;
}

/** Slanted light shaft (windows, portal beams, gate light). */
export function addShaft(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  color = 0xfff2c4, alpha = 0.5, angle = 0, depth = 6
): Phaser.GameObjects.Image {
  ensureLightTextures(scene);
  const img = scene.add.image(x, y, 'tex-shaft');
  img.setDisplaySize(w, h);
  img.setBlendMode(Phaser.BlendModes.ADD);
  img.setTint(color);
  img.setAlpha(alpha);
  img.setAngle(angle);
  img.setDepth(depth);
  return img;
}

/** Fullscreen mood darkness (scroll-fixed). Glows/lights sit above it. */
export function addRoomDarkness(
  scene: Phaser.Scene, color = 0x0b1026, alpha = 0.24, depth = 45
): Phaser.GameObjects.Rectangle {
  const W = scene.scale.width, H = scene.scale.height;
  return scene.add.rectangle(W / 2, H / 2, W, H, color, alpha)
    .setScrollFactor(0)
    .setDepth(depth);
}

/** World-space prompt pill near the action (icon dot + short text). */
export interface PromptOpts {
  bg?: number;
  fg?: string;
  iconColor?: number;
  fontSize?: string;
  pulse?: boolean;
}

export function makePrompt(
  scene: Phaser.Scene, x: number, y: number, text: string, opts: PromptOpts = {}
): Phaser.GameObjects.Container {
  const fs = opts.fontSize ?? '21px';
  const label = scene.add.text(0, 0, text, { fontSize: fs, color: opts.fg ?? '#fff', fontStyle: 'bold' }).setOrigin(0, 0.5);
  const w = Math.max(110, label.width + 66);
  const h = 50;
  const g = scene.add.graphics();
  g.fillStyle(opts.bg ?? 0x1f2937, 0.9);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
  g.lineStyle(3, 0xffffff, 0.95);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
  const dot = scene.add.circle(-w / 2 + 26, 0, 12, opts.iconColor ?? 0xfacc15).setStrokeStyle(3, 0xffffff);
  label.setX(-w / 2 + 46);
  const root = scene.add.container(x, y, [g, dot, label]).setDepth(95);
  if (opts.pulse !== false) {
    scene.tweens.add({ targets: root, scale: 1.08, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  return root;
}
