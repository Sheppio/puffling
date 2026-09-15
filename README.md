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

## Feeding it outside Claude

This page was built to run inside a Claude session, where it reads Strava through the account's own connector and
keeps the pet's name and graveyard in session storage. **The GitHub Pages copy has neither.** The pet hatches, the
clock runs, and nothing ever feeds it — which is a working demonstration of starvation and not much else.

Making the published version actually read Strava is not just a matter of dropping in a client ID. Strava's OAuth
token exchange requires a client secret, and a static page has nowhere to keep one. The realistic options are:

1. **A tiny token-exchange proxy** — a Cloudflare Worker or Netlify function holding the secret, with Pages doing
   the rest. Keeps the site static and the secret off the client.
2. **Run it locally** — clone, register your own Strava app, and serve it from somewhere that can hold a secret.
3. **File import** — an Apple Health export, a Garmin Connect export, or loose `.fit`/`.gpx`/`.tcx` files through a
   file picker. No API, no approval, no server, and it works for people with no Strava account at all. See `TODO.md`.

New Strava API applications are also limited to a single athlete until you request an increase, so the honest
distribution model is "clone this and register your own app" rather than a hosted site people sign into.

Worth remembering: Strava is already the aggregator. Garmin, Samsung Health and Apple Watch all push into it.

## Running it locally

```sh
git clone https://github.com/Sheppio/puffling.git
cd puffling
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight off the filesystem works too — there is nothing to
serve. Pet state falls back to `localStorage`, so it persists per browser.

## Deploying

`.github/workflows/pages.yml` publishes the repository root to GitHub Pages on every push to `main`. It needs
Pages set to **Build and deployment → Source → GitHub Actions** in the repository settings; the workflow attempts
to switch that on itself the first time it runs.

## Not affiliated with Strava

Puffling is an independent project. It is not created by, affiliated with, or supported by Strava. The Strava
name is used only to say what the thing reads.

## Licence

MIT. See `LICENSE`.
