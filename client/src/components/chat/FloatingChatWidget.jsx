import { useMemo, useRef, useState, useEffect } from "react";
import { chatWithAI } from "../../services/chat.service";

/**
 * FAQ chips (shown in chat UI)
 */
const FAQ = [
  {
    q: "How do I start an exam?",
    a: "Go to Exam List → select the running exam → click Start Exam (or Open Dashboard if already running).",
  },
  {
    q: "Student not arrived (gray) — what does it mean?",
    a: "Gray means the student is still 'not arrived'. When you scan or mark them as present, they turn green.",
  },
  {
    q: "Toilet break — how do I track it?",
    a: "Click the student seat → Start Toilet. The timer runs live inside the seat. When the student returns, click Return — you will see count and total time.",
  },
  {
    q: "Transfer to another room",
    a: "Click the student seat → Request Transfer → choose the target room. The student becomes purple while waiting for approval by the target room supervisor.",
  },
  { q: "What does 'purple' mean?", a: "Purple indicates a pending transfer request waiting for approval / rejection." },
  {
    q: "Reports (lecturer only)",
    a: "Reports & History shows statistics, incidents and allows exporting CSV (Excel) and printing to PDF.",
  },
];

/* =========================
   “Thinking” helpers
========================= */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function calcThinkingMs(userText) {
  const len = (userText || "").trim().length;
  const base = 450 + Math.min(900, Math.floor(len * 14)); // 450–1350ms-ish
  const jitter = Math.floor(Math.random() * 250); // little randomness
  return base + jitter;
}

/* =========================
   UI bits
========================= */
function BubbleIcon() {
  // Nice chat bubble icon (no libs)
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" aria-hidden="true">
      <path
        d="M20 12c0 3.866-3.582 7-8 7a9.3 9.3 0 0 1-2.67-.39L5 20l1.15-3.43A6.35 6.35 0 0 1 4 12c0-3.866 3.582-7 8-7s8 3.134 8 7Z"
        className="stroke-white"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 12h.01M12 12h.01M15.8 12h.01"
        className="stroke-white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.2s]" />
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.1s]" />
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
    </div>
  );
}

/* =========================
   Component
========================= */
export default function FloatingChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // messages = { from: "me" | "bot", text }
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Hi! I'm your Exam Assistant. Ask me about attendance statuses, toilet tracking, transfers, reports, or exam steps.",
    },
  ]);

  const endRef = useRef(null);
  const quick = useMemo(() => FAQ.slice(0, 6), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, isLoading]);

  async function sendText(text) {
    const clean = (text ?? "").trim();
    if (!clean || isLoading) return;

    setInput("");
    setIsLoading(true);

    // add user message
    setMessages((m) => [...m, { from: "me", text: clean }]);

    try {
      // 1) natural “thinking” time
      await sleep(calcThinkingMs(clean));

      // 2) ask server (server decides best answer)
      const data = await chatWithAI({ message: clean });
      const replyText = data?.text || "Sorry, I couldn't generate an answer. Try again.";

      // 3) tiny extra delay so it feels typed
      await sleep(120 + Math.floor(Math.random() * 200));

      // add bot message
      setMessages((m) => [...m, { from: "bot", text: replyText }]);
    } catch (e) {
      await sleep(150);
      setMessages((m) => [
        ...m,
        { from: "bot", text: "I'm having trouble connecting right now. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function send() {
    return sendText(input);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 select-none">
      {/* Window */}
      {open && (
        <div className="w-[360px] h-[520px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center">
                <span className="text-lg">🤖</span>
              </div>
              <div className="leading-tight">
                <div className="font-extrabold tracking-wide">Exam Assistant - ChatBot</div>
                <div className="text-xs text-white/80">Quick help during the exam</div>
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="w-9 h-9 rounded-2xl hover:bg-white/15 flex items-center justify-center text-xl"
              title="Close"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-auto space-y-2 bg-slate-50">
            {messages.map((m, idx) => {
              const isMe = m.from === "me";
              return (
                <div key={idx} className={isMe ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      "max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap shadow-sm " +
                      (isMe
                        ? "bg-sky-600 text-white rounded-br-md"
                        : "bg-white border border-slate-200 text-slate-800 rounded-bl-md")
                    }
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}

            {/* Loading / Thinking */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3 py-2 rounded-2xl text-sm bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm">
                  <div className="text-xs text-slate-500 mb-1">Thinking…</div>
                  <TypingDots />
                </div>
              </div>
            )}

            {/* Quick chips */}
            <div className="pt-2">
              <div className="text-xs text-slate-500 mb-2">Quick questions:</div>
              <div className="flex flex-wrap gap-2">
                {quick.map((f) => (
                  <button
                    key={f.q}
                    onClick={() => sendText(f.q)}
                    disabled={isLoading}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-60"
                    title={f.a}
                  >
                    {f.q}
                  </button>
                ))}
              </div>
            </div>

            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                className="flex-1 px-3 py-2 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Type a question..."
                disabled={isLoading}
              />
              <button
                onClick={send}
                disabled={isLoading || !input.trim()}
                className="px-4 py-2 rounded-2xl bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:opacity-60"
              >
                Send
              </button>
            </div>

            <div className="mt-2 text-[11px] text-slate-500">
              Tip: Try the quick questions for fast answers.
            </div>
          </div>
        </div>
      )}

      {/* Bubble button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-xl hover:brightness-110 flex items-center justify-center"
          title="Open Exam Assistant"
        >
          <BubbleIcon />
        </button>
      )}
    </div>
  );
}
