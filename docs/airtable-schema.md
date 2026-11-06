# Airtable – Schema & IDs (Stand 06.11.2026: 3 Probetrainings)

Vor Änderungen per Schema-Abfrage prüfen, ob der Nutzer inzwischen selbst etwas geändert hat.

- **Workspace:** „Mein erster Workspace“ `wspWZ1Klz4CRtgDU4`
- **Base:** „Probetraining & Neuanmeldungen“ `appBKLVL4A4mI2QHr`

## Tabelle „Mannschaften“ `tbl6pyFB5M2UoFmCF`

| Feld | ID | Typ |
|---|---|---|
| Mannschaft (Primär) | `fldb4pIWaZQt2lYJ0` | Text |
| Altersklasse | `fldFVQv8zJ7bZV23K` | Single Select (Bambini … Alte Herren) |
| Trainer | `fld8WnvL4lrRnfJ9P` | Text |
| Trainer E-Mail | `fldW5d0dO3sGbvsQG` | E-Mail – **Login-Schlüssel für die App** |
| Trainer Telefon | `fld7XzdZc8HAnYYkf` | Telefon |

Beispieldatensätze: F1 `recuL5quoCtlJlxvf`, E1 `recxrebTTbfjH20HB`, D1 `recn8mIMjjUEzlqis` (E-Mails `trainer.*@example.org`).

## Tabelle „Interessenten“ `tblyfT5TCWF76fZ44`

| Feld | ID | Typ / Hinweis |
|---|---|---|
| Name (Primär) | `fldWH5f8NuyKSZAAm` | Text |
| Geburtsdatum | `fldz5RqCREzQb8Gew` | Datum |
| Mannschaft | `fldqEXZu0N4WNJMjt` | Link → Mannschaften |
| Status | `fldgXAjpTkk8tCSj8` | Single Select, siehe unten |
| Anzahl Probetrainings | `fldDwB2Cl9qswdjEg` | Zahl |
| Erstes Probetraining | `fldeUlh3Si9dcj33X` | Datum |
| Letztes Probetraining | `fldvP82QxQlHDLy77` | Datum |
| Erziehungsberechtigte/r | `fldDgCoupcrJnrXsz` | Text |
| E-Mail | `fldcLIrtbOMJTLAQ3` | E-Mail (Eltern) |
| Telefon | `fld6qcqlKJLk3QZxq` | Telefon |
| Datenschutz-Einwilligung | `fldSWUKHlLliAOqHw` | Checkbox |
| Antrag eingegangen am | `fldIiv2fzk2yLzeMO` | Datum (Automation 2) |
| In DFBnet erfasst am | `fldpRvJWKLM32GA2s` | Datum (Automation 3) |
| Bemerkungen | `fldDXqSG8iFox39DP` | Langtext |
| Ampel | `fldmhyiAvuf04lT1P` | Formel – Limit **3** (seit 06.11.2026, vorher 6) |
| Löschen fällig | `fldfuXXYewGHR2F5s` | Formel – Frist **56 Tage** (8 Wochen); spielberechtigt: 14 Tage nach „Spielberechtigt seit“ |
| Trainer | `fldboIYe5zLCmv3ZA` | Lookup |
| Trainer E-Mail | `fld2VgBCM8qAv9LBr` | Lookup |
| Spielberechtigt seit | `fldYRU9DWyxvP1Jp1` | Datum (Automation 5) |
| Trainingstermine | `fldy7NF7MKeneEY5R` | Langtext – Teilnahme-Protokoll, ein Datum (TT.MM.JJJJ) pro Zeile; pflegt die App bei „War heute da“/„Rückgängig“ (Nachweis z. B. für die Versicherung) |
| E-Mail unzustellbar | `fldByGoeoWiEw9qVs` | Checkbox – setzt die Verwaltung, wenn die Antragsmail zurückkommt; Trainer wird informiert (Automation 7 + App), Korrektur in der App entfernt das Häkchen |
| Antrag auf Papier | `fldlyupDUsoOK2Dp5` | Checkbox – Eltern ohne E-Mail; kein Mailversand (Automation 1 braucht E-Mail), die Trainer-App erinnert ab dem 2. Training an den Papierantrag |

### Status-Optionen (`fldgXAjpTkk8tCSj8`)
| Name | Choice-ID |
|---|---|
| Probetraining | `selKpY0bHlvFGfZVF` |
| Antrag ausgehändigt/verschickt | `seljClGK3qQ1joDJO` |
| Antrag eingegangen | `sel1ox8p1YSkYGsQy` |
| In DFBnet erfasst | `selAHhr0HWooBBM5q` |
| Spielberechtigt | `selV3cO6Tff8Aq9dW` |
| Kein Interesse / abgesagt | `selkvESXwMO0jofRS` |

