import type { Authenticator } from "./auth";
import { DataSourceError, type DataSource } from "./datasource";
import {
  MAX_TRIALS,
  belongsToTeams,
  checkAttend,
  isValidEmail,
  isVisible,
  todayIso,
  toKidDto,
  type Team,
} from "./domain";
import type { UndoStore } from "./undo";

export interface ApiDeps {
  data: DataSource;
  undo: UndoStore;
  auth: Authenticator;
  now?: () => Date;
}

type Handler = (req: Request, ctx: Ctx, params: string[]) => Promise<Response>;
interface Ctx {
  email: string;
  teams: Team[];
  today: string;
}

const MESSAGES = {
  unauthenticated: "Nicht angemeldet. Bitte die App neu öffnen und mit der Vereins-E-Mail anmelden.",
  unknown_trainer:
    "Diese E-Mail-Adresse ist keiner Mannschaft zugeordnet. Bitte bei der Jugendleitung melden.",
  forbidden_team: "Diese Mannschaft gehört nicht zu deinem Zugang.",
  not_found: "Kind nicht gefunden.",
  not_in_trial: "Das Kind ist nicht mehr im Probetraining – es ist bereits angemeldet.",
  already_today: "Das Kind ist für heute schon eingetragen.",
  limit_reached: `Alle ${MAX_TRIALS} Probetrainings sind genutzt. Weiter nur mit Mitgliedsantrag.`,
  nothing_to_undo: "Es gibt heute nichts rückgängig zu machen.",
  changed: "Der Eintrag wurde inzwischen geändert und kann nicht mehr rückgängig gemacht werden.",
  bad_origin: "Anfrage von fremder Seite abgelehnt.",
  no_email_problem: "Für dieses Kind ist keine unzustellbare E-Mail gemeldet.",
  invalid_email: "Bitte eine gültige E-Mail-Adresse eintragen.",
  same_email: "Das ist dieselbe Adresse, die nicht zugestellt werden konnte. Bitte bei den Eltern nachfragen.",
  bad_request: "Die Anfrage ist ungültig.",
  upstream: "Die Vereinsdatenbank ist gerade nicht erreichbar. Bitte gleich nochmal versuchen.",
  no_route: "Unbekannte Adresse.",
} as const;
type ErrorCode = keyof typeof MESSAGES;

