"use client";

import { useState, useRef, useEffect } from "react";
import { Send, X, MessageSquare, Trash2 } from "lucide-react";

const STORAGE_KEY = "qore_chat_history";
const MAX_MESSAGES = 100;

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO string for serialization
}

interface ChatPanelProps {
  onClose?: () => void;
}

function loadHistory(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  } catch { /* localStorage full — ignore */ }
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const history = loadHistory();
    if (history.length > 0) return history;
    return [{ role: "assistant", content: "HERMES online. ¿En qué trabajamos hoy?", timestamp: new Date().toISOString() }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Persist on every change
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function clearHistory() {
    const fresh: Message[] = [{ role: "assistant", content: "Historial borrado. ¿En qué trabajamos?", timestamp: new Date().toISOString() }];
    setMessages(fresh);
    saveHistory(fresh);
  }

  async function send() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    const userMsg: Message = { role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      const reply = data.reply ?? data.response ?? data.message ?? data.error ?? "Sin respuesta";
      setMessages((m) => [...m, { role: "assistant", content: reply, timestamp: new Date().toISOString() }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Error de conexión con HERMES.", timestamp: new Date().toISOString() },
      ]);
    }
    setLoading(false);
  }

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  return (
    <div className="fixed bottom-4 left-4 w-96 h-[500px] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" style={{ color: "#C9A84C" }} />
          <span className="font-semibold text-sm" style={{ color: "#C9A84C" }}>HERMES</span>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearHistory}
            title="Borrar historial"
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] text-sm px-3 py-2 rounded-xl leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[#C9A84C] text-black"
                  : "bg-zinc-800 text-zinc-100"
              }`}
            >
              {m.content}
            </div>
            <span className="text-[10px] text-zinc-600">{formatTime(m.timestamp)}</span>
          </div>
        ))}
        {loading && (
          <div className="flex items-start">
            <div className="bg-zinc-800 rounded-xl px-3 py-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-zinc-800">
        <input
          className="flex-1 bg-zinc-800 text-white text-sm px-3 py-2 rounded-lg placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
          placeholder="Mensaje a HERMES..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="p-2 rounded-lg transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "#C9A84C" }}
        >
          <Send className="w-4 h-4 text-black" />
        </button>
      </div>
    </div>
  );
}
