# Prototyp `prototype/index.html` – Aufbau

Einzelne HTML-Datei, kein Build. Im Browser direkt öffnen. Ursprünglich als claude.ai-Artifact gebaut
(dort ohne `<html>/<head>`-Gerüst); die Datei hier ist um das Gerüst ergänzt und läuft eigenständig.

## Design
- Tokens im `:root` (Hell/Dunkel über `prefers-color-scheme` und `[data-theme]`).
- Vereinsfarben aus dem Wappen: Rot `#c9252b`, Eichengrün `#006f45`, Schwarz `#141414`.
- Schriften: Barlow Condensed (Überschriften, Buttons, Großbuchstaben), Barlow (Text) über Google Fonts.
- Wappen als Base64 in der Variable `LOGO` eingebettet (Original in `assets/`).

## Logik (im `<script>` am Ende)
- `MAX = 6` – Probetrainings bis Antrag Pflicht.
- `TEAMS` – Demo-Mannschaften mit Trainer-E-Mail (später aus `/api/me`).
- `seed()` – Beispielkinder (später aus `/api/kids`).
- `state` – lokaler Zustand; `undo` merkt sich den Vorwert pro Kind (später serverseitig).
- `attend(id)` / `undo(id)` – „War heute da“ / „Rückgängig“ (später POST an Worker).
- `submitForm()` – Demo-Elternformular (später Airtable-Formular oder Worker-Endpunkt).
- Login-Screen (E-Mail → Code) ist nur Demo; im Echtbetrieb übernimmt Cloudflare Access.
- `localStorage` nur für zuletzt gewählte Demo-Mannschaft.

## Ansichten
1. Anmeldung (Demo) → 2. Mannschaft: Karten „Im Probetraining“ mit Zählerkreisen 1…6, Button „War heute da“,
   bei Limit rote Karte mit Elternkontakt → 3. Liste „Angemeldet“ (Antrag/Mitglied/spielberechtigt)
   → 4. Sheet „Neues Kind“ mit QR-Code und Demo-Elternformular.

## Echte App `app/index.html` (Aufgabe 5, Stand 03.11.2026)

Gleiche Datei-Struktur, gleiches CSS und HTML-Gerüst wie der Prototyp – nur das Skript ist neu. Der Prototyp bleibt
unverändert als Demo mit Beispieldaten (für Trainer-Tests ohne Login). Ausgeliefert wird `app/` vom Worker (`worker/wrangler.jsonc` → `assets`).

- Daten kommen aus dem Worker: `/api/me` (Trainer, Mannschaften, `max`, `today`) und `/api/kids?team=…`.
- „War heute da“ / „Rückgängig“ → `POST /api/kids/:id/attend|undo`; die Karte nimmt die Antwort des Servers.
  Während der Anfrage ist der Button gesperrt („Wird eingetragen …“), Doppel-Tipps zählen nicht doppelt.
- „Heute eingetragen“ kommt vom Server (`attendedToday`) – stimmt also auch nach Neuladen und auf anderen Handys.
- Kein eigener Login-Screen mehr: Anmeldung macht Cloudflare Access. „Abmelden“ → `/cdn-cgi/access/logout`.
- Zustände im Stil des früheren Anmelde-Panels: *Einen Moment …* (laden), *Bitte neu anmelden* (Sitzung abgelaufen),
  *Kein Zugang* (E-Mail keiner Mannschaft zugeordnet), *Das hat nicht geklappt* (Fehler, mit „Nochmal versuchen“).
  Fehler beim Tippen erscheinen als Hinweis unten, ohne die Liste zu verlieren.
- Trainer mit mehreren Mannschaften bekommen im Kopf Umschalter; die Wahl merkt sich das Handy (`localStorage`).
- Liste frischt sich auf, wenn die App nach über einer Minute wieder in den Vordergrund kommt; Fußzeile „Stand hh:mm · Aktualisieren“.
- „Neues Kind“: solange `FORM_URL` leer ist (Aufgabe 6), Hinweis statt QR-Code; danach QR pro Mannschaft.
- `MAX = 6` bleibt als Vorgabe, der Server meldet den gültigen Wert.

Lokal ausprobieren ohne Airtable: `cd worker && npm run dev:mock` → http://localhost:8787 (erfundene Daten, siehe `worker/dev/mock-airtable.mjs`).
