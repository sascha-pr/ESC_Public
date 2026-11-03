# Deployment-Anleitung: Probetraining-App online stellen

Für: die Person im Verein, die die App einrichtet (etwas Technik-Erfahrung reicht: Konten anlegen, Werte kopieren,
ein paar Befehle im Terminal ausführen). Dauer: etwa 1–2 Stunden, plus Wartezeit beim Domain-Umzug.

Alles läuft im **Konto des Vereins**, nicht in privaten Konten. Am besten eine Vereinsadresse verwenden
(z. B. `it@esc-06.de` oder die Adresse der Jugendleitung) und Zugänge im Vorstand hinterlegen.

```
Trainer-Handy → Cloudflare Access (Login per E-Mail-Code) → Cloudflare Worker (App + API) → Airtable
```

---

## 0. Vorher klären (Go-Live-Voraussetzungen)

- [ ] **Datenschutz:** Zustimmung des Vorstands; Auftragsverarbeitungsverträge mit Airtable und Cloudflare abgeschlossen
      bzw. akzeptiert; Datenschutzerklärung des Vereins um Probetraining-App, Airtable und Cloudflare ergänzt.
      (Kein Rechtsrat – vom Vorstand/Datenschutzbeauftragten freigeben lassen.)
- [ ] **Einwilligungstext** im Airtable-Formular vervollständigt (Platzhalter `[E-MAIL-ADRESSE]`, `[VEREINSANSCHRIFT, VORSTAND]`, `[LINK]`).
- [ ] **Mannschaften** mit Trainer-E-Mails in Airtable eingetragen, Beispieldaten gelöscht (Aufgabe 3).
- [ ] **Wer verwaltet die Domain esc-06.de?** (Zugangsdaten zum Domain-Anbieter, z. B. Strato/IONOS/United Domains) – nötig für Weg A in Schritt 2.

---

## 1. Cloudflare-Konto für den Verein anlegen

1. Auf https://dash.cloudflare.com/sign-up mit der Vereinsadresse registrieren, E-Mail bestätigen.
2. Zwei-Faktor-Anmeldung einschalten (Profil → Authentifizierung).
3. Optional weitere Admins einladen (Account → Mitglieder), damit nicht alles an einer Person hängt.

Kosten: Workers, KV und Zero Trust (Access) sind im kostenlosen Tarif enthalten (Zero Trust kostenlos bis 50 Nutzer).

## 2. Adresse festlegen

### Weg A (empfohlen): `probetraining.esc-06.de`

Dafür muss die Domain **esc-06.de** zu Cloudflare umziehen. Umziehen heißt nur: Cloudflare übernimmt die
DNS-Verwaltung (Nameserver). Die Domain bleibt beim bisherigen Anbieter registriert, Website und E-Mail laufen weiter.

1. Cloudflare-Dashboard → **Domain hinzufügen** → `esc-06.de` → Tarif **Free**.
2. Cloudflare liest die vorhandenen DNS-Einträge ein. **Mit dem bisherigen Anbieter vergleichen**, besonders die
   E-Mail-Einträge (`MX`, `TXT` mit SPF/DKIM) und die Website (`A`/`CNAME` für `@` und `www`). Fehlende Einträge nachtragen.
3. Cloudflare zeigt zwei Nameserver an (z. B. `xxx.ns.cloudflare.com`). Diese beim Domain-Anbieter eintragen
   (Domain-Verwaltung → Nameserver ändern). Das macht die Person, die die Domain verwaltet.
4. Warten, bis Cloudflare „Aktiv“ meldet (meist Minuten bis wenige Stunden, selten bis 24 h).
5. Website und E-Mail kurz testen.

### Weg B (Übergang): Adresse `….workers.dev`

Falls der Domain-Umzug (noch) nicht geht: Die App kann vorerst unter einer Cloudflare-Adresse wie
`esc06-probetraining.<konto>.workers.dev` laufen. Voraussetzung ist, dass Cloudflare Access für `workers.dev`
eingeschaltet werden kann (Worker → Einstellungen → Domains & Routen → bei `workers.dev` „Cloudflare Access“ aktivieren).
In `worker/wrangler.jsonc` dann `"workers_dev": true` setzen und die `routes`-Zeile weglassen.
**Ohne eingeschaltetes Access nie mit `workers_dev: true` veröffentlichen.** (Der Worker lässt ohne gültigen Access-Login
zwar niemanden an Daten, die App-Seite wäre aber öffentlich.)

