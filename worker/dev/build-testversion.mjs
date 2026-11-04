// Baut aus app/index.html eine Testversion mit API-Nachbau im Browser (app/dev/mock-api.js).
// Aufruf: node dev/build-testversion.mjs [Zieldatei]   (Standard: ../testversion/index.html)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = resolve(process.argv[2] ?? `${root}/testversion/index.html`);
let html = readFileSync(`${root}/app/index.html`, "utf8");
const config = readFileSync(`${root}/app/config.js`, "utf8");
const mock = readFileSync(`${root}/app/dev/mock-api.js`, "utf8");

const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`Nicht gefunden: ${from.slice(0, 60)}`);
  html = html.replace(from, to);
};
// Nur den Seiteninhalt übernehmen (claude.ai ergänzt das Gerüst beim Veröffentlichen)
html = html.slice(html.indexOf("<body>") + "<body>".length, html.lastIndexOf("</body>"));
swap('<script src="config.js"></script>', `<script>\n${config}</script>\n<script>\n${mock}</script>`);
swap("<title>Probetraining-App</title>", "<title>Probetraining-App Test</title>\n<style>[hidden]{display:none!important}</style>");
swap("location.href=LOGOUT_URL;", "toast('In der echten App meldet „Abmelden“ dich bei Cloudflare ab.');");
swap("\n  loadMe();\n})();", "\n  window.__appReload = loadMe;\n  loadMe();\n})();");
// Der Aushang ist in der Testversion nicht dabei
swap(`'<div><a class="linkbtn" href="aushang.html?team='+encodeURIComponent(t.name)+'&amp;id='+encodeURIComponent(t.id)+'" target="_blank" rel="noopener">Aushang mit diesem Code für den Platz öffnen</a></div>'`,
  `'<p class="small muted">In der echten App gibt es hier zusätzlich den Aushang zum Ausdrucken.</p>'`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Testversion geschrieben: ${out}`);
