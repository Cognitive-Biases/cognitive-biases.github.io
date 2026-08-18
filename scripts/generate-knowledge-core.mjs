import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DATA_OUT, OUT, SITE, EVIDENCE_CLASSES, readJson, writeJson, hashText, hashFile, entriesOf,
  slugify, normalizeDoi, normalizeUrl, titleOf, canonicalBiasUrl, evidenceClass
} from "./lib/knowledge.mjs";

const release = await readJson("data/release.json");
const releaseDate = new Date(`${release.releaseDate}T00:00:00Z`);
if (Number.isNaN(releaseDate.valueOf())) throw new Error("data/release.json has an invalid releaseDate");
const biases = await readJson(join(DATA_OUT, "biases.json"));
const rawEvidence = await readJson(join(DATA_OUT, "evidence.json"));
const contextsPayload = await readJson(join(DATA_OUT, "contexts.json"));
const comparisonsPayload = await readJson(join(DATA_OUT, "comparisons.json"));
const researchPayload = await readJson(join(DATA_OUT, "research-notes.json"));
const practicePayload = await readJson(join(DATA_OUT, "practice-sets.json"));
const relationsPayload = await readJson("data/relations-v2.json");
const localePolicy = await readJson("data/locales.json");
const translationsDe = await readJson("data/translations-de.json");
const translationsRu = await readJson("data/translations-ru.json");
const evidence = entriesOf(rawEvidence, "reviews");
const contexts = entriesOf(contextsPayload);
const comparisons = entriesOf(comparisonsPayload);
const researchNotes = entriesOf(researchPayload);
const practiceSets = practicePayload.sets || [];
const relations = entriesOf(relationsPayload, "relations");
const biasBySlug = new Map(biases.map((bias) => [bias.slug, bias]));

const sourceMap = new Map();
const provenance = [];
const enrichedEvidence = evidence.map((review) => {
  const sourceIds = [];
  const sources = (review.sources || []).map((source) => {
    const doi = normalizeDoi(source.doi || "");
    const normalizedUrl = normalizeUrl(source.url || "");
    const key = doi ? `doi:${doi}` : normalizedUrl ? `url:${normalizedUrl}` : `title:${String(source.title || "").trim().toLowerCase()}|year:${source.year || ""}`;
    const sourceId = `src-${hashText(key).slice(0, 16)}`;
    sourceIds.push(sourceId);
    const record = sourceMap.get(sourceId) || { sourceId, title:source.title || "Untitled source", year:source.year || null, sourceType:source.type || "unspecified", doi:doi || null, url:source.url || null, normalizedUrl:normalizedUrl || null, usedBy:[] };
    if (!record.usedBy.includes(review.slug)) record.usedBy.push(review.slug);
    sourceMap.set(sourceId, record);
    return { ...source, sourceId };
  });
  const controlledClass = evidenceClass(review);
  provenance.push({ claimId:`claim-${review.slug}`, resourceId:review.slug, canonicalUrl:canonicalBiasUrl(review.slug), evidenceClass:controlledClass, evidenceStatus:review.evidenceStatus || null, qualification:review.qualification || null, reviewedAt:review.reviewedAt || null, sourceIds });
  return { ...review, evidenceClass:controlledClass, sourceIds, sources };
});
const sources = [...sourceMap.values()].sort((a,b) => a.sourceId.localeCompare(b.sourceId));
const reviewBySlug = new Map(enrichedEvidence.map((review) => [review.slug, review]));
const enrichedPracticeSets = practiceSets.map((set) => ({
  ...set,
  scenarios:(set.scenarios || []).map((scenario) => {
    const review = reviewBySlug.get(scenario.answerSlug);
    if (!review) throw new Error(`${scenario.scenarioId || set.slug}: practice answer is not evidence-reviewed: ${scenario.answerSlug}`);
    return { ...scenario, evidenceClass:review.evidenceClass, reviewedAt:review.reviewedAt || null, sourceIds:review.sourceIds };
  })
}));
await writeJson(join(DATA_OUT,"evidence.json"), { ...rawEvidence, schemaVersion:release.schemaVersion, releaseVersion:release.releaseVersion, updatedAt:release.releaseDate, reviews:enrichedEvidence });
await writeJson(join(DATA_OUT,"sources.json"), { schemaVersion:release.schemaVersion, releaseVersion:release.releaseVersion, sources });
await writeJson(join(DATA_OUT,"provenance.json"), { schemaVersion:release.schemaVersion, releaseVersion:release.releaseVersion, claims:provenance });
await writeJson(join(DATA_OUT,"practice-sets.json"), { ...practicePayload, schemaVersion:release.schemaVersion, releaseVersion:release.releaseVersion, updatedAt:release.releaseDate, sets:enrichedPracticeSets });

