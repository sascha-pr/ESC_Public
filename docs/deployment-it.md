# Probetraining-App – technische Übersicht und Deployment für die Vereins-IT

Für: den IT-Verantwortlichen des ESC Rellinghausen 06 e. V.
Stand: 04.11.2026 · Ansprechpartner fachlich: Sascha (Projektleitung)
Schritt-für-Schritt-Klickanleitung: `docs/deployment.md`. Dieses Dokument erklärt Aufbau, Sicherheit, Auswirkungen
auf die Vereinsdomain und die Optionen dafür.

---

## 1. Kurzfassung

- **Was:** Eine Handy-Web-App für Jugendtrainer. Sie zeigt, welche Kinder im Probetraining sind (max. 6 Trainings),
  wer einen Mitgliedsantrag abgegeben hat und wer Mitglied ist. DFBnet bleibt führend, die App wird nicht daran angebunden.
- **Womit:** Eine statische Seite und eine kleine API als **Cloudflare Worker**, Login über **Cloudflare Access**
  (Einmal-Code per E-Mail), Daten in **Airtable**. Kein eigener Server, keine Datenbank beim Verein, kein Patchen.
- **Was wir von der IT brauchen:**
  1. eine Entscheidung zur Adresse (Abschnitt 5) – **ein Nameserver-Umzug von esc-06.de ist nicht zwingend**,
  2. ggf. Mitwirkung bei der Domain (je nach Option: nichts, eine Weiterleitung oder ein DNS-Umzug),
  3. idealerweise Verwaltung des Cloudflare-Vereinskontos (zweiter Admin neben der Projektleitung).
- **Kosten:** 0 € bei Cloudflare (Free-Tarife). Airtable je nach Nutzung 0 € oder ein Team-Platz (siehe 7).
  Bei Option C zusätzlich eine eigene Domain (wenige Euro im Jahr).

## 2. Aufbau

```
Trainer-Handy (Browser)
   │  HTTPS
   ▼
Cloudflare Access ── Login per Einmal-Code an hinterlegte Trainer-E-Mails, Sitzung bis 1 Monat
   │  setzt signiertes JWT (Cf-Access-Jwt-Assertion)
   ▼
Cloudflare Worker „esc06-probetraining“
   ├─ liefert die App aus (statische Dateien aus app/)
   ├─ /api/*: prüft JWT, ordnet E-Mail → Mannschaft(en) zu, filtert Daten
   ├─ Workers KV „UNDO“: merkt sich 24 h die Werte vor „War heute da“ (für Rückgängig)
   │  HTTPS, Personal Access Token (Worker-Secret)
   ▼
Airtable-Base „Probetraining & Neuanmeldungen“
   ├─ Elternformular (QR-Code beim ersten Training) → neuer Datensatz
   └─ Automationen: Antragsmail an Eltern, Info an Verwaltung/Trainer, wöchentliche Löschliste
```

Code: Repository `ESC_Public` (TypeScript, 51 automatisierte Tests). Die App ist eine einzelne HTML-Datei ohne Build.

## 3. Sicherheit

| Thema | Umsetzung |
|---|---|
| Anmeldung | Cloudflare Access, nur E-Mail-Adressen aus der Richtlinie „Trainer“; kein Passwort beim Verein |
| Prüfung im Worker | JWT wird vollständig geprüft (RS256-Signatur gegen die Access-Zertifikate, Aussteller, Audience, Ablauf). Der Header `Cf-Access-Authenticated-User-Email` allein wird **nicht** vertraut. Ohne konfigurierte Access-Werte lässt der Worker niemanden rein. |
| Berechtigung | E-Mail muss in Airtable „Mannschaften → Trainer E-Mail“ stehen; jeder Lese- und Schreibzugriff wird auf die eigene(n) Mannschaft(en) gefiltert. Fremde Datensätze werden wie nicht vorhanden behandelt. |
| Schreibschutz | Limit (6), einmal pro Tag, Rückgängig nur am selben Tag – serverseitig geprüft; POST von fremden Origins abgelehnt |
| Geheimnisse | Nur ein Secret: Airtable-Token, als Worker-Secret (`wrangler secret put`). Token-Scopes nur `data.records:read/write`, nur diese eine Base. Nichts Geheimes im Repository. |
| Erreichbarkeit | Nur über die per Access geschützte Adresse. `workers_dev` und Preview-URLs sind aus, außer bei Option B (dann mit Access). |
| Logs | Nur Fehlercodes, keine Namen oder Kontaktdaten |
| Abhängigkeiten im Browser | Google Fonts und `qrcodejs 1.0.0` von cdnjs (fest versioniert) |

