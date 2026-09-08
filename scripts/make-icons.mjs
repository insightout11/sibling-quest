// Generate PWA raster icons from public/icon.svg. Run: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  await sharp('public/icon.svg')
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`wrote public/icons/icon-${size}.png`);
}
