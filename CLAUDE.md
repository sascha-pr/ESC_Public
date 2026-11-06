# Probetraining-App ESC Rellinghausen 06 – Übergabe an Claude Code

Stand: 06.11.2026 · Auftraggeber: Sascha (Projektleitung, ehrenamtlich für den Verein)
Sprache: Antworte und kommentiere auf **Deutsch** (Code-Bezeichner dürfen englisch sein).

## 1. Worum geht es

Fußballverein **ESC Rellinghausen 06 e. V.** (Essen), Jugendabteilung.
Führendes System für Mitglieder, Spielerpässe und Beiträge ist **DFBnet** (Cloud, keine offene API für Vereine).

**Problem:** Kinder kommen zum Probetraining, Trainer wissen nicht, ob sie inzwischen angemeldet sind.
Zwischen Trainer (Platz) und Verwaltung (pflegt DFBnet) gibt es keinen Abgleich.

**Lösung:** Eine schlanke Handy-App für Trainer, die pro Kind den Status zeigt
(Probetraining x/3 → Antrag liegt vor → Mitglied → spielberechtigt). Daten liegen in **Airtable**,
Automationen informieren Eltern, Verwaltung und Trainer. DFBnet bleibt führend; die App überbrückt
nur die Zeit zwischen erstem Training und fertigem Pass.

## 2. Was es schon gibt

| Baustein | Status | Wo |
|---|---|---|
| Airtable-Base „Probetraining & Neuanmeldungen“ | angelegt, mit Beispieldaten | `docs/airtable-schema.md` (alle IDs) |
| 7 Airtable-Automationen (Nr. 6 nur Reserve) | als Entwurf angelegt, **ausgeschaltet**; Antrags-Link, Verwaltungs-Mail und „Antwort an“ vorläufig | `docs/airtable-schema.md` |
| Airtable-Interface (Trainer-Liste + Verwaltungs-Kanban) | veröffentlicht – Trainern zu unintuitiv, wird durch eigene App ersetzt; Kanban bleibt für Verwaltung | `docs/airtable-schema.md` |
| Klickbarer Prototyp (erste Demo) | **Archiv, wird nicht mehr gepflegt** (06.11.2026); öffentlicher Link zeigt jetzt eine Hinweisseite zur Testversion | `prototype/index.html`, `prototype/weiterleitung.html` |
| Vereinswappen | vorhanden | `assets/` |
| Trainer-Kurzanleitung (WhatsApp) & Einwilligungstext | Kurzanleitung final (Link fehlt), Einwilligung mit Platzhaltern | `docs/` |
| **Echte Trainer-App** + Aushang | fertig, gegen API gebaut, lokal getestet | `app/` |
| **Worker (API + Elternformular)** | fertig, 88 Tests, noch nicht deployt | `worker/` |
| **Testversion** (echte App + Server-Nachbau) und **Formular-Vorschau** | aktuell, auf claude.ai veröffentlicht (Links unten) | `app/dev/mock-api.js`, `worker/dev/build-*.mjs` |
| PDFs (IT-Doku, Deployment, Kurzanleitung, Aushang-Muster, Trainer-App, Elternformular) | aktuell | `docs/*.pdf` |
| **Elternformular (eigenes, ohne Login)** | fertig, getestet; Turnstile-Schlüssel und Einwilligungsangaben offen | `app/anmeldung/`, `worker/src/public.ts` |
| Deployment-Anleitung (Variante C) + IT-Dokumentation (Entscheidung, Inventar, Betrieb, Änderungsprotokoll) | fertig, Domainname noch offen | `docs/deployment.md`, `docs/deployment-it.md` |

Links (claude.ai):
- Testversion der Trainer-App: https://claude.ai/artifact/CdAt886T2tT8TcRVnJMRKa (neu bauen: `cd worker && node dev/build-testversion.mjs`, dann `testversion/index.html` veröffentlichen)
- Formular-Vorschau: https://claude.ai/artifact/PZPQsEicRrsYcjVtrKkbK5 (`node dev/build-formular-vorschau.mjs` → `testversion/anmeldung.html`)
- Antrags-Platzhalterseite: https://claude.ai/artifact/EMnvhd112CQZsZw9DdW4cs (privat; `mitgliedsantrag/index.html`)
- Alter Prototyp-Link: https://claude.ai/artifact/P2dsyiesCqNT7KQNyYb63n → Hinweisseite (`prototype/weiterleitung.html`)

### Aktueller Funktionsstand (06.11.2026)
- **Limit 3 Probetrainings**, Antragsmail nach dem 2. Training (Automation 1), Teilnahme-Protokoll („Trainingstermine“).
- **Trainer-App:** Liste als Standard (Umschalter zu Karten), Zahlen in Worten, „War heute da“/„Rückgängig“ (serverseitig),
  Hinweise Papierantrag (Eltern ohne E-Mail) und „E-Mail unzustellbar“ mit Korrektur in der App (`POST /api/kids/:id/email`),
  mehrere Mannschaften, QR-Code + Aushang, „Eltern ohne Handy“ → Formular auf dem Trainer-Handy.
