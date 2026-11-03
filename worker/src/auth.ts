/**
 * Anmeldung über Cloudflare Access.
 *
 * Access setzt vor dem Worker den Header `Cf-Access-Jwt-Assertion` (signiertes JWT). Wir prüfen dieses JWT selbst
 * (Signatur, Aussteller, Audience, Ablauf), statt nur dem Header `Cf-Access-Authenticated-User-Email` zu glauben –
 * so bleibt die App auch dann dicht, wenn der Worker versehentlich an Access vorbei erreichbar wäre.
 */
export interface Authenticator {
  /** Liefert die (klein geschriebene) E-Mail des angemeldeten Trainers oder null. */
  authenticate(req: Request): Promise<string | null>;
}

export interface AccessOptions {
  /** z. B. "esc06.cloudflareaccess.com" */
  teamDomain: string;
  /** Application Audience (AUD) Tag der Access-Anwendung */
  audience: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

const KEY_CACHE_MS = 60 * 60 * 1000;

export class AccessAuthenticator implements Authenticator {
  private keys?: { at: number; byKid: Map<string, CryptoKey> };
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opts: AccessOptions) {
    this.fetchFn = opts.fetchFn ?? ((...a) => fetch(...a));
  }

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  async authenticate(req: Request): Promise<string | null> {
    const token = req.headers.get("Cf-Access-Jwt-Assertion");
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts as [string, string, string];

    let header: { alg?: string; kid?: string };
    let payload: { iss?: string; aud?: string | string[]; exp?: number; nbf?: number; email?: string };
    try {
      header = JSON.parse(b64urlText(h));
      payload = JSON.parse(b64urlText(p));
    } catch {
      return null;
    }
    if (header.alg !== "RS256" || !header.kid) return null;

    const key = await this.key(header.kid);
    if (!key) return null;
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlBytes(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
    if (!valid) return null;

    const nowSec = this.now() / 1000;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.iss !== `https://${this.opts.teamDomain}`) return null;
    if (!aud.includes(this.opts.audience)) return null;
    if (typeof payload.exp !== "number" || payload.exp < nowSec) return null;
    if (typeof payload.nbf === "number" && payload.nbf > nowSec + 60) return null;
    if (typeof payload.email !== "string" || !payload.email.includes("@")) return null;
    return payload.email.trim().toLowerCase();
  }

  private async key(kid: string): Promise<CryptoKey | null> {
    const fresh = this.keys && this.now() - this.keys.at < KEY_CACHE_MS;
    if (!fresh || !this.keys!.byKid.has(kid)) await this.loadKeys();
    return this.keys?.byKid.get(kid) ?? null;
  }

  private async loadKeys(): Promise<void> {
    const res = await this.fetchFn(`https://${this.opts.teamDomain}/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error(`Access-Zertifikate nicht abrufbar (HTTP ${res.status})`);
    const body = (await res.json()) as { keys?: Jwk[] };
    const byKid = new Map<string, CryptoKey>();
    for (const jwk of body.keys ?? []) {
      if (!jwk.kid || jwk.kty !== "RSA") continue;
      const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      byKid.set(jwk.kid, key);
    }
    this.keys = { at: this.now(), byKid };
  }
}

/** Nur für `wrangler dev`: feste E-Mail, ausschließlich für Aufrufe über localhost. */
export class DevAuthenticator implements Authenticator {
  constructor(private readonly email: string) {}
  async authenticate(req: Request): Promise<string | null> {
    const host = new URL(req.url).hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return null;
    return this.email.trim().toLowerCase();
  }
}

function b64urlBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlText(s: string): string {
  return new TextDecoder().decode(b64urlBytes(s));
}
