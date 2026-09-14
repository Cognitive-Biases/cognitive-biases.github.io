import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'dist';

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

let scriptFixes = 0;
for (const file of await htmlFiles(OUT)) {
  const source = await readFile(file, 'utf8');
  if (!source.includes('class="nav-menu"') || /<script[^>]+src=["']\/app\.js["']/.test(source)) continue;
  const next = source.replace('</body>', '<script src="/app.js"></script>\n</body>');
  if (next !== source) {
    await writeFile(file, next, 'utf8');
    scriptFixes += 1;
  }
}

const stylesPath = join(OUT, 'styles.css');
let styles = await readFile(stylesPath, 'utf8');
const marker = '/* Browser-surface overflow hardening */';
if (!styles.includes(marker)) {
  styles += `\n${marker}\npre{max-width:100%;box-sizing:border-box;overflow-x:auto}\ncode{overflow-wrap:anywhere;word-break:break-word}\npre code{overflow-wrap:normal;word-break:normal}\n`;
  await writeFile(stylesPath, styles, 'utf8');
}

let revision = '';
try {
  revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {}
if (revision) await writeFile(join(OUT, 'deploy-revision.txt'), `${revision}\n`, 'utf8');

console.log(`Finalized browser surface: app.js injected into ${scriptFixes} pages; deploy revision ${revision || 'unavailable'}.`);
