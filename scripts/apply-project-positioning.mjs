import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const PLAY = "https://play.google.com/store/apps/details?id=cognitivebiases.thinking.psychology";
const APP_STORE = "https://apps.apple.com/us/app/biases-cognitive-biases/id6741084128";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

function replaceAll(text, from, to) {
  return text.split(from).join(to);
}

function reposition(html) {
  html = replaceAll(
    html,
    `<a class="nav-cta" href="${PLAY}">Get the app <span aria-hidden="true">↗</span></a>`,
    `<a href="/evidence/">Evidence</a><a href="/research/">Research</a><a class="nav-cta" href="/data/">Use the data</a>`
  );

  html = replaceAll(
    html,
    `<div class="footer-links"><a href="/explore/">Explore biases</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div>`,
    `<div class="footer-links"><a href="/explore/">Explore biases</a><a href="/research/">Research</a><a href="/data/">Data</a><a href="/partners/">Partnerships</a><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></div>`
  );

  html = html.replace(/\{"@type":\["SoftwareApplication","MobileApplication"\],"@id":"https:\/\/cognitive-biases\.github\.io\/#app".*?"An educational mobile app for recognizing cognitive biases and reflecting on decisions\."\},/g, "");

  html = replaceAll(html, "Educational mobile app + public reference", "A living guide to better decisions");
  html = replaceAll(
    html,
    "Cognitive Biases helps you recognize the mental shortcuts that shape judgment, understand where they show up, and practice a more deliberate response.",
    "We collect clear explanations of cognitive biases, review what the research actually supports, and connect the findings to decisions people make at work and in everyday life."
  );
  html = replaceAll(
    html,
    `<a class="button" href="${PLAY}">Get it on Google Play <span aria-hidden="true">↗</span></a>`,
    `<a class="button" href="/evidence/">See what we reviewed</a>`
  );
  html = replaceAll(html, "A usable psychology reference", "A public knowledge library");
  html = replaceAll(
    html,
    "Browse clear explanations drawn from the Cognitive Biases collection. Each entry pairs a definition with everyday situations and practical prompts for slowing down.",
    "Browse the library by concept, then go deeper where we have reviewed the evidence. We keep older entries visible while we improve them, rather than pretending the whole collection is equally certain."
  );
  html = replaceAll(html, "Inside the app", "What we are building");
  html = replaceAll(html, "A pocket-sized companion for more considered decisions.", "A growing map of what we know, what is debated, and what is worth checking before a decision.");
  html = replaceAll(
    html,
    `<p class="actions"><a class="button" href="${PLAY}">Google Play <span aria-hidden="true">↗</span></a><a class="button button--dark" href="${APP_STORE}">App Store <span aria-hidden="true">↗</span></a></p>`,
    `<p class="actions"><a class="button" href="/research/">Read the research approach</a><a class="button button--dark" href="/data/">Use the public data</a></p>`
  );
  html = replaceAll(
    html,
    "An educational mobile app and public reference for recognizing cognitive biases, understanding their effects, and trying practical countermeasures.",
    "A public knowledge library for understanding cognitive biases, the evidence behind them, and how they can matter in real decisions."
  );
  html = replaceAll(html, "Educational mobile app and reference for recognizing cognitive biases.", "Public knowledge library for cognitive biases, evidence and decision making.");

  html = replaceAll(
    html,
    "How the Cognitive Biases app and reference library can support reflection on everyday decisions.",
    "How the Cognitive Biases library can help you examine everyday decisions without turning a bias label into a diagnosis."
  );
  html = replaceAll(
    html,
    "The app and library are designed as an accessible starting point for recognizing a bias, naming its possible effect, and choosing a more deliberate next step.",
    "The library is a starting point for recognising a possible thinking pattern, checking the evidence and deciding what is worth questioning next."
  );
  html = replaceAll(html, "How the educational app and library support reflection on decisions.", "How the public library supports reflection on decisions.");

  html = replaceAll(html, "About the Cognitive Biases educational mobile app and public reference library.", "About the Cognitive Biases public knowledge project.");
  html = replaceAll(
    html,
    "The public library is built from the app’s existing bias collection. Individual pages preserve the educational descriptions and related-entry data available in that source.",
    "The library grew out of an earlier mobile app. The website is now the main project: we are keeping the useful corpus, reviewing it against research, improving weak wording and making the knowledge easier for people and other tools to reuse."
  );

  html = replaceAll(html, "Privacy information for the Cognitive Biases website and mobile app.", "Privacy information for the Cognitive Biases public website.");
  html = replaceAll(
    html,
    "The public website is static and does not require an account. The mobile app may process the information described in its applicable store listing and app experience. Contact us with privacy requests.",
    "The public website is static and does not require an account. Contact us if you have a privacy or data question about the public project."
  );

  html = replaceAll(html, "Terms of use for the Cognitive Biases website and mobile app.", "Terms of use for the Cognitive Biases website and public knowledge library.");
  html = replaceAll(html, "The educational Cognitive Biases website and app are provided for personal, non-commercial use.", "The Cognitive Biases website and public knowledge library are provided for educational use under the project licence.");
  html = replaceAll(html, "You may use the website and app for personal, non-commercial purposes.", "You may use the website content for non-commercial purposes under the project licence.");
  html = replaceAll(html, "Terms for the Cognitive Biases educational app and website.", "Terms for the Cognitive Biases website and public knowledge library.");

  html = replaceAll(html, "Support for the Cognitive Biases website and mobile app.", "Support for the Cognitive Biases website and knowledge library.");
  html = replaceAll(html, "Need help with the Cognitive Biases app or website? We are glad to hear from you.", "Found a problem with the website, a source or an entry? We are glad to hear from you.");
  html = replaceAll(
    html,
    "with a description of the issue, the device and app version if relevant, and any helpful screenshots.",
    "with a short description of the issue and any page or source links that will help us reproduce it."
  );

  return html;
}

const files = await walk(OUT);
let changed = 0;
for (const path of files) {
  const before = await readFile(path, "utf8");
  const after = reposition(before);
  if (after !== before) {
    await writeFile(path, after);
    changed += 1;
  }
}

console.log(`Applied human-first project positioning to ${changed} pages.`);
