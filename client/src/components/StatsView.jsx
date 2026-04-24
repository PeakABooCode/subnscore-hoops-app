import React, { useState } from "react";
import { formatTime, QUARTER_SECONDS } from "../utils/helpers";
import {
  ClipboardList,
  Users,
  Clock,
  Trash2,
  Target,
  CloudUpload,
  Activity,
  History,
} from "lucide-react";

export default function StatsView({
  roster,
  playerStats,
  stints,
  clock,
  teamMeta,
  quarter,
  resetGame,
  actionHistory = [],
  triggerSaveGame, // Prop to trigger save game modal from App.jsx
  isHistory, // Prop to detect if we are viewing a past game
  historyQuarterStats, // New prop for pre-calculated quarter data
}) {
  const [activeTab, setActiveTab] = useState("boxscore"); // boxscore, quarters, timeline

  // --- Calculations ---
  const teamTotalScore = Object.values(playerStats).reduce(
    (acc, curr) => acc + (curr.score || 0),
    0,
  );
  const teamTotalFouls = Object.values(playerStats).reduce(
    (acc, curr) => acc + (curr.fouls || 0),
    0,
  );
  const teamTotalTurnovers = Object.values(playerStats).reduce(
    (acc, curr) => acc + (curr.turnovers || 0),
    0,
  );

  const calculateMins = (pId) => {
    // If it's a live game, we calculate based on the stints array
    if (!isHistory && stints) {
      let total = 0;
      stints
        .filter((s) => s.playerId === pId)
        .forEach((s) => {
          // If clockOut is null, the player is still active in a quarter
          if (s.clockOut !== null) {
            total += s.clockIn - s.clockOut;
          } else if (s.quarter === quarter) {
            // Currently on court in the active quarter
            total += s.clockIn - clock;
          } else if (s.quarter < quarter) {
            // Played until the end of a previous quarter (fallback)
            total += s.clockIn - 0;
          }
        });
      return formatTime(total);
    }
    return "0:00";
  };

  const getQuarterAppearances = () => {
    const quarters = {};
    for (let i = 1; i <= quarter; i++) {
      quarters[i] = [];
    }

    // If we have pre-calculated quarter stats, use those as they are the most accurate
    if (isHistory && historyQuarterStats) {
      historyQuarterStats.forEach((qs) => {
        const q = qs.quarter;
        const pId = qs.player_id || qs.playerId;
        if (quarters[q] && !quarters[q].includes(pId)) {
          quarters[q].push(pId);
        }
      });
    } else if (isHistory) {
      actionHistory.forEach((action) => {
        if (!quarters[action.quarter]) quarters[action.quarter] = [];
        if (!quarters[action.quarter].includes(action.playerId)) {
          quarters[action.quarter].push(action.playerId);
        }
      });
    } else {
      stints.forEach((stint) => {
        if (!quarters[stint.quarter]) quarters[stint.quarter] = [];
        if (!quarters[stint.quarter].includes(stint.playerId)) {
          quarters[stint.quarter].push(stint.playerId);
        }
      });
    }
    return quarters;
  };

  const getQuarterStats = (playerId, qtr) => {
    let qPts = 0;
    let qFls = 0;
    let qTOs = 0;
    let qSecs = 0;

    actionHistory.forEach((action) => {
      if (action.playerId === playerId && action.quarter === qtr) {
        if (action.type === "score") qPts += action.amount;
        if (action.type === "fouls") qFls += action.amount;
        if (action.type === "turnovers") qTOs += action.amount;
      }
    });

    // Calculate playing time for this specific player in this specific quarter
    if (isHistory && historyQuarterStats) {
      const qs = historyQuarterStats.find(
        (s) =>
          (s.player_id === playerId || s.playerId === playerId) &&
          s.quarter === qtr,
      );
      if (qs) {
        // Ensure points, fouls, etc. are used from the record if found
        const rawSecs = qs.seconds_played ?? qs.secondsPlayed ?? 0;
        return {
          qPts: qs.points,
          qFls: qs.fouls,
          qTOs: qs.turnovers,
          qTime: formatTime(Number(rawSecs)),
        };
      }
    } else if (stints) {
      // Live game calculation using stints
      stints
        .filter((s) => s.playerId === playerId && s.quarter === qtr)
        .forEach((s) => {
          if (s.clockOut !== null) {
            qSecs += s.clockIn - s.clockOut;
          } else if (s.quarter === quarter) {
            qSecs += s.clockIn - clock;
          } else if (s.quarter < quarter) {
            // This stint belongs to the quarter we are calculating (qtr < current quarter)
            qSecs += s.clockIn - 0;
          }
        });
    }

    return { qPts, qFls, qTOs, qTime: formatTime(qSecs) };
  };

  const onSaveClick = async () => {
    triggerSaveGame();
  };

  const quarterData = getQuarterAppearances();
  const dynamicQuartersArray = Array.from({ length: quarter }, (_, i) => i + 1);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* 1. REPORT HEADER - UPDATED FOR DYNAMIC LEAGUE/SEASON */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border-b-4 border-amber-500 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-2xl md:text-3xl font-black text-amber-400 uppercase tracking-tighter">
            {teamMeta?.teamName || "Team"}{" "}
            {isHistory ? "Archive" : "Final Report"}
          </h2>
          <p className="text-xs md:text-sm text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center justify-center md:justify-start gap-2">
            <span>{teamMeta?.league || "General League"}</span>
            <span className="text-slate-600">•</span>
            <span>{"Season " + teamMeta?.season || "Unknown Season"}</span>
            <span>
              {teamMeta?.season
                ? `Season ${teamMeta.season}`
                : "Unknown Season"}
            </span>
          </p>
        </div>

        <div className="flex gap-2 sm:gap-3">
          <div className="bg-slate-800 px-3 py-2 sm:px-5 sm:py-2 rounded-xl border border-slate-700 flex flex-col items-center">
            <span className="text-[8px] sm:text-[10px] text-slate-400 font-black uppercase">
              Pts
            </span>
            <span className="text-xl sm:text-2xl font-black text-white">
              {teamTotalScore}
            </span>
          </div>
          <div className="bg-slate-800 px-3 py-2 sm:px-5 sm:py-2 rounded-xl border border-slate-700 flex flex-col items-center">
            <span className="text-[8px] sm:text-[10px] text-slate-400 font-black uppercase">
              TOs
            </span>
            <span className="text-xl sm:text-2xl font-black text-orange-400">
              {teamTotalTurnovers}
            </span>
          </div>
          <div className="bg-slate-800 px-3 py-2 sm:px-5 sm:py-2 rounded-xl border border-slate-700 flex flex-col items-center">
            <span className="text-[8px] sm:text-[10px] text-slate-400 font-black uppercase">
              Fls
            </span>
            <span className="text-xl sm:text-2xl font-black text-red-400">
              {teamTotalFouls}
            </span>
          </div>
        </div>
      </div>

      {/* 2. TAB NAVIGATION */}
      <div className="flex bg-slate-200 p-1 rounded-xl shadow-sm border border-slate-300">
        <button
          onClick={() => setActiveTab("boxscore")}
          className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === "boxscore"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-300/50"
          }`}
        >
          <ClipboardList size={18} /> Box Score
        </button>
        <button
          onClick={() => setActiveTab("quarters")}
          className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === "quarters"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-300/50"
          }`}
        >
          <Clock size={18} /> Quarter Data
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === "timeline"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-300/50"
          }`}
        >
          <History size={18} /> Timeline
        </button>
      </div>

      {/* 3. TAB 1: BOX SCORE */}
      {activeTab === "boxscore" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-wider text-sm">
              <Users size={18} className="text-blue-600" /> Stats vs{" "}
              {teamMeta?.opponent || "Opponent"}
            </h3>
          </div>

          {/* Mobile View: Player Cards (Visible only on small screens) */}
          <div className="md:hidden p-4 space-y-3 bg-slate-50/50">
            {roster.map((p) => {
              const stats = playerStats[p.id] || {
                score: 0,
                fouls: 0,
                turnovers: 0,
                minutes: "0:00",
              };
              const displayMins = isHistory
                ? stats.minutes || "0:00"
                : calculateMins(p.id);

              return (
                <div
                  key={p.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3"
                >
                  {/* Player Identity & Minutes */}
                  <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-xs font-black text-amber-400">
                        #{p.jersey}
                      </span>
                      <span className="font-black text-slate-800 uppercase tracking-tight">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-black tabular-nums border border-blue-100">
                      <Clock size={12} />
                      {displayMins}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">
                        Pts
                      </div>
                      <div className="text-xl font-black text-slate-900">
                        {stats.score}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">
                        TO
                      </div>
                      <div className="text-xl font-black text-orange-600">
                        {stats.turnovers || 0}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">
                        Fls
                      </div>
                      <div
                        className={`text-xl font-black ${
                          stats.fouls >= 5 ? "text-red-600" : "text-slate-900"
                        }`}
                      >
                        {stats.fouls}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Traditional Table (Hidden on small screens) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 text-[10px] sm:text-xs uppercase tracking-widest">
                  <th className="p-4 font-black">Player</th>
                  <th className="p-4 font-black text-center">PTS</th>
                  <th className="p-4 font-black text-center">TO</th>
                  <th className="p-4 font-black text-center">FLS</th>
                  <th className="p-4 font-black text-center">Total Min</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((p) => {
                  const stats = playerStats[p.id] || {
                    score: 0,
                    fouls: 0,
                    turnovers: 0,
                    minutes: "0:00",
                  };
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-black text-slate-700 shrink-0">
                          #{p.jersey}
                        </span>
                        <span className="font-black text-slate-800 text-sm sm:text-base truncate">
                          {p.name}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 w-10 h-10 rounded-lg font-black text-lg">
                          {stats.score}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-lg font-black text-lg ${stats.turnovers > 0 ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-600"}`}
                        >
                          {stats.turnovers || 0}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-lg font-black text-lg ${stats.fouls >= 5 ? "bg-red-600 text-white" : stats.fouls >= 4 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}
                        >
                          {stats.fouls}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-mono font-black text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg text-sm sm:text-base">
                          {/* Show saved minutes from DB if viewing history */}
                          {isHistory
                            ? stats.minutes || "0:00"
                            : calculateMins(p.id)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. TAB 2: QUARTER BREAKDOWN */}
      {activeTab === "quarters" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dynamicQuartersArray.map((q) => {
            const playersInQuarter = quarterData[q] || [];
            return (
              <div
                key={`qtr-${q}`}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col"
              >
                <div className="bg-slate-900 px-5 py-3 border-b-4 border-amber-500 flex justify-between items-center">
                  <h3 className="font-black text-white uppercase tracking-wider text-sm">
                    {q > 4 ? `Overtime ${q - 4}` : `Quarter ${q}`}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-800 px-2 py-1 rounded">
                    {playersInQuarter.length} Appeared
                  </span>
                </div>

                <div className="p-4 flex-1 bg-slate-50">
                  {playersInQuarter.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {playersInQuarter.map((id) => {
                        const p = roster.find((r) => r.id === id);
                        if (!p) return null;
                        const qStats = getQuarterStats(id, q);
                        return (
                          <div
                            key={`${q}-${id}`}
                            className="bg-white border border-slate-200 px-3 py-2 rounded-lg flex items-center justify-between shadow-sm"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className="text-xs font-black text-slate-400">
                                #{p.jersey}
                              </span>
                              <span className="text-sm font-bold text-slate-800 truncate">
                                {p.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 border-l border-slate-200 pl-3 shrink-0">
                              <div className="flex flex-col items-center justify-center">
                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none">
                                  Min
                                </span>
                                <span className="text-sm font-black text-blue-600 leading-none mt-0.5">
                                  {qStats.qTime}
                                </span>
                              </div>
                              <div className="flex flex-col items-center justify-center ml-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none">
                                  Pts
                                </span>
                                <span className="text-sm font-black text-slate-700 leading-none mt-0.5">
                                  {qStats.qPts}
                                </span>
                              </div>
                              <div className="flex flex-col items-center justify-center ml-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none">
                                  TO
                                </span>
                                <span
                                  className={`text-sm font-black leading-none mt-0.5 ${qStats.qTOs > 0 ? "text-orange-500" : "text-slate-700"}`}
                                >
                                  {qStats.qTOs}
                                </span>
                              </div>
                              <div className="flex flex-col items-center justify-center ml-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none">
                                  Fls
                                </span>
                                <span
                                  className={`text-sm font-black leading-none mt-0.5 ${qStats.qFls > 0 ? "text-red-500" : "text-slate-700"}`}
                                >
                                  {qStats.qFls}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-6 opacity-50">
                      <Target size={24} className="mb-2" />
                      <p className="text-xs font-bold uppercase tracking-widest text-center">
                        No Activity Recorded
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. TAB 3: TIMELINE (Play-by-play) */}
      {activeTab === "timeline" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-wider text-sm">
              <History size={18} className="text-blue-600" /> Game Timeline
            </h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {actionHistory.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-bold">
                No events recorded yet.
              </div>
            ) : (
              [...actionHistory].reverse().map((action, idx) => {
                const p = roster.find((r) => r.id === action.playerId);
                return (
                  <div
                    key={idx}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-900 text-amber-400 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">
                        Q{action.quarter}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-blue-600 tabular-nums">
                          {formatTime(action.clock)}
                        </span>
                        <span className="text-sm font-bold text-slate-800">
                          {p ? `${p.name} (#${p.jersey})` : "Unknown Player"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          action.type === "score"
                            ? "bg-emerald-100 text-emerald-700"
                            : action.type === "fouls"
                              ? "bg-red-100 text-red-700"
                              : action.type === "turnovers"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {action.type === "score"
                          ? `+${action.amount} Points`
                          : action.type === "fouls"
                            ? "Foul"
                            : action.type === "turnovers"
                              ? "Turnover"
                              : action.type}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 5. ACTION ZONE (Save & Reset) */}
      <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-slate-200 mt-8 gap-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-2 sm:order-1">
          <button
            onClick={resetGame}
            className="bg-white border-2 border-red-200 hover:bg-red-50 hover:border-red-500 text-red-600 font-black py-3 px-6 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <Trash2 size={18} /> {isHistory ? "Close Report" : "Trash Game"}
          </button>
        </div>

        {!isHistory && (
          <button
            onClick={onSaveClick} // This now directly calls the triggerSaveGame prop
            className="w-full sm:w-auto order-1 sm:order-2 font-black py-3 px-8 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-white bg-blue-600 hover:bg-blue-700 active:scale-95"
          >
            {/* The saving animation/text will now be handled by the InputModal in App.jsx */}
            <CloudUpload size={20} /> Save Game to History
          </button>
        )}
      </div>
    </div>
  );
}
