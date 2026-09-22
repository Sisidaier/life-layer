import OpenAI from "openai";

const domainRules = [
  { category: "运动", keywords: ["游泳", "跑步", "健身", "运动", "瑜伽", "骑行", "羽毛球", "网球", "篮球", "足球", "训练"] },
  { category: "工作", keywords: ["工作", "会议", "客户", "方案", "汇报", "面试", "加班", "同事", "项目", "开会"] },
  { category: "学习", keywords: ["学习", "读书", "阅读", "课程", "上课", "作业", "考试", "复习", "论文", "讲座"] },
  { category: "大麦", keywords: ["大麦", "门票", "演唱会票", "话剧票", "音乐节票"] },
  { category: "娱乐", keywords: ["娱乐", "电影", "演出", "演唱会", "音乐会", "话剧", "游戏", "唱歌", "酒吧", "聚会"] },
  { category: "个人", keywords: ["个人", "朋友", "家人", "吃饭", "约会", "看医生", "医院", "理发", "办事"] },
] as const;

function normalized(text: string) {
  return text.trim().toLowerCase();
}

function findAvailableCategory(category: string, availableNames: string[]) {
  return availableNames.find((name) => name === category) ??
    availableNames.find((name) => name.includes(category) || category.includes(name));
}

export function classifyCalendarByRules(text: string, availableNames: string[]) {
  const input = normalized(text);
  const direct = availableNames.find((name) => input.includes(normalized(name)));
  if (direct) return direct;

  for (const rule of domainRules) {
    if (!rule.keywords.some((keyword) => input.includes(keyword))) continue;
    const match = findAvailableCategory(rule.category, availableNames);
    if (match) return match;
  }
  return null;
}

function fallbackCalendar(availableNames: string[]) {
  const personal = findAvailableCategory("个人", availableNames);
  if (personal) return personal;
  const preferred = process.env.LIFE_LAYER_DEFAULT_CALENDAR?.trim();
  if (preferred && availableNames.includes(preferred)) return preferred;
  return availableNames[0] ?? null;
}

async function classifyWithDeepSeek(text: string, title: string | null, availableNames: string[]) {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  });
  const response = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    messages: [
      {
        role: "system",
        content: [
          "Choose exactly one Apple Calendar category for the user's event.",
          `Allowed category names: ${JSON.stringify(availableNames)}.`,
          "Return JSON with exactly one key named targetName.",
          "targetName must exactly equal one allowed category name. Do not invent a category.",
        ].join("\n"),
      },
      { role: "user", content: JSON.stringify({ text, title }) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 100,
  });
  const content = response.choices[0]?.message.content;
  if (!content) return null;
  const parsed = JSON.parse(content) as { targetName?: unknown };
  return typeof parsed.targetName === "string" && availableNames.includes(parsed.targetName)
    ? parsed.targetName
    : null;
}

export async function classifyCalendar(
  text: string,
  title: string | null,
  availableNames: string[],
) {
  if (availableNames.length === 0) return process.env.LIFE_LAYER_DEFAULT_CALENDAR?.trim() || null;
  if (availableNames.length === 1) return availableNames[0];

  const ruleMatch = classifyCalendarByRules(`${text} ${title ?? ""}`, availableNames);
  if (ruleMatch) return ruleMatch;

  try {
    return (await classifyWithDeepSeek(text, title, availableNames)) ?? fallbackCalendar(availableNames);
  } catch {
    return fallbackCalendar(availableNames);
  }
}
