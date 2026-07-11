/**
 * Phase 1 companion bridge.
 *
 * The bridge is no longer a general prompt proxy. It accepts only HMAC-signed,
 * replay-protected, text-only execution envelopes from the Worker. Browser
 * clients never see or control Claude session ids, system prompts, tool access,
 * model selection, or filesystem paths.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 8788);
const SIGNING_SECRET = process.env.BRIDGE_SIGNING_SECRET;
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const MODEL = process.env.COMPANION_MODEL || "sonnet";
const TURN_TIMEOUT_MS = boundedInt(process.env.TURN_TIMEOUT_MS, 90_000, 5_000, 120_000);
const MAX_BODY_BYTES = boundedInt(process.env.MAX_BODY_BYTES, 300_000, 16_384, 1_000_000);
const MAX_OUTPUT_BYTES = boundedInt(process.env.MAX_OUTPUT_BYTES, 1_000_000, 64_000, 4_000_000);
const MAX_CONCURRENCY = boundedInt(process.env.MAX_CONCURRENCY, 2, 1, 8);
const REPLAY_WINDOW_SECONDS = 30;
const WORK_DIR = join(tmpdir(), "companion-bridge");

if (!SIGNING_SECRET || SIGNING_SECRET.length < 32) {
  console.error("BRIDGE_SIGNING_SECRET must be set to at least 32 characters");
  process.exit(1);
}
await mkdir(WORK_DIR, { recursive: true, mode: 0o700 });

const DISALLOWED_TOOLS =
  "Bash,Read,Edit,Write,NotebookEdit,WebFetch,WebSearch,Task,Glob,Grep,TodoWrite,KillShell,BashOutput";
const replayCache = new Map();
let activeExecutions = 0;

function boundedInt(raw, fallback, min, max) {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function json(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(body));
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function cleanReplayCache(nowSeconds) {
  for (const [requestId, expiresAt] of replayCache) {
    if (expiresAt <= nowSeconds) replayCache.delete(requestId);
  }
}

function verifyEnvelope(req, rawBody) {
  const requestId = req.headers["x-request-id"];
  const timestampRaw = req.headers["x-timestamp"];
  const claimedBodyHash = req.headers["x-body-sha256"];
  const signature = req.headers["x-signature"];
  if (
    typeof requestId !== "string" ||
    typeof timestampRaw !== "string" ||
    typeof claimedBodyHash !== "string" ||
    typeof signature !== "string"
  ) return { ok: false, error: "unauthorized" };
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, error: "unauthorized" };

  const timestamp = Number(timestampRaw);
  const nowSeconds = Math.floor(Date.now() / 1_000);
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > REPLAY_WINDOW_SECONDS) {
    return { ok: false, error: "expired_request" };
  }

  cleanReplayCache(nowSeconds);
  if (replayCache.has(requestId)) return { ok: false, error: "replayed_request" };

  const actualBodyHash = sha256Hex(rawBody);
  if (!safeEqualHex(claimedBodyHash, actualBodyHash)) return { ok: false, error: "unauthorized" };
  const expectedSignature = createHmac("sha256", SIGNING_SECRET)
    .update(`${requestId}.${timestampRaw}.${actualBodyHash}`)
    .digest("hex");
  if (!safeEqualHex(signature, expectedSignature)) return { ok: false, error: "unauthorized" };

  replayCache.set(requestId, nowSeconds + REPLAY_WINDOW_SECONDS + 1);
  return { ok: true, requestId };
}

function validateBody(value, expectedRequestId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowed = new Set([
    "schema_version", "request_id", "system", "state_system", "message", "backend_session_id",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;
  if (value.schema_version !== 1 || value.request_id !== expectedRequestId) return null;
  if (typeof value.system !== "string" || !value.system || value.system.length > 200_000) return null;
  if (typeof value.state_system !== "string" || value.state_system.length > 50_000) return null;
  if (typeof value.message !== "string" || !value.message.trim() || value.message.length > 2_000) return null;
  if (
    value.backend_session_id !== null &&
    value.backend_session_id !== undefined &&
    (typeof value.backend_session_id !== "string" || value.backend_session_id.length > 200)
  ) return null;
  return value;
}

function claudeEnvironment() {
  const allowed = [
    "PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "TERM",
    "TMPDIR", "XDG_CONFIG_HOME", "CLAUDE_CODE_OAUTH_TOKEN",
  ];
  return Object.fromEntries(allowed.flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []));
}

function killProcessGroup(child, signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try { child.kill(signal); } catch { /* already exited */ }
  }
}

