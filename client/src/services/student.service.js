// client/src/services/student.service.js
const API_BASE = import.meta.env.VITE_API_BASE;

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

export async function listMyEndedExams() {
  const res = await fetch(`${API_BASE}/api/student/exams`, {
    method: "GET",
    credentials: "include",
  });
  return handle(res);
}

export async function getMyExamReport(examId) {
  const res = await fetch(`${API_BASE}/api/student/exams/${encodeURIComponent(examId)}/me`, {
    method: "GET",
    credentials: "include",
  });
  return handle(res);
}
