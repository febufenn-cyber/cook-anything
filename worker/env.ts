export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteAll(): Promise<void>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export interface DurableObjectStateLike {
  storage: DurableObjectStorage;
  waitUntil(promise: Promise<unknown>): void;
}

export interface DurableObjectIdLike {}

export interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
}

export interface CompanionConfigKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  ASSETS: AssetsBinding;

  /** Hosted execution remains fail-closed unless this is exactly "true". */
  HOSTED_COMPANION_ENABLED?: string;
  ANTHROPIC_API_KEY?: string;
  COMPANION_MODEL?: string;

  /** Stable private bridge origin, preferably a named Cloudflare Tunnel. */
  COMPANION_UPSTREAM?: string;
  /** HMAC secret shared only by the Worker and the private bridge. */
  COMPANION_UPSTREAM_SIGNING_SECRET?: string;

  COMPANION_SESSIONS: DurableObjectNamespaceLike;
  COMPANION_GATE: DurableObjectNamespaceLike;
  COMPANION_SESSION_RATE_LIMITER: RateLimitBinding;
  COMPANION_TURN_RATE_LIMITER: RateLimitBinding;

  COMPANION_SESSION_TTL_SECONDS?: string;
  COMPANION_MAX_TURNS_PER_SESSION?: string;
  COMPANION_MAX_ACTIVE_EXECUTIONS?: string;
  COMPANION_DAILY_EXECUTION_LIMIT?: string;

  /** Retained only for Phase 0 operational state; no longer selects an upstream. */
  COMPANION_CONFIG?: CompanionConfigKv;
}
