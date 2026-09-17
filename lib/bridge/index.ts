import type { LifeBridge } from "@/lib/bridge/types";
import { MacOsAutomationBridge } from "@/lib/bridge/macos-automation";
import { MockBridge } from "@/lib/bridge/mock";
import { MacShortcutsBridge } from "@/lib/bridge/shortcuts";

export function getBridge(): LifeBridge {
  if (process.env.LIFE_LAYER_BRIDGE === "shortcuts") return new MacShortcutsBridge();
  if (process.env.LIFE_LAYER_BRIDGE === "applescript") return new MacOsAutomationBridge();
  return new MockBridge();
}
