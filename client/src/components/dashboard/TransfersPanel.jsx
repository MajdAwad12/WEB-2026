// ===== file: client/src/components/dashboard/TransfersPanel.jsx =====
import { useMemo, useState } from "react";
import { approveTransfer, rejectTransfer, cancelTransfer } from "../../services/transfers.service";

function pill(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pending") return "bg-amber-50 border-amber-200 text-amber-800";
  if (s === "approved") return "bg-emerald-50 border-emerald-200 text-emerald-800";
  if (s === "rejected") return "bg-rose-50 border-rose-200 text-rose-800";
  if (s === "cancelled") return "bg-slate-50 border-slate-200 text-slate-700";
  return "bg-slate-50 border-slate-200 text-slate-700";
}

function roleMeta(role) {
  const r = String(role || "").toLowerCase();
  if (r === "supervisor") return { label: "Supervisor", dot: "bg-sky-500" };
  if (r === "lecturer") return { label: "Lecturer", dot: "bg-indigo-500" };
  if (r === "admin") return { label: "Admin", dot: "bg-slate-900" };
  return { label: "User", dot: "bg-slate-400" };
}

function normStr(x) {
  const v = x == null ? "" : String(x);
  return v.trim();
}

function myUserId(me) {
  return String(me?.id || me?._id || "");
}
function myRoomId(me) {
  return normStr(me?.assignedRoomId || me?.roomId || "");
}

function fmtWho(x) {
  if (!x) return "-";
  if (typeof x === "string") return x;
  return x.name || x.fullName || x.username || "-";
}

// ✅ ALWAYS get a stable id (support _id OR id)
function transferIdOf(t) {
  return String(t?._id || t?.id || "").trim();
}

// ✅ stable row key even if no id
function rowKeyOf(t) {
  const id = transferIdOf(t);
  if (id) return id;
  return `${String(t?.studentId || "x")}-${String(t?.createdAt || t?.updatedAt || "")}-${normStr(
    t?.toClassroom
  )}-${normStr(t?.fromClassroom)}`;
}

function canHandle(me, t) {
  // only supervisors can approve/reject transfers sent TO their room
  if (!me || String(me.role).toLowerCase() !== "supervisor") return false;
  const myRoom = myRoomId(me);
  const toRoom = normStr(t?.toClassroom);
  const status = String(t?.status || "").toLowerCase();
  return Boolean(myRoom && toRoom && myRoom === toRoom && status === "pending");
}

function canCancel(me, t) {
  const status = String(t?.status || "").toLowerCase();
  if (status !== "pending") return false;

  const meRole = String(me?.role || "").toLowerCase();
  if (meRole === "admin" || meRole === "lecturer") return true;

  const mid = myUserId(me);
  const requesterId = String(t?.requestedBy?.id || "");
  if (mid && requesterId && mid === requesterId) return true;

  if (meRole === "supervisor") {
    const myRoom = myRoomId(me);
    const fromRoom = normStr(t?.fromClassroom);
    if (myRoom && fromRoom && myRoom === fromRoom) return true;
  }

  return false;
}

