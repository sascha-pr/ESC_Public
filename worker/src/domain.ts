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
  return dto;
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
