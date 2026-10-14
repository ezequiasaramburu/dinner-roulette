/**
 * Converting a wall-clock time in one timezone to the hour and minute on this device's clock.
 *
 * The couple's reveal time ("17:00") is in the couple's timezone, but a notification is scheduled on the phone, in the
 * phone's own timezone. They differ when the phone is travelling or the partners live apart, and the gap changes with
 * daylight saving, so this is worked out for today's date and redone whenever the app opens.
 * Pure functions, no React Native imports, so they run under plain Node in the tests.
 */

type Wall = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** The date and time on the wall clock of `timeZone` at the instant `date`. */
function wallClock(date: Date, timeZone: string): Wall {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** How far ahead of UTC the wall clock of `timeZone` is at the instant `date`, in milliseconds. */
function offsetMs(date: Date, timeZone: string): number {
  const w = wallClock(date, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Today's occurrence of `time` ("HH:MM") on the wall clock of `timeZone`, as the hour and minute it is on this
 * device's clock at that same instant. Example: 17:00 in Rome is 12:00 in Buenos Aires.
 */
export function timeInZoneToLocal(
  time: string,
  timeZone: string,
  now: Date = new Date(),
): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  const today = wallClock(now, timeZone);
  const wallAsUtc = Date.UTC(today.year, today.month - 1, today.day, hour, minute);

  // The offset depends on the instant we are looking for, so settle on it in two passes (handles daylight saving).
  let instant = wallAsUtc - offsetMs(new Date(wallAsUtc), timeZone);
  instant = wallAsUtc - offsetMs(new Date(instant), timeZone);

  const local = new Date(instant);
  return { hour: local.getHours(), minute: local.getMinutes() };
}
