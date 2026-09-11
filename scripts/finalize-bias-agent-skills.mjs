import { readFile, writeFile } from "node:fs/promises";

const hubPath = "dist/agent-skills/index.html";
let hub = await readFile(hubPath, "utf8");

const oldHeading = "A bias is a lens. A skill is a job your agent can actually do.";
const oldCopy = "We do not create hundreds of tiny skills that merely repeat bias definitions. The marketplace packages useful workflows: review a decision, challenge evidence, forecast, verify information or use AI without letting fluent output become evidence.";
const newHeading = "Every bias is installable. Workflows go further.";
const newCopy = "Every published canonical cognitive bias has its own focused Agent Skill, generated from the canonical library and free to install. Broader workflow skills remain available for jobs such as decision review, evidence evaluation, forecasting, verification and AI-assisted reasoning.";

if (hub.includes(oldHeading)) hub = hub.replace(oldHeading, newHeading);
if (hub.includes(oldCopy)) hub = hub.replace(oldCopy, newCopy);

if (hub.includes("The initial collection is instruction-only.")) {
  hub = hub.replace("The initial collection is instruction-only.", "The collection is instruction-only.");
}

if (!hub.includes("Every bias is installable")) throw new Error("Agent Skills hub is missing the per-bias marketplace positioning.");
if (!hub.includes("/agent-skills/biases/")) throw new Error("Agent Skills hub is missing the Bias Skills collection link.");

await writeFile(hubPath, hub);
console.log("Finalized Agent Skills marketplace copy for the full per-bias collection.");
