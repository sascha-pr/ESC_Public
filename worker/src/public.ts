/**
 * Öffentliches Elternformular (ohne Login): Mannschaftsliste und Anmeldung eines neuen Kindes.
 *
 * Läuft unter einer eigenen Adresse (anmeldung.<APP-DOMAIN>) ohne Cloudflare Access.
 * Schutz: Turnstile (Bot-Check), strenge Eingabeprüfung, Größenlimit, Origin-Prüfung, Dublettenerkennung.
 * Die Antwort enthält nie Daten anderer Kinder.
 */
import { DataSourceError, type DataSource } from "./datasource";
import { todayIso } from "./domain";
import type { HumanCheck } from "./turnstile";

export interface PublicDeps {
  data: DataSource;
  human: HumanCheck;
  now?: () => Date;
}

const MESSAGES = {
  invalid: "Bitte die markierten Felder prüfen.",
  team: "Die Mannschaft ist unbekannt. Bitte den QR-Code eurer Mannschaft beim Training erneut scannen.",
  consent: "Ohne Einwilligung können wir die Anmeldung leider nicht annehmen.",
  human: "Die Sicherheitsprüfung hat nicht geklappt. Bitte die Seite neu laden und nochmal absenden.",
  bad_origin: "Anfrage von fremder Seite abgelehnt.",
  too_large: "Die Anfrage ist zu groß.",
  upstream: "Die Anmeldung konnte gerade nicht gespeichert werden. Bitte in ein paar Minuten nochmal versuchen.",
  no_route: "Unbekannte Adresse.",
} as const;
type Code = keyof typeof MESSAGES;

export interface Registration {
  team: string;
  childName: string;
  birthDate: string;
  parentName: string;
  email: string;
  phone: string;
  consent: boolean;
  /** Keine E-Mail – Mitgliedsantrag auf Papier */
  paper: boolean;
  turnstileToken: string;
}

/** Feldname → deutscher Hinweis; leer = alles gültig. */
export function validate(input: Partial<Registration>, today: string): Record<string, string> {
  const e: Record<string, string> = {};
  const name = clean(input.childName);
  if (name.length < 3 || name.length > 80 || name.split(" ").length < 2) e.childName = "Bitte Vor- und Nachnamen des Kindes eintragen.";
  const bd = clean(input.birthDate);
  const year = Number(bd.slice(0, 4));
  const thisYear = Number(today.slice(0, 4));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bd) || !isRealDate(bd) || bd > today || year < thisYear - 20 || year > thisYear - 2) {
    e.birthDate = "Bitte ein gültiges Geburtsdatum eintragen.";
  }
  const parent = clean(input.parentName);
  if (parent.length < 2 || parent.length > 80) e.parentName = "Bitte den Namen eines Elternteils eintragen.";
  const mail = clean(input.email);
  const validMail = mail.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail);
  if (input.paper === true) {
    if (mail && !validMail) e.email = "Bitte die E-Mail-Adresse prüfen oder das Feld leer lassen.";
  } else if (!validMail) {
    e.email = "Bitte eine gültige E-Mail-Adresse eintragen – oder unten „keine E-Mail“ ankreuzen.";
  }
  const phone = clean(input.phone);
  if (phone && (phone.length > 30 || !/^[0-9+()\/\- ]{5,}$/.test(phone))) e.phone = "Bitte eine gültige Telefonnummer eintragen oder das Feld leer lassen.";
  if (input.consent !== true) e.consent = MESSAGES.consent;
  return e;
}

function isRealDate(iso: string): boolean {
  const d = new Date(iso + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Steuerzeichen raus, Leerraum zusammenfassen. */
function clean(v: unknown): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
}

function norm(s: string): string {
  return s.toLocaleLowerCase("de").replace(/\s+/g, " ").trim();
}

export function createPublicApi(deps: PublicDeps): (req: Request) => Promise<Response> {
  const now = deps.now ?? (() => new Date());

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    try {
      // Nur den Namen der Mannschaft zur ID aus dem QR-Code – keine Liste aller Mannschaften
      if (req.method === "GET" && url.pathname === "/api/anmeldung/team") {
        const id = url.searchParams.get("id") ?? "";
        const team = (await deps.data.listTeams()).find((t) => t.id === id);
        if (!team) return error(404, "team");
        return json(200, { id: team.id, name: team.name }, "public, max-age=300");
      }

      if (req.method === "POST" && url.pathname === "/api/anmeldung") {
        const origin = req.headers.get("Origin");
        if (origin !== null && origin !== url.origin) return error(403, "bad_origin");
        const raw = await req.text();
        if (raw.length > 4096) return error(413, "too_large");
        let input: Partial<Registration>;
        try {
          input = JSON.parse(raw);
        } catch {
          return error(400, "invalid");
        }
        if (typeof input !== "object" || input === null) return error(400, "invalid");

        const today = todayIso(now());
        const fields = validate(input, today);
        if (Object.keys(fields).length) return error(422, fields.consent && Object.keys(fields).length === 1 ? "consent" : "invalid", { fields });

        // Bot-Check erst nach der (kostenlosen) Eingabeprüfung
        if (!(await deps.human.verify(clean(input.turnstileToken), req.headers.get("CF-Connecting-IP")))) return error(403, "human");

        const team = (await deps.data.listTeams()).find((t) => t.id === input.team);
        if (!team) return error(422, "team", { fields: { team: MESSAGES.team } });

        const childName = clean(input.childName);
        const birthDate = clean(input.birthDate);
        // Doppelte Anmeldung (z. B. zweimal abgeschickt): nichts Neues anlegen, aber freundlich bestätigen
        const existing = (await deps.data.listKids()).find(
          (k) => k.teamIds.includes(team.id) && k.status !== "abgesagt" && norm(k.name) === norm(childName) && k.birthDate === birthDate,
        );
        if (!existing) {
          await deps.data.createKid({
            name: childName,
            birthDate,
            teamId: team.id,
            parentName: clean(input.parentName),
            email: clean(input.email).toLowerCase() || null,
            phone: clean(input.phone) || null,
            paper: input.paper === true && !clean(input.email),
            today,
          });
        }
        return json(200, {
          ok: true, firstName: (existing ? existing.name : childName).split(" ")[0], team: team.name, duplicate: !!existing,
          paper: existing ? existing.paper : input.paper === true && !clean(input.email),
        });
      }

      return error(404, "no_route");
    } catch (e) {
      if (e instanceof DataSourceError) {
        console.error(`Anmeldung, Datenquelle: ${e.message}`);
        return error(e.status === 429 ? 503 : 502, "upstream");
      }
      console.error("Anmeldung, unerwarteter Fehler", e instanceof Error ? e.name : typeof e);
      return error(500, "upstream");
    }
  };
}

function json(status: number, body: unknown, cache = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache, "X-Content-Type-Options": "nosniff" },
  });
}

function error(status: number, code: Code, extra: Record<string, unknown> = {}): Response {
  return json(status, { error: code, message: MESSAGES[code], ...extra });
}
