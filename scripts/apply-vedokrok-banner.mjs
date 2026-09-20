import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = "dist";
const banner = `<aside class="vedokrok-banner" data-vedokrok-banner><div class="vedokrok-banner__inner"><p class="vedokrok-banner__kicker">Now part of</p><p class="vedokrok-banner__name"><a href="https://vedokrok.com">Vedokrok</a></p><p class="vedokrok-banner__line">This project helps people recognize errors in thinking. Vedokrok goes further: it pairs that awareness with concrete tools for better decisions, learning and action — across many areas of life and work.</p><p class="vedokrok-banner__cta"><a href="https://vedokrok.com">Explore Vedokrok →</a></p></div></aside>`;
const footerLine = `<p class="vedokrok-footer">Now part of <a href="https://vedokrok.com">Vedokrok</a> — a broader practical knowledge system.</p>`;
const bannerCss = String.raw`

/* Vedokrok announcement */
.vedokrok-banner{position:relative;z-index:70;display:block;background:var(--yellow,#ffd900);color:var(--ink,#10103f);border-bottom:2px solid var(--ink,#10103f);padding:1.05rem max(4vw,1rem)}
.vedokrok-banner__inner{max-width:var(--content,1240px);margin-inline:auto;display:flex;flex-wrap:wrap;align-items:center;gap:.4rem 1.4rem}
.vedokrok-banner p{margin:0}
.vedokrok-banner__kicker{font:800 .72rem/1 'DM Sans',sans-serif;text-transform:uppercase;letter-spacing:.14em;color:var(--blue,#1515a8)}
.vedokrok-banner__name{font:900 clamp(1.35rem,2.6vw,2rem)/1 var(--font-display,'Inter Tight','Arial Black',sans-serif);letter-spacing:-.03em}
.vedokrok-banner__name a{color:inherit;text-decoration:none;border-bottom:4px solid var(--pink,#ff2a9b)}
.vedokrok-banner__name a:hover{color:var(--blue,#1515a8);text-decoration:none}
.vedokrok-banner__line{flex:1 1 26rem;max-width:62rem;font-weight:600;font-size:.96rem;line-height:1.45}
.vedokrok-banner__cta{font:800 .85rem/1 'DM Sans',sans-serif;text-transform:uppercase;letter-spacing:.08em}
.vedokrok-banner__cta a{display:inline-flex;align-items:center;min-height:44px;padding:.5rem .85rem;background:var(--ink,#10103f);color:var(--yellow,#ffd900);text-decoration:none;box-shadow:4px 4px 0 var(--blue,#1515a8)}
.vedokrok-banner__cta a:hover{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--blue,#1515a8);text-decoration:none}
.vedokrok-footer{grid-column:1/-1;margin:0;font-size:.86rem;color:#c9caff}
.vedokrok-footer a{color:var(--yellow,#ffd900)}
body[data-page-kind="home"] .site-header--home{position:sticky;inset-block-start:0;z-index:100;background:var(--blue-deep,#09094a);border-bottom:2px solid #ffffff35}
@media(max-width:760px){
  .vedokrok-banner{padding:.9rem 1rem}
  .vedokrok-banner__inner{display:grid;gap:.35rem}
  .vedokrok-banner__line{font-size:.92rem}
  .vedokrok-banner__cta a{width:100%;justify-content:center}
  body[data-page-kind="home"] .site-header--home{position:relative;background:var(--blue-deep,#09094a)}
}
`;

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(target);
  }
  return files;
}

let pages = 0;
let bannersAdded = 0;
let footersAdded = 0;
const noTarget = [];
for (const file of await walk(OUT)) {
  let html = await readFile(file, "utf8");
  const before = html;
  pages += 1;
  if (!html.includes("data-vedokrok-banner")) {
    if (/<header[\s>]/.test(html)) html = html.replace(/<header/, () => `${banner}<header`);
    else if (/<body(?:\s[^>]*)?>/.test(html)) html = html.replace(/<body(?:\s[^>]*)?>/, (match) => `${match}${banner}`);
    if (html.includes("data-vedokrok-banner")) bannersAdded += 1;
    else noTarget.push(file);
  }
  if (html.includes("</footer>") && !html.includes("vedokrok-footer")) {
    html = html.replace("</footer>", () => `${footerLine}</footer>`);
    footersAdded += 1;
  }
  if (html !== before) await writeFile(file, html);
}

const cssUpdated = [];
for (const name of ["styles.css", "de.css", "fr.css", "es.css", "it.css", "pt-br.css", "ru.css"]) {
  const target = path.join(OUT, name);
  const styles = await readFile(target, "utf8").catch(() => null);
  if (styles === null || styles.includes(".vedokrok-banner{")) continue;
  await writeFile(target, `${styles}${bannerCss}`);
  cssUpdated.push(name);
}

if (noTarget.length) console.warn(`No Vedokrok banner insertion point in ${noTarget.length} page(s): ${noTarget.join(", ")}`);
console.log(`Vedokrok announcement verified on ${pages} pages: ${bannersAdded} banner(s) inserted, ${footersAdded} footer line(s) inserted, CSS appended to ${cssUpdated.length ? cssUpdated.join(", ") : "nothing (already present)"}.`);