## 4. Daten und Datenschutz

| Daten | Wo | Wer sieht sie |
|---|---|---|
| Name, Geburtsdatum des Kindes, Mannschaft, Name/E-Mail/Telefon eines Elternteils, Einwilligung, Probetraining-Zähler und Daten, Status | Airtable (Airtable Inc., USA) | Verwaltung (Airtable), Trainer der eigenen Mannschaft (App) |
| In der App beim Trainer | nur Name, **Jahrgang** (nicht Geburtsdatum), Zähler, letztes Training, Status; Elternname und Telefon **nur** wenn das Limit erreicht ist | Trainer der Mannschaft |
| Vorwerte für „Rückgängig“ | Cloudflare Workers KV, 24 h, nur Datensatz-ID, Zähler, Datum | niemand (technisch) |
| Login-Protokoll | Cloudflare Zero Trust (E-Mail, Zeitpunkt, IP) | Kontoadmins |
| Trainer-E-Mails | Airtable und Access-Richtlinie | Kontoadmins |

- Löschkonzept: Airtable-Formel „Löschen fällig“ (8 Wochen nach dem 1. Training ohne Beitritt, sofort bei Absage,
  14 Tage nach Spielberechtigung). Automation 4 mailt montags die Liste; gelöscht wird von Hand durch die Verwaltung.
- **Vor dem Echtbetrieb (offen):** Zustimmung Vorstand, AV-Verträge mit Airtable und Cloudflare, Ergänzung der
  Datenschutzerklärung, Einwilligungstext im Formular vervollständigen. Bis dahin nur Beispieldaten.
- Hinweis zur US-Verarbeitung: betrifft Airtable ohnehin. Durch Cloudflare kommt ein weiterer US-Anbieter hinzu, der die
  Daten aber nur durchleitet (bzw. 24 h die Rückgängig-Werte hält). Bewertung bitte durch Vorstand/Datenschutz.

## 5. Adresse der App – Optionen

Cloudflare kann einen Worker unter einer eigenen Domain nur betreiben, wenn diese Domain als **Zone in Cloudflare** liegt.
Im kostenlosen Tarif heißt das: **Nameserver der ganzen Domain zu Cloudflare.** Eine Teil-Einrichtung per CNAME gibt es
erst ab dem Business-Tarif, das Auslagern nur einer Subdomain als eigene Zone nur im Enterprise-Tarif.

| Option | Adresse für Trainer | Eingriff in esc-06.de | Aufwand | Bewertung |
|---|---|---|---|---|
| **A** Nameserver von esc-06.de zu Cloudflare | `probetraining.esc-06.de` | **groß:** gesamte DNS-Verwaltung wechselt zu Cloudflare | mittel, sorgfältig | sauberste Lösung, aber Eingriff in Website/E-Mail-DNS |
| **B** Cloudflare-Adresse + Weiterleitung | `….workers.dev`, optional `probetraining.esc-06.de` als Weiterleitung | **keiner** bzw. nur eine Weiterleitung beim bisherigen Anbieter | gering | **empfohlen für den Start**, falls A nicht gewünscht |
| **C** Eigene, zusätzliche Domain bei Cloudflare | z. B. `esc06-app.de` | **keiner** | gering, Domain-Kosten | gute Dauerlösung ohne Eingriff |
| **D** Cloudflare for SaaS (CNAME auf eigene Zone aus C) | `probetraining.esc-06.de` | **gering:** ein CNAME + Prüf-TXT | höher | möglich, aber komplexer; Zusammenspiel mit Access vorher testen |

