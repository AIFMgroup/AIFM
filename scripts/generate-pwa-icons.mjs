#!/usr/bin/env node
/**
 * Generate PWA icons and splash screens from public/AIFM_logo.png.
 * Run from repo root: node scripts/generate-pwa-icons.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const source = path.join(publicDir, 'AIFM_logo.png');

const ICON_SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

// Apple splash screen dimensions (width x height)
const SPLASH_SIZES = [
  [1125, 2436],
  [1170, 2532],
  [1284, 2778],
];

const THEME_BG = '#f9fafb'; // matches manifest background_color

async function main() {
  if (!fs.existsSync(source)) {
    console.error('Source image not found:', source);
    process.exit(1);
  }

  const iconsDir = path.join(publicDir, 'icons');
  const splashDir = path.join(publicDir, 'splash');
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(splashDir, { recursive: true });

  const image = sharp(source);
  const meta = await image.metadata();
  const width = meta.width || 512;
  const height = meta.height || 512;

  console.log('Generating PWA icons from', source);

  for (const size of ICON_SIZES) {
    const outPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(source)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log('  ', outPath);
  }

  // Favicon (32x32 and 16x16)
  await sharp(source).resize(32, 32).png().toFile(path.join(iconsDir, 'favicon-32x32.png'));
  await sharp(source).resize(16, 16).png().toFile(path.join(iconsDir, 'favicon-16x16.png'));
  console.log('  ', path.join(iconsDir, 'favicon-32x32.png'));
  console.log('  ', path.join(iconsDir, 'favicon-16x16.png'));

  // Create a minimal favicon.ico (16x16 and 32x32 in ICO container)
  const png32 = await sharp(source).resize(32, 32).png().toBuffer();
  const png16 = await sharp(source).resize(16, 16).png().toBuffer();
  const ico = createIcoBuffer(png16, png32);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);
  console.log('  ', path.join(publicDir, 'favicon.ico'));

  console.log('Generating splash screens');

  for (const [w, h] of SPLASH_SIZES) {
    const logoSize = Math.min(w, h) * 0.3;
    const logoBuf = await sharp(source).resize(Math.round(logoSize)).png().toBuffer();
    const splashPath = path.join(splashDir, `splash-${w}x${h}.png`);
    await sharp({
      create: {
        width: w,
        height: h,
        channels: 3,
        background: THEME_BG,
      },
    })
      .composite([{ input: logoBuf, top: Math.round((h - logoSize) / 2), left: Math.round((w - logoSize) / 2) }])
      .png()
      .toFile(splashPath);
    console.log('  ', splashPath);
  }

  console.log('Done.');
}

/**
 * Create a minimal ICO file buffer containing 16x16 and 32x32 PNG images.
 * ICO format: header (6) + directory (16 per image) + image data.
 */
function createIcoBuffer(png16, png32) {
  const numImages = 2;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(numImages, 4);

  const dir16 = Buffer.alloc(16);
  const dir32 = Buffer.alloc(16);
  const offset = 6 + numImages * 16;
  let off = offset;

  dir16.writeUInt8(16, 0);
  dir16.writeUInt8(16, 1);
  dir16.writeUInt8(0, 2);
  dir16.writeUInt8(0, 3);
  dir16.writeUInt16LE(1, 4);
  dir16.writeUInt16LE(32, 6);
  dir16.writeUInt32LE(png16.length, 8);
  dir16.writeUInt32LE(off, 12);
  off += png16.length;

  dir32.writeUInt8(32, 0);
  dir32.writeUInt8(32, 1);
  dir32.writeUInt8(0, 2);
  dir32.writeUInt8(0, 3);
  dir32.writeUInt16LE(1, 4);
  dir32.writeUInt16LE(32, 6);
  dir32.writeUInt32LE(png32.length, 8);
  dir32.writeUInt32LE(off, 12);

  return Buffer.concat([header, dir16, dir32, png16, png32]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
