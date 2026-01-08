// server/src/controllers/auth.controller.js
import User from "../models/User.js";

function safeUser(u) {
  return {
    id: u._id.toString(),
    fullName: u.fullName,
    username: u.username,
    email: u.email,
    role: u.role,
    studentId: u.studentId ?? null,
    assignedRoomId: u.assignedRoomId ?? null,
  };
}

// ================= LOGIN =================
export async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const u = String(username).trim().toLowerCase();
    const user = await User.findOne({ username: u });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ store session (include studentId / assignedRoomId for UI + scoping)
    req.session.user = {
      userId: user._id.toString(),
      id: user._id.toString(),
      role: user.role,
      username: user.username,
      fullName: user.fullName,

      // ✅ NEW
      studentId: user.studentId ?? null,
      assignedRoomId: user.assignedRoomId ?? null,
    };

    // ✅ IMPORTANT: save session before responding
    req.session.save(() => {
      return res.json(safeUser(user));
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// ================= LOGOUT =================
export async function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie("sid");
    return res.json({ message: "Logged out" });
  });
}

// ================= ME =================
export async function me(req, res) {
  const user = await User.findById(req.user.id);
  return res.json(safeUser(user));
}

// ================= REGISTER =================
export async function register(req, res) {
  try {
    const { fullName, username, email, password, role } = req.body;

    if (!["supervisor", "lecturer"].includes(role)) {
      return res.status(400).json({ message: "Role must be supervisor or lecturer" });
    }

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Normalize
    const u = String(username).trim().toLowerCase();
    const e = String(email).trim().toLowerCase();

    const existingU = await User.findOne({ username: u });
    if (existingU) {
      return res.status(409).json({ message: "Username already taken" });
    }

    const existingE = await User.findOne({ email: e });
    if (existingE) {
      return res.status(409).json({ message: "Email already used" });
    }

    const created = await User.create({
      fullName: String(fullName).trim(),
      username: u,
      email: e,
      password, // ✅ plain password
      role,
      studentId: null,
      assignedRoomId: null,
    });

    return res.status(201).json({
      message: "User created",
      user: safeUser(created),
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// ================= CHECK USERNAME =================
// GET /api/auth/check-username?username=majd1
export async function checkUsername(req, res) {
  try {
    const username = String(req.query.username || "").trim().toLowerCase();
    if (!username) {
      // Return consistent shape
      return res.json({ taken: false, exists: false });
    }

    const exists = await User.exists({ username });
    const taken = Boolean(exists);

    return res.json({ taken, exists: taken });
  } catch (err) {
    console.error("CHECK USERNAME ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
