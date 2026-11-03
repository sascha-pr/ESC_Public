import { describe, expect, it } from "vitest";
import { daysBetween, isVisible, toAppStatus } from "../src/domain";
import { kid } from "./fakes";

describe("Fachregeln", () => {
  it("Status-Mapping wie in docs/airtable-schema.md", () => {
    expect(toAppStatus("probetraining")).toBe("probe");
    expect(toAppStatus("antrag_verschickt")).toBe("probe");
    expect(toAppStatus(null)).toBe("probe");
    expect(toAppStatus("antrag_eingegangen")).toBe("antrag");
    expect(toAppStatus("dfbnet_erfasst")).toBe("mitglied");
    expect(toAppStatus("spielberechtigt")).toBe("spielberechtigt");
    expect(toAppStatus("abgesagt")).toBeNull();
    expect(toAppStatus("unbekannt")).toBeNull();
  });

  it("Spielberechtigte bleiben genau 14 Tage sichtbar", () => {
    const k = (since: string) => kid({ id: "recKid00000000001", status: "spielberechtigt", playableSince: since });
    expect(isVisible(k("2026-10-20"), "2026-11-03")).toBe(true); // 14 Tage
    expect(isVisible(k("2026-10-19"), "2026-11-03")).toBe(false); // 15 Tage
    expect(isVisible(kid({ id: "recKid00000000001", status: "spielberechtigt" }), "2026-11-03")).toBe(true);
  });

  it("Tagesdifferenz über die Zeitumstellung hinweg", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });
});
