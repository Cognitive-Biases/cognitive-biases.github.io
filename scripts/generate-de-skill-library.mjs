import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = "2026-09-13";

const canonicalSkillsDoc = JSON.parse(await readFile("data/skills.json", "utf8"));
const deSkillsDoc = JSON.parse(await readFile("data/de/skills.json", "utf8"));
const canonicalAgentDoc = JSON.parse(await readFile("data/agent-skills.json", "utf8"));
const deAgentDoc = JSON.parse(await readFile("data/de/agent-skills.json", "utf8"));
const contextsDoc = JSON.parse(await readFile("data/contexts.json", "utf8"));
const biases = JSON.parse(await readFile("data/biases.json", "utf8"));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const deBiasDoc = JSON.parse(await readFile(join(OUT, "data", "de", "biases.json"), "utf8"));

const canonicalSkills = canonicalSkillsDoc.entries || [];
const deSkills = deSkillsDoc.entries || [];
const canonicalAgentSkills = canonicalAgentDoc.skills || [];
const deAgentSkills = deAgentDoc.skills || [];
const contextBySlug = new Map((contextsDoc.entries || []).map((entry) => [entry.slug, entry]));
const deBiasBySlug = new Map((deBiasDoc.entries || []).map((entry) => [entry.slug, entry]));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => bias.published && !duplicateIds.has(bias.id)).sort((a, b) => a.title.localeCompare(b.title));

if (deSkillsDoc.locale !== "de" || deSkillsDoc.state !== "reviewed-localization") throw new Error("data/de/skills.json must be reviewed German localization.");
if (deAgentDoc.locale !== "de" || deAgentDoc.state !== "reviewed-localization") throw new Error("data/de/agent-skills.json must be reviewed German localization.");

const canonicalSkillBySlug = new Map(canonicalSkills.map((entry) => [entry.slug, entry]));
const deSkillBySlug = new Map(deSkills.map((entry) => [entry.slug, entry]));
const canonicalAgentByName = new Map(canonicalAgentSkills.map((entry) => [entry.name, entry]));
const deAgentByName = new Map(deAgentSkills.map((entry) => [entry.name, entry]));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const clean = (value = "") => String(value).replace(/\s+/g, " ").trim();
const yamlString = (value = "") => JSON.stringify(String(value));
const list = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;

