# Einwilligungstext & Rollen

Ausführliche Fassung als Claude-Dokument: https://claude.ai/code/artifact/aaa191a4-d5ab-417d-a6e3-50e41c56a885
(Kein Rechtsrat – vom Vorstand/Datenschutzbeauftragten freigeben lassen.)

## Einwilligungstext für das Elternformular (Pflicht-Häkchen)

So im Elternformular `app/anmeldung/index.html` hinterlegt (Kurzfassung am Häkchen, Details unter „Was passiert mit den Daten?“). Platzhalter werden in `app/anmeldung/config.js` ersetzt.

Ich willige ein, dass der ESC Rellinghausen 06 e. V. die angegebenen Daten (Name und Geburtsdatum des Kindes,
Mannschaft, Name und Kontaktdaten der/des Erziehungsberechtigten) zur Organisation des Probetrainings und zur
Kontaktaufnahme wegen einer möglichen Mitgliedschaft verarbeitet. Bei minderjährigen Teilnehmenden erkläre ich,
dass ich erziehungsberechtigt bin bzw. die Einwilligung der Erziehungsberechtigten vorliegt.

- Zweck: Nachweis der Probetrainings, Information des Trainers, Zusendung des Mitgliedsantrags.
- Empfänger: Trainer der Mannschaft und Vereinsverwaltung; Verarbeitung über Airtable (Airtable Inc., USA) [und Cloudflare].
- Speicherdauer: Löschung nach Erfassung der Mitgliedschaft, bei Absage, spätestens 8 Wochen nach dem ersten Probetraining.
- Widerruf jederzeit, z. B. per E-Mail an [E-Mail-Adresse].
- Verantwortlich: [Vereinsanschrift, Vorstand], Datenschutzerklärung: [Link].

## Rollen

| Wer | Aufgabe | Werkzeug |
|---|---|---|
| Eltern | Formular per QR-Code beim 1. Training (ohne Anmeldung); Mitgliedsantrag abgeben | Elternformular, Mail |
| Trainer | pro Training „War heute da“ tippen, auf Ampel achten | Trainer-App |
| Verwaltung | Status setzen: Antrag eingegangen → In DFBnet erfasst → Spielberechtigt; montags Löschliste abarbeiten | Airtable-Kanban, DFBnet |
| Automatisch | Antragsmail an Eltern (nach 2. Training), Info an Verwaltung, Info an Trainer, Löschliste | Airtable-Automationen |
