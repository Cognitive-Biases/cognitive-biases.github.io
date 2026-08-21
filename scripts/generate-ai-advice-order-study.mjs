import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const study = JSON.parse(await readFile("data/studies/ai-advice-order-v1.json", "utf8"));
const schema = JSON.parse(await readFile("schemas/ai-advice-order-session.schema.json", "utf8"));
const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

if (study.studyId !== "ai-advice-order-v1") throw new Error("Unexpected study id.");
if (study.status !== "preregistered-pilot") throw new Error("The first study must remain preregistered until a real result artifact exists.");
if (!Array.isArray(study.tasks) || study.tasks.length !== 6) throw new Error("AI Advice Order v1 requires exactly six tasks.");

const nav = `<header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/lenses/">Lens packs</a><a href="/professional/">Professional</a><a href="/ai-era/tracker/">AI-era tracker</a><a href="/research/">Research</a><a class="nav-cta" href="/data/">Data</a></nav></header>`;
const footer = `<footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/research/ai-advice-order-v1/">Study protocol</a><a href="/experiments/ai-advice-order-v1/">Participant instrument</a><a href="/ai-era/tracker/">Research tracker</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial or mental-health advice.</p></footer>`;
function page(title, description, path, body, type = "WebPage") {
  const canonical = `${SITE}${path}`;
  const structured = { "@context": "https://schema.org", "@type": type, name: title, description, url: canonical, isPartOf: { "@type": "WebSite", name: "Cognitive Biases", url: SITE } };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(structured)}</script></head><body><a class="skip" href="#main">Skip to content</a>${nav}<main id="main">${body}</main>${footer}</body></html>`;
}
async function emit(path, content) {
  const target = join(OUT, path.replace(/^\//, ""), path.endsWith("/") ? "index.html" : "");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

const sourceList = study.researchBackground.map((source) => `<li><a href="${source.url}" rel="noopener">${esc(source.title)} (${source.year})</a><br><span class="fine-print">${esc(source.note)}</span></li>`).join("");
const limitations = study.limitationsPlanned.map((item) => `<li>${esc(item)}</li>`).join("");
const secondary = study.secondaryOutcomes.map((item) => `<li>${esc(item)}</li>`).join("");
const ethics = study.ethicsAndBoundary.map((item) => `<li>${esc(item)}</li>`).join("");
const researchBody = `<section class="page-hero"><p class="eyebrow">Preregistered pilot · ${esc(study.preregisteredAt)}</p><h1>${esc(study.title)}</h1><p class="lede">${esc(study.researchQuestion)}</p><div class="study-status"><strong>Status: preregistered, no project result yet</strong><span>The protocol and analysis rule are public before data collection. The tracker must stay below result stage until real anonymized data and a result artifact are published.</span></div><p><a class="button" href="/experiments/ai-advice-order-v1/">Open participant instrument</a></p></section><section class="section"><p class="kicker">Hypothesis</p><h2>Order, not merely the presence of advice.</h2><p class="lede">${esc(study.hypothesis)}</p><div class="feature-list"><article><strong>Design</strong><p>${esc(study.design.type)}; ${study.design.trialsPerParticipant} trials per participant.</p></article><article><strong>Order balance</strong><p>${esc(study.design.orderBalance)}</p></article><article><strong>Anchor balance</strong><p>${esc(study.design.anchorBalance)}</p></article><article><strong>Target</strong><p>${study.samplePlan.targetCompletedParticipants} complete adult participant records.</p></article></div></section><section class="section section--ink"><p class="kicker">Primary outcome</p><h2>One rule fixed before looking at data.</h2><p><strong>${esc(study.primaryOutcome.name)}:</strong> <code>${esc(study.primaryOutcome.formula)}</code></p><p>${esc(study.primaryOutcome.interpretation)}</p><p><strong>Participant contrast:</strong> ${esc(study.primaryOutcome.participantContrast)}.</p><p>${esc(study.primaryOutcome.direction)}</p></section><section class="section"><p class="kicker">Secondary outcomes</p><h2>Useful context, not a fishing expedition.</h2><ul>${secondary}</ul><p><strong>Missing data:</strong> ${esc(study.analysisPlan.missingData)}</p><p><strong>Outliers:</strong> ${esc(study.analysisPlan.outliers)}</p><p><strong>Claim rule:</strong> ${esc(study.analysisPlan.claimRule)}</p></section><section class="section"><p class="kicker">Participant privacy</p><h2>No silent data collection.</h2><p class="lede">The experiment runs in the browser. It creates a random local participant ID and a downloadable JSON record. It does not upload responses, collect names, emails, IP addresses or device fingerprints.</p><ul>${ethics}</ul></section><section class="section"><p class="kicker">Starting evidence</p><h2>Why test this?</h2><ul>${sourceList}</ul></section><section class="section"><p class="kicker">Planned limitations</p><h2>Write them before they become excuses.</h2><ul>${limitations}</ul><p class="fine-print">Participant note: the full machine-readable preregistration contains the task stimuli. If you plan to participate, complete the instrument before inspecting the study JSON.</p></section><section class="section"><p><a class="button" href="/data/studies/ai-advice-order-v1.json">Preregistration JSON</a> <a class="button button--dark" href="/schemas/ai-advice-order-session.schema.json">Session schema</a></p></section>`;
await emit("/research/ai-advice-order-v1/", page(`${study.title} | Preregistered Pilot`, "A preregistered within-participant pilot testing whether standardized AI-labelled numerical advice has more influence when shown before an independent estimate.", "/research/ai-advice-order-v1/", researchBody, "ScholarlyArticle"));

const instrumentBody = `<section class="page-hero"><p class="eyebrow">Local-only research instrument</p><h1>AI Advice Order Pilot</h1><p class="lede">Six short numerical estimates. Some trials ask for your independent estimate before showing standardized AI-labelled advice; other trials show the advice first. The order is randomized locally.</p><div class="study-status"><strong>No automatic upload</strong><span>Your responses stay in this browser until you choose to download the final JSON record. Closing the page does not send anything to the project.</span></div></section><section class="section study-consent" id="study-consent"><p class="kicker">Before you start</p><h2>Minimal-risk adult pilot.</h2><p>The numerical recommendation is a standardized study stimulus fixed by the protocol, not a live AI model call. The study asks no sensitive personal questions and does not diagnose you. Participation is voluntary.</p><label class="study-check"><input type="checkbox" id="study-age"> <span>I am 18 or older.</span></label><label class="study-check"><input type="checkbox" id="study-agree"> <span>I understand that responses stay local unless I later choose to share the downloaded JSON record.</span></label><button class="button" id="study-start" type="button" disabled>Start six trials</button></section><section class="section" id="study-runner" hidden><div class="study-progress"><span id="study-progress-text">Trial 1 of 6</span><progress id="study-progress-bar" value="1" max="6"></progress></div><article class="study-trial"><p class="kicker" id="study-condition-label"></p><h2 id="study-question"></h2><p class="study-unit" id="study-unit"></p><div class="study-advice" id="study-advice" hidden><span>Standardized AI recommendation</span><strong id="study-advice-value"></strong></div><form id="study-response-form"><div id="study-initial-fields" hidden><label for="study-initial-estimate">Your independent estimate</label><input id="study-initial-estimate" type="number" step="any" inputmode="decimal"><label for="study-initial-confidence">Confidence (0–100%)</label><input id="study-initial-confidence" type="number" min="0" max="100" step="1" inputmode="numeric"></div><div id="study-final-fields" hidden><label for="study-final-estimate" id="study-final-label">Your final estimate</label><input id="study-final-estimate" type="number" step="any" inputmode="decimal"><label for="study-final-confidence">Confidence (0–100%)</label><input id="study-final-confidence" type="number" min="0" max="100" step="1" inputmode="numeric"><label class="study-check"><input id="study-known" type="checkbox"> <span>I already knew the exact answer before this trial.</span></label></div><p class="study-error" id="study-error" role="alert"></p><button class="button" id="study-next" type="submit">Continue</button></form></article><button class="button button--secondary" id="study-reset" type="button">Reset local session</button></section><section class="section" id="study-complete" hidden><p class="kicker">Session complete</p><h2>Your record has not been uploaded.</h2><p class="lede">Download the anonymized JSON if you want to keep or voluntarily contribute this session. The file contains a random participant ID, task assignments, estimates, confidence, known-answer flags and timing. It contains no name or email.</p><p><button class="button" id="study-download" type="button">Download JSON</button> <button class="button button--secondary" id="study-copy" type="button">Copy JSON</button></p><p class="fine-print" id="study-copy-status"></p><div class="study-debrief"><p class="kicker">Debrief</p><h2>The recommendations were controlled anchors.</h2><p>They were deliberately placed above or below known reference values so the project can test order effects. This pilot measures how estimates move under this controlled setup; it does not tell you that you “have” a bias.</p><div id="study-answers"></div></div></section><script type="application/json" id="study-spec">${JSON.stringify(study).replaceAll("<", "\\u003c")}</script><script src="/assets/ai-advice-order-v1.js" defer></script>`;
await emit("/experiments/ai-advice-order-v1/", page("AI Advice Order Pilot | Cognitive Biases", "Take a six-trial local-only pilot testing whether standardized AI-labelled advice changes numerical judgments differently when shown before or after an independent estimate.", "/experiments/ai-advice-order-v1/", instrumentBody, "WebApplication"));

const clientJs = `(() => {
  const spec = JSON.parse(document.getElementById('study-spec')?.textContent || '{}');
  const KEY = 'cognitive-biases-ai-advice-order-v1';
  const consentVersion = '2026-08-21-v1';
  const $ = (id) => document.getElementById(id);
  const age = $('study-age'), agree = $('study-agree'), start = $('study-start');
  const consent = $('study-consent'), runner = $('study-runner'), complete = $('study-complete');
  const form = $('study-response-form'), error = $('study-error');
  let phaseStarted = Date.now();
  const random = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };
  const shuffle = (items) => { const out = [...items]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };
  const makeId = () => crypto.randomUUID ? crypto.randomUUID() : 'p-' + Date.now().toString(36) + '-' + Math.floor(random() * 1e9).toString(36);
  const cleanNumber = (node) => { const value = Number(node.value); return Number.isFinite(value) ? value : null; };
  function newState() {
    const tasks = shuffle(spec.tasks.map((t) => t.id));
    const orders = shuffle(['independent-first','independent-first','independent-first','advice-first','advice-first','advice-first']);
    const dirs = shuffle(['low','low','low','high','high','high']);
    return { participantId: makeId(), consentVersion, startedAt: new Date().toISOString(), currentIndex: 0, phase: null, draft: null, responses: [], assignments: tasks.map((taskId, i) => ({ taskId, orderCondition: orders[i], anchorDirection: dirs[i] })) };
  }
  let state = null;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  const getTask = (id) => spec.tasks.find((task) => task.id === id);
  const assignment = () => state?.assignments?.[state.currentIndex];
  function exportRecord() {
    return { studyId: spec.studyId, specVersion: spec.version, participantId: state.participantId, consentVersion: state.consentVersion, startedAt: state.startedAt, completedAt: state.completedAt, responses: state.responses.map((r) => ({ taskId: r.taskId, orderCondition: r.orderCondition, anchorDirection: r.anchorDirection, anchor: r.anchor, referenceValue: r.referenceValue, initialEstimate: r.initialEstimate ?? null, initialConfidence: r.initialConfidence ?? null, finalEstimate: r.finalEstimate, finalConfidence: r.finalConfidence, knownAnswer: r.knownAnswer, elapsedMs: r.elapsedMs })) };
  }
  function render() {
    if (!state) { consent.hidden = false; runner.hidden = true; complete.hidden = true; return; }
    if (state.completedAt) { renderComplete(); return; }
    consent.hidden = true; runner.hidden = false; complete.hidden = true;
    const a = assignment(), task = getTask(a.taskId); if (!a || !task) return;
    if (!state.phase) state.phase = a.orderCondition === 'independent-first' ? 'initial' : 'final';
    $('study-progress-text').textContent = 'Trial ' + (state.currentIndex + 1) + ' of ' + spec.tasks.length;
    $('study-progress-bar').value = state.currentIndex + 1;
    $('study-question').textContent = task.question;
    $('study-unit').textContent = 'Answer in ' + task.unit + '.';
    $('study-condition-label').textContent = a.orderCondition === 'independent-first' ? 'Independent estimate first' : 'Advice first';
    const anchor = a.anchorDirection === 'low' ? task.lowAnchor : task.highAnchor;
    $('study-advice-value').textContent = anchor + ' ' + task.unit;
    $('study-advice').hidden = state.phase === 'initial';
    $('study-initial-fields').hidden = state.phase !== 'initial';
    $('study-final-fields').hidden = state.phase !== 'final';
    $('study-final-label').textContent = a.orderCondition === 'independent-first' ? 'Your final estimate after seeing the advice' : 'Your estimate after seeing the advice';
    $('study-next').textContent = state.phase === 'initial' ? 'Show standardized AI advice' : (state.currentIndex === spec.tasks.length - 1 ? 'Finish session' : 'Save trial');
    $('study-initial-estimate').value = ''; $('study-initial-confidence').value = ''; $('study-final-estimate').value = ''; $('study-final-confidence').value = ''; $('study-known').checked = false;
    error.textContent = ''; phaseStarted = Date.now(); save();
  }
  function renderComplete() {
    consent.hidden = true; runner.hidden = true; complete.hidden = false;
    $('study-answers').innerHTML = spec.tasks.map((task) => '<article><strong>' + task.question + '</strong><p>' + task.referenceValue + ' ' + task.unit + ' · <a href="' + task.sourceUrl + '" rel="noopener">source</a></p></article>').join('');
  }
  function validConfidence(value) { return value !== null && value >= 0 && value <= 100; }
  form?.addEventListener('submit', (event) => {
    event.preventDefault(); if (!state) return;
    const a = assignment(), task = getTask(a.taskId), anchor = a.anchorDirection === 'low' ? task.lowAnchor : task.highAnchor;
    if (state.phase === 'initial') {
      const estimate = cleanNumber($('study-initial-estimate')), confidence = cleanNumber($('study-initial-confidence'));
      if (estimate === null || !validConfidence(confidence)) { error.textContent = 'Enter a numerical estimate and confidence from 0 to 100.'; return; }
      state.draft = { initialEstimate: estimate, initialConfidence: confidence, initialElapsedMs: Date.now() - phaseStarted };
      state.phase = 'final'; save(); render(); return;
    }
    const finalEstimate = cleanNumber($('study-final-estimate')), finalConfidence = cleanNumber($('study-final-confidence'));
    if (finalEstimate === null || !validConfidence(finalConfidence)) { error.textContent = 'Enter a numerical estimate and confidence from 0 to 100.'; return; }
    const draft = state.draft || {};
    state.responses.push({ taskId: task.id, orderCondition: a.orderCondition, anchorDirection: a.anchorDirection, anchor, referenceValue: task.referenceValue, initialEstimate: draft.initialEstimate ?? null, initialConfidence: draft.initialConfidence ?? null, finalEstimate, finalConfidence, knownAnswer: $('study-known').checked, elapsedMs: (draft.initialElapsedMs || 0) + (Date.now() - phaseStarted) });
    state.currentIndex += 1; state.phase = null; state.draft = null;
    if (state.currentIndex >= spec.tasks.length) state.completedAt = new Date().toISOString();
    save(); render();
  });
  const syncConsent = () => { start.disabled = !(age.checked && agree.checked); };
  age?.addEventListener('change', syncConsent); agree?.addEventListener('change', syncConsent);
  start?.addEventListener('click', () => { if (start.disabled) return; state = newState(); save(); render(); });
  $('study-reset')?.addEventListener('click', () => { if (!confirm('Delete this local study session and restart?')) return; localStorage.removeItem(KEY); state = null; render(); });
  $('study-download')?.addEventListener('click', () => { const blob = new Blob([JSON.stringify(exportRecord(), null, 2) + '\\n'], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = spec.studyId + '-' + state.participantId + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
  $('study-copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(JSON.stringify(exportRecord(), null, 2)); $('study-copy-status').textContent = 'JSON copied. Nothing was uploaded.'; } catch { $('study-copy-status').textContent = 'Copy failed. Use Download JSON instead.'; } });
  render();
})();`;
await emit("/assets/ai-advice-order-v1.js", clientJs);

await mkdir(join(OUT, "data", "studies"), { recursive: true });
await writeFile(join(OUT, "data", "studies", "ai-advice-order-v1.json"), JSON.stringify(study, null, 2) + "\n");
await mkdir(join(OUT, "schemas"), { recursive: true });
await writeFile(join(OUT, "schemas", "ai-advice-order-session.schema.json"), JSON.stringify(schema, null, 2) + "\n");

let css = await readFile(join(OUT, "styles.css"), "utf8");
if (!css.includes(".study-status{")) {
  css += `\n.study-status{display:flex;flex-direction:column;gap:.45rem;max-width:780px;margin:1.5rem 0;padding:1rem 1.1rem;border:2px solid currentColor;background:#fff}.study-status strong{font-weight:900}.study-consent,.study-trial{max-width:820px}.study-check{display:flex;gap:.7rem;align-items:flex-start;margin:1rem 0}.study-check input{margin-top:.2rem}.study-progress{display:grid;gap:.5rem;max-width:820px;margin-bottom:1.5rem}.study-progress progress{width:100%;height:14px}.study-trial{padding:1.4rem;border:2px solid currentColor;background:#fff}.study-unit{font-weight:800}.study-advice{display:flex;flex-direction:column;gap:.25rem;margin:1.2rem 0;padding:1rem;border-left:6px solid var(--cyan);background:#eefcff}.study-advice span{font-size:.78rem;font-weight:900;text-transform:uppercase}.study-advice strong{font-size:1.7rem}.study-trial label{display:block;font-weight:800;margin:.9rem 0 .35rem}.study-trial input[type=number]{width:min(100%,420px);padding:.8rem;border:2px solid currentColor}.study-error{min-height:1.4rem;font-weight:800}.study-debrief{margin-top:2rem;padding-top:1.5rem;border-top:2px solid currentColor}.study-debrief article{padding:.8rem 0;border-bottom:1px solid currentColor}.study-debrief p{margin:.3rem 0}\n`;
  await writeFile(join(OUT, "styles.css"), css);
}

let sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
for (const path of ["/research/ai-advice-order-v1/", "/experiments/ai-advice-order-v1/"]) {
  const loc = SITE + path;
  if (!sitemap.includes(`<loc>${loc}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${loc}</loc><lastmod>${study.preregisteredAt}</lastmod></url></urlset>`);
}
await writeFile(join(OUT, "sitemap.xml"), sitemap);

const trackerPath = join(OUT, "ai-era", "tracker", "index.html");
let trackerHtml = await readFile(trackerPath, "utf8");
if (!trackerHtml.includes("study-ai-advice-order-v1")) {
  const card = `<section class="section" id="study-ai-advice-order-v1"><p class="kicker">First preregistered project study</p><h2>AI Advice Order Pilot</h2><p class="lede">The first project-owned human–AI study now has a frozen question, task set, randomization rule, primary outcome and analysis plan. It still has no empirical result.</p><p><a class="button" href="/research/ai-advice-order-v1/">Read the preregistration</a> <a class="button button--dark" href="/experiments/ai-advice-order-v1/">Run the instrument</a></p></section>`;
  trackerHtml = trackerHtml.replace("</main>", card + "</main>");
  await writeFile(trackerPath, trackerHtml);
}

const homePath = join(OUT, "index.html");
let home = await readFile(homePath, "utf8");
if (!home.includes("home-ai-advice-order-v1")) {
  const card = `<section class="section" id="home-ai-advice-order-v1"><p class="kicker">Open research</p><h2>Our first preregistered human–AI pilot.</h2><p class="lede">Instead of adding another catchy AI-bias label, we are testing one concrete prediction: whether seeing standardized AI advice before an independent estimate changes the final numerical judgment.</p><p><a class="button" href="/research/ai-advice-order-v1/">See the protocol</a></p></section>`;
  home = home.replace("</main>", card + "</main>");
  await writeFile(homePath, home);
}

console.log(`Generated ${study.studyId}: preregistration + local participant instrument.`);