async function writePage(relativePath, html) {
  const target = join(OUT, relativePath, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

async function writeText(relativePath, text) {
  const target = join(OUT, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, text);
}

async function addEnglishAlternate(enPath, dePath) {
  const target = join(OUT, enPath.replace(/^\//, ""), "index.html");
  await access(target);
  let html = await readFile(target, "utf8");
  const alternate = `<link rel="alternate" hreflang="de" href="${SITE}${dePath}">`;
  if (!html.includes(alternate)) {
    if (!html.includes("</head>")) throw new Error(`${enPath}: missing </head>.`);
    html = html.replace("</head>", `${alternate}</head>`);
    await writeFile(target, html);
  }
}

function nav(current = "") {
  const item = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header"><a class="brand" href="/de/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture><span>Cognitive<br>Biases</span></a><nav aria-label="Hauptnavigation">${item("/de/biases/","Verzerrungen","biases")}${item("/de/techniques/","Denkwerkzeuge","techniques")}${item("/de/skills/","Denkkompetenzen","skills")}${item("/de/agent-skills/","Agent Skills","agent-skills")}<a href="/" lang="en" hreflang="en">English</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/de/"><picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="40" height="40" alt=""></picture><span>Cognitive Biases</span></a><p>Kognitive Verzerrungen erkennen, Evidenz prüfen und bessere Entscheidungen vorbereiten.</p></div><div class="footer-links"><a href="/de/biases/">Verzerrungen</a><a href="/de/techniques/">Denkwerkzeuge</a><a href="/de/skills/">Denkkompetenzen</a><a href="/de/agent-skills/">Agent Skills</a><a href="/methodology/" lang="en">Methodik — English</a></div><p class="fine-print">Bildungsangebot. Kein Ersatz für professionelle Beratung in folgenreichen Fachentscheidungen.</p></footer>`;
}

function page({ title, description, dePath, enPath = null, current = "", body, schema, script = "" }) {
  const self = `${SITE}${dePath}`;
  const alternates = enPath ? `<link rel="alternate" hreflang="de" href="${self}"><link rel="alternate" hreflang="en" href="${SITE}${enPath}"><link rel="alternate" hreflang="x-default" href="${SITE}${enPath}">` : `<link rel="alternate" hreflang="de" href="${self}">`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${self}">${alternates}<link rel="icon" href="/favicon.png"><meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${self}"><meta property="og:locale" content="de_DE"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/de.css"><style>.agent-badges{display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0}.agent-badge{border:2px solid currentColor;border-radius:999px;padding:.2rem .55rem;font-size:.78rem;font-weight:900}.agent-install{background:#101622;color:#fff;padding:1rem;overflow:auto}.skill-meta{font-size:.9rem;color:#596273}.skill-search{width:min(680px,100%);padding:.8rem;border:3px solid currentColor;font:inherit}</style><script type="application/ld+json">${jsonForHtml(schema)}</script></head><body><a class="skip" href="#main">Zum Inhalt springen</a>${nav(current)}<main id="main">${body}</main>${footer()}${script}</body></html>`;
}

function localizedReference(ref) {
  const match = String(ref.url || "").match(/^https:\/\/cognitive-biases\.github\.io\/skills\/([^/]+)\/$/);
  if (match && deSkillBySlug.has(match[1])) return { label: "Denkkompetenz", url: `${SITE}/de/skills/${match[1]}/`, language: "de" };
  return { label: `${ref.label || "Quelle"} — English`, url: ref.url, language: "en" };
}

for (const canonical of canonicalSkills) {
  if (!deSkillBySlug.has(canonical.slug)) throw new Error(`Missing German Decision Skill: ${canonical.slug}`);
}
if (deSkills.length !== canonicalSkills.length) throw new Error(`German Decision Skill parity mismatch ${deSkills.length}/${canonicalSkills.length}.`);
for (const canonical of canonicalAgentSkills) {
  if (!deAgentByName.has(canonical.name)) throw new Error(`Missing German workflow Agent Skill: ${canonical.name}`);
}
if (deAgentSkills.length !== canonicalAgentSkills.length) throw new Error(`German workflow Agent Skill parity mismatch ${deAgentSkills.length}/${canonicalAgentSkills.length}.`);

const decisionPublic = [];
const skillsByBias = new Map();
for (const canonical of canonicalSkills) {
  const de = deSkillBySlug.get(canonical.slug);
  const dePath = `/de/skills/${canonical.slug}/`;
  const enPath = `/skills/${canonical.slug}/`;
  await addEnglishAlternate(enPath, dePath);
  const lenses = (canonical.biases || []).map((slug) => {
    const bias = deBiasBySlug.get(slug);
    if (!bias) throw new Error(`${canonical.slug}: German bias missing: ${slug}`);
    if (!skillsByBias.has(slug)) skillsByBias.set(slug, []);
    skillsByBias.get(slug).push({ slug: canonical.slug, title: de.title });
    return bias;
  });
  const contexts = (canonical.contexts || []).map((slug) => {
    const context = contextBySlug.get(slug);
    if (!context) throw new Error(`${canonical.slug}: context missing: ${slug}`);
    return context;
  });
  const lensCards = lenses.map((lens) => `<article class="practice-card"><h3><a href="/de/biases/${lens.slug}/">${escapeHtml(lens.title)}</a></h3><p>${escapeHtml(lens.summary)}</p><p class="skill-meta">${lens.localizationState === "evidence-reviewed" ? "Evidence-reviewed" : "Redaktionell lokalisiert"}</p></article>`).join("");
  const contextCards = contexts.map((context) => `<article class="practice-set-card"><p class="kicker">Decision Context — English</p><h3><a href="/contexts/${context.slug}/" lang="en">${escapeHtml(context.title)}</a></h3><p>${escapeHtml(context.summary)}</p></article>`).join("");
  const schema = {"@context":"https://schema.org","@graph":[{"@type":"LearningResource","@id":`${SITE}${dePath}#resource`,url:`${SITE}${dePath}`,name:de.title,description:de.summary,learningResourceType:"Denkkompetenz",educationalUse:"Practice",inLanguage:"de",teaches:de.outcome,about:lenses.map((lens)=>({"@type":"DefinedTerm",name:lens.title,url:`${SITE}/de/biases/${lens.slug}/`}))},{"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Cognitive Biases",item:`${SITE}/de/`},{"@type":"ListItem",position:2,name:"Denkkompetenzen",item:`${SITE}/de/skills/`},{"@type":"ListItem",position:3,name:de.title,item:`${SITE}${dePath}`}]}]};
  const body = `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation"><a href="/de/">Start</a><span aria-hidden="true">/</span><a href="/de/skills/">Denkkompetenzen</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(de.title)}</span></nav><section class="page-hero"><p class="eyebrow">Denkkompetenz</p><h1>${escapeHtml(de.title)}</h1><p class="lede">${escapeHtml(de.summary)}</p><p><strong>Lernziel:</strong> ${escapeHtml(de.outcome)}</p><p class="fine-print" lang="en">Canonical skill: ${escapeHtml(canonical.title)}</p></section><section class="section"><p class="kicker">Wann sie hilft</p><h2>Erkenne zuerst die Aufgabe, nicht den Bias-Namen.</h2>${list(de.whenToUse)}</section><section class="section section--ink"><p class="kicker">Trainieren</p><h2>Übe einen besseren Denkzug.</h2>${list(de.actions)}</section><section class="section"><p class="kicker">Bias-Linsen</p><h2>Geprüfte Muster, keine Etiketten für Menschen.</h2><div class="practice-list">${lensCards}</div></section><section class="section"><p class="kicker">Kontexte</p><h2>Wende die Kompetenz auf echte Entscheidungen an.</h2><div class="practice-set-grid">${contextCards}</div></section><aside class="practice-teaser"><span>Als Agent Skill nutzen</span><a href="/de/agent-skills/${canonical.slug}/">${escapeHtml(de.title)} für AI-Agenten →</a></aside>`;
  await writePage(`de/skills/${canonical.slug}`, page({title:`${de.title} | Denkkompetenzen | Cognitive Biases`,description:de.summary,dePath,enPath,current:"skills",body,schema}));
  decisionPublic.push({...de,contexts:canonical.contexts,biases:canonical.biases,canonicalTitle:canonical.title,canonicalUrl:`${SITE}${enPath}`,url:`${SITE}${dePath}`});
}

const decisionCards = decisionPublic.map((skill) => `<article class="practice-set-card" data-de-filter-item data-search="${escapeHtml([skill.title,skill.canonicalTitle,...(skill.aliases||[])].join(" "))}"><p class="kicker">${skill.biases.length} Bias-Linsen</p><h2><a href="/de/skills/${skill.slug}/">${escapeHtml(skill.title)}</a></h2><p>${escapeHtml(skill.summary)}</p><p><strong>Lernziel:</strong> ${escapeHtml(skill.outcome)}</p></article>`).join("");
const decisionHubSchema = {"@context":"https://schema.org","@type":"CollectionPage",name:"Denkkompetenzen",description:"Praktische Kompetenzen für Evidenzprüfung, Prognosen, Entscheidungen unter Unsicherheit und KI-gestütztes Denken.",inLanguage:"de",mainEntity:{"@type":"ItemList",numberOfItems:decisionPublic.length,itemListElement:decisionPublic.map((skill,index)=>({"@type":"ListItem",position:index+1,name:skill.title,url:skill.url}))}};
const decisionHubBody = `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation"><a href="/de/">Start</a><span aria-hidden="true">/</span><span aria-current="page">Denkkompetenzen</span></nav><section class="page-hero"><p class="eyebrow">Skill Library</p><h1>Lerne, was du bei der nächsten Entscheidung konkret tun kannst.</h1><p class="lede">Bias-Namen geben dir Vokabular. Denkkompetenzen verändern den nächsten Arbeitsschritt: Evidenz prüfen, Unsicherheit sichtbar halten, Prognosen dokumentieren, Informationen verifizieren und KI kritischer einsetzen.</p></section><section class="section"><div class="de-filter" data-de-filter><label for="de-skill-search"><strong>Denkkompetenz suchen</strong></label><input class="skill-search" id="de-skill-search" type="search" placeholder="z. B. Evidenz, Prognosen, KI" data-de-filter-input><p class="fine-print" data-de-filter-count>Insgesamt: ${decisionPublic.length}</p><div class="practice-set-grid" data-de-filter-list>${decisionCards}</div><p class="fine-print" data-de-filter-empty hidden>Keine passende Denkkompetenz gefunden.</p></div></section><section class="section section--ink"><p class="kicker">Für Agenten</p><h2>Dieselben Kompetenzen gibt es auch als portable Agent Skills.</h2><p><a class="button" href="/de/agent-skills/">Deutsche Agent Skills öffnen</a></p></section>`;
await addEnglishAlternate("/skills/", "/de/skills/");
await writePage("de/skills", page({title:"Denkkompetenzen für bessere Entscheidungen | Cognitive Biases",description:"Sechs praktische Denkkompetenzen für Evidenzprüfung, Prognosen, Unsicherheit, Informationsprüfung, Metakognition und KI-gestütztes Denken.",dePath:"/de/skills/",enPath:"/skills/",current:"skills",body:decisionHubBody,schema:decisionHubSchema,script:'<script src="/de-interface.js" defer></script>'}));

await mkdir(join(OUT,"data","de"),{recursive:true});
await writeFile(join(OUT,"data","de","skills.json"),JSON.stringify({version:1,locale:"de",state:"reviewed-localization",updatedAt:TODAY,skills:decisionPublic},null,2)+"\n");

const compatibility = ["Agent Skills", "Hermes Agent", "OpenClaw", "ChatGPT Skills", "Codex"];
const workflowPublic = [];

function workflowMarkdown(canonical,de) {
  const refs = (canonical.references || []).map(localizedReference);
  return `---\nname: ${canonical.name}\ndescription: ${yamlString(de.description)}\n---\n\n# ${de.title}\n\n${de.description}\n\n## Wann einsetzen\n\n${de.useWhen.map((item)=>`- ${item}`).join("\n")}\n\n## Ablauf\n\n${de.procedure.map((item,index)=>`${index+1}. ${item}`).join("\n")}\n\n## Erwartete Ausgabe\n\n${de.output.map((item)=>`- ${item}`).join("\n")}\n\n## Grenzen und Guardrails\n\n${de.guardrails.map((item)=>`- ${item}`).join("\n")}\n\n## Referenzen\n\n${refs.map((ref)=>`- [${ref.label}](${ref.url})`).join("\n")}\n\n## Portabilität\n\nDieser Agent Skill ist instruktion-only: keine Secrets, kein ausführbarer Code und kein verpflichtender Netzwerkzugriff. Wenn Quellenwerkzeuge verfügbar sind, nutze die verlinkten Cognitive-Biases-Ressourcen und bewahre Evidenzstatus, Unsicherheit und kanonische Identität.\n\nLizenz: ${canonicalAgentDoc.license || "CC-BY-NC-SA-4.0"}.\n`;
}

for (const canonical of canonicalAgentSkills) {
  const de = deAgentByName.get(canonical.name);
  const dePath = `/de/agent-skills/${canonical.name}/`;
  const enPath = `/agent-skills/${canonical.name}/`;
  await addEnglishAlternate(enPath,dePath);
  const refs = (canonical.references || []).map(localizedReference);
  const installUrl = `${SITE}${dePath}SKILL.md`;
  const hermes = `mkdir -p ~/.hermes/skills/${canonical.name} && curl -fsSL ${installUrl} -o ~/.hermes/skills/${canonical.name}/SKILL.md`;
  const openclaw = `mkdir -p ~/.openclaw/workspace/skills/${canonical.name} && curl -fsSL ${installUrl} -o ~/.openclaw/workspace/skills/${canonical.name}/SKILL.md`;
  await writeText(`de/agent-skills/${canonical.name}/SKILL.md`,workflowMarkdown(canonical,de));
  const schema = {"@context":"https://schema.org","@graph":[{"@type":"CreativeWork","@id":`${SITE}${dePath}#skill`,url:`${SITE}${dePath}`,name:de.title,description:de.description,isAccessibleForFree:true,inLanguage:"de",learningResourceType:"Agent Skill"},{"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Cognitive Biases",item:`${SITE}/de/`},{"@type":"ListItem",position:2,name:"Agent Skills",item:`${SITE}/de/agent-skills/`},{"@type":"ListItem",position:3,name:de.title,item:`${SITE}${dePath}`}]}]};
  const body = `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation"><a href="/de/">Start</a><span aria-hidden="true">/</span><a href="/de/agent-skills/">Agent Skills</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(de.title)}</span></nav><section class="page-hero"><p class="eyebrow">Portable Agent Skill</p><h1>${escapeHtml(de.title)}</h1><p class="lede">${escapeHtml(de.description)}</p><div class="agent-badges">${compatibility.map((item)=>`<span class="agent-badge">${escapeHtml(item)}</span>`).join("")}</div><p><a class="button" href="SKILL.md">SKILL.md öffnen</a>${canonical.sourceDecisionSkill ? ` <a class="button button--dark" href="/de/skills/${canonical.sourceDecisionSkill}/">Denkkompetenz öffnen</a>` : ""}</p></section><section class="section"><p class="kicker">Wann einsetzen</p>${list(de.useWhen)}</section><section class="section section--ink"><p class="kicker">Ablauf</p><ol>${de.procedure.map((item)=>`<li>${escapeHtml(item)}</li>`).join("")}</ol></section><section class="section"><p class="kicker">Erwartete Ausgabe</p>${list(de.output)}<h2>Guardrails</h2>${list(de.guardrails)}</section><section class="section"><p class="kicker">Referenzen</p><ul>${refs.map((ref)=>`<li><a href="${escapeHtml(ref.url)}"${ref.language==="en"?' lang="en"':""}>${escapeHtml(ref.label)}</a></li>`).join("")}</ul></section><section class="section section--ink"><p class="kicker">Installieren</p><h2>Eine Datei. Keine API-Keys.</h2><p>Hermes Agent</p><pre class="agent-install"><code>${escapeHtml(hermes)}</code></pre><p>OpenClaw</p><pre class="agent-install"><code>${escapeHtml(openclaw)}</code></pre></section>`;
  await writePage(`de/agent-skills/${canonical.name}`,page({title:`${de.title} | Agent Skill | Cognitive Biases`,description:de.description,dePath,enPath,current:"agent-skills",body,schema}));
  workflowPublic.push({name:canonical.name,title:de.title,description:de.description,category:canonical.category,sourceDecisionSkill:canonical.sourceDecisionSkill,useWhen:de.useWhen,procedure:de.procedure,output:de.output,guardrails:de.guardrails,references:refs,canonicalUrl:`${SITE}${enPath}`,url:`${SITE}${dePath}`,skillFile:installUrl,compatibility,security:canonicalAgentDoc.security});
}

