// client/src/components/dashboard/RoomTabs.jsx
export default function RoomTabs({ rooms = [], roomId = null, onChangeRoom }) {
  if (!rooms?.length) return null;

  const active = roomId || rooms[0]?.id;

  return (
    <div className="flex flex-wrap gap-2">
      {rooms.map((r) => {
        const isActive = String(active) === String(r.id);

        return (
          <button
            key={r.id}
            onClick={() => onChangeRoom?.(r.id)}
            className={`text-[12px] px-3 py-2 rounded-full border font-extrabold transition ${
              isActive
                ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
            title={`Switch to ${r.name}`}
          >
            Room {r.name}
          </button>
        );
      })}
    </div>
  );
}
