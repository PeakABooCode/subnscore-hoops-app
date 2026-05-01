import React, { useState, useMemo } from "react";
import {
  formatTime,
  QUARTER_SECONDS,
  calculateLineupStats,
} from "../../utils/helpers";
import {
  ClipboardList, // This is coachingQuarter
  Users,
  Clock,
  Trash2,
  Target,
  CloudUpload,
  Activity,
  History,
  Group, // For Lineups tab
  TrendingUp,
  Trophy,
  Timer,
} from "lucide-react";
import ConfirmationModal from "../common/ConfirmationModal";

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
  deleteAction, // Prop to delete specific action from App.jsx
  court = [], // Active players on court
  isHistory, // Prop to detect if we are viewing a past game
  historyQuarterStats, // New prop for pre-calculated quarter data
  gameMode = "FULL", // FULL, HALF, or OPEN
}) {
  const [activeTab, setActiveTab] = useState("boxscore");
  const [touchStart, setTouchStart] = useState(null);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);

  // Define the logical order of tabs for swipe navigation
  const tabs = ["boxscore", "quarters", "timeline", "lineups"];

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    const threshold = 80; // Minimum distance in pixels to trigger a swipe

    const currentIndex = tabs.indexOf(activeTab);
    if (diff > threshold && currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]); // Swipe Left -> Next Tab
    } else if (diff < -threshold && currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]); // Swipe Right -> Previous Tab
    }
    setTouchStart(null);
  };

  const [lineupSortBy, setLineupSortBy] = useState("eff"); // eff, pts, time, to, fls, pm

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

  // Sort roster for Box Score by efficiency (EFF = score - turnovers)
  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => {
      const statsA = playerStats[a.id] || { score: 0, turnovers: 0 };
      const statsB = playerStats[b.id] || { score: 0, turnovers: 0, fouls: 0 };
      const effA =
        (statsA.score || 0) - (statsA.turnovers || 0) - (statsA.fouls || 0);
      const effB =
        (statsB.score || 0) - (statsB.turnovers || 0) - (statsB.fouls || 0);
      // Secondary sort by points if efficiency is equal
      return effB - effA || (statsB.score || 0) - (statsA.score || 0);
    });
  }, [roster, playerStats]);

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

  const quarterData = useMemo(() => {
    const quarters = {};
    const maxQ = Math.max(quarter, ...stints.map((s) => s.quarter));
    for (let i = 1; i <= maxQ; i++) {
      quarters[i] = [];
    }

    stints.forEach((stint) => {
      if (!quarters[stint.quarter]) quarters[stint.quarter] = [];
      if (!quarters[stint.quarter].includes(stint.playerId)) {
        quarters[stint.quarter].push(stint.playerId);
      }
    });

    // Ensure players with actions are also included just in case they had no measurable stint
    actionHistory.forEach((action) => {
      if (action.playerId && action.quarter) {
        if (!quarters[action.quarter]) quarters[action.quarter] = [];
        if (!quarters[action.quarter].includes(action.playerId)) {
          quarters[action.quarter].push(action.playerId);
        }
      }
    });
    return quarters;
  }, [quarter, actionHistory, stints]);

  const getQuarterStats = (
    playerId,
    qtr,
    startLimit = QUARTER_SECONDS,
    endLimit = 0,
  ) => {
    let qPts = 0;
    let qFls = 0;
    let qTOs = 0;
    let qSecs = 0;

    actionHistory.forEach((action) => {
      if (
        action.playerId === playerId &&
        action.quarter === qtr &&
        action.clock <= startLimit &&
        action.clock > endLimit
      ) {
        if (action.type === "score") qPts += action.amount;
        if (action.type === "fouls") qFls += action.amount;
        if (action.type === "turnovers") qTOs += action.amount;
      }
    });

    stints
      .filter((s) => s.playerId === playerId && s.quarter === qtr)
      .forEach((s) => {
        const sOut =
          s.clockOut !== null ? s.clockOut : qtr === quarter ? clock : 0;
        const overlapIn = Math.min(startLimit, s.clockIn);
        const overlapOut = Math.max(endLimit, sOut);
        if (overlapIn > overlapOut) qSecs += overlapIn - overlapOut;
      });

    return { qPts, qFls, qTOs, qTime: formatTime(qSecs), rawSecs: qSecs };
  };

  const onSaveClick = async () => {
    setIsSaveConfirmOpen(true);
  };

  // Calculate lineup stats
  const lineupStats = useMemo(
    () => calculateLineupStats(roster, stints, actionHistory, quarter, clock),
    [roster, stints, actionHistory, quarter, clock],
  );

  // Find champions for highlighting
  const { maxPM, maxTime } = useMemo(() => {
    const pm = Math.max(
      ...lineupStats.map((l) => l.pointsScored - (l.pointsAgainst || 0)),
      0,
    );
    const time = Math.max(...lineupStats.map((l) => l.totalTime), 1);
    return { maxPM: pm, maxTime: time };
  }, [lineupStats]);

  // Advanced sorting logic for lineups
  const sortedLineups = useMemo(() => {
    return [...lineupStats].sort((a, b) => {
      const getEff = (l) => l.pointsScored - (l.turnovers || 0);

      switch (lineupSortBy) {
        case "pts":
          return b.pointsScored - a.pointsScored || b.totalTime - a.totalTime;
        case "pm":
          return (
            b.pointsScored -
            (b.pointsAgainst || 0) -
            (a.pointsScored - (a.pointsAgainst || 0))
          );
        case "time":
          return b.totalTime - a.totalTime || b.pointsScored - a.pointsScored;
        case "to":
          return (b.turnovers || 0) - (a.turnovers || 0);
        case "fls":
          return (b.fouls || 0) - (a.fouls || 0);
        case "eff":
        default:
          const effA = getEff(a);
          const effB = getEff(b);
          return effB - effA || b.pointsScored - a.pointsScored;
      }
    });
  }, [lineupStats, lineupSortBy]);

  // Simple visual trend component
  const TrendSparkline = ({ trend = [0] }) => {
    if (trend.length < 2)
      return <div className="w-12 h-1 bg-slate-200 rounded-full opacity-40" />;

    const max = Math.max(...trend, 1);
    const points = trend
      .map((val, i) => {
        const x = (i / (trend.length - 1)) * 48;
        const y = 16 - (val / max) * 12 - 2; // Offset for stroke width
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg
        width="48"
        height="16"
        viewBox="0 0 48 16"
        className="overflow-visible"
      >
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  const currentLineupKey = !isHistory ? [...court].sort().join("-") : "";

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
            <span>
              {teamMeta?.season
                ? teamMeta.season.toString().toLowerCase().includes("season")
                  ? teamMeta.season
                  : `Season ${teamMeta.season}`
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
          className={`flex-1 py-2.5 md:py-3 text-[10px] md:text-sm font-black uppercase tracking-tight md:tracking-widest rounded-lg flex items-center justify-center gap-1 md:gap-2 transition-all ${
            activeTab === "boxscore"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-300/50"
          }`}
        >
          <ClipboardList size={16} className="md:w-[18px] md:h-[18px]" />{" "}
          <span className="truncate">Box Score</span>
        </button>
        <button
          onClick={() => setActiveTab("quarters")}
          className={`flex-1 py-2.5 md:py-3 text-[10px] md:text-sm font-black uppercase tracking-tight md:tracking-widest rounded-lg flex items-center justify-center gap-1 md:gap-2 transition-all ${
            activeTab === "quarters"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-300/50"
          }`}
        >
          <Clock size={16} className="md:w-[18px] md:h-[18px]" />{" "}
          <span className="truncate">Quarters</span>
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`flex-1 py-2.5 md:py-3 text-[10px] md:text-sm font-black uppercase tracking-tight md:tracking-widest rounded-lg flex items-center justify-center gap-1 md:gap-2 transition-all ${
            activeTab === "timeline"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-300/50"
          }`}
        >
          <History size={16} className="md:w-[18px] md:h-[18px]" />{" "}
          <span className="truncate">Timeline</span>
        </button>
        <button
          onClick={() => setActiveTab("lineups")}
          className={`flex-1 py-2.5 md:py-3 text-[10px] md:text-sm font-black uppercase tracking-tight md:tracking-widest rounded-lg flex items-center justify-center gap-1 md:gap-2 transition-all ${
            activeTab === "lineups"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-300/50"
          }`}
        >
          <Group size={16} className="md:w-[18px] md:h-[18px]" />{" "}
          <span className="truncate">Lineups</span>
        </button>
      </div>

      {/* 3. CONTENT AREA WITH SWIPE GESTURES */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="touch-pan-y transition-all duration-300"
      >
        {/* TAB 1: BOX SCORE */}
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
              {sortedRoster.map((p) => {
                const stats = playerStats[p.id] || {
                  score: 0,
                  fouls: 0,
                  turnovers: 0,
                  minutes: "0:00",
                };
                const displayMins =
                  isHistory && stats.minutes // Check if stats.minutes exists for history
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
                    <div className="grid grid-cols-4 gap-2">
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
                      <div className="bg-blue-50 p-2 rounded-xl text-center border border-blue-100">
                        <div className="text-[10px] font-black text-blue-400 uppercase leading-none mb-1">
                          EFF
                        </div>
                        <div className="text-xl font-black text-blue-700">
                          {stats.score - (stats.turnovers || 0)}
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
                    <th className="p-4 font-black text-center">EFF</th>
                    <th className="p-4 font-black text-center">Total Min</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRoster.map((p) => {
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
                          <span className="inline-flex items-center justify-center bg-blue-100 text-blue-800 w-10 h-10 rounded-lg font-black text-lg">
                            {stats.score - (stats.turnovers || 0)}
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

              // Determine if this specific quarter should be segmented
              const isSegmented =
                (gameMode === "FULL" && q <= 3) ||
                (gameMode === "HALF" && q <= 2);

              const renderStintList = (start, end, label) => {
                const stintPlayers = playersInQuarter.filter((id) => {
                  const stats = getQuarterStats(id, q, start, end);
                  return stats.rawSecs > 0;
                });

                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <div className="h-px flex-1 bg-slate-200"></div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {label}
                      </span>
                      <div className="h-px flex-1 bg-slate-200"></div>
                    </div>
                    {stintPlayers.length > 0 ? (
                      stintPlayers.map((id) => {
                        const p = roster.find((r) => r.id === id);
                        const qStats = getQuarterStats(id, q, start, end);
                        return (
                          <div
                            key={`${q}-${label}-${id}`}
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
                      })
                    ) : (
                      <p className="text-[10px] text-slate-300 italic text-center py-2">
                        No activity in this stint
                      </p>
                    )}
                  </div>
                );
              };

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
                      <div className="flex flex-col gap-4">
                        {isSegmented ? (
                          <>
                            {renderStintList(
                              600,
                              300,
                              "Stint 1 (10:00 - 5:00)",
                            )}
                            {renderStintList(300, 0, "Stint 2 (5:00 - 0:00)")}
                          </>
                        ) : (
                          playersInQuarter.map((id) => {
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
                          })
                        )}
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
                            {action.type === "opp_score"
                              ? `${teamMeta.opponent || "Opponent"} Score`
                              : p
                                ? `${p.name} (#${p.jersey})`
                                : "Unknown Player"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            action.type === "score"
                              ? "bg-emerald-100 text-emerald-700"
                              : action.type === "opp_score"
                                ? "bg-slate-900 text-slate-100"
                                : action.type === "fouls"
                                  ? "bg-red-100 text-red-700"
                                  : action.type === "turnovers"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {action.type === "score"
                            ? `+${action.amount} Points`
                            : action.type === "opp_score"
                              ? `Opp +${action.amount}`
                              : action.type === "fouls"
                                ? "Foul"
                                : action.type === "turnovers"
                                  ? "Turnover"
                                  : action.type === "SUB_IN"
                                    ? "Sub In"
                                    : action.type === "SUB_OUT"
                                      ? "Sub Out"
                                      : action.type === "TIMEOUT"
                                        ? "Timeout"
                                        : action.type}
                        </span>

                        {/* Selective Deletion: Hide for substitutions and historical archives */}
                        {!isHistory &&
                          (action.type === "score" ||
                            action.type === "opp_score" ||
                            action.type === "fouls" ||
                            action.type === "turnovers" ||
                            action.type === "TIMEOUT") && (
                            <button
                              onClick={() => {
                                // Because the list is reversed for display, we calculate the original index
                                const originalIndex =
                                  actionHistory.length - 1 - idx;
                                deleteAction(originalIndex);
                              }}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete Action"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 6. TAB 4: LINEUP ANALYSIS */}
        {activeTab === "lineups" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-wider text-sm">
                  <Group size={18} className="text-blue-600" /> Lineup Analysis
                </h3>

                {/* Quick Sort Buttons */}
                <div className="flex bg-white border border-slate-200 p-1 rounded-lg shadow-sm overflow-x-auto no-scrollbar">
                  {[
                    { id: "eff", label: "Most EFF" },
                    { id: "pm", label: "+/-" },
                    { id: "pts", label: "PTS" },
                    { id: "time", label: "TIME" },
                    { id: "to", label: "TO" },
                    { id: "fls", label: "FLS" },
                  ].map((sort) => (
                    <button
                      key={sort.id}
                      onClick={() => setLineupSortBy(sort.id)}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tight transition-all whitespace-nowrap ${
                        lineupSortBy === sort.id
                          ? "bg-blue-600 text-white shadow-md"
                          : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {sort.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
              {sortedLineups.length === 0 ? (
                <div className="p-10 text-center text-slate-400 font-bold">
                  No 5-player lineups recorded yet.
                </div>
              ) : (
                sortedLineups.map((lineup, idx) => {
                  const lineupKey = lineup.players
                    .map((p) => p.id)
                    .sort()
                    .join("-");
                  const isCurrent =
                    !isHistory && lineupKey === currentLineupKey;
                  const diff =
                    lineup.pointsScored - (lineup.pointsAgainst || 0);

                  // Highlights
                  const isTopPerformer = diff > 0 && diff === maxPM;
                  const isMostUsed =
                    lineup.totalTime === maxTime && lineup.totalTime > 0;

                  return (
                    <div
                      key={lineupKey}
                      className={`p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between hover:bg-slate-50 transition-all gap-4 border-l-4 ${
                        isCurrent
                          ? "bg-blue-50/50 border-blue-500 shadow-inner"
                          : isTopPerformer
                            ? "bg-emerald-50/30 border-emerald-500"
                            : isMostUsed
                              ? "bg-amber-50/30 border-amber-500"
                              : "border-transparent"
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-2 mb-1">
                          {isCurrent && (
                            <span className="flex items-center gap-1 text-[8px] font-black bg-blue-600 text-white px-2 py-0.5 rounded uppercase tracking-tighter">
                              <Activity size={8} /> On Court
                            </span>
                          )}
                          {isTopPerformer && (
                            <span className="flex items-center gap-1 text-[8px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm">
                              <Trophy size={8} /> Top Efficiency
                            </span>
                          )}
                          {isMostUsed && (
                            <span className="flex items-center gap-1 text-[8px] font-black bg-amber-500 text-slate-900 px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm">
                              <Timer size={8} /> Most Used
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {lineup.players.map((p) => (
                            <div
                              key={p.id}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black border transition-all ${
                                isCurrent
                                  ? "bg-blue-600 text-white border-blue-400"
                                  : "bg-white text-slate-700 border-slate-200 shadow-sm"
                              }`}
                            >
                              <span
                                className={
                                  isCurrent ? "text-blue-200" : "text-blue-600"
                                }
                              >
                                #{p.jersey}
                              </span>
                              <span className="truncate max-w-[80px]">
                                {p.name.split(" ")[0]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white lg:bg-transparent border lg:border-0 border-slate-50">
                          <span className="text-[8px] font-black uppercase text-slate-400 mb-1">
                            +/-
                          </span>
                          <span
                            className={`text-lg font-black leading-none ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-slate-400"}`}
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[8px] font-black uppercase text-slate-400">
                            Trend
                          </span>
                          <TrendSparkline trend={lineup.pointsTrend} />
                        </div>

                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[8px] font-black uppercase text-slate-400">
                            Time
                          </span>
                          <span className="text-xs font-black text-slate-700">
                            {formatTime(lineup.totalTime)}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[8px] font-black uppercase text-slate-400">
                            Pts
                          </span>
                          <span className="text-xs font-black text-slate-700">
                            {lineup.pointsScored}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[8px] font-black uppercase text-slate-400">
                            TO/FLS
                          </span>
                          <span className="text-xs font-black text-slate-500">
                            {lineup.turnovers || 0} / {lineup.fouls || 0}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-slate-900 rounded-lg px-2 py-1">
                          <span className="text-[8px] font-black uppercase text-slate-400">
                            PPM
                          </span>
                          <span className="text-xs font-black text-amber-400">
                            {lineup.totalTime > 0
                              ? (
                                  lineup.pointsScored /
                                  (lineup.totalTime / 60)
                                ).toFixed(1)
                              : "0.0"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

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

      <ConfirmationModal
        isOpen={isSaveConfirmOpen}
        onClose={() => setIsSaveConfirmOpen(false)}
        onConfirm={() => {
          triggerSaveGame();
          setIsSaveConfirmOpen(false);
        }}
        title="Save Game Record"
        message="Are you sure you want to permanently save this game to your History? Make sure all scores and actions are correct."
        confirmText="Save Game"
        confirmButtonClass="bg-blue-600 hover:bg-blue-700"
      />
    </div>
  );
}
