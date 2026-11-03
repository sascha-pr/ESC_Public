# Probetraining-App ESC Rellinghausen 06 – Übergabe an Claude Code

Stand: 03.11.2026 · Auftraggeber: Sascha (Projektleitung, ehrenamtlich für den Verein)
Sprache: Antworte und kommentiere auf **Deutsch** (Code-Bezeichner dürfen englisch sein).

## 1. Worum geht es

Fußballverein **ESC Rellinghausen 06 e. V.** (Essen), Jugendabteilung.
Führendes System für Mitglieder, Spielerpässe und Beiträge ist **DFBnet** (Cloud, keine offene API für Vereine).

**Problem:** Kinder kommen zum Probetraining, Trainer wissen nicht, ob sie inzwischen angemeldet sind.
Zwischen Trainer (Platz) und Verwaltung (pflegt DFBnet) gibt es keinen Abgleich.

**Lösung:** Eine schlanke Handy-App für Trainer, die pro Kind den Status zeigt
(Probetraining x/6 → Antrag liegt vor → Mitglied → spielberechtigt). Daten liegen in **Airtable**,
Automationen informieren Eltern, Verwaltung und Trainer. DFBnet bleibt führend; die App überbrückt
nur die Zeit zwischen erstem Training und fertigem Pass.

## 2. Was es schon gibt

| Baustein | Status | Wo |
|---|---|---|
| Airtable-Base „Probetraining & Neuanmeldungen“ | angelegt, mit Beispieldaten | `docs/airtable-schema.md` (alle IDs) |
| 6 Airtable-Automationen | als Entwurf angelegt, **ausgeschaltet**; Antrags-Link und Verwaltungs-Mail vorläufig | `docs/airtable-schema.md` |
| Airtable-Interface (Trainer-Liste + Verwaltungs-Kanban) | veröffentlicht – Trainern zu unintuitiv, wird durch eigene App ersetzt; Kanban bleibt für Verwaltung | `docs/airtable-schema.md` |
| **Klickbarer Prototyp der Trainer-App** | fertig, von Trainern positiv bewertet, **nur Beispieldaten im Browser** | `prototype/index.html` |
| Vereinswappen | vorhanden | `assets/` |
| Trainer-Kurzanleitung (WhatsApp) & Einwilligungstext | Kurzanleitung final (Link fehlt), Einwilligung mit Platzhaltern | `docs/` |
| **Echte Trainer-App** + Aushang | fertig, gegen API gebaut, lokal getestet | `app/` |
| **Worker (API)** | fertig, 51 Tests, noch nicht deployt | `worker/` |
| Elternformular (Airtable) | angelegt, **unveröffentlicht** | `docs/airtable-schema.md` |
| Deployment-Anleitung | fertig | `docs/deployment.md` |

Live-Version des Prototyps (claude.ai-Artifact, öffentlicher Link): https://claude.ai/artifact/P2dsyiesCqNT7KQNyYb63n

## 3. Ziel der nächsten Phase: echte Datenanbindung („Weg B“)

Entscheidung (empfohlen, vom Nutzer favorisiert): Den **Prototyp 1:1 als echte App** weiterführen,
nicht in Softr nachbauen. Architektur:

```
Trainer-Handy ──► Cloudflare Access (Login per E-Mail-Einmalcode, nur hinterlegte Trainer)
                    │
                    ▼
               Cloudflare Worker  ── hält Airtable-Token geheim, filtert nach Mannschaft
                    │                (E-Mail aus Header Cf-Access-Authenticated-User-Email
                    │                 → Tabelle Mannschaften.„Trainer E-Mail“)
                    ▼
               Airtable REST API (Base appBKLVL4A4mI2QHr)
                    │
                    └─► bestehende Airtable-Automationen (Mails an Eltern/Verwaltung/Trainer)

Statische App (prototype/index.html, umgebaut) über Cloudflare Pages / Worker Assets,
Ziel-URL z. B. probetraining.esc-06.de
```

