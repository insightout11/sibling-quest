// Asset-based presentation pipeline (Treehouse first).
//
// Contract: finished rooms/characters come from pre-rendered raster PNGs.
// Phaser handles movement, collision, camera, networking, interaction,
// animation playback, particles, lighting overlays, UI, mission logic.
// It must NOT be expected to draw finished art procedurally.
//
// Every consumer here degrades gracefully: if a PNG is absent (404 at load),
// the game falls back to the existing vector builders with ZERO logic change.
// Drop real art into public/assets/... and it is picked up automatically.
//
// Treehouse PNG contract (design canvas 1600x900, cover-fit in scene):
//   public/assets/treehouse/bg-far.png    sky/view outside windows
//   public/assets/treehouse/bg-room.jpg    walls, floor, trunk architecture
//   public/assets/treehouse/bg-mid.png    shelves, furniture, lamps (unlit ok)
//   public/assets/treehouse/bg-fore.png   foreground framing vines/leaves
// Hero sprite sheets (horizontal strips, transparent PNG):
//   public/assets/heroes/jackson-{idle,walk,action,celebrate}.png
//   public/assets/heroes/layla-{idle,walk,action,celebrate}.png
//   (256x256 frames; see HERO_FRAME below)
// Pets:
//   public/assets/pets/candy-unicorn-idle.png (256x256 frames)

import Phaser from 'phaser';

export const TREEHOUSE_DESIGN_W = 1600;
export const TREEHOUSE_DESIGN_H = 900;

export interface BgLayerSpec {
  key: string;
  file: string;
  depth: number;
}

export const TREEHOUSE_LAYERS: BgLayerSpec[] = [
  { key: 'treehouse-far', file: 'assets/treehouse/bg-far.png', depth: -11 },
  { key: 'treehouse-room', file: 'assets/treehouse/bg-room.jpg', depth: -9 },
  { key: 'treehouse-mid', file: 'assets/treehouse/bg-mid.png', depth: -6 },
  { key: 'treehouse-fore', file: 'assets/treehouse/bg-fore.png', depth: 40 },
];

export type ActorState = 'idle' | 'walk' | 'action' | 'celebrate';

export interface ActorStateSpec {
  texture: string;
  file: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  frameRate: number;
}

export interface ActorSpec {
  name: string;
  displayHeight: number;
  /** scale applied to the vector fallback rig (matches previous visuals) */
  fallbackScale: number;
  states: Record<ActorState, ActorStateSpec>;
  fallback: (scene: Phaser.Scene) => Phaser.GameObjects.Container;
}

export const HERO_FRAME = 256;

function heroStates(hero: 'jackson' | 'layla'): Record<ActorState, ActorStateSpec> {
  const mk = (state: ActorState, frames: number, frameRate: number): ActorStateSpec => ({
    texture: `${hero}-${state}`,
    file: `assets/heroes/${hero}-${state}.png`,
    frameWidth: HERO_FRAME,
    frameHeight: HERO_FRAME,
    frames,
    frameRate,
  });
  return {
    idle: mk('idle', 1, 6),
    walk: mk('walk', 2, 8),
    action: mk('action', 1, 6),
    celebrate: mk('celebrate', 1, 6),
  };
}

// Filled in by TreehouseScene (avoids assets.ts -> art.ts import weight here).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RigBuilder = (scene: Phaser.Scene) => Phaser.GameObjects.Container;
const rigBuilders: Record<string, RigBuilder> = {};

export function registerRig(name: string, builder: RigBuilder): void {
  rigBuilders[name] = builder;
}

export function heroSpec(hero: 'jackson' | 'layla'): ActorSpec {
  return {
    name: hero,
    displayHeight: 190, // ≈20–25% of tablet screen height
    fallbackScale: 1.28,
    states: heroStates(hero),
    fallback: (scene) => {
      const b = rigBuilders[hero];
      if (!b) throw new Error(`no fallback rig registered for ${hero}`);
      return b(scene);
    },
  };
}

