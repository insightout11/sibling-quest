// Network convergence tests (§8 Tests B/C/G) — pure reducer + merge, no browser.
// Run: npm run test:net
import {
  initialShared, applyAction, mergeSnapshot, bridgeCrossable, unicornRescued,
  jellyDefeated, sharedStarsTotal, migrateSnapshot, type SharedState
} from '../src/core/roomState';
import { syncSaveFromShared, prereqsFor, freshDemoKeepingFamily } from '../src/core/progression';
import { defaultSave } from '../src/core/save';
import {
  sanitizeRoomCode,
  roomPaths,
  memberPath,
  presencePath,
  joinRequestPath,
  FAMILY_KEYS,
  splitSharedState,
  joinSlices,
  validateMember,
  validatePresence,
  validateJoinRequest,
  validateNetEventShape,
  isSlotTaken,
  pruneableEvents
} from '../src/core/firebaseRoom';

let pass = 0;
let fail = 0;

function eq(a: unknown, b: unknown, name: string): void {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x === y) { pass++; console.log(`ok   ${name}`); }
  else { fail++; console.log(`FAIL ${name}\n  got  ${x}\n  want ${y}`); }
}

function fresh(): SharedState {
  return initialShared('4821');
}

// --- Test G: duplicate application is a no-op (flags) ---
{
  const s = fresh();
  s.jacksonBlocks = 3;
  const r1 = applyAction(s, { type: 'bridge-built' });
  const before = JSON.stringify(s);
  const r2 = applyAction(s, { type: 'bridge-built' });
  eq(r1, true, 'G: first bridge-built applies');
  eq(r2, false, 'G: duplicate bridge-built rejected');
  eq(JSON.stringify(s), before, 'G: duplicate changes nothing');
}

// --- Test G: absolute hit counts — same event twice is a no-op ---
{
  const s = fresh();
  s.jellyShieldBroken = true;
  applyAction(s, { type: 'hit-jelly', jelly: 'jelly-a', hero: 'jackson', n: 1 });
  const before = JSON.stringify(s);
  const r = applyAction(s, { type: 'hit-jelly', jelly: 'jelly-a', hero: 'jackson', n: 1 });
  eq(r, false, 'G: redelivered hit (same n) rejected');
  eq(JSON.stringify(s), before, 'G: redelivered hit changes nothing');
}

// --- Test B: enchant BEFORE build still completes (either order) ---
{
  const a = fresh(); a.jacksonBlocks = 3;
  applyAction(a, { type: 'bridge-enchanted' }); // Layla first
  eq(bridgeCrossable(a), false, 'B: enchant alone does not open bridge');
  applyAction(a, { type: 'bridge-built' }); // Jackson after
  eq(bridgeCrossable(a), true, 'B: build after enchant completes bridge');

  const b = fresh(); b.jacksonBlocks = 3;
  applyAction(b, { type: 'bridge-built' });
  applyAction(b, { type: 'bridge-enchanted' });
  eq(bridgeCrossable(b), true, 'B: normal order also completes');
  eq(a.bridgeBuilt && a.bridgeEnchanted, b.bridgeBuilt && b.bridgeEnchanted, 'B: both orders converge');
}

// --- Test C: simultaneous ops converge regardless of delivery order ---
{
  const mk = (): SharedState => { const s = fresh(); s.jacksonBlocks = 3; s.rev = 1; return s; };
  const order1 = mk();
  applyAction(order1, { type: 'mine', idx: 0 });
  applyAction(order1, { type: 'bridge-built' });
  applyAction(order1, { type: 'shield-break' });
  applyAction(order1, { type: 'bridge-enchanted' });

  const order2 = mk();
  applyAction(order2, { type: 'shield-break' });
  applyAction(order2, { type: 'bridge-enchanted' });
  applyAction(order2, { type: 'mine', idx: 0 });
  applyAction(order2, { type: 'bridge-built' });

  const pick = (s: SharedState): unknown => ({
    b: [s.bridgeBuilt, s.bridgeEnchanted], sh: s.jellyShieldBroken,
    m: s.crystalsMined, x: bridgeCrossable(s)
  });
  eq(pick(order1), pick(order2), 'C: delivery order does not matter');
}

