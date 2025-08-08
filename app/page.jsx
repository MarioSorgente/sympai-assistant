"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Loader2, ShieldCheck, Sparkles, Sun, Moon } from "lucide-react";
import clsx from "clsx";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(true);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const canSend = useMemo(() => q.trim().length > 0 && !loading, [q, loading]);

  async function send() {
    if (!canSend) return;
    const text = q.trim();
    setQ("");
    setMessages(m => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", body: text });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      setMessages(m => [...m, { role: "assistant", text: payload.answer, sources: payload.sources }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", text: "Sorry, I hit an error. Please try again." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function copy(text) { navigator.clipboard.writeText(text); }

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 bg-white/70 dark:bg-gray-950/70 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-2xl bg-brand/10 grid place-items-center">
              <Sparkles className="h-4 w-4 text-brand" />
            </div>
            <div>
              <h1 className="font-semibold leading-tight">SympAI</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-0.5">TSE Copilot for hardware & Modbus</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Internal • Read-only • No data stored</span>
            <button
              onClick={() => setDark(d => !d)}
              className="ml-3 p-2 rounded-md border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <section className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {messages.length === 0 && !loading && (
          <div className="mt-20 text-center text-gray-500">
            <h2 className="text-xl font-semibold mb-2">Ask about setup, wiring, Modbus, or controller ops</h2>
            <p className="mb-6">Example: <span className="font-mono">Guide me through RS-485 Modbus config</span></p>
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-800 p-6 text-left">
              <p className="text-sm">Tips</p>
              <ul className="list-disc pl-6 text-sm mt-2 space-y-1">
                <li>Be specific: device model, task, environment</li>
                <li>Say “step-by-step” for workflows</li>
                <li>Ask “why” to get reasoning and checks</li>
              </ul>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {messages.map((m, i) => (
            <div key={i} className={clsx("group rounded-2xl p-4 border", m.role === "user"
              ? "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
              : "border-brand/20 bg-brand/5"
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold">{m.role === "user" ? "You" : "SympAI"}</div>
                <button
                  title="Copy"
                  onClick={() => copy(m.text)}
                  className="opacity-0 group-hover:opacity-100 transition text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 leading-relaxed whitespace-pre-wrap">{m.text}</div>

              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.sources.map((s, j) => (
                    <a key={j} href={s.url} target="_blank" rel="noreferrer"
                       className="text-xs px-2 py-1 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
                      {s.title || "Notion Page"}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                SympAI is thinking…
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </section>

      <footer className="sticky bottom-0 bg-gradient-to-t from-white dark:from-gray-950 via-white/90 dark:via-gray-950/90 to-transparent pt-6">
        <div className="max-w-4xl mx-auto w-full px-4 pb-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-2 bg-white dark:bg-gray-900 shadow-sm">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask SympAI… (Enter to send)"
              className="w-full bg-transparent outline-none px-3 py-2"
            />
          </div>
          <div className="flex justify-end mt-2">
            <button
              onClick={send}
              disabled={!canSend}
              className={clsx(
                "px-4 py-2 rounded-xl text-sm font-medium transition",
                canSend ? "bg-brand text-white hover:opacity-90" : "bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed"
              )}
            >
              Send
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
