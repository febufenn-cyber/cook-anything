import type {
  ChatMessage,
  CompanionResponse,
  CompanionState,
  TrustedCompanionRecipe,
} from "../src/lib/companion/types";
import { initialCompanionState } from "../src/lib/companion/types";
import type { DurableObjectStateLike, Env } from "./env";
import { executeHostedTurn } from "./execution";
import {
  jsonResponse,
  validateCompanionState,
  validateTrustedRecipe,
  validateTurnInput,
} from "./security";

interface ProcessingTurn {
  status: "processing";
  at: number;
}

interface CompletedTurn {
  status: "complete";
  at: number;
  http_status: number;
  response: CompanionResponse;
}

type StoredTurn = ProcessingTurn | CompletedTurn;

interface SessionRecord {
  schema_version: 1;
  recipe: TrustedCompanionRecipe;
  state: CompanionState;
  history: ChatMessage[];
  created_at: number;
  updated_at: number;
  turn_count: number;
  recent_turns: Record<string, StoredTurn>;
}

interface GateRecord {
  utc_day: string;
  execution_count: number;
  active_leases: Record<string, number>;
}

const SESSION_STORAGE_KEY = "session";
const GATE_STORAGE_KEY = "gate";
const HISTORY_MESSAGES = 16;
const IDEMPOTENCY_RESULTS = 20;
const LEASE_TTL_MS = 120_000;

function boundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function todayUtc(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function errorStatus(error: string): number {
  if (error === "bad_request" || error === "bad_json") return 400;
  if (error === "session_expired") return 401;
  if (error === "turn_in_progress" || error === "turn_unknown") return 409;
  if (error === "session_limit" || error === "daily_limit" || error === "rate_limited") return 429;
  if (error === "busy" || error === "overloaded" || error === "not_configured") return 503;
  return 502;
}

function trimRecentTurns(turns: Record<string, StoredTurn>): Record<string, StoredTurn> {
  return Object.fromEntries(
    Object.entries(turns)
      .sort(([, left], [, right]) => right.at - left.at)
      .slice(0, IDEMPOTENCY_RESULTS),
  );
}

/** Global active-execution and daily-budget gate. */
export class CompanionGate {
  constructor(
    private readonly ctx: DurableObjectStateLike,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/acquire") return this.acquire();
    if (request.method === "POST" && url.pathname === "/release") return this.release(request);
    return jsonResponse({ error: "not_found" }, 404);
  }

  private async acquire(): Promise<Response> {
    const now = Date.now();
    const day = todayUtc(now);
    const maxActive = boundedInt(this.env.COMPANION_MAX_ACTIVE_EXECUTIONS, 2, 1, 20);
    const dailyLimit = boundedInt(this.env.COMPANION_DAILY_EXECUTION_LIMIT, 300, 1, 100_000);
    const stored = await this.ctx.storage.get<GateRecord>(GATE_STORAGE_KEY);
    const activeLeases = Object.fromEntries(
      Object.entries(stored?.active_leases ?? {}).filter(([, expiresAt]) => expiresAt > now),
    );
    const gate: GateRecord = {
      utc_day: day,
      execution_count: stored?.utc_day === day ? stored.execution_count : 0,
      active_leases: activeLeases,
    };

    if (gate.execution_count >= dailyLimit) {
      await this.ctx.storage.put(GATE_STORAGE_KEY, gate);
      return jsonResponse({ error: "daily_limit" }, 429);
    }
    if (Object.keys(gate.active_leases).length >= maxActive) {
      await this.ctx.storage.put(GATE_STORAGE_KEY, gate);
      return jsonResponse({ error: "busy" }, 503);
    }

    const lease_id = crypto.randomUUID();
    gate.active_leases[lease_id] = now + LEASE_TTL_MS;
    gate.execution_count += 1;
    await this.ctx.storage.put(GATE_STORAGE_KEY, gate);
    return jsonResponse({ lease_id });
  }

  private async release(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { lease_id?: unknown } | null;
    if (!body || typeof body.lease_id !== "string") return jsonResponse({ error: "bad_request" }, 400);
    const gate = await this.ctx.storage.get<GateRecord>(GATE_STORAGE_KEY);
    if (gate?.active_leases[body.lease_id]) {
      delete gate.active_leases[body.lease_id];
      await this.ctx.storage.put(GATE_STORAGE_KEY, gate);
    }
    return jsonResponse({ ok: true });
  }
}

/** One Durable Object instance owns one opaque browser cooking session. */
export class CompanionSession {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly ctx: DurableObjectStateLike,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/initialize") {
      return this.enqueue(() => this.initialize(request));
    }
    if (request.method === "POST" && url.pathname === "/turn") {
      return this.enqueue(() => this.turn(request));
    }
    if (request.method === "DELETE" && url.pathname === "/close") {
      return this.enqueue(() => this.close());
    }
    return jsonResponse({ error: "not_found" }, 404);
  }

  /** Cloudflare invokes this even when the user never returns. */
  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const running = this.queue.then(task, task);
    this.queue = running.then(() => undefined, () => undefined);
    return running;
  }

  private sessionTtlSeconds(): number {
    return boundedInt(this.env.COMPANION_SESSION_TTL_SECONDS, 7_200, 300, 86_400);
  }

  private maxTurns(): number {
    return boundedInt(this.env.COMPANION_MAX_TURNS_PER_SESSION, 30, 1, 100);
  }

  private async scheduleExpiry(from: number): Promise<void> {
    await this.ctx.storage.setAlarm(from + this.sessionTtlSeconds() * 1_000);
  }

  private async purge(): Promise<void> {
    await Promise.all([
      this.ctx.storage.deleteAlarm().catch(() => undefined),
      this.ctx.storage.deleteAll(),
    ]);
  }

  private async initialize(request: Request): Promise<Response> {
    const raw = await request.json().catch(() => null);
    const recipe = validateTrustedRecipe(raw);
    if (!recipe) return jsonResponse({ state: null, error: "invalid_recipe_snapshot" }, 500);

    const now = Date.now();
    const existing = await this.ctx.storage.get<SessionRecord>(SESSION_STORAGE_KEY);
    if (existing && now - existing.updated_at <= this.sessionTtlSeconds() * 1_000) {
      if (existing.recipe.recipe_id !== recipe.recipe_id || existing.recipe.version !== recipe.version) {
        return jsonResponse({ state: null, error: "session_conflict" }, 409);
      }
      await this.scheduleExpiry(now);
      return jsonResponse({ state: existing.state });
    }
    if (existing) await this.purge();

    const record: SessionRecord = {
      schema_version: 1,
      recipe,
      state: initialCompanionState(recipe),
      history: [],
      created_at: now,
      updated_at: now,
      turn_count: 0,
      recent_turns: {},
    };
    await Promise.all([
      this.ctx.storage.put(SESSION_STORAGE_KEY, record),
      this.scheduleExpiry(now),
    ]);
    return jsonResponse({ state: record.state });
  }

  private async turn(request: Request): Promise<Response> {
    const input = validateTurnInput(await request.json().catch(() => null));
    if (!input) return jsonResponse({ reply: "", state: null, error: "bad_request" }, 400);

    const record = await this.ctx.storage.get<SessionRecord>(SESSION_STORAGE_KEY);
    if (!record) return jsonResponse({ reply: "", state: null, error: "session_expired" }, 401);

    const now = Date.now();
    if (now - record.updated_at > this.sessionTtlSeconds() * 1_000) {
      await this.purge();
      return jsonResponse({ reply: "", state: null, error: "session_expired" }, 401);
    }

    const existingTurn = record.recent_turns[input.client_turn_id];
    if (existingTurn?.status === "complete") {
      return jsonResponse(existingTurn.response, existingTurn.http_status);
    }
    if (existingTurn?.status === "processing") {
      const error = now - existingTurn.at <= LEASE_TTL_MS ? "turn_in_progress" : "turn_unknown";
      return jsonResponse({ reply: "", state: record.state, error }, 409);
    }
    if (record.turn_count >= this.maxTurns()) {
      return jsonResponse({ reply: "", state: record.state, error: "session_limit" }, 429);
    }

    const gate = this.env.COMPANION_GATE.get(this.env.COMPANION_GATE.idFromName("global"));
    const acquired = await gate.fetch("https://companion-gate/acquire", { method: "POST" });
    const acquiredBody = (await acquired.json().catch(() => null)) as { lease_id?: unknown; error?: unknown } | null;
    if (!acquired.ok || !acquiredBody || typeof acquiredBody.lease_id !== "string") {
      const error = typeof acquiredBody?.error === "string" ? acquiredBody.error : "busy";
      return jsonResponse({ reply: "", state: record.state, error }, errorStatus(error));
    }

    const leaseId = acquiredBody.lease_id;
    record.recent_turns[input.client_turn_id] = { status: "processing", at: now };
    record.recent_turns = trimRecentTurns(record.recent_turns);
    await this.ctx.storage.put(SESSION_STORAGE_KEY, record);

    try {
      const executed = await executeHostedTurn(
        this.env,
        record.recipe,
        record.state,
        record.history,
        input.message,
      );
      if (!executed.reply) throw new Error("upstream_error");

      const validatedState = executed.candidateState
        ? validateCompanionState(executed.candidateState, record.recipe)
        : null;
      const response: CompanionResponse = {
        reply: executed.reply,
        state: validatedState ?? record.state,
        ...(!validatedState ? { state_warning: "invalid_model_state" as const } : {}),
      };

      const completedAt = Date.now();
      record.state = response.state ?? record.state;
      record.history = [
        ...record.history,
        { role: "user", content: input.message },
        { role: "assistant", content: executed.reply },
      ].slice(-HISTORY_MESSAGES);
      record.turn_count += 1;
      record.updated_at = completedAt;
      record.recent_turns[input.client_turn_id] = {
        status: "complete",
        at: completedAt,
        http_status: 200,
        response,
      };
      record.recent_turns = trimRecentTurns(record.recent_turns);
      await Promise.all([
        this.ctx.storage.put(SESSION_STORAGE_KEY, record),
        this.scheduleExpiry(completedAt),
      ]);
      return jsonResponse(response);
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : "upstream_error";
      const status = errorStatus(error);
      const response: CompanionResponse = { reply: "", state: record.state, error };
      const failedAt = Date.now();
      record.updated_at = failedAt;
      record.recent_turns[input.client_turn_id] = {
        status: "complete",
        at: failedAt,
        http_status: status,
        response,
      };
      record.recent_turns = trimRecentTurns(record.recent_turns);
      await Promise.all([
        this.ctx.storage.put(SESSION_STORAGE_KEY, record),
        this.scheduleExpiry(failedAt),
      ]);
      return jsonResponse(response, status);
    } finally {
      this.ctx.waitUntil(gate.fetch("https://companion-gate/release", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lease_id: leaseId }),
      }).then(() => undefined).catch(() => undefined));
    }
  }

  private async close(): Promise<Response> {
    await this.purge();
    return jsonResponse({ ok: true });
  }
}