function runClaude(args, stdinText, abortSignal) {
  return new Promise((resolve) => {
    const child = spawn(CLAUDE_BIN, args, {
      cwd: WORK_DIR,
      env: claudeEnvironment(),
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });
    let out = "";
    let err = "";
    let settled = false;
    let killTimer;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      abortSignal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const terminate = (error) => {
      if (settled) return;
      killProcessGroup(child, "SIGTERM");
      killTimer = setTimeout(() => killProcessGroup(child, "SIGKILL"), 1_500);
      finish({ ok: false, error });
    };
    const abort = () => terminate("cancelled");
    const timeout = setTimeout(() => terminate("timeout"), TURN_TIMEOUT_MS);
    abortSignal?.addEventListener("abort", abort, { once: true });

    child.stdout.on("data", (chunk) => {
      out += chunk;
      if (Buffer.byteLength(out) > MAX_OUTPUT_BYTES) terminate("upstream_error");
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
      if (Buffer.byteLength(err) > 64_000) err = err.slice(-64_000);
    });
    child.on("error", () => finish({ ok: false, error: "upstream_error" }));
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        const lower = `${out}\n${err}`.toLowerCase();
        const error = /limit|rate/.test(lower) ? "rate_limited" : "upstream_error";
        console.error(JSON.stringify({ event: "claude_exit", code, error }));
        return finish({ ok: false, error });
      }
      try {
        const data = JSON.parse(out);
        return finish({ ok: true, data });
      } catch {
        return finish({ ok: false, error: "upstream_error" });
      }
    });
    child.stdin.on("error", () => terminate("upstream_error"));
    child.stdin.end(stdinText);
  });
}

async function executeTurn(body, abortSignal) {
  const args = [
    "-p",
    "--output-format", "json",
    "--model", MODEL,
    "--max-turns", "1",
    "--disallowed-tools", DISALLOWED_TOOLS,
  ];
  if (body.backend_session_id) {
    args.push("--resume", body.backend_session_id);
  } else {
    args.push("--system-prompt", `${body.system}\n\n${body.state_system}`);
  }

  const result = await runClaude(args, body.message, abortSignal);
  if (!result.ok) return { status: result.error === "rate_limited" ? 429 : 502, body: { error: result.error } };
  const text = typeof result.data?.result === "string" ? result.data.result : "";
  if (!text) return { status: 502, body: { error: "upstream_error" } };
  const backendSessionId = typeof result.data?.session_id === "string" ? result.data.session_id : null;
  return { status: 200, body: { result: text, backend_session_id: backendSessionId } };
}

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, { ok: true, active: activeExecutions, capacity: MAX_CONCURRENCY, mode: "phase1-text-only" });
  }
  if (req.method !== "POST" || req.url !== "/turn") return json(res, 404, { error: "not_found" });

  const chunks = [];
  let size = 0;
  let rejected = false;
  req.on("data", (chunk) => {
    if (rejected) return;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      rejected = true;
      json(res, 413, { error: "payload_too_large" });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", async () => {
    if (rejected || res.writableEnded) return;
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const verification = verifyEnvelope(req, rawBody);
    if (!verification.ok) return json(res, 401, { error: verification.error });

    let parsed;
    try { parsed = JSON.parse(rawBody); } catch { return json(res, 400, { error: "bad_json" }); }
    const body = validateBody(parsed, verification.requestId);
    if (!body) return json(res, 400, { error: "bad_request" });
    if (activeExecutions >= MAX_CONCURRENCY) return json(res, 503, { error: "busy" });

    activeExecutions += 1;
    const abortController = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abortController.abort();
    });
    try {
      const result = await executeTurn(body, abortController.signal);
      json(res, result.status, result.body);
    } catch {
      json(res, 500, { error: "internal" });
    } finally {
      activeExecutions -= 1;
    }
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`companion-bridge listening on 127.0.0.1:${PORT} (model: ${MODEL}, capacity: ${MAX_CONCURRENCY}, text-only)`);
});
