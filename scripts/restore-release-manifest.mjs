import { copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const release = JSON.parse(await readFile("data/release.json", "utf8"));
const pinned = join("dist", "data", "releases", release.releaseVersion, "manifest.json");
const target = join("dist", "data", "manifest.json");
await copyFile(pinned, target);
console.log(`Restored immutable release manifest ${release.releaseVersion} after dynamic Observatory generation.`);
