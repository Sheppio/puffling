# Puffling — TODO

A pocket seabird that lives on your training. Feeds on Strava activities, starves without them.

Current state: single self-contained HTML page, reads Strava through a Claude connector, stores pet state in `db` with a `localStorage` fallback. Health is recomputed from activity history on every load rather than stored, so there's nothing to fudge and the pet keeps living (or dying) while the tab is closed.

---

## Next up

- [ ] **Daily steps as maintenance food.** Steps offset hunger but never fill the pet, so walking alone can't keep it alive forever. Nothing below ~3,000 steps (desk day), scaling to a ceiling of ~12 points against the 12.5/day burn. 10,000 steps buys about nine points. Deliberately no goal ring and no failure state for walking less — it's a top-up, not a nag.
- [ ] **Manual step check-in.** Type the number off your phone's health widget. Honour system, three seconds, no API queue to join. Unblocks the whole steps mechanic today.
- [ ] **File import.** Apple Health export zip, Garmin Connect full export, individual `.fit` / `.gpx` / `.tcx` files. Works from a file picker with no API, no approval and no server. Makes the project useful to people with no Strava account.
- [ ] **Difficulty dial.** Current balance: 12.5 hp/day decay, gains at 1.3× relative effort capped at 55, 24h hunger-free recovery window after anything over 70 effort. Roughly three moderate sessions a week holds the line. Expose as a setting, or offer gentle/normal/cruel presets.

## Data sources

Ranked by whether a solo developer can actually ship them.

- [ ] **Fitbit.** Proper web API, daily steps, self-serve developer access, no partner approval. Best second integration by a distance.
- [ ] **Whoop / Polar / Oura.** Also give individual developers free documented access without a business review.
- [ ] **iOS Shortcuts → endpoint.** A Shortcut reads step count from Health and posts it on a daily automation trigger. No App Store, no review. Best Apple Health route that exists, but needs the self-hosted version — a published page can't receive incoming requests.
- [ ] **Health Connect (Android).** Unifies Samsung Health and everything else on-device. Needs a small companion app.
- [ ] **Garmin Connect.** Real cloud APIs (Activity API gives FIT/GPX/TCX, push-based to callback URLs, no polling endpoint). Free, but approval is restricted to business developers, so a hobby repo is an unpromising application. Meanwhile Garmin auto-syncs to Strava, which covers most of the need.
- [ ] **Aggregators (Terra / Rook / Vital).** One endpoint across Garmin, Fitbit, Apple, Samsung. Paid. Right answer if this ever becomes a product, overkill for a repo.

### Ruled out

- **Strava steps.** Step count is not available via the Strava API and never has been. Even in Strava's own app, steps only show on walks, hikes and (leaderboard-only) runs. Logging walks wouldn't fix it. Cadence × 2 × moving time is the usual workaround and doesn't match.
- **Apple HealthKit direct.** On-device only. No cloud, no web endpoint, no server API. Requires a native iOS app with the entitlement. No amount of cleverness gets a web page in.
- **Samsung Health direct.** Data SDK is an Android library reading the app on the phone. Developer mode no longer needs a partner request, but distribution does, and it's still an Android app rather than a web page.

**Worth remembering:** Strava is already the aggregator. Garmin, Samsung Health and Apple Watch all push into it. Supporting all three is one line in the README telling people to connect their device to Strava first.

## Game design

- [ ] **Different foods for different sports.** A long ride fattens the puffling visibly for a day; a swim changes its colour; intervals make it twitchy.
- [ ] **Species evolution refinements.** Currently picks a form from your dominant sport (runner, roller, swimmer, lifter, wanderer). Could branch further at the adult stage, or go hybrid for triathletes.
- [ ] **Streak rewards** that don't punish rest days, given the recovery window already exists.
- [ ] **Graveyard stats.** Longest-lived puffling, cause of death, a lifetime leaderboard.
- [ ] **Sound.** Tamagotchi beeps on feeding and death. Off by default.
- [ ] **Shareable card.** A small image of your puffling and its age, for the group chat.

## Shipping to GitHub

- [x] **Repo and Pages.** Published from the repository root by `.github/workflows/pages.yml` on every push to `main`. No build step.
- [x] **Licence.** MIT.
- [x] **README.** Written, but still wants **a GIF of the pet dying** — that's the whole pitch and it's the one thing missing.
- [ ] **Own Strava OAuth flow.** The current version reads Strava through a Claude connector, so the published page is fed by nothing at all. The blocker isn't the client ID, it's the secret: Strava's token exchange needs a client secret, and a static page has nowhere to keep one. Options, cheapest first:
  - [ ] **Token-exchange proxy.** A Cloudflare Worker or Netlify function holding the secret and doing nothing else. Pages stays static, the secret stays off the client. Roughly thirty lines.
  - [ ] **Local-only build.** Serve it from somewhere that can hold a secret, and treat the Pages copy as the shop window.
  - [ ] **Skip OAuth entirely** and land file import first (see above). No API, no approval, no secret, and it works for people with no Strava account.
- [ ] **Distribution model.** New Strava API apps start with a single-athlete limit and you request an increase, so the realistic model is "clone this, register your own Strava app, drop in your client ID" rather than a hosted site people sign into. Sidesteps the approval queue entirely.
- [ ] **Brand compliance.** Strava's guidelines say you must not use the Strava name in your application's name or imply endorsement. Puffling is clear, and the README now carries a not-affiliated line. Keep the brand orange (#FC4C02) for the "Connect with Strava" button only, and use the official OAuth authorize URLs.
