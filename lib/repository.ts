import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pendingActionSchema, type PendingAction } from "@/lib/action-schema";

const dataDirectory = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDirectory, "actions.json");

async function readAll(): Promise<PendingAction[]> {
  try {
    const raw = JSON.parse(await readFile(dataFile, "utf8"));
    return pendingActionSchema.array().parse(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(actions: PendingAction[]) {
  await mkdir(dataDirectory, { recursive: true });
  const temporary = `${dataFile}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(actions, null, 2), "utf8");
  await rename(temporary, dataFile);
}

export const actionRepository = {
  async list(limit = 50) {
    const all = await readAll();
    return all.slice(-limit);
  },

  async create(
    sourceText: string,
    action: PendingAction["action"],
    targetName?: string | null,
    targetColor?: string | null,
  ): Promise<PendingAction> {
    const now = new Date().toISOString();
    const pending: PendingAction = {
      id: crypto.randomUUID(),
      sourceText,
      status: "pending",
      action,
      targetName,
      targetColor,
      createdAt: now,
      updatedAt: now,
      result: null,
    };
    const all = await readAll();
    all.push(pending);
    await writeAll(all);
    return pending;
  },

  async get(id: string) {
    return (await readAll()).find((entry) => entry.id === id) ?? null;
  },

  async update(id: string, patch: Partial<Pick<PendingAction, "status" | "result">>) {
    const all = await readAll();
    const index = all.findIndex((entry) => entry.id === id);
    if (index < 0) return null;
    all[index] = { ...all[index], ...patch, updatedAt: new Date().toISOString() };
    await writeAll(all);
    return all[index];
  },
};
