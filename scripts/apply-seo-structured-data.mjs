import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const LICENSE = "https://creativecommons.org/licenses/by-nc-sa/4.0/";
const PREVIEW = "max-snippet:-1, max-image-preview:large, max-video-preview:-1";
const IMAGE = `${SITE}/assets/1152.png`;

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const biases = (await readJson("data/biases.json")).filter((item) => item.published);
const duplicateDisposition = await readJson("data/duplicate-dispositions.json");
const duplicateIds = new Set((duplicateDisposition.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((item) => !duplicateIds.has(item.id));
const notes = await readJson("data/research-notes.json");
const evidence = await readJson("dist/data/evidence.json");
const evidenceBySlug = new Map((evidence.reviews || []).map((review) => [review.slug, review]));
const noteBySlug = new Map((notes.entries || []).map((note) => [note.slug, note]));
const biasBySlug = new Map(canonicalBiases.map((bias) => [bias.slug, bias]));

const organisation = {
  "@type": "Organization",
  "@id": `${SITE}/#organization`,
  name: "Cognitive Biases",
  url: `${SITE}/`,
  logo: { "@type": "ImageObject", url: `${SITE}/assets/icon2.png` }
};
const website = {
  "@type": "WebSite",
  "@id": `${SITE}/#website`,
  name: "Cognitive Biases",
  url: `${SITE}/`,
  publisher: { "@id": `${SITE}/#organization` }
};

const conceptName = (title = "") => String(title).split(/\s+[–—]\s+/)[0].trim();
const firstParagraph = (description = "") => String(description).split(/\n\n/)[0].replace(/\s+/g, " ").trim();
const dateOnly = (value = "") => /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
const jsonLd = (value, marker) => `<script type="application/ld+json" data-seo-schema="${marker}">${JSON.stringify(value)}</script>`;

function breadcrumb(path, label, parentPath = "/explore/", parentLabel = "Explore") {
  const items = [
    { "@type": "ListItem", position: 1, name: "Cognitive Biases", item: `${SITE}/` }
  ];
  if (parentPath) items.push({ "@type": "ListItem", position: 2, name: parentLabel, item: `${SITE}${parentPath}` });
  items.push({ "@type": "ListItem", position: items.length + 1, name: label, item: `${SITE}${path}` });
  return { "@type": "BreadcrumbList", "@id": `${SITE}${path}#breadcrumb`, itemListElement: items };
}

function sourceSchema(source) {
  const item = {
    "@type": "CreativeWork",
    name: source.title,
    url: source.url
  };
  if (source.year) item.datePublished = String(source.year);
  if (source.doi) item.identifier = `https://doi.org/${source.doi}`;
  return item;
}

async function walkHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

function addPreviewMeta(html) {
  if (/meta\s+name=["']robots["']/i.test(html)) return html;
  return html.replace("</head>", `<meta name="robots" content="${PREVIEW}"></head>`);
}

function addSchema(html, schema, marker) {
  if (html.includes(`data-seo-schema="${marker}"`)) return html;
  return html.replace("</head>", `${jsonLd(schema, marker)}</head>`);
}

for (const path of await walkHtml(OUT)) {
  const html = await readFile(path, "utf8");
  const next = addPreviewMeta(html);
  if (next !== html) await writeFile(path, next);
}

let biasSchemas = 0;
for (const bias of canonicalBiases) {
  const path = `/biases/${bias.slug}/`;
  const file = join(OUT, "biases", bias.slug, "index.html");
  let html = await readFile(file, "utf8");
  const review = evidenceBySlug.get(bias.slug);
  const termId = `${SITE}${path}#term`;
  const citations = (review?.sources || []).map(sourceSchema);
  const modified = review?.reviewedAt || dateOnly(bias.updatedAt);
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      organisation,
      website,
      breadcrumb(path, conceptName(bias.title)),
      {
        "@type": "DefinedTerm",
        "@id": termId,
        name: conceptName(bias.title),
        ...(conceptName(bias.title) !== bias.title ? { alternateName: bias.title } : {}),
        description: firstParagraph(bias.description),
        termCode: String(bias.id),
        url: `${SITE}${path}`,
        inDefinedTermSet: `${SITE}/explore/#bias-library`
      },
      {
        "@type": "WebPage",
        "@id": `${SITE}${path}#webpage`,
        url: `${SITE}${path}`,
        name: bias.title,
        description: firstParagraph(bias.description),
        isPartOf: { "@id": `${SITE}/#website` },
        mainEntity: { "@id": termId },
        breadcrumb: { "@id": `${SITE}${path}#breadcrumb` },
        ...(modified ? { dateModified: modified } : {}),
        ...(citations.length ? { citation: citations } : {}),
        publisher: { "@id": `${SITE}/#organization` },
        isAccessibleForFree: true,
        license: LICENSE
      }
    ]
  };
  html = addSchema(html, graph, "defined-term");
  await writeFile(file, html);
  biasSchemas += 1;
}

const dataPath = "/data/";
const dataFile = join(OUT, "data", "index.html");
let dataHtml = await readFile(dataFile, "utf8");
const distributions = [
  ["Bias library", "biases.json"],
  ["Evidence reviews", "evidence.json"],
  ["Decision contexts", "contexts.json"],
  ["Reviewed comparisons", "comparisons.json"],
  ["Research notes", "research-notes.json"]
].map(([name, file]) => ({
  "@type": "DataDownload",
  name,
  encodingFormat: "application/json",
  contentUrl: `${SITE}/data/${file}`
}));
const datasetDescription = "A maintained, machine-readable knowledge base of cognitive-bias concepts, evidence reviews, decision contexts, comparisons and research notes. Review status is preserved so unreviewed legacy material is not presented as settled evidence.";
const dataGraph = {
  "@context": "https://schema.org",
  "@graph": [
    organisation,
    website,
    breadcrumb(dataPath, "Data", null),
    {
      "@type": "Dataset",
      "@id": `${SITE}/data/#dataset`,
      name: "Cognitive Biases Knowledge Dataset",
      alternateName: "Cognitive Biases public knowledge release",
      description: datasetDescription,
      url: `${SITE}/data/`,
      creator: { "@id": `${SITE}/#organization` },
      publisher: { "@id": `${SITE}/#organization` },
      dateModified: evidence.updatedAt || new Date().toISOString().slice(0, 10),
      version: "1",
      license: LICENSE,
      isAccessibleForFree: true,
      keywords: ["cognitive biases", "decision making", "behavioral science", "AI-assisted decisions"],
      distribution: distributions,
      includedInDataCatalog: {
        "@type": "DataCatalog",
        name: "Cognitive Biases Data",
        url: `${SITE}/data/`
      }
    },
    {
      "@type": "WebPage",
      "@id": `${SITE}/data/#webpage`,
      url: `${SITE}/data/`,
      name: "Data | Cognitive Biases",
      description: datasetDescription,
      isPartOf: { "@id": `${SITE}/#website` },
      mainEntity: { "@id": `${SITE}/data/#dataset` },
      breadcrumb: { "@id": `${SITE}/data/#breadcrumb` }
    }
  ]
};
dataHtml = addSchema(dataHtml, dataGraph, "dataset");
await writeFile(dataFile, dataHtml);

let researchSchemas = 0;
for (const [slug, note] of noteBySlug) {
  const path = `/research/${slug}/`;
  const file = join(OUT, "research", slug, "index.html");
  let html = await readFile(file, "utf8");
  const articleId = `${SITE}${path}#article`;
  const relatedTerms = (note.related || []).filter((relatedSlug) => biasBySlug.has(relatedSlug)).map((relatedSlug) => ({ "@id": `${SITE}/biases/${relatedSlug}/#term` }));
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      organisation,
      website,
      breadcrumb(path, note.title, "/research/", "Research"),
      {
        "@type": "Article",
        "@id": articleId,
        headline: note.title,
        description: note.summary,
        datePublished: note.publishedAt,
        dateModified: notes.updatedAt || note.publishedAt,
        articleSection: "Research",
        image: IMAGE,
        author: { "@id": `${SITE}/#organization` },
        publisher: { "@id": `${SITE}/#organization` },
        mainEntityOfPage: { "@id": `${SITE}${path}#webpage` },
        citation: (note.sources || []).map(sourceSchema),
        ...(relatedTerms.length ? { about: relatedTerms } : {}),
        isAccessibleForFree: true,
        license: LICENSE
      },
      {
        "@type": "WebPage",
        "@id": `${SITE}${path}#webpage`,
        url: `${SITE}${path}`,
        name: note.title,
        description: note.summary,
        isPartOf: { "@id": `${SITE}/#website` },
        breadcrumb: { "@id": `${SITE}${path}#breadcrumb` },
        primaryImageOfPage: { "@type": "ImageObject", url: IMAGE }
      }
    ]
  };
  html = addSchema(html, graph, "research-article");
  await writeFile(file, html);
  researchSchemas += 1;
}

const researchIndex = join(OUT, "research", "index.html");
let researchHtml = await readFile(researchIndex, "utf8");
const researchGraph = {
  "@context": "https://schema.org",
  "@graph": [
    organisation,
    website,
    breadcrumb("/research/", "Research", null),
    {
      "@type": "CollectionPage",
      "@id": `${SITE}/research/#collection`,
      name: "Cognitive Biases Research",
      url: `${SITE}/research/`,
      description: "Reviewed research notes on cognitive biases, decision making and decisions made with AI.",
      isPartOf: { "@id": `${SITE}/#website` },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: (notes.entries || []).map((note, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: note.title,
          url: `${SITE}/research/${note.slug}/`
        }))
      }
    }
  ]
};
researchHtml = addSchema(researchHtml, researchGraph, "research-collection");
await writeFile(researchIndex, researchHtml);

await writeFile(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`SEO structured data applied: ${biasSchemas} canonical DefinedTerm pages, ${researchSchemas} research articles, Dataset metadata, crawl directives and preview controls.`);
