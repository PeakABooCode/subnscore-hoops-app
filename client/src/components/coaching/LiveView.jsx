// 📦 IMPORTS: We bring in React, some icons (like Play, Pause, Users), and a tool to format time (like 10:00).
import React, { useMemo, useState } from "react";
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
  ShieldAlert,
  Edit3,
} from "lucide-react";
import { formatTime, QUARTER_SECONDS } from "../../utils/helpers";
import InputModal from "../common/InputModal";

// 🏀 LIVEVIEW COMPONENT: This is the main screen the coach uses during the game.
// All these variables inside the parentheses are passed down from the main App.jsx file.
export default function LiveView({
  court,
  roster,
  playerStats,
  clock,
  setClock,
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
  addScoreAdjust,
  actionHistory = [],
  stints = [],
}) {
  // 🧮 CALCULATIONS: These variables automatically update whenever a player does something.

  // 🕒 CLOCK EDITING STATE
  const [isEditClockOpen, setIsEditClockOpen] = useState(false);

  const handleSaveClock = (val) => {
    let newSeconds = clock;
    if (val.includes(":")) {
      const parts = val.split(":");
      const mins = parseInt(parts[0], 10);
      const secs = parseInt(parts[1], 10);
      if (!isNaN(mins) && !isNaN(secs)) {
        newSeconds = mins * 60 + secs;
      }
    } else {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) newSeconds = parsed;
    }

    if (newSeconds >= 0) setClock(newSeconds);
  };

  // Adds up all the points scored by every player on our team, plus any manual adjustments.
  const teamTotalScore =
    Object.values(playerStats).reduce(
      (acc, curr) => acc + (curr.score || 0),
      0,
    ) +
    actionHistory
      .filter((a) => a.type === "score_adjust")
      .reduce((acc, a) => acc + (a.amount || 0), 0);

  // Looks through the game history to find and add up all the points the opponent scored.
  const opponentScore = actionHistory
    .filter((a) => a.type === "opp_score")
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // 📈 MOMENTUM CALCULATION (RUNS): This looks backward through the `actionHistory`.
  // If it sees our team scored 4+ points in a row without the opponent scoring,
  // it triggers a "Hot Run" indicator on the screen!
  // 📈 MOMENTUM (RUNS): Checks if our team or their team has scored 4 or more points in a row without the other team scoring.
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

  // ➕/➖ PLUS-MINUS (+/-): This checks who was on the court at the exact second a point was scored.
  // If you are on the court when your team scores, your +/- goes up.
  // If you are on the court when the opponent scores, your +/- goes down.
  // ➕/➖ PLUS-MINUS (+/-): A basketball stat that goes UP when our team scores and DOWN when their team scores, but ONLY for the players currently on the court.
  const playerPlusMinus = useMemo(() => {
    const pm = {};
    roster.forEach((p) => (pm[p.id] = 0));
    actionHistory.forEach((a) => {
      if (a.type === "score" || a.type === "opp_score") {
        const activeStints = stints.filter(
          (s) =>
            s.quarter === a.quarter &&
            s.clockIn >= a.clock &&
            (s.clockOut === null || s.clockOut <= a.clock),
        );
        activeStints.forEach((s) => {
          if (pm[s.playerId] !== undefined) {
            pm[s.playerId] += a.type === "score" ? a.amount : -a.amount;
          }
        });
      }
    });
    return pm;
  }, [actionHistory, stints, roster]);

  // 🔥/❄️ STREAKS: Checks the last few actions. 3 scores in a row = Hot (🔥). 2 turnovers in a row = Cold (❄️).
  const playerStreaks = useMemo(() => {
    const streaks = {};
    roster.forEach((p) => {
      const pActions = actionHistory.filter(
        (a) =>
          a.playerId === p.id && (a.type === "score" || a.type === "turnovers"),
      );
      const last3 = pActions.slice(-3);
      if (last3.length >= 3 && last3.every((a) => a.type === "score"))
        streaks[p.id] = "hot";
      else {
        const last2 = pActions.slice(-2);
        if (last2.length >= 2 && last2.every((a) => a.type === "turnovers"))
          streaks[p.id] = "cold";
      }
    });
    return streaks;
  }, [actionHistory, roster]);

  // 📊 LINEUP PERFORMANCE PANEL: Stats for the current 5-man unit while they've been together.
  const lineupSummary = useMemo(() => {
    if (court.length !== 5) return null;

    // Find each court player's active (open) stint
    const activeStints = court
      .map((id) =>
        [...stints]
          .reverse()
          .find((s) => s.playerId === id && s.clockOut === null),
      )
      .filter(Boolean);

    if (activeStints.length === 0) return null;

    // The unit formed when the LAST player entered — clock counts DOWN, so lowest clockIn = most recent entry
    const unitStartClock = Math.min(...activeStints.map((s) => s.clockIn));
    const unitQuarter =
      activeStints.find((s) => s.clockIn === unitStartClock)?.quarter ??
      quarter;

    // Seconds this unit has been on court together
    const timeTogetherSecs =
      unitQuarter === quarter ? Math.max(0, unitStartClock - clock) : 0;

    // Actions that happened AFTER this unit formed (clock was at or below unitStartClock)
    const unitActions = actionHistory.filter(
      (a) =>
        a.quarter === unitQuarter &&
        a.clock <= unitStartClock &&
        a.clock >= clock,
    );

    const pointsFor = unitActions
      .filter((a) => a.type === "score" || a.type === "score_adjust")
      .reduce((acc, a) => acc + (a.amount || 0), 0);

    const pointsAgainst = unitActions
      .filter((a) => a.type === "opp_score")
      .reduce((acc, a) => acc + (a.amount || 0), 0);

    return {
      timeTogetherSecs,
      pointsFor,
      pointsAgainst,
      plusMinus: pointsFor - pointsAgainst,
    };
  }, [court, stints, actionHistory, clock, quarter]);

  // 🤝 ASSISTED SUB MODE: Works in both directions.
  // Bench-first → suggest best court player to come OUT.
  // Court-first → suggest best bench player to come IN.
  const assistedSuggestion = useMemo(() => {
    if (pendingSwapIds.length !== 1 || court.length !== 5) return null;
    const pendingId = pendingSwapIds[0];
    const isCourtFirst = court.includes(pendingId);

    if (!isCourtFirst) {
      // ── BENCH PLAYER TAPPED ── find best sub-out from court
      const benchId = pendingId;
      const scored = court.map((courtId) => {
        const stats = playerStats[courtId] || { fouls: 0, turnovers: 0 };
        const timePlayed = playerTimes?.[courtId] || 0;
        const pm = playerPlusMinus[courtId] || 0;
        const score =
          (stats.fouls || 0) * 30 +
          timePlayed / 10 +
          Math.max(0, -pm) * 5 +
          (stats.turnovers || 0) * 8;
        let reason;
        if ((stats.fouls || 0) >= 4) reason = `${stats.fouls} fouls`;
        else if ((stats.fouls || 0) >= 3) reason = "Foul risk";
        else if (pm < -2) reason = `${pm} +/-`;
        else reason = `${formatTime(timePlayed)} on court`;
        return { courtId, score, reason };
      });
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      return {
        type: "bench_first",
        benchId,
        courtId: best.courtId,
        reason: best.reason,
        benchPlayer: roster.find((p) => p.id === benchId),
        courtPlayer: roster.find((p) => p.id === best.courtId),
      };
    } else {
      // ── COURT PLAYER TAPPED ── find best sub-in from bench
      const courtId = pendingId;
      const benchPlayers = roster.filter(
        (p) => !court.includes(p.id) && (playerStats[p.id]?.fouls || 0) < 5,
      );
      if (benchPlayers.length === 0) return null;

      const scored = benchPlayers.map((p) => {
        const stats = playerStats[p.id] || { fouls: 0, turnovers: 0 };
        const pm = playerPlusMinus[p.id] || 0;
        // Compute rest time inline (same logic as calculateRestTime)
        const pStints = stints.filter((s) => s.playerId === p.id);
        let restSecs = 0;
        if (pStints.length === 0) {
          for (let q = 1; q < quarter; q++) restSecs += QUARTER_SECONDS;
          restSecs += QUARTER_SECONDS - clock;
        } else {
          const last = pStints[pStints.length - 1];
          if (last.clockOut !== null) {
            if (last.quarter === quarter) {
              restSecs = last.clockOut - clock;
            } else {
              restSecs += last.clockOut;
              for (let q = last.quarter + 1; q < quarter; q++)
                restSecs += QUARTER_SECONDS;
              restSecs += QUARTER_SECONDS - clock;
            }
          }
        }
        const score =
          restSecs / 10 +
          Math.max(0, 4 - (stats.fouls || 0)) * 20 +
          Math.max(0, pm) * 5 +
          Math.max(0, 3 - (stats.turnovers || 0)) * 5;
        let reason;
        if (restSecs > 240) reason = `${formatTime(restSecs)} rested`;
        else if (pm > 2) reason = `+${pm} +/-`;
        else if ((stats.fouls || 0) === 0) reason = "Clean game";
        else reason = `${formatTime(restSecs)} rested`;
        return { benchId: p.id, score, reason };
      });
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      return {
        type: "court_first",
        benchId: best.benchId,
        courtId,
        reason: best.reason,
        benchPlayer: roster.find((p) => p.id === best.benchId),
        courtPlayer: roster.find((p) => p.id === courtId),
      };
    }
  }, [
    pendingSwapIds,
    court,
    playerStats,
    playerTimes,
    playerPlusMinus,
    roster,
    stints,
    quarter,
    clock,
  ]);

  // ⏱️ REST TIMER: This is crucial for coaches to manage player fatigue.
  // It finds the last time a bench player was subbed out, and compares it to the current game clock.
  // If the clock is paused, the timer pauses. It perfectly tracks real game-rest minutes.
  // ⏱️ REST TIMER: Figures out exactly how many minutes and seconds a bench player has been resting.
  const calculateRestTime = (pId) => {
    const pStints = stints.filter((s) => s.playerId === pId);
    if (pStints.length === 0) {
      let restSecs = 0;
      for (let q = 1; q < quarter; q++) restSecs += QUARTER_SECONDS;
      restSecs += QUARTER_SECONDS - clock;
      return formatTime(restSecs);
    }
    const lastStint = pStints[pStints.length - 1];
    if (lastStint.clockOut === null) return "0:00";
    let restSecs = 0;
    if (lastStint.quarter === quarter) {
      restSecs = lastStint.clockOut - clock;
    } else {
      restSecs += lastStint.clockOut;
      for (let q = lastStint.quarter + 1; q < quarter; q++)
        restSecs += QUARTER_SECONDS;
      restSecs += QUARTER_SECONDS - clock;
    }
    return formatTime(restSecs);
  };

  // 🏷️ PERIOD NAMES: Automatically names the periods (e.g., Quarter 4 vs Overtime 1).
  const periodName =
    quarter > 4 ? `Overtime ${quarter - 4}` : `Quarter ${quarter}`;
  const shortPeriodName = quarter > 4 ? `OT ${quarter - 4}` : `Q${quarter}`;
  const nextShortPeriodName =
    quarter >= 4 ? `OT ${quarter - 3}` : `Q${quarter + 1}`;

  // 🎨 THE USER INTERFACE (UI): Everything below this line is what the coach sees on the screen.
  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-24 px-2 lg:px-6">
      {/* 🏆 1. THE SCOREBOARD HEADER: Shows the team names, current scores, and the game clock. It sticks to the top of the screen. */}
      <div className="bg-slate-900 text-white p-3 md:p-5 rounded-2xl shadow-xl border-b-4 border-amber-500 sticky top-16 z-30 transition-all duration-300">
        <div className="flex flex-col gap-3">
          {/* Row 1: Scoreboard */}
          <div className="grid grid-cols-3 items-center gap-2">
            {/* Home Team */}
            <div className="flex flex-col items-center md:items-start min-w-0">
              <span className="text-[9px] md:text-[11px] font-black text-amber-500 uppercase tracking-widest truncate w-full text-center md:text-left">
                {teamMeta.teamName || "HOME"}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => addScoreAdjust(-1)}
                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-red-600 text-white font-black text-base leading-none transition-all active:scale-90 shrink-0"
                  title="Subtract 1 point (score adjust)"
                >
                  −
                </button>
                <span className="text-3xl md:text-5xl font-black tabular-nums">
                  {teamTotalScore}
                </span>
                <button
                  onClick={() => addScoreAdjust(1)}
                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-emerald-600 text-white font-black text-base leading-none transition-all active:scale-90 shrink-0"
                  title="Add 1 point (score adjust)"
                >
                  +
                </button>
              </div>
              {currentRun?.type === "us" && (
                <span className="text-[9px] md:text-xs font-black text-emerald-400 animate-pulse bg-emerald-400/10 px-2 py-0.5 rounded-full mt-1 flex items-center gap-1 shadow-sm border border-emerald-400/20">
                  <TrendingUp size={10} /> {currentRun.points}-0 RUN
                </span>
              )}
            </div>

            {/* Center Clock */}
            <div
              className="flex flex-col items-center bg-slate-800 py-1 md:py-2 rounded-xl border border-slate-700 relative group cursor-pointer hover:bg-slate-700 transition-colors"
              title="Click to edit clock"
              onClick={() => {
                setIsRunning(false); // Pause clock while editing
                setIsEditClockOpen(true);
              }}
            >
              <div className="absolute top-2 right-2 md:top-3 md:right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                <Edit3 size={14} />
              </div>
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

          {/* ⚙️ REAL-TIME CONTROLS: Buttons to pause/start the game clock and add opponent scores. */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2">
            <div className="flex gap-2">
              <button
                title={
                  court.length !== 5
                    ? "Select 5 players to start"
                    : isRunning
                      ? "Pause Clock"
                      : "Start Clock"
                }
                onClick={() => setIsRunning(!isRunning)}
                disabled={court.length !== 5}
                className={`h-10 px-4 md:px-6 rounded-xl transition-all shadow-lg flex items-center gap-2 ${
                  court.length !== 5
                    ? "bg-slate-600 text-slate-400 cursor-not-allowed opacity-50"
                    : isRunning
                      ? "bg-red-500 active:scale-95"
                      : "bg-emerald-500 active:scale-95"
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

      {/* 📱 MAIN CONTENT GRID: Arranges the court and bench side-by-side on big screens, or stacked on phones. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 🏃‍♂️ 2. ON-COURT SECTION: Displays the 5 players currently playing in the game. */}
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

          {/* 📊 LINEUP PERFORMANCE PANEL: Shows stats for the current 5-man unit. */}
          {court.length === 5 && lineupSummary && (
            <div className="bg-slate-900 rounded-2xl px-4 py-3 border border-slate-700 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                  <Activity size={10} /> Current Unit
                </span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  As a lineup
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-700">
                {/* +/- */}
                <div className="flex flex-col items-center pr-4">
                  <span
                    className={`text-2xl font-black tabular-nums leading-none ${
                      lineupSummary.plusMinus > 0
                        ? "text-emerald-400"
                        : lineupSummary.plusMinus < 0
                          ? "text-red-400"
                          : "text-white"
                    }`}
                  >
                    {lineupSummary.plusMinus > 0 ? "+" : ""}
                    {lineupSummary.plusMinus}
                  </span>
                  <span className="text-[8px] font-black text-slate-500 uppercase mt-1">
                    +/-
                  </span>
                </div>
                {/* Time together */}
                <div className="flex flex-col items-center px-4">
                  <span className="text-2xl font-black text-amber-400 tabular-nums leading-none">
                    {formatTime(lineupSummary.timeTogetherSecs)}
                  </span>
                  <span className="text-[8px] font-black text-slate-500 uppercase mt-1">
                    mins on
                  </span>
                </div>
                {/* Run (points for - against) */}
                <div className="flex flex-col items-center pl-4">
                  <span className="text-2xl font-black text-white tabular-nums leading-none">
                    {lineupSummary.pointsFor}
                    <span className="text-slate-500">-</span>
                    {lineupSummary.pointsAgainst}
                  </span>
                  <span className="text-[8px] font-black text-slate-500 uppercase mt-1">
                    run
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* If no one is on the court yet (like at the start of the game), show this message. */}
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

          {/* Loop through the 'court' list and create a Player Card for everyone currently playing. */}
          {[...court]
            .sort((a, b) => {
              const pa = roster.find((r) => r.id === a);
              const pb = roster.find((r) => r.id === b);
              return (
                parseInt(pa?.jersey || "0", 10) -
                parseInt(pb?.jersey || "0", 10)
              );
            })
            .map((id) => {
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
              const isSuggestedOut = assistedSuggestion?.courtId === id;
              const timePlayed = playerTimes?.[id] || 0;
              const pm = playerPlusMinus[id] || 0;
              const streak = playerStreaks[id];

              return (
                <React.Fragment key={id}>
                  {/* 🤝 ASSISTED SUB BANNER — only shown here for court-first taps */}
                  {isSuggestedOut && assistedSuggestion?.type === "court_first" && (
                    <div className="bg-blue-600 text-white rounded-2xl p-4 shadow-lg border border-blue-500">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[9px] font-black text-blue-200 uppercase tracking-[0.2em]">
                            Assisted Sub
                          </span>
                          {assistedSuggestion.type === "bench_first" ? (
                            <>
                              <div className="font-black text-base leading-tight mt-0.5 truncate">
                                #{assistedSuggestion.benchPlayer?.jersey}{" "}
                                {assistedSuggestion.benchPlayer?.name}{" "}
                                <span className="text-blue-300">IN</span>
                              </div>
                              <div className="text-sm text-blue-100 mt-0.5 truncate">
                                → Suggested OUT: #{assistedSuggestion.courtPlayer?.jersey}{" "}
                                {assistedSuggestion.courtPlayer?.name}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-black text-base leading-tight mt-0.5 truncate">
                                #{assistedSuggestion.courtPlayer?.jersey}{" "}
                                {assistedSuggestion.courtPlayer?.name}{" "}
                                <span className="text-blue-300">OUT</span>
                              </div>
                              <div className="text-sm text-blue-100 mt-0.5 truncate">
                                → Suggested IN: #{assistedSuggestion.benchPlayer?.jersey}{" "}
                                {assistedSuggestion.benchPlayer?.name}
                              </div>
                            </>
                          )}
                          <div className="text-[10px] font-black text-blue-300 uppercase tracking-wider mt-1">
                            Why: {assistedSuggestion.reason}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSwap(
                              assistedSuggestion.type === "bench_first"
                                ? assistedSuggestion.courtId
                                : assistedSuggestion.benchId,
                            );
                          }}
                          className="min-h-[52px] px-5 bg-white text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-blue-50 active:scale-95 transition-all shrink-0"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}
                <div
                  onClick={() => handleSwap(id)}
                  className={`p-3 md:p-4 border-2 rounded-2xl transition-all shadow-sm flex flex-col gap-2.5 cursor-pointer ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100 scale-[1.01]"
                      : isSuggestedOut
                        ? "border-amber-400 bg-amber-50 ring-2 ring-amber-200"
                        : "bg-white border-slate-100 hover:border-slate-200"
                  }`}
                >
                  {/* — Row 1: Player Identity — */}
                  <div className="flex items-center justify-between min-w-0">
                    <span className="font-black text-slate-800 text-lg md:text-xl truncate">
                      #{p.jersey} {p.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isSuggestedOut && (
                        <span className="text-[8px] font-black bg-amber-400 text-slate-900 px-2 py-0.5 rounded uppercase tracking-widest">
                          Sub Out
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                        {isSelected ? "Select sub ▸" : "Tap to sub"}
                      </span>
                    </div>
                  </div>

                  {/* — Row 2: Decision Signals — */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-slate-900 text-amber-400 px-2 py-1 rounded-lg border border-slate-700">
                      <span className="text-[11px] font-black tabular-nums">
                        {stats.score} PTS
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border border-blue-100">
                      <Clock size={11} className="shrink-0" />
                      <span className="text-[11px] font-black tabular-nums">
                        {formatTime(timePlayed)}
                      </span>
                    </div>
                    <div
                      className={`px-2 py-1 rounded-lg border text-[11px] font-black ${
                        pm > 0
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : pm < 0
                            ? "bg-red-50 text-red-600 border-red-100"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      +/- {pm > 0 ? `+${pm}` : pm}
                    </div>
                    {streak === "hot" && (
                      <span
                        className="text-base animate-bounce"
                        title="Hot Hand (3+ Scores)"
                      >
                        🔥
                      </span>
                    )}
                    {streak === "cold" && (
                      <span
                        className="text-base animate-pulse"
                        title="Cold Streak (2+ TOs)"
                      >
                        ❄️
                      </span>
                    )}
                  </div>

                  {/* — Row 3: Score Buttons — */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl gap-1"
                  >
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

                  {/* — Row 4: TO & Foul — */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="grid grid-cols-2 gap-2"
                  >
                    <button
                      onClick={() => addStat(id, "turnovers", 1)}
                      className="h-11 rounded-xl border-2 flex items-center justify-center gap-2 transition-all active:scale-95 bg-orange-50 border-orange-100 text-orange-600 hover:bg-orange-100"
                    >
                      <span className="text-[10px] font-black uppercase">
                        TO
                      </span>
                      <span className="font-black text-xl leading-none">
                        {stats.turnovers || 0}
                      </span>
                    </button>
                    <button
                      onClick={() => addStat(id, "fouls", 1)}
                      className={`h-11 rounded-xl border-2 flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        stats.fouls >= 4
                          ? "bg-red-600 border-red-600 text-white"
                          : "bg-red-50 border-red-100 text-red-600 hover:bg-red-100"
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase">
                        Foul
                      </span>
                      <span className="font-black text-xl leading-none">
                        {stats.fouls}
                      </span>
                    </button>
                  </div>
                </div>
                </React.Fragment>
              );
            })}
        </div>

        {/* 🪑 3. BENCH SECTION (SIDEBAR): Shows players waiting to sub in, and tracks team fouls/timeouts. */}
        <div className="space-y-6">
          {/* Bench Section */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
              Available Bench
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {/* Look through the whole roster, but only show players who are NOT on the court. */}
              {roster
                .filter((p) => !court.includes(p.id))
                .sort(
                  (a, b) =>
                    parseInt(a.jersey || "0", 10) -
                    parseInt(b.jersey || "0", 10),
                )
                .map((p) => {
                  const isSelected = pendingSwapIds.includes(p.id);
                  const isSuggestedIn =
                    assistedSuggestion?.type === "court_first" &&
                    assistedSuggestion?.benchId === p.id;
                  const stats = playerStats[p.id] || {
                    score: 0,
                    fouls: 0,
                    turnovers: 0,
                  };
                  const timePlayed = playerTimes?.[p.id] || 0;
                  const restTime = calculateRestTime(p.id);
                  const pm = playerPlusMinus[p.id] || 0;
                  const streak = playerStreaks[p.id];
                  const isFouledOut = stats.fouls >= 5;
                  const isBenchTapped =
                    assistedSuggestion?.type === "bench_first" &&
                    assistedSuggestion?.benchId === p.id;
                  return (
                    <React.Fragment key={p.id}>
                      {/* 🤝 ASSISTED SUB BANNER — inline above the tapped bench player */}
                      {isBenchTapped && (
                        <div className="bg-blue-600 text-white rounded-2xl p-4 shadow-lg border border-blue-500">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-[9px] font-black text-blue-200 uppercase tracking-[0.2em]">
                                Assisted Sub
                              </span>
                              <div className="font-black text-base leading-tight mt-0.5 truncate">
                                #{assistedSuggestion.benchPlayer?.jersey}{" "}
                                {assistedSuggestion.benchPlayer?.name}{" "}
                                <span className="text-blue-300">IN</span>
                              </div>
                              <div className="text-sm text-blue-100 mt-0.5 truncate">
                                → Suggested OUT: #{assistedSuggestion.courtPlayer?.jersey}{" "}
                                {assistedSuggestion.courtPlayer?.name}
                              </div>
                              <div className="text-[10px] font-black text-blue-300 uppercase tracking-wider mt-1">
                                Why: {assistedSuggestion.reason}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSwap(assistedSuggestion.courtId);
                              }}
                              className="min-h-[52px] px-5 bg-white text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-blue-50 active:scale-95 transition-all shrink-0"
                            >
                              Confirm
                            </button>
                          </div>
                        </div>
                      )}
                    <button
                      onClick={() => handleSwap(p.id)}
                      disabled={isRunning || isFouledOut}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        isFouledOut
                          ? "bg-red-50 border-red-200 opacity-50 grayscale cursor-not-allowed"
                          : isSuggestedIn
                            ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200 shadow-md"
                            : isSelected
                              ? "border-blue-500 bg-blue-50 shadow-md"
                              : "bg-white border-slate-100 hover:border-blue-300"
                      } ${isRunning && !isFouledOut ? "opacity-40 grayscale" : ""} ${!isRunning && !isFouledOut ? "active:scale-95" : ""}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col items-start">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-800 text-sm truncate">
                              #{p.jersey} {p.name}
                            </span>
                            {isSuggestedIn && (
                              <span className="text-[8px] font-black bg-emerald-400 text-slate-900 px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">
                                Sub In
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded border ${pm > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : pm < 0 ? "bg-red-50 text-red-600 border-red-100" : "bg-slate-100 text-slate-500 border-slate-200"}`}
                            >
                              +/- ({pm > 0 ? `+${pm}` : pm})
                            </span>
                            {streak === "hot" && (
                              <span
                                className="text-base animate-bounce"
                                title="Hot Hand (3+ Scores)"
                              >
                                🔥
                              </span>
                            )}
                            {streak === "cold" && (
                              <span
                                className="text-base animate-pulse"
                                title="Cold Streak (2+ TOs)"
                              >
                                ❄️
                              </span>
                            )}
                          </div>
                        </div>
                        {stats.fouls >= 4 && (
                          <span className="text-[8px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 uppercase flex items-center gap-1 shadow-sm animate-pulse shrink-0 ml-2">
                            <ShieldAlert size={10} />{" "}
                            {stats.fouls >= 5 ? "Fouled Out" : "Foul Trouble"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 mt-2 border-t pt-2 border-slate-100">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500 uppercase">
                            <Clock size={10} className="shrink-0" />
                            <span className="tabular-nums">
                              {formatTime(timePlayed)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase">
                            <span>Rest: {restTime}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-500">
                            PTS: {stats.score}
                          </span>
                          <span className="text-[10px] font-bold text-orange-500">
                            TO: {stats.turnovers || 0}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${stats.fouls >= 4 ? "text-red-600" : "text-slate-500"}`}
                          >
                            FLS: {stats.fouls}
                          </span>
                        </div>
                      </div>
                    </button>
                    </React.Fragment>
                  );
                })}
            </div>
          </div>

          {/* Team Stats Box */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 shadow-xl border-l-4 border-red-500">
            <div className="flex justify-between items-center bg-slate-800 p-3 rounded-xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Team Fouls {quarter >= 4 ? "4th+OT" : shortPeriodName}
              </span>
              <span
                className={`text-2xl font-black ${(teamFouls[Math.min(quarter, 4)] || 0) >= 5 ? "text-red-500 animate-pulse" : "text-white"}`}
              >
                {teamFouls[Math.min(quarter, 4)] || 0}
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

          {/* Advance Quarter Button 
          <button
            onClick={() => advanceQuarter()}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95"
          >
            Advance to {nextShortPeriodName}
          </button>
          */}
        </div>
      </div>

      {/* 🚨 4. SMARTPHONE WARNING: A floating red bar that warns the coach if they try to substitute while the clock is running. */}
      {isRunning && (
        <div className="fixed bottom-6 left-6 right-6 lg:left-auto lg:w-80 bg-red-600 text-white py-3 px-6 rounded-full text-center text-[10px] font-black uppercase tracking-widest shadow-2xl z-50 animate-pulse border-2 border-white/20 flex items-center justify-center gap-2">
          <AlertCircle size={14} /> Clock Running • Subs Locked
        </div>
      )}

      {/* 5. MODALS */}
      <InputModal
        isOpen={isEditClockOpen}
        onClose={() => setIsEditClockOpen(false)}
        onSave={handleSaveClock}
        title="Edit Game Clock"
        message="Enter the exact time in MM:SS format."
        initialValue={formatTime(clock)}
        placeholder="e.g. 09:45"
      />
    </div>
  );
}
