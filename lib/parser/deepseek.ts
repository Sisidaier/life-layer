import OpenAI from "openai";
import { parsePlanSchema, type ParsePlan } from "@/lib/action-schema";

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

export async function parseWithDeepSeek(text: string, timezone: string, now: Date): Promise<ParsePlan> {
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  });

  const systemPrompt = [
    "Convert a Chinese life-planning message into a JSON plan containing one or more actions.",
    "Calendar is for an item with a concrete start and duration. Reminders are flexible tasks with a due date.",
    "Create, update, and delete require confirmation. Query does not.",
    "Never invent an externalId. Use null when it is unknown.",
    "For swimming with no duration, use 60 minutes. For other events, use the duration stated by the user.",
    "Use separate actions for different time ranges. Merge multiple activities only when the user clearly assigns them the exact same time range.",
    "Every Calendar create item must have a date, start time, and duration or end time.",
    "If any requested Calendar item lacks one of those required details, return only needs_clarification for the whole plan. Ask concise questions covering every missing detail. Do not return a partial executable plan.",
    "A ready response has exactly this shape: {\"status\":\"ready\",\"actions\":[ACTION,...]}.",
    "A clarification response has exactly this shape: {\"status\":\"needs_clarification\",\"questions\":[\"QUESTION\",...]}.",
    "All action keys shown in the example are required. Use null for unavailable nullable values. Do not add keys.",
    `Current instant: ${now.toISOString()}. User timezone: ${timezone}.`,
    `EXAMPLE ACTION: ${JSON.stringify(example)}`,
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
        max_tokens: 4000,
      });
      const content = response.choices[0]?.message.content;
      if (!content) throw new Error("DeepSeek 返回了空内容");
      return parsePlanSchema.parse(JSON.parse(content));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("DeepSeek 无法生成有效操作");
}
