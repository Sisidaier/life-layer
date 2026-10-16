ObjC.import("Foundation");
ObjC.import("EventKit");

function readJson(path) {
  const text = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
  return JSON.parse(ObjC.unwrap(text));
}

function nsDate(value) {
  return $.NSDate.dateWithTimeIntervalSince1970(new Date(value).getTime() / 1000);
}

function isoDate(value) {
  return new Date(Number(value.timeIntervalSince1970) * 1000).toISOString();
}

function hasCalendarAccess(store) {
  const current = Number($.EKEventStore.authorizationStatusForEntityType(0));
  if (current === 3) return true;
  if (current !== 0 && current !== 4) return false;

  let finished = false;
  let granted = false;
  const completion = ObjC.block("void", ["bool", "id"], (allowed) => {
    granted = Boolean(allowed);
    finished = true;
  });
  store.requestFullAccessToEventsWithCompletion(completion);
  const runLoop = $.NSRunLoop.currentRunLoop;
  const deadline = Date.now() + 20000;
  while (!finished && Date.now() < deadline) {
    runLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.05));
  }
  return Number($.EKEventStore.authorizationStatusForEntityType(0)) === 3 || (finished && granted);
}

function run(argv) {
  try {
    const payload = readJson(argv[0]);
    const items = payload.items;
    const allowedNames = new Set(payload.calendarNames || []);
    const store = $.EKEventStore.alloc.init;
    if (!hasCalendarAccess(store)) {
      return JSON.stringify({ ok: false, message: "请在系统设置的隐私与安全性中允许 Calendar 访问" });
    }
    if (items.length === 0) return JSON.stringify({ ok: true, conflicts: [] });

    const calendars = store.calendarsForEntityType(0);
    const selectedCalendars = $.NSMutableArray.alloc.init;
    for (let index = 0; index < calendars.count; index += 1) {
      const calendar = calendars.objectAtIndex(index);
      const calendarName = ObjC.unwrap(calendar.title);
      if (calendar.allowsContentModifications && allowedNames.has(calendarName)) selectedCalendars.addObject(calendar);
    }
    if (selectedCalendars.count === 0) return JSON.stringify({ ok: true, conflicts: [] });

    const earliest = items.reduce((value, item) => new Date(item.startAt) < value ? new Date(item.startAt) : value, new Date(items[0].startAt));
    const latest = items.reduce((value, item) => new Date(item.endAt) > value ? new Date(item.endAt) : value, new Date(items[0].endAt));
    const predicate = store.predicateForEventsWithStartDateEndDateCalendars(nsDate(earliest), nsDate(latest), selectedCalendars);
    const events = store.eventsMatchingPredicate(predicate);
    const conflicts = [];
    for (let eventIndex = 0; eventIndex < events.count; eventIndex += 1) {
      const event = events.objectAtIndex(eventIndex);
      const eventStart = new Date(isoDate(event.startDate));
      const eventEnd = new Date(isoDate(event.endDate));
      for (const item of items) {
        const itemStart = new Date(item.startAt);
        const itemEnd = new Date(item.endAt);
        if (!(eventStart < itemEnd && itemStart < eventEnd)) continue;
        conflicts.push({
          itemId: item.id,
          title: ObjC.unwrap(event.title) || "未命名日程",
          startAt: eventStart.toISOString(),
          endAt: eventEnd.toISOString(),
          calendarName: ObjC.unwrap(event.calendar.title),
        });
      }
    }
    return JSON.stringify({ ok: true, conflicts });
  } catch (error) {
    return JSON.stringify({ ok: false, message: String(error.message || error) });
  }
}
