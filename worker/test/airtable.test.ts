import { describe, expect, it } from "vitest";
import { AIRTABLE, AirtableDataSource } from "../src/airtable";
import { DataSourceError } from "../src/datasource";

const K = AIRTABLE.kids;

function source(handler: (url: URL, init: RequestInit) => Response) {
  const seen: { url: URL; init: RequestInit }[] = [];
  const ds = new AirtableDataSource({
    token: "pat_test",
    baseId: "appBKLVL4A4mI2QHr",
    fetchFn: async (input, init = {}) => {
      const url = new URL(String(input));
      seen.push({ url, init });
      return handler(url, init);
    },
  });
  return { ds, seen };
}

describe("Airtable-Datenquelle", () => {
  it("liest Kinder seitenweise über Feld-IDs und bildet Status ab", async () => {
    const { ds, seen } = source((url) => {
      const page2 = url.searchParams.get("offset") === "p2";
      return Response.json({
        records: page2
          ? [{ id: "recKid00000000002", fields: { [K.name]: "Zweites Kind", [K.status]: "Kein Interesse / abgesagt" } }]
          : [{
              id: "recKid00000000001",
              fields: {
                [K.name]: "Erstes Kind", [K.birthDate]: "2018-03-01", [K.team]: ["recTeam0000000001"],
                [K.status]: "Antrag ausgehändigt/verschickt", [K.count]: 2, [K.lastTraining]: "2026-10-27",
              },
            }],
        ...(page2 ? {} : { offset: "p2" }),
      });
    });
    const kids = await ds.listKids();
    expect(kids).toHaveLength(2);
    expect(kids[0]).toMatchObject({ teamIds: ["recTeam0000000001"], status: "antrag_verschickt", count: 2, phone: null });
    expect(kids[1]!.status).toBe("abgesagt");
    expect(kids[1]!.count).toBe(0);

    const first = seen[0]!;
    expect(first.url.pathname).toBe(`/v0/appBKLVL4A4mI2QHr/${K.table}`);
    expect(first.url.searchParams.get("returnFieldsByFieldId")).toBe("true");
    expect(first.url.searchParams.getAll("fields[]")).toContain(K.playableSince);
    // E-Mail der Eltern wird gar nicht erst geladen
    expect(first.url.searchParams.getAll("fields[]")).not.toContain("fldcLIrtbOMJTLAQ3");
    expect((first.init.headers as Record<string, string>).Authorization).toBe("Bearer pat_test");
  });

  it("unbekannte Status-Option wird nicht als Probetraining gedeutet", async () => {
    const { ds } = source(() => Response.json({ records: [{ id: "recKid00000000001", fields: { [K.status]: "Umbenannt" } }] }));
    expect((await ds.listKids())[0]!.status).toBe("unbekannt");
  });

  it("Trainer-E-Mails werden normalisiert", async () => {
    const T = AIRTABLE.teams;
    const { ds } = source(() =>
      Response.json({ records: [{ id: "recTeam0000000001", fields: { [T.name]: "F1", [T.trainerEmail]: " Jan@Example.ORG " } }] }),
    );
    expect((await ds.listTeams())[0]!.trainerEmail).toBe("jan@example.org");
  });

  it("schreibt Zähler und Daten per PATCH mit Feld-IDs", async () => {
    const { ds, seen } = source(() => Response.json({ id: "recKid00000000001", fields: { [K.count]: 3 } }));
    await ds.updateAttendance("recKid00000000001", { count: 3, lastTraining: "2026-11-03", firstTraining: "2026-10-20" });
    const call = seen[0]!;
    expect(call.init.method).toBe("PATCH");
    expect(call.url.pathname).toBe(`/v0/appBKLVL4A4mI2QHr/${K.table}/recKid00000000001`);
    expect(JSON.parse(String(call.init.body)).fields).toEqual({
      [K.count]: 3, [K.lastTraining]: "2026-11-03", [K.firstTraining]: "2026-10-20",
    });
  });

  it("ungültige ID geht nicht an Airtable", async () => {
    const { ds, seen } = source(() => Response.json({}));
    expect(await ds.getKid("../tbl6pyFB5M2UoFmCF")).toBeNull();
    await expect(ds.updateAttendance("recKurz", { count: 1, lastTraining: null, firstTraining: null })).rejects.toThrow();
    expect(seen).toHaveLength(0);
  });

  it("404 → null, andere Fehler → DataSourceError ohne Antworttext", async () => {
    expect(await source(() => new Response("{}", { status: 404 })).ds.getKid("recKid00000000001")).toBeNull();
    const err = await source(() => new Response('{"error":"Name: Erstes Kind"}', { status: 422 }))
      .ds.getKid("recKid00000000001").catch((e) => e);
    expect(err).toBeInstanceOf(DataSourceError);
    expect(err.status).toBe(422);
    expect(err.message).not.toContain("Erstes Kind");
  });
});
