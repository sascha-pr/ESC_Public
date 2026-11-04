/**
 * Spam-Schutz für das öffentliche Elternformular: Cloudflare Turnstile.
 * Das Formular holt im Browser ein Token, der Worker lässt es hier von Cloudflare bestätigen.
 */
export interface HumanCheck {
  verify(token: string, ip: string | null): Promise<boolean>;
}

export class TurnstileCheck implements HumanCheck {
  private readonly fetchFn: typeof fetch;
  constructor(private readonly secret: string, fetchFn?: typeof fetch) {
    this.fetchFn = fetchFn ?? ((...a) => fetch(...a));
  }

  async verify(token: string, ip: string | null): Promise<boolean> {
    if (!token || token.length > 2048) return false;
    const form = new FormData();
    form.append("secret", this.secret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    try {
      const res = await this.fetchFn("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
      if (!res.ok) return false;
      const body = (await res.json()) as { success?: boolean };
      return body.success === true;
    } catch {
      return false;
    }
  }
}
