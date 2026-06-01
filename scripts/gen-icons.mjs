// Generate PWA icons from public/icon.svg using sharp.
// Deep-green background with a gold "BC" monogram. Run: node scripts/gen-icons.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const svg = readFileSync(resolve(root, "public/icon.svg"));

const targets = [
  { file: "public/icon-192.png", size: 192 },
  { file: "public/icon-512.png", size: 512 },
  { file: "public/apple-touch-icon.png", size: 180 },
];

for (const { file, size } of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(resolve(root, file));
  console.log(`wrote ${file} (${size}x${size})`);
}
