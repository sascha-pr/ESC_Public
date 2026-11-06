/**
 * Fachliche Regeln der Probetraining-App – unabhängig von Airtable, Cloudflare und HTTP.
 * Alles hier ist pur und direkt testbar.
 */

/** Probetrainings, bis ein Mitgliedsantrag Pflicht ist (muss zur Airtable-Formel „Ampel“ passen). */
export const MAX_TRIALS = 6;
/** So viele Tage bleiben spielberechtigte Kinder in der App sichtbar (danach Löschliste). */
export const SHOW_PLAYABLE_DAYS = 14;
/** Zeitzone für „heute“ – Trainings finden in Essen statt. */
export const TIME_ZONE = "Europe/Berlin";

/** Status, wie ihn die Datenquelle kennt (entspricht den Airtable-Optionen). */
export type SourceStatus =
  | "probetraining"
  | "antrag_verschickt"
  | "antrag_eingegangen"
  | "dfbnet_erfasst"
  | "spielberechtigt"
  | "abgesagt"
  /** Option in der Quelle, die der Worker nicht kennt (z. B. umbenannt) – wird sicherheitshalber ausgeblendet. */
  | "unbekannt";

/** Status, wie ihn die App kennt (siehe Mapping in docs/airtable-schema.md). */
export type AppStatus = "probe" | "antrag" | "mitglied" | "spielberechtigt";

export interface Team {
  id: string;
  name: string;
  ageClass: string | null;
  trainerName: string | null;
  /** Login-Schlüssel – immer klein geschrieben. */
  trainerEmail: string | null;
}

/** Ein Kind so, wie es aus der Datenquelle kommt (nur im Worker, nie 1:1 an den Client). */
export interface KidRecord {
  id: string;
  name: string;
  birthDate: string | null; // YYYY-MM-DD
  teamIds: string[];
  status: SourceStatus | null;
  count: number;
  firstTraining: string | null; // YYYY-MM-DD
  lastTraining: string | null; // YYYY-MM-DD
  parentName: string | null;
  phone: string | null;
  playableSince: string | null; // YYYY-MM-DD
  /** Teilnahme-Protokoll: jedes Probetraining-Datum (YYYY-MM-DD, aufsteigend) */
  trainingDates: string[];
  /** Eltern ohne E-Mail: Mitgliedsantrag auf Papier statt per Mail */
  paper: boolean;
  /** E-Mail der Eltern (nur im Worker; an den Trainer nur, wenn sie unzustellbar war) */
  email: string | null;
  /** Antragsmail kam zurück (von der Verwaltung gesetzt) */
  emailBounced: boolean;
}

/** Was ein Trainer über ein Kind sieht – bewusst minimal. */
export interface KidDto {
  id: string;
  name: string;
  /** Nur der Jahrgang, nicht das Geburtsdatum. */
  jg: number | null;
  count: number;
  last: string | null;
  status: AppStatus;
  attendedToday: boolean;
  /** Elternkontakt nur, wenn das Limit erreicht ist und der Trainer die Eltern ansprechen muss. */
  contact?: { parent: string | null; phone: string | null };
  /** Eltern haben keine E-Mail: Trainer gibt den Mitgliedsantrag auf Papier mit. */
  paperApplication?: true;
  /** Antragsmail kam zurück: Trainer soll die richtige E-Mail erfragen (mit der falschen Adresse zum Vergleich). */
  emailProblem?: { email: string | null };
}

export function toAppStatus(s: SourceStatus | null): AppStatus | null {
  switch (s) {
    case "probetraining":
    case "antrag_verschickt":
    case null: // ohne Status (z. B. frisch über das Formular angelegt) gilt das Kind als im Probetraining
      return "probe";
    case "antrag_eingegangen":
      return "antrag";
    case "dfbnet_erfasst":
      return "mitglied";
    case "spielberechtigt":
      return "spielberechtigt";
    case "abgesagt":
    case "unbekannt":
      return null;
  }
}

/** Heutiges Datum (YYYY-MM-DD) in deutscher Zeit. */
export function todayIso(now: Date): string {
  // en-CA formatiert als YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Ganze Tage von a bis b (beides YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

export function isLimitReached(kid: KidRecord): boolean {
  return toAppStatus(kid.status) === "probe" && kid.count >= MAX_TRIALS;
}

/** Soll das Kind in der Trainer-App erscheinen? */
export function isVisible(kid: KidRecord, today: string): boolean {
  const status = toAppStatus(kid.status);
  if (status === null) return false; // abgesagt
  if (status === "spielberechtigt" && kid.playableSince) {
    return daysBetween(kid.playableSince, today) <= SHOW_PLAYABLE_DAYS;
  }
  return true;
}

export function toKidDto(kid: KidRecord, today: string): KidDto {
  const status = toAppStatus(kid.status) ?? "probe";
  const jg = kid.birthDate ? Number(kid.birthDate.slice(0, 4)) : null;
  const dto: KidDto = {
    id: kid.id,
    name: kid.name,
    jg: Number.isFinite(jg) ? jg : null,
    count: kid.count,
    last: kid.lastTraining,
    status,
    attendedToday: kid.lastTraining === today,
  };
  if (isLimitReached(kid)) dto.contact = { parent: kid.parentName, phone: kid.phone };
  if (kid.paper && status === "probe") dto.paperApplication = true;
  if (kid.emailBounced && !kid.paper && status === "probe") dto.emailProblem = { email: kid.email };
  return dto;
}

/** Protokoll-Text aus Airtable (eine Zeile pro Datum, TT.MM.JJJJ oder YYYY-MM-DD) → sortierte ISO-Daten. */
export function parseDates(text: string | null): string[] {
  const out = new Set<string>();
  for (const line of (text ?? "").split(/\r?\n/)) {
    const t = line.trim();
    let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
    if (m) out.add(`${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`);
    else if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) out.add(t);
  }
  return [...out].sort();
}

/** ISO-Daten → Protokoll-Text für Airtable (TT.MM.JJJJ, eine Zeile pro Datum). */
export function formatDates(dates: readonly string[]): string {
  return [...new Set(dates)].sort().map((d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`).join("\n");
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function isValidEmail(v: string): boolean {
  return v.length <= 120 && EMAIL.test(v);
}

export function belongsToTeams(kid: KidRecord, teamIds: readonly string[]): boolean {
  return kid.teamIds.some((id) => teamIds.includes(id));
}

export type AttendRefusal = "not_in_trial" | "already_today" | "limit_reached";

/** Darf für dieses Kind heute „War heute da“ gezählt werden? */
export function checkAttend(kid: KidRecord, today: string): AttendRefusal | null {
  if (toAppStatus(kid.status) !== "probe") return "not_in_trial";
  if (kid.lastTraining === today) return "already_today";
  if (kid.count >= MAX_TRIALS) return "limit_reached";
  return null;
}
