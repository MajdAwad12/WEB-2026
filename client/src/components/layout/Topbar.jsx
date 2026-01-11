// client/src/components/layout/Topbar.jsx
function formatDate(d) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

export default function Topbar({ me }) {
  const today = new Date();

  return (
    <header className="h-20 border-b border-slate-200 flex items-center justify-between px-10 bg-white">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">
          Hello, <span className="text-slate-900">{me?.fullName || "User"}</span>{" "}
          👋
        </h2>
       
      </div>

      <div className="text-right text-sm text-slate-500">
        <p>Today: {formatDate(today)}</p>
        <p className="text-[11px] text-slate-400">
          Braude College • Exam Monitoring App
        </p>
      </div>
    </header>
  );
}
