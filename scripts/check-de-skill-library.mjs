import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const SITE="https://cognitive-biases.github.io";
const OUT="dist";
const canonicalSkills=JSON.parse(await readFile("data/skills.json","utf8")).entries || [];
const deSkillsDoc=JSON.parse(await readFile("data/de/skills.json","utf8"));
const canonicalAgent=JSON.parse(await readFile("data/agent-skills.json","utf8"));
const deAgentDoc=JSON.parse(await readFile("data/de/agent-skills.json","utf8"));
const biases=JSON.parse(await readFile("data/biases.json","utf8"));
const duplicates=JSON.parse(await readFile("data/duplicate-dispositions.json","utf8"));
const duplicateIds=new Set((duplicates.groups||[]).flatMap((group)=>group.duplicateIds||[]));
const canonicalBiases=biases.filter((bias)=>bias.published&&!duplicateIds.has(bias.id));
const failures=[];
const fail=(message)=>failures.push(message);
const exists=async(path)=>{try{await access(path);return true;}catch{return false;}};

function skillNameForBias(bias){
  const base=`bias-${String(bias.slug).toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").replace(/-+/g,"-")}`;
  if(base.length<=64)return base;
  const suffix=createHash("sha1").update(String(bias.slug)).digest("hex").slice(0,8);
  return `${base.slice(0,55).replace(/-+$/g,"")}-${suffix}`;
}

if(deSkillsDoc.locale!=="de"||deSkillsDoc.state!=="reviewed-localization")fail("data/de/skills.json must be reviewed-localization/de.");
if(deAgentDoc.locale!=="de"||deAgentDoc.state!=="reviewed-localization")fail("data/de/agent-skills.json must be reviewed-localization/de.");
const deSkills=deSkillsDoc.entries||[];
const deAgents=deAgentDoc.skills||[];
const canonicalSkillSlugs=new Set(canonicalSkills.map((entry)=>entry.slug));
const deSkillSlugs=new Set(deSkills.map((entry)=>entry.slug));
const canonicalAgentNames=new Set((canonicalAgent.skills||[]).map((entry)=>entry.name));
const deAgentNames=new Set(deAgents.map((entry)=>entry.name));
if(deSkills.length!==canonicalSkills.length)fail(`Decision Skill source parity ${deSkills.length}/${canonicalSkills.length}.`);
if(deAgents.length!==(canonicalAgent.skills||[]).length)fail(`Workflow Agent Skill source parity ${deAgents.length}/${(canonicalAgent.skills||[]).length}.`);
for(const slug of canonicalSkillSlugs)if(!deSkillSlugs.has(slug))fail(`Missing German Decision Skill source: ${slug}`);
for(const name of canonicalAgentNames)if(!deAgentNames.has(name))fail(`Missing German workflow Agent Skill source: ${name}`);
for(const entry of deSkills){
  if(!entry.title||entry.title.length<5)fail(`${entry.slug}: weak German title.`);
  if(!entry.summary||entry.summary.length<80)fail(`${entry.slug}: summary too short.`);
  if(!entry.outcome||entry.outcome.length<60)fail(`${entry.slug}: outcome too short.`);
  if(!Array.isArray(entry.whenToUse)||entry.whenToUse.length<3)fail(`${entry.slug}: not enough whenToUse items.`);
  if(!Array.isArray(entry.actions)||entry.actions.length<4)fail(`${entry.slug}: not enough actions.`);
}
for(const entry of deAgents){
  if(!entry.title||!entry.description||entry.description.length<100)fail(`${entry.name}: incomplete German Agent Skill metadata.`);
  if(!Array.isArray(entry.useWhen)||entry.useWhen.length<3)fail(`${entry.name}: weak useWhen.`);
  if(!Array.isArray(entry.procedure)||entry.procedure.length<6)fail(`${entry.name}: procedure must have >=6 steps.`);
  if(!Array.isArray(entry.output)||entry.output.length<5)fail(`${entry.name}: output contract too small.`);
  if(!Array.isArray(entry.guardrails)||entry.guardrails.length<4)fail(`${entry.name}: guardrails too small.`);
}
const sourceText=JSON.stringify({deSkills,deAgents});
for(const phrase of ["When to use","Required output","Evidence and safety boundaries","Do not diagnose"])if(sourceText.includes(phrase))fail(`Untranslated English source phrase: ${phrase}`);

if(!(await exists(OUT))){
  if(failures.length){console.error(failures.join("\n"));process.exit(1);} 
  console.log(`German skill source parity passed: ${deSkills.length} Decision Skills and ${deAgents.length} workflow Agent Skills.`);
  process.exit(0);
}

const publicSkills=JSON.parse(await readFile(join(OUT,"data","de","skills.json"),"utf8"));
const publicAgents=JSON.parse(await readFile(join(OUT,"data","de","agent-skills.json"),"utf8"));
if((publicSkills.skills||[]).length!==canonicalSkills.length)fail(`Public German Decision Skills mismatch.`);
const expectedWorkflow=(canonicalAgent.skills||[]).length;
const expectedBias=canonicalBiases.length;
const expectedTotal=expectedWorkflow+expectedBias;
if(publicAgents.workflowSkillCount!==expectedWorkflow)fail(`Public workflow Agent Skills ${publicAgents.workflowSkillCount}/${expectedWorkflow}.`);
if(publicAgents.biasSkillCount!==expectedBias)fail(`Public Bias Agent Skills ${publicAgents.biasSkillCount}/${expectedBias}.`);
if(publicAgents.totalSkillCount!==expectedTotal)fail(`Public Agent Skills total ${publicAgents.totalSkillCount}/${expectedTotal}.`);

