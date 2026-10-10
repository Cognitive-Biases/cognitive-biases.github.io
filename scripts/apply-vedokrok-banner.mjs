import { renderVedokrokAnnouncement } from './vedokrok-announcement.mjs';
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = "dist";
const banner = renderVedokrokAnnouncement();
const footerLine = `<p class="vedokrok-footer">Now part of <a href="https://vedokrok.com">Vedokrok</a> — a broader practical knowledge system.</p>`;
const bannerCss = String.raw`

/* Vedokrok announcement */
.vedokrok-footer{grid-column:1/-1;margin:0;font-size:.86rem;color:#c9caff}
.vedokrok-footer a{color:var(--yellow,#ffd900)}
body[data-page-kind="home"] .site-header--home{position:sticky;inset-block-start:0;z-index:100;background:var(--blue-deep,#09094a);border-bottom:2px solid #ffffff35}
@media(max-width:760px){
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
  if (styles === null || styles.includes("/* Vedokrok announcement */")) continue;
  await writeFile(target, `${styles}${bannerCss}`);
  cssUpdated.push(name);
}

if (noTarget.length) console.warn(`No Vedokrok banner insertion point in ${noTarget.length} page(s): ${noTarget.join(", ")}`);
console.log(`Vedokrok announcement verified on ${pages} pages: ${bannersAdded} banner(s) inserted, ${footersAdded} footer line(s) inserted, CSS appended to ${cssUpdated.length ? cssUpdated.join(", ") : "nothing (already present)"}.`);
