// Boot: session UI (§5–§6) -> transport (§1) -> Phaser scenes (§41 slice).
// Production uses Firebase RTDB when env credentials exist, else LocalTransport.
// All mission-critical convergence flows through ctx.emit (monotonic reducer).
import './style.css';
import Phaser from 'phaser';
import { loadSave, storeSave, type HeroId, type SharedSave } from './core/save';
import {
  createTransport, type SharedState, type Transport, type ConnStatus, type PresencePeer
} from './core/net';
import { initialShared, mergeSnapshot, applyAction } from './core/roomState';
import { syncSaveFromShared } from './core/progression';
import { playlog } from './core/playlog';
import { myPlayerId } from './core/ids';
import {
  makeRoomCode, rememberHero, rememberRoom, rememberedHero, rememberedRoom,
  canContinue, otherHero, heroDisplayName
} from './core/session';
import { audio } from './core/audioQueue';
import { initDebug } from './core/debug';
import { ctx, actionFor, canonicalPatch, makeWireEvent } from './game/context';
import { TreehouseScene } from './game/TreehouseScene';
import { UndergroundScene } from './game/UndergroundScene';
import { CandyKingdomScene } from './game/CandyKingdomScene';

let save: SharedSave = loadSave();
let hero: HeroId | null = rememberedHero();
let room: string | null = rememberedRoom();
let playerId = myPlayerId();
let transport: Transport | null = null;
let started = false;
let lobbyReady = false;
let amHost = false;

// ---- session UI ----
const ui = document.getElementById('session-ui')!;
const btnCreate = document.getElementById('btn-create')!;
const btnJoin = document.getElementById('btn-join')!;
const btnContinue = document.getElementById('btn-continue') as HTMLButtonElement;
const joinRow = document.getElementById('join-row')!;
const roomInput = document.getElementById('room-input') as HTMLInputElement;
const btnJoinGo = document.getElementById('btn-join-go')!;
const roomDisplay = document.getElementById('room-display')!;
const roomCodeEl = document.getElementById('room-code')!;
const heroRow = document.getElementById('hero-row')!;
const btnJackson = document.getElementById('btn-jackson')!;
const btnLayla = document.getElementById('btn-layla')!;
const btnStart = document.getElementById('btn-start') as HTMLButtonElement;
const netStatus = document.getElementById('net-status')!;
const lobbyStatus = document.getElementById('lobby-status')!;

function lobbySay(t: string): void {
  lobbyStatus.textContent = t;
}

function refresh(): void {
  if (room) {
    roomDisplay.hidden = false;
    roomCodeEl.textContent = room;
    heroRow.hidden = false;
  }
  if (canContinue() && !started) {
    btnContinue.hidden = false;
    btnContinue.textContent = `💛 CONTINUE as ${heroDisplayName(rememberedHero()!)} (${rememberedRoom()})`;
  } else {
    btnContinue.hidden = true;
  }
  if (hero) {
    btnStart.hidden = !(room && lobbyReady);
    btnStart.textContent = `▶ START as ${heroDisplayName(hero)} ▶`;
    btnJackson.style.outline = hero === 'jackson' ? '6px solid #fff' : 'none';
    btnLayla.style.outline = hero === 'layla' ? '6px solid #fff' : 'none';
  }
  if (room && hero && lobbyReady) btnStart.hidden = false;
}

btnCreate.onclick = () => {
  audio.blip(700, 120);
  room = makeRoomCode();
  rememberRoom(room);
  lobbySay(`Tell your sibling: the code is ${room!.split('').join(' ')}!`);
  audio.say('room', `Your adventure code is ${room!.split('').join(' ')}. Tell your sibling!`);
  void enterLobby(true);
};
btnJoin.onclick = () => { joinRow.hidden = false; roomInput.focus(); };
btnJoinGo.onclick = () => {
  const code = roomInput.value.trim();
  if (!/^\d{4}$/.test(code)) { roomInput.style.borderColor = 'red'; return; }
  room = code;
  rememberRoom(room);
  void enterLobby(false);
};
btnContinue.onclick = () => {
  room = rememberedRoom();
  hero = rememberedHero();
  if (room && hero) {
    rememberRoom(room);
    rememberHero(hero);
    void enterLobby(false);
  }
};
btnJackson.onclick = () => { void pickHero('jackson'); };
btnLayla.onclick = () => { void pickHero('layla'); };
btnStart.onclick = () => { if (room && hero) startGame(room, hero); };
refresh();

