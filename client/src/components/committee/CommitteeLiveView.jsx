import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  ArrowLeft,
  ArrowRight,
  Undo2,
  Save,
  History,
  Plus,
  ShieldAlert,
  Trophy,
  ChevronLeft,
  Monitor,
  Play,
  Pause,
  RotateCcw,
  Settings,
} from "lucide-react"; // This is committeeQuarter
import { formatTime } from "../../utils/helpers";
import KeyboardSettingsModal from "./KeyboardSettingsModal";
import ConfirmationModal from "../common/ConfirmationModal";

export default function CommitteeLiveView({
  initialData,
  showNotification,
  onBack,
  clock,
  setClock,
  isRunning,
  setIsRunning,
  quarter, // Now received as prop
  setQuarter, // Now received as prop
  committeeKeybindings,
  setCommitteeKeybindings,
  possessionArrow, // Now received as prop
  setPossessionArrow, // Now received as prop
  timeouts, // Now received as prop
  setTimeouts, // Now received as prop
  onGameSaved, // Now received as prop
  logs, // Now received as prop
  setLogs, // Now received as prop
  teamAPlayerMap, // New prop
  teamBPlayerMap, // New prop
}) {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAdvanceQuarterConfirmOpen, setIsAdvanceQuarterConfirmOpen] = useState(false);
  const [isSaveGameConfirmOpen, setIsSaveGameConfirmOpen] = useState(false);
  const [shotClock, setShotClock] = useState(24);
  const [shotClockPulse, setShotClockPulse] = useState(false);
  // Scores & Fouls State
  const [scores, setScores] = useState({ A: 0, B: 0 });
  const [teamFouls, setTeamFouls] = useState({ A: 0, B: 0 });

  const periodName = quarter > 4 ? `Overtime ${quarter - 4}` : `Period ${quarter}`;

  const buzzerRef = useRef(null);

  // Detailed stats per player

  // --- FIBA Timeout Logic ---
  const maxTimeouts = quarter <= 2 ? 2 : quarter <= 4 ? 3 : 1;

  const getUsedTimeoutsCount = (team) => {
    if (quarter <= 2) {
      // First Half allowance
      return timeouts[team].filter((t) => t.quarter <= 2).length;
    } else if (quarter <= 4) {
      // Second Half allowance
      return timeouts[team].filter((t) => t.quarter === 3 || t.quarter === 4).length;
    } else {
      // Overtime: 1 per period
      return timeouts[team].filter((t) => t.quarter === quarter).length;
    }
  };

  const [playerStats, setPlayerStats] = useState({}); // { playerId: { points: 0, fouls: 0 } }

  // Ensure all players are initialized in the stats map
  useEffect(() => {
    const stats = {};
    [...initialData.teamARoster, ...initialData.teamBRoster].forEach((p) => {
      stats[p.id] = { points: 0, fouls: 0 };
    });
    setPlayerStats(stats);
  }, [initialData]);

  // --- AUDIO BUZZER LOGIC ---
  useEffect(() => {
    buzzerRef.current = new Audio('/sounds/buzzer.mp3'); // Make sure you have a buzzer.mp3 in your public/sounds folder
    buzzerRef.current.volume = 0.5; // Adjust volume as needed
  }, []);

  const playBuzzer = () => {
    if (buzzerRef.current) {
      buzzerRef.current.play().catch(e => console.error("Error playing buzzer sound:", e));
    }
  };

  // Trigger buzzer when game clock hits zero
  useEffect(() => {
    if (clock === 0 && isRunning) {
      playBuzzer();
    }
  }, [clock, isRunning]);

  // Trigger buzzer when shot clock hits zero
  useEffect(() => {
    if (shotClock === 0 && isRunning) {
      playBuzzer();
    }
  }, [shotClock, isRunning]);

  // --- SHOT CLOCK TIMER LOGIC ---
  useEffect(() => {
    let interval;
    if (isRunning && shotClock > 0) {
      interval = setInterval(() => {
        setShotClock((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, shotClock]);

  const triggerShotClockPulse = (value) => {
    setShotClock(value);
    setShotClockPulse(true);
    setTimeout(() => setShotClockPulse(false), 400);
  };

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (event) => {
      const { toggleGameClock, resetShotClock24, resetShotClock14 } = committeeKeybindings;
      if ([toggleGameClock, resetShotClock24, resetShotClock14].includes(event.code)) {
        event.preventDefault();
      }

      switch (event.code) {
        case toggleGameClock:
          setIsRunning(prev => !prev); // Toggle game clock
          break;
        case resetShotClock24: // 'R' key for Reset 24s
          triggerShotClockPulse(24);
          break;
        case resetShotClock14: // 'F' key for Reset 14s
          triggerShotClockPulse(14);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown); // Dependencies ensure the latest state setters are used
  }, [setIsRunning, setShotClock, committeeKeybindings]);

  // --- SYNC WITH EXTERNAL SCOREBOARD ---
  useEffect(() => {
    const channel = new BroadcastChannel("subnscore_official_sync");

    // Post message whenever relevant state changes
    channel.postMessage({
      teamAName: initialData.teamAName,
      teamBName: initialData.teamBName,
      scores,
      teamFouls,
      quarter,
      clock,
      possessionArrow,
      shotClock,
      timeouts: {
        A: getUsedTimeoutsCount("A"),
        B: getUsedTimeoutsCount("B"),
        max: maxTimeouts,
      },
    });

    return () => channel.close();
  }, [
    scores,
    teamFouls,
    quarter,
    clock,
    possessionArrow,
    shotClock,
    initialData,
    timeouts,
    maxTimeouts,
  ]);

  const openExternalScoreboard = () => {
    const width = 1000;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      "/?view=scoreboard",
      "SubNScoreScoreboard",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    );

    // Immediately send the current state to the newly opened scoreboard window
    // We use a small timeout to ensure the new window is ready to receive messages.
    setTimeout(() => {
      const syncChannel = new BroadcastChannel("subnscore_official_sync");
      syncChannel.postMessage({
        teamAName: initialData.teamAName,
        teamBName: initialData.teamBName,
        scores,
        teamFouls,
        quarter,
        clock,
        possessionArrow,
        shotClock,
        timeouts: { A: getUsedTimeoutsCount("A"), B: getUsedTimeoutsCount("B"), max: maxTimeouts },
      });
      syncChannel.close();
    }, 1000);
  };

  // --- Handlers ---
  const handleManualScoreAdjustment = (team, amount) => {
    const nextScore = Math.max(0, scores[team] + amount);
    if (nextScore !== scores[team]) {
      setScores((prev) => ({ ...prev, [team]: nextScore }));
      addLog({
        type: "SCORE_ADJUST",
        team,
        amount,
        quarter,
        clock,
      });
    }
  };

  const handleScore = (team, playerId, amount) => {
    setScores((prev) => ({ ...prev, [team]: prev[team] + amount }));
    setPlayerStats((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], points: prev[playerId].points + amount },
    }));

    const player = findPlayer(playerId);
    addLog({
      type: "SCORE",
      team,
      playerId,
      dbPlayerId: (team === 'A' ? teamAPlayerMap : teamBPlayerMap)[playerId] || playerId, // Store the DB ID
      playerName: player.name,
      jersey: player.jersey,
      amount,
      quarter,
      clock,
    });
  };

  const handleFoul = (team, playerId) => {
    // Individual Foul
    setPlayerStats((prev) => {
      const currentFouls = prev[playerId].fouls + 1;
      if (currentFouls >= 5)
        showNotification(`${findPlayer(playerId).name} has FOULED OUT!`);
      return {
        ...prev,
        [playerId]: { ...prev[playerId], fouls: currentFouls },
      };
    });

    // Team Foul
    setTeamFouls((prev) => {
      const nextFouls = prev[team] + 1;
      if (nextFouls === 5) showNotification(`TEAM ${team} IS NOW IN PENALTY!`);
      return { ...prev, [team]: nextFouls };
    });

    const player = findPlayer(playerId);
    addLog({
      type: "FOUL",
      team,
      playerId,
      dbPlayerId: (team === 'A' ? teamAPlayerMap : teamBPlayerMap)[playerId] || playerId, // Store the DB ID
      playerName: player.name,
      jersey: player.jersey,
      quarter,
      clock,
    });
  };

  const handleTimeout = (team) => {
    const used = getUsedTimeoutsCount(team);
    if (used >= maxTimeouts) {
      showNotification(
        `No timeouts remaining for ${team === "A" ? initialData.teamAName : initialData.teamBName}.`,
      );
      return;
    }

    setTimeouts((prev) => ({
      ...prev,
      [team]: [...prev[team], { quarter, clock }],
    }));

    setIsRunning(false); // FIBA rules: Clock stops
    addLog({ type: "TIMEOUT", team, quarter, clock });
    showNotification(`Timeout called for ${team === "A" ? initialData.teamAName : initialData.teamBName}`);
  };

  const handleSaveGame = async () => {
    try {
      setIsRunning(false);
      const payload = {
        gameId: initialData.gameId,
        finalScoreA: scores.A,
        finalScoreB: scores.B,
        finalClock: clock,
        finalQuarter: quarter,
        logs: [...logs].reverse(), // Send chronological history
      };

      await axios.post("/api/committee/games/save", payload);
      showNotification("Official scoresheet saved successfully!");
      if (onGameSaved) onGameSaved();
    } catch (err) {
      console.error("Save Error:", err);
      showNotification(
        err.response?.data?.error || "Failed to save official game.",
      );
    }
  };

  const handleJumpBall = () => {
    if (possessionArrow === null) {
      // First jump ball of the game logic:
      // Prompt official to pick who won the tip.
      // The arrow then points to the team that LOST the tip.
      return;
    }
    const next = possessionArrow === "A" ? "B" : "A";
    setPossessionArrow(next);
    addLog({ type: "ARROW_FLIP", to: possessionArrow, team: possessionArrow, quarter, clock });
  };

  const setInitialJumpBall = (winner) => {
    const arrowPointsTo = winner === "A" ? "B" : "A";
    setPossessionArrow(arrowPointsTo);
    showNotification(`Arrow points to Team ${arrowPointsTo}`);
    addLog({ type: "GAME_START", winner, arrow: arrowPointsTo, quarter: 1, clock: 600 });
  };

  const advanceQuarter = () => {
    setIsRunning(false); // Ensure clock is paused before advancing
    const nextQ = quarter + 1;
    const nextPeriodName = nextQ > 4 ? `Overtime ${nextQ - 4}` : `Period ${nextQ}`;

    // Log the end of the current period
    addLog({ type: "PERIOD_END", quarter, clock });

    if (possessionArrow && quarter >= 2) {
      // Q2 and beyond: the arrow team used their possession this quarter, so flip the arrow
      const nextArrow = possessionArrow === "A" ? "B" : "A";
      setPossessionArrow(nextArrow);
      showNotification(`${nextPeriodName} started. Arrow flipped to ${nextArrow}.`);

      addLog({
        type: "ARROW_FLIP",
        to: possessionArrow,
        team: possessionArrow,
        quarter: nextQ,
        clock: 600,
      });
    } else {
      // Q1 end: arrow team hasn't used their possession yet (they get the Q2 ball), so don't flip
      showNotification(`${nextPeriodName} started.`);
    }

    setQuarter((prev) => prev + 1);
    setClock(600); // Reset clock for new quarter
    setShotClock(24); // Reset shot clock for new quarter
    setTeamFouls({ A: 0, B: 0 }); // Reset team fouls for new period
  };

  const addLog = (log) => {
    setLogs((prev) => [log, ...prev]);
  };

  const undoLastAction = () => {
    if (logs.length === 0) return;
    const lastAction = logs[0];
    // Logic to revert states based on lastAction type...
    setLogs((prev) => prev.slice(1));
    showNotification("Last action undone.");
  };

  const findPlayer = (id) => {
    return [...initialData.teamARoster, ...initialData.teamBRoster].find(
      (p) => p.id === id,
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20">
      

      {/* 1. TOP SCOREBOARD UNIT */}
      <div className="bg-slate-900 text-white p-4 md:p-6 rounded-3xl shadow-2xl border-b-4 border-amber-500 sticky top-2 md:top-4 z-50">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-0">
          {/* Team A Score */}
          <div className="text-center flex-1 w-full">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
              {initialData.teamAName}
            </p>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-6xl font-black tabular-nums">{scores.A}</h2>
              {/* Quick Adjustment buttons for Official */}
              <div className="flex gap-1">
                <button
                  onClick={() => handleManualScoreAdjustment("A", -1)}
                  className="w-6 h-6 bg-slate-800 rounded text-[10px] font-black"
                >
                  -1
                </button>
                <button
                  onClick={() => handleManualScoreAdjustment("A", 1)}
                >
                  +1
                </button>
              </div>
            </div>

            {/* Team A Timeout Indicators */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-center gap-1">
                {Array.from({ length: maxTimeouts }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-1.5 rounded-full ${i < (maxTimeouts - getUsedTimeoutsCount("A")) ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-slate-700"}`}
                  />
                ))}
              </div>
              <button
                onClick={() => handleTimeout("A")}
                className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400 transition-colors"
              >
                Timeout
              </button>
            </div>

            <div className="flex justify-center gap-1 mt-4">
              {[1, 2, 3, 4, 5].map((f) => (
                <div
                  key={f}
                  className={`w-3 h-3 rounded-full ${teamFouls.A >= f ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-slate-700"}`}
                />
              ))}
            </div>
          </div>

          {/* Period & Arrow Info */}
          <div className="flex flex-col items-center px-2 md:px-6 md:border-x border-slate-800 min-w-0 w-full md:w-auto">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-amber-500 text-slate-900 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                {periodName}
              </span>
              <button
                onClick={openExternalScoreboard}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-amber-500 transition-colors"
                title="Open Scoreboard Window"
              >
                <Monitor size={16} />
              </button>

              <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
              title="Keyboard Shortcuts Settings"
            >
              <Settings size={16} />
            </button>

            
              {/* Keyboard Settings Modal - Rendered directly in CommitteeLiveView */}
              <KeyboardSettingsModal
              isOpen={isSettingsModalOpen}
              onClose={() => setIsSettingsModalOpen(false)}
              keybindings={committeeKeybindings}
              setKeybindings={setCommitteeKeybindings}
              showNotification={showNotification}
              />
            </div>
            

            {/* Official Game Clock Controls */}
            <div className="flex flex-col items-center mb-6 bg-slate-800/50 p-3 rounded-2xl border border-slate-700 w-full gap-4">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Game Clock</span>
                  <div className="text-4xl font-mono font-black tabular-nums text-amber-500">
                    {formatTime(clock)}
                  </div>
                </div>
                <div className="w-px h-10 bg-slate-700"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Shot Clock</span>
                  <div className={`text-4xl font-mono font-black tabular-nums transition-all duration-300 ${
                    shotClockPulse ? 'scale-125 text-white drop-shadow-[0_0_15px_rgba(245,158,11,1)]' :
                    shotClock <= 10 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
                    {shotClock}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 w-full">
                <div className="flex gap-1">
                  <button
                    onClick={() => setIsRunning(!isRunning)}
                    className={`flex-1 py-2.5 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 border-b-4 ${
                      isRunning ? "bg-red-600 border-red-800 text-white hover:bg-red-500" : "bg-emerald-500 border-emerald-700 text-white hover:bg-emerald-400"
                    }`}
                  >
                    {isRunning ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    {/* {isRunning ? "Stop Clock" : "Start Clock"} */}
                  </button>
                  <button
                    onClick={() => { setIsRunning(false); setClock(600); triggerShotClockPulse(24); }}
                    className="p-2.5 bg-slate-900 border-2 border-slate-700 hover:border-amber-500 rounded-2xl text-slate-400 hover:text-amber-500 transition-all group shadow-inner"
                  >
                    <History size={18} className="group-hover:rotate-[-45deg] transition-transform" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => triggerShotClockPulse(24)}
                    className="flex-1 flex flex-col items-center justify-center bg-slate-950 border-2 border-slate-700 hover:border-slate-500 rounded-xl py-1.5 transition-all group shadow-lg"
                  >
                    <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest mb-0.5 group-hover:text-slate-300">Reset</span>
                    <span className="text-xl font-mono font-black text-amber-500 leading-none">24</span>
                  </button>
                  <button
                    onClick={() => triggerShotClockPulse(14)}
                    className="flex-1 flex flex-col items-center justify-center bg-slate-950 border-2 border-amber-900/40 hover:border-amber-600 rounded-xl py-1.5 transition-all group shadow-lg"
                  >
                    <span className="text-[6px] font-black text-amber-900/60 uppercase tracking-widest mb-0.5 group-hover:text-amber-500">Reset</span>
                    <span className="text-xl font-mono font-black text-red-500 leading-none">14</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div
                className={`transition-all duration-500 ${possessionArrow === "A" ? "text-amber-500 scale-150" : "text-slate-700"}`}
              >
                <ArrowLeft
                  size={32}
                  strokeWidth={possessionArrow === "A" ? 4 : 2}
                />
              </div>
              <button
                onClick={handleJumpBall}
                className="bg-slate-800 hover:bg-slate-700 p-4 rounded-2xl border border-slate-700 transition-all active:scale-95"
              >
                <RotateCcw className="text-slate-400" size={24} />
              </button>
              <div
                className={`transition-all duration-500 ${possessionArrow === "B" ? "text-amber-500 scale-150" : "text-slate-700"}`}
              >
                <ArrowRight
                  size={32}
                  strokeWidth={possessionArrow === "B" ? 4 : 2}
                />
              </div>
            </div>
            <p className="text-[9px] font-black text-slate-500 uppercase mt-4 tracking-[0.2em]">
              Possession Arrow
            </p>
          </div>

          {/* Team B Score */}
          <div className="text-center flex-1 w-full">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">
              {initialData.teamBName}
            </p>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-6xl font-black tabular-nums">{scores.B}</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => handleManualScoreAdjustment("B", -1)}
                  className="w-6 h-6 bg-slate-800 rounded text-[10px] font-black"
                >
                  -1
                </button>
                <button
                  onClick={() => handleManualScoreAdjustment("B", 1)}
                >
                  +1
                </button>
              </div>
            </div>

            {/* Team B Timeout Indicators */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-center gap-1">
                {Array.from({ length: maxTimeouts }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-1.5 rounded-full ${i < (maxTimeouts - getUsedTimeoutsCount("B")) ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-slate-700"}`}
                  />
                ))}
              </div>
              <button
                onClick={() => handleTimeout("B")}
                className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400 transition-colors"
              >
                Timeout
              </button>
            </div>

            <div className="flex justify-center gap-1 mt-4">
              {[1, 2, 3, 4, 5].map((f) => (
                <div
                  key={f}
                  className={`w-3 h-3 rounded-full ${teamFouls.B >= f ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-slate-700"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. INITIAL JUMP BALL OVERLAY */}
      {possessionArrow === null && (
        <div className="bg-amber-50 border-2 border-amber-200 p-6 md:p-8 rounded-3xl text-center space-y-4 animate-in fade-in zoom-in mx-2">
          <h3 className="text-xl font-black uppercase text-amber-900 tracking-tight">
            Who won the opening tip?
          </h3>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => setInitialJumpBall("A")}
              className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-black uppercase shadow-lg hover:bg-blue-700 transition-all w-full sm:w-auto"
            >
              {initialData.teamAName}
            </button>
            <button
              onClick={() => setInitialJumpBall("B")}
              className="bg-red-600 text-white px-6 py-4 rounded-2xl font-black uppercase shadow-lg hover:bg-red-700 transition-all w-full sm:w-auto"
            >
              {initialData.teamBName}
            </button>
          </div>
          <p className="text-xs text-amber-700 font-bold italic">
            The arrow will point to the team that loses the jump ball.
          </p>
        </div>
      )}

      {/* 3. ROSTERS AND ACTION GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RosterSection
          team="A"
          name={initialData.teamAName}
          roster={initialData.teamARoster}
          stats={playerStats}
          onScore={(pId, amt) => handleScore("A", pId, amt)}
          onFoul={(pId) => handleFoul("A", pId)}
          color="blue"
        />
        <RosterSection
          team="B"
          name={initialData.teamBName}
          roster={initialData.teamBRoster}
          stats={playerStats}
          onScore={(pId, amt) => handleScore("B", pId, amt)}
          onFoul={(pId) => handleFoul("B", pId)}
          color="red"
        />
      </div>

      {/* 4. LOGS & CONTROL BAR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mini Log */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase text-slate-400 flex items-center gap-2">
              <History size={16} /> Recent Actions
            </h3>
            <button
              onClick={undoLastAction}
              className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase flex items-center gap-1"
            >
              <Undo2 size={12} /> Undo
            </button>
          </div>
          <div className="space-y-2 h-40 overflow-y-auto pr-2 custom-scrollbar">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-300 italic text-center py-10">
                Waiting for tip-off...
              </p>
            ) : (
            logs.slice(0, 50).map((log, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100 animate-in slide-in-from-top-1"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] font-black bg-slate-900 text-white w-5 h-5 rounded-full flex items-center justify-center">
                      {log.quarter > 4 ? `OT${log.quarter - 4}` : `Q${log.quarter}`}
                    </span>
                    {log.type === "TIMEOUT" ? (
                      <span className={`text-[10px] font-black uppercase ${log.team === "A" ? "text-blue-600" : "text-red-600"}`}>
                        TEAM {log.team === "A" ? initialData.teamAName : initialData.teamBName} TIMEOUT
                      </span>
                                          ) : log.type === "SCORE_ADJUST" ? (
                      <span className={`text-[10px] font-black uppercase ${log.team === "A" ? "text-blue-600" : "text-red-600"}`}>
                        TEAM {log.team === "A" ? initialData.teamAName : initialData.teamBName} SCORE ADJ
                      </span>
                    ) : (
                      <span className={`text-[10px] font-black uppercase ${log.team === "A" ? "text-blue-600" : "text-red-600"}`}>
                        {log.type === "GAME_START" || log.type === "PERIOD_END" || log.type === "ARROW_FLIP"
                          ? ""
                          : `#${log.jersey} ${log.playerName}`}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                    log.type === "FOUL" 
                      ? "bg-red-100 text-red-700" 
                      : log.type === "TIMEOUT"
                        ? "bg-amber-100 text-amber-700"
                        : (log.type === "SCORE" || log.type === "SCORE_ADJUST")
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-700" // Default for other types
                  }`}>
                    {log.type === "FOUL" 
                      ? "Personal Foul" 
                      : log.type === "TIMEOUT" 
                        ? "Timeout"
                        : log.type === "SCORE"
                          ? `+${log.amount} PTS`
                          : log.type === "GAME_START"
                            ? `Tip-off won by Team ${log.winner}`
                            : log.type === "PERIOD_END"
                              ? `End of ${log.quarter > 4 ? `OT ${log.quarter - 4}` : `Q${log.quarter}`}`
                              : log.type === "ARROW_FLIP"
                                ? `Possession to Team ${log.to}`
                                 : log.type === "SCORE_ADJUST"
                                  ? `${log.amount > 0 ? '+' : ''}${log.amount} PTS ADJ`
                                : log.type // Fallback to raw type if unknown
                    }
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Period Advance & Save */}
        <div className="bg-slate-50 rounded-3xl p-6 flex flex-col justify-between gap-4 border border-slate-200">
          <button
            onClick={() => setIsAdvanceQuarterConfirmOpen(true)}
            className="w-full bg-white border-2 border-slate-200 hover:border-slate-900 py-4 rounded-2xl font-black uppercase text-sm transition-all flex items-center justify-center gap-3 shadow-sm"
          >
            End {periodName}
          </button>

          <button
            onClick={() => setIsSaveGameConfirmOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 rounded-2xl font-black uppercase tracking-widest text-lg transition-all shadow-xl flex items-center justify-center gap-3"
          >
            <Save size={24} />
            Finish & Save Game
          </button>

          <button
            onClick={onBack}
            className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 flex items-center justify-center gap-2"
          >
            Discard Scoresheet
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Advance Quarter */}
      <ConfirmationModal
        isOpen={isAdvanceQuarterConfirmOpen}
        onClose={() => setIsAdvanceQuarterConfirmOpen(false)}
        onConfirm={() => {
          advanceQuarter();
          setIsAdvanceQuarterConfirmOpen(false);
        }}
        title={`End ${periodName}?`}
        message={`Are you sure you want to end ${periodName} and advance to the next period?`}
        confirmText="Advance Quarter"
        confirmButtonClass="bg-blue-600 hover:bg-blue-700"
      />

      {/* Confirmation Modal for Save Game */}
      <ConfirmationModal
        isOpen={isSaveGameConfirmOpen}
        onClose={() => setIsSaveGameConfirmOpen(false)}
        onConfirm={() => {
          handleSaveGame();
          setIsSaveGameConfirmOpen(false);
        }}
        title="Save Official Game?"
        message="Are you sure you want to finish and save this official game record? This action cannot be undone."
        confirmText="Save Game"
        confirmButtonClass="bg-emerald-600 hover:bg-emerald-700"
      />
    </div>
  );
}

function RosterSection({ team, name, roster, stats, onScore, onFoul, color }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const themeColor = color === "blue" ? "blue" : "red";

  return (
    <div
      className={`bg-white rounded-3xl shadow-sm border-t-8 border-${themeColor}-500 p-6 space-y-6`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black uppercase tracking-tight truncate max-w-[200px]">
          {name}
        </h3>
        <span
          className={`text-[10px] font-black px-3 py-1 rounded-full bg-${themeColor}-50 text-${themeColor}-600 border border-${themeColor}-100`}
        >
          TEAM {team}
        </span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {roster.map((player) => {
          const pStats = stats[player.id] || { points: 0, fouls: 0 };
          const isFouledOut = pStats.fouls >= 5;

          return (
            <div
              key={player.id}
              className={`group flex flex-col p-3 rounded-2xl transition-all border ${selectedPlayer === player.id ? `bg-${themeColor}-50 border-${themeColor}-300 ring-2 ring-${themeColor}-100` : "bg-slate-50 border-slate-100 hover:border-slate-300"}`}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() =>
                    setSelectedPlayer(
                      selectedPlayer === player.id ? null : player.id,
                    )
                  }
                >
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${isFouledOut ? "bg-slate-300 text-slate-500" : `bg-white border-2 border-${themeColor}-500 text-${themeColor}-700`}`}
                  >
                    {player.jersey}
                  </span>
                  <div className="flex flex-col">
                    <span
                      className={`font-black uppercase tracking-tight ${isFouledOut ? "text-slate-400 line-through" : "text-slate-700"}`}
                    >
                      {player.name}
                    </span>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase">
                        PTS: {pStats.points}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase ${pStats.fouls >= 4 ? "text-red-600" : "text-slate-400"}`}
                      >
                        FLS: {pStats.fouls}/5
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={isFouledOut}
                    onClick={() => onFoul(player.id)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isFouledOut ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "bg-white border-2 border-red-100 text-red-500 hover:bg-red-600 hover:text-white shadow-sm"}`}
                  >
                    <ShieldAlert size={20} />
                  </button>
                </div>
              </div>

              {/* Point Quick Controls */}
              {selectedPlayer === player.id && !isFouledOut && (
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200 animate-in slide-in-from-top-2">
                  {[1, 2, 3].map((pts) => (
                    <button
                      key={pts}
                      onClick={() => onScore(player.id, pts)}
                      className={`bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white py-2 rounded-xl font-black text-sm transition-all active:scale-95 shadow-md`}
                    >
                      +{pts}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
