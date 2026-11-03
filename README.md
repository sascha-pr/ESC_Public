# Probetraining-App – ESC Rellinghausen 06 e. V.

Handy-App für Trainer der Jugendabteilung: Wer ist im Probetraining (x/6), wer hat einen Antrag abgegeben, wer ist Mitglied?
Daten in Airtable, Login über Cloudflare Access, DFBnet bleibt führend.

| Ordner | Inhalt |
|---|---|
| `app/` | Trainer-App (eine HTML-Datei ohne Build) und Aushang mit QR-Code |
| `worker/` | Cloudflare Worker: Login-Prüfung, API, Auslieferung der App – siehe `worker/README.md` |
| `prototype/` | Klickbarer Prototyp mit Beispieldaten (Demo, ohne Login) |
| `mitgliedsantrag/` | Vorläufige Seite für den Mitgliedsantrag |
| `docs/` | Airtable-Schema, Deployment-Anleitung, Trainer-Kurzanleitung, Einwilligung & Rollen |

Einstieg für Entwickler: `CLAUDE.md`. Online stellen: `docs/deployment.md`.
Lokal ausprobieren ohne Airtable: `cd worker && npm install && npm run dev:mock` → http://localhost:8787