function freshnessFor(review) {
  if (!review.reviewedAt) return {state:"unreviewed",ageDays:null,dueAfterDays:null};
  const reviewed = new Date(`${String(review.reviewedAt).slice(0,10)}T00:00:00Z`);
  if (Number.isNaN(reviewed.valueOf())) return {state:"unreviewed",ageDays:null,dueAfterDays:null};
  const ageDays = Math.max(0, Math.floor((releaseDate - reviewed) / 86400000));
  const dueAfterDays = ["mixed","contested"].includes(evidenceClass(review)) ? release.freshness.mixedOrContestedDays : release.freshness.defaultDays;
  const dueAt = Math.floor(dueAfterDays * release.freshness.dueFraction);
  return { state:ageDays > dueAfterDays ? "stale" : ageDays >= dueAt ? "due" : "current", ageDays, dueAfterDays };
}
const rank = {stale:0,due:1,unreviewed:2,current:3};
const reviewQueue = enrichedEvidence.map((review) => ({ slug:review.slug, title:titleOf(biasBySlug.get(review.slug)), canonicalUrl:canonicalBiasUrl(review.slug), evidenceClass:review.evidenceClass, evidenceStatus:review.evidenceStatus || null, reviewedAt:review.reviewedAt || null, sourceCount:review.sourceIds.length, ...freshnessFor(review) })).sort((a,b) => rank[a.state]-rank[b.state] || (b.ageDays || 0)-(a.ageDays || 0));
await writeJson(join(DATA_OUT,"review-queue.json"), { releaseVersion:release.releaseVersion, policy:release.freshness, entries:reviewQueue });
const freshness = reviewQueue.reduce((acc,item) => ((acc[item.state]=(acc[item.state]||0)+1),acc), {current:0,due:0,stale:0,unreviewed:0});
const evidenceClasses = enrichedEvidence.reduce((acc,review) => ((acc[review.evidenceClass]=(acc[review.evidenceClass]||0)+1),acc), Object.fromEntries(EVIDENCE_CLASSES.map((key)=>[key,0])));
const metrics = { releaseVersion:release.releaseVersion, schemaVersion:release.schemaVersion, releaseDate:release.releaseDate, concepts:biases.length, evidenceReviewedConcepts:enrichedEvidence.length, reviewedWithMultipleSources:enrichedEvidence.filter((r)=>r.sourceIds.length>=2).length, uniqueSources:sources.length, contexts:contexts.length, comparisons:comparisons.length, reviewedRelations:relations.length, researchNotes:researchNotes.length, practiceSets:enrichedPracticeSets.length, practiceScenarios:enrichedPracticeSets.reduce((sum,set)=>sum+(set.scenarios||[]).length,0), evidenceClasses, freshness };

const translationInputs = {de:translationsDe.entries || [],ru:translationsRu.entries || []};
const translationStatuses = [];
for (const locale of localePolicy.locales || []) {
  if (locale.code === localePolicy.canonicalLocale) continue;
  const existing = new Map((translationInputs[locale.code] || []).map((entry)=>[entry.canonicalId,entry]));
  for (const review of enrichedEvidence) {
    const item = existing.get(review.slug);
    let state = item?.state || "missing";
    if (state === "reviewed" && item.sourceRelease !== release.releaseVersion) state = "stale";
    translationStatuses.push({locale:locale.code,canonicalId:review.slug,canonicalUrl:canonicalBiasUrl(review.slug),localizedLabel:item?.localizedLabel || null,state,sourceRelease:item?.sourceRelease || release.releaseVersion,translatedAt:item?.translatedAt || null,reviewedAt:item?.reviewedAt || null});
  }
}
metrics.translations = Object.fromEntries((localePolicy.locales || []).filter((l)=>l.code!==localePolicy.canonicalLocale).map((locale)=>{const rows=translationStatuses.filter((r)=>r.locale===locale.code);return [locale.code,{total:rows.length,reviewed:rows.filter((r)=>r.state==="reviewed").length,stale:rows.filter((r)=>r.state==="stale").length,draft:rows.filter((r)=>r.state==="draft").length,missing:rows.filter((r)=>r.state==="missing").length}];}));
await writeJson(join(DATA_OUT,"translations.json"), {canonicalLocale:localePolicy.canonicalLocale,releaseVersion:release.releaseVersion,entries:translationStatuses});
await writeJson(join(DATA_OUT,"metrics.json"), metrics);

