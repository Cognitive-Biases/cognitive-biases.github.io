import { access, copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DATA_OUT, SITE, readJson, writeJson, hashFile } from "./lib/knowledge.mjs";
const release=await readJson("data/release.json");
const metrics=await readJson(join(DATA_OUT,"metrics.json"));
const reports=(await readJson("data/research-reports.json")).reports || [];
const files=["biases.json","evidence.json","sources.json","provenance.json","contexts.json","practice-sets.json","comparisons.json","relations.json","research-notes.json","rag.ndjson","rag-manifest.json","metrics.json","review-queue.json","translations.json","catalog.json","search-intents.json",...reports.map((r)=>`${r.slug}.json`),"evals/retrieval-citation.json"];
const manifestFiles=[];
for(const relativePath of files){const source=join(DATA_OUT,relativePath);await access(source);manifestFiles.push({path:relativePath,url:`${SITE}/data/${relativePath}`,sha256:await hashFile(source)});}
const manifest={name:"Cognitive Biases Knowledge Dataset",releaseVersion:release.releaseVersion,schemaVersion:release.schemaVersion,releaseDate:release.releaseDate,website:SITE,licence:release.licence,compatibility:release.compatibility,counts:metrics,files:manifestFiles};
await writeJson(join(DATA_OUT,"manifest.json"),manifest);
await writeJson(join(DATA_OUT,"release-notes.json"),{releaseVersion:release.releaseVersion,schemaVersion:release.schemaVersion,releaseDate:release.releaseDate,changes:release.changes});
const releaseDir=join(DATA_OUT,"releases",release.releaseVersion);
for(const relativePath of [...files,"manifest.json","release-notes.json"]){const source=join(DATA_OUT,relativePath);const target=join(releaseDir,relativePath);await mkdir(dirname(target),{recursive:true});await copyFile(source,target);}
console.log(`Knowledge release ${release.releaseVersion}: ${manifestFiles.length} hashed distributions.`);