## 3. Cloudflare Access (Login der Trainer) einrichten

1. Dashboard → **Zero Trust**. Beim ersten Mal ein Team-Namen wählen, z. B. `esc06` → ergibt die Team-Domain
   **`esc06.cloudflareaccess.com`**. Tarif **Free** wählen (für den Free-Tarif wird ggf. eine Zahlungsart hinterlegt, es fallen keine Kosten an).
2. **Einstellungen → Authentifizierung → Login-Methoden:** „One-time PIN“ (Einmal-Code per E-Mail) aktivieren.
3. **Zugriff → Anwendungen → Anwendung hinzufügen → Self-hosted:**
   - Name: `Probetraining-App`
   - Sitzungsdauer: **1 Monat** (Trainer müssen sich dann nur selten neu anmelden)
   - Domain: Weg A `probetraining.esc-06.de` · Weg B die `workers.dev`-Adresse
   - Login-Methode: nur „One-time PIN“, „Sofort umleiten“ aktivieren (dann sehen Trainer direkt die Code-Eingabe)
4. **Richtlinie hinzufügen:** Name `Trainer`, Aktion **Zulassen**, Regel „Einschließen → E-Mails“: alle Trainer-Adressen eintragen.
   *Tipp:* stattdessen unter Zero Trust → Zugriff → Zugriffsgruppen eine Gruppe „Trainer“ anlegen und hier verwenden.
   **Wichtig:** Diese Liste muss zu „Mannschaften → Trainer E-Mail“ in Airtable passen. Steht jemand nur in Access, sieht er
   „Kein Zugang“; steht jemand nur in Airtable, kommt er nicht durch den Login.
5. Anwendung speichern, öffnen und den **Application Audience (AUD) Tag** kopieren (lange Zeichenkette in der Übersicht).

Notieren: **Team-Domain** (`esc06.cloudflareaccess.com`) und **AUD-Tag**.

## 4. Airtable-Token erstellen

1. Mit dem Airtable-Konto, dem die Base gehört: https://airtable.com/create/tokens → **Token erstellen**.
2. Name: `Probetraining-Worker`.
3. Bereiche (Scopes): **nur** `data.records:read` und `data.records:write`.
4. Zugriff: **nur** die Base „Probetraining & Neuanmeldungen“.
5. Token kopieren (wird nur einmal angezeigt) – er kommt gleich als Secret in den Worker, nirgendwo sonst hin
   (nicht ins Repo, nicht in Chats/Mails).

**Kontingent:** Der kostenlose Airtable-Tarif erlaubt 1.000 API-Aufrufe pro Monat. Grobe Schätzung: pro Training und
Mannschaft etwa 5 Aufrufe für das Laden plus 2 je „War heute da“. Bei 10 Mannschaften, 2 Trainings pro Woche und
einigen Probekindern sind das schnell 1.000–1.500 Aufrufe im Monat. Wenn die App rege genutzt wird, für **eine Person**
(Token-Inhaber) den Airtable-Team-Tarif buchen. Ist das Kontingent aufgebraucht, zeigt die App „Die Vereinsdatenbank ist
gerade nicht erreichbar“.

## 5. Worker veröffentlichen

