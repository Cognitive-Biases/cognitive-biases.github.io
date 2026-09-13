import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourcePath = process.argv[2] || "data/localization-exceptions.json";
const outputPath = process.argv[3] || ".arwp/localization-debt.generated.json";
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

if (!Array.isArray(source.exceptions)) {
  throw new Error(`${sourcePath}: expected an exceptions array.`);
}

const entries = source.exceptions.map((item) => {
  if (!item?.id || !item?.reason || !Array.isArray(item.locales) || !item.locales.length || !item.createdOn || !item.expiresOn) {
    throw new Error(`${item?.id || "<unknown>"}: ARWP projection requires id, reason, locales, createdOn and expiresOn.`);
  }
  if (!datePattern.test(item.createdOn) || !datePattern.test(item.expiresOn)) {
    throw new Error(`${item.id}: createdOn and expiresOn must use YYYY-MM-DD.`);
  }
  if (item.createdOn > item.expiresOn) {
    throw new Error(`${item.id}: createdOn must not be after expiresOn.`);
  }
  if (item.paths != null && (!Array.isArray(item.paths) || item.paths.some((value) => typeof value !== "string" || !value.trim()))) {
    throw new Error(`${item.id}: paths must be an array of non-empty strings when present.`);
  }

  return {
    id: item.id,
    reason: item.reason,
    createdAt: `${item.createdOn}T00:00:00Z`,
    expiresAt: `${item.expiresOn}T23:59:59Z`,
    status: "active",
    evidence: [],
    scope: {
      locales: [...item.locales].sort(),
      ...(item.paths?.length ? { paths: [...item.paths].sort() } : {})
    }
  };
}).sort((a, b) => a.id.localeCompare(b.id));

const ids = entries.map((entry) => entry.id);
if (new Set(ids).size !== ids.length) {
  throw new Error(`${sourcePath}: exception ids must be unique.`);
}

const projected = {
  $schema: "https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/6a8168b854ed6f557f5906808a83eb67be9f42ea/schema/quality-debt-ledger.schema.json",
  version: "0.1",
  entries
};

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(projected, null, 2)}\n`, "utf8");
console.log(`Projected ${entries.length} localization exception(s) to ${outputPath}.`);
