import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../worker/index";
import type { Env } from "../worker/env";

const unused = new Proxy({}, {
  get(_target, property) {
    throw new Error(`static request touched unexpected binding ${String(property)}`);
  },
});

const env = {
  HOSTED_COMPANION_ENABLED: "false",
  ASSETS: {
    async fetch(request: Request): Promise<Response> {
      return new Response("<!doctype html><title>Cook Anything</title>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "x-asset-url": request.url },
      });
    },
  },
  COMPANION_SESSIONS: unused,
  COMPANION_GATE: unused,
  COMPANION_SESSION_RATE_LIMITER: unused,
  COMPANION_TURN_RATE_LIMITER: unused,
} as unknown as Env;

async function main(): Promise<void> {
  const response = await worker.fetch(new Request("https://cook-anything.example/recipes/test/"), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<!doctype html><title>Cook Anything</title>");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.ok(response.headers.get("permissions-policy")?.includes("geolocation=()"));
  const csp = response.headers.get("content-security-policy") ?? "";
  assert.ok(csp.includes("default-src 'self'"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("connect-src 'self' https:"));

  // Static routes are served by the assets edge path WITHOUT invoking the
  // Worker (verified against the deployed staging origin in Phase 6.5), so
  // public/_headers must carry the identical suite at the asset layer.
  const headersFile = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  const fileCsp = headersFile.match(/Content-Security-Policy: (.+)/)?.[1]?.trim();
  assert.equal(fileCsp, csp, "public/_headers CSP must match worker CONTENT_SECURITY_POLICY");
  for (const [headerName, workerValue] of [
    ["Referrer-Policy", response.headers.get("referrer-policy")],
    ["X-Content-Type-Options", response.headers.get("x-content-type-options")],
    ["X-Frame-Options", response.headers.get("x-frame-options")],
    ["Cross-Origin-Opener-Policy", response.headers.get("cross-origin-opener-policy")],
    ["Cross-Origin-Resource-Policy", response.headers.get("cross-origin-resource-policy")],
    ["Permissions-Policy", response.headers.get("permissions-policy")],
  ] as const) {
    const fileValue = headersFile.match(new RegExp(`^  ${headerName}: (.+)$`, "m"))?.[1]?.trim();
    assert.equal(fileValue, workerValue, `public/_headers ${headerName} must match the worker`);
  }

  console.log("Worker security-header tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
