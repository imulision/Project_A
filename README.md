# Project A: Ashport

An indirect management game set in a fictional American city during Prohibition.
You are the boss of a crime family. You never act yourself: you choose which
lieutenants run which districts, and they act their own way.

## Layout

- `web/sim.js` holds the rules of the game: months, districts, lieutenants, money, events. It knows nothing about the screen.
- `web/district.js` holds the rules of the next version, where the boss only names a capo and the capo runs his district (hiring, places, crews, laundering, police). The page does not use it yet. `npm run simulate` plays every capo over five years and prints a report. Tests are in `tests/district.test.js`.
- `web/index.html` is the page. It draws the state held by `sim.js` and passes the player's answers back to it. There is no build step: open the file in a browser to play.
- `tests/sim.test.js` holds the unit tests of the rules. They run without a browser.
- `tests/playthrough.mjs` is the integration test: it plays a full in-game year in a real browser.
- `.github/workflows/test.yml` runs both on every push to `main` and on every pull request.
- `android/` is the Android app: one screen that shows `web/`. It holds no game code.
- `.github/workflows/apk.yml` builds the APK on every pull request, and publishes it as a release on every push to `main`.

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

## Android app

Every push to `main` publishes a release with `ashport.apk` and `web.zip`.
Install the APK once. At each launch the app asks GitHub for the latest release
and, if it is newer, downloads `web.zip` and plays that from then on. A new APK
is only needed when the shell in `android/` itself changes.

The download logic is in `GameBundle.java` and `UpdateCheck.java`, plain Java
tested in `android/app/src/test`. A failed or broken download never replaces
the game already on the phone.

All builds are signed with `android/prototype.keystore`, whose password is in
`android/app/build.gradle`. That is deliberate: Android refuses an update signed
with a different key. The repository is public, so anyone can read this key:
only install the APK from the releases of this repository.
Replace it with a secret key before the game is given to anyone else.
