import { env, SELF } from "cloudflare:test";

/** Extract the `bandon_session=<token>` pair from a Set-Cookie header. */
function sessionCookie(setCookie: string | null): string {
  const m = setCookie?.match(/bandon_session=[^;]+/);
  if (!m) throw new Error("no bandon_session cookie in Set-Cookie header");
  return m[0];
}

/** Log in with the trip passcode; return a `Cookie` header value. */
export async function authCookie(): Promise<string> {
  const res = await SELF.fetch("https://x/api/auth", {
    method: "POST",
    body: JSON.stringify({ passcode: env.PASSCODE }),
    headers: { "content-type": "application/json" },
  });
  return sessionCookie(res.headers.get("set-cookie"));
}

/** Log in with the admin passcode; return a `Cookie` header value. */
export async function adminCookie(): Promise<string> {
  const res = await SELF.fetch("https://x/api/auth", {
    method: "POST",
    body: JSON.stringify({ passcode: env.ADMIN_PASSCODE }),
    headers: { "content-type": "application/json" },
  });
  return sessionCookie(res.headers.get("set-cookie"));
}