### Option A – Nameserver-Umzug

Die Domain bleibt beim bisherigen Registrar, nur die autoritativen Nameserver wechseln. Website und E-Mail laufen weiter,
**wenn alle DNS-Einträge korrekt übernommen werden**. Risiken und Gegenmaßnahmen:

- [ ] Vorher die **komplette Zone exportieren** (Zonendatei oder Screenshot aller Einträge beim bisherigen Anbieter).
      Der automatische Import von Cloudflare findet nicht alles (z. B. DKIM-Selektoren, SRV/Autodiscover, selten genutzte Subdomains).
- [ ] **E-Mail besonders prüfen:** MX, SPF (`TXT v=spf1 …`), DKIM (`…._domainkey`), DMARC (`_dmarc`), Autodiscover/SRV.
- [ ] Alle importierten Einträge auf **„Nur DNS“ (graue Wolke)** stellen. Sonst leitet Cloudflare den Website-Verkehr
      als Proxy durch, was das Verhalten der Website ändern kann.
- [ ] **DNSSEC:** Ist DNSSEC beim Registrar aktiv, **vor** dem Umzug deaktivieren (DS-Eintrag entfernen), sonst ist die
      Domain nach dem Wechsel nicht mehr auflösbar. Nach dem Umzug DNSSEC in Cloudflare aktivieren und den neuen
      DS-Eintrag beim Registrar hinterlegen.
- [ ] Prüfen, ob das Hosting-Paket externe Nameserver erlaubt. Manche Pakete verwalten DNS fest mit; Mail- oder
      Website-Funktionen des Anbieters können dann eingeschränkt sein.
- [ ] Einige Tage vorher die TTLs senken; Umzug außerhalb von Spieltagen/Anmeldephasen.
- **Rückweg:** Nameserver beim Registrar wieder auf den alten Anbieter setzen (Zone dort nicht löschen, bis alles läuft).
- **Organisatorisch:** Die DNS-Verwaltung liegt danach im Cloudflare-Konto des Vereins. Das sollte die IT
  (mit-)verwalten, mit Zwei-Faktor-Anmeldung und mindestens zwei Admins.

### Option B – workers.dev mit Access (ohne Eingriff)

- In `worker/wrangler.jsonc`: `"workers_dev": true`, keine `routes`. **Access für den Worker einschalten**
  (im Dashboard beim Worker unter Einstellungen → Domains & Routen bei `workers.dev`), bevor Trainer den Link bekommen.
- Den AUD-Tag der dabei angelegten Access-Anwendung und die Team-Domain in `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` eintragen.
- Optional beim bisherigen DNS-/Hosting-Anbieter eine **HTTP-Weiterleitung** `probetraining.esc-06.de → https://esc06-probetraining.<konto>.workers.dev`
  einrichten, damit Trainer eine merkbare Adresse haben (die Adresszeile zeigt danach die workers.dev-Adresse).
- Nachteil: lange Adresse; die App ist an den Kontonamen im workers.dev-Subdomain gebunden. Später jederzeit auf A oder C umstellbar.

### Option C – eigene Domain

- Eine kurze Domain registrieren (z. B. `esc06-app.de`), bei Cloudflare als Zone anlegen (Free), Nameserver beim
  Registrar auf Cloudflare setzen. Da auf dieser Domain sonst nichts läuft, gibt es kein Risiko für Website oder E-Mail.
- In `wrangler.jsonc` die Route z. B. `probetraining.esc06-app.de` als Custom Domain eintragen.
- Optional auch hier eine Weiterleitung von `probetraining.esc-06.de`.

### Option D – Cloudflare for SaaS