// --- Cross-client jelly hits sum to defeat ---
{
  const s = fresh();
  s.jellyShieldBroken = true;
  applyAction(s, { type: 'hit-jelly', jelly: 'jelly-a', hero: 'jackson', n: 1 });
  applyAction(s, { type: 'hit-jelly', jelly: 'jelly-a', hero: 'jackson', n: 2 });
  eq(jellyDefeated(s, 'jelly-a'), false, 'jelly: 2 hits not enough');
  applyAction(s, { type: 'hit-jelly', jelly: 'jelly-a', hero: 'jackson', n: 3 });
  eq(jellyDefeated(s, 'jelly-a'), true, 'jelly: 3 hits defeat');
  // shielded jelly immune until shield broken
  const t = fresh();
  const r = applyAction(t, { type: 'hit-jelly', jelly: 'jelly-shield', hero: 'jackson', n: 1 });
  eq(r, false, 'jelly: shield blocks damage (jellyDamageAllowed=false)');
}

// --- Stale snapshot can never regress progress (merge, Tests D/E/F) ---
{
  const progress = fresh();
  progress.rev = 10;
  progress.jacksonBlocks = 3;
  applyAction(progress, { type: 'bridge-built' });
  applyAction(progress, { type: 'bridge-enchanted' });
  applyAction(progress, { type: 'shield-break' });
  applyAction(progress, { type: 'cage-hit' });
  applyAction(progress, { type: 'cage-hit' });
  applyAction(progress, { type: 'cage-hit' });
  applyAction(progress, { type: 'unicorn-calm' });
  applyAction(progress, { type: 'stage-done', stage: 5 });

  const stale = fresh(); // rev 0, nothing done (e.g. reconnecting tablet cache)
  stale.rev = 2;
  const merged = mergeSnapshot(stale, progress);
  eq(bridgeCrossable(merged), true, 'merge: bridge survives resync');
  eq(unicornRescued(merged), true, 'merge: unicorn survives resync');
  eq(merged.stageId, 5, 'merge: stage survives resync');

  const merged2 = mergeSnapshot(progress, stale); // reversed args — same result
  eq(bridgeCrossable(merged2), true, 'merge: symmetric — stale never wins');
  eq(merged2.stageId, 5, 'merge: stage symmetric');
}

// --- Guards: no build without blocks, no star without stairs, no calm in cage ---
{
  const s = fresh();
  eq(applyAction(s, { type: 'bridge-built' }), false, 'guard: build needs 3 blocks');
  eq(applyAction(s, { type: 'star-taken' }), false, 'guard: star needs stairs');
  eq(applyAction(s, { type: 'unicorn-calm' }), false, 'guard: calm needs open cage');
  applyAction(s, { type: 'stairs-built' });
  eq(applyAction(s, { type: 'star-taken' }), true, 'star: works after stairs');
}

// --- Stage + crown max-wins ---
{
  const s = fresh();
  applyAction(s, { type: 'stage-done', stage: 3 });
  eq(applyAction(s, { type: 'stage-done', stage: 2 }), false, 'stage: older stage rejected');
  eq(s.stageId, 3, 'stage: keeps max');
  applyAction(s, { type: 'crown', crownId: 'candy-1' });
  eq(applyAction(s, { type: 'crown', crownId: 'candy-1' }), false, 'crown: duplicate rejected');
}

// --- Shared star ledger: one-time, convergent, sums across tablets ---
{
  const a = fresh();
  eq(applyAction(a, { type: 'reward', id: 'mine-0', stars: 2 }), true, 'reward: first grant applies');
  eq(applyAction(a, { type: 'reward', id: 'mine-0', stars: 2 }), false, 'reward: duplicate rejected');
  eq(sharedStarsTotal(a), 2, 'reward: total counts once');
  const b = fresh();
  applyAction(b, { type: 'reward', id: 'jelly-a', stars: 3 });
  const m = mergeSnapshot(a, b);
  eq(sharedStarsTotal(m), 5, 'reward: merge sums distinct achievements');
  eq(m.claimed.length, 2, 'reward: claimed unions');
  const m2 = mergeSnapshot(m, a); // re-merge same data — stable
  eq(sharedStarsTotal(m2), 5, 'reward: merge idempotent');
}

