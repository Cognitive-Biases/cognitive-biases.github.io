import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'dist';
const biases = JSON.parse(await readFile('data/biases.json', 'utf8')).filter((bias) => bias.published);
const duplicates = JSON.parse(await readFile('data/duplicate-dispositions.json', 'utf8'));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

let changed = 0;
for (const bias of biases) {
  if (duplicateIds.has(bias.id)) continue;
  const file = join(OUT, 'biases', bias.slug, 'index.html');
  let html;
  try { html = await readFile(file, 'utf8'); } catch { continue; }
  const label = escapeHtml(bias.typeOfBias || 'Bias');
  const plain = `<span aria-current="page">${label}</span>`;
  const linked = `<a href="/explore/#${encodeURIComponent(bias.typeOfBias)}">${label}</a>`;
  if (html.includes(plain)) {
    html = html.replace(plain, linked);
    await writeFile(file, html);
    changed += 1;
  }
}

console.log(`Internal breadcrumbs reconciled with ${changed} stable category anchor link(s); BreadcrumbList remains canonical-page only.`);
