# Project A: Ashport

An indirect management game set in a fictional American city during Prohibition.
You are the boss of a crime family. You never act yourself: you choose which
lieutenants run which districts, and they act their own way.

## Layout

- `web/district.js` holds the rules of a district: the boss only names a capo and the capo runs his district (hiring, places, crews, laundering, police). It covers liquor, gambling, cannabis, brothels, chop shops, fences, loan offices, union locals and laundering. `web/world.js` holds the map: six cities, their districts, the routes between them, the three seats at the boss's table, underbosses who name the capos of their city, rival families that attack the weakest district, and `view(world)` for the future map. `web/game.js` is what a screen talks to: `tick` for time (with pause and speed), `command` for the boss's orders, `hud`, `view`, `journal`, `candidates` and `openings` to draw, `trips` (what moves on the map this month: liquor trucks, takings, laundering, the boss's cut, crews, works, raids, attacks, each with its flow) and `flows` (a district's chain in figures: made, stock, sold, earned, washed, sent up), `save` and `load`. In a page, load `district.js`, `world.js` and `game.js` in that order. `npm run simulate` plays every capo over five years and prints a report. Tests are in `tests/district.test.js`, `tests/world.test.js` and `tests/game.test.js`; they run without a browser.
- `web/index.html` and `web/ui.js` are the page: the top bar, the sheets and the journal. They show what `game.js` says and pass the boss's orders back. No rule lives there.
- `web/mapview.js` works out what the 3D map has to draw from the state of the game: cities made of blocks, districts, a building on every lot, the family's places with their signs, a car with a route along the streets for every trip in `AshportGame.trips(g)` (liquor, takings, laundering, crews sent out, rivals, police), and fire, gunfire and police lights for the month's events. It draws nothing, so it is tested without a browser in `tests/mapview.test.js`.
- `render/` is the 3D map itself (Three.js): `scene.js` draws the plan made by `mapview.js`, `era.js` builds the 1920s buildings by code, `models.js` holds the few free models still in use (KayKit City Builder Bits, CC0). `npm run build` bundles it into `web/render.js`, which is committed so that the page still opens straight from the file and the Android app needs no build. Run it after any change in `render/`; the tests fail if the bundle is stale.
- `tests/playthrough.mjs` is the integration test: in a real browser it names the first capo, plays two years, moves into a second district by touching the map, and reloads the saved game. `node tests/playthrough.mjs some/folder` also keeps a screenshot of each step.
- `.github/workflows/test.yml` runs both on every push to `main` and on every pull request.
- `android/` is the Android app: one screen that shows `web/`. It holds no game code.
- `.github/workflows/apk.yml` builds the APK on every pull request, and publishes it as a release on every push to `main`.

## Working on the game

Rules are written test first: add a failing test to the matching file in `tests/`
that describes the new rule, watch it fail, then change the rule file until it passes.
A rule never goes into `index.html`.

    npm install
    npm run test:unit         # rules only, under a second
    npm test                  # rules, then a full year in a browser

## Status

First playable slice of the new game: a 3D map of six cities and 41 districts,
time that runs with pause and speed, capos named by touching a district, their
places and their troubles shown on the map, a journal, and a saved game.

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
