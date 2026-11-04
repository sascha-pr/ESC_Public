import { beforeEach, describe, expect, it } from "vitest";
import { createPublicApi, validate } from "../src/public";
import worker from "../src/index";
import { FakeDataSource, TEAMS, kid } from "./fakes";

const NOW = new Date("2026-11-03T17:00:00Z");
const TODAY = "2026-11-03";

let data: FakeDataSource;
let humanOk: boolean;
let api: (r: Request) => Promise<Response>;

const good = () => ({
  team: "recTeamF1aaaaaaaa",
  childName: "  Leo   Neumann ",
  birthDate: "2018-08-14",
  parentName: "Kerstin Neumann",
  email: "K.Neumann@Example.org",
  phone: "0151 4455667",
  consent: true,
  turnstileToken: "tok",
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://anmeldung.example.org/api/anmeldung", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const json = async (r: Response) => (await r.json()) as any;

beforeEach(() => {
  data = new FakeDataSource(TEAMS, [kid({ id: "recKidF1probe0001", name: "Anton Beispiel" })]);
  humanOk = true;
  api = createPublicApi({ data, human: { verify: async () => humanOk }, now: () => NOW });
});

describe("Elternformular: Anmeldung", () => {
  it("legt das Kind mit Probetraining 1 und heutigem Datum an", async () => {
    const res = await api(post(good()));
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true, firstName: "Leo", team: "F1-Jugend", duplicate: false });
    expect(data.created).toEqual([{
      name: "Leo Neumann", birthDate: "2018-08-14", teamId: "recTeamF1aaaaaaaa",
      parentName: "Kerstin Neumann", email: "k.neumann@example.org", phone: "0151 4455667", today: TODAY,
    }]);
  });

  it("Telefon ist freiwillig", async () => {
    const res = await api(post({ ...good(), phone: "" }));
    expect(res.status).toBe(200);
    expect(data.created[0]!.phone).toBeNull();
  });

  it("ohne Einwilligung: 422, nichts angelegt", async () => {
    const res = await api(post({ ...good(), consent: false }));
    expect(res.status).toBe(422);
    expect((await json(res)).error).toBe("consent");
    expect(data.calls.create).toBe(0);
  });

  it("ungültige Felder werden einzeln gemeldet", async () => {
    const res = await api(post({ ...good(), childName: "Leo", birthDate: "2031-01-01", email: "keine-mail", phone: "abc" }));
    expect(res.status).toBe(422);
    expect(Object.keys((await json(res)).fields).sort()).toEqual(["birthDate", "childName", "email", "phone"]);
    expect(data.calls.create).toBe(0);
  });

  it("unbekannte Mannschaft: 422", async () => {
    const res = await api(post({ ...good(), team: "recTeamXXaaaaaaaa" }));
    expect(res.status).toBe(422);
    expect((await json(res)).error).toBe("team");
    expect(data.calls.create).toBe(0);
  });

  it("Bot-Check fehlgeschlagen: 403, nichts angelegt", async () => {
    humanOk = false;
    const res = await api(post(good()));
    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe("human");
    expect(data.calls.create).toBe(0);
  });

  it("zweimal abgeschickt: kein zweiter Datensatz", async () => {
    await api(post(good()));
    const res = await api(post({ ...good(), childName: "leo neumann" }));
    const b = await json(res);
    expect(b.duplicate).toBe(true);
    expect(b.firstName).toBe("Leo");
    expect(data.calls.create).toBe(1);
  });

  it("von fremder Seite: 403", async () => {
    expect((await api(post(good(), { Origin: "https://evil.example" }))).status).toBe(403);
    expect(data.calls.create).toBe(0);
  });

  it("zu große oder kaputte Anfrage", async () => {
    expect((await api(post({ ...good(), parentName: "x".repeat(5000) }))).status).toBe(413);
    expect((await api(post("{kein json"))).status).toBe(400);
  });

  it("Antwort enthält keine Daten anderer Kinder", async () => {
    const text = await (await api(post(good()))).text();
    expect(text).not.toContain("Anton");
  });
});

describe("Elternformular: Mannschaftsliste", () => {
  it("liefert nur ID und Name, keine Trainer-Daten", async () => {
    const b = await json(await api(new Request("https://anmeldung.example.org/api/anmeldung/teams")));
    expect(b.teams[0]).toEqual({ id: "recTeamD1aaaaaaaa", name: "D1-Jugend" });
    expect(JSON.stringify(b)).not.toContain("@");
  });
});

describe("Eingabeprüfung", () => {
  it("Geburtsdatum: nicht in der Zukunft, plausibles Alter", () => {
    expect(validate({ ...good(), birthDate: "2026-11-04" }, TODAY).birthDate).toBeDefined();
    expect(validate({ ...good(), birthDate: "2001-01-01" }, TODAY).birthDate).toBeDefined();
    expect(validate({ ...good(), birthDate: "2018-02-30" }, TODAY).birthDate).toBeDefined();
    expect(validate(good(), TODAY)).toEqual({});
  });
});

describe("Adress-Weiche im Worker", () => {
  const assets = { fetch: async (r: Request) => new Response("asset:" + new URL(r.url).pathname) } as unknown as Fetcher;
  const env = {
    AIRTABLE_TOKEN: "x", AIRTABLE_BASE_ID: "appBKLVL4A4mI2QHr", ACCESS_TEAM_DOMAIN: "t.cloudflareaccess.com", ACCESS_AUD: "aud",
    PUBLIC_HOST: "anmeldung.example.org", UNDO: {} as KVNamespace, ASSETS: assets,
  };
  const call = (u: string) => worker.fetch(new Request(u), env as any);

  it("öffentliche Adresse: Startseite leitet zum Formular", async () => {
    const res = await call("https://anmeldung.example.org/?m=recTeamF1aaaaaaaa");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://anmeldung.example.org/anmeldung/?m=recTeamF1aaaaaaaa");
  });

  it("öffentliche Adresse: nur Formular-Dateien, keine Trainer-App", async () => {
    expect(await (await call("https://anmeldung.example.org/anmeldung/")).text()).toBe("asset:/anmeldung/");
    expect((await call("https://anmeldung.example.org/index.html")).status).toBe(404);
    expect((await call("https://anmeldung.example.org/config.js")).status).toBe(404);
  });

  it("öffentliche Adresse: Trainer-API nicht erreichbar", async () => {
    const res = await call("https://anmeldung.example.org/api/kids");
    expect(res.status).toBe(404);
  });

  it("Seiten bekommen Sicherheits-Header", async () => {
    const res = await call("https://anmeldung.example.org/anmeldung/");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("Trainer-Adresse: API ohne Login abgewiesen", async () => {
    expect((await call("https://probetraining.example.org/api/kids")).status).toBe(401);
  });
});