function skillNameForBias(bias) {
  const base = `bias-${String(bias.slug).toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").replace(/-+/g,"-")}`;
  if (base.length <= 64) return base;
  const suffix = createHash("sha1").update(String(bias.slug)).digest("hex").slice(0,8);
  return `${base.slice(0,55).replace(/-+$/g,"")}-${suffix}`;
}

function biasSkillDescription(bias) {
  return `Nutze ${bias.title} als fokussierte Bias-Linse. Erkläre das Muster, prüfe, ob es plausibel zur Situation passt, nenne eine Alternativerklärung ohne Bias und liefere eine praktische Gegenprüfung — ohne Menschen zu diagnostizieren oder Kausalität zu behaupten.`;
}

function biasSkillMarkdown(bias,skillName) {
  const evidenceLine = bias.localizationState === "evidence-reviewed" ? "Die deutsche Bias-Seite gehört zum Evidence-Reviewed-Layer." : bias.canonicalEvidenceReviewAvailable ? "Die deutsche Seite ist redaktionell lokalisiert; ein kanonischer englischer Evidence Review ist verfügbar." : "Die deutsche Seite ist redaktionell lokalisiert und erhöht den wissenschaftlichen Status des kanonischen Katalogeintrags nicht.";
  return `---\nname: ${skillName}\ndescription: ${yamlString(biasSkillDescription(bias))}\n---\n\n# ${bias.title}\n\n${bias.summary}\n\n## Wann einsetzen\n\n- Der Nutzer nennt ${bias.title} oder fragt, ob dieses Muster in einer realen Situation relevant sein könnte.\n- Ein Agent braucht eine fokussierte Linse für eine Entscheidung, Behauptung, Schätzung, Erinnerung oder Interaktion.\n- Der Nutzer möchte eine praktische Gegenprüfung statt ein Etikett für eine Person.\n\n## Ablauf\n\n1. Beschreibe Situation oder Behauptung neutral, bevor du das Bias-Label anwendest.\n2. Erkläre ${bias.title} in einfacher deutscher Sprache und nutze die deutsche Cognitive-Biases-Seite als lokalisierte Referenz.\n3. Nenne die konkrete Beobachtung, die diese Linse plausibel macht. Fehlt ein solches Signal, sage, dass die Passung schwach oder unbekannt ist.\n4. Gib mindestens eine gewöhnliche Alternativerklärung ohne ${bias.title}, etwa Anreize, Randbedingungen, fehlende Information, Zufall, Messfehler oder einen anderen Mechanismus.\n5. Bewahre Evidenzstatus und Unsicherheit. ${evidenceLine}\n6. Schlage eine oder zwei Gegenprüfungen vor, die das Risiko reduzieren oder diese Erklärung von Alternativen unterscheiden können.\n7. Beende mit dem Befund, der die ${bias.title}-Interpretation wahrscheinlicher, unwahrscheinlicher oder weiterhin offen machen würde.\n\n## Erwartete Ausgabe\n\n- Erklärung in einfacher Sprache\n- Beobachtetes Signal\n- Alternative Erklärung ohne Bias\n- Evidenz- und Unsicherheitsgrenze\n- Praktische Gegenprüfung\n- Was die Einschätzung verändern würde\n\n## Grenzen\n\n- Behandle ${bias.title} als mögliche Linse, nicht als Diagnose, Persönlichkeitsurteil, Absichtsbehauptung oder Kausalbeweis.\n- Leite daraus keine Intelligenz, Motive oder psychische Verfassung ab.\n- Stelle begrenzte, umstrittene oder ungeprüfte Aussagen nicht als gesicherte Wissenschaft dar.\n- Erzwinge die Bias-Erklärung nicht, wenn eine einfachere Alternativerklärung besser gestützt ist.\n\n## Referenzen\n\n- [Deutsche Bias-Seite](${SITE}/de/biases/${bias.slug}/)\n- [Kanonischer englischer Eintrag](${bias.canonicalUrl || `${SITE}/biases/${bias.slug}/`})\n- [Deutsche Bias-Daten](${SITE}/data/de/biases.json)\n\n## Portabilität\n\nKostenloser, instruktion-only Agent Skill. Keine Secrets, kein ausführbarer Code und kein verpflichtender Netzwerkzugriff.\n\nLizenz: ${canonicalAgentDoc.license || "CC-BY-NC-SA-4.0"}.\n`;
}

