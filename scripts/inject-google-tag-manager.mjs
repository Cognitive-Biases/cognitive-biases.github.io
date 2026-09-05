import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const marker='<script src="/assets/analytics-consent.js" defer></script>';
async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const target=path.join(dir,entry.name);
    if(entry.isDirectory()) await walk(target);
    else if(entry.name.endsWith(".html")){
      let html=await readFile(target,"utf8");
      html=html.replace(/\s*<!-- Google Tag Manager -->.*?<!-- End Google Tag Manager -->/gs,"").replace(/\s*<!-- Google Tag Manager \(noscript\) -->.*?<!-- End Google Tag Manager \(noscript\) -->/gs,"").replace(/\s*<!-- portfolio-analytics-consent -->.*?<!-- \/portfolio-analytics-consent -->/gs,"");
      if(!html.includes(marker)) html=html.replace("</head>","  <!-- Consent-aware aggregate website analytics -->\n  "+marker+"\n</head>");
      await writeFile(target,html);
    }
  }
}
await walk("dist");
