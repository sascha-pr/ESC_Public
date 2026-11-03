import { AirtableDataSource } from "./airtable";
import { createApi } from "./api";
import { AccessAuthenticator, DevAuthenticator, type Authenticator } from "./auth";
import { CachedDataSource } from "./cache";
import { KvUndoStore } from "./undo";

export interface Env {
  /** Secret: Airtable Personal Access Token (nur data.records:read/write auf die eine Base). */
  AIRTABLE_TOKEN: string;
  AIRTABLE_BASE_ID: string;
  /** z. B. "esc06.cloudflareaccess.com" */
  ACCESS_TEAM_DOMAIN?: string;
  /** AUD-Tag der Access-Anwendung */
  ACCESS_AUD?: string;
  /** Nur lokal (.dev.vars): feste Trainer-E-Mail für `wrangler dev`. */
  DEV_USER_EMAIL?: string;
  /** Nur lokal: andere Airtable-Adresse (z. B. der Nachbau aus dev/mock-airtable.mjs). Wirkt nur zusammen mit DEV_USER_EMAIL. */
  AIRTABLE_API_URL?: string;
  UNDO: KVNamespace;
  ASSETS?: Fetcher;
}

// Pro Worker-Instanz einmal aufbauen, damit der Cache zwischen Anfragen erhalten bleibt.
let api: ((req: Request) => Promise<Response>) | undefined;

function build(env: Env): (req: Request) => Promise<Response> {
  let auth: Authenticator;
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    auth = new AccessAuthenticator({ teamDomain: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD });
  } else if (env.DEV_USER_EMAIL) {
    auth = new DevAuthenticator(env.DEV_USER_EMAIL);
  } else {
    // Ohne Konfiguration niemanden reinlassen.
    auth = { authenticate: async () => null };
  }
  const data = new CachedDataSource(
    new AirtableDataSource({
      token: env.AIRTABLE_TOKEN,
      baseId: env.AIRTABLE_BASE_ID,
      apiUrl: env.DEV_USER_EMAIL && !env.ACCESS_AUD ? env.AIRTABLE_API_URL : undefined,
    }),
    { teamsTtlMs: 5 * 60_000, kidsTtlMs: 60_000 },
  );
  return createApi({ data, undo: new KvUndoStore(env.UNDO), auth });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      api ??= build(env);
      return api(req);
    }
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response("Nicht gefunden", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
