import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const notes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
const escape = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
const header = () => `<header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/tools/decision-audit/">Decision Audit</a><a href="/evidence/">Evidence</a><a href="/research/">Research</a><a href="/data/">Data</a><a href="/about/">About</a></nav></header>`;
const footer = () => `<footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/tools/decision-audit/">Decision Audit</a><a href="/contexts/">Decision contexts</a><a href="/evidence/">Evidence</a><a href="/compare/">Compare</a><a href="/research/">Research</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;

function page(note) {
  const path = `/research/${note.slug}/`;
  const canonical = `${SITE}${path}`;
  const sections = (note.sections || []).map((section) => `<h2>${escape(section.heading)}</h2>${(section.paragraphs || []).map((paragraph) => `<p>${escape(paragraph)}</p>`).join("")}`).join("");
  const sources = (note.sources || []).map((source) => `<li><a href="${escape(source.url)}" rel="external">${escape(source.title)}</a> <span>(${escape(source.year)}, ${escape(source.type)})</span></li>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escape(note.title)} | Cognitive Biases</title><meta name="description" content="${escape(note.summary)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="article"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escape(note.title)}"><meta property="og:description" content="${escape(note.summary)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero"><p class="eyebrow">Research note · ${escape(note.status)}</p><h1>${escape(note.title)}</h1><p class="lede">${escape(note.summary)}</p></section><article class="article">${sections}<h2>Sources we reviewed</h2><ul>${sources}</ul><p><a class="button" href="/research/">Back to Research</a></p></article></main>${footer()}</body></html>`;
}

async function emit(path, content) {
  const target = join(OUT, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

for (const note of notes.entries || []) await emit(`/research/${note.slug}/`, page(note));

const researchPath = join(OUT, "research", "index.html");
let research = await readFile(researchPath, "utf8");
const cards = (notes.entries || []).map((note) => `<article><strong>${escape(note.title)}</strong><p>${escape(note.summary)}</p><p><a href="/research/${escape(note.slug)}/">Read the research note</a></p></article>`).join("");
const block = `<section><h2>Research notes</h2><p>These are short syntheses of sources we have reviewed. We mark preprints and unsettled findings instead of treating recency as certainty.</p><div class="feature-list">${cards}</div></section>`;
research = research.replace("</article></main>", `${block}</article></main>`);
await writeFile(researchPath, research);

await mkdir(join(OUT, "data"), { recursive: true });
await writeFile(join(OUT, "data", "research-notes.json"), `${JSON.stringify(notes, null, 2)}\n`);
const manifestPath = join(OUT, "data", "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.counts = {...(manifest.counts || {}), researchNotes:(notes.entries || []).length};
manifest.files = {...(manifest.files || {}), researchNotes:`${SITE}/data/research-notes.json`};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Generated ${(notes.entries || []).length} public research notes.`);
await import("./check-monthly-research-digests.mjs");
await import("./generate-monthly-research-digests.mjs");
