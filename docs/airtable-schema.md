# Airtable – Schema & IDs (Stand 03.11.2026, nach Umstellung auf 6 Probetrainings)

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
| Ampel | `fldmhyiAvuf04lT1P` | Formel – Limit **6** |
| Löschen fällig | `fldfuXXYewGHR2F5s` | Formel – Frist **56 Tage** (8 Wochen); spielberechtigt: 14 Tage nach „Spielberechtigt seit“ |
| Trainer | `fldboIYe5zLCmv3ZA` | Lookup |
| Trainer E-Mail | `fld2VgBCM8qAv9LBr` | Lookup |
| Spielberechtigt seit | `fldYRU9DWyxvP1Jp1` | Datum (Automation 5) |

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
IF({Anzahl Probetrainings} >= 6, "⛔ Limit erreicht – nur mit Antrag", "🔴 Probetraining " & ({Anzahl Probetrainings} & "") & "/6"))
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
| 1 | Eltern nach 2. Probetraining: Mitgliedsantrag schicken | `wflK2bJewOylD3F7E` | Zähler ≥ 2 und Status = Probetraining und E-Mail gefüllt | Mail an Eltern, Status → „Antrag ausgehändigt/verschickt“ | `[LINK ZUM MITGLIEDSANTRAG EINFÜGEN]`; Text erwähnt „Ab dem 3. Probetraining …“ → auf 6 anpassen |
| 2 | Antrag eingegangen: Verwaltung informieren | `wflnMGRE7Ca4BoHyx` | Status = Antrag eingegangen | Datum setzen, Mail an Verwaltung | `verwaltung@example.org` |
| 3 | In DFBnet erfasst: Trainer informieren | `wflkZScVyCN37Dpu4` | Status = In DFBnet erfasst | Datum setzen, Mail an Trainer (Lookup) | – |
| 4 | Wöchentlich: Datenschutz-Löschliste | `wflcgjCeU3htUMKhn` | Montag (Cron, 06:00 UTC) | Mail mit „Löschen fällig“-Datensätzen | `verwaltung@example.org` |
| 5 | Spielberechtigt: Datum setzen | `wflTSgXU6L5bnECWU` | Status = Spielberechtigt | „Spielberechtigt seit“ = heute | – |

Automation 1: Mailtext am 03.11.2026 auf 6 Probetrainings angepasst („Insgesamt sind 6 Probetrainings möglich. Ab dem 7. Training … nur mit Antrag“); Auslöser bleibt „nach dem 2. Training“.

Automationen kann nur der Nutzer in der Airtable-Oberfläche einschalten.

## Interface „Probetraining-App“ `pbdaCQY8BHE63cGe7`
- Seite „Trainer: Wer darf mittrainieren?“ `pagEV3yyo0GAPGT6c` (Grid, gruppiert nach Mannschaft) – wird durch eigene App abgelöst
- Seite „Verwaltung: Status-Board“ `pagc14tSriQXTpxwW` (Kanban nach Status) – **bleibt Arbeitsplatz der Verwaltung**

## Noch nicht vorhanden
- Formular-Ansicht für den QR-Code (Prefill Mannschaft, Status = Probetraining, Zähler = 1, Erstes Probetraining = heute)
