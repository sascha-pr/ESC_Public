import { describe, expect, it } from "vitest";
import { CachedDataSource } from "../src/cache";
import { FakeDataSource, TEAMS, kid } from "./fakes";

describe("Cache", () => {
  it("spart Aufrufe innerhalb der Gültigkeit und lädt danach neu", async () => {
    let t = 0;
    const inner = new FakeDataSource(TEAMS, [kid({ id: "recKid00000000001" })]);
    const ds = new CachedDataSource(inner, { teamsTtlMs: 300_000, kidsTtlMs: 60_000, now: () => t });
    await ds.listKids();
    t = 59_000;
    await ds.listKids();
    expect(inner.calls.listKids).toBe(1);
    t = 61_000;
    await ds.listKids();
    expect(inner.calls.listKids).toBe(2);
  });

  it("Schreibzugriffe lesen frisch und aktualisieren den Cache", async () => {
    const inner = new FakeDataSource(TEAMS, [kid({ id: "recKid00000000001", count: 1 })]);
    const ds = new CachedDataSource(inner, { teamsTtlMs: 300_000, kidsTtlMs: 60_000, now: () => 0 });
    await ds.listKids();
    await ds.getKid("recKid00000000001");
    expect(inner.calls.getKid).toBe(1);
    await ds.updateAttendance("recKid00000000001", { count: 2, lastTraining: "2026-11-03", firstTraining: "2026-10-20", trainingDates: ["2026-10-20", "2026-11-03"] });
    expect((await ds.listKids())[0]!.count).toBe(2);
    expect(inner.calls.listKids).toBe(1);
  });
});
