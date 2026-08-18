import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const OUT = "dist";
export const DATA_OUT = join(OUT, "data");
export const SITE = "https://cognitive-biases.github.io";
export const EVIDENCE_CLASSES = ["established", "supported", "mixed", "contested", "domain-specific", "concept"];
export const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
export const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};
export const hashText = (value) => createHash("sha256").update(value).digest("hex");
export const hashFile = async (path) => hashText(await readFile(path));
export const entriesOf = (value, key = "entries") => Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : [];
export const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
export const slugify = (value = "") => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const normalizeDoi = (value = "") => String(value).trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
export const normalizeUrl = (value = "") => {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return String(value).trim();
  }
};
export const titleOf = (bias) => bias?.title || bias?.name || bias?.label || bias?.slug || "Untitled concept";
export const canonicalBiasUrl = (slug) => `${SITE}/biases/${slug}/`;
export function evidenceClass(review) {
  if (EVIDENCE_CLASSES.includes(review.evidenceClass)) return review.evidenceClass;
  const status = String(review.evidenceStatus || "").toLowerCase();
  const slug = String(review.slug || "").toLowerCase();
  if (/concept|measurement|statistical/.test(status) || /appearance-capability-expectation/.test(slug)) return "concept";
  if (/contested|disputed|challenge/.test(status)) return "contested";
  if (/mixed|conditional|boundary|debated|uncertain|context-sensitive/.test(status)) return "mixed";
  if (/domain|task-specific|narrow/.test(status)) return "domain-specific";
  if (/robust|established|replicated|well-established/.test(status)) return "established";
  return "supported";
}
