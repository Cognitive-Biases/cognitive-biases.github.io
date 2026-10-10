// Render the maintained description; do not invent missing examples or evidence.
export const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const labels = new Map([
  ["Where’s the trap?", "Examples and situations"],
  ["Where can it show up?", "Examples and situations"],
  ["How to avoid it?", "Questions to check"],
  ["How to use it?", "Practical considerations"],
  ["A better check", "Questions to check"],
  ["Classic examples", "Classic examples"],
  ["What did the study actually show?", "What the study showed"],
]);
export function descriptionBlocks(description) {
  return String(description).split(/\n\s*\n/).filter(Boolean).map((block, index) => {
    const lines = block.trim().split(/\n/);
    const label = lines[0].replace(/^[🔍💡]\s*/u, "").trim();
    const heading = index ? labels.get(label) : null;
    return { heading: heading || null, text: heading ? lines.slice(1).join("\n") : block.trim() };
  });
}
export function renderDescription(description) {
  const blocks = descriptionBlocks(description);
  const renderLines = text => {
    let output = "", list = [];
    const flush = () => { if (list.length) output += `<ul>${list.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`; list = []; };
    for (const line of text.split("\n").filter(Boolean)) {
      if (/^-\s+/.test(line)) list.push(line.replace(/^-\s+/, ""));
      else { flush(); output += `<p>${escapeHtml(line)}</p>`; }
    }
    flush(); return output;
  };
  return blocks.map((block, index) => index === 0
    ? `<p class="definition">${escapeHtml(block.text).replaceAll("\n", "<br>")}</p>`
    : block.heading ? `<section class="bias-explanation-section"><h2>${escapeHtml(block.heading)}</h2>${renderLines(block.text)}</section>` : renderLines(block.text)).join("");
}
export function descriptionSnippet(description, limit = 180) {
  const opening = String(description).split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
  if (opening.length <= limit) return opening;
  const sentences = opening.match(/[^.!?]+[.!?](?:[”’"']|$)?/g) || [];
  let result = "";
  for (const sentence of sentences) {
    const candidate = `${result} ${sentence}`.trim();
    if (candidate.length > limit) break;
    result = candidate;
  }
  if (result) return result;
  return `${opening.slice(0, limit - 1).replace(/\s+\S*$/, "").replace(/[,;:]$/, "")}…`;
}
