import { DataSourceError, type AttendanceValues, type DataSource, type NewKid } from "./datasource";
import type { KidRecord, SourceStatus, Team } from "./domain";

/** Feld-IDs aus docs/airtable-schema.md – IDs statt Namen, damit Umbenennungen nichts kaputt machen. */
export const AIRTABLE = {
  teams: {
    table: "tbl6pyFB5M2UoFmCF",
    name: "fldb4pIWaZQt2lYJ0",
    ageClass: "fldFVQv8zJ7bZV23K",
    trainer: "fld8WnvL4lrRnfJ9P",
    trainerEmail: "fldW5d0dO3sGbvsQG",
  },
  kids: {
    table: "tblyfT5TCWF76fZ44",
    name: "fldWH5f8NuyKSZAAm",
    birthDate: "fldz5RqCREzQb8Gew",
    team: "fldqEXZu0N4WNJMjt",
    status: "fldgXAjpTkk8tCSj8",
    count: "fldDwB2Cl9qswdjEg",
    firstTraining: "fldeUlh3Si9dcj33X",
    lastTraining: "fldvP82QxQlHDLy77",
    parentName: "fldDgCoupcrJnrXsz",
    phone: "fld6qcqlKJLk3QZxq",
    playableSince: "fldYRU9DWyxvP1Jp1",
    email: "fldcLIrtbOMJTLAQ3",
    consent: "fldSWUKHlLliAOqHw",
  },
} as const;

/** Namen der Status-Optionen in Airtable (Single Select liefert Namen, nicht Choice-IDs). */
const STATUS_BY_NAME: Record<string, SourceStatus> = {
  Probetraining: "probetraining",
  "Antrag ausgehändigt/verschickt": "antrag_verschickt",
  "Antrag eingegangen": "antrag_eingegangen",
  "In DFBnet erfasst": "dfbnet_erfasst",
  Spielberechtigt: "spielberechtigt",
  "Kein Interesse / abgesagt": "abgesagt",
};

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

type Fields = Record<string, unknown>;
interface AirtableRecord {
  id: string;
  fields: Fields;
}

export interface AirtableOptions {
  token: string;
  baseId: string;
  fetchFn?: typeof fetch;
  apiUrl?: string;
}

export class AirtableDataSource implements DataSource {
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly opts: AirtableOptions) {
    this.fetchFn = opts.fetchFn ?? ((...a) => fetch(...a));
    this.baseUrl = `${opts.apiUrl ?? "https://api.airtable.com/v0"}/${opts.baseId}`;
  }

  async listTeams(): Promise<Team[]> {
    const f = AIRTABLE.teams;
    const records = await this.listAll(f.table, [f.name, f.ageClass, f.trainer, f.trainerEmail]);
    return records.map((r) => ({
      id: r.id,
      name: str(r.fields[f.name]) ?? "",
      ageClass: str(r.fields[f.ageClass]),
      trainerName: str(r.fields[f.trainer]),
      trainerEmail: str(r.fields[f.trainerEmail])?.trim().toLowerCase() ?? null,
    }));
  }

  async listKids(): Promise<KidRecord[]> {
    const f = AIRTABLE.kids;
    const fields = [
      f.name, f.birthDate, f.team, f.status, f.count, f.firstTraining,
      f.lastTraining, f.parentName, f.phone, f.playableSince,
    ];
    const records = await this.listAll(f.table, fields);
    return records.map(toKid);
  }

  async getKid(id: string): Promise<KidRecord | null> {
    if (!RECORD_ID.test(id)) return null;
    const res = await this.request(`${AIRTABLE.kids.table}/${id}?returnFieldsByFieldId=true`);
    if (res.status === 404) return null;
    await ensureOk(res);
    return toKid((await res.json()) as AirtableRecord);
  }

  async updateAttendance(id: string, v: AttendanceValues): Promise<KidRecord> {
    if (!RECORD_ID.test(id)) throw new DataSourceError("Ungültige Datensatz-ID", 400);
    const f = AIRTABLE.kids;
    const res = await this.request(`${f.table}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        returnFieldsByFieldId: true,
        fields: { [f.count]: v.count, [f.lastTraining]: v.lastTraining, [f.firstTraining]: v.firstTraining },
      }),
    });
    await ensureOk(res);
    return toKid((await res.json()) as AirtableRecord);
  }

  async createKid(k: NewKid): Promise<KidRecord> {
    if (!RECORD_ID.test(k.teamId)) throw new DataSourceError("Ungültige Mannschafts-ID", 400);
    const f = AIRTABLE.kids;
    const res = await this.request(f.table, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        returnFieldsByFieldId: true,
        records: [{
          fields: {
            [f.name]: k.name,
            [f.birthDate]: k.birthDate,
            [f.team]: [k.teamId],
            [f.status]: "Probetraining",
            [f.count]: 1,
            [f.firstTraining]: k.today,
            [f.lastTraining]: k.today,
            [f.parentName]: k.parentName,
            [f.email]: k.email,
            [f.phone]: k.phone,
            [f.consent]: true,
          },
        }],
      }),
    });
    await ensureOk(res);
    const body = (await res.json()) as { records: AirtableRecord[] };
    return toKid(body.records[0]!);
  }

  private async listAll(table: string, fieldIds: string[]): Promise<AirtableRecord[]> {
    const out: AirtableRecord[] = [];
    let offset: string | undefined;
    do {
      const q = new URLSearchParams({ returnFieldsByFieldId: "true", pageSize: "100" });
      for (const id of fieldIds) q.append("fields[]", id);
      if (offset) q.set("offset", offset);
      const res = await this.request(`${table}?${q}`);
      await ensureOk(res);
      const body = (await res.json()) as { records: AirtableRecord[]; offset?: string };
      out.push(...body.records);
      offset = body.offset;
    } while (offset);
    return out;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await this.fetchFn(`${this.baseUrl}/${path}`, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${this.opts.token}` },
      });
    } catch {
      throw new DataSourceError("Airtable nicht erreichbar", 0);
    }
  }
}

async function ensureOk(res: Response): Promise<void> {
  if (res.ok) return;
  // Bewusst ohne Antworttext: der könnte Datensatzinhalte enthalten (keine Kinderdaten in Logs).
  throw new DataSourceError(`Airtable antwortet mit HTTP ${res.status}`, res.status);
}

function toKid(r: AirtableRecord): KidRecord {
  const f = AIRTABLE.kids;
  const statusName = str(r.fields[f.status]);
  const count = r.fields[f.count];
  const team = r.fields[f.team];
  return {
    id: r.id,
    name: str(r.fields[f.name]) ?? "",
    birthDate: str(r.fields[f.birthDate]),
    teamIds: Array.isArray(team) ? team.filter((x): x is string => typeof x === "string") : [],
    status: statusName ? (STATUS_BY_NAME[statusName] ?? "unbekannt") : null,
    count: typeof count === "number" ? count : 0,
    firstTraining: str(r.fields[f.firstTraining]),
    lastTraining: str(r.fields[f.lastTraining]),
    parentName: str(r.fields[f.parentName]),
    phone: str(r.fields[f.phone]),
    playableSince: str(r.fields[f.playableSince]),
  };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}
