import { access, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const OUT = "dist";
const assets = join(OUT, "assets");
const sourceBrand = join(assets, "biases_icon.png");
const sourceHero = join(assets, "1152.png");
const targetBrand = join(assets, "brand.webp");
const targetHero = join(assets, "hero.webp");

await Promise.all([access(sourceBrand), access(sourceHero)]);

function available(command) {
  const result = spawnSync(command, ["-version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed: ${result.error?.message || result.stderr || `exit ${result.status}`}`);
  }
}

function optimizeWithCwebp() {
  run("cwebp", ["-quiet", "-q", "82", "-resize", "96", "96", sourceBrand, "-o", targetBrand]);
  run("cwebp", ["-quiet", "-q", "80", sourceHero, "-o", targetHero]);
}

function optimizeWithMagick(command) {
  run(command, [sourceBrand, "-auto-orient", "-resize", "96x96>", "-strip", "-quality", "82", targetBrand]);
  run(command, [sourceHero, "-auto-orient", "-strip", "-quality", "80", targetHero]);
}

function optimizeWithFfmpeg() {
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", sourceBrand, "-vf", "scale=96:96:force_original_aspect_ratio=decrease", "-frames:v", "1", "-c:v", "libwebp", "-quality", "82", targetBrand]);
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", sourceHero, "-frames:v", "1", "-c:v", "libwebp", "-quality", "80", targetHero]);
}

if (available("cwebp")) optimizeWithCwebp();
else if (available("magick")) optimizeWithMagick("magick");
else if (available("convert")) optimizeWithMagick("convert");
else if (available("ffmpeg")) optimizeWithFfmpeg();
else throw new Error("Image optimization requires cwebp, ImageMagick or ffmpeg on the build runner.");

const [brandSource, heroSource, brandWebp, heroWebp] = await Promise.all([
  stat(sourceBrand), stat(sourceHero), stat(targetBrand), stat(targetHero)
]);
if (brandWebp.size >= brandSource.size) throw new Error(`brand.webp is not smaller than the PNG source (${brandWebp.size} >= ${brandSource.size})`);
if (heroWebp.size >= heroSource.size) throw new Error(`hero.webp is not smaller than the PNG source (${heroWebp.size} >= ${heroSource.size})`);
console.log(`Optimized images: brand ${brandSource.size} -> ${brandWebp.size} bytes; hero ${heroSource.size} -> ${heroWebp.size} bytes.`);
