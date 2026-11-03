import type { AttendanceValues, DataSource } from "./datasource";
import type { KidRecord, Team } from "./domain";

/**
 * Kurzzeit-Cache vor der Datenquelle, um das Airtable-Kontingent (Free-Plan: 1.000 Aufrufe/Monat) zu schonen.
 * Liegt im Speicher der Worker-Instanz: einfach, kostenlos, aber pro Instanz. Nach einem Schreibzugriff wird
 * der Datensatz im Cache direkt ersetzt; andere Instanzen sehen die Änderung spätestens nach `kidsTtlMs`.
 * Schreibzugriffe lesen immer frisch (getKid), damit Limit- und Mannschaftsprüfung nie auf alten Daten beruhen.
 */
export class CachedDataSource implements DataSource {
  private teams?: { at: number; value: Team[] };
  private kids?: { at: number; value: KidRecord[] };

  constructor(
    private readonly inner: DataSource,
    private readonly opts: { teamsTtlMs: number; kidsTtlMs: number; now?: () => number },
  ) {}

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  async listTeams(): Promise<Team[]> {
    if (!this.teams || this.now() - this.teams.at > this.opts.teamsTtlMs) {
      this.teams = { at: this.now(), value: await this.inner.listTeams() };
    }
    return this.teams.value;
  }

  async listKids(): Promise<KidRecord[]> {
    if (!this.kids || this.now() - this.kids.at > this.opts.kidsTtlMs) {
      this.kids = { at: this.now(), value: await this.inner.listKids() };
    }
    return this.kids.value;
  }

  getKid(id: string): Promise<KidRecord | null> {
    return this.inner.getKid(id);
  }

  async updateAttendance(id: string, values: AttendanceValues): Promise<KidRecord> {
    const updated = await this.inner.updateAttendance(id, values);
    if (this.kids) {
      this.kids = { ...this.kids, value: this.kids.value.map((k) => (k.id === id ? updated : k)) };
    }
    return updated;
  }
}
