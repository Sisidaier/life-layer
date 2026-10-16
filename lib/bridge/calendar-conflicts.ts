import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BatchConflict } from "@/lib/action-schema";

type ConflictInput = { id: string; startAt: string; endAt: string };

type ScriptResult = {
  ok: boolean;
  message?: string;
  conflicts?: Array<{
    itemId: string;
    title: string;
    startAt: string;
    endAt: string;
    calendarName: string;
  }>;
};

export async function listAppleCalendarConflicts(
  items: ConflictInput[],
  calendarNames: string[],
): Promise<Map<string, BatchConflict[]>> {
  const byItem = new Map<string, BatchConflict[]>();
  if (process.env.LIFE_LAYER_BRIDGE !== "applescript" || process.platform !== "darwin") return byItem;

  const directory = await mkdtemp(path.join(tmpdir(), "life-layer-conflicts-"));
  const inputPath = path.join(directory, "input.json");
  const scriptPath = path.join(process.cwd(), "scripts", "apple-calendar-conflicts.js");
  try {
    await writeFile(inputPath, JSON.stringify({ items, calendarNames }), "utf8");
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn("osascript", ["-l", "JavaScript", scriptPath, inputPath], { stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      let errorOutput = "";
      child.stdout.on("data", (chunk) => (output += String(chunk)));
      child.stderr.on("data", (chunk) => (errorOutput += String(chunk)));
      child.on("error", reject);
      child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(errorOutput.trim() || `osascript exited with ${code}`)));
    });
    const result = JSON.parse(stdout) as ScriptResult;
    if (!result.ok) throw new Error(result.message || "读取 Apple Calendar 冲突失败");
    for (const conflict of result.conflicts ?? []) {
      const value: BatchConflict = {
        source: "calendar",
        title: conflict.title,
        startAt: conflict.startAt,
        endAt: conflict.endAt,
        calendarName: conflict.calendarName,
        withItemId: null,
      };
      byItem.set(conflict.itemId, [...(byItem.get(conflict.itemId) ?? []), value]);
    }
    return byItem;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
