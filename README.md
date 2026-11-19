# Project A: Ashport

An indirect management game set in a fictional American city during Prohibition.
You are the boss of a crime family. You never act yourself: you choose which
lieutenants run which districts, and they act their own way.

## Layout

- `web/sim.js` holds the rules of the game: months, districts, lieutenants, money, events. It knows nothing about the screen.
- `web/index.html` is the page. It draws the state held by `sim.js` and passes the player's answers back to it. There is no build step: open the file in a browser to play.
- `tests/sim.test.js` holds the unit tests of the rules. They run without a browser.
- `tests/playthrough.mjs` is the integration test: it plays a full in-game year in a real browser.
- `.github/workflows/test.yml` runs both on every push to `main` and on every pull request.

## Working on the game

Rules are written test first: add a failing test to `tests/sim.test.js` that
describes the new rule, watch it fail, then change `web/sim.js` until it passes.
A rule never goes into `index.html`.

    npm install
    npm run test:unit         # rules only, under a second
    npm test                  # rules, then a full year in a browser

## Status

Playable prototype of one in-game year (1926): isometric city map, lieutenants
with a quality, a flaw and a plan, monthly income, scripted events.

An Android APK built from the same code is planned.
