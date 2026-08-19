import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const professional = JSON.parse(await readFile("data/professional-lens-packs.json", "utf8"));
const protocols = JSON.parse(await readFile("data/ai-era-experiment-protocols.json", "utf8"));

const required = [
  join(OUT, "professional", "index.html"),
  join(OUT, "ai-era", "protocol", "index.html"),
  join(OUT, "data", "professional-lens-packs.json"),
  join(OUT, "data", "ai-era-experiment-protocols.json"),
  ...professional.packs.map((pack) => join(OUT, "professional", pack.slug, "index.html"))
];
for (const path of required) await access(path);

const professionalHub = await readFile(join(OUT, "professional", "index.html"), "utf8");
for (const pack of professional.packs) {
  if (!professionalHub.includes(`/professional/${pack.slug}/`)) throw new Error(`Professional hub is missing ${pack.slug}`);
}

const protocolPage = await readFile(join(OUT, "ai-era", "protocol", "index.html"), "utf8");
for (const protocol of protocols.protocols) {
  if (!protocolPage.includes(`id="${protocol.slug}"`)) throw new Error(`AI-era protocol page is missing ${protocol.slug}`);
}

const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
for (const url of [
  "https://cognitive-biases.github.io/professional/",
  "https://cognitive-biases.github.io/ai-era/protocol/",
  ...professional.packs.map((pack) => `https://cognitive-biases.github.io/professional/${pack.slug}/`)
]) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing ${url}`);
}

if (professional.packs.length < 3) throw new Error("Expected at least three professional lens packs.");
if (protocols.protocols.length < 4) throw new Error("Expected at least four AI-era experiment protocols.");
console.log(`Professional layer OK: ${professional.packs.length} packs, ${protocols.protocols.length} protocols.`);
