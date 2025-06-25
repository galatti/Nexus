import fs from 'fs';
import path from 'path';

const preloadDir = path.join(process.cwd(), 'dist', 'preload');
const oldPath = path.join(preloadDir, 'preload.js');
const newPath = path.join(preloadDir, 'preload.mjs');

try {
  fs.renameSync(oldPath, newPath);
  console.log(`[✓] Renamed ${oldPath} to ${newPath}`);
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('ℹ️ preload.js not found - skipping rename');
  } else {
    console.error(`❌ Error renaming file: ${err.message}`);
    process.exit(1);
  }
}