"use client";

import { type CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";

type Action = {
  operation: "create" | "query" | "update" | "delete";
  kind: "calendar" | "reminder";
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  dueAt: string | null;
  query?: string | null;
  timezone: string;
  rationale: string;
};

type Pending = {
  id: string;
  status: string;
  action: Action;
  targetName?: string | null;
  targetColor?: string | null;
  sourceText: string;
  result: unknown;
  createdAt: string;
  updatedAt: string;
};
type Conflict = {
  source: "batch" | "calendar";
  title: string;
  startAt: string;
  endAt: string;
  calendarName: string | null;
  withItemId: string | null;
};
type BatchItem = {
  id: string;
  action: Action;
  targetName: string;
  targetColor?: string | null;
  status: "pending" | "succeeded" | "failed" | "skipped";
  conflicts: Conflict[];
  result: unknown;
};
type Batch = {
  id: string;
  sourceText: string;
  status: "pending" | "running" | "succeeded" | "partial" | "failed" | "cancelled";
  items: BatchItem[];
  createdAt: string;
  updatedAt: string;
};
type HistoryEntry = Pending | Batch;
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: Pending;
  batch?: Batch;
  state?: string;
};

const initialMessages: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "告诉我你想安排什么。我会先展示准备执行的操作，确认后再写入。",
  },
];

const HISTORY_KEY = "life-layer:history:v1";

function readLocalHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(entries: HistoryEntry[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-50)));
}

function upsertLocalHistory(entry: HistoryEntry) {
  const entries = readLocalHistory();
  const index = entries.findIndex((item) => item.id === entry.id);
  if (index >= 0) entries[index] = entry;
  else entries.push(entry);
  writeLocalHistory(entries);
}

function historyMessages(entries: HistoryEntry[]): Message[] {
  const restored: Message[] = [];
  for (const entry of entries) {
    restored.push({ id: `${entry.id}:user`, role: "user", text: entry.sourceText });
    if ("items" in entry) {
      const batchText = entry.status === "pending"
        ? "我准备批量执行下面的操作："
        : entry.status === "succeeded"
          ? `批量写入完成，共 ${entry.items.filter((item) => item.status === "succeeded").length} 项。`
          : entry.status === "cancelled"
            ? "已取消，没有写入任何日程。"
            : "批量写入未全部完成，请查看每一项的状态。";
      restored.push({
        id: `${entry.id}:assistant`, role: "assistant", text: batchText,
        batch: entry.status === "cancelled" ? undefined : entry,
        state: entry.status === "pending" ? undefined : entry.status,
      });
      continue;
    }
    const result = entry.result as { message?: string } | null;
    if (entry.status === "pending") {
      restored.push({ id: `${entry.id}:assistant`, role: "assistant", text: "我准备执行下面的操作：", pending: entry });
    } else if (entry.status === "succeeded") {
      restored.push({ id: `${entry.id}:assistant`, role: "assistant", text: result?.message ?? "执行成功。", pending: entry, state: "succeeded" });
    } else if (entry.status === "cancelled") {
      restored.push({ id: `${entry.id}:assistant`, role: "assistant", text: "已取消，没有写入任何系统。", state: "cancelled" });
    } else {
      restored.push({
        id: `${entry.id}:assistant`,
        role: "assistant",
        text: result?.message ?? (entry.status === "running" ? "操作仍在处理中。" : "执行失败。"),
        pending: entry,
        state: entry.status,
      });
    }
  }
  return restored;
}

