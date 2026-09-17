import type { LifeAction } from "@/lib/action-schema";
import { parseWithDeepSeek } from "@/lib/parser/deepseek";
import { parseGoldenPath } from "@/lib/parser/deterministic";
import { parseWithOpenAI } from "@/lib/parser/openai";

export async function parseIntent(text: string, now = new Date()): Promise<LifeAction> {
  const timezone = process.env.LIFE_LAYER_TIMEZONE ?? "Asia/Shanghai";
  const deterministic = parseGoldenPath(text, timezone, now);
  if (deterministic) return deterministic;

  const provider = process.env.LIFE_LAYER_AI_PROVIDER ?? (process.env.DEEPSEEK_API_KEY ? "deepseek" : "openai");
  if (provider === "deepseek") {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek 尚未配置。请在 .env.local 中填写 DEEPSEEK_API_KEY。");
    }
    return parseWithDeepSeek(text, timezone, now);
  }

  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI 尚未配置。请在 .env.local 中填写 OPENAI_API_KEY。");
  return parseWithOpenAI(text, timezone, now);
}
