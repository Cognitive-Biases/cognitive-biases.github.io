import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

const surfaces = [
  { locale: "de", source: "ai/llms.de.txt", target: "dist/de/llms.txt" },
  { locale: "ru", source: "ai/llms.ru.txt", target: "dist/ru/llms.txt" }
];

let published = 0;
for (const surface of surfaces) {
  await access(surface.source);
  const content = await readFile(surface.source, "utf8");
  if (!content.trim() || !content.includes("Cognitive Biases")) {
    throw new Error(`${surface.locale}: localized llms source is empty or invalid.`);
  }
  await mkdir(dirname(surface.target), { recursive: true });
  await copyFile(surface.source, surface.target);
  published += 1;
}

console.log(`Published ${published} partial-human localized llms routing surface(s).`);
