import worker from "../src/worker.js";

const env = {
  STRAVA_CLIENT_ID: "12345",
  STRAVA_CLIENT_SECRET: "sekrit",
  ALLOWED_ORIGINS: "https://sheppio.github.io, http://localhost:8000",
};
const ORIGIN = "https://sheppio.github.io";
let calls = [];
let stub = null;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  return stub(String(url), init);
};

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  <- " + extra : "")); }
}
const req = (path, opts = {}) => new Request("https://w.example.dev" + path, opts);

// --- origin gating -------------------------------------------------------
stub = async () => new Response("{}", { status: 200 });
let r = await worker.fetch(req("/auth/token", { method: "POST", headers: { Origin: "https://evil.example" } }), env);
check("rejects an origin not on the allowlist", r.status === 403, "got " + r.status);

r = await worker.fetch(req("/auth/token", { method: "POST" }), env);
check("rejects a request with no Origin at all", r.status === 403, "got " + r.status);

r = await worker.fetch(req("/auth/token", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env);
check("preflight from an allowed origin gets 204", r.status === 204);
check("preflight echoes the origin", r.headers.get("Access-Control-Allow-Origin") === ORIGIN);
check("preflight sets Vary: Origin", r.headers.get("Vary") === "Origin");

r = await worker.fetch(req("/auth/token", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }), env);
check("preflight from a bad origin is refused", r.status === 403);

r = await worker.fetch(req("/auth/token", { method: "POST", headers: { Origin: "http://localhost:8000" } }), env);
check("second allowlist entry works too", r.headers.get("Access-Control-Allow-Origin") === "http://localhost:8000");

// --- misconfiguration ----------------------------------------------------
r = await worker.fetch(req("/auth/token", { method: "POST", headers: { Origin: ORIGIN } }), { ALLOWED_ORIGINS: ORIGIN });
check("missing secrets are reported, not ignored", r.status === 500 && (await r.json()).error === "worker_not_configured");

// --- token exchange ------------------------------------------------------
calls = [];
stub = async () => new Response(JSON.stringify({
  access_token: "AT", refresh_token: "RT", expires_at: 1790000000,
  athlete: { id: 7, firstname: "Mark", username: "m", country: "UK" },
}), { status: 200 });
r = await worker.fetch(req("/auth/token", {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" },
  body: JSON.stringify({ code: "abc123" }),
}), env);
let body = await r.json();
check("code exchange returns 200", r.status === 200);
check("returns the access token", body.access_token === "AT");
check("returns the refresh token", body.refresh_token === "RT");
const sent = new URLSearchParams(calls[0].init.body.toString());
check("sends grant_type=authorization_code", sent.get("grant_type") === "authorization_code");
check("sends the code", sent.get("code") === "abc123");
check("sends the client secret to Strava", sent.get("client_secret") === "sekrit");
check("NEVER returns the client secret", !JSON.stringify(body).includes("sekrit"), JSON.stringify(body));
check("drops athlete fields the page doesn't need", body.athlete.country === undefined);

r = await worker.fetch(req("/auth/token", {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({}),
}), env);
check("missing code is a clean 400", r.status === 400 && (await r.json()).error === "missing_code");

r = await worker.fetch(req("/auth/token", {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: "not json",
}), env);
check("unparseable body is a clean 400", r.status === 400);

// Strava rejecting the grant
stub = async () => new Response(JSON.stringify({ message: "Bad Request", errors: [{ field: "code" }] }), { status: 400 });
r = await worker.fetch(req("/auth/token", {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ code: "stale" }),
}), env);
body = await r.json();
check("a rejected grant surfaces Strava's message", r.status === 400 && body.error === "exchange_rejected" && body.message === "Bad Request");

// Strava unreachable
stub = async () => { throw new Error("boom"); };
r = await worker.fetch(req("/auth/token", {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ code: "x" }),
}), env);
check("network failure is 502, not a crash", r.status === 502 && (await r.json()).error === "upstream_unreachable");

// --- refresh -------------------------------------------------------------
calls = [];
stub = async () => new Response(JSON.stringify({ access_token: "AT2", refresh_token: "RT2", expires_at: 99 }), { status: 200 });
r = await worker.fetch(req("/auth/refresh", {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: "RT" }),
}), env);
body = await r.json();
const sent2 = new URLSearchParams(calls[0].init.body.toString());
check("refresh sends grant_type=refresh_token", sent2.get("grant_type") === "refresh_token");
check("refresh returns the rotated token", body.refresh_token === "RT2");

r = await worker.fetch(req("/auth/refresh", {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({}),
}), env);
check("refresh without a token is a clean 400", r.status === 400);

// --- activities ----------------------------------------------------------
calls = [];
stub = async () => new Response(JSON.stringify([{ name: "Morning Run", sport_type: "Run" }]), { status: 200 });
r = await worker.fetch(req("/api/activities?after=1700000000&per_page=100&evil=../../etc/passwd", {
  headers: { Origin: ORIGIN, Authorization: "Bearer AT" },
}), env);
body = await r.json();
check("activities returns 200", r.status === 200);
check("wraps the list in {activities}", Array.isArray(body.activities) && body.activities[0].name === "Morning Run");
check("forwards the after param", calls[0].url.includes("after=1700000000"));
check("forwards per_page", calls[0].url.includes("per_page=100"));
check("drops unknown params", !calls[0].url.includes("evil"), calls[0].url);
check("forwards the caller's bearer token", calls[0].init.headers.Authorization === "Bearer AT");

r = await worker.fetch(req("/api/activities", { headers: { Origin: ORIGIN } }), env);
check("activities without a token is 401", r.status === 401 && (await r.json()).error === "missing_token");

r = await worker.fetch(req("/api/activities", { headers: { Origin: ORIGIN, Authorization: "Bearer" } }), env);
check("a malformed bearer header is 401", r.status === 401);

stub = async () => new Response("{}", { status: 401 });
r = await worker.fetch(req("/api/activities", { headers: { Origin: ORIGIN, Authorization: "Bearer stale" } }), env);
check("Strava 401 maps to needs_reauth", (await r.json()).error === "needs_reauth");

stub = async () => new Response("{}", { status: 429 });
r = await worker.fetch(req("/api/activities", { headers: { Origin: ORIGIN, Authorization: "Bearer AT" } }), env);
check("Strava 429 maps to rate_limited", r.status === 429 && (await r.json()).error === "rate_limited");

// --- routing -------------------------------------------------------------
r = await worker.fetch(req("/nope", { headers: { Origin: ORIGIN } }), env);
check("unknown route is 404", r.status === 404);
r = await worker.fetch(req("/api/activities", { method: "POST", headers: { Origin: ORIGIN, Authorization: "Bearer AT" } }), env);
check("wrong method on a real route is 404", r.status === 404);
stub = async () => new Response(JSON.stringify({ access_token: "AT" }), { status: 200 });
r = await worker.fetch(req("/auth/token/", {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ code: "c" }),
}), env);
check("trailing slash still routes", r.status === 200);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