function formatDate(value: string | null, timezone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDateOnly(value: string | null, timezone: string) {
  if (!value) return "日期未定";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDuration(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) return "—";
  const minutes = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
  if (minutes < 60) return `${minutes} 分钟`;
  if (minutes % 60 === 0) return `${minutes / 60} 小时`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function operationLabel(operation: Action["operation"]) {
  return { create: "新建", query: "查询", update: "修改", delete: "删除" }[operation];
}

function statusLabel(status: string) {
  return {
    pending: "待写入",
    succeeded: "已写入",
    failed: "写入失败",
    skipped: "未执行",
    partial: "部分完成",
    cancelled: "已取消",
  }[status] ?? status;
}

const fallbackCalendarColors: Record<string, string> = {
  "个人": "#fff071",
  "运动": "#71ae75",
  "工作": "#60b4da",
  "学习": "#f790a6",
  "娱乐": "#634192",
  "大麦": "#6b006d",
};

function categoryStyle(name: string | null | undefined, color: string | null | undefined): CSSProperties {
  return { "--category-color": color || (name ? fallbackCalendarColors[name] : null) || "#e46f2e" } as CSSProperties;
}

function pendingTargetName(pending: Pending) {
  if (pending.targetName) return pending.targetName;
  const calendar = (pending.result as { item?: { calendar?: unknown } } | null)?.item?.calendar;
  if (typeof calendar === "string" && calendar) return calendar;
  return pending.action.kind === "calendar" ? "Calendar" : "Reminders";
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [clarificationSource, setClarificationSource] = useState<string | null>(null);
  const canSend = useMemo(() => input.trim().length > 0 && !busy && !loadingHistory, [input, busy, loadingHistory]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      try {
        let entries = readLocalHistory();
        if (entries.length === 0) {
          const response = await fetch("/api/history", { cache: "no-store" });
          const data = (await response.json()) as { history?: HistoryEntry[] };
          if (!response.ok) throw new Error("读取历史失败");
          entries = data.history ?? [];
          if (entries.length > 0) writeLocalHistory(entries);
        }

        if (!active || entries.length === 0) return;
        setMessages([initialMessages[0], ...historyMessages(entries)]);
      } catch {
        if (active) {
          setMessages((current) => [
            ...current,
            { id: "history-error", role: "assistant", text: "历史记录暂时无法读取。" },
          ]);
        }
      } finally {
        if (active) setLoadingHistory(false);
      }
    }
    void loadHistory();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    const text = input.trim();
    setInput("");
    setBusy(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, clarificationSource }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "解析失败");
      if (data.type === "clarification") {
        setClarificationSource(data.sourceText as string);
        setMessages((current) => [
          ...current,
          { id: crypto.randomUUID(), role: "assistant", text: `这个批次还缺少信息：\n${(data.questions as string[]).map((question, index) => `${index + 1}. ${question}`).join("\n")}` },
        ]);
        return;
      }
      setClarificationSource(null);
      if (data.type === "batch_confirmation") {
        const batch = data.batch as Batch;
        upsertLocalHistory(batch);
        setMessages((current) => [
          ...current,
          { id: `${batch.id}:assistant`, role: "assistant", text: "我准备批量执行下面的操作：", batch },
        ]);
        return;
      }
      const pending = data.pending as Pending;
      upsertLocalHistory(pending);
      setMessages((current) => [
        ...current,
        {
          id: `${pending.id}:assistant`,
          role: "assistant",
          text: data.type === "confirmation" ? "我准备执行下面的操作：" : data.result.message,
          pending: data.type === "confirmation" ? pending : undefined,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", text: error instanceof Error ? error.message : "发生错误。" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function decideBatch(messageId: string, batch: Batch, decision: "confirm" | "modify") {
    if (decision === "modify") {
      const cancelled: Batch = { ...batch, status: "cancelled", updatedAt: new Date().toISOString() };
      upsertLocalHistory(cancelled);
      setInput(batch.sourceText);
      setMessages((current) => current.map((message) => message.id === messageId
        ? { ...message, text: "已退回修改，没有写入任何日程。你可以在输入框中调整后重新发送。", batch: undefined, state: "cancelled" }
        : message));
      return;
    }

    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, state: "running" } : message));
    const allowConflicts = batch.items.some((item) => item.conflicts.length > 0);
    try {
      const response = await fetch(`/api/batches/${batch.id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batch, allowConflicts }),
      });
      const data = await response.json();
      if (response.status === 409 && data.batch) {
        const refreshed = data.batch as Batch;
        upsertLocalHistory(refreshed);
        setMessages((current) => current.map((message) => message.id === messageId
          ? { ...message, text: data.error, batch: refreshed, state: undefined }
          : message));
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "批量写入失败");
      const updated = data.batch as Batch;
      upsertLocalHistory(updated);
      const summary = data.summary as { succeeded: number; failed: number; skipped: number };
      const resultText = updated.status === "succeeded"
        ? `批量写入完成，共 ${summary.succeeded} 项。`
        : `写入已停止：成功 ${summary.succeeded} 项，失败 ${summary.failed} 项，尚未尝试 ${summary.skipped} 项。`;
      setMessages((current) => current.map((message) => message.id === messageId
        ? { ...message, text: resultText, batch: updated, state: updated.status }
        : message));
    } catch (error) {
      setMessages((current) => current.map((message) => message.id === messageId
        ? { ...message, text: error instanceof Error ? error.message : "批量写入失败。", state: "failed" }
        : message));
    }
  }

  async function decide(messageId: string, pending: Pending, decision: "confirm" | "cancel") {
    setMessages((current) =>
      current.map((message) => (message.id === messageId && message.role === "assistant" ? { ...message, state: "running" } : message)),
    );
    if (decision === "cancel") {
      const cancelled: HistoryEntry = {
        ...pending,
        status: "cancelled",
        result: null,
        updatedAt: new Date().toISOString(),
      };
      upsertLocalHistory(cancelled);
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.role === "assistant"
            ? { ...message, text: "已取消，没有写入任何系统。", pending: undefined, state: "cancelled" }
            : message,
        ),
      );
      return;
    }

    try {
      const response = await fetch(`/api/actions/${pending.id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pending }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "操作失败");
      const text = data.result.message;
      const updated = data.pending as Pending;
      upsertLocalHistory(updated);
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.role === "assistant"
            ? { ...message, text, pending: updated, state: "succeeded" }
            : message,
        ),
      );
    } catch (error) {
      const failed: Pending = {
        ...pending,
        status: "failed",
        result: { ok: false, message: error instanceof Error ? error.message : "执行失败。" },
        updatedAt: new Date().toISOString(),
      };
      upsertLocalHistory(failed);
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.role === "assistant"
            ? { ...message, text: error instanceof Error ? error.message : "执行失败。", pending: failed, state: "failed" }
            : message,
        ),
      );
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M10.8 5.4c-.7-2.8 1.4-4.5 3.9-4.2 1.9.3 3 1.7 2.7 3.2 2-1.4 4-.9 4.8.4-2.6-.1-4.2.8-5.4 2.6z" fill="#6d984b" />
              <path d="M11.8 4.2c-.3-1.3.3-2.4 1.3-3.1" stroke="#527d38" strokeWidth=".8" strokeLinecap="round" />
              <circle cx="11.8" cy="14" r="8.8" fill="#f59a3d" />
              <circle cx="11.8" cy="14" r="7.1" fill="#fffaf0" />
              <path d="M11.8 8.9V14l4 2.5" stroke="#eb7832" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="11.8" cy="14" r="1.1" fill="#eb7832" />
              <path d="M5.6 11.4a7 7 0 0 1 3.5-3.2" stroke="#fff" strokeOpacity=".65" strokeWidth=".9" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h1>小橘历</h1>
            <p>把想法变成安排</p>
          </div>
        </div>
        <span className="connection"><i aria-hidden="true" /><span className="connection-label">已连接 Calendar</span></span>
      </header>

      <section className="conversation" aria-live="polite">
        {messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <div className="message-content">
              <p className="message-text">{message.text}</p>
              {message.pending && (
                <div className="action-card">
                  <div className="single-summary">
                    <div className="single-title">
                      <strong>{message.pending.action.title || message.pending.action.query || "日程操作"}</strong>
                      <span className={`item-status ${message.pending.status}`}>{statusLabel(message.pending.status)}</span>
                    </div>
                    <p className="single-time">
                      {formatDate(message.pending.action.startAt ?? message.pending.action.dueAt, message.pending.action.timezone)}
                      {message.pending.action.endAt ? ` – ${formatTime(message.pending.action.endAt, message.pending.action.timezone)}` : ""}
                      {message.pending.action.endAt && <span>{formatDuration(message.pending.action.startAt, message.pending.action.endAt)}</span>}
                    </p>
                    <div className="single-meta">
                      <span className="category-tag" style={categoryStyle(pendingTargetName(message.pending), message.pending.targetColor)}>{pendingTargetName(message.pending)}</span>
                      {message.pending.action.operation !== "create" && <span className="operation-tag">{operationLabel(message.pending.action.operation)}</span>}
                    </div>
                    {message.pending.status === "pending" && <p className="single-reason">{message.pending.action.rationale}</p>}
                  </div>
                  {message.pending.status === "pending" && (
                    <div className="actions">
                      <button className="secondary" disabled={message.state === "running"} onClick={() => decide(message.id, message.pending!, "cancel")}>暂不写入</button>
                      <button className="primary" disabled={message.state === "running"} onClick={() => decide(message.id, message.pending!, "confirm")}>
                        {message.state === "running" ? "正在执行…" : "确认写入"}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {message.batch && (
                <div className="batch-card">
                  <div className="batch-heading">
                    <div>
                      <span className="batch-eyebrow">{message.batch.status === "pending" ? "待确认的计划" : message.batch.status === "succeeded" ? "已完成的计划" : "计划执行结果"}</span>
                      <strong>{message.batch.items.length} 项日程</strong>
                      <span>确认后按时间顺序写入 Calendar</span>
                    </div>
                    <span className="batch-count"><b>{message.batch.items.filter((item) => item.status === "succeeded").length}</b> / {message.batch.items.length}</span>
                  </div>
                  <div className="batch-list">
                    {message.batch.items.map((item) => (
                      <section className={`batch-item ${item.status}`} key={item.id}>
                        <div className="batch-time">
                          <strong>{item.action.startAt ? formatTime(item.action.startAt, item.action.timezone) : "—"}</strong>
                          <span>{item.action.endAt ? formatTime(item.action.endAt, item.action.timezone) : ""}</span>
                        </div>
                        <div className="batch-details">
                          <div className="batch-title">
                            <strong>{item.action.title}</strong>
                            <span className={`item-status ${item.status}`}>{statusLabel(item.status)}</span>
                          </div>
                          <p>{formatDateOnly(item.action.startAt, item.action.timezone)}</p>
                          <p className="batch-meta"><span>{formatDuration(item.action.startAt, item.action.endAt)}</span><span className="category-tag" style={categoryStyle(item.targetName, item.targetColor)}>{item.targetName}</span></p>
                          {item.status === "pending" && item.conflicts.map((conflict, conflictIndex) => (
                            <div className="conflict" key={`${item.id}:conflict:${conflictIndex}`}>
                              与“{conflict.title}”时间重叠，{formatTime(conflict.startAt, item.action.timezone)}–{formatTime(conflict.endAt, item.action.timezone)}{conflict.calendarName ? `，${conflict.calendarName}` : "，本批次"}
                            </div>
                          ))}
                          {item.status === "failed" && <div className="item-error">{(item.result as { message?: string } | null)?.message ?? "写入失败"}</div>}
                        </div>
                      </section>
                    ))}
                  </div>
                  {message.batch.status === "pending" && (
                    <div className="actions">
                      <button className="secondary" disabled={message.state === "running"} onClick={() => decideBatch(message.id, message.batch!, "modify")}>修改整个批次</button>
                      <button className="primary" disabled={message.state === "running"} onClick={() => decideBatch(message.id, message.batch!, "confirm")}>
                        {message.state === "running" ? "正在写入…" : message.batch.items.some((item) => item.conflicts.length > 0) ? "仍然全部写入" : "确认全部写入"}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!message.pending && message.state && message.state !== "running" && <span className={`status ${message.state}`}>{statusLabel(message.state)}</span>}
            </div>
          </article>
        ))}
        {loadingHistory && <div className="thinking"><i />正在恢复历史记录…</div>}
        {busy && <div className="thinking"><i />正在理解你的安排…</div>}
      </section>

      <form className="composer" onSubmit={submit}>
        <textarea aria-label="消息" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }} placeholder="输入你的安排…" rows={1} />
        <button type="submit" disabled={!canSend} aria-label="发送">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
            <path d="m2.3 8.7 14.4-5.8c.8-.32 1.55.46 1.23 1.24l-5.8 14.4c-.33.8-1.46.76-1.73-.08L8.4 12 2.24 10.35c-.8-.22-.76-1.32.06-1.65Z" fill="currentColor" />
          </svg>
        </button>
        <small>执行前会要求确认</small>
      </form>
    </main>
  );
}
