import { access, readFile } from "node:fs/promises";

const required = [
  "dist/research/index.html",
  "dist/data/index.html",
  "dist/partners/index.html",
  "dist/data/biases.json",
  "dist/data/evidence.json",
  "dist/data/contexts.json",
  "dist/data/comparisons.json",
  "dist/data/manifest.json"
];

for (const path of required) await access(path);

const pagesToCheck = [
  "dist/index.html",
  "dist/about/index.html",
  "dist/how-it-works/index.html",
  "dist/privacy/index.html",
  "dist/terms/index.html",
  "dist/support/index.html"
];

const forbidden = [
  "Educational mobile app + public reference",
  "Get the app",
  "Inside the app",
  "website and mobile app",
  "app and reference library"
];

for (const path of pagesToCheck) {
  const html = await readFile(path, "utf8");
  for (const text of forbidden) {
    if (html.includes(text)) throw new Error(`${path} still contains old app positioning: ${text}`);
  }
}

const evidence = JSON.parse(await readFile("dist/data/evidence.json", "utf8"));
const seen = new Map();
for (const review of evidence.reviews || []) {
  for (const field of ["qualification", "mechanism", "practical"]) {
    const value = String(review[field] || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (value.length < 80) continue;
    const previous = seen.get(value);
    if (previous) throw new Error(`Duplicate reviewed prose found in ${previous} and ${review.slug}`);
    seen.set(value, review.slug);
  }
}

const inbox = JSON.parse(await readFile("data/research-inbox.json", "utf8"));
if (!Array.isArray(inbox.items)) throw new Error("Research inbox must contain an items array.");

console.log(`Resource direction checks passed. ${evidence.reviews?.length || 0} reviewed records checked for exact repeated prose.`);
