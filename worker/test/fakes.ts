import type { Authenticator } from "../src/auth";
import type { AttendanceValues, DataSource, NewKid } from "../src/datasource";
import type { KidRecord, Team } from "../src/domain";

/** Nur erfundene Beispieldaten – keine echten Kinder in Tests. */
export const TEAMS: Team[] = [
  { id: "recTeamF1aaaaaaaa", name: "F1-Jugend", ageClass: "F-Jugend", trainerName: "Jan", trainerEmail: "trainer.f1@example.org" },
  { id: "recTeamE1aaaaaaaa", name: "E1-Jugend", ageClass: "E-Jugend", trainerName: "Kathrin", trainerEmail: "trainer.e1@example.org" },
  { id: "recTeamD1aaaaaaaa", name: "D1-Jugend", ageClass: "D-Jugend", trainerName: "Murat", trainerEmail: "trainer.d1@example.org" },
  // Ein Trainer mit zwei Mannschaften
  { id: "recTeamD2aaaaaaaa", name: "D2-Jugend", ageClass: "D-Jugend", trainerName: "Murat", trainerEmail: "trainer.d1@example.org" },
];

export function kid(over: Partial<KidRecord> & { id: string }): KidRecord {
  return {
    name: "Beispielkind",
    birthDate: "2018-05-04",
    teamIds: ["recTeamF1aaaaaaaa"],
    status: "probetraining",
    count: 1,
    firstTraining: "2026-10-20",
    lastTraining: "2026-10-27",
    parentName: "Elternteil Beispiel",
    phone: "0170 0000000",
    playableSince: null,
    trainingDates: [],
    paper: false,
    ...over,
  };
}

export class FakeDataSource implements DataSource {
  calls = { listTeams: 0, listKids: 0, getKid: 0, update: 0, create: 0 };
  created: NewKid[] = [];
  constructor(
    public teams: Team[],
    public kids: KidRecord[],
  ) {}
  async listTeams() {
    this.calls.listTeams++;
    return structuredClone(this.teams);
  }
  async listKids() {
    this.calls.listKids++;
    return structuredClone(this.kids);
  }
  async getKid(id: string) {
    this.calls.getKid++;
    const k = this.kids.find((x) => x.id === id);
    return k ? structuredClone(k) : null;
  }
  async updateAttendance(id: string, v: AttendanceValues) {
    this.calls.update++;
    const k = this.kids.find((x) => x.id === id);
    if (!k) throw new Error("not found");
    k.count = v.count;
    k.lastTraining = v.lastTraining;
    k.firstTraining = v.firstTraining;
    k.trainingDates = [...v.trainingDates];
    return structuredClone(k);
  }
  async createKid(n: NewKid) {
    this.calls.create++;
    this.created.push(n);
    const k: KidRecord = {
      id: `recNew${String(this.calls.create).padStart(11, "0")}`, name: n.name, birthDate: n.birthDate, teamIds: [n.teamId],
      status: "probetraining", count: 1, firstTraining: n.today, lastTraining: n.today, parentName: n.parentName,
      phone: n.phone, playableSince: null, trainingDates: [n.today], paper: n.paper,
    };
    this.kids.push(k);
    return structuredClone(k);
  }
}

/** Header `X-Test-User` steht für die von Access bestätigte E-Mail. */
export const headerAuth: Authenticator = {
  authenticate: async (req) => req.headers.get("X-Test-User"),
};

export function req(method: string, path: string, user?: string, headers: Record<string, string> = {}) {
  const h: Record<string, string> = { ...headers };
  if (user) h["X-Test-User"] = user;
  return new Request(`https://probetraining.example.org${path}`, { method, headers: h });
}
