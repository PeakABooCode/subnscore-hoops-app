import React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Users,
  AlertCircle,
  Trophy,
  History,
  Clock,
} from "lucide-react";
import { formatTime } from "../utils/helpers";

export default function LiveView({
  court,
  roster,
  playerStats,
  clock,
  isRunning,
  setIsRunning,
  quarter,
  advanceQuarter,
  addStat,
  teamFouls,
  timeouts,
  addTimeout,
  undoLastAction,
  teamMeta,
  handleSwap,
  pendingSwapId,
  playerTimes,
}) {
  const teamTotalScore = Object.values(playerStats).reduce(
    (acc, curr) => acc + (curr.score || 0),
    0,
  );

  // --- DYNAMIC PERIOD NAMING ---
  const periodName =
    quarter > 4 ? `Overtime ${quarter - 4}` : `Quarter ${quarter}`;
  const shortPeriodName = quarter > 4 ? `OT ${quarter - 4}` : `Q${quarter}`;
  const nextShortPeriodName =
    quarter >= 4 ? `OT ${quarter - 3}` : `Q${quarter + 1}`;

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-24 px-2 lg:px-6">
      {/* 1. ADAPTIVE HEADER (Scores & Clock) */}
      <div className="bg-slate-900 text-white p-4 md:p-6 rounded-2xl shadow-xl border-b-4 border-amber-500 sticky top-2 z-30">
        <div className="flex flex-row justify-between items-center gap-2 md:gap-6">
          {/* Team Info */}
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] md:text-xs font-black text-amber-500 uppercase tracking-widest truncate">
              {teamMeta.teamName || "HOME TEAM"}
            </span>
            <div className="flex items-center gap-2">
              <Trophy size={20} className="text-amber-500 hidden sm:block" />
              <span className="text-3xl md:text-5xl font-black">
                {teamTotalScore}
              </span>
            </div>
          </div>

          {/* Center Clock */}
          <div className="flex flex-col items-center bg-slate-800 px-4 py-1 md:px-8 md:py-2 rounded-xl border border-slate-700">
            <div className="text-2xl md:text-5xl font-mono font-black tabular-nums">
              {formatTime(clock)}
            </div>
            <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-tighter">
              {periodName}
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex gap-2">
            <button
              title="Start/Pause"
              onClick={() => setIsRunning(!isRunning)}
              className={`p-3 md:p-5 rounded-full transition-all shadow-lg active:scale-95 ${
                isRunning ? "bg-red-500" : "bg-emerald-500"
              }`}
            >
              {isRunning ? (
                <Pause size={20} fill="white" />
              ) : (
                <Play size={20} fill="white" />
              )}
            </button>
            <button
              title="Next Quarter"
              onClick={advanceQuarter}
              className="hidden md:flex p-5 bg-slate-700 hover:bg-slate-600 rounded-full border border-slate-600 active:scale-95"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT GRID: 1 column on mobile, 3 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. ON-COURT SECTION (2 Columns width on desktop) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs md:text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Users size={16} /> Active On Court
            </h3>
            {pendingSwapId && (
              <span className="text-[10px] font-black text-blue-600 animate-pulse bg-blue-50 px-2 py-1 rounded">
                TAP PLAYER TO SWAP
              </span>
            )}
          </div>

          {court.map((id) => {
            const p = roster.find((r) => r.id === id);
            // Default turnovers to 0 if they don't have any yet
            const stats = playerStats[id] || {
              score: 0,
              fouls: 0,
              turnovers: 0,
            };
            const isSelected = pendingSwapId === id;
            const timePlayed = playerTimes?.[id] || 0;

            return (
              <div
                key={id}
                onClick={() => handleSwap(id)}
                className={`p-3 md:p-4 border-2 rounded-2xl transition-all shadow-sm flex flex-col gap-3 cursor-pointer ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100 scale-[1.01]"
                    : "bg-white border-slate-100 hover:border-slate-200"
                }`}
              >
                {/* Info Row */}
                <div className="flex justify-between items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-800 text-lg md:text-xl truncate block">
                        #{p.jersey} {p.name}
                      </span>
                      <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 shadow-sm">
                        <Clock size={12} className="shrink-0" />
                        <span className="text-[12px] font-bold tabular-nums leading-none">
                          {formatTime(timePlayed)}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {isSelected
                        ? "Select substitute from bench"
                        : "Tap for substitution"}
                    </span>
                  </div>

                  {/* Negatives Display/Buttons (Turnovers & Fouls) */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addStat(id, "turnovers", 1);
                      }}
                      className="h-12 w-16 rounded-xl border-2 flex flex-col items-center justify-center transition-all bg-orange-50 border-orange-100 text-orange-600 hover:bg-orange-100"
                    >
                      <span className="text-[8px] font-black uppercase leading-none">
                        TO
                      </span>
                      <span className="font-black text-xl leading-none">
                        {stats.turnovers || 0}
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addStat(id, "fouls", 1);
                      }}
                      className={`h-12 w-16 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                        stats.fouls >= 4
                          ? "bg-red-600 border-red-600 text-white"
                          : "bg-red-50 border-red-100 text-red-600 hover:bg-red-100"
                      }`}
                    >
                      <span className="text-[8px] font-black uppercase leading-none">
                        Fouls
                      </span>
                      <span className="font-black text-xl leading-none">
                        {stats.fouls}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Scoring Interaction Row */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2"
                >
                  <div className="flex-1 grid grid-cols-3 bg-slate-100 p-1 rounded-xl gap-1">
                    {[1, 2, 3].map((val) => (
                      <button
                        key={val}
                        onClick={() => addStat(id, "score", val)}
                        className="h-12 bg-white rounded-lg font-black text-slate-800 shadow-sm hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                      >
                        +{val}
                      </button>
                    ))}
                  </div>
                  <div className="w-16 h-14 bg-slate-900 text-white rounded-xl flex flex-col items-center justify-center shrink-0 shadow-lg">
                    <span className="text-[8px] font-black uppercase text-slate-500">
                      Pts
                    </span>
                    <span className="text-2xl font-black leading-none">
                      {stats.score}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. SIDEBAR (Bench & Team Management) */}
        <div className="space-y-6">
          {/* Bench Section */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
              Available Bench
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {roster
                .filter((p) => !court.includes(p.id))
                .map((p) => {
                  const isSelected = pendingSwapId === p.id;
                  const stats = playerStats[p.id] || {
                    score: 0,
                    fouls: 0,
                    turnovers: 0,
                  };
                  const timePlayed = playerTimes?.[p.id] || 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSwap(p.id)}
                      disabled={isRunning}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "bg-white border-slate-100 hover:border-blue-300"
                      } ${isRunning ? "opacity-40 grayscale" : "active:scale-95"}`}
                    >
                      <div className="font-black text-slate-800 text-sm truncate">
                        #{p.jersey} {p.name}
                      </div>
                      <div className="grid grid-cols-2 gap-y-1 mt-2 border-t pt-2 border-slate-100">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500 uppercase">
                          <Clock size={10} className="shrink-0" />
                          <span className="tabular-nums">
                            {formatTime(timePlayed)}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">
                          Pts: {stats.score}
                        </span>
                        <span className="text-[10px] font-bold text-orange-500">
                          TO: {stats.turnovers || 0}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${stats.fouls >= 4 ? "text-red-600" : "text-slate-500"}`}
                        >
                          Fls: {stats.fouls}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Team Stats Box */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 shadow-xl border-l-4 border-red-500">
            <div className="flex justify-between items-center bg-slate-800 p-3 rounded-xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Team Fouls {shortPeriodName}
              </span>
              <span
                className={`text-2xl font-black ${teamFouls[quarter] >= 5 ? "text-red-500 animate-pulse" : "text-white"}`}
              >
                {teamFouls[quarter]}
              </span>
            </div>

            <button
              onClick={addTimeout}
              disabled={isRunning}
              className="w-full py-4 bg-amber-500 text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 transition-all"
            >
              Call Timeout (
              {timeouts.filter((t) => t.quarter === quarter).length})
            </button>

            <button
              onClick={undoLastAction}
              className="w-full py-4 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl font-black text-xs uppercase tracking-widest hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <History size={14} /> Undo Mistake
            </button>
          </div>

          {/* Advance Quarter (Tablet/Mobile Only Button - shown inside sidebar) */}
          <button
            onClick={advanceQuarter}
            className="md:hidden w-full py-4 bg-slate-200 text-slate-800 rounded-xl font-black text-xs uppercase tracking-widest"
          >
            Advance to {nextShortPeriodName}
          </button>
        </div>
      </div>

      {/* 4. SMARTPHONE OVERLAY (Floating Warning) */}
      {isRunning && (
        <div className="fixed bottom-6 left-6 right-6 lg:left-auto lg:w-80 bg-red-600 text-white py-3 px-6 rounded-full text-center text-[10px] font-black uppercase tracking-widest shadow-2xl z-50 animate-pulse border-2 border-white/20 flex items-center justify-center gap-2">
          <AlertCircle size={14} /> Clock Running • Subs Locked
        </div>
      )}
    </div>
  );
}