export function petSpec(pet: 'candy-unicorn'): ActorSpec {
  return {
    name: pet,
    displayHeight: 150,
    fallbackScale: 1,
    states: {
      idle: { texture: `${pet}-idle`, file: `assets/pets/${pet}-idle.png`, frameWidth: 256, frameHeight: 256, frames: 4, frameRate: 6 },
      walk: { texture: `${pet}-idle`, file: `assets/pets/${pet}-idle.png`, frameWidth: 256, frameHeight: 256, frames: 4, frameRate: 6 },
      action: { texture: `${pet}-idle`, file: `assets/pets/${pet}-idle.png`, frameWidth: 256, frameHeight: 256, frames: 4, frameRate: 6 },
      celebrate: { texture: `${pet}-idle`, file: `assets/pets/${pet}-idle.png`, frameWidth: 256, frameHeight: 256, frames: 4, frameRate: 6 },
    },
    fallback: (scene) => {
      const b = rigBuilders[pet];
      if (!b) throw new Error(`no fallback rig registered for ${pet}`);
      return b(scene);
    },
  };
}

/** Queue every Treehouse PNG. Missing files 404, fail soft, fall back. */
export function preloadTreehouseArt(scene: Phaser.Scene): void {
  for (const layer of TREEHOUSE_LAYERS) {
    scene.load.image(layer.key, layer.file);
  }
  const specs = [heroSpec('jackson'), heroSpec('layla'), petSpec('candy-unicorn')];
  const seen = new Set<string>();
  for (const spec of specs) {
    for (const state of Object.keys(spec.states) as ActorState[]) {
      const s = spec.states[state];
      if (seen.has(s.texture)) continue;
      seen.add(s.texture);
      scene.load.spritesheet(s.texture, s.file, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    }
  }
}

export function assetPresent(scene: Phaser.Scene, key: string): boolean {
  try {
    return scene.textures.exists(key);
  } catch {
    return false;
  }
}

/** Cover-fit each present layer to the viewport. Returns true if ANY layer loaded. */
export function buildTreehouseBackdrop(scene: Phaser.Scene, W: number, H: number): boolean {
  let any = false;
  const s = Math.max(W / TREEHOUSE_DESIGN_W, H / TREEHOUSE_DESIGN_H);
  for (const layer of TREEHOUSE_LAYERS) {
    if (!assetPresent(scene, layer.key)) continue;
    scene.add.image(W / 2, H / 2, layer.key).setScale(s).setDepth(layer.depth);
    any = true;
  }
  return any;
}

/**
 * Raster sprite actor with four playback states. Feet at local y=0
 * (matches the old rig convention). Falls back to the vector rig when
 * PNGs are absent; gameplay code treats it as an opaque Container.
 */
export class SpriteActor extends Phaser.GameObjects.Container {
  readonly spec: ActorSpec;
  readonly usingAssets: boolean;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private actorState: ActorState = 'idle';
  private started = false;

  constructor(scene: Phaser.Scene, spec: ActorSpec) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.spec = spec;
    const first = spec.states.idle;
    if (assetPresent(scene, first.texture)) {
      this.usingAssets = true;
      this.sprite = scene.add.sprite(0, 0, first.texture, 0);
      this.sprite.setOrigin(0.5, 1);
      this.sprite.setScale(spec.displayHeight / first.frameHeight);
      this.add(this.sprite);
      for (const st of Object.keys(spec.states) as ActorState[]) {
        const key = `${spec.name}-${st}`;
        if (!scene.anims.exists(key)) {
          const ss = spec.states[st];
          scene.anims.create({
            key,
            frames: scene.anims.generateFrameNumbers(ss.texture, { start: 0, end: ss.frames - 1 }),
            frameRate: ss.frameRate,
            repeat: -1,
          });
        }
      }
      this.play('idle');
    } else {
      this.usingAssets = false;
      const rig = spec.fallback(scene);
      rig.setScale(spec.fallbackScale);
      this.add(rig);
    }
    this.setData('scl', 1);
  }

  /** Play a state (no-op when unchanged or on fallback rig). */
  play(state: ActorState): void {
    if (this.started && state === this.actorState) return;
    this.started = true;
    const changed = state !== this.actorState;
    this.actorState = state;
    if (!changed || !this.sprite) return;
    this.sprite.play(`${this.spec.name}-${state}`, true);
  }

  get current(): ActorState {
    return this.actorState;
  }
}

/** Invisible interactive zone over artwork. Coords are screen fractions. */
export function addHotspot(
  scene: Phaser.Scene,
  W: number, H: number,
  fx: number, fy: number, fw: number, fh: number,
  onTap: () => void
): Phaser.GameObjects.Zone {
  const zone = scene.add.zone(W * fx, H * fy, W * fw, H * fh);
  zone.setInteractive({ useHandCursor: true });
  zone.on('pointerdown', onTap);
  return zone;
}
