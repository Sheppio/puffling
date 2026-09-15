# Puffling

A pocket seabird that lives on your training. Every session you log feeds it. Every quiet day costs it.

It is one self-contained HTML file: a Tamagotchi-shaped LCD device, pixel sprites drawn in code, and a hunger
simulation that runs off your actual activity history. There is no build step, no bundler and no framework.

**Live site:** https://sheppio.github.io/puffling/

---

## How it eats

| | |
|---|---|
| **Food** | Each activity feeds it. Portion size follows relative effort at 1.3 points per effort point, capped at 55 so one epic day can't bank a month. |
| **Hunger** | It burns 12.5 points a day. From full, that's eight days of nothing before it's gone. |
| **Rest** | Anything over 70 effort earns a 24-hour recovery window with no hunger at all. Hard days are meant to be followed by easy ones. |
| **Growth** | Egg → Hatchling → Sprog → Teen → Adult, on age alone. Its shape comes from whatever you do most: runner, roller, swimmer, lifter or wanderer. |

Roughly three moderate sessions a week holds the line.

Health is never stored. It is recomputed from your activity history on every load, hour by hour from the pet's
birth to now. So there is nothing to fudge, and the pet keeps living — or dying — while the tab is closed.

## The four screens

`FEED` re-reads your activity feed. `SCREEN` cycles. `CARE` renames the pet, or buries it and starts a fresh egg.

- **HOME** — the pet, its name, five hearts, and how long it has left.
- **VITALS** — health, mood, stage, form, age, meal count, burn rate.
- **MEALS** — the last ten things that fed it, with the points each one was worth.
- **GRAVE** — everything you have let starve so far.

## Connecting Strava

Puffling runs in two places, and they get their data differently.

**Inside a Claude session** it reads Strava through the account's own connector. Nothing to configure.

**Anywhere else** — GitHub Pages included — it does OAuth itself. That needs a **client secret** for the token
exchange, and a static page has nowhere to keep one: anything shipped to the browser is public. So there's a small
Cloudflare Worker in `worker/` that holds the secret and does nothing else.

Out of the box `config.js` is blank, so the published page has nothing to feed the pet — it hatches, starves and
dies on schedule, which is a working demonstration of starvation and not much else. To wire it up:

1. Register a Strava application at https://www.strava.com/settings/api
2. Deploy the Worker with your client secret
3. Put your client ID and the Worker's URL in `config.js`

**Full instructions, including what this does and doesn't protect: [`worker/README.md`](worker/README.md).**

Once connected the page stores your tokens in `localStorage`, refreshes them when they expire, and re-reads your
activity every five minutes. Press `FEED` to check immediately, or `Disconnect` to forget the tokens.

### Why not just ship a hosted version?

New Strava API applications are limited to a single athlete until you request an increase, so the honest
distribution model is "clone this and register your own app" rather than a site people sign into. Sidesteps the
approval queue entirely.

Worth remembering: Strava is already the aggregator. Garmin, Samsung Health and Apple Watch all push into it, so
supporting all three is one line telling people to connect their device to Strava first.

For people with no Strava account at all, file import (`.fit`/`.gpx`/`.tcx`, Apple Health and Garmin exports
through a file picker) needs no API, no approval and no secret. See `TODO.md`.

## Running it locally

```sh
git clone https://github.com/Sheppio/puffling.git
cd puffling
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight off the filesystem works too — there is nothing to
build and nothing to serve. Pet state falls back to `localStorage`, so it persists per browser.

To test the Strava connection locally, add `http://localhost:8000` to `ALLOWED_ORIGINS` in `worker/wrangler.toml`
and redeploy. The Worker's own tests need neither network nor credentials:

```sh
node worker/test/worker.test.mjs
```

## Deploying

`.github/workflows/pages.yml` publishes the repository root to GitHub Pages on every push to `main`. There is one
manual step, once per clone: **Settings → Pages → Build and deployment → Source → GitHub Actions**. The workflow
cannot do this for you — the Actions token is not permitted to create a Pages site — and every run fails until it
is set. After that, pushing to `main` deploys.

## Not affiliated with Strava

Puffling is an independent project. It is not created by, affiliated with, or supported by Strava. The Strava
name is used only to say what the thing reads.

## Licence

MIT. See `LICENSE`.
