import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BridgeResult, LifeBridge } from "@/lib/bridge/types";

export class MacShortcutsBridge implements LifeBridge {
  async execute(
    action: Parameters<LifeBridge["execute"]>[0],
    requestId: string,
    targetName?: string,
  ): Promise<BridgeResult> {
    const directory = await mkdtemp(path.join(tmpdir(), "life-layer-"));
    const input = path.join(directory, "input.json");
    const output = path.join(directory, "output.json");
    const shortcutName = process.env.LIFE_LAYER_SHORTCUT_NAME ?? "Life Layer Bridge";

    try {
      await writeFile(input, JSON.stringify({ requestId, action, targetName: targetName ?? null }), "utf8");
      await new Promise<void>((resolve, reject) => {
        const child = spawn("shortcuts", ["run", shortcutName, "--input-path", input, "--output-path", output], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        child.stderr.on("data", (chunk) => (stderr += String(chunk)));
        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(stderr.trim() || `shortcuts exited with ${code}`));
        });
      });
      const result = JSON.parse(await readFile(output, "utf8")) as BridgeResult;
      if (typeof result.ok !== "boolean" || typeof result.message !== "string") {
        throw new Error("快捷指令返回了无效结果");
      }
      return result;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
