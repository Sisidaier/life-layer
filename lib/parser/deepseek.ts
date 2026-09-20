import OpenAI from "openai";
import { lifeActionSchema, type LifeAction } from "@/lib/action-schema";

const example = {
  version: "1",
  operation: "create",
  kind: "calendar",
  title: "游泳",
  startAt: "2026-09-18T11:00:00.000Z",
  endAt: "2026-09-18T12:00:00.000Z",
  dueAt: null,
  allDay: false,
  timezone: "Asia/Shanghai",
  location: null,
  notes: null,
  externalId: null,
  query: null,
  confidence: 0.99,
  rationale: "有明确开始时间和时长，属于 Calendar 事件。",
  needsConfirmation: true,
};

export async function parseWithDeepSeek(text: string, timezone: string, now: Date): Promise<LifeAction> {
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  });

  const systemPrompt = [
    "Convert one Chinese life-planning message into exactly one JSON action.",
    "Calendar is for an item with a concrete start and duration. Reminders are flexible tasks with a due date.",
    "Create, update, and delete require confirmation. Query does not.",
    "Never invent an externalId. Use null when it is unknown.",
    "For swimming with no duration, use 60 minutes. For other events, use the duration stated by the user.",
    "All keys shown in the example JSON are required. Use null for unavailable nullable values. Do not add keys.",
    `Current instant: ${now.toISOString()}. User timezone: ${timezone}.`,
    `EXAMPLE JSON OUTPUT: ${JSON.stringify(example)}`,
  ].join("\n");

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1600,
      });
      const content = response.choices[0]?.message.content;
      if (!content) throw new Error("DeepSeek 返回了空内容");
      return lifeActionSchema.parse(JSON.parse(content));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("DeepSeek 无法生成有效操作");
}
