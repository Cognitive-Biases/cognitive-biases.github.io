import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const decode = value => String(value).replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), decode(m[2] ?? m[3] ?? m[4])]));
const clean = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

export function crawlTargets(html, base, canonicalUrls) {
  const targets = new Set();
  for (const match of clean(html).matchAll(/<a\b[^>]*>/gi)) {
    const a = attributes(match[0]);
    if (!a.href || (a.rel ?? '').toLowerCase().split(/\s+/).includes('nofollow')) continue;
    try {
      const target = new URL(a.href, base); target.hash = '';
      // Query variants are not silently counted as direct canonical links.
      if (target.href !== base && canonicalUrls.has(target.href)) targets.add(target.href);
    } catch {}
  }
  return targets;
}

export function crawlDepths(edges, root) {
  const depths = new Map([[root, 0]]), queue = [root];
  for (let i = 0; i < queue.length; i++) {
    const source = queue[i];
    for (const target of edges.get(source) ?? []) {
      if (!depths.has(target)) { depths.set(target, depths.get(source) + 1); queue.push(target); }
    }
  }
  return depths;
}

export async function checkCrawlReachability(out = 'dist') {
  const site = 'https://cognitive-biases.github.io/';
  const sitemap = await readFile(join(out, 'sitemap.xml'), 'utf8');
  const entries = [...sitemap.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/g)].map(m => m[1]);
  const urls = entries.map(e => decode(e.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? ''));
  const generatedSkills = JSON.parse(await readFile(join(out, 'agent-skills/biases/catalog.json'), 'utf8'));
  const generatedSkillUrls = new Set([generatedSkills.marketplace, ...generatedSkills.skills.map(s => s.canonicalUrl)]);
  const canonical = new Set(urls), edges = new Map(), issues = [];
  if (canonical.size !== urls.length || !canonical.has(site)) issues.push('duplicate URLs or missing root in sitemap');
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i], parsed = new URL(url);
    if (parsed.origin !== new URL(site).origin || parsed.search || parsed.hash || parsed.pathname.includes('..')) throw new Error('invalid sitemap scope');
    const file = parsed.pathname === '/' ? join(out, 'index.html') : join(out, parsed.pathname.slice(1), 'index.html');
    let html;
    try { html = clean(await readFile(file, 'utf8')); } catch { issues.push(`${url}: missing HTML`); continue; }
    const canonicalTags = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => attributes(m[0])).filter(a => (a.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'));
    if (canonicalTags.length !== 1 || canonicalTags[0].href !== url) issues.push(`${url}: canonical mismatch`);
    for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
      const a = attributes(match[0]);
      if (['robots', 'googlebot'].includes(a.name?.toLowerCase()) && /(?:^|[\s,])(noindex|none)(?:$|[\s,])/i.test(a.content ?? '')) issues.push(`${url}: indexing forbidden`);
    }
    // The generated per-bias skill layer has no reviewed update date.
    if (generatedSkillUrls.has(url) && /<lastmod>/i.test(entries[i])) issues.push(`${url}: unsupported generated-skill lastmod`);
    edges.set(url, crawlTargets(html, url, canonical));
  }
  const depths = crawlDepths(edges, site);
  for (const url of urls) if (!depths.has(url)) issues.push(`${url}: no crawlable path from homepage`);
  const report = {schema: 'crawl-reachability/v1', checkedAt: new Date().toISOString(), status: issues.length ? 'fail' : 'pass', sitemapPages: urls.length, reachablePages: depths.size, depthDistribution: Object.fromEntries([...depths.values()].reduce((m, d) => m.set(d, (m.get(d) ?? 0) + 1), new Map())), issues, limitations: 'Final-artifact HTML graph only. Does not prove live HTTP availability, Google crawling, indexing, quality or ranking; depth is descriptive, not an SEO score.'};
  await mkdir('.artifacts', {recursive: true});
  await writeFile('.artifacts/crawl-reachability.json', JSON.stringify(report, null, 2) + '\n');
  if (issues.length) throw new Error(`crawl_reachability: ${issues.slice(0, 10).join('; ')} (${issues.length} issues)`);
  console.log(JSON.stringify(report));
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await checkCrawlReachability();