Mapping App ↔ Airtable: `probe` = Probetraining **oder** Antrag ausgehändigt/verschickt · `antrag` = Antrag eingegangen · `mitglied` = In DFBnet erfasst · `spielberechtigt` = Spielberechtigt · abgesagt = in App ausblenden.

### Aktuelle Formeln
Ampel:
```
SWITCH({Status},
"Spielberechtigt", "✅ spielberechtigt",
"In DFBnet erfasst", "🟢 Mitglied (Pass in Arbeit)",
"Antrag eingegangen", "🟡 Antrag liegt vor",
"Kein Interesse / abgesagt", "⚪ abgesagt",
IF({Anzahl Probetrainings} >= 3, "⛔ Limit erreicht – nur mit Antrag", "🔴 Probetraining " & ({Anzahl Probetrainings} & "") & "/3"))
```
Löschen fällig (ohne „Spielberechtigt seit“ gilt ein spielberechtigtes Kind sofort als fällig – Rückfall, falls Automation 5 nicht lief):
```
IF(OR(
  AND({Status} != "In DFBnet erfasst", {Status} != "Spielberechtigt", {Erstes Probetraining}, DATETIME_DIFF(TODAY(), {Erstes Probetraining}, 'days') > 56),
  {Status} = "Kein Interesse / abgesagt",
  AND({Status} = "Spielberechtigt", OR(NOT({Spielberechtigt seit}), DATETIME_DIFF(TODAY(), {Spielberechtigt seit}, 'days') > 14))
), "🗑 löschen", "")
```

## Automationen (alle Entwurf, ausgeschaltet)

| # | Name | ID | Auslöser | Aktion | Platzhalter |
|---|---|---|---|---|---|
| 1 | Eltern nach 2. Probetraining: Mitgliedsantrag schicken | `wflK2bJewOylD3F7E` | Zähler ≥ 2 und Status = Probetraining und E-Mail gefüllt | Mail an Eltern, Status → „Antrag ausgehändigt/verschickt“ | Antrags-Link **vorläufig** = Platzhalter-Seite (siehe unten) |
| 2 | Antrag eingegangen: Verwaltung informieren | `wflnMGRE7Ca4BoHyx` | Status = Antrag eingegangen | Datum setzen, Mail an Verwaltung | Empfänger **vorläufig** Sascha (privat) |
| 3 | In DFBnet erfasst: Trainer informieren | `wflkZScVyCN37Dpu4` | Status = In DFBnet erfasst | Datum setzen, Mail an Trainer (Lookup) | – |
| 4 | Wöchentlich: Datenschutz-Löschliste | `wflcgjCeU3htUMKhn` | Montag (Cron, 06:00 UTC) | Mail mit „Löschen fällig“-Datensätzen | Empfänger **vorläufig** Sascha (privat) |
| 5 | Spielberechtigt: Datum setzen | `wflTSgXU6L5bnECWU` | Status = Spielberechtigt | „Spielberechtigt seit“ = heute | – |
| 7 | E-Mail unzustellbar: Trainer informieren | `wflepxM0tNONTlyMq` | „E-Mail unzustellbar“ = ✓ | Mail an Trainer (Lookup) mit Bitte, die E-Mail in der App zu korrigieren | – |
| 6 | Formular-Anmeldung: 1. Probetraining eintragen (**nicht einschalten**, nur für das Airtable-Reserveformular) | `wflxlxrVhaLWPSY8c` | Formular `pag2AaadRpeiFuvDB` abgeschickt | Status = Probetraining, Zähler = 1, erstes + letztes Probetraining = heute | – |

Automation 1: Mailtext am 06.11.2026 auf 3 Probetrainings angepasst („Insgesamt sind 3 Probetrainings möglich. Ab dem 4. Training … nur mit Antrag“); Auslöser bleibt „nach dem 2. Training“.

### Ablauf bei unzustellbarer Antragsmail
1. Verwaltung bemerkt die Unzustellbar-Meldung und setzt beim Kind **„E-Mail unzustellbar“**.
2. Automation 7 mailt dem Trainer; in der Trainer-App steht beim Kind rot „E-Mail unzustellbar“ mit der falschen Adresse.
3. Trainer fragt beim Training nach und tippt **„E-Mail korrigieren“** (neue Adresse zweimal eingeben) oder **„Antrag auf Papier geben“**.
4. Der Worker speichert die neue Adresse (bzw. „Antrag auf Papier“), entfernt das Häkchen und setzt den Status von
   „Antrag ausgehändigt/verschickt“ zurück auf „Probetraining“ → **Automation 1 verschickt den Antrag automatisch neu**.