const biasSkillPublic = [];
for (const bias of canonicalBiases) {
  const deBias = deBiasBySlug.get(bias.slug);
  if (!deBias) throw new Error(`Bias Agent Skill cannot find German bias: ${bias.slug}`);
  const name = skillNameForBias(bias);
  const dePath = `/de/agent-skills/${name}/`;
  const enPath = `/agent-skills/${name}/`;
  await addEnglishAlternate(enPath,dePath);
  const description = biasSkillDescription(deBias);
  const skillFile = `${SITE}${dePath}SKILL.md`;
  await writeText(`de/agent-skills/${name}/SKILL.md`,biasSkillMarkdown(deBias,name));
  const schema = {"@context":"https://schema.org","@graph":[{"@type":"CreativeWork","@id":`${SITE}${dePath}#skill`,url:`${SITE}${dePath}`,name:`${deBias.title} Agent Skill`,description,isAccessibleForFree:true,inLanguage:"de",learningResourceType:"Agent Skill",about:{"@type":"DefinedTerm",name:deBias.title,url:`${SITE}/de/biases/${deBias.slug}/`}},{"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Cognitive Biases",item:`${SITE}/de/`},{"@type":"ListItem",position:2,name:"Agent Skills",item:`${SITE}/de/agent-skills/`},{"@type":"ListItem",position:3,name:"Bias Skills",item:`${SITE}/de/agent-skills/biases/`},{"@type":"ListItem",position:4,name:deBias.title,item:`${SITE}${dePath}`}]}]};
  const body = `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation"><a href="/de/">Start</a><span aria-hidden="true">/</span><a href="/de/agent-skills/">Agent Skills</a><span aria-hidden="true">/</span><a href="/de/agent-skills/biases/">Bias Skills</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(deBias.title)}</span></nav><section class="page-hero"><p class="eyebrow">Kostenloser Bias Agent Skill</p><h1>${escapeHtml(deBias.title)}</h1><p class="lede">${escapeHtml(description)}</p><div class="agent-badges">${compatibility.map((item)=>`<span class="agent-badge">${escapeHtml(item)}</span>`).join("")}</div><p><a class="button" href="SKILL.md">SKILL.md öffnen</a> <a class="button button--dark" href="/de/biases/${deBias.slug}/">Bias-Seite öffnen</a></p></section><section class="section"><p class="kicker">Kanonische Linse</p><h2>Nutze den Bias vorsichtig, nicht als Diagnose.</h2><p>${escapeHtml(deBias.summary)}</p><p class="skill-meta">${deBias.localizationState === "evidence-reviewed" ? "Evidence-reviewed German layer" : deBias.canonicalEvidenceReviewAvailable ? "German editorial localization · canonical Evidence Review available" : "German editorial localization"}</p></section><section class="section section--ink"><p class="kicker">Ausgabe</p><ul><li>Erklärung in einfacher Sprache</li><li>Beobachtetes Signal</li><li>Alternativerklärung</li><li>Evidenzgrenze</li><li>Praktische Gegenprüfung</li><li>Was die Einschätzung verändern würde</li></ul></section><section class="section"><p class="kicker">Grenze</p><h2>Eine Linse, kein Urteil.</h2><p>Der Skill muss Unsicherheit erhalten, eine Alternativerklärung nennen und verhindern, dass ein Bias-Label zur Behauptung über Motive, Intelligenz oder Persönlichkeit wird.</p></section>`;
  await writePage(`de/agent-skills/${name}`,page({title:`${deBias.title} Agent Skill | Cognitive Biases`,description,dePath,enPath,current:"agent-skills",body,schema}));
  const biasPagePath = join(OUT,"de","biases",deBias.slug,"index.html");
  let biasPage = await readFile(biasPagePath,"utf8");
  if (!biasPage.includes(`/de/agent-skills/${name}/`)) {
    biasPage = biasPage.replace("</main>",`<aside class="practice-teaser"><span>Mit AI-Agent nutzen</span><a href="/de/agent-skills/${name}/">${escapeHtml(deBias.title)} Agent Skill →</a></aside></main>`);
    await writeFile(biasPagePath,biasPage);
  }
  biasSkillPublic.push({name,title:deBias.title,description,category:"bias-lens",sourceBias:deBias.slug,skillFile,url:`${SITE}${dePath}`,canonicalUrl:`${SITE}${enPath}`,compatibility,security:canonicalAgentDoc.security,localizationState:deBias.localizationState,canonicalEvidenceReviewAvailable:Boolean(deBias.canonicalEvidenceReviewAvailable)});
}

