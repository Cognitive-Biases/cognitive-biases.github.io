import { access, readFile } from "node:fs/promises";

const required = ["dist/research/index.html","dist/data/index.html","dist/partners/index.html","dist/data/biases.json","dist/data/evidence.json","dist/data/contexts.json","dist/data/comparisons.json","dist/data/research-notes.json","dist/data/manifest.json"];
for (const path of required) await access(path);

const pagesToCheck = ["dist/index.html","dist/about/index.html","dist/how-it-works/index.html","dist/privacy/index.html","dist/terms/index.html","dist/support/index.html"];
const forbidden = ["Educational mobile app + public reference","Get the app","Inside the app","website and mobile app","app and reference library","MobileApplication","SoftwareApplication","play.google.com/store/apps/details?id=cognitivebiases.thinking.psychology","apps.apple.com/us/app/biases-cognitive-biases"];
for (const path of pagesToCheck) {
  const html = await readFile(path, "utf8");
  for (const text of forbidden) if (html.includes(text)) throw new Error(`${path} still contains old app positioning: ${text}`);
}

const sitemap = await readFile("dist/sitemap.xml", "utf8");
for (const path of ["/research/","/data/","/partners/"]) if (!sitemap.includes(`https://cognitive-biases.github.io${path}`)) throw new Error(`Sitemap is missing ${path}`);

const evidence = JSON.parse(await readFile("dist/data/evidence.json", "utf8"));
const seen = new Map();
for (const review of evidence.reviews || []) {
  for (const field of ["qualification","mechanism","practical"]) {
    const value = String(review[field] || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (value.length < 80) continue;
    const previous = seen.get(value);
    if (previous) throw new Error(`Duplicate reviewed prose found in ${previous} and ${review.slug}`);
    seen.set(value, review.slug);
  }
}

const inbox = JSON.parse(await readFile("data/research-inbox.json", "utf8"));
if (!Array.isArray(inbox.items)) throw new Error("Research inbox must contain an items array.");
const allowedStatuses = new Set(["new","reading","proposed","accepted","rejected","archived"]);
for (const item of inbox.items) {
  if (!item.id || !item.title || !item.url || !allowedStatuses.has(item.status)) throw new Error(`Invalid research inbox item: ${item.id || item.title || "unknown"}`);
}

const notes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
const noteSlugs = new Set();
for (const note of notes.entries || []) {
  if (!note.slug || !note.title || !note.summary || !note.publishedAt) throw new Error("Research note is missing required public fields.");
  if (noteSlugs.has(note.slug)) throw new Error(`Duplicate research note slug: ${note.slug}`);
  noteSlugs.add(note.slug);
  await access(`dist/research/${note.slug}/index.html`);
  if (!sitemap.includes(`https://cognitive-biases.github.io/research/${note.slug}/`)) throw new Error(`Sitemap is missing research note ${note.slug}.`);
  if (!Array.isArray(note.sources) || note.sources.length === 0) throw new Error(`${note.slug}: research note needs sources.`);
  for (const source of note.sources) if (!/^https:\/\//.test(source.url || "")) throw new Error(`${note.slug}: source URL must use HTTPS.`);
}

const manifest = JSON.parse(await readFile("dist/data/manifest.json", "utf8"));
if (manifest.counts?.researchNotes !== (notes.entries || []).length) throw new Error("Research note count is missing or incorrect in manifest.");
const homepage = await readFile("dist/index.html", "utf8");
for (const route of ["/research/","/data/"]) if (!homepage.includes(`href="${route}"`)) throw new Error(`Homepage is missing resource route ${route}.`);

console.log(`Resource direction checks passed. ${evidence.reviews?.length || 0} reviewed records and ${(notes.entries || []).length} research notes validated.`);
