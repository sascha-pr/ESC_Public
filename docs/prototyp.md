# Prototyp `prototype/index.html` – Aufbau (Archiv)

> **Seit 06.11.2026 Archiv:** wird nicht mehr gepflegt. Maßgeblich sind die echte App (`app/`) und die Testversion. Der öffentliche
> Prototyp-Link zeigt eine Hinweisseite (`prototype/weiterleitung.html`) mit Links zur Testversion und zur Formular-Vorschau.

Einzelne HTML-Datei, kein Build. Im Browser direkt öffnen. Ursprünglich als claude.ai-Artifact gebaut
(dort ohne `<html>/<head>`-Gerüst); die Datei hier ist um das Gerüst ergänzt und läuft eigenständig.

## Design
- Tokens im `:root` (Hell/Dunkel über `prefers-color-scheme` und `[data-theme]`).
- Vereinsfarben aus dem Wappen: Rot `#c9252b`, Eichengrün `#006f45`, Schwarz `#141414`.
- Schriften: Barlow Condensed (Überschriften, Buttons, Großbuchstaben), Barlow (Text) über Google Fonts.
- Wappen als Base64 in der Variable `LOGO` eingebettet (Original in `assets/`).

## Logik (im `<script>` am Ende)
- `MAX = 3` – Probetrainings bis Antrag Pflicht (seit 06.11.2026, vorher 6; Demo-Löschfrist im Formulartext 8 Wochen).
- `TEAMS` – Demo-Mannschaften mit Trainer-E-Mail (später aus `/api/me`).
- `seed()` – Beispielkinder (später aus `/api/kids`).
- `state` – lokaler Zustand; `undo` merkt sich den Vorwert pro Kind (später serverseitig).
- `attend(id)` / `undo(id)` – „War heute da“ / „Rückgängig“ (später POST an Worker).
- `submitForm()` – Demo-Elternformular (später Airtable-Formular oder Worker-Endpunkt).
- Login-Screen (E-Mail → Code) ist nur Demo; im Echtbetrieb übernimmt Cloudflare Access.
- `localStorage` nur für zuletzt gewählte Demo-Mannschaft.

## Ansichten (Prototyp)

Seit 06.11.2026 wie in der echten App: Standardansicht **Liste** (eine Zeile pro Kind, „2 von 3“, Button „War heute da“),
Umschalter zu **Karten**; Kopf und Abschnitte zählen in Worten („2 Kinder im Probetraining“).

1. Anmeldung (Demo) → 2. Mannschaft: Karten „Im Probetraining“ mit Zählerkreisen 1…6, Button „War heute da“,
   bei Limit rote Karte mit Elternkontakt → 3. Liste „Angemeldet“ (Antrag/Mitglied/spielberechtigt)
   → 4. Sheet „Neues Kind“ mit QR-Code und Demo-Elternformular.

## Echte App `app/index.html` (Aufgabe 5, Stand 03.11.2026)

Gleiche Datei-Struktur, gleiches CSS und HTML-Gerüst wie der Prototyp – nur das Skript ist neu. Der Prototyp bleibt
unverändert als Demo mit Beispieldaten (für Trainer-Tests ohne Login). Ausgeliefert wird `app/` vom Worker (`worker/wrangler.jsonc` → `assets`).

- Daten kommen aus dem Worker: `/api/me` (Trainer, Mannschaften, `max`, `today`) und `/api/kids?team=…`.
- Ansicht „Liste“ (Standard; Name und Button „War heute da“ in einer Zeile, darunter Punkte „2 von 3“ und Hinweise) oder „Karten“ (große Karten wie im Prototyp, mit Geburtsdatum); Umschalter über der Liste, Wahl in `localStorage` (`pt-view`).
- Kopf und Abschnitte zählen in Worten: „3 Kinder im Probetraining“, „1 Kind mit Antrag“, „2 Kinder sind Mitglied“.
- „War heute da“ / „Rückgängig“ → `POST /api/kids/:id/attend|undo`; die Karte nimmt die Antwort des Servers.
  Während der Anfrage ist der Button gesperrt („Wird eingetragen …“), Doppel-Tipps zählen nicht doppelt.
- „Heute eingetragen“ kommt vom Server (`attendedToday`) – stimmt also auch nach Neuladen und auf anderen Handys.
- Kein eigener Login-Screen mehr: Anmeldung macht Cloudflare Access. „Abmelden“ → `/cdn-cgi/access/logout`.
- Zustände im Stil des früheren Anmelde-Panels: *Einen Moment …* (laden), *Bitte neu anmelden* (Sitzung abgelaufen),
  *Kein Zugang* (E-Mail keiner Mannschaft zugeordnet), *Das hat nicht geklappt* (Fehler, mit „Nochmal versuchen“).
  Fehler beim Tippen erscheinen als Hinweis unten, ohne die Liste zu verlieren.
- Trainer mit mehreren Mannschaften bekommen im Kopf Umschalter; die Wahl merkt sich das Handy (`localStorage`).
- Liste frischt sich auf, wenn die App nach über einer Minute wieder in den Vordergrund kommt; Fußzeile „Stand hh:mm · Aktualisieren“.
- „Neues Kind“: QR-Code zum eigenen Elternformular (`anmeldung.<APP-DOMAIN>/?m=<Mannschafts-ID>`, ohne Login); Adresse wird in `app/config.js` aus der App-Adresse abgeleitet.
- „Eltern ohne Handy?“: Button „Auf meinem Handy öffnen“ öffnet dasselbe Formular auf dem Trainer-Handy (`&via=trainer`: Hinweis „Bitte als Eltern selbst ausfüllen“, kein Autofill der Trainer-Daten, am Ende „Handy zurückgeben“).
- E-Mail unzustellbar: rote Box mit der falschen Adresse und „E-Mail korrigieren“ → Fenster mit neuer Adresse (zweimal) oder „Antrag auf Papier geben“.
- Elternformular: „E-Mail wiederholen“ und Tippfehler-Hinweis („Meintet ihr …@gmail.com?“).
- Eltern ohne E-Mail: Karte zeigt „Keine E-Mail …“, ab dem 2. Training gelb „Bitte den Mitgliedsantrag auf Papier mitgeben“.
- `app/aushang.html?team=<Mannschaft>`: druckbarer A4-Aushang mit großem QR-Code, aus dem „Neues Kind“-Blatt verlinkt.
- `MAX = 3` als Vorgabe, der Server meldet den gültigen Wert.

Lokal ausprobieren ohne Airtable: `cd worker && npm run dev:mock` → http://localhost:8787 (erfundene Daten, siehe `worker/dev/mock-airtable.mjs`).

## Testversion (claude.ai): https://claude.ai/artifact/CdAt886T2tT8TcRVnJMRKa

Die echte App mit einem Nachbau des Workers im Browser (`app/dev/mock-api.js`, gleiche Regeln, erfundene Daten) und einem
Testhelfer-Feld (nächster Trainingstag, Kind wie per Formular, Trainer wechseln, Zustände „Sitzung abgelaufen“, „Kein Zugang“,
„Datenbank weg“, „Kein Netz“). Neu bauen nach Änderungen an der App: `cd worker && node dev/build-testversion.mjs`
→ `testversion/index.html` (nicht eingecheckt) und erneut veröffentlichen.

## Elternformular-Vorschau (claude.ai): https://claude.ai/artifact/PZPQsEicRrsYcjVtrKkbK5

Das echte Formular `app/anmeldung/index.html` mit nachgebautem Server. Neu bauen: `cd worker && node dev/build-formular-vorschau.mjs`.