const workflowCards = workflowPublic.map((skill)=>`<article class="practice-set-card"><p class="kicker">Workflow Agent Skill</p><h2><a href="/de/agent-skills/${skill.name}/">${escapeHtml(skill.title)}</a></h2><p>${escapeHtml(skill.description)}</p></article>`).join("");
const agentHubSchema = {"@context":"https://schema.org","@type":"CollectionPage",name:"Agent Skills auf Deutsch",description:`${workflowPublic.length} Workflow Skills und ${biasSkillPublic.length} Bias Skills für AI-Agenten.`,inLanguage:"de"};
const agentHubBody = `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation"><a href="/de/">Start</a><span aria-hidden="true">/</span><span aria-current="page">Agent Skills</span></nav><section class="page-hero"><p class="eyebrow">Agent Skills Library</p><h1>Portable Denk- und Entscheidungsworkflows auf Deutsch.</h1><p class="lede">${workflowPublic.length} wiederverwendbare Workflow Skills plus ${biasSkillPublic.length} fokussierte Bias Skills. Alle sind instruction-only, kostenlos installierbar und bewahren die Evidenzgrenzen des Projekts.</p><p><a class="button" href="/de/agent-skills/biases/">${biasSkillPublic.length} Bias Skills durchsuchen</a></p></section><section class="section"><p class="kicker">Workflow Skills</p><h2>Für Aufgaben, die mehr als einen Bias brauchen.</h2><div class="practice-set-grid">${workflowCards}</div></section><section class="section section--ink"><p class="kicker">Human Skills</p><h2>Erst verstehen und üben, dann automatisieren.</h2><p><a class="button" href="/de/skills/">Denkkompetenzen öffnen</a></p></section>`;
await addEnglishAlternate("/agent-skills/","/de/agent-skills/");
await writePage("de/agent-skills",page({title:"Agent Skills auf Deutsch | Cognitive Biases",description:`${workflowPublic.length} Workflow Agent Skills und ${biasSkillPublic.length} Bias Agent Skills auf Deutsch, mit Guardrails und canonical evidence boundaries.`,dePath:"/de/agent-skills/",enPath:"/agent-skills/",current:"agent-skills",body:agentHubBody,schema:agentHubSchema}));

