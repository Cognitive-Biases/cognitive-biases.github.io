import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SITE = 'https://cognitive-biases.github.io';
const OUT = 'dist';
const ISO_639_1 = new Set(`aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu`.split(' '));
const ISO_3166_COMMON = new Set(`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' '));

const policy = JSON.parse(await readFile('data/search-localization-policy.json', 'utf8'));
const manifest = JSON.parse(await readFile('data/locales.json', 'utf8'));
const fail = (message) => { throw new Error(`search_localization_policy:${message}`); };

if (policy.agentInteroperability?.llmsTxt?.googleSearchRequirement !== false) {
  fail('llms.txt must not be classified as a Google Search requirement');
}
if (policy.search?.languageDetectionContract !== 'visible-content-first') {
  fail('Google language-detection policy must remain visible-content-first');
}
if (policy.search?.htmlLangRole !== 'accessibility-browser-semantics') {
  fail('html lang must remain an accessibility/browser semantic contract, not a Google language detector');
}
const representations = policy.search?.hreflang?.representations || [];
if (JSON.stringify(representations) !== JSON.stringify(['html'])) {
  fail(`current project contract expects one authoritative hreflang representation (html); got ${representations.join(', ')}`);
}
if (policy.search?.hreflang?.googleSpecificValidation !== true) {
  fail('Google-specific hreflang validation must be enabled');
}
if (policy.search?.sitemap?.hreflangAnnotations !== false) {
  fail('sitemap hreflang must not be required while HTML owns the equivalence representation');
}
if (policy.structuredData?.faqRichResultStatus !== 'removed-2026-05-07') {
  fail('Google FAQ rich-result status is stale');
}

const localeCodes = (manifest.locales || []).map((locale) => locale.code);
for (const code of localeCodes) {
  const result = inspectGoogleHreflang(code);
  if (!result.eligible) fail(`${code}: Google hreflang ineligible (${result.reason})`);
}

const homes = (manifest.locales || []).map((locale) => ({
  code: locale.code,
  route: locale.code === manifest.canonicalLocale ? '/' : locale.urlBase || `/${locale.code.toLowerCase()}/`
}));
const expected = new Map(homes.map((home) => [home.code.toLowerCase(), `${SITE}${home.route}`]));
expected.set('x-default', `${SITE}/`);
for (const home of homes) {
  const path = home.route === '/' ? join(OUT, 'index.html') : join(OUT, home.route.replace(/^\//, ''), 'index.html');
  const html = await readFile(path, 'utf8');
  const tags = (html.match(/<link\b[^>]*>/gi) || []).filter((tag) => getAttribute(tag, 'rel')?.toLowerCase() === 'alternate' && getAttribute(tag, 'hreflang'));
  const actual = new Map(tags.map((tag) => [getAttribute(tag, 'hreflang').toLowerCase(), decodeHtml(getAttribute(tag, 'href'))]));
  if (actual.size !== expected.size) fail(`${home.code}: HTML hreflang cluster size ${actual.size}; expected ${expected.size}`);
  for (const [code, href] of expected) if (actual.get(code) !== href) fail(`${home.code}: hreflang ${code} mismatch`);
}

const sitemap = await readFile(join(OUT, 'sitemap.xml'), 'utf8');
if (/<xhtml:link\b/i.test(sitemap)) fail('sitemap unexpectedly emits a second hreflang representation');

console.log(`Search 2026 localization policy passed for ${localeCodes.length} locales; HTML owns hreflang equivalence and llms.txt remains a separate agent contract.`);

function inspectGoogleHreflang(value) {
  const raw = String(value || '').trim();
  let locale;
  try { locale = new Intl.Locale(raw); } catch { return { eligible: false, reason: 'invalid-bcp47' }; }
  const language = locale.language?.toLowerCase() || '';
  if (!ISO_639_1.has(language)) return { eligible: false, reason: 'language-not-iso-639-1' };
  if (locale.region && !/^[A-Z]{2}$/.test(locale.region)) return { eligible: false, reason: 'region-not-alpha2' };
  if (locale.region && !ISO_3166_COMMON.has(locale.region)) return { eligible: false, reason: 'region-not-iso-3166-1-alpha2' };
  const parts = locale.baseName.split('-');
  let i = 1;
  if (parts[i] && /^[A-Z][a-z]{3}$/.test(parts[i])) i += 1;
  if (parts[i] && /^[A-Z]{2}$/.test(parts[i])) i += 1;
  if (i !== parts.length || /-u-|-t-|-x-/i.test(locale.toString())) return { eligible: false, reason: 'unsupported-google-subtag' };
  return { eligible: true, reason: null };
}

function getAttribute(tag, name) {
  const match = String(tag || '').match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] || '';
}
function decodeHtml(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
