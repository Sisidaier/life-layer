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
    const names = app
      .calendars()
      .filter((calendar) => get(calendar, "writable", false))
      .map((calendar) => String(get(calendar, "name", "")).trim())
      .filter(Boolean);
    return JSON.stringify({ ok: true, names });
  } catch (error) {
    return JSON.stringify({ ok: false, message: String(error.message || error) });
  }
}