// ---- lobby: connect transport, claim hero, wait for sibling ----
async function enterLobby(isHost: boolean): Promise<void> {
  if (!room) return;
  amHost = isHost;
  lobbySay('connecting…');
  ensureTransport();
  try {
    await transport!.connect();
  } catch {
    lobbySay('📶 still trying… keep this open!');
    window.setTimeout(() => enterLobby(isHost), 3000);
    return;
  }
  // Adopt the stable authenticated identity (Firebase anon uid) when present.
  playerId = transport!.identityId?.() ?? playerId;
  // default hero for fresh tablets: host → jackson, joiner → layla
  if (!hero) {
    hero = isHost ? 'jackson' : 'layla';
    rememberHero(hero);
  }
  const res = await transport!.claimHero(hero, isHost);
  if (res === 'taken') {
    const other = otherHero(hero);
    lobbySay(`💛 ${heroDisplayName(hero)} is already playing! Are you ${heroDisplayName(other)}?`);
    hero = other;
    rememberHero(hero);
    await transport!.claimHero(hero);
  }
  audio.setHero(hero);
  audio.setHost(amHost);
  lobbySay(`You are ${heroDisplayName(hero)}! Waiting for ${heroDisplayName(otherHero(hero))}…`);
  lobbyReady = true;
  transport!.heartbeat(hero);
  refresh();
}

async function pickHero(h: HeroId): Promise<void> {
  hero = h;
  rememberHero(h);
  audio.setHero(h);
  audio.blip(h === 'jackson' ? 300 : 990, 120);
  if (room && transport) {
    const res = await transport.claimHero(h, amHost);
    if (res === 'taken') {
      lobbySay(`💛 ${heroDisplayName(h)} is already playing on the other tablet — you are ${heroDisplayName(otherHero(h))}!`);
      hero = otherHero(h);
      rememberHero(hero);
      audio.setHero(hero);
      await transport.claimHero(hero, amHost);
    } else {
      lobbySay(`💛 You are ${heroDisplayName(hero)}!`);
    }
  }
  refresh();
}

function ensureTransport(): Transport {
  if (!transport && room) {
    transport = createTransport(room, playerId, hero ?? 'jackson');
    transport.onPresence((peers: PresencePeer[]) => {
      if (!hero || started) return;
      const siblingHere = peers.some((p) => p.hero === otherHero(hero!));
      if (siblingHere) {
        lobbySay('🌈 READY! Your sibling is here — press START!');
        audio.say('lobby-ready', 'Your sibling is here! Press start!', { urgent: true });
      }
      refresh();
    });
  }
  return transport!;
}

// kid-friendly connection strings (§7) — never technical errors
function statusText(s: ConnStatus, other: string): string {
  if (s === 'connected') return '🌈 Together! Have fun!';
  if (s === 'reconnecting') return '📶 reconnecting… keep playing!';
  return `💛 Waiting for ${other}… stay here!`;
}

