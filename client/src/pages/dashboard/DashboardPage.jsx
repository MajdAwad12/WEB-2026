// client/src/pages/dashboard/DashboardPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useDashboardLive } from "../../hooks/useDashboardLive";
import { useSimClock } from "../../hooks/useSimClock";
import RocketLoader from "../../components/loading/RocketLoader.jsx";

import RoomTabs from "../../components/dashboard/RoomTabs";
import ExamOverviewCard from "../../components/dashboard/ExamOverviewCard";
import EventsFeed from "../../components/dashboard/EventsFeed";
import TransfersPanel from "../../components/dashboard/TransfersPanel";
import ClassroomMap from "../../components/classroom/ClassroomMap";

export default function DashboardPage() {
  // ✅ grab setter for global chat context
  const { setChatContext } = useOutletContext();

  // ✅ Only lecturer/admin uses this to switch rooms manually.
  const [roomId, setRoomId] = useState(null);

  const { simNow, simNowMs } = useSimClock();

  const {
    me,
    exam,
    rooms,
    activeRoom,
    attendance,
    events,
    stats,
    loading,
    error,
    refetch,
    transfers,
    alerts,
    inbox,
  } = useDashboardLive({ roomId, pollMs: 1000 });

  const meRole = String(me?.role || "").toLowerCase();
  const isLecturer = meRole === "lecturer" || meRole === "admin";

  const activeRoomId = useMemo(() => {
    return String(activeRoom?.id || activeRoom?.name || "").trim();
  }, [activeRoom]);

  const examId = useMemo(() => {
    return exam?.id || exam?._id || null;
  }, [exam]);

  const title = useMemo(() => {
    if (!exam) return "Dashboard";
    const r = activeRoomId;
    return r ? `Dashboard • ${exam.courseName} • ${r}` : `Dashboard • ${exam.courseName}`;
  }, [exam, activeRoomId]);

  // ✅ Update global bot context (Dashboard = richest context)
  useEffect(() => {
    const alertsCount = Array.isArray(alerts) ? alerts.length : 0;
    const transfersCount = Array.isArray(transfers) ? transfers.length : 0;

    setChatContext((prev) => ({
      ...prev,
      screen: "dashboard",
      examId,
      roomId: activeRoomId || null,
      stats: stats || null,
      alertsCount,
      transfersCount,
    }));
  }, [setChatContext, examId, activeRoomId, stats, alerts, transfers]);

if (loading) {
  return <RocketLoader />;
}

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
          <div className="font-extrabold text-red-700">Dashboard Error</div>
          <div className="text-red-700/90 text-sm mt-1">{error}</div>
          <button
            onClick={refetch}
            className="mt-3 px-4 py-2 rounded-2xl bg-red-600 text-white hover:bg-red-700 font-extrabold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xl font-extrabold text-slate-900">No running exam</div>
          <div className="mt-1 text-sm text-slate-600">Start an exam to see live monitoring.</div>
          <button
            onClick={refetch}
            className="mt-4 px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-extrabold text-sm"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-slate-900 truncate">{title}</h1>
          <p className="text-slate-600 text-sm">Live monitoring • attendance • incidents • transfers</p>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={refetch}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ✅ Only lecturer/admin can switch rooms */}
      {isLecturer ? (
        <RoomTabs
          rooms={rooms}
          roomId={roomId || activeRoomId || ""}
          onChangeRoom={(rid) => setRoomId(String(rid || "").trim() || null)}
        />
      ) : null}

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12">
          <ExamOverviewCard me={me} exam={exam} stats={stats} inbox={inbox} simNow={simNow} loading={false} />
        </div>

        <div className="col-span-12">
          <ClassroomMap
            exam={exam}
            me={me}
            refreshNow={refetch}
            nowMs={simNowMs || Date.now()}
            forcedRoomId={activeRoomId}
            forcedAttendance={attendance}
            forcedTransfers={transfers}
            allRooms={rooms}
            hideRoomSwitcher={true}
          />
        </div>

        <div className="col-span-12 grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-6">
            <TransfersPanel me={me} items={transfers} loading={false} error={""} onChanged={refetch} />
          </div>

          <div className="col-span-12 lg:col-span-6">
            <EventsFeed
              events={events}
              alerts={alerts}
              simNowMs={simNowMs}
              activeRoomId={activeRoomId}
              maxItems={14}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