export function createApi(deps: ApiDeps): (req: Request) => Promise<Response> {
  const now = deps.now ?? (() => new Date());

  const routes: { method: string; pattern: RegExp; handler: Handler }[] = [];
  const route = (method: string, pattern: RegExp, handler: Handler) => routes.push({ method, pattern, handler });

  route("GET", /^\/api\/me$/, async (_req, ctx) =>
    json(200, {
      email: ctx.email,
      max: MAX_TRIALS,
      today: ctx.today,
      teams: ctx.teams.map((t) => ({ id: t.id, name: t.name, ageClass: t.ageClass, trainer: t.trainerName })),
    }),
  );

  route("GET", /^\/api\/kids$/, async (req, ctx) => {
    const wanted = new URL(req.url).searchParams.get("team");
    const team = wanted ? ctx.teams.find((t) => t.id === wanted) : ctx.teams[0];
    if (!team) return error(403, "forbidden_team");
    const kids = (await deps.data.listKids())
      .filter((k) => belongsToTeams(k, [team.id]) && isVisible(k, ctx.today))
      .map((k) => toKidDto(k, ctx.today))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
    return json(200, { team: team.id, today: ctx.today, kids });
  });

  route("POST", /^\/api\/kids\/([^/]+)\/attend$/, async (_req, ctx, [id]) => {
    const kid = await ownKid(id!, ctx);
    if (!kid) return error(404, "not_found");
    const refusal = checkAttend(kid, ctx.today);
    if (refusal) return error(409, refusal, { kid: toKidDto(kid, ctx.today) });

    const updated = await deps.data.updateAttendance(kid.id, {
      count: kid.count + 1,
      lastTraining: ctx.today,
      firstTraining: kid.firstTraining ?? ctx.today,
      trainingDates: [...kid.trainingDates.filter((d) => d !== ctx.today), ctx.today],
    });
    await deps.undo.put(kid.id, {
      day: ctx.today,
      prevCount: kid.count,
      prevLast: kid.lastTraining,
      prevFirst: kid.firstTraining,
      prevDates: kid.trainingDates,
    });
    return json(200, { kid: toKidDto(updated, ctx.today) });
  });

  route("POST", /^\/api\/kids\/([^/]+)\/undo$/, async (_req, ctx, [id]) => {
    const kid = await ownKid(id!, ctx);
    if (!kid) return error(404, "not_found");
    const entry = await deps.undo.get(kid.id);
    if (!entry || entry.day !== ctx.today) return error(409, "nothing_to_undo", { kid: toKidDto(kid, ctx.today) });
    // Nur zurücknehmen, wenn seitdem niemand etwas geändert hat (z. B. die Verwaltung).
    if (kid.count !== entry.prevCount + 1 || kid.lastTraining !== ctx.today) {
      await deps.undo.delete(kid.id);
      return error(409, "changed", { kid: toKidDto(kid, ctx.today) });
    }
    const updated = await deps.data.updateAttendance(kid.id, {
      count: entry.prevCount,
      lastTraining: entry.prevLast,
      firstTraining: entry.prevFirst,
      trainingDates: entry.prevDates ?? kid.trainingDates.filter((d) => d !== ctx.today),
    });
    await deps.undo.delete(kid.id);
    return json(200, { kid: toKidDto(updated, ctx.today) });
  });

  // E-Mail nach Unzustellbarkeit korrigieren – oder auf Papierantrag umstellen
  route("POST", /^\/api\/kids\/([^/]+)\/email$/, async (req, ctx, [id]) => {
    const raw = await req.text();
    if (raw.length > 1024) return error(400, "bad_request");
    let body: { email?: unknown; paper?: unknown };
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return error(400, "bad_request");
    }
    const kid = await ownKid(id!, ctx);
    if (!kid) return error(404, "not_found");
    if (!kid.emailBounced) return error(409, "no_email_problem", { kid: toKidDto(kid, ctx.today) });
    const paper = body.paper === true;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!paper) {
      if (!isValidEmail(email)) return error(422, "invalid_email");
      if (email === (kid.email ?? "").toLowerCase()) return error(422, "same_email");
    }
    const updated = await deps.data.updateContact(kid.id, {
      email: paper ? null : email,
      paper,
      // war der Antrag schon „verschickt“: zurück auf Probetraining, dann verschickt Automation 1 ihn neu
      resetStatus: kid.status === "antrag_verschickt",
    });
    return json(200, { kid: toKidDto(updated, ctx.today) });
  });

  /** Kind frisch laden und nur liefern, wenn es zu einer Mannschaft des Trainers gehört. */
  async function ownKid(id: string, ctx: Ctx) {
    const kid = await deps.data.getKid(id);
    // Fremde Kinder melden wir wie nicht vorhandene, damit nichts über andere Mannschaften verraten wird.
    if (!kid || !belongsToTeams(kid, ctx.teams.map((t) => t.id))) return null;
    return kid;
  }

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const match = routes
      .map((r) => ({ r, m: r.method === req.method ? r.pattern.exec(url.pathname) : null }))
      .find((x) => x.m);
    if (!match) return error(404, "no_route");

    if (req.method !== "GET") {
      // Schutz gegen Cross-Site-Requests: Schreibzugriffe nur von der eigenen Seite.
      const origin = req.headers.get("Origin");
      if (origin !== null && origin !== url.origin) return error(403, "bad_origin");
    }

    try {
      const email = await deps.auth.authenticate(req);
      if (!email) return error(401, "unauthenticated");
      const teams = (await deps.data.listTeams()).filter((t) => t.trainerEmail === email);
      if (teams.length === 0) return error(403, "unknown_trainer");
      const ctx: Ctx = { email, teams, today: todayIso(now()) };
      return await match.r.handler(req, ctx, match.m!.slice(1));
    } catch (e) {
      if (e instanceof DataSourceError) {
        console.error(`Datenquelle: ${e.message}`);
        return error(e.status === 429 ? 503 : 502, "upstream");
      }
      console.error("Unerwarteter Fehler", e instanceof Error ? e.name : typeof e);
      return error(500, "upstream");
    }
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function error(status: number, code: ErrorCode, extra: Record<string, unknown> = {}): Response {
  return json(status, { error: code, message: MESSAGES[code], ...extra });
}
