// Builds game-ready raster assets from the reference sheets in assets-source/.
//   - Treehouse: full-bleed room art copied verbatim (no procedural redraw).
//   - Heroes: pose regions cropped, cream backdrop keyed out via edge flood
//     fill (enclosed whites like eyes are never touched), alpha-trimmed,
//     bottom-anchored onto 256px frames, assembled into strip PNGs.
// Run: node scripts/make-assets.mjs   (idempotent; rewrites public/assets)
import sharp from 'sharp';
import { mkdirSync, copyFileSync, rmSync } from 'node:fs';

const SRC = 'assets-source';
const OUT_HERO = 'public/assets/heroes';
mkdirSync(OUT_HERO, { recursive: true });
mkdirSync('public/assets/treehouse', { recursive: true });
mkdirSync('public/assets/pets', { recursive: true });

// pose regions as fractions [x0, y0, x1, y1] of the sheet (generous; key+trim cleans up)
const JACKSON = {
  idle: [0.04, 0.11, 0.30, 0.445],
  walk: [0.73, 0.11, 1.0, 0.455],
  action: [0.01, 0.545, 0.36, 0.878],
  celebrate: [0.365, 0.55, 0.688, 0.878],
};
const LAYLA = {
  idle: [0.0, 0.105, 0.32, 0.47],
  walk: [0.0, 0.56, 0.33, 0.878],
  action: [0.355, 0.50, 0.68, 0.878],
  celebrate: [0.695, 0.56, 1.0, 0.878],
};

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function keyedPose(sheetPath, box, outPath) {
  const meta = await sharp(sheetPath).metadata();
  const W = meta.width, H = meta.height;
  const left = Math.floor(box[0] * W), top = Math.floor(box[1] * H);
  const w = Math.ceil((box[2] - box[0]) * W), h = Math.ceil((box[3] - box[1]) * H);
  const { data, info } = await sharp(sheetPath)
    .extract({ left, top, width: w, height: h })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const pw = info.width, ph = info.height, ch = info.channels;
  const at = (x, y) => (y * pw + x) * ch;
  // background colour = median of border pixels
  const border = [];
  for (let x = 0; x < pw; x += 3) { border.push([px[at(x, 0)], px[at(x, 1)], px[at(x, 2)]]); border.push([px[at(x, ph - 1)], px[at(x, ph - 1) + 1], px[at(x, ph - 1) + 2]]); }
  for (let y = 0; y < ph; y += 3) { border.push([px[at(0, y)], px[at(0, y) + 1], px[at(0, y) + 2]]); border.push([px[at(pw - 1, y)], px[at(pw - 1, y) + 1], px[at(pw - 1, y) + 2]]); }
  const med = [0, 1, 2].map((c) => border.map((p) => p[c]).sort((a, b) => a - b)[border.length >> 1]);
  const TOL = 34;
  // flood fill from all border pixels through bg-coloured area
  const seen = new Uint8Array(pw * ph);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= pw || y >= ph || seen[y * pw + x]) return;
    const o = at(x, y);
    if (dist3([px[o], px[o + 1], px[o + 2]], med) > TOL) return;
    seen[y * pw + x] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < pw; x++) { push(x, 0); push(x, ph - 1); }
  for (let y = 0; y < ph; y++) { push(0, y); push(pw - 1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    const o = at(x, y);
    px[o + 3] = 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  // second pass: kill soft ground-shadow smudge connected to the bottom edge
  // (desaturated + bright + touching bottom; enclosed whites are untouched)
  const seen2 = new Uint8Array(pw * ph);
  const shadowLike = (o) => {
    const r = px[o], g = px[o + 1], b = px[o + 2], a = px[o + 3];
    if (a < 8) return false;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx - mn < 26 && (r + g + b) / 3 > 135;
  };
  const stack2 = [];
  const push2 = (x, y) => {
    if (x < 0 || y < 0 || x >= pw || y >= ph || seen2[y * pw + x] || y < ph * 0.8) return;
    if (!shadowLike(at(x, y))) return;
    seen2[y * pw + x] = 1;
    stack2.push(x, y);
  };
  for (let x = 0; x < pw; x++) push2(x, ph - 1);
  while (stack2.length) {
    const y = stack2.pop(), x = stack2.pop();
    px[at(x, y) + 3] = 0;
    push2(x + 1, y); push2(x - 1, y); push2(x, y + 1); push2(x, y - 1);
  }
  // alpha cleanup + bounding box of remaining pixels
  let x0 = pw, y0 = ph, x1 = -1, y1 = -1;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const o = at(x, y);
      if (px[o + 3] < 100) { px[o + 3] = 0; continue; }
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error(`empty key for ${outPath}`);
  const cw = x1 - x0 + 1, chh = y1 - y0 + 1;
  // place bottom-anchored on a 256 canvas (feet alignment across poses)
  const S = 256, M = 6;
  const scale = Math.min((S - M * 2) / cw, (S - M * 2) / chh, 1.6);
  const dw = Math.max(1, Math.round(cw * scale)), dh = Math.max(1, Math.round(chh * scale));
  const cropped = await sharp(Buffer.from(px.buffer, px.byteOffset, px.byteLength), { raw: { width: pw, height: ph, channels: ch } })
    .extract({ left: x0, top: y0, width: cw, height: chh })
    .resize(dw, dh, { fit: 'fill' })
    .png()
    .toBuffer();
  const dx = Math.round((S - dw) / 2), dy = S - M - dh;
  await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cropped, left: dx, top: dy }])
    .png()
    .toFile(outPath);
  console.log(`ok ${outPath} (${dw}x${dh} @${dx},${dy})`);
}

