import type { Availability } from "./types";
import { WEEKDAYS } from "./constants";

export const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Offset of a timezone from UTC in minutes at a given moment. */
function offsetMinutes(timeZone: string, at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** "8:15 PM CDT" — the current time where they are. */
export function localTimeIn(timeZone: string, at = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" })
    .format(at);
}

/** "Same time as you" / "2 hrs ahead of you" / "1 hr behind you". */
export function relativeToMe(theirZone: string, myZone = deviceTimezone(), at = new Date()) {
  const diff = offsetMinutes(theirZone, at) - offsetMinutes(myZone, at);
  if (diff === 0) return "Same time as you";
  const hrs = Math.abs(diff) / 60;
  const amount = Number.isInteger(hrs) ? `${hrs} hr${hrs === 1 ? "" : "s"}` : `${hrs.toFixed(1)} hrs`;
  return `${amount} ${diff > 0 ? "ahead of" : "behind"} you`;
}

export function minutesToClock(m: number) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === 0 ? `${h12} ${suffix}` : `${h12}:${String(min).padStart(2, "0")} ${suffix}`;
}

/**
 * Converts someone's weekly availability (stored in their timezone) into the
 * viewer's timezone so "Fri 7–10 PM" means the same thing to both people.
 */
export function availabilityInMyZone(slots: Availability[], theirZone: string, myZone = deviceTimezone()) {
  const shift = offsetMinutes(myZone) - offsetMinutes(theirZone);
  const week = 7 * 1440;
  return slots.map((s) => {
    const start = (((s.weekday * 1440 + s.start_minute + shift) % week) + week) % week;
    const length = s.end_minute - s.start_minute;
    return { weekday: Math.floor(start / 1440), start_minute: start % 1440, end_minute: (start % 1440) + length };
  });
}

export function describeSlot(s: Availability) {
  return `${WEEKDAYS[s.weekday]} ${minutesToClock(s.start_minute)}–${minutesToClock(s.end_minute)}`;
}
