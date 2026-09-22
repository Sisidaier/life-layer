"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Action = {
  operation: "create" | "query" | "update" | "delete";
  kind: "calendar" | "reminder";
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  dueAt: string | null;
  timezone: string;
  rationale: string;
};

type Pending = {
  id: string;
  status: string;
  action: Action;
  targetName?: string | null;
  sourceText: string;
  result: unknown;
  createdAt: string;
  updatedAt: string;
};
type HistoryEntry = Pending;
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: Pending;
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
    const result = entry.result as { message?: string } | null;
    if (entry.status === "pending") {
      restored.push({ id: `${entry.id}:assistant`, role: "assistant", text: "我准备执行下面的操作：", pending: entry });
    } else if (entry.status === "succeeded") {
      restored.push({ id: `${entry.id}:assistant`, role: "assistant", text: result?.message ?? "执行成功。", state: "succeeded" });
    } else if (entry.status === "cancelled") {
      restored.push({ id: `${entry.id}:assistant`, role: "assistant", text: "已取消，没有写入任何系统。", state: "cancelled" });
    } else {
      restored.push({
        id: `${entry.id}:assistant`,
        role: "assistant",
        text: result?.message ?? (entry.status === "running" ? "正在等待 iPhone Shortcut 返回结果。" : "执行失败。"),
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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("明天下班后 7 点去游泳。");
  const [busy, setBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
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

        const params = new URLSearchParams(window.location.search);
        const resultId = params.get("shortcutResult");
        if (resultId) {
          const status = params.get("status") === "succeeded" ? "succeeded" : "failed";
          const message = params.get("message") || (status === "succeeded" ? "iPhone Shortcut 执行成功。" : "iPhone Shortcut 执行失败。");
          entries = entries.map((entry) =>
            entry.id === resultId
              ? { ...entry, status, result: { ok: status === "succeeded", message }, updatedAt: new Date().toISOString() }
              : entry,
          );
          writeLocalHistory(entries);
          window.history.replaceState({}, "", window.location.pathname);
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
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "解析失败");
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

    if (process.env.NEXT_PUBLIC_LIFE_LAYER_EXECUTION_MODE === "shortcut") {
      const running: HistoryEntry = { ...pending, status: "running", updatedAt: new Date().toISOString() };
      upsertLocalHistory(running);
      const callbackBase = `${window.location.origin}/?shortcutResult=${encodeURIComponent(pending.id)}`;
      const payload = {
        requestId: pending.id,
        action: pending.action,
        targetName: pending.targetName ?? null,
        callbackSuccess: `${callbackBase}&status=succeeded&message=${encodeURIComponent("已写入 Apple 系统")}`,
        callbackFailure: `${callbackBase}&status=failed&message=${encodeURIComponent("Shortcut 执行失败")}`,
      };
      const shortcutName = process.env.NEXT_PUBLIC_LIFE_LAYER_SHORTCUT_NAME ?? "Life Layer Bridge";
      window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}&input=text&text=${encodeURIComponent(JSON.stringify(payload))}`;
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
      upsertLocalHistory(data.pending as HistoryEntry);
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.role === "assistant"
            ? { ...message, text, pending: undefined, state: "succeeded" }
            : message,
        ),
      );
    } catch (error) {
      upsertLocalHistory({
        ...pending,
        status: "failed",
        result: { ok: false, message: error instanceof Error ? error.message : "执行失败。" },
        updatedAt: new Date().toISOString(),
      });
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.role === "assistant"
            ? { ...message, text: error instanceof Error ? error.message : "执行失败。", state: "failed" }
            : message,
        ),
      );
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark">L</div>
        <div>
          <h1>Life Layer</h1>
          <p>Calendar & Reminders</p>
        </div>
        <span className="local-badge">本地 MVP</span>
      </header>

      <section className="conversation" aria-live="polite">
        {messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <div className="avatar">{message.role === "user" ? "你" : "L"}</div>
            <div className="message-content">
              <p>{message.text}</p>
              {message.pending && (
                <div className="action-card">
                  <div className="action-heading">
                    <span className="calendar-icon">{message.pending.action.kind === "calendar" ? "31" : "✓"}</span>
                    <div>
                      <strong>{message.pending.action.title}</strong>
                      <span>
                        {message.pending.action.kind === "calendar" ? "Apple Calendar" : "Apple Reminders"}
                        {message.pending.targetName ? ` · ${message.pending.targetName}` : ""}
                      </span>
                    </div>
                  </div>
                  <dl>
                    <div><dt>操作</dt><dd>{message.pending.action.operation}</dd></div>
                    <div><dt>开始</dt><dd>{formatDate(message.pending.action.startAt ?? message.pending.action.dueAt, message.pending.action.timezone)}</dd></div>
                    {message.pending.action.endAt && <div><dt>结束</dt><dd>{formatDate(message.pending.action.endAt, message.pending.action.timezone)}</dd></div>}
                    <div><dt>判断</dt><dd>{message.pending.action.rationale}</dd></div>
                  </dl>
                  <div className="actions">
                    <button className="secondary" disabled={message.state === "running"} onClick={() => decide(message.id, message.pending!, "cancel")}>取消</button>
                    <button className="primary" disabled={message.state === "running"} onClick={() => decide(message.id, message.pending!, "confirm")}>
                      {message.state === "running" ? "正在执行…" : "确认写入"}
                    </button>
                  </div>
                </div>
              )}
              {message.state && message.state !== "running" && <span className={`status ${message.state}`}>{message.state === "succeeded" ? "执行成功" : message.state === "cancelled" ? "已取消" : "执行失败"}</span>}
            </div>
          </article>
        ))}
        {loadingHistory && <div className="thinking">正在恢复历史记录…</div>}
        {busy && <div className="thinking">正在理解你的安排…</div>}
      </section>

      <form className="composer" onSubmit={submit}>
        <textarea aria-label="消息" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }} placeholder="输入你的安排…" rows={1} />
        <button type="submit" disabled={!canSend} aria-label="发送">↑</button>
        <small>执行前会要求确认</small>
      </form>
    </main>
  );
}
