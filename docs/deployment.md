# Deployment-Anleitung: Probetraining-App online stellen (Variante C – eigene Domain)

Für: die Person im Verein, die die App einrichtet (etwas Technik-Erfahrung reicht: Konten anlegen, Werte kopieren,
ein paar Befehle im Terminal ausführen). Dauer: etwa 1–2 Stunden, plus Wartezeit bis die Domain aktiv ist.
Hintergrund, Entscheidung und Inventar für die Vereins-IT: `docs/deployment-it.md`.

**Entscheidung:** Die App bekommt eine **eigene Domain**, die nur für sie genutzt wird. Die Vereinsdomain esc-06.de
wird **nicht verändert** (keine Nameserver-, DNS- oder E-Mail-Änderung).

Platzhalter in dieser Anleitung:

| Platzhalter | Bedeutung | Beispiel |
|---|---|---|
| `<APP-DOMAIN>` | die neue Domain des Vereins für die App | `esc06-jugend.de` |
| `<APP-HOST>` | Adresse der App | `probetraining.esc06-jugend.de` |
| `<TEAM>` | Team-Name in Cloudflare Zero Trust | `esc06` |

Alles läuft in **Konten des Vereins**, nicht in privaten Konten: Vereinsadresse verwenden (z. B. die der Jugendleitung),
Zwei-Faktor-Anmeldung einschalten, **mindestens zwei Admins**. Jeden erledigten Schritt im Inventar in
`docs/deployment-it.md` (Abschnitt 6) und im Änderungsprotokoll (Abschnitt 9) eintragen.

```
Trainer-Handy → Cloudflare Access (Login per E-Mail-Code) → Cloudflare Worker (App + API) → Airtable
                 alles unter https://<APP-HOST>
```

---

## 0. Vorher klären (Go-Live-Voraussetzungen)

- [ ] **Datenschutz:** Zustimmung des Vorstands; Auftragsverarbeitungsverträge mit Airtable und Cloudflare abgeschlossen
      bzw. akzeptiert; Datenschutzerklärung des Vereins um Probetraining-App, Airtable und Cloudflare ergänzt.
      Klären, ob auf `<APP-HOST>` ein Link zu Impressum/Datenschutz nötig ist.
      (Kein Rechtsrat – vom Vorstand/Datenschutzbeauftragten freigeben lassen.)
- [ ] **Einwilligungstext** im Airtable-Formular vervollständigt (Platzhalter `[E-MAIL-ADRESSE]`, `[VEREINSANSCHRIFT, VORSTAND]`, `[LINK]`).
- [ ] **Mannschaften** mit Trainer-E-Mails in Airtable eingetragen, Beispieldaten gelöscht.
- [ ] **Domainname** gewählt: erkennbar zum Verein gehörend, z. B. `esc06-jugend.de`; Verfügbarkeit geprüft.
- [ ] **IT-Verantwortlicher informiert** (Kopie von `docs/deployment-it.md`), zweiter Admin benannt.

## 1. Domain registrieren

1. Bei einem deutschen Domain-Anbieter (z. B. INWX, united-domains, Strato, IONOS) **nur die Domain** bestellen,
   kein Hosting- oder Mailpaket. Wichtig: Der Anbieter muss **eigene Nameserver** erlauben (bei reinen Domain-Tarifen üblich).
   Kosten: etwa 5–15 € pro Jahr; auf den **Verlängerungspreis** achten, nicht nur auf den Preis im ersten Jahr.
2. **Inhaber: ESC Rellinghausen 06 e. V.** (Vereinsanschrift), nicht eine Privatperson.
   Kontakt-E-Mail: Vereinsadresse. Rechnung an den Verein.
3. **Automatische Verlängerung** einschalten. Läuft die Domain aus, ist die App nicht mehr erreichbar.
4. Zugang zum Domain-Anbieter mit Zwei-Faktor-Anmeldung sichern und für den zweiten Admin hinterlegen.

## 2. Cloudflare-Konto anlegen und Domain hinzufügen

1. Auf https://dash.cloudflare.com/sign-up mit der Vereinsadresse registrieren, E-Mail bestätigen,
   Zwei-Faktor-Anmeldung einschalten, zweiten Admin einladen (Account → Mitglieder).
2. **Domain hinzufügen** → `<APP-DOMAIN>` → Tarif **Free**. Vorhandene DNS-Einträge gibt es bei einer neuen Domain
   keine; ein Import-Vorschlag kann leer bleiben bzw. Parkseiten-Einträge des Anbieters können gelöscht werden.
