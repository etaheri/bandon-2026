/// <reference types="@cloudflare/vitest-pool-workers/types" />
import type { Env as WorkerEnv } from "../../worker/types";
import type { D1Migration } from "@cloudflare/vitest-pool-workers";

// The `cloudflare:test` module exposes `env` typed as `Cloudflare.Env`.
// Augment that global namespace so `env.DB`, `env.PASSCODE`, etc. (from the
// worker's Env) and the test-only `TEST_MIGRATIONS` binding are all typed.
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
