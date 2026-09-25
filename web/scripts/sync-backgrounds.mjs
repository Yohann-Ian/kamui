// Makes web-sized copies of the photographs in <repo>/images for the app's
// background cycler. Originals are huge (8-21 MB); the copies are capped at
// 3840 px wide, enough for a 4K screen, and saved as progressive JPEGs.
// Run from web/: `npm run backgrounds`. Then commit web/public/backgrounds.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SRC = path.resolve(here, "../../images");
const OUT = path.resolve(here, "../public/backgrounds");
const MAX_WIDTH = 3840;

// "tan-grass-blowing-in-the-gentle-breeze-2026-09-22-17-15-23-utc.jpg" -> "tan-grass-blowing-in-the-gentle-breeze.jpg"
const slug = (file) =>
  path
    .parse(file)
    .name.replace(/-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-utc$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

fs.mkdirSync(OUT, { recursive: true });
const sources = fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
const written = new Set();

for (const file of sources) {
  const name = `${slug(file)}.jpg`;
  written.add(name);
  const target = path.join(OUT, name);
  if (fs.existsSync(target) && fs.statSync(target).mtimeMs >= fs.statSync(path.join(SRC, file)).mtimeMs) {
    console.log(`up to date  ${name}`);
    continue;
  }
  await sharp(path.join(SRC, file))
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toFile(target);
  console.log(`wrote       ${name}  ${(fs.statSync(target).size / 1e6).toFixed(1)} MB`);
}

// Drop copies whose original was removed from images/
for (const file of fs.readdirSync(OUT)) {
  if (!written.has(file)) {
    fs.rmSync(path.join(OUT, file));
    console.log(`removed     ${file}`);
  }
}