3. Cloudflare zeigt zwei Nameserver an (z. B. `xxx.ns.cloudflare.com`). Diese beim Domain-Anbieter eintragen
   (Domain-Verwaltung → Nameserver → eigene Nameserver).
4. Warten, bis Cloudflare die Domain als **aktiv** meldet (meist Minuten bis wenige Stunden, selten bis 24 h).
5. Empfohlen: In Cloudflare unter DNS → Einstellungen **DNSSEC aktivieren** und den angezeigten DS-Eintrag beim
   Domain-Anbieter hinterlegen.

Kosten bei Cloudflare: 0 € (Free-Tarife für Domain, Workers, KV und Zero Trust bis 50 Nutzer).

## 3. Cloudflare Access (Login der Trainer) einrichten

1. Dashboard → **Zero Trust**. Team-Namen wählen, z. B. `esc06` → Team-Domain **`<TEAM>.cloudflareaccess.com`**.
   Tarif **Free** (ggf. wird eine Zahlungsart hinterlegt, es fallen keine Kosten an).
2. **Einstellungen → Authentifizierung → Login-Methoden:** „One-time PIN“ (Einmal-Code per E-Mail) aktivieren.
3. **Zugriff → Zugriffsgruppen:** Gruppe `Trainer` anlegen, Regel „E-Mails“ mit allen Trainer-Adressen.
   **Diese Liste muss zu „Mannschaften → Trainer E-Mail“ in Airtable passen.**
4. **Zugriff → Anwendungen → Anwendung hinzufügen → Self-hosted:**
   - Name: `Probetraining-App`
   - Domain: `<APP-HOST>`
   - Sitzungsdauer: **1 Monat**
   - Login-Methode: nur „One-time PIN“, „Sofort umleiten“ aktivieren
   - Richtlinie: Name `Trainer`, Aktion **Zulassen**, Einschließen → Zugriffsgruppe `Trainer`
5. Speichern, die Anwendung öffnen und den **Application Audience (AUD) Tag** kopieren.

Die Menübezeichnungen im Dashboard können sich ändern; die Begriffe (Self-hosted-Anwendung, One-time PIN, AUD-Tag) bleiben gleich.

## 4. Airtable-Token erstellen

1. Mit dem Airtable-Konto, dem die Base gehört: https://airtable.com/create/tokens → **Token erstellen**.
2. Name: `Probetraining-Worker`; Bereiche **nur** `data.records:read` und `data.records:write`;
   Zugriff **nur** auf die Base „Probetraining & Neuanmeldungen“.
3. Token kopieren (wird nur einmal angezeigt). Er kommt gleich als Secret in den Worker und **nirgendwo sonst hin**
   (nicht ins Repository, nicht in Chats oder Mails).

**Kontingent:** Airtable Free erlaubt 1.000 API-Aufrufe pro Monat. Grobe Schätzung: pro Training und Mannschaft etwa
5 Aufrufe für das Laden plus 2 je „War heute da“. Bei rund 10 Mannschaften wird es knapp → dann für den Token-Inhaber
den Airtable-Team-Tarif buchen. Ist das Kontingent aufgebraucht, zeigt die App „Die Vereinsdatenbank ist gerade nicht erreichbar“.

## 5. Worker veröffentlichen