Die eigene Zone aus Option C stellt `probetraining.esc-06.de` als „Custom Hostname“ bereit; beim bisherigen Anbieter
genügen ein CNAME und ein TXT-Eintrag zur Validierung. Laut Cloudflare sind 100 Custom Hostnames kostenlos. Ob Access mit
Custom Hostnames wie gewünscht zusammenspielt, ist **nicht geprüft** – nur angehen, wenn die Adresse unter esc-06.de
wichtig ist und A ausscheidet.

**Empfehlung:** Start mit **B** (sofort, ohne Eingriff, optional mit Weiterleitung). Wenn sich die App bewährt:
**A**, falls die IT den Umzug mittragen möchte, sonst **C**.

### Ohne Cloudflare

Möglich, aber deutlich mehr Aufwand: Login (Access) und Rückgängig-Speicher (KV) müssten ersetzt werden, z. B. durch
einen eigenen Magic-Link-Login auf einem anderen Hoster. Die Fachlogik ist gekapselt (`worker/src/domain.ts`, `api.ts`),
der Umbau beträfe vor allem `auth.ts`, `undo.ts` und den Einstiegspunkt.

## 6. Deployment (technisch)

Voraussetzungen: Node.js ≥ 20, Zugriff auf das Repository, Cloudflare-Vereinskonto, Airtable-Token.

```bash
cd worker
npm install
npm run check                          # Typprüfung + 51 Tests
npx wrangler login                     # mit dem Vereinskonto
npx wrangler kv namespace create UNDO  # ID in wrangler.jsonc eintragen
# wrangler.jsonc: ACCESS_TEAM_DOMAIN, ACCESS_AUD, routes (A/C) bzw. workers_dev (B)
npx wrangler secret put AIRTABLE_TOKEN
npx wrangler deploy
```

Access: Zero Trust → Login-Methode „One-time PIN“ → Self-hosted-Anwendung für die gewählte Adresse, Sitzungsdauer
1 Monat, Richtlinie „Zulassen“ für die Gruppe „Trainer“ (E-Mail-Liste). Details mit Klickpfaden: `docs/deployment.md`.

**Abnahme:** privates Fenster → Login muss erscheinen; Trainer sieht nur die eigene Mannschaft; Adresse ohne Mannschaft →
„Kein Zugang“; `/api/kids` ohne Login → keine Daten; „War heute da“ und „Rückgängig“ ändern Zähler/Datum in Airtable.

Lokal ohne Airtable testen: `npm run dev:mock` → http://localhost:8787 (erfundene Daten).

## 7. Betrieb

| Aufgabe | Wie |
|---|---|
| Trainer hinzufügen/entfernen | Airtable „Mannschaften“ **und** Access-Gruppe „Trainer“ (beide Listen müssen übereinstimmen); beim Entfernen Sitzungen in Zero Trust widerrufen |
| Updates der App | `npm run check && npx wrangler deploy` (optional automatisch über die GitHub-Anbindung von Workers) |
| Token-Rotation | neuen Airtable-Token anlegen → `wrangler secret put AIRTABLE_TOKEN` → alten löschen; z. B. jährlich und bei Personalwechsel |
| Überwachung | Worker-Logs (nur Fehlercodes), Zero-Trust-Login-Protokoll |
| Airtable-Kontingent | Free: 1.000 API-Aufrufe/Monat. Der Worker cacht (Mannschaften 5 min, Kinderliste 60 s); bei vielen Mannschaften trotzdem knapp → Team-Platz für den Token-Inhaber |
| Konten | Cloudflare und Airtable auf Vereinsadressen, Zwei-Faktor, mindestens zwei Admins |
| Ausstieg | Worker löschen (`wrangler delete`), Access-Anwendung löschen, ggf. DNS-Eintrag/Weiterleitung entfernen; Daten liegen vollständig in Airtable (CSV-Export möglich) |

## 8. Entscheidungen für die IT

1. Option für die Adresse: A, B, C (oder D)?
2. Wer verwaltet das Cloudflare-Vereinskonto mit (zweiter Admin)?
3. Bei A: Wer führt den Nameserver-Umzug durch, und wann?
4. Bei B/C: Soll `probetraining.esc-06.de` als Weiterleitung eingerichtet werden?