const biasCards = biasSkillPublic.map((skill)=>`<article class="practice-set-card" data-de-filter-item data-search="${escapeHtml([skill.title,skill.sourceBias].join(" "))}"><p class="kicker">Bias Agent Skill</p><h2><a href="/de/agent-skills/${skill.name}/">${escapeHtml(skill.title)}</a></h2><p>${escapeHtml(skill.description)}</p></article>`).join("");
const biasHubSchema = {"@context":"https://schema.org","@type":"CollectionPage",name:"Deutsche Bias Agent Skills",description:`${biasSkillPublic.length} portable Bias-Linsen als deutsche Agent Skills.`,inLanguage:"de",mainEntity:{"@type":"ItemList",numberOfItems:biasSkillPublic.length,itemListElement:biasSkillPublic.map((skill,index)=>({"@type":"ListItem",position:index+1,name:skill.title,url:skill.url}))}};
const biasHubBody = `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Brotkrümelnavigation"><a href="/de/">Start</a><span aria-hidden="true">/</span><a href="/de/agent-skills/">Agent Skills</a><span aria-hidden="true">/</span><span aria-current="page">Bias Skills</span></nav><section class="page-hero"><p class="eyebrow">Bias Skills</p><h1>${biasSkillPublic.length} kanonische Bias-Linsen für AI-Agenten.</h1><p class="lede">Jeder Skill nutzt genau eine kanonische Bias-Entität, nennt eine Alternativerklärung und muss die Evidenzgrenze erhalten. Die Skills sind Werkzeuge zur Prüfung — keine Diagnosen.</p></section><section class="section"><div class="de-filter" data-de-filter><label for="de-agent-bias-search"><strong>Bias Skill suchen</strong></label><input class="skill-search" id="de-agent-bias-search" type="search" placeholder="z. B. Halo-Effekt, Anchoring, Rückschaufehler" data-de-filter-input><p class="fine-print" data-de-filter-count>Insgesamt: ${biasSkillPublic.length}</p><div class="practice-set-grid" data-de-filter-list>${biasCards}</div><p class="fine-print" data-de-filter-empty hidden>Kein passender Bias Skill gefunden.</p></div></section>`;
await addEnglishAlternate("/agent-skills/biases/","/de/agent-skills/biases/");
await writePage("de/agent-skills/biases",page({title:"Bias Agent Skills auf Deutsch | Cognitive Biases",description:`${biasSkillPublic.length} deutsche Bias Agent Skills mit kanonischer Identität, praktischer Gegenprüfung und sichtbarer Evidenzgrenze.`,dePath:"/de/agent-skills/biases/",enPath:"/agent-skills/biases/",current:"agent-skills",body:biasHubBody,schema:biasHubSchema,script:'<script src="/de-interface.js" defer></script>'}));