// ---- game start ----
async function startGame(roomCode: string, heroId: HeroId): Promise<void> {
  if (started) return;
  started = true;
  ui.classList.add('done');
  // Stable story-voice rule: Jackson's tablet speaks shared lines (exactly one host, no echo).
  amHost = heroId === 'jackson';
  audio.setHero(heroId);
  audio.setHost(amHost);

  const t = transport ?? createTransport(roomCode, playerId, heroId);
  transport = t;
  try { await t.connect(); } catch { /* offline-first: scenes still run, resync later */ }
  playerId = t.identityId?.() ?? playerId;
  await t.claimHero(heroId, amHost).catch(() => 'ok' as const);
  playlog.start(roomCode, heroId);

  const shared: SharedState = initialShared(roomCode);

  ctx.current = {
    hero: heroId,
    room: roomCode,
    playerId,
    isHost: amHost,
    transport: t,
    shared,
    save,
    onSave: (s) => { save = s; storeSave(s); },
    seenEvents: new Set<string>(),
    emit: (kind, payload = {}) => {
      const c = ctx.current!;
      // special-case: gate charge computes absolute canonical value
      if (kind === 'gate-charge-layla' || kind === 'gate-charge') {
        const next = Math.min(100, c.shared.gateCharge + (typeof payload['n'] === 'number' ? (payload['n'] as number) : 25));
        const changed = applyAction(c.shared, { type: 'gate-charge', charge: next });
        t.broadcastEvent(makeWireEvent(roomCode, playerId, heroId, 'gate-charge', { charge: next }));
        if (changed) t.broadcastState(canonicalPatch(c.shared));
        return;
      }
      if (kind === 'revive') {
        const who = payload['who'] as HeroId;
        t.broadcastEvent(makeWireEvent(roomCode, playerId, heroId, 'revive', { who }));
        if (who === 'jackson') c.patch({ jacksonHP: 3 });
        else c.patch({ laylaHP: 3 });
        c.addSiblingPower(10);
        return;
      }
      const action = actionFor(kind, payload, heroId);
      if (action) {
        const changed = applyAction(c.shared, action);
        t.broadcastEvent(makeWireEvent(roomCode, playerId, heroId, kind, payload));
        if (changed) {
          persistShared();
          if (action.type === 'stage-done' || action.type === 'crown' || action.type === 'gate-open' ||
              action.type === 'unicorn-calm' || action.type === 'mission-done' || action.type === 'reward') {
            t.snapshotNow(c.shared);
          } else {
            t.broadcastState(canonicalPatch(c.shared));
          }
        }
        return;
      }
      // local-only kinds (portal-hold, freeze, hit anims): broadcast, no canonical change
      t.broadcastEvent(makeWireEvent(roomCode, playerId, heroId, kind, payload));
    },
    patch: (p) => {
      const c = ctx.current!;
      Object.assign(c.shared, p, { rev: (c.shared.rev ?? 0) + 1 });
      t.broadcastState(p);
    },
    addSiblingPower: (n) => {
      const c = ctx.current!;
      c.shared.siblingPower = Math.min(100, c.shared.siblingPower + n);
      t.broadcastState({ siblingPower: c.shared.siblingPower });
    },
    grantReward: (id, stars) => {
      const c = ctx.current!;
      if (c.shared.claimed.includes(id)) return false;
      if (applyAction(c.shared, { type: 'reward', id, stars })) {
        t.broadcastEvent(makeWireEvent(roomCode, playerId, heroId, 'reward', { id, stars }));
        persistShared();
        t.snapshotNow(c.shared);
        playlog.log('reward', `${id} +${stars}`);
        return true;
      }
      return false;
    },
    advanceStage: () => {
      const c = ctx.current!;
      const next = c.shared.stageId + 1;
      if (applyAction(c.shared, { type: 'stage-done', stage: next })) {
        t.broadcastEvent(makeWireEvent(roomCode, playerId, heroId, 'stage-done', { stage: next }));
        t.broadcastState(canonicalPatch(c.shared));
      }
    },
    chargeGate: (n) => {
      const c = ctx.current!;
      const next = Math.min(100, c.shared.gateCharge + n);
      if (applyAction(c.shared, { type: 'gate-charge', charge: next })) {
        t.broadcastEvent(makeWireEvent(roomCode, playerId, heroId, 'gate-charge', { charge: next }));
        t.broadcastState(canonicalPatch(c.shared));
      }
    },
    burstSibling: () => {
      const c = ctx.current!;
      if (c.shared.siblingPower < 100) return false;
      if (applyAction(c.shared, { type: 'sibling-burst' })) {
        t.broadcastEvent(makeWireEvent(roomCode, playerId, heroId, 'sibling-burst', {}));
        t.broadcastState(canonicalPatch(c.shared));
        return true;
      }
      return false;
    }
  };

  // ---- canonical resync (§4): merge snapshot into ctx BEFORE scene handlers ----
  // Mirror canonical shared progression into the local family save (§playtest-1/2).
  const persistShared = (): void => {
    const c = ctx.current;
    if (!c) return;
    if (syncSaveFromShared(save, c.shared)) {
      save = { ...save };
      storeSave(save);
      c.save = save;
    }
  };

  t.onSnapshot((snap) => {
    const c = ctx.current;
    if (!c) return;
    const merged = mergeSnapshot(c.shared, snap);
    const stageChanged = merged.stageId !== c.shared.stageId;
    Object.assign(c.shared, merged);
    persistShared();
    playlog.log('resync', `snapshot stage=${merged.stageId}`);
    audio.clear(); // never replay a stale queue after resync (§14)
    if (stageChanged) audio.setState(`candy-auto-${merged.stageId}`);
  });
  // live patches also merge monotonically (stale data can't regress)
  t.onState((patch) => {
    const c = ctx.current;
    if (!c) return;
    const merged = mergeSnapshot(c.shared, { ...c.shared, ...patch } as SharedState);
    Object.assign(c.shared, merged);
    persistShared();
  });

  const other = heroDisplayName(otherHero(heroId));
  t.onStatus((s) => { netStatus.textContent = statusText(s, other); });
  t.onPresence((peers) => {
    const siblingHere = peers.some((p) => p.hero === otherHero(heroId));
    netStatus.textContent = siblingHere ? '🌈 Together! Have fun!' : `💛 Waiting for ${other}… stay here!`;
  });
  netStatus.textContent = `💛 Waiting for ${other}… stay here!`;
  t.heartbeat(heroId);
  window.setInterval(() => t.heartbeat(heroId), 8000);

  // reconnect triggers (§4): online / visible / focus → resync, keep scene
  const resync = (why: string): void => {
    audio.clear();
    netStatus.textContent = '📶 reconnecting… keep playing!';
    playlog.log('reconnect', why);
    t.requestResync();
    t.heartbeat(heroId);
  };
  window.addEventListener('online', () => resync('online'));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resync('visible');
  });
  window.addEventListener('focus', () => resync('focus'));
  window.addEventListener('offline', () => { netStatus.textContent = '📶 reconnecting… keep playing!'; });

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    powerPreference: 'high-performance',
    parent: 'game-root',
    backgroundColor: '#1a1033',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight
    },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene: [TreehouseScene, UndergroundScene, CandyKingdomScene],
    render: { antialias: true, roundPixels: false }
  });
  void game;

  initDebug(
    () => save,
    (s) => { save = s; storeSave(s); if (ctx.current) ctx.current.save = s; },
    (m) => { netStatus.textContent = m.slice(0, 120); },
    () => ctx.current
  );

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  // @ts-expect-error - provided by vite-plugin-pwa at build time
  void import('virtual:pwa-register').then((m: { registerSW: (o: unknown) => void }) => {
    try { m.registerSW({ immediate: true }); } catch { /* ignore */ }
  }).catch(() => undefined);
}
