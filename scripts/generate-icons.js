/**
 * Icon Generation Script
 *
 * Generates all required icon sizes for the Chrome extension from the original source icon.
 * Source: assets/original-icon.png (kept unchanged)
 * Output: icons/ directory with all required sizes
 *
 * Required sizes for Chrome Extensions (Manifest V3):
 * - 16x16: Toolbar icon (small)
 * - 32x32: Toolbar icon (2x for retina)
 * - 48x48: Extensions management page
 * - 128x128: Chrome Web Store and installation
 *
 * Chrome Web Store promotional images:
 * - 440x280: Small promotional tile
 * - 1400x560: Large promotional tile (marquee)
 * - 920x680: Store listing screenshot size reference
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const SOURCE_ICON = join(projectRoot, 'assets', 'original-icon.png');
const ICONS_DIR = join(projectRoot, 'icons');
const STORE_ASSETS_DIR = join(projectRoot, 'assets', 'store');

// Chrome extension icon sizes (square, required by manifest)
const EXTENSION_ICON_SIZES = [16, 32, 48, 128];

// Chrome Web Store promotional sizes (not used in manifest, but needed for store listing)
const STORE_ICON_SIZE = 128; // Store icon must be 128x128

async function ensureDirectories() {
  await mkdir(ICONS_DIR, { recursive: true });
  await mkdir(STORE_ASSETS_DIR, { recursive: true });
}

async function generateExtensionIcons() {
  console.log('Generating extension icons from:', SOURCE_ICON);
  console.log('Output directory:', ICONS_DIR);

  for (const size of EXTENSION_ICON_SIZES) {
    const outputPath = join(ICONS_DIR, `icon${size}.png`);
    await sharp(SOURCE_ICON)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({
        compressionLevel: 9,
        quality: 100,
      })
      .toFile(outputPath);

    console.log(`  Generated: icon${size}.png (${size}x${size})`);
  }
}

async function generateStoreIcon() {
  // The Chrome Web Store requires a 128x128 icon for the store listing
  // This is the same as our extension icon, but we keep a copy in store assets for clarity
  const outputPath = join(STORE_ASSETS_DIR, 'store-icon-128.png');
  await sharp(SOURCE_ICON)
    .resize(STORE_ICON_SIZE, STORE_ICON_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({
      compressionLevel: 9,
      quality: 100,
    })
    .toFile(outputPath);

  console.log(`  Generated: store-icon-128.png (128x128) for Chrome Web Store`);
}

async function main() {
  try {
    await ensureDirectories();
    console.log('\n=== FolioLM Icon Generator ===\n');

    await generateExtensionIcons();
    console.log('');
    await generateStoreIcon();

    console.log('\n=== Icon generation complete! ===\n');
    console.log('Extension icons are in: icons/');
    console.log('Store assets are in: assets/store/');
    console.log('\nNote: Promotional images (440x280, 1400x560) need to be created');
    console.log('manually with marketing content, not just resized icons.\n');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

main();