5. Korrigiert die Verwaltung selbst in Airtable: E-Mail ändern, Häkchen entfernen, Status auf „Probetraining“ → gleicher Effekt.

**Wichtig:** Airtables eigener Mailversand (Aktion „Send email“) schickt über Airtable-Server; Unzustellbar-Meldungen
erreichen den Verein damit **nicht zuverlässig**. Empfehlung: Automation 1 auf ein Vereinspostfach umstellen
(Airtable-Aktion „Gmail: Send email“ bzw. „Outlook: Send email“ mit verbundenem Vereinskonto) – dann landen
Unzustellbar-Meldungen in diesem Postfach. Bis dahin ist „Antwort an“ auf die Verwaltung gesetzt (vorläufig Sascha), damit
zumindest Rückfragen der Eltern ankommen.

### Vorläufige Werte (Stand 03.11.2026) – später ersetzen
- **Antrags-Link** (Automation 1): https://claude.ai/artifact/EMnvhd112CQZsZw9DdW4cs – Platzhalter-Seite „Mitgliedsantrag folgt, bis dahin Papierantrag beim Trainer“ (Quelle: `mitgliedsantrag/index.html`). Die Seite ist privat, bis sie über „Teilen“ freigegeben wird. Sobald es einen echten Online-Antrag gibt: URL in Automation 1 tauschen.
- **Verwaltungs-E-Mail** (Automation 2 und 4) und **„Antwort an“** in Automation 1: vorläufig Saschas private Adresse (bewusst nicht im Repo). Später durch die echte Verwaltungsadresse ersetzen.

Automationen kann nur der Nutzer in der Airtable-Oberfläche einschalten.

## Interface „Probetraining-App“ `pbdaCQY8BHE63cGe7`
- Seite „Trainer: Wer darf mittrainieren?“ `pagEV3yyo0GAPGT6c` (Grid, gruppiert nach Mannschaft) – wird durch eigene App abgelöst
- Seite „Verwaltung: Status-Board“ `pagc14tSriQXTpxwW` (Kanban nach Status) – **bleibt Arbeitsplatz der Verwaltung**

## Neue Kinder: eigenes Elternformular (seit 04.11.2026)

Eltern melden ihr Kind über das eigene Formular `https://anmeldung.<APP-DOMAIN>/?m=<Mannschafts-ID>` an (ohne Login; Mannschaft fest aus dem QR-Code,
Code: `app/anmeldung/`, `worker/src/public.ts`). Der Worker legt den Datensatz direkt an:
Name, Geburtsdatum, Mannschaft (Link), Status = Probetraining, Anzahl = 1, Erstes = Letztes Probetraining = heute,
Erziehungsberechtigte/r, E-Mail (oder leer + „Antrag auf Papier“ = ✓), Telefon, Datenschutz-Einwilligung = ✓, Trainingstermine = heute. Doppelte Anmeldungen (gleiche Mannschaft,
gleicher Name, gleiches Geburtsdatum) werden nicht erneut angelegt.

## Reserve: Airtable-Formular `pag2AaadRpeiFuvDB` (unveröffentlicht, **nicht mehr verwendet**)
- Eigenständiges Airtable-Formular (kein Interface), schreibt in „Interessenten“.
- Bearbeiten: https://airtable.com/appBKLVL4A4mI2QHr/pag2AaadRpeiFuvDB/edit
- Felder: Mannschaft (Pflicht, vorbelegt über den QR-Code), Name des Kindes, Geburtsdatum, Name eines Elternteils,
  E-Mail der Eltern (alle Pflicht), Telefon (freiwillig), Einwilligung (Pflicht-Häkchen mit Text aus `docs/einwilligung-und-rollen.md`).
- Status, Zähler und Datumsfelder sind **nicht** im Formular: Die setzt Automation 6 nach dem Absenden (Eltern können sie nicht verändern).
- Vorbelegung der Mannschaft per Link: `…/pag2AaadRpeiFuvDB/form?prefill_Mannschaft=<Name der Mannschaft>`
  (Adresse steht in `app/config.js`). Nach dem Veröffentlichen einmal prüfen, dass die Vorbelegung greift
  (ggf. im Formular-Editor „Vorbelegen per URL“ erlauben und das Feld als Verknüpfung vorbelegbar machen).
- Vor dem Veröffentlichen im Einwilligungstext ersetzen: `[E-MAIL-ADRESSE]`, `[VEREINSANSCHRIFT, VORSTAND]`, `[LINK]`.
