// server/src/middleware/requireAuth.js
export function requireAuth(req, res, next) {
  const u = req.session?.user;

  if (!u || !(u.userId || u.id || u._id)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const id = u.userId || u.id || u._id;

  // keep it minimal & consistent (but include what controllers & UI need)
  req.user = {
    _id: id,                 // ✅ controllers use req.user._id
    id,                      // backward compatibility
    role: u.role,
    username: u.username,
    fullName: u.fullName,

    // ✅ NEW: student support
    studentId: u.studentId || null,

    // ✅ supervisor scoping
    assignedRoomId: u.assignedRoomId || null,
  };

  next();
}

export default requireAuth;
