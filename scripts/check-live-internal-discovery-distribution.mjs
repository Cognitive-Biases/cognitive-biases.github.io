const SITE = 'https://cognitive-biases.github.io';
const MAX = 12;
const fail = (message) => { throw new Error(`live_internal_discovery:${message}`); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url, attempts = 3) {
  let error;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'CognitiveBiases-InternalDiscoveryCheck/1.0' } });
      const text = await response.text();
      if (response.ok) return { response, text };
      error = new Error(`${response.status} ${url}`);
    } catch (caught) { error = caught; }
    if (attempt < attempts) await sleep(800 * attempt);
  }
  throw error;
}

const { text: sitemap } = await fetchText(`${SITE}/sitemap.xml`);
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replaceAll('&amp;', '&'));
const preferred = [
  ...urls.filter((url) => /\/biases\//.test(url)),
  ...urls.filter((url) => /\/contexts\/[^/]+\/$/.test(url)),
  ...urls.filter((url) => /\/compare\/[^/]+\/$/.test(url)),
  ...urls.filter((url) => /\/research\/[^/]+\/$/.test(url))
];
const sample = [...new Set(preferred)].slice(0, MAX);
if (!sample.length) fail('no representative URLs found in live sitemap');

let continuation = 0;
for (const url of sample) {
  const { response, text } = await fetchText(url);
  if (response.url.replace(/\/$/, '') !== url.replace(/\/$/, '')) fail(`${url}: redirected to ${response.url}`);
  const canonical = text.match(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*href=["']([^"']+)["']/i)?.[1] || '';
  if (canonical !== url) fail(`${url}: canonical mismatch ${canonical || 'none'}`);
  if (!text.includes('internal-breadcrumbs')) fail(`${url}: visible breadcrumb missing`);
  if (!text.includes('data-page-utility')) fail(`${url}: utility bar missing`);
  if (!text.includes('data-page-action="share"') || !text.includes('data-page-action="copy"') || !text.includes('data-page-action="cite"')) fail(`${url}: utility actions incomplete`);
  if (!text.includes('src="/internal-discovery.js"')) fail(`${url}: utility script missing`);
  if (text.includes('data-internal-discovery-continuation')) continuation += 1;
}

const { response: scriptResponse, text: script } = await fetchText(`${SITE}/internal-discovery.js`);
if (!/javascript/i.test(scriptResponse.headers.get('content-type') || '') && !script.includes('data-page-action')) fail('live utility script response is not recognizable JavaScript');
if (!script.includes('navigator.share') || !script.includes('localStorage')) fail('live utility script is stale');

console.log(`Live Internal Discovery & Distribution passed on ${sample.length} representative page(s); ${continuation} sampled page(s) expose curated continuation blocks.`);
