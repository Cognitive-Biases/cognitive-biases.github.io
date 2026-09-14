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

const appPath = join(OUT, 'app.js');
let appSource = await readFile(appPath, 'utf8');
let appChanged = false;
const appScopeMarker = '/* Browser-surface isolated app scope */';
if (!appSource.includes(appScopeMarker)) {
  appSource = `${appScopeMarker}\n(()=>{\n${appSource}\n})();\n`;
  appChanged = true;
}
const searchStatusMarker = '/* Search live-status accessibility */';
if (!appSource.includes(searchStatusMarker)) {
  appSource += `\n${searchStatusMarker}\n(()=>{const copy={en:'Search results updated.',de:'Suchergebnisse aktualisiert.',ru:'Результаты поиска обновлены.',fr:'Résultats de recherche mis à jour.','pt-br':'Resultados da busca atualizados.',es:'Resultados de búsqueda actualizados.',it:'Risultati di ricerca aggiornati.'};const lang=String(document.documentElement.lang||'en').toLowerCase();const message=copy[lang]||copy[lang.split('-')[0]]||copy.en;const hidden='position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';document.querySelectorAll('input[type="search"],input[data-search],[role="searchbox"]').forEach((input,index)=>{if(input.dataset.searchLiveStatusReady)return;input.dataset.searchLiveStatusReady='true';const scope=input.closest('[role="search"]')||input.parentElement||document.body;let status=scope.querySelector('[data-search-live-status]');if(!status){status=document.createElement('span');status.dataset.searchLiveStatus='';status.id='search-live-status-'+index;status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');status.setAttribute('style',hidden);scope.appendChild(status)}if(!input.getAttribute('aria-describedby'))input.setAttribute('aria-describedby',status.id);const announce=()=>{window.setTimeout(()=>{status.textContent='';window.setTimeout(()=>{status.textContent=message},0)},0)};input.addEventListener('input',announce);input.addEventListener('search',announce)})})();\n`;
  appChanged = true;
}
if (appChanged) await writeFile(appPath, appSource, 'utf8');

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

console.log(`Finalized browser surface: app.js injected into ${scriptFixes} pages; shared app scope isolated; search live status enabled; deploy revision ${revision || 'unavailable'}.`);
