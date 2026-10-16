import { describe, expect, it } from "vitest";
import { classifyCalendar, classifyCalendarBatch, classifyCalendarByRules } from "./calendar-classifier";

const calendars = ["个人", "运动", "工作", "学习", "娱乐", "大麦"];

describe("calendar category classifier", () => {
  it("uses an explicitly named calendar", () => {
    expect(classifyCalendarByRules("放到学习日历，明晚读书", calendars)).toBe("学习");
  });

  it("classifies exercise, work, and study events", () => {
    expect(classifyCalendarByRules("明天下班后去游泳", calendars)).toBe("运动");
    expect(classifyCalendarByRules("周三下午和客户开会", calendars)).toBe("工作");
    expect(classifyCalendarByRules("周日复习考试内容", calendars)).toBe("学习");
  });

  it("does not invent a category", () => {
    expect(classifyCalendarByRules("明晚处理一件事情", calendars)).toBeNull();
  });

  it("falls back to the personal calendar when AI classification is unavailable", async () => {
    expect(await classifyCalendar("明晚处理一件事情", "处理事情", calendars)).toBe("个人");
  });

  it("classifies a whole batch locally when rules are sufficient", async () => {
    const result = await classifyCalendarBatch([
      { id: "swim", text: "游泳", title: "游泳" },
      { id: "movie", text: "看电影", title: "看电影" },
    ], calendars);
    expect(result.get("swim")).toBe("运动");
    expect(result.get("movie")).toBe("娱乐");
  });
});
