// The pace of the picture. A strategy map gains nothing past 60 images a second, and a 120 Hz phone that draws
// 120 works twice as hard and runs twice as hot for it: an image is due only once a sixtieth of a second has
// passed since the last one (less a small slack, so that a 60 Hz screen whose beat wobbles keeps every image).
export const CAP = 60;
const STEP = 1000 / CAP, SLACK = 2;
export function due(now, last) { return now - last >= STEP - SLACK; }
