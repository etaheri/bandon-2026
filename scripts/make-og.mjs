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
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#ffffff"/>
      <stop offset="36%" stop-color="#ffe9a8"/>
      <stop offset="50%" stop-color="#e8b54a"/>
      <stop offset="58%" stop-color="#b9842a"/>
      <stop offset="78%" stop-color="#ffe28f"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  <rect x="0" y="0" width="${W}" height="8" fill="#d9b24a"/>
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="#d9b24a"/>

  <image x="${W - 168}" y="44" width="120" height="120" href="data:image/png;base64,${puffin}"/>

  <text x="84" y="116" font-family="'Arial Narrow', Impact, sans-serif" font-size="30" font-weight="700"
        font-style="italic" letter-spacing="7" fill="#d9b24a">BANDON DUNES RESORT &#183; OREGON</text>

  <text x="80" y="266" font-family="Impact, 'Arial Black', sans-serif" font-size="138" font-style="italic"
        font-weight="900" fill="url(#chrome)" stroke="#2a1d05" stroke-width="2">BANDON CUP</text>
  <text x="84" y="350" font-family="Impact, 'Arial Black', sans-serif" font-size="78" font-style="italic"
        font-weight="900" fill="#d9b24a" stroke="#2a1d05" stroke-width="1.5">&#8217;26</text>

  <text x="84" y="470" font-family="Impact, 'Arial Black', sans-serif" font-size="82" font-style="italic" font-weight="900"
        stroke="#04110b" stroke-width="2">
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
