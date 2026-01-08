// client/src/services/auth.service.js

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

async function http(url, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // ✅ critical
  });

  return handle(res);
}

// =========================
// Auth
// =========================

export function loginUser({ username, password }) {
  return http("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getMe() {
  return http("/api/auth/me", {
    method: "GET",
  });
}

export function logout() {
  return http("/api/auth/logout", {
    method: "POST",
  });
}

export function registerUser(payload) {
  return http("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function checkUsername(username) {
  const u = String(username || "").trim();
  if (!u) return { taken: false, exists: false };

  const params = new URLSearchParams();
  params.set("username", u);

  const data = await http(`/api/auth/check-username?${params.toString()}`, {
    method: "GET",
  });

  const taken =
    data === true ||
    data?.taken === true ||
    data?.exists === true ||
    data?.isTaken === true;

  return { taken: Boolean(taken), exists: Boolean(taken) };
}

export async function isUsernameTaken(username) {
  const data = await checkUsername(username);
  return Boolean(data.taken || data.exists);
}

export async function isEmailTaken() {
  return false;
}
