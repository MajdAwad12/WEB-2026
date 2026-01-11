// ===== file: client/src/services/chat.service.js =====
const API_BASE = import.meta.env.VITE_API_BASE
async function handle(res) {
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Sends a message to server.
 * Server will answer via:
 * - local FAQ if possible (no Gemini)
 * - Gemini if needed (and quota available)
 */
export async function chatWithAI({ message }) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ message }),
  });
  return handle(res);
}
