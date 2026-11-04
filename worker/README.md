# Probetraining-Worker (Cloudflare Worker)

Liefert auch die Trainer-App aus (`../app`).

Schicht zwischen Trainer-App und Airtable. Hält den Airtable-Token geheim, prüft den Login (Cloudflare Access)
und gibt jedem Trainer nur die Kinder seiner eigenen Mannschaft(en) – mit so wenigen Daten wie nötig.

## API

Trainer-Bereich (hinter Cloudflare Access). Alle Antworten sind JSON mit `Cache-Control: no-store`. Fehler haben die Form `{ "error": "<code>", "message": "<deutscher Text für die App>" }`.

| Methode | Pfad | Antwort |
|---|---|---|
| GET | `/api/me` | `{ email, max: 6, today, teams: [{ id, name, ageClass, trainer }] }` |
| GET | `/api/kids?team=<id>` | `{ team, today, kids: [KidDto] }` – ohne `team` die erste eigene Mannschaft |
| POST | `/api/kids/:id/attend` | `{ kid: KidDto }` – Zähler +1, „Letztes Probetraining“ = heute (beim 1. Mal auch „Erstes Probetraining“) |
| POST | `/api/kids/:id/undo` | `{ kid: KidDto }` – stellt die serverseitig gemerkten Werte wieder her |

`KidDto`: `{ id, name, jg, count, last, status: "probe"|"antrag"|"mitglied"|"spielberechtigt", attendedToday, contact? }`
– `contact: { parent, phone }` gibt es **nur bei erreichtem Limit**. Geburtsdatum, Eltern-E-Mail und Bemerkungen verlassen den Worker nie.

Fehlercodes: `unauthenticated` (401), `unknown_trainer` / `forbidden_team` / `bad_origin` (403),
`not_found` (404, auch für Kinder fremder Mannschaften), `not_in_trial` / `already_today` / `limit_reached` /
`nothing_to_undo` / `changed` (409, jeweils mit aktuellem `kid`), `upstream` (502/503).

### Öffentliches Elternformular (ohne Login, eigene Adresse `PUBLIC_HOST`)

| Methode | Pfad | Antwort |
|---|---|---|
| GET | `/` | Weiterleitung auf `/anmeldung/` (Formular aus `app/anmeldung/`) |
| GET | `/api/anmeldung/teams` | `{ teams: [{ id, name }] }` |
| POST | `/api/anmeldung` | `{ ok, firstName, team, duplicate }` – legt das Kind mit Probetraining 1 und heutigem Datum an |

Fehler: `invalid` / `consent` / `team` (422, mit `fields`), `human` (403, Turnstile), `bad_origin` (403), `too_large` (413), `upstream` (502/503).
Auf `PUBLIC_HOST` liefert der Worker nichts anderes aus. Lokal ist das Formular unter `/anmeldung/` erreichbar
(ohne Turnstile-Schlüssel wird der Bot-Check nur lokal übersprungen).

## Regeln

- **Login:** Das von Cloudflare Access gesetzte JWT (`Cf-Access-Jwt-Assertion`) wird vollständig geprüft
  (Signatur gegen die Access-Zertifikate, Aussteller, Audience, Ablauf). Die E-Mail daraus muss in
  „Mannschaften → Trainer E-Mail“ stehen (Groß-/Kleinschreibung egal). Ein Trainer kann mehrere Mannschaften haben.
- **Mannschafts-Filter:** Jeder Lese- und Schreibzugriff prüft die Zugehörigkeit; Schreibzugriffe lesen dafür den Datensatz frisch.
- **Limit:** „War heute da“ nur im Status Probetraining / Antrag verschickt, nur einmal pro Tag, höchstens 6-mal.
- **Rückgängig:** nur am selben Tag, nur einmal und nur, wenn seitdem niemand den Datensatz geändert hat.
  Die Vorwerte liegen 24 h in Workers KV – der Client kann keine Werte vorgeben.
- **Sichtbarkeit:** Abgesagte nie; Spielberechtigte bis 14 Tage nach „Spielberechtigt seit“.
- **Schreibschutz gegen fremde Seiten:** POST mit fremdem `Origin` wird abgelehnt.
- **Cache:** Mannschaften 5 min, Kinderliste 60 s (im Speicher der Worker-Instanz) – schont das Airtable-Kontingent.
- **Logs:** nur Fehlercodes, keine Kinderdaten.
- **Austauschbare Datenquelle:** `src/datasource.ts` ist das Interface, `src/airtable.ts` die Airtable-Umsetzung
  (Feld-IDs aus `docs/airtable-schema.md`). Für SeaTable genügt eine zweite Umsetzung.

## Entwickeln

```bash
cd worker
npm install
npm run check          # Typprüfung + Tests
cp .dev.vars.example .dev.vars   # Token + Test-E-Mail eintragen
npm run dev            # http://localhost:8787 – Login ist lokal durch DEV_USER_EMAIL ersetzt
```

Ohne Airtable-Token: `npm run dev:mock` startet einen lokalen Airtable-Nachbau mit erfundenen Daten
(`dev/mock-airtable.mjs`, Trainer mit zwei Mannschaften) und den Worker dazu → http://localhost:8787

Tests (`test/`) laufen ohne Cloudflare und ohne Airtable, nur mit erfundenen Beispieldaten.
Vorschau-Seiten für claude.ai: `node dev/build-testversion.mjs` (Trainer-App) und `node dev/build-formular-vorschau.mjs` (Elternformular).

## Konfiguration für den Betrieb

Siehe `wrangler.jsonc`. Benötigt (Details folgen in der Deployment-Anleitung, Aufgabe 7):

- Secret `AIRTABLE_TOKEN` (`npx wrangler secret put AIRTABLE_TOKEN`) – Personal Access Token nur mit
  `data.records:read` + `data.records:write`, nur für Base `appBKLVL4A4mI2QHr`.
- Secret `TURNSTILE_SECRET` und Websiteschlüssel in `app/anmeldung/config.js`; `PUBLIC_HOST` in `wrangler.jsonc`.
- KV-Namespace `UNDO` anlegen und ID in `wrangler.jsonc` eintragen.
- `ACCESS_TEAM_DOMAIN` und `ACCESS_AUD` aus der Access-Anwendung eintragen. Ohne diese Werte lässt der Worker niemanden rein.
- Route/Custom Domain eintragen, sobald esc-06.de im Vereinskonto liegt. `workers_dev` ist bewusst aus.
