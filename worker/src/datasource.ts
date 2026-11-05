import type { KidRecord, Team } from "./domain";

/**
 * Austauschbare Datenquelle (heute Airtable, später ggf. SeaTable).
 * Der Rest des Workers kennt nur dieses Interface.
 */
export interface DataSource {
  listTeams(): Promise<Team[]>;
  /** Alle Kinder aller Mannschaften – gefiltert wird im Worker. */
  listKids(): Promise<KidRecord[]>;
  /** Frisch aus der Quelle, ohne Cache (für Schreibzugriffe). */
  getKid(id: string): Promise<KidRecord | null>;
  updateAttendance(id: string, values: AttendanceValues): Promise<KidRecord>;
  /** Neues Kind aus dem Elternformular anlegen (Status Probetraining, 1. Training = heute). */
  createKid(kid: NewKid): Promise<KidRecord>;
}

export interface NewKid {
  name: string;
  birthDate: string; // YYYY-MM-DD
  teamId: string;
  parentName: string;
  email: string | null;
  phone: string | null;
  /** Keine E-Mail: Mitgliedsantrag auf Papier */
  paper: boolean;
  /** Tag der Anmeldung = 1. Probetraining */
  today: string;
}

export interface AttendanceValues {
  count: number;
  lastTraining: string | null;
  firstTraining: string | null;
  trainingDates: string[];
}

/** Fehler der Datenquelle; `status` ist der HTTP-Status der Gegenseite (0 = Netzwerkfehler). */
export class DataSourceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DataSourceError";
  }
}
