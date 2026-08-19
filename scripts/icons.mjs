// Renders the Quest app mark to the PNG sizes a PWA needs.
//   node scripts/icons.mjs   (or: npm run icons)
// Writes public/icons/icon.svg, icon-192.png, icon-512.png, maskable-512.png.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "icons");

const GREEN = "#22A06B";
const GREEN_DARK = "#187A50";
const CREAM = "#FBFAF6";
const GOLD = "#F4B400";

/**
 * A compass rose on the green disc: the quest mark.
 * `inset` shrinks the artwork for the maskable variant so nothing important
 * lands in the 10% the launcher may crop.
 */
function svg({ size = 512, inset = 0, square = false } = {}) {
  const c = size / 2;
  const r = c * (1 - inset);
  const needle = r * 0.62;
  const wide = r * 0.2;
  const bg = square
    ? `<rect width="${size}" height="${size}" fill="${GREEN}"/>`
    : `<circle cx="${c}" cy="${c}" r="${c}" fill="${CREAM}"/>
       <circle cx="${c}" cy="${c}" r="${r}" fill="${GREEN}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <circle cx="${c}" cy="${c}" r="${r * 0.78}" fill="none" stroke="${GREEN_DARK}" stroke-width="${r * 0.07}"/>
  <path d="M ${c} ${c - needle} L ${c + wide} ${c} L ${c} ${c + needle * 0.28} L ${c - wide} ${c} Z" fill="${CREAM}"/>
  <path d="M ${c} ${c + needle} L ${c - wide} ${c} L ${c} ${c - needle * 0.28} L ${c + wide} ${c} Z" fill="${GOLD}"/>
  <circle cx="${c}" cy="${c}" r="${r * 0.09}" fill="${GREEN_DARK}"/>
</svg>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const source = svg({ size: 512 });
  await writeFile(path.join(OUT, "icon.svg"), source, "utf8");

  const jobs = [
    { file: "icon-192.png", markup: svg({ size: 512 }), size: 192 },
    { file: "icon-512.png", markup: svg({ size: 512 }), size: 512 },
    // Maskable: full-bleed green square with the art pulled in from the edges.
    { file: "maskable-512.png", markup: svg({ size: 512, inset: 0.22, square: true }), size: 512 },
  ];

  for (const job of jobs) {
    await sharp(Buffer.from(job.markup))
      .resize(job.size, job.size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, job.file));
    console.log(`wrote public/icons/${job.file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