export default function TransfersPanel({ me, items = [], loading, error, onChanged }) {
  const [busyKey, setBusyKey] = useState("");
  const [flash, setFlash] = useState("");
  const [flashTone, setFlashTone] = useState("info"); // info | ok | bad

  const meRole = String(me?.role || "").toLowerCase();
  const isSupervisor = meRole === "supervisor";
  const isLecturer = meRole === "lecturer" || meRole === "admin";
  const myRoom = myRoomId(me);

  // ✅ Merge properly and NEVER lose ids
  const { incoming, outgoing, visibleItems } = useMemo(() => {
    const list = Array.isArray(items) ? items : [];

    if (isLecturer) {
      const pendingCount = list.filter((t) => String(t?.status).toLowerCase() === "pending").length;
      return { incoming: pendingCount, outgoing: 0, visibleItems: list };
    }

    if (isSupervisor) {
      const incomingList = list.filter((t) => normStr(t?.toClassroom) === myRoom);
      const outgoingList = list.filter((t) => normStr(t?.fromClassroom) === myRoom);

      // ✅ unique by stable key
      const map = new Map();
      for (const t of [...incomingList, ...outgoingList]) {
        map.set(rowKeyOf(t), t);
      }
      const merged = Array.from(map.values());

      const incomingPending = incomingList.filter((t) => String(t?.status).toLowerCase() === "pending").length;
      const outgoingPending = outgoingList.filter((t) => String(t?.status).toLowerCase() === "pending").length;

      return { incoming: incomingPending, outgoing: outgoingPending, visibleItems: merged };
    }

    return { incoming: 0, outgoing: 0, visibleItems: [] };
  }, [items, isLecturer, isSupervisor, myRoom]);

  const pendingCount = useMemo(
    () => visibleItems.filter((t) => String(t?.status || "").toLowerCase() === "pending").length,
    [visibleItems]
  );

  const headerRole = roleMeta(meRole);
  const showNoRoomWarn = isSupervisor && !myRoom;

  function showFlash(msg, tone = "info") {
    setFlashTone(tone);
    setFlash(msg);
    setTimeout(() => setFlash(""), 4500);
  }

  async function onApprove(t, rowKey) {
    const transferId = transferIdOf(t);
    if (!transferId) return;

    try {
      setBusyKey(rowKey);
      setFlash("");

      const result = await approveTransfer(transferId);

      if (result?.roomFull) {
        // ✅ Room full is NOT an error; it stays pending
        showFlash("🚫 Cannot approve: target room is FULL. Request stays pending (cancel or try later).", "bad");
      } 

      onChanged?.();
    } catch (e) {
      console.error(e);
      showFlash(`Approve failed: ${e?.message || "Unknown error"}`, "bad");
      onChanged?.();
    } finally {
      setBusyKey("");
    }
  }

  async function onReject(t, rowKey) {
    const transferId = transferIdOf(t);
    if (!transferId) return;

    try {
      setBusyKey(rowKey);
      setFlash("");

      await rejectTransfer(transferId);
      showFlash("✅ Transfer rejected.", "ok");
      onChanged?.();
    } catch (e) {
      console.error(e);
      showFlash(`Reject failed: ${e?.message || "Unknown error"}`, "bad");
      onChanged?.();
    } finally {
      setBusyKey("");
    }
  }

  async function onCancel(t, rowKey) {
    const transferId = transferIdOf(t);
    if (!transferId) return;

    try {
      setBusyKey(rowKey);
      setFlash("");

      await cancelTransfer(transferId);
      showFlash("✅ Transfer cancelled.", "ok");
      onChanged?.();
    } catch (e) {
      console.error(e);
      showFlash(`Cancel failed: ${e?.message || "Unknown error"}`, "bad");
      onChanged?.();
    } finally {
      setBusyKey("");
    }
  }

  const flashBoxClass =
    flashTone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : flashTone === "bad"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Transfers</div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${headerRole.dot}`} />
              <h4 className="text-lg font-extrabold text-slate-900">Transfer Panel</h4>
            </div>

            <div className="mt-1 text-xs text-slate-500">
              {isSupervisor
                ? `You can approve/reject requests sent to Room ${myRoom || "—"}`
                : isLecturer
                ? "View all transfers across rooms (approve/reject disabled). You can cancel pending if needed."
                : "View-only."}
            </div>

            {showNoRoomWarn ? (
              <div className="mt-2 text-xs rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 font-bold">
                ⚠️ Your user has no assignedRoomId. You will not be able to approve/reject until it is set.
              </div>
            ) : null}

            {flash ? (
              <div className={`mt-3 text-sm rounded-2xl border px-4 py-3 font-bold ${flashBoxClass}`}>{flash}</div>
            ) : null}
          </div>

          <div className="text-right text-xs text-slate-500 font-bold">
            <div>
              Pending: <span className="text-slate-900">{pendingCount}</span>
            </div>
            {isSupervisor ? (
              <div className="mt-1">
                In: <span className="text-slate-900">{incoming}</span> • Out:{" "}
                <span className="text-slate-900">{outgoing}</span>
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mt-3 text-sm rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
            {error}
          </div>
        ) : null}
      </div>

      <div className="p-5 bg-slate-50">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Loading transfers…
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No transfer requests.
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
            {visibleItems.map((t) => {
              const status = String(t?.status || "unknown").toLowerCase();
              const fromRoom = normStr(t?.fromClassroom);
              const toRoom = normStr(t?.toClassroom);

              const rowKey = rowKeyOf(t);
              const busy = busyKey === rowKey;

              const showActions = canHandle(me, t);
              const showCancel = canCancel(me, t);

              const studentId = t?.studentCode || t?.studentId || "-";
              const studentName = t?.studentName || "Student";

              const fromSeat = t?.fromSeat || "-";
              const toSeat = t?.toSeat || "AUTO";

              const requester = fmtWho(t?.requestedBy);
              const handledBy = fmtWho(t?.handledBy);

              const lastError = String(t?.lastError || "");
              const isRoomFull = status === "pending" && lastError === "ROOM_FULL";

              const approveLabel = isRoomFull ? "Try approve again" : "Approve";

              return (
                <div key={rowKey} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-extrabold text-slate-900 truncate">{studentName}</div>

                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 font-extrabold">
                          ID {studentId}
                        </span>

                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-extrabold ${pill(status)}`}>
                          {status.toUpperCase()}
                        </span>

                        {isRoomFull ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-rose-800 font-extrabold">
                            ROOM FULL
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 text-xs text-slate-600">
                        {fromRoom || "—"} ({fromSeat}) → {toRoom || "—"} ({toSeat})
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        Requested by <span className="font-bold text-slate-700">{requester}</span>
                      </div>

                      {status !== "pending" ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Handled by <span className="font-bold text-slate-700">{handledBy}</span>
                        </div>
                      ) : null}

                      {isRoomFull ? (
                        <div className="mt-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl px-3 py-2 font-bold">
                          🚫 Cannot approve now — target room is full. Request stays <b>pending</b>. You can cancel or try later.
                        </div>
                      ) : null}

                      {t?.note ? (
                        <div className="mt-2 text-xs text-slate-700 break-words">
                          <span className="font-extrabold">Note:</span> {String(t.note)}
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0 flex flex-col gap-2 items-end">
                      {showActions ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => onApprove(t, rowKey)}
                            disabled={busy || !transferIdOf(t)}
                            className="rounded-2xl bg-emerald-600 text-white px-3 py-2 text-[13px] font-extrabold hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {busy ? "Processing…" : approveLabel}
                          </button>
                          <button
                            onClick={() => onReject(t, rowKey)}
                            disabled={busy || !transferIdOf(t)}
                            className="rounded-2xl bg-rose-600 text-white px-3 py-2 text-[13px] font-extrabold hover:bg-rose-700 disabled:opacity-60"
                          >
                            {busy ? "Processing…" : "Reject"}
                          </button>
                        </div>
                      ) : (
                        <div className="text-right text-[11px] text-slate-500">
                          {isSupervisor ? <div>{status === "pending" && toRoom !== myRoom ? "Not your room" : "View-only"}</div> : <div>View</div>}
                        </div>
                      )}

                      {showCancel ? (
                        <button
                          onClick={() => onCancel(t, rowKey)}
                          disabled={busy || !transferIdOf(t)}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-extrabold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {busy ? "Processing…" : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
