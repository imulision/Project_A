// The pace of the picture. A strategy map gains nothing past 60 images a second, and a 120 Hz phone that draws
// 120 works twice as hard and runs twice as hot for it: an image is due only once a sixtieth of a second has
// passed since the last one (less a small slack, so that a 60 Hz screen whose beat wobbles keeps every image).
export const CAP = 60;
const STEP = 1000 / CAP, SLACK = 2;
export function due(now, last) { return now - last >= STEP - SLACK; }

// pacer(): the same cap, kept by the time the next image is due rather than the time since the last one. A 90 Hz
// screen beats every 11 ms: "16 ms since the last" would draw one beat out of two (45 images), the pacer draws two
// out of three (60). After a stall it starts again from now, never drawing a burst to catch up.
export function pacer() {
  let next = -Infinity;
  return now => { if (now < next - SLACK) return false; next = Math.max(next + STEP, now); return true; };
}

// The resolution follows the phone. Three slow seconds in a row (under 40 images) lower it a step; one slow second,
// a city being built, does nothing. Fifteen easy seconds (55 and more) raise it a step again, though not to a step
// that was found slow in the last three minutes. It never goes under FLOOR: under it the map looks pixelated.
export const FLOOR = 1.5;
const SLOW = 40, EASY = 55, STEP_PR = 0.25, SLOW_S = 3, EASY_S = 15, BAN_MS = 180000;
export const quality = {
  start: top => ({ pr: top, top, slow: 0, easy: 0, banned: Infinity, until: 0 }),
  tick(q, fps, now) {
    const slow = fps < SLOW ? q.slow + 1 : 0, easy = fps >= EASY ? q.easy + 1 : 0;
    if (slow >= SLOW_S && q.pr > FLOOR) return { ...q, pr: Math.max(FLOOR, q.pr - STEP_PR), slow: 0, easy: 0, banned: q.pr, until: now + BAN_MS };
    if (easy >= EASY_S && q.pr < q.top) {
      const up = Math.min(q.top, q.pr + STEP_PR);
      if (up < q.banned || now >= q.until) return { ...q, pr: up, slow: 0, easy: 0, banned: now >= q.until ? Infinity : q.banned };
    }
    return { ...q, slow, easy };
  },
};

// streetClock(): the days of the game as the streets drive them. They run with the frames at the pace the boss chose, never more
// than one beat ahead of the rules (a sheet open stops the rules, so the cars wait too), and a beat that finds them behind (frames
// slower than a twentieth of a second, a page left in the background) brings them to its day at once: a car is where the rules say.
// beat(day, span): the rules are at `day`, and the next beat is `span` days on. frame(dt, pace, free): free runs past the beat.
export function streetClock() {
  let day = 0, until = 1, last = -Infinity;
  return {
    now: () => day,
    beat(d, span) { if (day < d || d < last) day = d; last = d; until = Math.max(day, d + (span || 1)); },      /* (a day before the last beat: a new game) */
    frame(dt, pace, free) { day += dt * pace; if (!free && day > until) day = until; if (free) until = Math.max(until, day); return day; },
  };
}
