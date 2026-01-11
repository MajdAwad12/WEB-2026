// client/src/components/layout/Sidebar.jsx
import { NavLink } from "react-router-dom";

const SIDEBAR_ROLES = {
  supervisor: [
    { key: "dashboard", label: "Dashboard", path: "dashboard", icon: "📊" },
    { key: "exams", label: "Exams List", path: "exams", icon: "📝" },
  ],
  lecturer: [
    { key: "dashboard", label: "Dashboard", path: "dashboard", icon: "📊" },
    { key: "exams", label: "Exams List", path: "exams", icon: "📝" },
    { key: "reports", label: "Reports & History", path: "reports", icon: "📄" },
  ],
  admin: [
    { key: "dashboard", label: "Dashboard", path: "dashboard", icon: "📊" },
    { key: "exams", label: "Exams List", path: "exams", icon: "📝" },
    { key: "reports", label: "Reports & History", path: "reports", icon: "📄" },
    { key: "manage-exams", label: "Manage Exams", path: "manage-exams", icon: "🛠️" },
  ],

  // ✅ NEW: Student menu (read-only)
  student: [{ key: "student", label: "My Exam Report", path: "student", icon: "🎓" }],
};

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium text-[15px]
         ${
           isActive
             ? "bg-sky-600 text-white shadow-sm"
             : "hover:bg-sky-50 text-slate-700"
         }`
      }
      end={false}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar({ me, onLogout }) {
  const role = me?.role;
  const items = SIDEBAR_ROLES[role] || [];

  // normalize path: "dashboard" -> "/app/dashboard"
  const buildTo = (p) => `/app/${String(p).replace(/^\/+/, "")}`;

  const roleLabel = String(me?.role || "-").toUpperCase();

  return (
    <aside className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-600 flex items-center justify-center text-3xl text-white shadow-md">
            📊
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">
              Exam Monitoring
            </h1>
            <p className="text-[12px] text-slate-500">
              {role === "student" ? "Student Portal" : "Live Dashboard"}
            </p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-6 py-4 border-b border-slate-200 text-sm">
        <p className="text-slate-600">Logged in as</p>
        <p className="text-base font-semibold text-slate-900">
          {me?.fullName || me?.username || "-"}
        </p>

        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200">
            {roleLabel}
          </span>

          {role === "student" && me?.studentId ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
              ID: {me.studentId}
            </span>
          ) : null}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {items.map((item) => (
          <NavItem
            key={item.key}
            to={buildTo(item.path)}
            icon={item.icon || "➡️"}
            label={item.label}
          />
        ))}

        {items.length === 0 && (
          <div className="px-4 py-2 text-sm text-slate-400">
            No available menu for this role
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="p-6 border-t border-slate-200 text-sm">
        <button
          onClick={onLogout}
          className="w-full px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
