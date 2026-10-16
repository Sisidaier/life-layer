import { spawn } from "node:child_process";
import path from "node:path";

const systemCalendarNames = new Set(["计划的提醒事项"]);
const cacheTtlMs = 5 * 60 * 1000;
export type WritableCalendar = { name: string; color: string | null };
let cachedCalendars: WritableCalendar[] | null = null;
let cachedAt = 0;

function uniqueUsableNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter((name) => name && !systemCalendarNames.has(name)))];
}

export function normalizeAppleColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) return value.slice(0, 7);
  const channels = value.split(",").map(Number);
  if (channels.length < 3 || channels.slice(0, 3).some((channel) => !Number.isFinite(channel))) return null;
  return `#${channels.slice(0, 3).map((channel) => Math.round(Math.max(0, Math.min(1, channel)) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function configuredCalendarNames() {
  const configured = process.env.LIFE_LAYER_CALENDAR_CATEGORIES
    ?.split(/[，,]/)
    .map((name) => name.trim())
    .filter(Boolean) ?? [];
  const fallback = process.env.LIFE_LAYER_DEFAULT_CALENDAR?.trim();
  return uniqueUsableNames(fallback ? [...configured, fallback] : configured);
}

export async function listWritableCalendars(): Promise<WritableCalendar[]> {
  if (cachedCalendars && Date.now() - cachedAt < cacheTtlMs) return cachedCalendars;
  if (process.platform !== "darwin" || process.env.LIFE_LAYER_BRIDGE !== "applescript") {
    return configuredCalendarNames().map((name) => ({ name, color: null }));
  }

  const scriptPath = path.join(process.cwd(), "scripts", "apple-calendar-catalog.js");
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn("osascript", ["-l", "JavaScript", scriptPath], { stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      let errorOutput = "";
      child.stdout.on("data", (chunk) => (output += String(chunk)));
      child.stderr.on("data", (chunk) => (errorOutput += String(chunk)));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve(output.trim());
        else reject(new Error(errorOutput.trim() || `osascript exited with ${code}`));
      });
    });
    const result = JSON.parse(stdout) as { ok?: boolean; calendars?: unknown; message?: string };
    if (!result.ok || !Array.isArray(result.calendars)) throw new Error(result.message || "无法读取 Calendar 分类");
    const entries = result.calendars
      .filter((entry): entry is { name: string; color?: unknown } => Boolean(entry) && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string")
      .map((entry) => ({ name: entry.name.trim(), color: normalizeAppleColor(entry.color) }));
    const allowedNames = new Set(uniqueUsableNames(entries.map((entry) => entry.name)));
    const calendars = entries.filter((entry, index) => allowedNames.has(entry.name) && entries.findIndex((candidate) => candidate.name === entry.name) === index);
    cachedCalendars = calendars;
    cachedAt = Date.now();
    return calendars;
  } catch {
    return configuredCalendarNames().map((name) => ({ name, color: null }));
  }
}

export async function listWritableCalendarNames(): Promise<string[]> {
  return (await listWritableCalendars()).map((calendar) => calendar.name);
}