async function strip(frames, outPath) {
  // horizontal strip of 256px frames (feeds spritesheet loader directly)
  const S = 256;
  const base = sharp({ create: { width: S * frames.length, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const composites = frames.map((input, i) => ({ input, left: i * S, top: 0 }));
  await base.composite(composites).png().toFile(outPath);
  console.log(`ok ${outPath} (${frames.length} frames)`);
}

const tmp = [];
async function pose(sheet, box, tmpName) {
  const p = `assets-source/tmp-${tmpName}.png`;
  await keyedPose(sheet, box, p);
  tmp.push(p);
  return p;
}

const JS = `${SRC}/jackson-sheet.png`;
const LS = `${SRC}/layla-sheet.png`;
const jIdle = await pose(JS, JACKSON.idle, 'j-idle');
const jWalk = await pose(JS, JACKSON.walk, 'j-walk');
const jAct = await pose(JS, JACKSON.action, 'j-act');
const jCel = await pose(JS, JACKSON.celebrate, 'j-cel');
await strip([jIdle], `${OUT_HERO}/jackson-idle.png`);
await strip([jWalk, jIdle], `${OUT_HERO}/jackson-walk.png`);
await strip([jAct], `${OUT_HERO}/jackson-action.png`);
await strip([jCel], `${OUT_HERO}/jackson-celebrate.png`);

const lIdle = await pose(LS, LAYLA.idle, 'l-idle');
const lWalk = await pose(LS, LAYLA.walk, 'l-walk');
const lAct = await pose(LS, LAYLA.action, 'l-act');
const lCel = await pose(LS, LAYLA.celebrate, 'l-cel');
await strip([lIdle], `${OUT_HERO}/layla-idle.png`);
await strip([lWalk, lIdle], `${OUT_HERO}/layla-walk.png`);
await strip([lAct], `${OUT_HERO}/layla-action.png`);
await strip([lCel], `${OUT_HERO}/layla-celebrate.png`);

// Treehouse room art: JPEG (opaque photo-like painting compresses 5x vs PNG,
// which keeps it under the service-worker precache limit).
await sharp(`${SRC}/treehouse-ref.png`).jpeg({ quality: 85, mozjpeg: true }).toFile('public/assets/treehouse/bg-room.jpg');
try { rmSync('public/assets/treehouse/bg-room.png', { force: true }); } catch { /* first run */ }
console.log('ok public/assets/treehouse/bg-room.jpg');

// contact sheet for visual QA (one glance: neighbor bleed, clipped feet, label text)
{
  const C = 128;
  const cells = [jIdle, jWalk, jAct, jCel, lIdle, lWalk, lAct, lCel];
  const thumbs = await Promise.all(cells.map((f) => sharp(f).resize(C, C, { fit: 'contain', background: { r: 255, g: 0, b: 255, alpha: 1 } }).png().toBuffer()));
  await sharp({ create: { width: C * 4, height: C * 2, channels: 4, background: { r: 255, g: 0, b: 255, alpha: 1 } } })
    .composite(thumbs.map((input, i) => ({ input, left: (i % 4) * C, top: Math.floor(i / 4) * C })))
    .png()
    .toFile('assets-source/contact-poses.png');
  console.log('ok assets-source/contact-poses.png');
}
