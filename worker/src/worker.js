/**
 * Puffling's Strava token-exchange proxy.
 *
 * A static page can't do Strava OAuth on its own: the token exchange needs a
 * client secret, and a page served from GitHub Pages has nowhere to keep one.
 * This Worker is the smallest thing that closes that gap. It holds the secret,
 * and it does three jobs:
 *
 *   POST /auth/token    { code }           -> swap an authorization code for tokens
 *   POST /auth/refresh  { refresh_token }  -> swap a refresh token for a fresh one
 *   GET  /api/activities                   -> proxy the activity list, Bearer token
 *                                             supplied by the caller
 *
 * Activities go through here rather than straight from the browser so there is
 * one code path and no dependence on Strava's CORS headers.
 *
 * The client secret is never returned to the browser. Access and refresh tokens
 * are, and the page keeps them in localStorage — see worker/README.md for what
 * that does and doesn't protect against.
 */

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API = "https://www.strava.com/api/v3";

/** Params we're willing to forward to Strava. Anything else is dropped. */
const ALLOWED_ACTIVITY_PARAMS = ["before", "after", "page", "per_page"];

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * CORS headers for `origin`, or null if this origin isn't on the allowlist.
 * Returning null is what makes the Worker refuse the request outright.
 */
function cors(origin, env) {
  const allowed = allowedOrigins(env);
  if (!origin || !allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign(
      { "Content-Type": "application/json", "Cache-Control": "no-store" },
      headers || {}
    ),
  });
}

/**
 * Shared shape for everything the page has to explain to a human.
 * `error` is a stable code; the page switches on it.
 */
function fail(code, message, status, headers) {
  return json({ error: code, message: message }, status || 400, headers);
}

/** Hand Strava a grant and return whatever tokens come back. */
async function exchange(env, grant, headers) {
  const body = new URLSearchParams(
    Object.assign(
      {
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
      },
      grant
    )
  );

  let res;
  try {
    res = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body,
    });
  } catch (e) {
    return fail("upstream_unreachable", "Couldn't reach Strava.", 502, headers);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return fail("bad_upstream_response", "Strava didn't answer with JSON.", 502, headers);
  }

  if (!res.ok) {
    // Strava's own message is the useful part here (bad code, expired code,
    // client_id/secret mismatch), so pass it through rather than flattening it.
    const detail =
      (data && data.message) ||
      (data && data.errors && JSON.stringify(data.errors)) ||
      "Strava rejected the exchange.";
    return fail("exchange_rejected", detail, res.status === 401 ? 401 : 400, headers);
  }

  // Deliberately partial: the client secret and anything else Strava sends
  // that the page has no use for stay here.
  return json(
    {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete: data.athlete
        ? {
            id: data.athlete.id,
            firstname: data.athlete.firstname,
            username: data.athlete.username,
          }
        : null,
    },
    200,
    headers
  );
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

async function handleToken(request, env, headers) {
  const body = await readJson(request);
  const code = body && body.code;
  if (!code) return fail("missing_code", "No authorization code was sent.", 400, headers);

  return exchange(
    env,
    { code: String(code), grant_type: "authorization_code" },
    headers
  );
}

async function handleRefresh(request, env, headers) {
  const body = await readJson(request);
  const token = body && body.refresh_token;
  if (!token) return fail("missing_refresh_token", "No refresh token was sent.", 400, headers);

  return exchange(
    env,
    { refresh_token: String(token), grant_type: "refresh_token" },
    headers
  );
}

async function handleActivities(request, env, headers) {
  const auth = request.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S/.test(auth)) {
    return fail("missing_token", "No access token was sent.", 401, headers);
  }

  const incoming = new URL(request.url).searchParams;
  const out = new URLSearchParams();
  for (const key of ALLOWED_ACTIVITY_PARAMS) {
    const value = incoming.get(key);
    if (value !== null && value !== "") out.set(key, value);
  }

  let res;
  try {
    res = await fetch(STRAVA_API + "/athlete/activities?" + out.toString(), {
      headers: { Authorization: auth },
    });
  } catch (e) {
    return fail("upstream_unreachable", "Couldn't reach Strava.", 502, headers);
  }

  if (res.status === 401) {
    return fail("needs_reauth", "Strava rejected the access token.", 401, headers);
  }
  if (res.status === 429) {
    // Strava's rate limit is per-application, so one busy fork can spend it for
    // everyone sharing that client ID.
    return fail("rate_limited", "Strava's rate limit has been hit.", 429, headers);
  }
  if (!res.ok) {
    return fail("upstream_error", "Strava returned " + res.status + ".", 502, headers);
  }

  const activities = await res.json();
  return json({ activities: activities }, 200, headers);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const headers = cors(origin, env);

    if (request.method === "OPTIONS") {
      return headers
        ? new Response(null, { status: 204, headers: headers })
        : new Response(null, { status: 403 });
    }

    // No allowlisted origin, no service. Keeps the Worker from becoming a
    // general-purpose Strava proxy for anyone who finds the URL.
    if (!headers) {
      return fail(
        "origin_not_allowed",
        "This Worker isn't configured to serve " + (origin || "requests without an Origin") + ".",
        403
      );
    }

    if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
      return fail(
        "worker_not_configured",
        "The Worker is missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET.",
        500,
        headers
      );
    }

    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    const post = request.method === "POST";
    const get = request.method === "GET";

    if (path === "/auth/token" && post) return handleToken(request, env, headers);
    if (path === "/auth/refresh" && post) return handleRefresh(request, env, headers);
    if (path === "/api/activities" && get) return handleActivities(request, env, headers);

    return fail("not_found", "No route for " + request.method + " " + path + ".", 404, headers);
  },
};
