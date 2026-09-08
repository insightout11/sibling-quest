// Parent / developer debug menu (§33) + network test tools (§8 Tests G/H).
// Access: hold bottom-left corner 3s, then PIN 2468. Never shown to kids by default.

import { exportSave, importSave, loadSave, storeSave, defaultSave, type SharedSave } from './save';
import { freshDemoKeepingFamily, prereqsFor } from './progression';
import { playlog } from './playlog';
import { snapshotKey, sharedStarsTotal } from './roomState';
import type { GameContext } from '../game/context';

const PIN = '2468';

export function initDebug(
  getSave: () => SharedSave,
  setSave: (s: SharedSave) => void,
  log: (m: string) => void,
  getCtx?: () => GameContext | null
): void {
  const corner = document.getElementById('debug-corner')!;
  const menu = document.getElementById('debug-menu')!;
  let timer = 0;
  const show = () => {
    const pin = prompt('Parent PIN:');
    if (pin !== PIN) return;
    const save = getSave();
    const c = getCtx?.() ?? null;
    menu.hidden = false;
    menu.innerHTML = '';
    const add = (label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = fn;
      menu.appendChild(b);
    };
    add('📋 view save', () => log(exportSave(save).slice(0, 2000)));
    add('📤 export save', () => { void navigator.clipboard?.writeText(exportSave(save)); alert('Save copied!'); });
    add('📥 import save', () => {
      const j = prompt('Paste save JSON:');
      if (j) { try { setSave(importSave(j)); alert('Save imported!'); } catch { alert('Bad save'); } }
    });
    add('⭐ grant crown piece', () => {
      const s = loadSave();
      if (!s.collections.crownPieces.includes('candy-1')) s.collections.crownPieces.push('candy-1');
      storeSave(s); setSave(s); log('granted candy-1');
    });
    add('🧹 reset mission', () => {
      const s = loadSave();
      s.completedMissions = s.completedMissions.filter((m) => !m.startsWith('candy'));
      s.restoration['candy-kingdom'] = 0;
      storeSave(s); setSave(s); location.reload();
    });
    if (c) {
      add('🌐 net state', () => {
        const s = c.shared;
        log(`t=${c.transport.name} stage=${s.stageId} bb=${s.bridgeBuilt} be=${s.bridgeEnchanted} sh=${s.jellyShieldBroken} jd=${s.jelliesDefeated.length} star=${s.starCollected} cage=${s.cageBroken} uni=${s.unicornCalmed} gate=${s.gateOpen} pwr=${Math.round(s.siblingPower)} stars=${sharedStarsTotal(s)}`);
      });
      add('🔁 resync now', () => { c.transport.requestResync(); playlog.log('reconnect', 'manual-debug'); log('resync requested'); });
      add('🐢 latency 0/800ms', () => {
        const cur = (c.transport as unknown as { latencyMs?: number }).latencyMs ?? 0;
        c.transport.setLatencyMs(cur > 0 ? 0 : 800);
        log(cur > 0 ? 'latency OFF' : 'latency 800ms ON (Test H)');
      });
      add('✌ send event twice', () => {
        // Test G: deliberate duplicate — second application must be a no-op
        const ev = { eventId: `dbg-${Date.now()}`, kind: 'freeze', payload: {}, at: Date.now() };
        c.transport.broadcastEvent(ev);
        c.transport.broadcastEvent(ev);
        log('duplicate sent — check single effect');
      });
      add('🏠 restart demo', () => {
        // Demo progress resets; FAMILY save (pets/crowns/stars) is kept.
        const fresh = freshDemoKeepingFamily(c.room, c.shared);
        Object.assign(c.shared, fresh);
        c.transport.snapshotNow(c.shared);
        playlog.log('note', 'parent: restart demo (family kept)');
        log('demo restarted — family progress kept');
      });
      add('⏭ jump to stage', () => {
        const raw = prompt('Stage 0-8?', String(c.shared.stageId));
        const n = Math.max(0, Math.min(8, parseInt(raw ?? '', 10) || 0));
        const pre = prereqsFor(n, c.room);
        // keep live session bits + family progression, take mission flags
        const keepSession = {
          session: c.shared.session, rev: (c.shared.rev ?? 0) + 1,
          jacksonPos: c.shared.jacksonPos, laylaPos: c.shared.laylaPos
        };
        Object.assign(c.shared, pre, keepSession);
        c.transport.snapshotNow(c.shared);
        playlog.log('note', `parent: jump to stage ${n}`);
        log(`jumped to stage ${n}`);
      });
      add('🧹 clear demo only', () => {
        try { localStorage.removeItem(snapshotKey(c.room)); } catch { /* ignore */ }
        const fresh = freshDemoKeepingFamily(c.room, c.shared);
        Object.assign(c.shared, fresh);
        c.transport.snapshotNow(c.shared);
        playlog.log('note', 'parent: clear demo progress (family kept)');
        log('demo progress cleared — family save kept');
      });
      add('👥 free hero slots', () => {
        try { localStorage.removeItem(`sq-claim-${c.room}`); } catch { /* ignore */ }
        playlog.log('note', 'parent: freed local hero slots');
        log('local hero slots freed (re-pick in lobby after reload)');
      });
      add('💾 inspect shared', () => {
        const s = c.shared;
        log(`shared: stage=${s.stageId} pets=${s.pets.join(',') || '—'} crowns=${s.crownPieces.join(',') || '—'} stars=${sharedStarsTotal(s)} rest=${s.restoration} trophies=${s.trophies.join(',') || '—'} missions=${s.completedMissions.join(',') || '—'} deco=${s.decorations.join(',') || '—'}`);
      });
      add('📝 export play log', () => {
        playlog.download();
        log(playlog.summary());
      });
      add('🚪 leave room', () => {
        try { localStorage.removeItem('sq-room'); } catch { /* ignore */ }
        location.reload();
      });
    }
    add('🗑 close', () => { menu.hidden = true; });
  };
  corner.addEventListener('pointerdown', () => {
    timer = window.setTimeout(show, 3000);
  });
  corner.addEventListener('pointerup', () => clearTimeout(timer));
  void defaultSave;
}
