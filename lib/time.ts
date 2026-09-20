import { addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export function normalizeTimezone(timezone: string | undefined) {
  const candidate = timezone?.trim() || "Asia/Shanghai";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return "Asia/Shanghai";
  }
}

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
