import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const out = 'dist';
const css = await readFile('public/reading.css', 'utf8');
const version = createHash('sha256').update(css).digest('hex').slice(0, 12);
await writeFile(join(out, 'reading.css'), css);
const stylesheet = `<link rel="stylesheet" href="/reading.css?v=${version}" data-reading-design>`;

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(file));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(file);
  }
  return files;
}

let pages = 0;
for (const file of await htmlFiles(out)) {
  const source = await readFile(file, 'utf8');
  if (!source.includes('</head>')) continue;
  const route = relative(out, file).replaceAll('\\', '/').replace(/^(?:de|ru|fr|es|it|pt-br)\//, '');
  const isReadingPage = /^(?:biases|biais|sesgos|vieses|bias|bias-cognitivi|contexts|situations|techniques|tecnicas|tecniche|compare|everyday|research|skills|habilidades|competenze)\/[^/]+\//.test(route);
  let next = source.replace(/<link\b[^>]*\bdata-reading-design[^>]*>/g, '');
  next = next.replace('</head>', `${stylesheet}</head>`);
  next = next.replace(/\sdata-reading-page(?:="[^"]*")?/g, '');
  if (isReadingPage) next = next.replace(/<body\b/, '<body data-reading-page');
  if (next !== source) await writeFile(file, next);
  pages += 1;
}
console.log(`Reading design applied after theme/localization styles on ${pages} pages (${version}).`);