// --- Shared pets/trophies/decorations/missions converge, never regress ---
{
  const a = fresh();
  applyAction(a, { type: 'cage-hit' }); applyAction(a, { type: 'cage-hit' }); applyAction(a, { type: 'cage-hit' });
  applyAction(a, { type: 'unicorn-calm' });
  eq(a.pets, ['candy-unicorn'], 'pets: calm bundles unicorn');
  eq(a.trophies, ['unicorn-friend'], 'trophies: calm bundles trophy');
  const b = fresh();
  applyAction(b, { type: 'mission-done', id: 'grey-kingdom' });
  const m = mergeSnapshot(a, b);
  eq(m.pets, ['candy-unicorn'], 'pets: survive merge');
  eq(m.completedMissions, ['grey-kingdom'], 'missions: union');
  const back = mergeSnapshot(m, fresh());
  eq(back.pets, ['candy-unicorn'], 'pets: empty snapshot cannot wipe');
}

// --- Restoration only grows ---
{
  const s = fresh();
  applyAction(s, { type: 'stage-done', stage: 2 });
  eq(s.restoration, 28, 'restoration: derived from stage');
  const m = mergeSnapshot(s, fresh());
  eq(m.restoration, 28, 'restoration: never regresses');
}

// --- Old snapshots migrate without wiping ---
{
  const old = fresh() as unknown as Record<string, unknown>;
  delete old['pets']; delete old['starLedger']; delete old['claimed'];
  const migrated = migrateSnapshot(old as unknown as SharedState);
  eq(migrated.pets, [], 'migrate: pets default');
  eq(migrated.starLedger, {}, 'migrate: ledger default');
  eq(sharedStarsTotal(migrated), 0, 'migrate: total safe');
}

// --- Family save sync: shared in, player-specific untouched ---
{
  const save = defaultSave();
  save.jacksonGear.weapon = 'super-pick';
  const s = fresh();
  s.jacksonBlocks = 3;
  applyAction(s, { type: 'bridge-built' });
  applyAction(s, { type: 'reward', id: 'mine-0', stars: 2 });
  applyAction(s, { type: 'crown', crownId: 'candy-1' });
  applyAction(s, { type: 'mission-done', id: 'grey-kingdom' });
  const changed = syncSaveFromShared(save, s);
  eq(changed, true, 'save-sync: reports change');
  eq(save.collections.stars, 2, 'save-sync: stars mirrored');
  eq(save.collections.crownPieces, ['candy-1'], 'save-sync: crowns mirrored');
  eq(save.completedMissions, ['grey-kingdom'], 'save-sync: missions mirrored');
  eq(save.jacksonGear.weapon, 'super-pick', 'save-sync: player gear untouched');
  eq(syncSaveFromShared(save, s), false, 'save-sync: second sync is no-op');
}

// --- Parent tools: prereqs + demo reset keep family ---
{
  const pre = prereqsFor(7, '4821');
  eq(pre.stageId, 7, 'prereqs: stage set');
  eq(bridgeCrossable(pre), true, 'prereqs: bridge ready');
  eq(pre.unicornCalmed, true, 'prereqs: unicorn ready');
  eq(pre.pets, ['candy-unicorn'], 'prereqs: pets included');
  const reset = freshDemoKeepingFamily('4821', pre);
  eq(reset.stageId, 0, 'reset: mission flags cleared');
  eq(reset.pets, ['candy-unicorn'], 'reset: family pets kept');
  eq(reset.crownPieces, [...pre.crownPieces], 'reset: family crowns kept');
}

// --- Firebase room codes: 4 digits rendezvous, never auth ---
{
  eq(sanitizeRoomCode('4821'), '4821', 'fb: accepts 4-digit code');
  eq(sanitizeRoomCode(' 4821 '), '4821', 'fb: trims whitespace');
  eq(sanitizeRoomCode('482'), null, 'fb: rejects short code');
  eq(sanitizeRoomCode('abcd'), null, 'fb: rejects non-digits');
  eq(sanitizeRoomCode(''), null, 'fb: rejects empty');
  let threw = false;
  try { roomPaths('nope'); } catch { threw = true; }
  eq(threw, true, 'fb: paths reject bad code');
}

// --- Firebase path layout: session and family stored separately ---
{
  const p = roomPaths('4821');
  eq(p.session, 'rooms/4821/session', 'fb: session path');
  eq(p.family, 'rooms/4821/family', 'fb: family path');
  eq(p.events, 'rooms/4821/events', 'fb: events path');
  eq(p.members, 'rooms/4821/members', 'fb: members path');
  eq(p.presence, 'rooms/4821/presence', 'fb: presence path');
  eq(p.joinRequests, 'rooms/4821/joinRequests', 'fb: join-request path');
  eq(memberPath('4821', 'uid-1'), 'rooms/4821/members/uid-1', 'fb: member path');
  eq(presencePath('4821', 'uid-1'), 'rooms/4821/presence/uid-1', 'fb: presence path');
  eq(joinRequestPath('4821', 'uid-1'), 'rooms/4821/joinRequests/uid-1', 'fb: request path');
}

