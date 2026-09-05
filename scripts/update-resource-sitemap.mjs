import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const researchNotes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
const monthlyDigests = JSON.parse(await readFile("data/monthly-research-digests.json", "utf8"));
const skills = JSON.parse(await readFile("data/skills.json", "utf8"));
const aiJudgeHistory = JSON.parse(await readFile("data/studies/ai-judge-history-v1.json", "utf8"));
const researchTracker = JSON.parse(await readFile("data/ai-era-research-tracker.json", "utf8"));
const validDate = (value = "") => /^\d{4}-\d{2}-\d{2}/.test(String(value)) ? String(value).slice(0, 10) : null;
const latestDigestDate = [...(monthlyDigests.digests || [])].map((digest) => validDate(digest.publishedAt)).filter(Boolean).sort().at(-1) || validDate(monthlyDigests.updatedAt);

const resources = [
  { path: "/research/", lastmod: validDate(researchNotes.updatedAt) },
  { path: "/research/lab/", lastmod: validDate(researchTracker.updatedAt) },
  { path: "/research/digests/", lastmod: validDate(monthlyDigests.updatedAt) },
  { path: "/research/changes/", lastmod: latestDigestDate },
  { path: "/research/ai-judge-history-v1/", lastmod: validDate(aiJudgeHistory.preregisteredAt) },
  { path: "/experiments/ai-judge-history-v1/", lastmod: validDate(aiJudgeHistory.preregisteredAt) },
  { path: "/skills/", lastmod: null },
  { path: "/data/", lastmod: null },
  { path: "/partners/", lastmod: null },
  ...(researchNotes.entries || []).map((note) => ({ path: `/research/${note.slug}/`, lastmod: validDate(note.updatedAt || note.publishedAt) })),
  ...(monthlyDigests.digests || []).map((digest) => ({ path: `/research/digests/${digest.slug}/`, lastmod: validDate(digest.publishedAt || monthlyDigests.updatedAt) })),
  ...(skills.entries || []).map((skill) => ({ path: `/skills/${skill.slug}/`, lastmod: null }))
];

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
for (const resource of resources) {
  const url = `${SITE}${resource.path}`;
  if (sitemap.includes(`<loc>${url}</loc>`)) continue;
  const lastmod = resource.lastmod ? `<lastmod>${resource.lastmod}</lastmod>` : "";
  sitemap = sitemap.replace("</urlset>", `<url><loc>${url}</loc>${lastmod}</url></urlset>`);
}
await writeFile(sitemapPath, sitemap);
console.log(`Added ${resources.length} public resource URLs to sitemap using content dates only when a reliable date exists.`);