const agentCatalog = {schemaVersion:1,locale:"de",state:"reviewed-localization",updatedAt:TODAY,standard:canonicalAgentDoc.standard,license:canonicalAgentDoc.license,security:canonicalAgentDoc.security,workflowSkillCount:workflowPublic.length,biasSkillCount:biasSkillPublic.length,totalSkillCount:workflowPublic.length+biasSkillPublic.length,skills:[...workflowPublic,...biasSkillPublic]};
await writeFile(join(OUT,"data","de","agent-skills.json"),JSON.stringify(agentCatalog,null,2)+"\n");

for (const [biasSlug,skills] of skillsByBias.entries()) {
  const path = join(OUT,"de","biases",biasSlug,"index.html");
  let html = await readFile(path,"utf8");
  const links = skills.map((skill)=>`<a href="/de/skills/${skill.slug}/">${escapeHtml(skill.title)}</a>`).join(" · ");
  if (!html.includes(`data-de-related-skills="${biasSlug}"`)) {
    html = html.replace("</main>",`<aside class="practice-teaser" data-de-related-skills="${biasSlug}"><span>Passende Denkkompetenzen</span>${links}</aside></main>`);
    await writeFile(path,html);
  }
}

async function walkHtml(dir) {
  const result=[];
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const full=join(dir,entry.name);
    if (entry.isDirectory()) result.push(...await walkHtml(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) result.push(full);
  }
  return result;
}
for (const file of await walkHtml(join(OUT,"de"))) {
  let html=await readFile(file,"utf8");
  if (!html.includes('class="site-header"')) continue;
  let changed=false;
  if (!html.includes('href="/de/skills/"')) {
    const englishLink=/<a href="[^"]+" lang="en" hreflang="en">English<\/a>/;
    if (englishLink.test(html)) html=html.replace(englishLink,(match)=>`<a href="/de/skills/">Denkkompetenzen</a><a href="/de/agent-skills/">Agent Skills</a>${match}`);
    else html=html.replace("</nav>",'<a href="/de/skills/">Denkkompetenzen</a><a href="/de/agent-skills/">Agent Skills</a></nav>');
    changed=true;
  }
  if (changed) await writeFile(file,html);
}

