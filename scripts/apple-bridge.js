ObjC.import("Foundation");

function readJson(path) {
  const text = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
  return JSON.parse(ObjC.unwrap(text));
}

function get(object, key, fallback) {
  try {
    const resolved = object[key]();
    return resolved === undefined || resolved === null ? fallback : resolved;
  } catch (_) {
    return fallback;
  }
}

function named(collection, name) {
  if (!name) return null;
  for (const item of collection) if (get(item, "name", "") === name) return item;
  return null;
}

function calendarTarget(app, preferredName) {
  const calendars = app.calendars();
  const preferred = named(calendars, preferredName);
  if (preferred && get(preferred, "writable", false)) return preferred;
  for (const calendar of calendars) if (get(calendar, "writable", false)) return calendar;
  throw new Error("没有找到可写的 Calendar");
}

function reminderTarget(app, preferredName) {
  return named(app.lists(), preferredName) || app.defaultList();
}

function calendarMatches(app, action, preferredName) {
  const calendars = preferredName ? [calendarTarget(app, preferredName)] : app.calendars();
  const query = (action.query || action.title || "").toLowerCase();
  const matches = [];
  for (const calendar of calendars) {
    if (!get(calendar, "writable", false)) continue;
    for (const event of calendar.events()) {
      const uid = String(get(event, "uid", get(event, "id", "")));
      const summary = String(get(event, "summary", ""));
      if ((action.externalId && uid === action.externalId) || (!action.externalId && query && summary.toLowerCase().includes(query))) {
        matches.push({ event, uid, summary });
      }
    }
  }
  return matches;
}

function reminderMatches(app, action, preferredName) {
  const lists = preferredName ? [reminderTarget(app, preferredName)] : app.lists();
  const query = (action.query || action.title || "").toLowerCase();
  const matches = [];
  for (const list of lists) {
    for (const reminder of list.reminders()) {
      const id = String(get(reminder, "id", ""));
      const name = String(get(reminder, "name", ""));
      if ((action.externalId && id === action.externalId) || (!action.externalId && query && name.toLowerCase().includes(query))) {
        matches.push({ reminder, id, name });
      }
    }
  }
  return matches;
}

function executeCalendar(payload) {
  const app = Application("Calendar");
  const action = payload.action;
  if (action.operation === "create") {
    const calendar = calendarTarget(app, payload.calendarName);
    const event = app.Event({
      summary: action.title,
      startDate: new Date(action.startAt),
      endDate: new Date(action.endAt),
      allDayEvent: action.allDay,
      location: action.location || "",
      description: action.notes || "Created by Life Layer",
    });
    calendar.events.push(event);
    const externalId = String(get(event, "uid", get(event, "id", "")));
    return {
      ok: true,
      externalId,
      message: `已写入 Apple Calendar · ${get(calendar, "name", "")}`,
      item: { title: action.title, startAt: action.startAt, endAt: action.endAt, calendar: get(calendar, "name", "") },
    };
  }

  const matches = calendarMatches(app, action, payload.calendarName);
  if (action.operation === "query") {
    return { ok: true, message: `找到 ${matches.length} 个日历事件`, item: { matches: matches.map((match) => ({ externalId: match.uid, title: match.summary })) } };
  }
  if (matches.length !== 1) throw new Error(`需要唯一匹配的日历事件，当前找到 ${matches.length} 个`);
  const match = matches[0];
  if (action.operation === "update") {
    if (action.title) match.event.summary = action.title;
    if (action.startAt) match.event.startDate = new Date(action.startAt);
    if (action.endAt) match.event.endDate = new Date(action.endAt);
    if (action.location !== null) match.event.location = action.location || "";
    if (action.notes !== null) match.event.description = action.notes || "";
    return { ok: true, externalId: match.uid, message: "已更新 Apple Calendar 事件" };
  }
  app.delete(match.event);
  return { ok: true, externalId: match.uid, message: "已删除 Apple Calendar 事件" };
}

function executeReminder(payload) {
  const app = Application("Reminders");
  const action = payload.action;
  if (action.operation === "create") {
    const list = reminderTarget(app, payload.remindersListName);
    const properties = { name: action.title, body: action.notes || "Created by Life Layer" };
    if (action.dueAt) properties.dueDate = new Date(action.dueAt);
    const reminder = app.Reminder(properties);
    list.reminders.push(reminder);
    const externalId = String(get(reminder, "id", ""));
    return { ok: true, externalId, message: `已写入 Apple Reminders · ${get(list, "name", "")}` };
  }

  const matches = reminderMatches(app, action, payload.remindersListName);
  if (action.operation === "query") {
    return { ok: true, message: `找到 ${matches.length} 个提醒事项`, item: { matches: matches.map((match) => ({ externalId: match.id, title: match.name })) } };
  }
  if (matches.length !== 1) throw new Error(`需要唯一匹配的提醒事项，当前找到 ${matches.length} 个`);
  const match = matches[0];
  if (action.operation === "update") {
    if (action.title) match.reminder.name = action.title;
    if (action.dueAt) match.reminder.dueDate = new Date(action.dueAt);
    if (action.notes !== null) match.reminder.body = action.notes || "";
    return { ok: true, externalId: match.id, message: "已更新 Apple Reminder" };
  }
  app.delete(match.reminder);
  return { ok: true, externalId: match.id, message: "已删除 Apple Reminder" };
}

function run(argv) {
  try {
    const payload = readJson(argv[0]);
    return JSON.stringify(payload.action.kind === "calendar" ? executeCalendar(payload) : executeReminder(payload));
  } catch (error) {
    return JSON.stringify({ ok: false, message: String(error.message || error) });
  }
}
