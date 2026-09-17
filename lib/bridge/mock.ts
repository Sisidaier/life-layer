import type { LifeBridge } from "@/lib/bridge/types";

export class MockBridge implements LifeBridge {
  async execute(action: Parameters<LifeBridge["execute"]>[0], requestId: string) {
    return {
      ok: true,
      externalId: action.externalId ?? `mock:${requestId}`,
      message: `模拟执行成功：${action.operation} ${action.kind}`,
      item: {
        title: action.title,
        startAt: action.startAt,
        endAt: action.endAt,
        dueAt: action.dueAt,
      },
    };
  }
}
