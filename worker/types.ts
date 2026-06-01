export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  PASSCODE: string;
  ADMIN_PASSCODE: string;
}