const schemas = {
  "bias.schema.json":{title:"Cognitive Bias concept",required:["slug","title","published"],properties:{slug:{type:"string"},title:{type:"string"},published:{type:"boolean"}}},
  "evidence.schema.json":{title:"Evidence review",required:["slug","evidenceClass","evidenceStatus","reviewedAt","sourceIds"],properties:{slug:{type:"string"},evidenceClass:{enum:EVIDENCE_CLASSES},evidenceStatus:{type:"string"},reviewedAt:{type:"string",pattern:"^\\d{4}-\\d{2}-\\d{2}"},sourceIds:{type:"array",items:{type:"string"}}}},
  "context.schema.json":{title:"Decision context",required:["slug","title","summary","lenses"],properties:{slug:{type:"string"},title:{type:"string"},summary:{type:"string"},lenses:{type:"array"}}},
  "practice-set.schema.json":{title:"Practice set",required:["slug","title","contextSlug","scenarios"],properties:{slug:{type:"string"},title:{type:"string"},contextSlug:{type:"string"},canonicalUrl:{type:"string"},scenarios:{type:"array",items:{type:"object",required:["scenarioId","prompt","answerSlug","options"],properties:{scenarioId:{type:"string"},prompt:{type:"string"},answerSlug:{type:"string"},options:{type:"array"},sourceIds:{type:"array",items:{type:"string"}}}}}}},
  "comparison.schema.json":{title:"Reviewed comparison",required:["slug","leftSlug","rightSlug","title","summary"],properties:{slug:{type:"string"},leftSlug:{type:"string"},rightSlug:{type:"string"},title:{type:"string"},summary:{type:"string"}}},
  "relation.schema.json":{title:"Reviewed semantic relation",required:["leftSlug","rightSlug","type","note"],properties:{leftSlug:{type:"string"},rightSlug:{type:"string"},type:{type:"string"},note:{type:"string"}}},
  "research-note.schema.json":{title:"Research note",required:["slug","title"],properties:{slug:{type:"string"},title:{type:"string"}}},
  "source.schema.json":{title:"Canonical source",required:["sourceId","title","usedBy"],properties:{sourceId:{type:"string"},title:{type:"string"},doi:{type:["string","null"]},url:{type:["string","null"]},usedBy:{type:"array",items:{type:"string"}}}},
  "rag-chunk.schema.json":{title:"Retrieval chunk",required:["chunkId","canonicalId","canonicalUrl","resourceType","text","reviewState","contentHash"],properties:{chunkId:{type:"string"},canonicalId:{type:"string"},canonicalUrl:{type:"string"},resourceType:{type:"string"},text:{type:"string"},reviewState:{type:"string"},contentHash:{type:"string"}}},
  "manifest.schema.json":{title:"Cognitive Biases release manifest",required:["name","releaseVersion","schemaVersion","files"],properties:{name:{type:"string"},releaseVersion:{type:"string"},schemaVersion:{type:"string"},files:{type:"array"}}},
  "metrics.schema.json":{title:"Corpus quality metrics",required:["releaseVersion","concepts","evidenceReviewedConcepts","freshness"],properties:{releaseVersion:{type:"string"},concepts:{type:"integer"},evidenceReviewedConcepts:{type:"integer"},freshness:{type:"object"}}},
  "translation-status.schema.json":{title:"Translation review state",required:["locale","canonicalId","state","sourceRelease"],properties:{locale:{type:"string"},canonicalId:{type:"string"},state:{enum:["missing","draft","reviewed","stale"]},sourceRelease:{type:"string"}}}
};
for (const [name,schema] of Object.entries(schemas)) await writeJson(join(OUT,"schemas",name), {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":`${SITE}/schemas/${name}`,type:"object",additionalProperties:true,...schema});

const chunks = [];
function addChunk({canonicalId,canonicalUrl,resourceType,section,title,text,reviewState="reviewed",sourceIds=[]}) { const clean=String(text||"").replace(/\s+/g," ").trim(); if(!clean)return; const chunkId=`cb-${slugify(canonicalId)}-${slugify(section)}`; chunks.push({chunkId,canonicalId,canonicalUrl,resourceType,section,title,text:clean,reviewState,sourceIds,releaseVersion:release.releaseVersion,schemaVersion:release.schemaVersion,contentHash:hashText(clean)}); }
for (const review of enrichedEvidence) { const bias=biasBySlug.get(review.slug); const title=titleOf(bias); addChunk({canonicalId:review.slug,canonicalUrl:canonicalBiasUrl(review.slug),resourceType:"concept",section:"evidence",title,text:`${title}. Evidence: ${review.evidenceStatus}. ${review.qualification||""} Mechanism: ${review.mechanism||""} Practical check: ${review.practical||""}`,sourceIds:review.sourceIds}); }
for (const context of contexts) addChunk({canonicalId:context.slug,canonicalUrl:`${SITE}/contexts/${context.slug}/`,resourceType:"context",section:"guide",title:context.title,text:`${context.summary||""} ${(context.useWhen||[]).join(" ")} ${(context.workflow||[]).join(" ")}`});
for (const set of enrichedPracticeSets) { const sourceIds=[...new Set((set.scenarios||[]).flatMap((scenario)=>scenario.sourceIds||[]))]; addChunk({canonicalId:`practice-${set.slug}`,canonicalUrl:set.canonicalUrl||`${SITE}/practice/${set.slug}/`,resourceType:"practice-set",section:"exercises",title:`Practice: ${set.title}`,text:`${set.summary||""} ${(set.scenarios||[]).map((scenario)=>`Check: ${scenario.question||scenario.prompt} Best first lens: ${scenario.answerTitle}.`).join(" ")}`,sourceIds}); }
for (const comparison of comparisons) addChunk({canonicalId:comparison.slug,canonicalUrl:`${SITE}/compare/${comparison.slug}/`,resourceType:"comparison",section:"distinction",title:comparison.title,text:`${comparison.summary||""} ${comparison.keyDifference||""}`});
for (const note of researchNotes) addChunk({canonicalId:note.slug,canonicalUrl:`${SITE}/research/${note.slug}/`,resourceType:"research-note",section:"summary",title:note.title||note.slug,text:`${note.summary||note.description||""} ${note.takeaway||note.whyItMatters||""}`});
const ragPath=join(DATA_OUT,"rag.ndjson");
await writeFile(ragPath,`${chunks.map((item)=>JSON.stringify(item)).join("\n")}\n`);
await writeJson(join(DATA_OUT,"rag-manifest.json"),{releaseVersion:release.releaseVersion,schemaVersion:release.schemaVersion,chunkCount:chunks.length,contentSha256:await hashFile(ragPath),schema:`${SITE}/schemas/rag-chunk.schema.json`});

const cases=[];
for (const review of enrichedEvidence) { const title=titleOf(biasBySlug.get(review.slug)); cases.push({id:`lookup-${review.slug}`,query:`What is ${title}, and what should I be careful not to overclaim?`,task:"concept_lookup",expectedIds:[review.slug],mustPreserveQualification:true},{id:`evidence-${review.slug}`,query:`What does the reviewed evidence say about ${title}? Please include the source page.`,task:"evidence_and_citation",expectedIds:[review.slug],mustPreserveQualification:true}); }
for (const item of comparisons) cases.push({id:`compare-${item.slug}`,query:`How are ${titleOf(biasBySlug.get(item.leftSlug))} and ${titleOf(biasBySlug.get(item.rightSlug))} different?`,task:"comparison",expectedIds:[item.leftSlug,item.rightSlug],expectedComparison:item.slug});
for (const item of contexts) cases.push({id:`context-${item.slug}`,query:`I have a decision about ${item.title.toLowerCase()}. Which reviewed lenses should I check first?`,task:"situation_first",expectedContext:item.slug,expectedIds:(item.lenses||[]).map((lens)=>lens.slug)});
for (const set of enrichedPracticeSets) cases.push({id:`practice-${set.slug}`,query:`Give me evidence-linked practice for ${set.title.toLowerCase()}.`,task:"practice_retrieval",expectedPracticeSet:set.slug,expectedIds:(set.scenarios||[]).map((scenario)=>scenario.answerSlug)});
cases.push({id:"no-answer-diagnosis",query:"Diagnose which cognitive disorder I have from one paragraph.",task:"out_of_scope",expectedNoMatch:true},{id:"no-answer-legal",query:"Tell me whether this contract is legally enforceable.",task:"out_of_scope",expectedNoMatch:true},{id:"no-answer-medical",query:"Which medication should I take for my memory problem?",task:"out_of_scope",expectedNoMatch:true});
await writeJson(join(DATA_OUT,"evals","retrieval-citation.json"),{version:"1.0.0",releaseVersion:release.releaseVersion,methodology:"Expected canonical records are reviewed separately from generated answers. Deterministic retrieval checks IDs, citations and no-match behavior; semantic answer quality remains a human/LLM-evaluation layer.",cases});
console.log(`Knowledge core ${release.releaseVersion}: ${sources.length} sources, ${chunks.length} RAG chunks, ${cases.length} eval cases, ${enrichedPracticeSets.length} practice sets.`);
