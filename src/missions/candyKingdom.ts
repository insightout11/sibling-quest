// Mission engine data (§37) — missions are DATA, not giant components.
// MVP ships candy-kingdom missions 1-2 + co-op set piece; missions 3-5 stubbed.

export type StageType =
  | 'exploration' | 'build_magic_coop' | 'combat_charge'
  | 'reveal_reach' | 'rescue' | 'dual_gate' | 'reward';

export interface MissionStage {
  type: StageType;
  id: string;
  jacksonHint: string;
  laylaHint: string; // Layla hints are icon/voice-led (no reading required)
  laylaIcon: string;
  voice: string;
}

export interface Mission {
  mission: string;
  title: string;
  stages: MissionStage[];
}

export const CANDY_MISSIONS: Mission[] = [
  {
    mission: 'grey-kingdom',
    title: 'Mission 1 — The Grey Kingdom',
    stages: [
      {
        type: 'exploration', id: 'meet-gummy',
        jacksonHint: 'Walk to the scared gummy bear!',
        laylaHint: '✨ Follow the sparkles!',
        laylaIcon: '✨',
        voice: 'The Sour King stole our colours! Please help us!'
      },
      {
        type: 'build_magic_coop', id: 'candy-bridge',
        jacksonHint: '🔨 Collect 3 blocks, then BUILD the bridge!',
        laylaHint: '🌈 Tap the bridge with magic!',
        laylaIcon: '🌈',
        voice: 'Jackson builds. Layla enchants. You need each other!'
      },
      {
        type: 'combat_charge', id: 'jelly-shield',
        jacksonHint: '⚔️ Hit jellies! Layla breaks shields!',
        laylaHint: '💫 Zap the shiny shield!',
        laylaIcon: '💫',
        voice: 'That jelly has a magic shield! Layla, break it!'
      },
      {
        type: 'reward', id: 'crown-1',
        jacksonHint: '🎉 Crown piece found!',
        laylaHint: '🎉',
        laylaIcon: '🎉',
        voice: 'You found the first piece of the Night Rainbow Crown!'
      }
    ]
  },
  {
    mission: 'chocolate-river',
    title: 'Mission 2 — Chocolate River',
    stages: [
      {
        type: 'build_magic_coop', id: 'choco-path',
        jacksonHint: '🔨 Build safe platforms over chocolate!',
        laylaHint: '❄️ Freeze the chocolate!',
        laylaIcon: '❄️',
        voice: 'Freeze the chocolate while Jackson builds!'
      },
      {
        type: 'reveal_reach', id: 'star-ledge',
        jacksonHint: '🔨 Layla sees a star up high — build stairs!',
        laylaHint: '⭐ Tap the star!',
        laylaIcon: '⭐',
        voice: 'Layla found a fairy star! Jackson, build a way up!'
      },
      {
        type: 'rescue', id: 'unicorn',
        jacksonHint: '🔨 Smash the cage! Then Layla calms!',
        laylaHint: '🦄 Pet the unicorn!',
        laylaIcon: '🦄',
        voice: 'A trapped candy unicorn! Break the cage, then be gentle!'
      },
      {
        type: 'dual_gate', id: 'candy-gate',
        jacksonHint: '🔧 Hold the machine! Same time as Layla!',
        laylaHint: '🌈 Hold the rainbow!',
        laylaIcon: '🌈',
        voice: 'Together! Hold at the same time! High five!'
      },
      {
        type: 'reward', id: 'crown-2',
        jacksonHint: '🎉 Second crown piece!',
        laylaHint: '🎉',
        laylaIcon: '🎉',
        voice: 'Sibling Power! The gate is open!'
      }
    ]
  }
  // Missions 3-5 (gummy-forest, cookie-castle, sour-king) unlock after slice is proven fun.
];
