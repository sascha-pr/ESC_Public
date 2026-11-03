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
}

export interface AttendanceValues {
  count: number;
  lastTraining: string | null;
  firstTraining: string | null;
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
