import { spawn } from "node:child_process";
import path from "node:path";

const systemCalendarNames = new Set(["计划的提醒事项"]);

function uniqueUsableNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter((name) => name && !systemCalendarNames.has(name)))];
}

export function configuredCalendarNames() {
  const configured = process.env.LIFE_LAYER_CALENDAR_CATEGORIES
    ?.split(/[，,]/)
    .map((name) => name.trim())
    .filter(Boolean) ?? [];
  const fallback = process.env.LIFE_LAYER_DEFAULT_CALENDAR?.trim();
  return uniqueUsableNames(fallback ? [...configured, fallback] : configured);
}

export async function listWritableCalendarNames(): Promise<string[]> {
  if (process.platform !== "darwin" || process.env.LIFE_LAYER_BRIDGE !== "applescript") {
    return configuredCalendarNames();
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
    const result = JSON.parse(stdout) as { ok?: boolean; names?: unknown; message?: string };
    if (!result.ok || !Array.isArray(result.names)) throw new Error(result.message || "无法读取 Calendar 分类");
    return uniqueUsableNames(result.names.filter((name): name is string => typeof name === "string"));
  } catch {
    return configuredCalendarNames();
  }
}
