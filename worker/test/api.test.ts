import { beforeEach, describe, expect, it } from "vitest";
import { createApi } from "../src/api";
import { MAX_TRIALS, type KidDto } from "../src/domain";
import { MemoryUndoStore } from "../src/undo";
import { FakeDataSource, TEAMS, headerAuth, kid, req } from "./fakes";

const F1 = "trainer.f1@example.org";
const E1 = "trainer.e1@example.org";
const D1 = "trainer.d1@example.org";
// 03.11.2026, 18:00 in Essen
const NOW = new Date("2026-11-03T17:00:00Z");
const TODAY = "2026-11-03";

let data: FakeDataSource;
let undo: MemoryUndoStore;
let api: (r: Request) => Promise<Response>;

beforeEach(() => {
  data = new FakeDataSource(TEAMS, [
    kid({ id: "recKidF1probe0001", name: "Anton", count: 1 }),
    kid({ id: "recKidF1limit0001", name: "Berta", count: MAX_TRIALS }),
    kid({ id: "recKidF1fuenf0001", name: "Carl", count: MAX_TRIALS - 1 }),
    kid({ id: "recKidF1antrg0001", name: "Dora", status: "antrag_eingegangen", count: 2 }),
    kid({ id: "recKidF1absag0001", name: "Emil", status: "abgesagt" }),
    kid({ id: "recKidF1spiel0001", name: "Frida", status: "spielberechtigt", playableSince: "2026-10-25" }),
    kid({ id: "recKidF1spalt0001", name: "Gustav", status: "spielberechtigt", playableSince: "2026-10-01" }),
    kid({ id: "recKidE1probe0001", name: "Hanna", teamIds: ["recTeamE1aaaaaaaa"] }),
    kid({ id: "recKidD2probe0001", name: "Ida", teamIds: ["recTeamD2aaaaaaaa"] }),
  ]);
  undo = new MemoryUndoStore();
  api = createApi({ data, undo, auth: headerAuth, now: () => NOW });
});

async function body(res: Response) {
  return (await res.json()) as any;
}

