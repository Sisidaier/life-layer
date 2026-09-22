import type { LifeAction } from "@/lib/action-schema";

export type BridgeResult = {
  ok: boolean;
  externalId?: string;
  message: string;
  item?: Record<string, unknown>;
};

export interface LifeBridge {
  execute(action: LifeAction, requestId: string, targetName?: string): Promise<BridgeResult>;
}
