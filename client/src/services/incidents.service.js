// client/src/services/incidents.service.js
const API_BASE = import.meta.env.VITE_API_BASE
async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

export async function logIncident(examId, studentId, payload) {
  const res = await fetch(`${API_BASE}/api/incidents/${examId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ studentId, ...(payload || {}) }),
  });
  return handle(res);
}
