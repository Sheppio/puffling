# The Strava token-exchange proxy

Puffling is a static page. Strava's OAuth token exchange needs a **client secret**, and a static page has nowhere
to keep one — anything shipped to the browser is public. This Worker is the smallest thing that closes that gap.

It holds the secret and does three jobs:

| Route | Does |
|---|---|
| `POST /auth/token` | Swaps an authorization code for an access + refresh token |
| `POST /auth/refresh` | Swaps a refresh token for a fresh pair |
| `GET /api/activities` | Proxies the activity list, using a Bearer token the caller supplies |

Activities go through the Worker rather than straight from the browser so there's one code path and no dependence
on Strava's CORS headers.

## What this does and doesn't protect

**The client secret never reaches the browser.** That's the point, and it's the thing that actually matters — a
leaked secret lets anyone impersonate your Strava application.

**Access and refresh tokens do reach the browser**, and the page keeps them in `localStorage`. Anything that can
run JavaScript on your origin can read them. For a single-user hobby page on its own domain that's a reasonable
trade; if you ever host this for other people, move to an `HttpOnly` session cookie with the tokens in Workers KV,
keyed by an opaque session ID.

**The Worker refuses any origin not on its allowlist**, so finding the URL isn't enough to use it as a general
Strava proxy. It does not rate-limit per user — Strava's limits are per *application*, so one busy fork can spend
the quota for everyone sharing a client ID. Since the intended model is one fork, one Strava app, that's fine.

## Setting it up

**1. Register a Strava application** at https://www.strava.com/settings/api

Set **Authorization Callback Domain** to the bare host you serve the page from — no scheme, no path:

```
sheppio.github.io
```

Note the **Client ID** and **Client Secret**.

**2. Configure and deploy the Worker**

```sh
cd worker
npm install -g wrangler        # if you haven't got it
wrangler login
```

Edit `wrangler.toml` — set `STRAVA_CLIENT_ID`, and list every origin the page is served from in
`ALLOWED_ORIGINS` (scheme included, comma separated). Then put the secret in and ship it:

```sh
wrangler secret put STRAVA_CLIENT_SECRET     # paste when prompted
wrangler deploy
```

Deploy prints the Worker's URL, e.g. `https://puffling-strava.your-name.workers.dev`.

**3. Point the page at it** — edit `config.js` in the repository root:

```js
window.PUFFLING_CONFIG = {
  stravaClientId: "12345",
  workerUrl: "https://puffling-strava.your-name.workers.dev"
};
```

`stravaClientId` must match `STRAVA_CLIENT_ID` in `wrangler.toml`. Commit, push, and the page can read your Strava.

## Tests

No dependencies and no network — Strava is stubbed.

```sh
node worker/test/worker.test.mjs
```

Covers origin gating, both grant types, the secret never being echoed back, parameter filtering on the proxy
route, and how upstream failures map to error codes the page knows how to explain.

## When it doesn't work

| The page says | What's wrong |
|---|---|
| *The Worker refuses requests from …* | That origin isn't in `ALLOWED_ORIGINS`. Add it, `wrangler deploy` again. |
| *The Worker is missing its Strava client ID or secret* | `wrangler secret put STRAVA_CLIENT_SECRET`, and check `STRAVA_CLIENT_ID` in `wrangler.toml`. |
| *Strava turned the sign-in down* | Usually the Authorization Callback Domain doesn't match the host serving the page, or the client ID in `config.js` and `wrangler.toml` disagree. |
| *Strava has signed you out* | The refresh token was revoked — at https://www.strava.com/settings/apps, or by changing your password. Connect again. |
| *Strava's rate limit has been hit* | 100 requests per 15 minutes, 1000 per day, per application. The page only reads every five minutes, so this usually means something else is sharing the client ID. |

`wrangler tail` streams live logs if you need to see what the Worker actually returned.