Auf einem Rechner mit **Node.js 20 oder neuer** (https://nodejs.org) und dem Projekt-Repository:

```bash
cd worker
npm install
npm run check                      # Typprüfung + Tests müssen grün sein
npx wrangler login                 # Browser öffnet sich: mit dem Vereinskonto bei Cloudflare anmelden
npx wrangler kv namespace create UNDO
```

Der letzte Befehl gibt eine `id` aus. Dann in `worker/wrangler.jsonc` eintragen:

```jsonc
"routes": [{ "pattern": "<APP-HOST>", "custom_domain": true }],
"vars": {
  "AIRTABLE_BASE_ID": "appBKLVL4A4mI2QHr",
  "ACCESS_TEAM_DOMAIN": "<TEAM>.cloudflareaccess.com",
  "ACCESS_AUD": "<AUD-Tag aus Schritt 3>"
},
"kv_namespaces": [{ "binding": "UNDO", "id": "<id aus dem kv-Befehl>" }]
```

Domain, Team-Domain, AUD-Tag und KV-ID sind keine Geheimnisse und dürfen ins Repository (Änderung committen). Dann:

```bash
npx wrangler secret put AIRTABLE_TOKEN    # Token aus Schritt 4 einfügen
npx wrangler deploy
```

Cloudflare legt den DNS-Eintrag für `<APP-HOST>` und das Zertifikat automatisch an (einige Minuten).

**Updates später:** im Ordner `worker` erneut `npm run check` und `npx wrangler deploy`.
*Optional:* Workers → `esc06-probetraining` → Einstellungen → Build: GitHub-Repository verbinden
(Stammverzeichnis `worker`, Deploy-Befehl `npx wrangler deploy`), dann veröffentlicht jeder Push auf den Hauptzweig automatisch.

## 6. Prüfen (Abnahme)

1. **Privates Browserfenster** → `https://<APP-HOST>` → die Cloudflare-Anmeldung muss kommen.
2. Mit einer Trainer-Adresse anmelden → Code aus der Mail → die eigene Mannschaft erscheint.
3. Adresse, die in Access steht, aber in Airtable keiner Mannschaft zugeordnet ist → „Kein Zugang“.
4. Ohne Anmeldung `https://<APP-HOST>/api/kids` → Umleitung zum Login, keine Daten.
5. Testkind: „War heute da“ und „Rückgängig“ → in Airtable Zähler und Datum prüfen.
6. „Abmelden“ → man landet wieder beim Login.
7. Nach Schritt 7: „Neues Kind“ → QR-Code scannen → Formular mit vorbelegter Mannschaft.

Ergebnis im Änderungsprotokoll (`docs/deployment-it.md`, Abschnitt 9) festhalten.
Fehlersuche: Workers → `esc06-probetraining` → **Logs** (nur Fehlercodes, keine Kinderdaten) und Zero Trust → Logs → Access.

## 7. In Airtable scharf schalten

In dieser Reihenfolge (alles in der Airtable-Oberfläche):

1. **Formular** „Anmeldung zum Probetraining“ veröffentlichen
   (https://airtable.com/appBKLVL4A4mI2QHr/pag2AaadRpeiFuvDB/edit). Prüfen, dass es ohne Airtable-Konto ausfüllbar ist
   und die Vorbelegung der Mannschaft per Link funktioniert. Weicht die Formular-Adresse von `app/config.js` ab:
   dort anpassen und neu deployen.
2. **Automationen** einschalten: 6 (Formular), 5 (Spielberechtigt), 3 (Trainer-Info), 2 (Verwaltung), 4 (Löschliste),
   zuletzt **1** (Antragsmail an Eltern – erst, wenn der Antrags-Link stimmt und die Seite öffentlich erreichbar ist).
3. Vorläufige Werte ersetzen (`docs/airtable-schema.md` → „Vorläufige Werte“): Verwaltungs-E-Mail in Automation 2 und 4,
   Antrags-Link in Automation 1.

## 8. Trainer informieren

- Kurzanleitung aus `docs/trainer-kurzanleitung.md` per WhatsApp verschicken (`[LINK]` → `https://<APP-HOST>`).
- Pro Mannschaft den Aushang drucken: in der App „Neues Kind beim Training“ → „Aushang … öffnen“ → Drucken.
- Optional: Link zur App im internen Bereich der Vereinswebsite.

## Betrieb

| Was | Wo |
|---|---|
| Neuer Trainer / Trainerwechsel | Airtable „Mannschaften → Trainer E-Mail“ **und** Zero-Trust-Zugriffsgruppe „Trainer“ |
| Trainer ausgeschieden | aus beiden Listen entfernen; laufende Sitzungen in Zero Trust widerrufen |
| Token erneuern / Verdacht auf Missbrauch | neuen Airtable-Token erstellen, `npx wrangler secret put AIRTABLE_TOKEN`, alten Token löschen |
| Domain | Verlängerung jährlich (automatisch); Rechnung an den Verein; Kontaktdaten aktuell halten |
| App geht nicht | Worker-Logs; Airtable-Kontingent; Domain noch aktiv?; https://www.cloudflarestatus.com |
| Löschliste | kommt montags per Mail (Automation 4); Datensätze in Airtable löschen |

Alle Änderungen an Konten, Admins, Domain und Konfiguration im Änderungsprotokoll in `docs/deployment-it.md` eintragen.
