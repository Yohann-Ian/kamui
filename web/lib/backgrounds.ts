import fs from "node:fs";
import path from "node:path";

// The background photographs the sidebar cycles through: every image in
// web/public/backgrounds (generated from <repo>/images by `npm run backgrounds`).
export function backgroundFiles() {
  try {
    return fs
      .readdirSync(path.join(process.cwd(), "public", "backgrounds"))
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort();
  } catch {
    return [];
  }
}
