// ===== file: client/src/services/dashboard.service.js =====
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
      (isJson && data && typeof data === "object" && data.message)
        ? data.message
        : (typeof data === "string" && data.trim())
          ? data
          : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

async function http(url, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
    credentials: "include",
  });

  return handle(res);
}

// ✅ IMPORTANT: server decides visibility by role/assignedRoomId, not by roomId query.
// ✅ So we never send roomId to the server here.
export function getDashboardSnapshot() {
  return http(`/api/dashboard/snapshot`, { method: "GET" });
}

export function getClock() {
  return http(`/api/dashboard/clock`, { method: "GET" });
}
