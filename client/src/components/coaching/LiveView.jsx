import React, { useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Users,
  AlertCircle,
  Activity,
  History,
  Clock,
  TrendingUp,
} from "lucide-react";
import { formatTime } from "../../utils/helpers";

export default function LiveView({
  court,
  roster,
  playerStats,
  clock,
  isRunning,
  setIsRunning,
  quarter, // This is coachingQuarter
  advanceQuarter,
  addStat,
  teamFouls,
  timeouts,
  addTimeout,
  undoLastAction,
  teamMeta,
  handleSwap,
  pendingSwapIds,
  playerTimes,
  addOpponentScore,
  actionHistory = [],
}) {
  const teamTotalScore = Object.values(playerStats).reduce(
    (acc, curr) => acc + (curr.score || 0),
    0,
  );

  const opponentScore = actionHistory
    .filter((a) => a.type === "opp_score")
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // --- MOMENTUM CALCULATION ---
  const currentRun = useMemo(() => {
    let runPoints = 0;
    let runType = null; // 'us' or 'them'

    // Walk backwards through history to find the current unanswered run
    for (let i = actionHistory.length - 1; i >= 0; i--) {
      const action = actionHistory[i];
      if (action.type === "score") {
        if (runType === null) runType = "us";
        if (runType === "us") {
          runPoints += action.amount;
        } else {
          break; // Run broken by opponent
        }
      } else if (action.type === "opp_score") {
        if (runType === null) runType = "them";
        if (runType === "them") {
          runPoints += action.amount;
        } else {
          break; // Run broken by us
        }
      }
    }
    // Standard basketball logic: only highlight runs of 4+ points
    return runType && runPoints >= 4
      ? { type: runType, points: runPoints }
      : null;
  }, [actionHistory]);

  // --- DYNAMIC PERIOD NAMING ---
  const periodName =
    quarter > 4 ? `Overtime ${quarter - 4}` : `Quarter ${quarter}`;
  const shortPeriodName = quarter > 4 ? `OT ${quarter - 4}` : `Q${quarter}`;
  const nextShortPeriodName =
    quarter >= 4 ? `OT ${quarter - 3}` : `Q${quarter + 1}`;

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-24 px-2 lg:px-6">
      {/* 1. ADAPTIVE HEADER (Scoreboard & Sticky Controls) */}
      <div className="bg-slate-900 text-white p-3 md:p-5 rounded-2xl shadow-xl border-b-4 border-amber-500 sticky top-16 z-30 transition-all duration-300">
        <div className="flex flex-col gap-3">
          {/* Row 1: Scoreboard */}
          <div className="grid grid-cols-3 items-center gap-2">
            {/* Home Team */}
            <div className="flex flex-col items-center md:items-start min-w-0">
              <span className="text-[9px] md:text-[11px] font-black text-amber-500 uppercase tracking-widest truncate w-full text-center md:text-left">
                {teamMeta.teamName || "HOME"}
              </span>
              <span className="text-3xl md:text-5xl font-black">
                {teamTotalScore}
              </span>
              {currentRun?.type === "us" && (
                <span className="text-[9px] md:text-xs font-black text-emerald-400 animate-pulse bg-emerald-400/10 px-2 py-0.5 rounded-full mt-1 flex items-center gap-1 shadow-sm border border-emerald-400/20">
                  <TrendingUp size={10} /> {currentRun.points}-0 RUN
                </span>
              )}
            </div>

            {/* Center Clock */}
            <div className="flex flex-col items-center bg-slate-800 py-1 md:py-2 rounded-xl border border-slate-700">
              <div className="text-2xl md:text-4xl font-mono font-black tabular-nums leading-tight">
                {formatTime(clock)}
              </div>
              <div className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                {periodName}
              </div>
            </div>

            {/* Opponent Team */}
            <div className="flex flex-col items-center md:items-end min-w-0">
              <span className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest truncate w-full text-center md:text-right">
                {teamMeta.opponent || "AWAY"}
              </span>
              <span className="text-3xl md:text-5xl font-black text-slate-300">
                {opponentScore}
              </span>
              {currentRun?.type === "them" && (
                <span className="text-[9px] md:text-xs font-black text-red-400 animate-pulse bg-red-400/10 px-2 py-0.5 rounded-full mt-1 flex items-center gap-1 shadow-sm border border-red-400/20">
                  <TrendingUp size={10} className="rotate-90" />{" "}
                  {currentRun.points}-0 RUN
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Real-time Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2">
            <div className="flex gap-2">
              <button
                title={isRunning ? "Pause Clock" : "Start Clock"}
                onClick={() => setIsRunning(!isRunning)}
                className={`h-10 px-4 md:px-6 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2 ${
                  isRunning ? "bg-red-500" : "bg-emerald-500"
                }`}
              >
                {isRunning ? (
                  <Pause size={16} fill="white" />
                ) : (
                  <Play size={16} fill="white" />
                )}
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                  {isRunning ? "Pause" : "Start"}
                </span>
              </button>
              <button
                title="Next Quarter"
                onClick={() => advanceQuarter()}
                className="h-10 w-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 active:scale-95"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {/* Quick Opponent Entry Buttons */}
            <div className="flex items-center gap-1 bg-slate-800/40 p-1 rounded-xl">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-2 hidden lg:block">
                Record Opponent Score:
              </span>
              {[1, 2, 3].map((val) => (
                <button
                  key={val}
                  onClick={() => addOpponentScore(val)}
                  className="h-10 w-10 bg-slate-700 hover:bg-slate-600 active:bg-blue-900 rounded-lg font-black text-xs transition-all border border-slate-600"
                >
                  +{val}
                </button>
              ))}
            </div>
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
            {pendingSwapIds.length > 0 && (
              <span className="text-[10px] font-black text-blue-600 animate-pulse bg-blue-50 px-2 py-1 rounded">
                TAP PLAYER TO SWAP
              </span>
            )}
          </div>

          {court.length === 0 && (
            <div className="py-12 text-center border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-2xl shadow-inner">
              <Users
                size={32}
                className="mx-auto text-blue-400 mb-3 opacity-50"
              />
              <p className="text-sm text-blue-600 font-black uppercase tracking-widest animate-pulse">
                Select 5 Starters from the Bench
              </p>
            </div>
          )}

          {court.map((id) => {
            const p = roster.find((r) => r.id === id);
            // Safety check: if player not found in roster, skip rendering to prevent crash
            if (!p) return null;

            // Default turnovers to 0 if they don't have any yet
            const stats = playerStats[id] || {
              score: 0,
              fouls: 0,
              turnovers: 0,
            };
            const isSelected = pendingSwapIds.includes(id);
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
                  const isSelected = pendingSwapIds.includes(p.id);
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

          {/* Advance Quarter Button */}
          <button
            onClick={() => advanceQuarter()}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95"
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
