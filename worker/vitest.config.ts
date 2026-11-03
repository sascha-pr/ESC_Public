import { defineConfig } from "vitest/config";

// Die Logik ist bewusst frei von Worker-spezifischen APIs (Request/Response/WebCrypto gibt es auch in Node),
// daher laufen die Tests ohne Workers-Laufzeit.
export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
