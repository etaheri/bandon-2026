// Generates the social share / Open Graph card (public/og.jpg, 1200x630).
// Broadcast-style: dunes photo + dark gradient + chrome wordmark + the matchup.
// Re-run after branding changes:  node scripts/make-og.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";

const W = 1200, H = 630;
const puffin = readFileSync(new URL("../public/logo-puffin.png", import.meta.url)).toString("base64");

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#06140e" stop-opacity="0.50"/>
      <stop offset="42%" stop-color="#06140e" stop-opacity="0.40"/>
      <stop offset="100%" stop-color="#03100a" stop-opacity="0.94"/>
    </linearGradient>
    <!-- Matches the home hero .bc-title chrome gradient exactly (homeCss.ts). -->
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#ffffff"/>
      <stop offset="36%" stop-color="#ffe9a8"/>
      <stop offset="50%" stop-color="#e8b54a"/>
      <stop offset="58%" stop-color="#b9842a"/>
      <stop offset="76%" stop-color="#ffe28f"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <!-- Home title shadow: filter:drop-shadow(0 2px 0 #000c) drop-shadow(0 4px 7px #0008). -->
    <filter id="titleShadow" x="-8%" y="-12%" width="116%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="0"   flood-color="#000" flood-opacity="0.85"/>
      <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  <rect x="0" y="0" width="${W}" height="8" fill="#d9b24a"/>
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="#d9b24a"/>

  <image x="${W - 168}" y="44" width="120" height="120" href="data:image/png;base64,${puffin}"/>

  <text x="84" y="116" font-family="'Arial Narrow', Impact, sans-serif" font-size="30" font-weight="700"
        font-style="italic" letter-spacing="7" fill="#d9b24a">BANDON DUNES RESORT &#183; OREGON</text>

  <!-- Wordmark styled to match the home hero header: chrome fill, tight tracking,
       a thin low-opacity stroke + layered drop-shadows (not a heavy outline). -->
  <text x="80" y="262" font-family="Impact, 'Arial Black', sans-serif" font-size="138" font-style="italic"
        font-weight="900" letter-spacing="-3" fill="url(#chrome)" stroke="#000" stroke-width="1.4"
        stroke-opacity="0.25" paint-order="stroke" filter="url(#titleShadow)">BANDON CUP</text>
  <text x="84" y="340" font-family="Impact, 'Arial Black', sans-serif" font-size="56" font-style="italic"
        font-weight="900" letter-spacing="2" fill="url(#chrome)" stroke="#000" stroke-width="1"
        stroke-opacity="0.25" paint-order="stroke" filter="url(#titleShadow)">&#8212; 2026 &#8212;</text>

  <text x="84" y="462" font-family="Impact, 'Arial Black', sans-serif" font-size="48" font-style="italic" font-weight="900"
        stroke="#04110b" stroke-width="1.6">
    <tspan fill="#F4A300">GORSE</tspan><tspan fill="#cfe0ff" font-size="48" dx="22">vs</tspan><tspan fill="#2E8BFF" dx="22">DRIFTWOOD</tspan>
  </text>

  <text x="86" y="552" font-family="'Arial Narrow', Impact, sans-serif" font-size="33" font-weight="700"
        font-style="italic" letter-spacing="3" fill="#bfe6d4">RYDER-CUP-STYLE &#183; 8 PLAYERS &#183; 6 ROUNDS &#183; JUN 3&#8211;7</text>
</svg>`;

await sharp(new URL("../public/hero-dunes.jpg", import.meta.url).pathname)
  .resize(W, H, { fit: "cover", position: "centre" })
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .jpeg({ quality: 88 })
  .toFile(new URL("../public/og.jpg", import.meta.url).pathname);

console.log("wrote public/og.jpg (1200x630)");