// --- Session/family split partitions SharedState exactly ---
{
  const s = fresh();
  const { session, family } = splitSharedState(s);
  const sessionKeys = Object.keys(session).sort();
  const familyKeys = Object.keys(family).sort();
  const overlap = sessionKeys.filter((k) => familyKeys.includes(k));
  eq(overlap, [], 'fb: no key in both slices');
  eq(familyKeys, [...FAMILY_KEYS].sort(), 'fb: family holds exactly the progression keys');
  eq(sessionKeys.length + familyKeys.length, Object.keys(s).length, 'fb: no key lost in split');
  eq('jacksonPos' in session && 'stageId' in session && 'gateCharge' in session, true, 'fb: live state stays in session');
  const rejoined = joinSlices(session, family) as unknown as Record<string, unknown>;
  const orig = s as unknown as Record<string, unknown>;
  eq(Object.keys(rejoined).sort(), Object.keys(orig).sort(), 'fb: split keeps key set');
  eq(
    Object.keys(orig).every((k) => JSON.stringify(rejoined[k]) === JSON.stringify(orig[k])),
    true,
    'fb: split round-trips values'
  );
}

// --- Validators mirror database.rules.json ---
{
  eq(validateMember({ hero: 'jackson', at: 123 }), true, 'fb: valid member accepted');
  eq(validateMember({ hero: 'layla', at: 123 }), true, 'fb: layla member accepted');
  eq(validateMember({ hero: 'bowser', at: 123 }), false, 'fb: bad hero rejected');
  eq(validateMember({ hero: 'jackson' }), false, 'fb: missing at rejected');
  eq(validateMember(null), false, 'fb: null member rejected');
  eq(validatePresence({ hero: 'layla', at: Date.now() }), true, 'fb: valid presence accepted');
  eq(validatePresence({ hero: 'layla', at: 'now' }), false, 'fb: string at rejected');
  eq(validateJoinRequest({ hero: 'jackson', at: 1 }), true, 'fb: valid join request accepted');
  eq(validateJoinRequest({ at: 1 }), false, 'fb: hero-less request rejected');
  eq(validateNetEventShape({ eventId: 'e1', kind: 'mine', hero: 'jackson', timestamp: 5, payload: {} }), true, 'fb: valid event accepted');
  eq(validateNetEventShape({ kind: 'mine', hero: 'jackson', timestamp: 5 }), false, 'fb: event without id rejected');
  eq(validateNetEventShape({ eventId: 'e1', kind: 'mine', hero: 'bowser', timestamp: 5 }), false, 'fb: event with bad hero rejected');
}

// --- Presence occupancy: live peers block, stale rows never do ---
{
  const now = 1_000_000;
  eq(isSlotTaken({}, 'jackson', 'me', now), false, 'fb: empty room is free');
  const live = { other: { hero: 'jackson' as const, at: now - 5_000 } };
  eq(isSlotTaken(live, 'jackson', 'me', now), true, 'fb: live peer blocks slot');
  eq(isSlotTaken(live, 'layla', 'me', now), false, 'fb: other hero unaffected');
  const stale = { ghost: { hero: 'jackson' as const, at: now - 900_000 } };
  eq(isSlotTaken(stale, 'jackson', 'me', now), false, 'fb: stale ghost never blocks (reinstall-safe)');
  const self = { me: { hero: 'jackson' as const, at: now - 1_000 } };
  eq(isSlotTaken(self, 'jackson', 'me', now), false, 'fb: own row ignored');
}

// --- Event-log pruning keeps the fan-out bounded ---
{
  const now = 5_000_000;
  const log = {
    a: { timestamp: now - 1_000 },
    b: { timestamp: now - 500_000 },
    c: { timestamp: 'soon' },
    d: {}
  };
  eq(pruneableEvents(log, now), ['b', 'c', 'd'], 'fb: old and malformed events pruned');
  eq(pruneableEvents({ a: { timestamp: now } }, now), [], 'fb: fresh events kept');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
