// client/src/services/reports.service.js
const API_BASE = import.meta.env.VITE_API_BASE

async function handle(res) {
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

export async function getReportsList() {
  const res = await fetch(`${API_BASE}/api/reports`, {
    method: "GET",
    credentials: "include",
  });
  return handle(res);
}

export async function getReportsAnalytics() {
  const res = await fetch(`${API_BASE}/api/reports/analytics`, {
    method: "GET",
    credentials: "include",
  });
  return handle(res);
}

export async function getReportDetails(examId) {
  const res = await fetch(`${API_BASE}/api/reports/${examId}`, {
    method: "GET",
    credentials: "include",
  });
  return handle(res);
}

// download helpers
export async function downloadReportPdf(examId, filename = "report.pdf") {
  const res = await fetch(`${API_BASE}/api/reports/${examId}/pdf`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadReportCsv(examId, filename = "report.csv") {
  const res = await fetch(`${API_BASE}/api/reports/${examId}/csv`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