### Geplanter API-Vertrag (Worker)

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/me` | Trainer + Mannschaft(en) zur eingeloggten E-Mail |
| GET | `/api/kids` | Kinder der eigenen Mannschaft, nur nötige Felder (Name, Jg., Zähler, letztes Training, Status, Eltern-Name, Telefon nur bei Limit) |
| POST | `/api/kids/:id/attend` | Zähler +1, „Letztes Probetraining“ = heute; serverseitig Limit prüfen |
| POST | `/api/kids/:id/undo` | letzten „War heute da“ zurücknehmen (vorherige Werte vom Server merken, nicht vom Client übernehmen) |

Regeln: Jeder Schreibzugriff prüft, dass der Datensatz zur Mannschaft des Trainers gehört.
Airtable-Token = Personal Access Token mit nur `data.records:read/write` auf genau diese Base, als Worker-Secret.
Airtable-Free-Plan hat nur **1.000 API-Aufrufe/Monat** → kurz cachen (z. B. 60 s pro Mannschaft) oder Team-Plan für 1 Person.

### „Neues Kind“ / QR-Code
Offen, eine von zwei Varianten wählen:
1. QR → **Airtable-Formular** (Form-View in Tabelle Interessenten, Mannschaft vorbelegt per URL-Prefill). Einfach, kein öffentlicher Endpunkt.
2. QR → eigenes Formular in der App → öffentlicher Worker-Endpunkt (dann Spam-Schutz z. B. Cloudflare Turnstile nötig).
Empfehlung: Variante 1 für den Start.

## 4. Offene Aufgaben (Reihenfolge)

1. ✅ *(erledigt 03.11.2026, Details in `docs/airtable-schema.md`)* **Airtable an neue Regeln anpassen** (Nutzer hat 6 Probetrainings festgelegt; Rest vorgeschlagen, vor Umsetzung kurz bestätigen lassen):
   - Formel „Ampel“: Limit 3 → **6**.
   - Formel „Löschen fällig“: Frist 42 Tage → **56 Tage** (8 Wochen) – *vorgeschlagen*.
   - Neues Feld „Spielberechtigt seit“ (Datum, per Automation gesetzt); spielberechtigte Kinder **14 Tage** in der App zeigen, danach auf Löschliste – *vorgeschlagen*.
   - Automation 1 (Antragsmail) bleibt bei „nach dem 2. Training“, sofern nicht anders gewünscht.
2. ✅ *(vorläufig erledigt 03.11.2026: Platzhalter-Antragsseite + private Mail von Sascha, siehe `docs/airtable-schema.md` → „Vorläufige Werte“)* Platzhalter in Automationen ersetzen (Antrags-Link, Verwaltungs-E-Mail), dann vom Nutzer einschalten lassen.
3. Echte Mannschaften + Trainer-E-Mails in Airtable, Beispieldaten löschen.
4. ✅ *(erledigt 03.11.2026: `worker/`, siehe `worker/README.md`; 51 Tests grün)* **Worker** bauen (TypeScript, `wrangler`), inkl. Tests für Mannschafts-Filter und Limit.
5. ✅ *(erledigt 03.11.2026: echte App in `app/index.html`, Prototyp bleibt als Demo; siehe `docs/prototyp.md`)* **Prototyp umbauen:** `seed()` und lokalen `state` durch API-Aufrufe ersetzen; Demo-Login-Screen entfernen (Login macht Cloudflare Access); Abmelden → `/cdn-cgi/access/logout`; Lade-/Fehlerzustände; `MAX = 6` beibehalten. Look & Feel (ESC-Rot `#c9252b`, Schwarz, Eichengrün `#006f45`, Wappen, Barlow/Barlow Condensed) **nicht verändern** – den Trainern gefällt es.
6. ✅ *(erledigt 03.11.2026, Variante 1: Airtable-Formular `pag2AaadRpeiFuvDB`, noch unveröffentlicht; Automation 6; QR + Aushang pro Mannschaft in der App)* Formular für QR-Code (siehe oben) + QR pro Mannschaft.
7. ✅ *(erledigt 03.11.2026: `docs/deployment.md`)* Deployment-Anleitung für den Verein schreiben (Cloudflare-Konto **des Vereins**, nicht privat; DNS-Eintrag bei Domain-Verwalter von esc-06.de).
8. ✅ *(erledigt 03.11.2026)* Kurzanleitung (`docs/trainer-kurzanleitung.md`) auf finalen Ablauf anpassen (6 Trainings, echter Login).

## 5. Offene Fragen an den Nutzer

- Hat der Verein ein Cloudflare-Konto? Wer verwaltet die Domain esc-06.de?
- Airtable (US-Hosting) akzeptiert, oder Wechsel auf **SeaTable** (Hosting in DE)? Worker-Schicht so kapseln, dass die Datenquelle austauschbar ist.
- Datenschutz: Zustimmung Vorstand, AV-Verträge (Airtable, Cloudflare), Datenschutzerklärung ergänzen. Es sind **Kinderdaten** – Datensparsamkeit im API-Design.
- Bestätigung der vorgeschlagenen Fristen (8 Wochen, 14 Tage).

### Antworten (03.11.2026)
- Cloudflare: Verein hat **noch kein Konto** → für Deployment neu anlegen (Vereinskonto). Domain-Verwalter von esc-06.de noch zu klären.
- Datenquelle: **Airtable bleibt**; Datenquelle im Worker trotzdem kapseln.
- Datenschutz: **noch nichts geklärt** (Vorstand, AV-Verträge, Datenschutzerklärung) → vor Echtbetrieb erledigen, bis dahin nur Beispieldaten.
- Fristen **bestätigt**: Löschung 8 Wochen nach 1. Training, spielberechtigte Kinder 14 Tage sichtbar, Antragsmail nach dem 2. Training.

## 6. Wichtige Randbedingungen

- Trainer-UX: **ein Tipp pro Kind** („War heute da“), keine Formulare/Filter/Menüs. Große Buttons, Handy-first.
- Ampel: Probetraining = neutral (schwarz), Limit erreicht = rot, Antrag = gelb, Mitglied/spielberechtigt = grün.
- Prototyp ist eine einzelne HTML-Datei ohne Build; Abhängigkeit nur `qrcodejs 1.0.0` (cdnjs) und Google Fonts.
- Keine echten Kinderdaten in Repo, Tests oder Logs.
- Airtable-MCP ist für die Base-Pflege nutzbar; IDs nie raten, immer aus `docs/airtable-schema.md` oder per Schema-Abfrage.