async function checkPage(relativePath,dePath,enPath,label){
  const file=join(OUT,relativePath,"index.html");
  if(!(await exists(file))){fail(`${label}: missing page ${dePath}`);return;}
  const html=await readFile(file,"utf8");
  if(!html.includes('<html lang="de">'))fail(`${label}: lang=de missing.`);
  if(!html.includes(`<link rel="canonical" href="${SITE}${dePath}">`))fail(`${label}: self canonical missing.`);
  if(enPath&&!html.includes(`<link rel="alternate" hreflang="en" href="${SITE}${enPath}">`))fail(`${label}: English hreflang missing.`);
  if(!html.includes('href="/de/skills/"'))fail(`${label}: Denkkompetenzen discovery missing.`);
  if(!html.includes('href="/de/agent-skills/"'))fail(`${label}: Agent Skills discovery missing.`);
}

await checkPage("de/skills","/de/skills/","/skills/","Decision Skill hub");
for(const skill of canonicalSkills){
  await checkPage(`de/skills/${skill.slug}`,`/de/skills/${skill.slug}/`,`/skills/${skill.slug}/`,skill.slug);
  const enHtml=await readFile(join(OUT,"skills",skill.slug,"index.html"),"utf8");
  if(!enHtml.includes(`<link rel="alternate" hreflang="de" href="${SITE}/de/skills/${skill.slug}/">`))fail(`${skill.slug}: reciprocal German hreflang missing on English skill.`);
}
await checkPage("de/agent-skills","/de/agent-skills/","/agent-skills/","Agent Skills hub");
await checkPage("de/agent-skills/biases","/de/agent-skills/biases/","/agent-skills/biases/","Bias Skills hub");

for(const workflow of canonicalAgent.skills||[]){
  const name=workflow.name;
  await checkPage(`de/agent-skills/${name}`,`/de/agent-skills/${name}/`,`/agent-skills/${name}/`,name);
  const mdPath=join(OUT,"de","agent-skills",name,"SKILL.md");
  if(!(await exists(mdPath))){fail(`${name}: German SKILL.md missing.`);continue;}
  const md=await readFile(mdPath,"utf8");
  if(!md.includes(`name: ${name}`))fail(`${name}: canonical skill name missing in frontmatter.`);
  for(const heading of ["## Wann einsetzen","## Ablauf","## Erwartete Ausgabe","## Grenzen und Guardrails"])if(!md.includes(heading))fail(`${name}: German SKILL.md missing ${heading}.`);
}

for(const bias of canonicalBiases){
  const name=skillNameForBias(bias);
  await checkPage(`de/agent-skills/${name}`,`/de/agent-skills/${name}/`,`/agent-skills/${name}/`,name);
  const mdPath=join(OUT,"de","agent-skills",name,"SKILL.md");
  if(!(await exists(mdPath))){fail(`${name}: German bias SKILL.md missing.`);continue;}
  const md=await readFile(mdPath,"utf8");
  if(!md.includes(`name: ${name}`))fail(`${name}: canonical skill name missing.`);
  if(!md.includes("Alternative Erklärung ohne Bias"))fail(`${name}: required alternative-explanation output missing.`);
  if(!md.includes("Diagnose"))fail(`${name}: diagnosis guardrail missing.`);
  const biasPage=await readFile(join(OUT,"de","biases",bias.slug,"index.html"),"utf8");
  if(!biasPage.includes(`/de/agent-skills/${name}/`))fail(`${bias.slug}: German bias page lacks Agent Skill backlink.`);
}

const sitemap=await readFile(join(OUT,"sitemap.xml"),"utf8");
const sitemapUrls=[`${SITE}/de/skills/`,...canonicalSkills.map((s)=>`${SITE}/de/skills/${s.slug}/`),`${SITE}/de/agent-skills/`,`${SITE}/de/agent-skills/biases/`,...(canonicalAgent.skills||[]).map((s)=>`${SITE}/de/agent-skills/${s.name}/`),...canonicalBiases.map((b)=>`${SITE}/de/agent-skills/${skillNameForBias(b)}/`)];
for(const url of sitemapUrls)if(!sitemap.includes(`<loc>${url}</loc>`))fail(`Sitemap missing ${url}`);
const deHome=await readFile(join(OUT,"de","index.html"),"utf8");
if(!deHome.includes('href="/de/skills/"')||!deHome.includes('href="/de/agent-skills/"'))fail("German homepage skill discovery missing.");
const biasHub=await readFile(join(OUT,"de","agent-skills","biases","index.html"),"utf8");
if(!biasHub.includes("data-de-filter"))fail("German Bias Agent Skills hub lacks search/filter.");

if(failures.length){
  console.error("German skill library check failed:\n"+failures.map((x)=>`- ${x}`).join("\n"));
  process.exit(1);
}
console.log(`German skill library check passed: ${canonicalSkills.length} Decision Skills, ${expectedWorkflow} workflow Agent Skills, ${expectedBias} Bias Agent Skills (${expectedTotal} Agent Skills total).`);
