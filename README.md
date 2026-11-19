# Project A: Ashport

An indirect management game set in a fictional American city during Prohibition.
You are the boss of a crime family. You never act yourself: you choose which
lieutenants run which districts, and they act their own way.

## Layout

- `web/` is the game, as a plain web page with no build step. Open `web/index.html` in a browser to play.
- `tests/playthrough.mjs` is the integration test: it plays a full in-game year in a real browser. Run it with `npm install && npm test`.
- `.github/workflows/test.yml` runs that test on every push and pull request.
- `.github/workflows/pages.yml` publishes `web/` to GitHub Pages on every push to `main`.

## Status

Playable prototype of one in-game year (1926): isometric city map, lieutenants
with a quality, a flaw and a plan, monthly income, scripted events.

An Android APK built from the same code is planned.
