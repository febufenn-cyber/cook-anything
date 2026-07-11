/**
 * Companion bridge: runs Cooking Companion turns through headless Claude Code
 * (`claude -p`) so a Claude Pro/Max SUBSCRIPTION powers the companion instead
 * of a pay-per-use API key. Deploy on any always-on box (VPS, mac mini) that
 * has Claude Code authenticated via `claude setup-token`.
 *
 * Zero npm dependencies. Protocol (called by worker/index.ts when
 * COMPANION_UPSTREAM is set):
 *   POST /turn  x-bridge-token: <BRIDGE_TOKEN>
 *   { system, state_system, messages, bridge_session_id? }
 *   -> { result, session_id } | { error }
 *
 * Conversation state lives in Claude Code's own session store: the first turn
 * creates a session (system prompt = recipe + protocol + current state), and
 * later turns --resume it, so only the newest user message is sent each time.
 * Photos arrive as base64 image blocks; they are written to a temp file that
 * Claude Code views with its Read tool, then deleted.
 *
 * Env: BRIDGE_TOKEN (required), PORT (default 8788), CLAUDE_BIN (default
 * "claude"), COMPANION_MODEL (default "sonnet"), CLAUDE_CODE_OAUTH_TOKEN
 * (from `claude setup-token`; inherited by the spawned CLI).
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 8788);
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN;
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const MODEL = process.env.COMPANION_MODEL || "sonnet";
const TURN_TIMEOUT_MS = 120_000;
const MAX_BODY = 3_000_000;
const WORK_DIR = join(tmpdir(), "companion-bridge");

if (!BRIDGE_TOKEN) {
  console.error("BRIDGE_TOKEN env var is required");
  process.exit(1);
}
await mkdir(WORK_DIR, { recursive: true });

const DISALLOWED_TOOLS =
  "Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch,Task,Glob,Grep,TodoWrite,KillShell,BashOutput";

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Extract the newest user message as { text, images[] } from the history. */
function lastUserMessage(messages) {
  const m = [...messages].reverse().find((x) => x.role === "user");
  if (!m) return { text: "", images: [] };
  if (typeof m.content === "string") return { text: m.content, images: [] };
  const text = m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const images = m.content
    .filter((b) => b.type === "image" && b.source?.type === "base64")
    .map((b) => b.source);
  return { text, images };
}

function runClaude(args, stdinText) {
  return new Promise((resolve) => {
    const child = spawn(CLAUDE_BIN, args, {
      cwd: WORK_DIR,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, error: "timeout" });
    }, TURN_TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const lower = `${out}\n${err}`.toLowerCase();
        const error = /limit|rate/.test(lower) ? "rate_limited" : "upstream_error";
        console.error(`claude exited ${code}: ${err.slice(0, 400)}`);
        return resolve({ ok: false, error });
      }
      try {
        const data = JSON.parse(out);
        resolve({ ok: true, data });
      } catch {
        resolve({ ok: false, error: "upstream_error" });
      }
    });
    child.stdin.write(stdinText);
    child.stdin.end();
  });
}

async function handleTurn(body) {
  const { system, state_system, messages, bridge_session_id } = body;
  if (!system || !Array.isArray(messages) || messages.length === 0) {
    return { status: 400, body: { error: "bad_request" } };
  }
  const { text, images } = lastUserMessage(messages);

  // Photos: write to temp files Claude Code can view with Read.
  const files = [];
  for (const img of images.slice(0, 2)) {
    const ext = (img.media_type || "image/jpeg").split("/")[1] || "jpg";
    const p = join(WORK_DIR, `photo-${randomUUID()}.${ext}`);
    await writeFile(p, Buffer.from(img.data, "base64"));
    files.push(p);
  }
  const prompt =
    files.length > 0
      ? `${files.map((f) => `[The user sent a kitchen photo — view it now at ${f}]`).join("\n")}\n${text || "What do you see?"}`
      : text;

  const args = [
    "-p",
    "--output-format", "json",
    "--model", MODEL,
    "--max-turns", "4", // room to Read photo(s) then answer
    "--disallowed-tools", DISALLOWED_TOOLS,
  ];
  if (bridge_session_id) {
    args.push("--resume", bridge_session_id);
  } else {
    // New cook session: recipe + protocol + current state pin the session.
    args.push("--system-prompt", `${system}\n\n${state_system ?? ""}`);
  }

  try {
    const r = await runClaude(args, prompt);
    return r.ok
      ? { status: 200, body: { result: r.data.result ?? "", session_id: r.data.session_id ?? null } }
      : { status: 502, body: { error: r.error } };
  } finally {
    await Promise.all(files.map((f) => unlink(f).catch(() => {})));
  }
}

createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/turn") {
    return req.url === "/health"
      ? json(res, 200, { ok: true })
      : json(res, 404, { error: "not_found" });
  }
  if (req.headers["x-bridge-token"] !== BRIDGE_TOKEN) {
    return json(res, 401, { error: "unauthorized" });
  }
  let raw = "";
  req.on("data", (d) => {
    raw += d;
    if (raw.length > MAX_BODY) req.destroy();
  });
  req.on("end", async () => {
    try {
      const { status, body } = await handleTurn(JSON.parse(raw));
      json(res, status, body);
    } catch (e) {
      console.error(e);
      json(res, 500, { error: "internal" });
    }
  });
}).listen(PORT, "127.0.0.1", () =>
  console.log(`companion-bridge listening on 127.0.0.1:${PORT} (model: ${MODEL})`),
);
