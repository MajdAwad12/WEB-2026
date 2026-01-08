// client/src/services/admin.service.js
const API_BASE = import.meta.env.VITE_API_BASE || "";

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

export async function listUsers(role) {
  const q = role ? `?role=${encodeURIComponent(role)}` : "";
  const res = await fetch(`${API_BASE}/api/admin/users${q}`, {
    method: "GET",
    credentials: "include",
  });
  return handle(res);
}

export async function updateExamAdmin(examId, payload) {
  const res = await fetch(`${API_BASE}/api/admin/exams/${examId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function deleteExamAdmin(examId) {
  const res = await fetch(`${API_BASE}/api/admin/exams/${examId}`, {
    method: "DELETE",
    credentials: "include",
  });
  return handle(res);
}

// ✅ Keep: Auto Assign (SERVER-SIDE apply on existing exam)
export async function autoAssignExam(examId) {
  const res = await fetch(`${API_BASE}/api/admin/exams/${examId}/auto-assign`, {
    method: "POST",
    credentials: "include",
  });
  return handle(res);
}

/**
 * ✅ Auto Assign Draft (Create modal only)
 * POST /api/admin/exams/auto-assign-draft
 * body: { examDate, startAt, endAt, totalStudents, requestedRooms }
 *
 * NOTE:
 * requestedRooms = 0 => AUTO (allow grow/shrink by students)
 */
export async function autoAssignDraft(payload) {
  const res = await fetch(`${API_BASE}/api/admin/exams/auto-assign-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload || {}),
  });
  return handle(res);
}
