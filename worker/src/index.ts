import { AirtableDataSource } from "./airtable";
import { createApi } from "./api";
import { AccessAuthenticator, DevAuthenticator, type Authenticator } from "./auth";
import { CachedDataSource } from "./cache";
import { createPublicApi } from "./public";
import { TurnstileCheck, type HumanCheck } from "./turnstile";
import { KvUndoStore } from "./undo";

export interface Env {
  /** Secret: Airtable Personal Access Token (nur data.records:read/write auf die eine Base). */
  AIRTABLE_TOKEN: string;
  AIRTABLE_BASE_ID: string;
  /** z. B. "esc06.cloudflareaccess.com" */
  ACCESS_TEAM_DOMAIN?: string;
  /** AUD-Tag der Access-Anwendung */
  ACCESS_AUD?: string;
  /** Öffentliche Adresse des Elternformulars ohne Login, z. B. "anmeldung.esc06-jugend.de" */
  PUBLIC_HOST?: string;
  /** Secret: Turnstile-Geheimschlüssel für den Bot-Check im Elternformular */
  TURNSTILE_SECRET?: string;
  /** Nur lokal (.dev.vars): feste Trainer-E-Mail für `wrangler dev`. */
  DEV_USER_EMAIL?: string;
  /** Nur lokal: andere Airtable-Adresse (z. B. der Nachbau aus dev/mock-airtable.mjs). Wirkt nur zusammen mit DEV_USER_EMAIL. */
  AIRTABLE_API_URL?: string;
  UNDO: KVNamespace;
  ASSETS?: Fetcher;
}

interface Apis {
  trainer: (req: Request) => Promise<Response>;
  public: (req: Request) => Promise<Response>;
}

// Pro Worker-Instanz einmal aufbauen, damit der Cache zwischen Anfragen erhalten bleibt.
let apis: Apis | undefined;

function isLocal(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

function devMode(env: Env): boolean {
  return !!env.DEV_USER_EMAIL && !env.ACCESS_AUD;
}

function build(env: Env): Apis {
  let auth: Authenticator;
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    auth = new AccessAuthenticator({ teamDomain: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD });
  } else if (env.DEV_USER_EMAIL) {
    auth = new DevAuthenticator(env.DEV_USER_EMAIL);
  } else {
    // Ohne Konfiguration niemanden reinlassen.
    auth = { authenticate: async () => null };
  }

  let human: HumanCheck;
  if (env.TURNSTILE_SECRET) human = new TurnstileCheck(env.TURNSTILE_SECRET);
  else if (devMode(env)) human = { verify: async () => true }; // nur lokal ohne Schlüssel
  else human = { verify: async () => false }; // im Betrieb ohne Schlüssel keine Anmeldungen

  const data = new CachedDataSource(
    new AirtableDataSource({
      token: env.AIRTABLE_TOKEN,
      baseId: env.AIRTABLE_BASE_ID,
      apiUrl: devMode(env) ? env.AIRTABLE_API_URL : undefined,
    }),
    { teamsTtlMs: 5 * 60_000, kidsTtlMs: 60_000 },
  );
  return { trainer: createApi({ data, undo: new KvUndoStore(env.UNDO), auth }), public: createPublicApi({ data, human }) };
}

/** Sicherheits-Header für ausgelieferte Seiten. */
function harden(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set("X-Content-Type-Options", "nosniff");
  out.headers.set("X-Frame-Options", "DENY");
  out.headers.set("Referrer-Policy", "no-referrer");
  return out;
}

async function asset(env: Env, req: Request, pathname?: string): Promise<Response> {
  if (!env.ASSETS) return new Response("Nicht gefunden", { status: 404 });
  const url = new URL(req.url);
  if (pathname) url.pathname = pathname;
  return harden(await env.ASSETS.fetch(new Request(url, req)));
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    apis ??= build(env);

    // Öffentliches Elternformular: eigene Adresse ohne Login (lokal unter /anmeldung/ zum Testen)
    const onPublicHost = !!env.PUBLIC_HOST && url.hostname === env.PUBLIC_HOST;
    const localPublic = isLocal(url) && (url.pathname.startsWith("/anmeldung") || url.pathname.startsWith("/api/anmeldung"));
    if (onPublicHost || localPublic) {
      if (url.pathname.startsWith("/api/")) return apis.public(req);
      if (url.pathname === "/" || url.pathname === "/anmeldung") return Response.redirect(new URL("/anmeldung/" + url.search, url).toString(), 302);
      // Auf der öffentlichen Adresse nur die Formular-Dateien, nichts von der Trainer-App
      if (!url.pathname.startsWith("/anmeldung/")) return new Response("Nicht gefunden", { status: 404 });
      return asset(env, req);
    }

    // Trainer-Bereich (hinter Cloudflare Access)
    if (url.pathname.startsWith("/api/")) return apis.trainer(req);
    return asset(env, req);
  },
} satisfies ExportedHandler<Env>;