const deHomePath=join(OUT,"de","index.html");
let home=await readFile(deHomePath,"utf8");
if (!home.includes('href="/de/skills/"')) {
  home=home.replace("</main>",`<section class="section"><p class="kicker">Denkkompetenzen</p><h2>Wissen, wie ein Bias heißt, reicht nicht.</h2><p class="lede">Trainiere sechs wiederverwendbare Kompetenzen — von Evidenzprüfung und Prognosen bis zum kritischen Einsatz von KI.</p><p><a class="button" href="/de/skills/">Denkkompetenzen öffnen</a> <a class="button button--dark" href="/de/agent-skills/">Agent Skills öffnen</a></p></section></main>`);
  await writeFile(deHomePath,home);
}

let sitemap=await readFile(join(OUT,"sitemap.xml"),"utf8");
const urls=[`${SITE}/de/skills/`,...decisionPublic.map((s)=>s.url),`${SITE}/de/agent-skills/`,`${SITE}/de/agent-skills/biases/`,...workflowPublic.map((s)=>s.url),...biasSkillPublic.map((s)=>s.url)];
for (const url of urls) if (!sitemap.includes(`<loc>${url}</loc>`)) sitemap=sitemap.replace("</urlset>",`  <url><loc>${url}</loc></url>\n</urlset>`);
await writeFile(join(OUT,"sitemap.xml"),sitemap);

console.log(`German skill library generated: ${decisionPublic.length} Decision Skills, ${workflowPublic.length} workflow Agent Skills, ${biasSkillPublic.length} Bias Agent Skills (${workflowPublic.length+biasSkillPublic.length} Agent Skills total).`);