- **Elternformular** (`anmeldung.<APP-DOMAIN>`, ohne Login, Turnstile): Mannschaft fest aus dem QR-Code, E-Mail doppelt +
  Tippfehler-Hinweis, Option „keine E-Mail → Papierantrag“, Dublettenerkennung, Geschwister.
- **Offen beim Verein:** Domainname, Cloudflare-Konto, Datenschutz (Vorstand, AV-Verträge, Einwilligungsangaben in
  `app/anmeldung/config.js`), Nichtmitglieder-Versicherung (LSB NRW/ARAG), Vereinspostfach für Automation 1,
  echte Mannschaften (Aufgabe 3), echter Antrags-Link (ggf. DFBnet „Mitgliedsantrag online“), Automationen einschalten.

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
Ziel-URL: probetraining.<APP-DOMAIN> auf eigener Vereinsdomain nur für die App (Variante C, Entscheidung 04.11.2026)
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
**Entschieden (04.11.2026): Variante 2** – eigenes Formular `anmeldung.<APP-DOMAIN>` ohne Login mit Turnstile,
weil das Airtable-Formular im Test eine Anmeldung verlangte und nicht im Vereinsdesign gestaltbar ist.
Ursprüngliche Optionen:
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
6. ✅ *(erledigt; 04.11.2026 umgestellt auf Variante 2: eigenes Elternformular ohne Login, `app/anmeldung/`; QR + Aushang pro Mannschaft in der App; Airtable-Formular und Automation 6 nur noch Reserve)* Formular für QR-Code (siehe oben) + QR pro Mannschaft.
7. ✅ *(erledigt 03.11.2026: `docs/deployment.md`)* Deployment-Anleitung für den Verein schreiben (Cloudflare-Konto **des Vereins**, nicht privat; DNS-Eintrag bei Domain-Verwalter von esc-06.de).
8. ✅ *(erledigt 03.11.2026)* Kurzanleitung (`docs/trainer-kurzanleitung.md`) auf finalen Ablauf anpassen (echter Login).

**Änderung 06.11.2026:** Limit von 6 auf **3 Probetrainings** gesenkt (Worker `MAX_TRIALS`, App, Airtable-Ampel, Automation 1, Texte). Antragsmail bleibt nach dem 2. Training.

## 5. Offene Fragen an den Nutzer

- Hat der Verein ein Cloudflare-Konto? Wer verwaltet die Domain esc-06.de?
- Airtable (US-Hosting) akzeptiert, oder Wechsel auf **SeaTable** (Hosting in DE)? Worker-Schicht so kapseln, dass die Datenquelle austauschbar ist.
- Datenschutz: Zustimmung Vorstand, AV-Verträge (Airtable, Cloudflare), Datenschutzerklärung ergänzen. Es sind **Kinderdaten** – Datensparsamkeit im API-Design.
- Bestätigung der vorgeschlagenen Fristen (8 Wochen, 14 Tage).

### Antworten (03.11.2026)
- Cloudflare: Verein hat **noch kein Konto** → für Deployment neu anlegen (Vereinskonto).
- Adresse (04.11.2026): **Variante C – eigene Domain nur für die App** (z. B. `esc06-jugend.de`, Inhaber Verein); esc-06.de bleibt unverändert, kein Nameserver-Umzug. Domainname noch offen (Platzhalter `<APP-DOMAIN>`). Begründung und Alternativen: `docs/deployment-it.md` Abschnitt 2.
- Datenquelle: **Airtable bleibt**; Datenquelle im Worker trotzdem kapseln.
- Datenschutz: **noch nichts geklärt** (Vorstand, AV-Verträge, Datenschutzerklärung) → vor Echtbetrieb erledigen, bis dahin nur Beispieldaten.
- Fristen **bestätigt**: Löschung 8 Wochen nach 1. Training, spielberechtigte Kinder 14 Tage sichtbar, Antragsmail nach dem 2. Training.

## 6. Wichtige Randbedingungen

- Trainer-UX: **ein Tipp pro Kind** („War heute da“), keine Formulare/Filter/Menüs. Große Buttons, Handy-first.
- Ampel: Probetraining = neutral (schwarz), Limit erreicht = rot, Antrag = gelb, Mitglied/spielberechtigt = grün.
- Prototyp ist eine einzelne HTML-Datei ohne Build; Abhängigkeit nur `qrcodejs 1.0.0` (cdnjs) und Google Fonts.
- Keine echten Kinderdaten in Repo, Tests oder Logs.
- Airtable-MCP ist für die Base-Pflege nutzbar; IDs nie raten, immer aus `docs/airtable-schema.md` oder per Schema-Abfrage.
