import { beforeAll, describe, expect, it } from "vitest";
import { AccessAuthenticator, DevAuthenticator } from "../src/auth";

const TEAM = "esc06-test.cloudflareaccess.com";
const AUD = "aud-tag-123";
const NOW = Date.parse("2026-11-03T17:00:00Z");

let keys: CryptoKeyPair;
let otherKeys: CryptoKeyPair;
let jwks: object;
let certFetches = 0;

const b64url = (data: Uint8Array | string) =>
  btoa(typeof data === "string" ? data : String.fromCharCode(...data))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sign(payload: object, opts: { kid?: string; alg?: string; key?: CryptoKey } = {}) {
  const h = b64url(JSON.stringify({ alg: opts.alg ?? "RS256", kid: opts.kid ?? "k1", typ: "JWT" }));
  const p = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", opts.key ?? keys.privateKey, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}

const good = () => ({
  iss: `https://${TEAM}`, aud: [AUD], email: "Trainer.F1@Example.org",
  exp: NOW / 1000 + 3600, nbf: NOW / 1000 - 10,
});

function auth() {
  return new AccessAuthenticator({
    teamDomain: TEAM,
    audience: AUD,
    now: () => NOW,
    fetchFn: async (url) => {
      certFetches++;
      expect(String(url)).toBe(`https://${TEAM}/cdn-cgi/access/certs`);
      return new Response(JSON.stringify(jwks));
    },
  });
}

const withToken = (t: string) =>
  new Request("https://probetraining.example.org/api/me", { headers: { "Cf-Access-Jwt-Assertion": t } });

beforeAll(async () => {
  const gen = () =>
    crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true, ["sign", "verify"],
    ) as Promise<CryptoKeyPair>;
  keys = await gen();
  otherKeys = await gen();
  const pub = await crypto.subtle.exportKey("jwk", keys.publicKey);
  jwks = { keys: [{ ...pub, kid: "k1", alg: "RS256" }] };
});

describe("Cloudflare-Access-JWT", () => {
  it("gültiges Token → E-Mail klein geschrieben", async () => {
    expect(await auth().authenticate(withToken(await sign(good())))).toBe("trainer.f1@example.org");
  });

  it("ohne Token → null (der E-Mail-Header allein reicht nicht)", async () => {
    const r = new Request("https://x.example/api/me", { headers: { "Cf-Access-Authenticated-User-Email": "trainer.f1@example.org" } });
    expect(await auth().authenticate(r)).toBeNull();
  });

  it("falsche Signatur → null", async () => {
    expect(await auth().authenticate(withToken(await sign(good(), { key: otherKeys.privateKey })))).toBeNull();
  });

  it("manipulierte E-Mail → null", async () => {
    const [h, , s] = (await sign(good())).split(".");
    const p = b64url(JSON.stringify({ ...good(), email: "trainer.e1@example.org" }));
    expect(await auth().authenticate(withToken(`${h}.${p}.${s}`))).toBeNull();
  });

  it("falsche Audience → null", async () => {
    expect(await auth().authenticate(withToken(await sign({ ...good(), aud: ["andere-app"] })))).toBeNull();
  });

  it("falscher Aussteller → null", async () => {
    expect(await auth().authenticate(withToken(await sign({ ...good(), iss: "https://evil.cloudflareaccess.com" })))).toBeNull();
  });

  it("abgelaufen → null", async () => {
    expect(await auth().authenticate(withToken(await sign({ ...good(), exp: NOW / 1000 - 1 })))).toBeNull();
  });

  it("alg ≠ RS256 → null", async () => {
    expect(await auth().authenticate(withToken(await sign(good(), { alg: "none" })))).toBeNull();
  });

  it("unbekannte Key-ID → null", async () => {
    expect(await auth().authenticate(withToken(await sign(good(), { kid: "k9" })))).toBeNull();
  });

  it("Müll statt Token → null", async () => {
    expect(await auth().authenticate(withToken("abc.def"))).toBeNull();
    expect(await auth().authenticate(withToken("a.b.c"))).toBeNull();
  });

  it("Zertifikate werden zwischengespeichert", async () => {
    const a = auth();
    certFetches = 0;
    await a.authenticate(withToken(await sign(good())));
    await a.authenticate(withToken(await sign(good())));
    expect(certFetches).toBe(1);
  });
});

describe("Entwicklungs-Login", () => {
  it("gilt nur auf localhost", async () => {
    const dev = new DevAuthenticator("Trainer.F1@example.org");
    expect(await dev.authenticate(new Request("http://localhost:8787/api/me"))).toBe("trainer.f1@example.org");
    expect(await dev.authenticate(new Request("https://probetraining.esc-06.de/api/me"))).toBeNull();
  });
});