Auf einem Rechner mit **Node.js 20 oder neuer** (https://nodejs.org) und dem Projekt-Repository:

```bash
cd worker
npm install
npm run check                      # Typprüfung + Tests müssen grün sein
npx wrangler login                 # öffnet den Browser: mit dem Vereinskonto bei Cloudflare anmelden
npx wrangler kv namespace create UNDO
```

Der letzte Befehl gibt eine `id` aus. Dann `worker/wrangler.jsonc` anpassen:

```jsonc
"routes": [{ "pattern": "probetraining.esc-06.de", "custom_domain": true }],   // nur Weg A (Zeile einkommentieren)
"vars": {
  "AIRTABLE_BASE_ID": "appBKLVL4A4mI2QHr",
  "ACCESS_TEAM_DOMAIN": "esc06.cloudflareaccess.com",   // aus Schritt 3
  "ACCESS_AUD": "<AUD-Tag aus Schritt 3>"
},
"kv_namespaces": [{ "binding": "UNDO", "id": "<id aus dem kv-Befehl>" }]
```

Team-Domain, AUD-Tag und KV-ID sind keine Geheimnisse und dürfen ins Repository. Dann:

```bash
npx wrangler secret put AIRTABLE_TOKEN    # Token aus Schritt 4 einfügen
npx wrangler deploy
```

Bei Weg A legt Cloudflare den DNS-Eintrag für `probetraining.esc-06.de` und das Zertifikat automatisch an
(kann einige Minuten dauern).

**Updates später:** im Ordner `worker` erneut `npm run check` und `npx wrangler deploy`.
*Optional:* Unter Workers → `esc06-probetraining` → Einstellungen → Build das GitHub-Repository verbinden
(Stammverzeichnis `worker`, Deploy-Befehl `npx wrangler deploy`), dann veröffentlicht jeder Push auf den Hauptzweig automatisch.

## 6. Prüfen

1. **Privates Browserfenster** → `https://probetraining.esc-06.de` → es muss die Cloudflare-Anmeldung kommen.
2. Mit einer Trainer-Adresse anmelden → Code aus der Mail eingeben → die eigene Mannschaft erscheint.
3. Mit einer Adresse, die in Access steht, aber in Airtable keiner Mannschaft zugeordnet ist → „Kein Zugang“.
4. Ohne Anmeldung `https://probetraining.esc-06.de/api/kids` aufrufen → Umleitung zum Login, keine Daten.
5. Bei einem Testkind „War heute da“ und „Rückgängig“ tippen → in Airtable Zähler und Datum prüfen.
6. „Abmelden“ → man landet wieder beim Login.
7. „Neues Kind“ → QR-Code mit dem Handy scannen → das Formular öffnet sich mit vorbelegter Mannschaft
   (erst nach dem Veröffentlichen des Formulars, siehe unten).

Fehlersuche: Workers → `esc06-probetraining` → **Logs** (enthält nur Fehlercodes, keine Kinderdaten) und
Zero Trust → Logs → Access (wer hat sich wann angemeldet).

## 7. In Airtable scharf schalten

In dieser Reihenfolge (alles in der Airtable-Oberfläche):

1. **Formular** „Anmeldung zum Probetraining“ veröffentlichen
   (https://airtable.com/appBKLVL4A4mI2QHr/pag2AaadRpeiFuvDB/edit → Veröffentlichen). Prüfen, dass jeder ohne Airtable-Konto
   es ausfüllen kann und dass die Vorbelegung der Mannschaft per Link funktioniert.
   Falls die Formular-Adresse von `app/config.js` abweicht: dort anpassen und neu deployen.
2. **Automationen** einschalten: 6 (Formular), 5 (Spielberechtigt), 3 (Trainer-Info), 2 (Verwaltung), 4 (Löschliste),
   zuletzt **1** (Antragsmail an Eltern – erst, wenn der Antrags-Link stimmt und die Seite öffentlich erreichbar ist).
3. Vorläufige Werte ersetzen (siehe `docs/airtable-schema.md` → „Vorläufige Werte“): Verwaltungs-E-Mail in Automation 2
   und 4, Antrags-Link in Automation 1.

## 8. Trainer informieren

Kurzanleitung aus `docs/trainer-kurzanleitung.md` per WhatsApp verschicken (Link eintragen).
Pro Mannschaft den Aushang drucken: in der App „Neues Kind beim Training“ → „Aushang … öffnen“ → Drucken.

## Betrieb

| Was | Wo |
|---|---|
| Neuer Trainer / Trainerwechsel | Airtable „Mannschaften → Trainer E-Mail“ **und** Access-Richtlinie/Gruppe „Trainer“ |
| Trainer ausgeschieden | aus beiden Listen entfernen; laufende Sitzungen in Zero Trust → Zugriff → Anwendungen → Sitzungen widerrufen |
| Token erneuern / Verdacht auf Missbrauch | neuen Airtable-Token erstellen, `npx wrangler secret put AIRTABLE_TOKEN`, alten Token in Airtable löschen |
| App geht nicht | Worker-Logs; Airtable-Kontingent prüfen; https://www.cloudflarestatus.com |
| Löschliste | kommt montags per Mail (Automation 4); Datensätze in Airtable löschen |
