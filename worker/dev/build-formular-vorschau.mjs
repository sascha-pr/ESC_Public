// Baut aus app/anmeldung/index.html eine Vorschau mit nachgebautem Server (nur erfundene Daten, nichts wird gespeichert).
// Aufruf: node dev/build-formular-vorschau.mjs [Zieldatei]   (Standard: ../testversion/anmeldung.html)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = resolve(process.argv[2] ?? `${root}/testversion/anmeldung.html`);
let html = readFileSync(`${root}/app/anmeldung/index.html`, "utf8");
const config = readFileSync(`${root}/app/anmeldung/config.js`, "utf8");
const logo = "data:image/png;base64," + readFileSync(`${root}/app/anmeldung/wappen.png`).toString("base64");

const mock = `
/* Vorschau: Server-Nachbau im Browser */
(function(){
  var TEAMS = [{id:'F1',name:'F1-Jugend'},{id:'F2',name:'F2-Jugend'},{id:'E1',name:'E1-Jugend'},{id:'D1',name:'D1-Jugend'}];
  var seen = {};
  window.fetch = function(input, init){
    var url = new URL(typeof input === 'string' ? input : input.url, location.href);
    var reply = function(status, body){ return new Promise(function(res){ setTimeout(function(){ res(new Response(JSON.stringify(body), {status:status, headers:{'Content-Type':'application/json'}})); }, 450); }); };
    if (url.pathname === '/api/anmeldung/team'){
      var t = TEAMS.filter(function(x){ return x.id === url.searchParams.get('id'); })[0];
      return t ? reply(200, t) : reply(404, {error:'team'});
    }
    if (url.pathname === '/api/anmeldung' && init && init.method === 'POST'){
      var v = JSON.parse(init.body), team = TEAMS.filter(function(t){ return t.id === v.team; })[0];
      var name = v.childName.replace(/\\s+/g,' ').trim(), key = v.team + '|' + name.toLowerCase() + '|' + v.birthDate;
      var dup = !!seen[key]; if (!dup) seen[key] = name;
      return reply(200, {ok:true, firstName:(seen[key]||name).split(' ')[0], team:team.name, duplicate:dup});
    }
    return reply(404, {error:'no_route'});
  };
})();`;

const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`Nicht gefunden: ${from.slice(0, 60)}`);
  html = html.split(from).join(to);
};
// Nur den Seiteninhalt übernehmen; Kopf (Schriften, Stil) aus <head> behalten
const head = html.slice(html.indexOf("<head>") + 6, html.indexOf("</head>"))
  .replace(/<meta charset[^>]*>\s*/, "").replace(/<meta name="viewport"[^>]*>\s*/, "")
  .replace(/<link rel="icon"[^>]*>\s*/, "")
  .replace("<title>Anmeldung Probetraining · ESC Rellinghausen 06</title>", "<title>Anmeldeformular Probetraining</title>");
html = head + html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"));
swap('src="wappen.png"', `src="${logo}"`);
swap('<script src="config.js"></script>', `<script>\n${config}\n${mock}\n</script>`);
// Vorschau: Mannschaft wie nach dem Scannen vorbelegt
swap("var wanted = new URLSearchParams(location.search).get('m');", "var wanted = new URLSearchParams(location.search).get('m') || decodeURIComponent(location.hash.slice(1)) || 'F1';");

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Vorschau geschrieben: ${out}`);
