// ===== file: client/src/services/transfers.service.js =====
const API_BASE = import.meta.env.VITE_API_BASE
async function handle(res) {
  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let data;
  try {
    data = isJson ? await res.json() : await res.text();
  } catch {
    data = isJson ? {} : "";
  }

  if (!res.ok) {
    const msg =
      isJson && data && typeof data === "object" && data.message
        ? data.message
        : typeof data === "string" && data.trim()
        ? data
        : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

export async function listTransfers(examId) {
  const res = await fetch(`${API_BASE}/api/transfers?examId=${encodeURIComponent(examId)}`, {
    method: "GET",
    credentials: "include",
  });
  const payload = await handle(res);
  return payload?.items || [];
}

export async function createTransfer({ examId, studentId, toClassroom, toSeat = "AUTO", note }) {
  const res = await fetch(`${API_BASE}/api/transfers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ examId, studentId, toClassroom, toSeat, note }),
  });
  const payload = await handle(res);
  return payload?.item || payload;
}

// ✅ important: do NOT throw on 409 ROOM_FULL; return info
export async function approveTransfer(id) {
  const res = await fetch(`${API_BASE}/api/transfers/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    credentials: "include",
  });

  if (res.status === 409) {
    const payload = await res.json().catch(() => ({}));
    return { roomFull: true, item: payload?.item || null, message: payload?.message || "ROOM_FULL" };
  }

  const payload = await handle(res);
  return { roomFull: false, item: payload?.item || payload };
}

export async function rejectTransfer(id) {
  const res = await fetch(`${API_BASE}/api/transfers/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    credentials: "include",
  });
  const payload = await handle(res);
  return payload?.item || payload;
}

export async function cancelTransfer(id) {
  const res = await fetch(`${API_BASE}/api/transfers/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    credentials: "include",
  });
  const payload = await handle(res);
  return payload?.item || payload;
}
