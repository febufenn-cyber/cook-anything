import assert from "node:assert/strict";
import { CompanionGate } from "../worker/companion-session";
import type { DurableObjectStateLike, DurableObjectStorage, Env } from "../worker/env";

class MemoryStorage implements DurableObjectStorage {
  readonly data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.data.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async deleteAll(): Promise<void> {
    this.data.clear();
  }

  async setAlarm(): Promise<void> {}
  async deleteAlarm(): Promise<void> {}
}

async function main(): Promise<void> {
  const storage = new MemoryStorage();
  const context: DurableObjectStateLike = {
    storage,
    waitUntil() {},
  };
  const env = {
    COMPANION_MAX_ACTIVE_EXECUTIONS: "1",
    COMPANION_DAILY_EXECUTION_LIMIT: "10",
  } as Env;

  await storage.put("gate", {
    utc_day: "2000-01-01",
    execution_count: 10,
    active_leases: { previous_day_turn: Date.now() + 60_000 },
  });

  const gate = new CompanionGate(context, env);
  const response = await gate.fetch(new Request("https://internal/acquire", { method: "POST" }));
  assert.equal(response.status, 503);
  assert.equal((await response.json() as { error: string }).error, "busy");

  const record = await storage.get<{
    utc_day: string;
    execution_count: number;
    active_leases: Record<string, number>;
  }>("gate");
  assert.ok(record);
  assert.notEqual(record.utc_day, "2000-01-01");
  assert.equal(record.execution_count, 0, "daily budget resets at UTC rollover");
  assert.ok(record.active_leases.previous_day_turn, "active lease must survive UTC rollover");

  console.log("Companion gate rollover test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
