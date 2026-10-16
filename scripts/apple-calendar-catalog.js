function get(object, key, fallback) {
  try {
    const value = object[key]();
    return value === undefined || value === null ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

function run() {
  try {
    const app = Application("Calendar");
    const calendars = app
      .calendars()
      .filter((calendar) => get(calendar, "writable", false))
      .map((calendar) => ({
        name: String(get(calendar, "name", "")).trim(),
        color: String(get(calendar, "color", "")),
      }))
      .filter((calendar) => Boolean(calendar.name));
    return JSON.stringify({ ok: true, calendars });
  } catch (error) {
    return JSON.stringify({ ok: false, message: String(error.message || error) });
  }
}