describe("Anmeldung", () => {
  it("ohne bestätigte E-Mail: 401", async () => {
    const res = await api(req("GET", "/api/me"));
    expect(res.status).toBe(401);
    expect((await body(res)).error).toBe("unauthenticated");
  });

  it("E-Mail ohne Mannschaft: 403", async () => {
    const res = await api(req("GET", "/api/me", "fremd@example.org"));
    expect(res.status).toBe(403);
    expect((await body(res)).error).toBe("unknown_trainer");
  });

  it("/api/me liefert nur die eigenen Mannschaften", async () => {
    const b = await body(await api(req("GET", "/api/me", D1)));
    expect(b.teams.map((t: any) => t.id)).toEqual(["recTeamD1aaaaaaaa", "recTeamD2aaaaaaaa"]);
    expect(b.max).toBe(3);
    expect(b.today).toBe(TODAY);
  });

  it("Antworten werden nicht zwischengespeichert", async () => {
    const res = await api(req("GET", "/api/me", F1));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("Mannschafts-Filter", () => {
  it("liefert nur Kinder der eigenen Mannschaft", async () => {
    const b = await body(await api(req("GET", "/api/kids", E1)));
    expect(b.kids.map((k: KidDto) => k.name)).toEqual(["Hanna"]);
  });

  it("fremde Mannschaft per Parameter: 403", async () => {
    const res = await api(req("GET", "/api/kids?team=recTeamE1aaaaaaaa", F1));
    expect(res.status).toBe(403);
  });

  it("zweite eigene Mannschaft per Parameter", async () => {
    const b = await body(await api(req("GET", "/api/kids?team=recTeamD2aaaaaaaa", D1)));
    expect(b.kids.map((k: KidDto) => k.name)).toEqual(["Ida"]);
  });

  it("blendet Abgesagte und seit über 14 Tagen Spielberechtigte aus", async () => {
    const names = (await body(await api(req("GET", "/api/kids", F1)))).kids.map((k: KidDto) => k.name);
    expect(names).toEqual(["Anton", "Berta", "Carl", "Dora", "Frida"]);
  });

  it("„War heute da“ für ein Kind einer fremden Mannschaft: 404, nichts geschrieben", async () => {
    const res = await api(req("POST", "/api/kids/recKidE1probe0001/attend", F1));
    expect(res.status).toBe(404);
    expect(data.calls.update).toBe(0);
  });

  it("„Rückgängig“ für ein Kind einer fremden Mannschaft: 404", async () => {
    await api(req("POST", "/api/kids/recKidE1probe0001/attend", E1));
    const res = await api(req("POST", "/api/kids/recKidE1probe0001/undo", F1));
    expect(res.status).toBe(404);
    expect(data.kids.find((k) => k.id === "recKidE1probe0001")!.count).toBe(2);
  });
});

describe("Datensparsamkeit", () => {
  it("Jahrgang und Geburtsdatum, Elternkontakt nur bei Limit", async () => {
    const kids: KidDto[] = (await body(await api(req("GET", "/api/kids", F1)))).kids;
    const anton = kids.find((k) => k.name === "Anton")!;
    const berta = kids.find((k) => k.name === "Berta")!;
    expect(anton).toEqual({
      id: "recKidF1probe0001", name: "Anton", jg: 2018, birthDate: "2018-05-04", count: 1, last: "2026-10-27", status: "probe", attendedToday: false,
    });
    expect(berta.contact).toEqual({ parent: "Elternteil Beispiel", phone: "0170 0000000" });
    // Eltern-E-Mail und Telefon (ohne Limit) gehen nicht an die App
    expect(anton).not.toHaveProperty("contact");
  });
});

describe("Limit", () => {
  it("zählt hoch und setzt das letzte Training auf heute", async () => {
    const res = await api(req("POST", "/api/kids/recKidF1probe0001/attend", F1));
    expect(res.status).toBe(200);
    const k = (await body(res)).kid as KidDto;
    expect(k.count).toBe(2);
    expect(k.last).toBe(TODAY);
    expect(k.attendedToday).toBe(true);
  });

  it("das 3. Training ist erlaubt, danach ist Schluss", async () => {
    const res = await api(req("POST", "/api/kids/recKidF1fuenf0001/attend", F1));
    expect(res.status).toBe(200);
    const k = (await body(res)).kid as KidDto;
    expect(k.count).toBe(MAX_TRIALS);
    expect(k.contact?.phone).toBe("0170 0000000");
  });

  it("bei erreichtem Limit: 409, nichts geschrieben", async () => {
    const res = await api(req("POST", "/api/kids/recKidF1limit0001/attend", F1));
    expect(res.status).toBe(409);
    expect((await body(res)).error).toBe("limit_reached");
    expect(data.calls.update).toBe(0);
  });

  it("Limit gilt auch bei veraltetem Cache – geprüft wird gegen frische Daten", async () => {
    // Liste laden (Carl hat 5), dann setzt jemand anderes Carl auf 6
    await api(req("GET", "/api/kids", F1));
    data.kids.find((k) => k.id === "recKidF1fuenf0001")!.count = MAX_TRIALS;
    const res = await api(req("POST", "/api/kids/recKidF1fuenf0001/attend", F1));
    expect(res.status).toBe(409);
  });

  it("nur einmal pro Tag", async () => {
    await api(req("POST", "/api/kids/recKidF1probe0001/attend", F1));
    const res = await api(req("POST", "/api/kids/recKidF1probe0001/attend", F1));
    expect(res.status).toBe(409);
    expect((await body(res)).error).toBe("already_today");
    expect(data.kids.find((k) => k.id === "recKidF1probe0001")!.count).toBe(2);
  });

  it("angemeldete Kinder werden nicht mehr gezählt", async () => {
    const res = await api(req("POST", "/api/kids/recKidF1antrg0001/attend", F1));
    expect(res.status).toBe(409);
    expect((await body(res)).error).toBe("not_in_trial");
  });

  it("setzt beim ersten Training auch „Erstes Probetraining“", async () => {
    data.kids.push(kid({ id: "recKidF1neuuu0001", count: 0, firstTraining: null, lastTraining: null }));
    await api(req("POST", "/api/kids/recKidF1neuuu0001/attend", F1));
    expect(data.kids.find((k) => k.id === "recKidF1neuuu0001")!.firstTraining).toBe(TODAY);
  });
});

describe("Teilnahme-Protokoll", () => {
  it("„War heute da“ hängt das Datum an, „Rückgängig“ stellt das alte Protokoll wieder her", async () => {
    data.kids.find((k) => k.id === "recKidF1probe0001")!.trainingDates = ["2026-10-27"];
    await api(req("POST", "/api/kids/recKidF1probe0001/attend", F1));
    expect(data.kids.find((k) => k.id === "recKidF1probe0001")!.trainingDates).toEqual(["2026-10-27", TODAY]);
    await api(req("POST", "/api/kids/recKidF1probe0001/undo", F1));
    expect(data.kids.find((k) => k.id === "recKidF1probe0001")!.trainingDates).toEqual(["2026-10-27"]);
  });

  it("das Protokoll geht nicht an die Trainer-App", async () => {
    data.kids.find((k) => k.id === "recKidF1probe0001")!.trainingDates = ["2026-10-27"];
    const text = await (await api(req("GET", "/api/kids", F1))).text();
    expect(text).not.toContain("2026-10-20"); // erstes Training
    expect(text).not.toContain("trainingDates");
  });
});

describe("Papierantrag", () => {
  it("Kinder ohne E-Mail der Eltern sind für den Trainer markiert", async () => {
    data.kids.find((k) => k.id === "recKidF1probe0001")!.paper = true;
    const kids: KidDto[] = (await body(await api(req("GET", "/api/kids", F1)))).kids;
    expect(kids.find((k) => k.name === "Anton")!.paperApplication).toBe(true);
    expect(kids.find((k) => k.name === "Carl")!.paperApplication).toBeUndefined();
  });

  it("nach der Anmeldung (Antrag liegt vor) nicht mehr markiert", async () => {
    data.kids.find((k) => k.id === "recKidF1antrg0001")!.paper = true;
    const kids: KidDto[] = (await body(await api(req("GET", "/api/kids", F1)))).kids;
    expect(kids.find((k) => k.name === "Dora")!.paperApplication).toBeUndefined();
  });
});

describe("E-Mail unzustellbar", () => {
  const fix = (id: string, body: unknown, user = F1) =>
    api(new Request(`https://probetraining.example.org/api/kids/${id}/email`, {
      method: "POST", headers: { "X-Test-User": user, "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
  const bounced = () => {
    const k = data.kids.find((x) => x.id === "recKidF1fuenf0001")!;
    Object.assign(k, { status: "antrag_verschickt", count: 2, email: "kerstin@gmx.dee", emailBounced: true });
    return k;
  };

  it("der Trainer sieht den Hinweis mit der falschen Adresse", async () => {
    bounced();
    const kids: KidDto[] = (await body(await api(req("GET", "/api/kids", F1)))).kids;
    expect(kids.find((k) => k.name === "Carl")!.emailProblem).toEqual({ email: "kerstin@gmx.dee" });
    expect(kids.find((k) => k.name === "Anton")!.emailProblem).toBeUndefined();
  });

  it("E-Mail korrigieren: neue Adresse, Häkchen weg, Status zurück auf Probetraining (Antrag geht neu raus)", async () => {
    const k = bounced();
    const res = await fix(k.id, { email: " Kerstin@GMX.de " });
    expect(res.status).toBe(200);
    expect(k).toMatchObject({ email: "kerstin@gmx.de", emailBounced: false, status: "probetraining", paper: false });
    expect((await body(res)).kid.emailProblem).toBeUndefined();
  });

  it("auf Papierantrag umstellen", async () => {
    const k = bounced();
    const res = await fix(k.id, { paper: true });
    expect(res.status).toBe(200);
    expect(k).toMatchObject({ email: null, paper: true, emailBounced: false });
    expect((await body(res)).kid.paperApplication).toBe(true);
  });

  it("dieselbe falsche Adresse oder Unsinn: 422, nichts geändert", async () => {
    const k = bounced();
    expect((await fix(k.id, { email: "KERSTIN@gmx.dee" })).status).toBe(422);
    expect((await fix(k.id, { email: "kein-mail" })).status).toBe(422);
    expect(k.emailBounced).toBe(true);
    expect(data.calls.update).toBe(0);
  });

  it("nur wenn eine unzustellbare E-Mail gemeldet ist", async () => {
    const res = await fix("recKidF1probe0001", { email: "neu@example.org" });
    expect(res.status).toBe(409);
    expect(data.calls.update).toBe(0);
  });

  it("nicht für Kinder anderer Mannschaften", async () => {
    const k = bounced();
    expect((await fix(k.id, { email: "neu@example.org" }, E1)).status).toBe(404);
    expect(k.emailBounced).toBe(true);
  });

  it("nicht von fremder Seite", async () => {
    const k = bounced();
    const res = await api(new Request(`https://probetraining.example.org/api/kids/${k.id}/email`, {
      method: "POST", headers: { "X-Test-User": F1, Origin: "https://evil.example" }, body: JSON.stringify({ email: "neu@example.org" }),
    }));
    expect(res.status).toBe(403);
  });

  it("die E-Mail der Eltern geht sonst nie an die Trainer-App", async () => {
    const text = await (await api(req("GET", "/api/kids", F1))).text();
    expect(text).not.toContain("eltern@example.org");
  });
});

describe("Rückgängig", () => {
  it("stellt die vom Server gemerkten Werte wieder her", async () => {
    await api(req("POST", "/api/kids/recKidF1probe0001/attend", F1));
    const res = await api(req("POST", "/api/kids/recKidF1probe0001/undo", F1));
    expect(res.status).toBe(200);
    const k = data.kids.find((x) => x.id === "recKidF1probe0001")!;
    expect(k.count).toBe(1);
    expect(k.lastTraining).toBe("2026-10-27");
    expect(k.firstTraining).toBe("2026-10-20");
    expect(undo.entries.size).toBe(0);
  });

  it("ohne vorheriges „War heute da“: 409", async () => {
    const res = await api(req("POST", "/api/kids/recKidF1probe0001/undo", F1));
    expect(res.status).toBe(409);
    expect((await body(res)).error).toBe("nothing_to_undo");
  });

  it("nur einmal", async () => {
    await api(req("POST", "/api/kids/recKidF1probe0001/attend", F1));
    await api(req("POST", "/api/kids/recKidF1probe0001/undo", F1));
    const res = await api(req("POST", "/api/kids/recKidF1probe0001/undo", F1));
    expect(res.status).toBe(409);
    expect(data.kids.find((x) => x.id === "recKidF1probe0001")!.count).toBe(1);
  });

  it("nicht, wenn inzwischen jemand anderes den Zähler geändert hat", async () => {
    await api(req("POST", "/api/kids/recKidF1probe0001/attend", F1));
    data.kids.find((x) => x.id === "recKidF1probe0001")!.count = 5;
    const res = await api(req("POST", "/api/kids/recKidF1probe0001/undo", F1));
    expect(res.status).toBe(409);
    expect((await body(res)).error).toBe("changed");
    expect(data.kids.find((x) => x.id === "recKidF1probe0001")!.count).toBe(5);
  });

  it("nicht am nächsten Tag", async () => {
    await api(req("POST", "/api/kids/recKidF1probe0001/attend", F1));
    const tomorrow = createApi({ data, undo, auth: headerAuth, now: () => new Date("2026-11-04T17:00:00Z") });
    const res = await tomorrow(req("POST", "/api/kids/recKidF1probe0001/undo", F1));
    expect(res.status).toBe(409);
  });

  it("der Client kann keine Werte vorgeben", async () => {
    await api(req("POST", "/api/kids/recKidF1probe0001/attend", F1));
    const r = new Request("https://probetraining.example.org/api/kids/recKidF1probe0001/undo", {
      method: "POST",
      headers: { "X-Test-User": F1, "Content-Type": "application/json" },
      body: JSON.stringify({ count: 0, last: null }),
    });
    await api(r);
    expect(data.kids.find((x) => x.id === "recKidF1probe0001")!.count).toBe(1);
  });
});

describe("Sonstiges", () => {
  it("Schreibzugriff von fremder Seite: 403", async () => {
    const res = await api(req("POST", "/api/kids/recKidF1probe0001/attend", F1, { Origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(data.calls.update).toBe(0);
  });

  it("unbekannte Route: 404", async () => {
    expect((await api(req("GET", "/api/nix", F1))).status).toBe(404);
    expect((await api(req("GET", "/api/kids/recKidF1probe0001/attend", F1))).status).toBe(404);
  });

  it("„heute“ ist deutsche Zeit (23:30 UTC am 03.11. = 00:30 am 04.11.)", async () => {
    const late = createApi({ data, undo, auth: headerAuth, now: () => new Date("2026-11-03T23:30:00Z") });
    expect((await body(await late(req("GET", "/api/me", F1)))).today).toBe("2026-11-04");
  });

  it("Fehler der Datenquelle: 502 ohne Details", async () => {
    const { DataSourceError } = await import("../src/datasource");
    data.listKids = async () => {
      throw new DataSourceError("Airtable antwortet mit HTTP 500", 500);
    };
    const res = await api(req("GET", "/api/kids", F1));
    expect(res.status).toBe(502);
    expect((await body(res)).error).toBe("upstream");
  });
});
