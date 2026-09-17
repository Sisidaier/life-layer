import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BridgeResult, LifeBridge } from "@/lib/bridge/types";

export class MacOsAutomationBridge implements LifeBridge {
  async execute(action: Parameters<LifeBridge["execute"]>[0], requestId: string): Promise<BridgeResult> {
    if (process.platform !== "darwin") throw new Error("macOS automation bridge can only run on macOS");
    const directory = await mkdtemp(path.join(tmpdir(), "life-layer-apple-"));
    const inputPath = path.join(directory, "input.json");
    const scriptPath = path.join(process.cwd(), "scripts", "apple-bridge.js");
    const payload = {
      requestId,
      action,
      calendarName: process.env.LIFE_LAYER_DEFAULT_CALENDAR || null,
      remindersListName: process.env.LIFE_LAYER_DEFAULT_REMINDERS_LIST || null,
    };

    try {
      await writeFile(inputPath, JSON.stringify(payload), "utf8");
      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn("osascript", ["-l", "JavaScript", scriptPath, inputPath], { stdio: ["ignore", "pipe", "pipe"] });
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
      const result = JSON.parse(stdout) as BridgeResult;
      if (typeof result.ok !== "boolean" || typeof result.message !== "string") throw new Error("macOS bridge returned an invalid result");
      return result;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
