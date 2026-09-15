/**
 * Fork-local settings. This file is the only thing you should need to edit
 * in the page to point Puffling at your own Strava application.
 *
 * Leave both blank and the page still runs — the pet just hatches, starves
 * and dies with nothing to feed it.
 *
 * Both values are public. The client SECRET never appears here; it lives in
 * the Cloudflare Worker. See worker/README.md.
 */
window.PUFFLING_CONFIG = {
  // From https://www.strava.com/settings/api
  stravaClientId: "",

  // Your deployed Worker, no trailing slash, e.g.
  // "https://puffling-strava.your-name.workers.dev"
  workerUrl: ""
};
