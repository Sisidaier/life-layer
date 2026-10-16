import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { parsePlanSchema, type ParsePlan } from "@/lib/action-schema";

export async function parseWithOpenAI(text: string, timezone: string, now: Date): Promise<ParsePlan> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    input: [
      {
        role: "system",
        content: [
          "Convert a Chinese life-planning message into a structured plan with one or more actions.",
          "Calendar is for an item with a concrete start and duration. Reminders are flexible tasks with a due date.",
          "Mutations require confirmation. Queries do not.",
          "Never invent an externalId. Use null when missing.",
          "For swimming with no duration, use 60 minutes. Other tasks should use a duration stated by the user.",
          "Split different time ranges into different actions. Merge activities only when they clearly share the exact same time range.",
          "If any Calendar create item lacks a date, start time, or duration/end time, return needs_clarification for the whole request and ask for all missing details. Do not return partial actions.",
          `Current instant: ${now.toISOString()}. User timezone: ${timezone}.`,
        ].join("\n"),
      },
      { role: "user", content: text },
    ],
    text: { format: zodTextFormat(parsePlanSchema, "life_plan") },
  });

  if (!response.output_parsed) throw new Error("模型没有返回可解析的操作");
  return parsePlanSchema.parse(response.output_parsed);
}
