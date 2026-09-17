import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { lifeActionSchema, type LifeAction } from "@/lib/action-schema";

export async function parseWithOpenAI(text: string, timezone: string, now: Date): Promise<LifeAction> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    input: [
      {
        role: "system",
        content: [
          "Convert one Chinese life-planning message into exactly one structured action.",
          "Calendar is for an item with a concrete start and duration. Reminders are flexible tasks with a due date.",
          "Mutations require confirmation. Queries do not.",
          "Never invent an externalId. Use null when missing.",
          "For swimming with no duration, use 60 minutes. Other tasks should use a duration stated by the user.",
          `Current instant: ${now.toISOString()}. User timezone: ${timezone}.`,
        ].join("\n"),
      },
      { role: "user", content: text },
    ],
    text: { format: zodTextFormat(lifeActionSchema, "life_action") },
  });

  if (!response.output_parsed) throw new Error("模型没有返回可解析的操作");
  return lifeActionSchema.parse(response.output_parsed);
}
