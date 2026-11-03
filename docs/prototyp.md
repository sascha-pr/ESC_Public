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
