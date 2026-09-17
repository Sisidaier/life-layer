import { addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export function tomorrowAt(hour: number, minute: number, timezone: string, now = new Date()) {
  const localNow = toZonedTime(now, timezone);
  const localTomorrow = addDays(localNow, 1);
  const wallClock = new Date(
    localTomorrow.getFullYear(),
    localTomorrow.getMonth(),
    localTomorrow.getDate(),
    hour,
    minute,
    0,
    0,
  );
  return fromZonedTime(wallClock, timezone);
}
