import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
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
  BellRing,
  UserPlus,
  Trash2,
} from "lucide-react";
import { formatTime, getFibaTimeoutInfo } from "../../utils/helpers";
import KeyboardSettingsModal from "./KeyboardSettingsModal";
import ConfirmationModal from "../common/ConfirmationModal";
import InputModal from "../common/InputModal";

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
  onSaveGame, // Callback so App.jsx can queue the save when offline
  logs, // Now received as prop
  setLogs, // Now received as prop
  teamAPlayerMap, // New prop
  teamBPlayerMap, // New prop
}) {
  const channelRef = useRef(null);
  const syncTimeoutRef = useRef(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isEditClockOpen, setIsEditClockOpen] = useState(false);

  // Pseudo-code: parse MM:SS or raw seconds from the edit modal, clamp to ≥ 0
  const handleSaveClock = (val) => {
    let newSeconds = clock;
    if (val.includes(":")) {
      const [m, s] = val.split(":");
      const mins = parseInt(m, 10);
      const secs = parseInt(s, 10);
      if (!isNaN(mins) && !isNaN(secs)) newSeconds = mins * 60 + secs;
    } else {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) newSeconds = parsed;
    }
    if (newSeconds >= 0) setClock(newSeconds);
  };
  const [isAdvanceQuarterConfirmOpen, setIsAdvanceQuarterConfirmOpen] =
    useState(false);
  const [isSaveGameConfirmOpen, setIsSaveGameConfirmOpen] = useState(false);
  const [shotClock, setShotClock] = useState(24);
  const [shotClockPulse, setShotClockPulse] = useState(false);
  const [teamAOnCourt, setTeamAOnCourt] = useState([]);
  const [teamABench, setTeamABench] = useState([]);
  const [teamBOnCourt, setTeamBOnCourt] = useState([]);
  const [teamBBench, setTeamBBench] = useState([]);
  const [selectedPlayersA, setSelectedPlayersA] = useState([]); // Players selected for swap on Team A
  const [selectedPlayersB, setSelectedPlayersB] = useState([]); // Players selected for swap on Team B

  // --- Late Arrivals State ---
  const [latePlayersA, setLatePlayersA] = useState([]);
  const [latePlayersB, setLatePlayersB] = useState([]);

  const periodName =
    quarter > 4 ? `Overtime ${quarter - 4}` : `Period ${quarter}`;

  const buzzerRef = useRef(null);
  const hornRef = useRef(null);

  const quarterSeconds = (initialData.quarterDuration || 10) * 60;

  // --- FIBA Timeout Logic (2024-2026 rules incl. last-2-min Q4 sub-cap) ---
  // Pseudo-code: delegate to the shared getFibaTimeoutInfo helper so committee
  //              and coaching modules enforce identical rules.
  // ELI5: ask "how many TOs can team X still call right now?" and get back a full info object.
  const getTeamFibaTO = (team) =>
    getFibaTimeoutInfo(quarter, clock, timeouts[team] || []);

  // --- DERIVED STATE FROM LOGS (Source of Truth) ---
  const scores = useMemo(() => {
    return (logs || []).reduce(
      (acc, log) => {
        if (log.type === "SCORE" || log.type === "SCORE_ADJUST") {
          acc[log.team] = (acc[log.team] || 0) + (log.amount || 0);
        }
        return acc;
      },
      { A: 0, B: 0 },
    );
  }, [logs]);

  const teamFouls = useMemo(() => {
    return (logs || []).reduce(
      (acc, log) => {
        // Team fouls reset every quarter in FIBA
        if (log.type === "FOUL" && log.quarter === quarter) {
          acc[log.team] = (acc[log.team] || 0) + 1;
        }
        return acc;
      },
      { A: 0, B: 0 },
    );
  }, [logs, quarter]);

  const playerStats = useMemo(() => {
    const stats = {};
    [
      ...initialData.teamARoster,
      ...latePlayersA,
      ...initialData.teamBRoster,
      ...latePlayersB,
    ].forEach((p) => {
      stats[p.id] = { points: 0, fouls: 0, rebounds: 0, assists: 0, steals: 0 };
    });
    (logs || []).forEach((log) => {
      if (log.playerId && stats[log.playerId]) {
        if (log.type === "SCORE") stats[log.playerId].points += log.amount;
        if (log.type === "FOUL") stats[log.playerId].fouls += 1;
        if (log.type === "REBOUND") stats[log.playerId].rebounds += 1;
        if (log.type === "ASSIST") stats[log.playerId].assists += 1;
        if (log.type === "STEAL") stats[log.playerId].steals += 1;
      }
    });
    return stats;
  }, [logs, initialData, latePlayersA, latePlayersB]);

  // Initialize lineups — use pre-selected starting 5 if provided, else fall back to jersey sort
  useEffect(() => {
    const sortByJersey = (roster) =>
      [...roster].sort(
        (a, b) => (parseInt(a.jersey, 10) || 0) - (parseInt(b.jersey, 10) || 0),
      );

    const sortedA = sortByJersey(initialData.teamARoster);
    const sortedB = sortByJersey(initialData.teamBRoster);
    const startA = initialData.startingFiveA || [];
    const startB = initialData.startingFiveB || [];

    if (startA.length === 5) {
      setTeamAOnCourt(initialData.teamARoster.filter((p) => startA.includes(p.id)));
      setTeamABench(initialData.teamARoster.filter((p) => !startA.includes(p.id)));
    } else {
      setTeamAOnCourt(sortedA.slice(0, 5));
      setTeamABench(sortedA.slice(5));
    }

    if (startB.length === 5) {
      setTeamBOnCourt(initialData.teamBRoster.filter((p) => startB.includes(p.id)));
      setTeamBBench(initialData.teamBRoster.filter((p) => !startB.includes(p.id)));
    } else {
      setTeamBOnCourt(sortedB.slice(0, 5));
      setTeamBBench(sortedB.slice(5));
    }
  }, [initialData]);

  // --- AUDIO BUZZER LOGIC ---
  useEffect(() => {
    buzzerRef.current = new Audio("/sounds/buzzer.mp3"); // Make sure you have a buzzer.mp3 in your public/sounds folder
    buzzerRef.current.volume = 0.5; // Adjust volume as needed
    hornRef.current = new Audio("/sounds/substimeout.mp3");
    hornRef.current.volume = 0.5;
  }, []);

  const playBuzzer = () => {
    if (buzzerRef.current) {
      buzzerRef.current.currentTime = 0;
      buzzerRef.current
        .play()
        .catch((e) => console.error("Error playing buzzer sound:", e));
    }
    setIsRunning(false); // Stop the clock when the horn sounds
  };

  const playHorn = () => {
    if (hornRef.current) {
      hornRef.current.currentTime = 0;
      hornRef.current
        .play()
        .catch((e) => console.error("Error playing horn:", e));
    }
    setIsRunning(false);
  };

  // Trigger buzzer when game clock hits zero
  useEffect(() => {
    if (clock === 0 && isRunning) {
      playBuzzer();
    }
  }, [clock, isRunning]);

  // Shot clock hits zero — sound only. Game clock keeps running; official stops it manually.
  // Sound temporarily disabled — uncomment the block below to re-enable the shot clock buzzer.
  useEffect(() => {
    if (shotClock === 0 && isRunning) {
      // if (buzzerRef.current) {
      //   buzzerRef.current.currentTime = 0;
      //   buzzerRef.current.play().catch((e) => console.error("Buzzer error:", e));
      // }
    }
  }, [shotClock, isRunning]);

  // --- SHOT CLOCK TIMER LOGIC ---
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setShotClock((prev) => {
          if (prev <= 0) return 0;
          const next = prev - 0.1;
          return next <= 0 ? 0 : Number(next.toFixed(1));
        });
      }, 100); // Tick every 100ms
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const triggerShotClockPulse = (value) => {
    setShotClock(value);
    setShotClockPulse(true);
    setTimeout(() => setShotClockPulse(false), 400);
  };

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ignore shortcut keys if the user is typing in an input field (like late players)
      const activeTag = event.target.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") {
        return;
      }

      const { toggleGameClock, resetShotClock24, resetShotClock14, soundHorn } =
        committeeKeybindings;
      if (
        [
          toggleGameClock,
          resetShotClock24,
          resetShotClock14,
          soundHorn,
        ].includes(event.code)
      ) {
        event.preventDefault();
      }

      switch (event.code) {
        case toggleGameClock:
          setIsRunning((prev) => !prev); // Toggle game clock
          break;
        case resetShotClock24: // 'R' key for Reset 24s
          triggerShotClockPulse(24);
          break;
        case resetShotClock14: // 'F' key for Reset 14s
          triggerShotClockPulse(14);
          break;
        case soundHorn: // 'H' key for manual Horn
          playHorn();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown); // Dependencies ensure the latest state setters are used
  }, [setIsRunning, setShotClock, committeeKeybindings]);

  // --- SYNC WITH EXTERNAL SCOREBOARD ---
  const broadcastState = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.postMessage({
        teamAName: initialData.teamAName,
        teamBName: initialData.teamBName,
        scores,
        teamFouls,
        quarter,
        clock,
        possessionArrow,
        shotClock,
        timeouts: {
          A: getTeamFibaTO("A").used,
          B: getTeamFibaTO("B").used,
          max: getTeamFibaTO("A").limit,
        },
      });
    }
  }, [
    scores,
    teamFouls,
    quarter,
    clock,
    possessionArrow,
    shotClock,
    initialData,
    timeouts,
  ]);

  useEffect(() => {
    // Initialize the channel on mount
    channelRef.current = new BroadcastChannel("subnscore_official_sync");

    return () => {
      // Close and nullify the channel on unmount to prevent InvalidStateError
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
      // Clear any pending sync timeouts
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    broadcastState();
  }, [broadcastState]);

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

    // Give the window a moment to load then broadcast current state
    syncTimeoutRef.current = setTimeout(broadcastState, 1000);
  };

  // Helper to find player details from either roster
  const findPlayer = (id) => {
    return [
      ...initialData.teamARoster,
      ...latePlayersA,
      ...initialData.teamBRoster,
      ...latePlayersB,
    ].find((p) => p.id === id);
  };

  const handleAddLatePlayer = (teamSide, player) => {
    const id = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newP = { ...player, id, dbId: null };

    if (teamSide === "A") {
      setLatePlayersA((prev) => [...prev, newP]);
      setTeamABench((prev) => [...prev, newP]);
    } else {
      setLatePlayersB((prev) => [...prev, newP]);
      setTeamBBench((prev) => [...prev, newP]);
    }

    addLog({
      type: "SUB_IN",
      team: teamSide,
      playerId: id,
      dbPlayerId: null, // explicit null to prompt the backend to create this player
      playerName: newP.name,
      jersey: newP.jersey,
      quarter,
      clock,
    });
    showNotification(
      `Added late player ${newP.name} to Team ${teamSide} bench.`,
    );
  };

  const handlePlayerSelection = (teamSide, playerId) => {
    const onCourt = teamSide === "A" ? teamAOnCourt : teamBOnCourt;
    const bench = teamSide === "A" ? teamABench : teamBBench;
    const pStats = playerStats[playerId];
    const isOnCourt = onCourt.some((p) => p.id === playerId);

    // Prevent fouled out players from subbing in
    if (!isOnCourt && pStats && pStats.fouls >= 5) {
      showNotification("Cannot sub in a player who has fouled out.");
      return;
    }

    const setSelected =
      teamSide === "A" ? setSelectedPlayersA : setSelectedPlayersB;
    const selectedPlayers =
      teamSide === "A" ? selectedPlayersA : selectedPlayersB;
    const isSelected = selectedPlayers.includes(playerId);

    // Enforce max 5 selections per zone
    if (!isSelected) {
      const currentOnCourtSelected = selectedPlayers.filter((id) =>
        onCourt.some((p) => p.id === id),
      );
      const currentOnBenchSelected = selectedPlayers.filter((id) =>
        bench.some((p) => p.id === id),
      );

      if (isOnCourt && currentOnCourtSelected.length >= 5) {
        showNotification("Already selected 5 players from the court.");
        return;
      }
      if (!isOnCourt && currentOnBenchSelected.length >= 5) {
        showNotification("Already selected 5 players from the bench.");
        return;
      }
    }

    let nextSelected = isSelected
      ? selectedPlayers.filter((id) => id !== playerId)
      : [...selectedPlayers, playerId];

    // Automated Swap Logic: If count of selected On-Court matches Bench, swap immediately
    const nextOut = onCourt.filter((p) => nextSelected.includes(p.id));
    const nextIn = bench.filter((p) => nextSelected.includes(p.id));

    if (nextOut.length > 0 && nextOut.length === nextIn.length) {
      const setOnCourt = teamSide === "A" ? setTeamAOnCourt : setTeamBOnCourt;
      const setBench = teamSide === "A" ? setTeamABench : setTeamBBench;

      const newOnCourt = onCourt
        .filter((p) => !nextSelected.includes(p.id))
        .concat(nextIn);
      const newBench = bench
        .filter((p) => !nextSelected.includes(p.id))
        .concat(nextOut);

      setOnCourt(newOnCourt);
      setBench(newBench);
      setSelected([]);

      nextOut.forEach((p) =>
        addLog({
          type: "SUB_OUT",
          team: teamSide,
          playerId: p.id,
          dbPlayerId:
            (teamSide === "A" ? teamAPlayerMap : teamBPlayerMap)[p.id] || null,
          playerName: p.name,
          jersey: p.jersey,
          quarter,
          clock,
        }),
      );
      nextIn.forEach((p) =>
        addLog({
          type: "SUB_IN",
          team: teamSide,
          playerId: p.id,
          dbPlayerId:
            (teamSide === "A" ? teamAPlayerMap : teamBPlayerMap)[p.id] || null,
          playerName: p.name,
          jersey: p.jersey,
          quarter,
          clock,
        }),
      );

      showNotification(`Substitution completed for Team ${teamSide}`);
      setIsRunning(false);
    } else {
      setSelected(nextSelected);
    }
  };

  // --- Handlers ---
  const handleManualScoreAdjustment = (team, amount) => {
    addLog({
      type: "SCORE_ADJUST",
      team,
      amount,
      quarter,
      clock,
    });
  };

  const handleScore = (team, playerId, amount) => {
    const player = findPlayer(playerId);
    addLog({
      type: "SCORE",
      team,
      playerId,
      dbPlayerId:
        (team === "A" ? teamAPlayerMap : teamBPlayerMap)[playerId] || playerId, // Store the DB ID
      playerName: player.name,
      jersey: player.jersey,
      amount,
      quarter,
      clock,
    });
  };

  const handleStat = (team, playerId, type) => {
    const player = findPlayer(playerId);
    addLog({
      type,
      team,
      playerId,
      dbPlayerId:
        (team === "A" ? teamAPlayerMap : teamBPlayerMap)[playerId] || playerId,
      playerName: player.name,
      jersey: player.jersey,
      amount: 1,
      quarter,
      clock,
    });
  };

  const handleFoul = (team, playerId) => {
    const player = findPlayer(playerId);
    const currentFls = playerStats[playerId]?.fouls || 0;

    if (currentFls + 1 >= 5) showNotification(`${player.name} has FOULED OUT!`);
    if (teamFouls[team] + 1 === 5)
      showNotification(`TEAM ${team} IS NOW IN PENALTY!`);

    addLog({
      type: "FOUL",
      team,
      playerId,
      dbPlayerId:
        (team === "A" ? teamAPlayerMap : teamBPlayerMap)[playerId] || playerId, // Store the DB ID
      playerName: player.name,
      jersey: player.jersey,
      quarter,
      clock,
    });
  };

  const handleTimeout = (team) => {
    const fibaTO = getTeamFibaTO(team);
    if (!fibaTO.canCallTimeout) {
      const teamName = team === "A" ? initialData.teamAName : initialData.teamBName;
      const reason = fibaTO.isLastTwoMin ? "last 2-min cap reached" : `${fibaTO.periodLabel} limit reached`;
      showNotification(`No timeouts remaining for ${teamName} — ${reason}.`);
      return;
    }

    setTimeouts((prev) => ({
      ...prev,
      [team]: [...prev[team], { quarter, clock }],
    }));

    setIsRunning(false); // FIBA rules: Clock stops
    addLog({ type: "TIMEOUT", team, quarter, clock });
    showNotification(
      `Timeout called for ${team === "A" ? initialData.teamAName : initialData.teamBName}`,
    );
  };

  const handleSaveGame = async () => {
    setIsRunning(false);
    const payload = {
      gameId: initialData.gameId,
      finalScoreA: scores.A,
      finalScoreB: scores.B,
      finalClock: clock,
      finalQuarter: quarter,
      logs: [...logs].reverse(),
      latePlayersA,
      latePlayersB,
      teamAId: initialData.teamAId,
      teamBId: initialData.teamBId,
    };

    if (onSaveGame) {
      // Delegate to App.jsx which handles online/offline routing
      onSaveGame(payload);
    } else {
      // Fallback: direct save (legacy path)
      try {
        await axios.post("/api/committee/games/save", payload);
        showNotification("Official scoresheet saved successfully!");
        if (onGameSaved) onGameSaved();
      } catch (err) {
        console.error("Save Error:", err);
        showNotification(err.response?.data?.error || "Failed to save official game.");
      }
    }
  };

  const handleJumpBall = () => {
    setIsRunning(false);

    if (possessionArrow === null) {
      // First jump ball of the game logic:
      // Prompt official to pick who won the tip.
      // The arrow then points to the team that LOST the tip.
      return;
    }
    const gettingPossession = possessionArrow;
    const next = possessionArrow === "A" ? "B" : "A";
    setPossessionArrow(next);
    addLog({
      type: "ARROW_FLIP",
      to: next,
      team: gettingPossession,
      quarter,
      clock,
    });
  };

  const setInitialJumpBall = (winner) => {
    const arrowPointsTo = winner === "A" ? "B" : "A";
    setPossessionArrow(arrowPointsTo);
    setIsRunning(true); // Tip-off won — game clock starts immediately
    addLog({
      type: "GAME_START",
      winner,
      arrow: arrowPointsTo,
      quarter: 1,
      clock: quarterSeconds,
    });
    showNotification(`Tip-off won by ${winner === "A" ? initialData.teamAName : initialData.teamBName} — clock started`);
  };

  const advanceQuarter = () => {
    setIsRunning(false); // Ensure clock is paused before advancing
    const nextQ = quarter + 1;
    const nextPeriodName =
      nextQ > 4 ? `Overtime ${nextQ - 4}` : `Period ${nextQ}`;

    // Log the end of the current period
    addLog({ type: "PERIOD_END", quarter, clock });

    if (possessionArrow && quarter >= 2) {
      // Q2 and beyond: the arrow team used their possession this quarter, so flip the arrow
      const gettingPossession = possessionArrow;
      const nextArrow = possessionArrow === "A" ? "B" : "A";
      setPossessionArrow(nextArrow);
      showNotification(
        `${nextPeriodName} started. Arrow flipped to ${nextArrow}.`,
      );

      addLog({
        type: "ARROW_FLIP",
        to: nextArrow,
        team: gettingPossession,
        quarter: nextQ,
        clock: quarterSeconds,
      });
    } else {
      // Q1 end: arrow team hasn't used their possession yet (they get the Q2 ball), so don't flip
      showNotification(`${nextPeriodName} started.`);
    }

    setQuarter((prev) => prev + 1);
    setClock(quarterSeconds); // Reset clock for new quarter
    setShotClock(24); // Reset shot clock for new quarter
  };

  const addLog = (log) => {
    setLogs((prev) => [log, ...prev]);
  };

  const undoLastAction = () => {
    if (logs.length === 0) return;
    const lastAction = logs[0];

    // Revert non-derived states based on action type
    if (lastAction.type === "GAME_START") {
      setPossessionArrow(null); // Shows the tip-off modal buttons again
    } else if (lastAction.type === "ARROW_FLIP") {
      setPossessionArrow(lastAction.team); // Revert to the team that had the arrow before the flip
    } else if (lastAction.type === "TIMEOUT") {
      setTimeouts((prev) => {
        const teamTimeouts = [...(prev[lastAction.team] || [])];
        // Remove the timeout matching the exact clock and quarter
        const filtered = teamTimeouts.filter(
          (t) =>
            !(t.quarter === lastAction.quarter && t.clock === lastAction.clock),
        );
        return { ...prev, [lastAction.team]: filtered };
      });
    }

    setLogs((prev) => prev.slice(1));
    showNotification("Last action undone.");
  };

  return (
    <div className="max-w-[1600px] mx-auto px-0 space-y-4">
      {/* 1. TOP SCOREBOARD HEADER */}
      <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-2xl border-b-4 border-amber-500 sticky top-0 z-50">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Team A Quick Info Unit */}
          <div className="flex-1 flex items-center justify-between bg-blue-900/20 p-3 rounded-3xl border border-blue-500/30 w-full overflow-hidden">
            <div className="flex flex-col">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">
                {initialData.teamAName}
              </p>
              <div className="flex items-center gap-3">
                <h2 className="text-4xl font-black tabular-nums">{scores.A}</h2>
                {/* Score adjust: always visible — hover-only broke on tablets */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleManualScoreAdjustment("A", 1)}
                    className="w-5 h-5 bg-slate-700 hover:bg-blue-600 rounded text-[10px] font-black flex items-center justify-center transition-colors"
                    title="Add 1 point (correction)"
                  >
                    +
                  </button>
                  <button
                    onClick={() => handleManualScoreAdjustment("A", -1)}
                    className="w-5 h-5 bg-slate-700 hover:bg-blue-600 rounded text-[10px] font-black flex items-center justify-center transition-colors"
                    title="Subtract 1 point (correction)"
                  >
                    −
                  </button>
                </div>
              </div>
              {possessionArrow === null && (
                <button
                  onClick={() => setInitialJumpBall("A")}
                  className="mt-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-[9px] font-black px-3 py-1.5 rounded-lg shadow-md uppercase transition-all w-full text-center animate-pulse"
                >
                  Won Tip-Off
                </button>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {/* Team Fouls */}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((f) => (
                  <div
                    key={f}
                    className={`w-2.5 h-2.5 rounded-full border border-blue-500/20 ${teamFouls.A >= f ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-slate-800"}`}
                  />
                ))}
              </div>
              {/* Timeouts — FIBA 2024-2026 incl. last-2-min cap */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: getTeamFibaTO("A").limit }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-1 rounded-full ${i < getTeamFibaTO("A").remaining ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-slate-800"}`}
                    />
                  ))}
                </div>
                {getTeamFibaTO("A").isLastTwoMin && (
                  <span className="text-[7px] font-black text-red-400 uppercase">L2M</span>
                )}
                <button
                  onClick={() => handleTimeout("A")}
                  className="bg-slate-800 hover:bg-blue-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter transition-colors"
                >
                  TIMEOUT
                </button>
              </div>
            </div>
          </div>

          {/* Team B Quick Info Unit */}
          <div className="flex-1 flex items-center justify-between bg-red-900/20 p-3 rounded-3xl border border-red-500/30 w-full overflow-hidden">
            <div className="flex flex-col items-start gap-2">
              {/* Team Fouls */}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((f) => (
                  <div
                    key={f}
                    className={`w-2.5 h-2.5 rounded-full border border-red-500/20 ${teamFouls.B >= f ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-slate-800"}`}
                  />
                ))}
              </div>
              {/* Timeouts — FIBA 2024-2026 incl. last-2-min cap */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTimeout("B")}
                  className="bg-slate-800 hover:bg-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter transition-colors"
                >
                  TIMEOUT
                </button>
                {getTeamFibaTO("B").isLastTwoMin && (
                  <span className="text-[7px] font-black text-red-400 uppercase">L2M</span>
                )}
                <div className="flex gap-1">
                  {Array.from({ length: getTeamFibaTO("B").limit }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-1 rounded-full ${i < getTeamFibaTO("B").remaining ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-slate-800"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end text-right">
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">
                {initialData.teamBName}
              </p>
              <div className="flex items-center gap-3">
                {/* Score adjust: always visible — hover-only broke on tablets */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleManualScoreAdjustment("B", 1)}
                    className="w-5 h-5 bg-slate-700 hover:bg-red-600 rounded text-[10px] font-black flex items-center justify-center transition-colors"
                    title="Add 1 point (correction)"
                  >
                    +
                  </button>
                  <button
                    onClick={() => handleManualScoreAdjustment("B", -1)}
                    className="w-5 h-5 bg-slate-700 hover:bg-red-600 rounded text-[10px] font-black flex items-center justify-center transition-colors"
                    title="Subtract 1 point (correction)"
                  >
                    −
                  </button>
                </div>
                <h2 className="text-4xl font-black tabular-nums">{scores.B}</h2>
              </div>
              {possessionArrow === null && (
                <button
                  onClick={() => setInitialJumpBall("B")}
                  className="mt-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-[9px] font-black px-3 py-1.5 rounded-lg shadow-md uppercase transition-all w-full text-center animate-pulse"
                >
                  Won Tip-Off
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-4 lg:h-[calc(100vh-300px)]">
        {/* Column 1: Team A */}
        <div className="order-2 lg:order-1 h-full overflow-y-auto custom-scrollbar pr-1 pb-10">
          <TeamPlayersSection
            teamSide="A"
            name={initialData.teamAName}
            allPlayers={[...initialData.teamARoster, ...latePlayersA]}
            onCourtPlayers={teamAOnCourt}
            benchPlayers={teamABench}
            stats={playerStats}
            selectedPlayers={selectedPlayersA}
            onPlayerSelect={handlePlayerSelection}
            onScore={(pId, amt) => handleScore("A", pId, amt)}
            onFoul={(pId) => handleFoul("A", pId)}
            onStat={(pId, type) => handleStat("A", pId, type)}
            onAddLatePlayer={handleAddLatePlayer}
            color="blue"
            showNotification={showNotification}
          />
        </div>

        {/* Column 2: Game Controls, Clocks, Log (Middle) */}
        <div className="flex flex-col gap-4 p-4 bg-slate-900 text-white rounded-3xl shadow-2xl border-b-4 border-amber-500 order-1 lg:order-2 h-full overflow-hidden">
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
            {/* Period & Utility Buttons */}
            <div className="flex justify-between items-center mb-2">
              <span className="bg-amber-500 text-slate-900 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                {periodName}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onBack}
                  className="p-1.5 px-3 bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 rounded-lg text-red-500 transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
                  title="Discard Scoresheet"
                >
                  <Trash2 size={14} />{" "}
                  <span className="hidden sm:inline">Discard</span>
                </button>
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
            </div>

            {/* Official Game Clock Controls */}
            <div className="flex flex-col items-center bg-slate-800/50 p-3 rounded-2xl border border-slate-700 w-full gap-3">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-slate-500 uppercase mb-1">
                    Game Clock
                  </span>
                  {/* Tap clock to manually correct time — same UX as coaching module */}
                  <button
                    onClick={() => { setIsRunning(false); setIsEditClockOpen(true); }}
                    className="text-4xl font-mono font-black tabular-nums text-amber-500 hover:text-amber-300 transition-colors cursor-pointer"
                    title="Tap to edit clock"
                  >
                    {formatTime(clock)}
                  </button>
                </div>
                <div className="w-px h-10 bg-slate-700"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-slate-500 uppercase mb-1">
                    Shot Clock
                  </span>
                  <div
                    className={`text-4xl font-mono font-black tabular-nums transition-all duration-300 ${
                      shotClockPulse
                        ? "scale-125 text-white drop-shadow-[0_0_15px_rgba(245,158,11,1)]"
                        : shotClock <= 10
                          ? "text-red-500 animate-pulse"
                          : "text-amber-500"
                    }`}
                  >
                    {shotClock <= 10 && shotClock > 0
                      ? Number(shotClock).toFixed(1)
                      : Math.ceil(shotClock)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full">
                <div className="flex gap-1">
                  <button
                    onClick={() => setIsRunning(!isRunning)}
                    className={`flex-1 py-2.5 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 border-b-4 ${
                      isRunning
                        ? "bg-red-600 border-red-800 text-white hover:bg-red-500"
                        : "bg-emerald-500 border-emerald-700 text-white hover:bg-emerald-400"
                    }`}
                  >
                    {isRunning ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsRunning(false);
                      setClock(quarterSeconds);
                      triggerShotClockPulse(24);
                    }}
                    className="p-2.5 bg-slate-900 border-2 border-slate-700 hover:border-amber-500 rounded-2xl text-slate-400 hover:text-amber-500 transition-all group shadow-inner"
                  >
                    <History
                      size={18}
                      className="group-hover:rotate-[-45deg] transition-transform"
                    />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => triggerShotClockPulse(24)}
                    className="flex-1 flex flex-col items-center justify-center bg-slate-950 border-2 border-slate-700 hover:border-slate-500 rounded-xl py-1.5 transition-all group shadow-lg"
                  >
                    <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest mb-0.5 group-hover:text-slate-300">
                      Reset
                    </span>
                    <span className="text-xl font-mono font-black text-amber-500 leading-none">
                      24
                    </span>
                  </button>
                  <button
                    onClick={() => triggerShotClockPulse(14)}
                    className="flex-1 flex flex-col items-center justify-center bg-slate-950 border-2 border-amber-900/40 hover:border-amber-600 rounded-xl py-1.5 transition-all group shadow-lg"
                  >
                    <span className="text-[6px] font-black text-amber-900/60 uppercase tracking-widest mb-0.5 group-hover:text-amber-500">
                      Reset
                    </span>
                    <span className="text-xl font-mono font-black text-red-500 leading-none">
                      14
                    </span>
                  </button>
                </div>
              </div>

              {/* Buzzer / Horn Button */}
              <button
                onClick={playHorn}
                className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] active:scale-95 flex items-center justify-center gap-2 mt-1 border-b-4 border-red-800"
              >
                <BellRing size={20} />
                Sound Horn (Sub / Timeout)
              </button>
            </div>

            {/* Possession Arrow */}
            <div className="flex flex-col items-center bg-slate-800/50 p-2 rounded-2xl border border-slate-700 w-full gap-2">
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
                  className="bg-slate-900 hover:bg-slate-700 p-3 rounded-2xl border border-slate-700 transition-all active:scale-95"
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
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                Next Possession Arrow
              </p>
            </div>

            {/* Recent Actions Log */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex flex-col gap-3 shadow-inner">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <History size={14} className="text-amber-500" /> Game Log
                </h3>
                <button
                  onClick={undoLastAction}
                  className="text-[8px] font-black text-slate-400 hover:text-white uppercase flex items-center gap-1 transition-colors bg-slate-800 px-2 py-1 rounded-md"
                >
                  <Undo2 size={10} /> Undo
                </button>
              </div>
              <div className="space-y-1.5 h-48 overflow-y-auto pr-2 custom-scrollbar">
                {logs.length === 0 ? (
                  <p className="text-[10px] text-slate-600 italic text-center py-10 font-bold uppercase tracking-widest">
                    No events recorded
                  </p>
                ) : (
                  logs.map((log, i) => {
                    const isScore =
                      log.type === "SCORE" || log.type === "SCORE_ADJUST";
                    const isFoul = log.type === "FOUL";
                    const isTimeout = log.type === "TIMEOUT";
                    const isSub =
                      log.type === "SUB_IN" || log.type === "SUB_OUT";
                    const isStat =
                      log.type === "REBOUND" ||
                      log.type === "ASSIST" ||
                      log.type === "STEAL";
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between p-2 rounded-xl border animate-in slide-in-from-top-1 transition-all ${
                          isScore
                            ? "bg-emerald-500/20 border-emerald-500/40"
                            : isFoul
                              ? "bg-red-500/20 border-red-500/40"
                              : isTimeout
                                ? "bg-amber-500/20 border-amber-500/40"
                                : isSub
                                  ? "bg-indigo-500/20 border-indigo-500/40"
                                  : isStat
                                    ? "bg-cyan-500/20 border-cyan-500/40"
                                    : "bg-slate-800 border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black bg-slate-800 text-slate-300 w-5 h-5 rounded-full flex items-center justify-center border border-slate-700">
                            {log.quarter > 4
                              ? `OT${log.quarter - 4}`
                              : `Q${log.quarter}`}
                          </span>
                          <div className="flex flex-col">
                            <span
                              className={`text-[9px] font-black uppercase leading-tight ${log.team === "A" || log.winner === "A" ? "text-blue-300" : log.team === "B" || log.winner === "B" ? "text-red-300" : "text-slate-300"}`}
                            >
                              {log.type === "TIMEOUT" ||
                              log.type === "SCORE_ADJUST"
                                ? `TEAM ${log.team === "A" ? initialData.teamAName : initialData.teamBName}`
                                : log.type === "GAME_START"
                                  ? `TIP-OFF: ${log.winner === "A" ? initialData.teamAName : initialData.teamBName}`
                                  : log.type === "ARROW_FLIP"
                                    ? `POSS: ${log.team === "A" ? initialData.teamAName : initialData.teamBName}`
                                    : log.type === "PERIOD_END"
                                      ? ""
                                      : `#${log.jersey} ${log.playerName}`}
                            </span>
                            <span
                              className={`text-[8px] font-bold uppercase tracking-tighter ${
                                isScore
                                  ? "text-emerald-300"
                                  : isFoul
                                    ? "text-red-300"
                                    : isTimeout
                                      ? "text-amber-300"
                                      : isSub
                                        ? "text-indigo-300"
                                        : isStat
                                          ? "text-cyan-300"
                                          : "text-slate-500"
                              }`}
                            >
                              {" "}
                              {/**GAME LOG details on the left side */}
                              {log.type === "FOUL"
                                ? "PERSONAL FOUL"
                                : log.type === "TIMEOUT"
                                  ? "TIMEOUT"
                                  : log.type === "SCORE"
                                    ? `+${log.amount} PTS`
                                    : log.type === "REBOUND"
                                      ? "REBOUND"
                                      : log.type === "ASSIST"
                                        ? "ASSIST"
                                        : log.type === "STEAL"
                                          ? "STEAL"
                                          : log.type === "GAME_START"
                                            ? "JUMP BALL WON"
                                            : log.type === "PERIOD_END"
                                              ? "PERIOD END"
                                              : log.type === "ARROW_FLIP"
                                                ? "HELD BALL"
                                                : log.type === "SCORE_ADJUST"
                                                  ? `${log.amount} SCORE ADJUST`
                                                  : log.type === "SUB_IN"
                                                    ? "IN"
                                                    : log.type === "SUB_OUT"
                                                      ? "OUT"
                                                      : log.type}
                            </span>
                          </div>
                        </div>
                        {/**GAME LOG details on the right side */}
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-black text-amber-500/80 tabular-nums">
                            {formatTime(log.clock)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Period Advance & Save */}
          <div className="bg-slate-800/50 rounded-2xl p-3 flex flex-col justify-between gap-3 border border-slate-700 shrink-0">
            <button
              onClick={() => setIsAdvanceQuarterConfirmOpen(true)}
              className="w-full bg-slate-700 border-2 border-slate-600 hover:border-slate-500 py-4 rounded-2xl font-black uppercase text-sm transition-all flex items-center justify-center gap-3 shadow-sm text-white"
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
          </div>
        </div>

        {/* Column 3: Team B (Right) */}
        <div className="order-3 lg:order-3 h-full overflow-y-auto custom-scrollbar pr-1 pb-10">
          <TeamPlayersSection
            teamSide="B"
            name={initialData.teamBName}
            allPlayers={[...initialData.teamBRoster, ...latePlayersB]}
            onCourtPlayers={teamBOnCourt}
            benchPlayers={teamBBench}
            stats={playerStats}
            selectedPlayers={selectedPlayersB}
            onPlayerSelect={handlePlayerSelection}
            onScore={(pId, amt) => handleScore("B", pId, amt)}
            onFoul={(pId) => handleFoul("B", pId)}
            onStat={(pId, type) => handleStat("B", pId, type)}
            onAddLatePlayer={handleAddLatePlayer}
            color="red"
            showNotification={showNotification}
          />
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

      {/* Clock Edit Modal */}
      <InputModal
        isOpen={isEditClockOpen}
        onClose={() => setIsEditClockOpen(false)}
        onSave={handleSaveClock}
        title="Set Game Clock"
        placeholder="Enter MM:SS or total seconds"
        initialValue={formatTime(clock)}
      />
    </div>
  );
}

function TeamPlayersSection({
  teamSide,
  name,
  allPlayers,
  onCourtPlayers,
  benchPlayers,
  stats,
  selectedPlayers,
  onPlayerSelect,
  onScore,
  onFoul,
  onStat,
  color,
  showNotification,
  onAddLatePlayer,
}) {
  const themeColor = color === "blue" ? "blue" : "red";
  const accentBg = color === "blue" ? "blue-50" : "red-50";
  const accentText = color === "blue" ? "blue-600" : "red-600";

  const [isAddingLate, setIsAddingLate] = useState(false);
  const [lateName, setLateName] = useState("");
  const [lateJersey, setLateJersey] = useState("");
  // Only one bench player can be expanded at a time — clicking another auto-closes the previous
  const [expandedBenchId, setExpandedBenchId] = useState(null);

  return (
    <div
      className={`bg-white rounded-3xl shadow-sm border-t-8 border-${themeColor}-500 p-6 space-y-6`}
    >
      {/* On Court Players */}
      <div className="space-y-2">
        <h4 className="text-xs font-black uppercase text-slate-500 ml-1">
          On Court
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {onCourtPlayers.length === 0 ? (
            <div className="col-span-full py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
              <p className="text-xs text-slate-300 font-black uppercase tracking-widest italic">
                No players on court.
              </p>
            </div>
          ) : (
            onCourtPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                stats={stats[player.id]}
                onScore={onScore}
                onFoul={onFoul}
                onStat={onStat}
                color={color}
                isSelected={selectedPlayers.includes(player.id)}
                onSelect={() => onPlayerSelect(teamSide, player.id)}
                isOnCourt={true}
              />
            ))
          )}
        </div>
      </div>

      {/* Bench Players */}
      <div className="space-y-2 border-t border-slate-100 pt-4 mt-4">
        <h4 className="text-xs font-black uppercase text-slate-500 ml-1">
          Bench
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {benchPlayers.length === 0 ? (
            <div className="col-span-full py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
              <p className="text-xs text-slate-300 font-black uppercase tracking-widest italic">
                Bench is empty.
              </p>
            </div>
          ) : (
            benchPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                stats={stats[player.id]}
                onScore={onScore}
                onFoul={onFoul}
                onStat={onStat}
                color={color}
                isSelected={selectedPlayers.includes(player.id)}
                onSelect={() => {
                  onPlayerSelect(teamSide, player.id);
                  // Toggle expansion; clicking a new player auto-closes the previous
                  setExpandedBenchId((prev) =>
                    prev === player.id ? null : player.id,
                  );
                }}
                isExpanded={expandedBenchId === player.id}
                isOnCourt={false}
              />
            ))
          )}

          {/* Late Arrival Input */}
          {isAddingLate ? (
            <div
              className={`flex gap-2 mt-2 p-2 bg-${themeColor}-50 border border-${themeColor}-200 rounded-xl animate-in fade-in zoom-in duration-200`}
            >
              <input
                value={lateJersey}
                onChange={(e) => setLateJersey(e.target.value)}
                placeholder="#"
                className="w-10 border rounded p-1.5 text-xs font-bold text-center outline-none"
              />
              <input
                value={lateName}
                onChange={(e) => setLateName(e.target.value)}
                placeholder="Player Name"
                className="flex-1 border rounded p-1.5 text-xs font-bold outline-none"
              />
              <button
                onClick={() => {
                  if (!lateName || !lateJersey) return;
                  if (
                    allPlayers.some(
                      (p) => p.jersey.toString() === lateJersey.toString(),
                    )
                  ) {
                    showNotification("Jersey already exists.");
                    return;
                  }
                  onAddLatePlayer(teamSide, {
                    name: lateName,
                    jersey: lateJersey,
                  });
                  setIsAddingLate(false);
                  setLateName("");
                  setLateJersey("");
                }}
                className={`bg-${themeColor}-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase shadow-md hover:bg-${themeColor}-700`}
              >
                Add
              </button>
              <button
                onClick={() => setIsAddingLate(false)}
                className="text-slate-400 hover:text-slate-600 px-2 font-black"
              >
                X
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingLate(true)}
              className="w-full mt-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors uppercase tracking-[0.2em] flex items-center justify-center gap-2"
            >
              <UserPlus size={14} /> Add Late Player
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  stats,
  onScore,
  onFoul,
  onStat,
  color,
  isSelected,
  onSelect,
  isOnCourt,
  isExpanded = false,
}) {
  const themeColor = color === "blue" ? "blue" : "red";
  const pStats = stats || {
    points: 0,
    fouls: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
  };
  const isFouledOut = pStats.fouls >= 5;


  return (
    <div
      className={`group flex flex-col p-3 rounded-2xl transition-all border ${
        isSelected
          ? `bg-${themeColor}-100 border-${themeColor}-500 ring-2 ring-${themeColor}-200`
          : isOnCourt
            ? `bg-white border-${themeColor}-400 shadow-md ring-1 ring-${themeColor}-50`
            : `bg-slate-50 border-slate-100 opacity-70 hover:opacity-100`
      }`}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer flex-1"
          onClick={onSelect}
        >
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
              isFouledOut
                ? "bg-slate-300 text-slate-500"
                : `bg-white border-2 border-${themeColor}-500 text-${themeColor}-700`
            }`}
          >
            {player.jersey}
          </span>
          <div className="flex flex-col">
            <span
              className={`font-black uppercase tracking-tight ${isFouledOut ? "text-slate-400 line-through" : "text-slate-700"}`}
            >
              {player.name}
            </span>
            {/* Stat chips — label above value, subtle bg per category */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              <div className="flex flex-col items-center bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg min-w-[32px]">
                <span className="text-[7px] font-black uppercase leading-none">PTS</span>
                <span className="text-sm font-black leading-tight">{pStats.points}</span>
              </div>
              <div className={`flex flex-col items-center px-2 py-0.5 rounded-lg min-w-[32px] ${pStats.fouls >= 4 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                <span className="text-[7px] font-black uppercase leading-none">FLS</span>
                <span className="text-sm font-black leading-tight">{pStats.fouls}/5</span>
              </div>
              <div className="flex flex-col items-center bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg min-w-[32px]">
                <span className="text-[7px] font-black uppercase leading-none">REB</span>
                <span className="text-sm font-black leading-tight">{pStats.rebounds}</span>
              </div>
              <div className="flex flex-col items-center bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg min-w-[32px]">
                <span className="text-[7px] font-black uppercase leading-none">AST</span>
                <span className="text-sm font-black leading-tight">{pStats.assists}</span>
              </div>
              <div className="flex flex-col items-center bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg min-w-[32px]">
                <span className="text-[7px] font-black uppercase leading-none">STL</span>
                <span className="text-sm font-black leading-tight">{pStats.steals}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Foul button: on-court always visible; bench visible when expanded */}
        {(isOnCourt || isExpanded) && (
          <div className="flex items-center gap-1.5">
            <button
              disabled={isFouledOut}
              onClick={() => onFoul(player.id)}
              title="Record Personal Foul"
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${
                isFouledOut
                  ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                  : "bg-white border-2 border-red-100 text-red-500 hover:bg-red-600 hover:text-white shadow-sm active:scale-95"
              }`}
            >
              <ShieldAlert size={16} />
              <span className="text-[7px] font-black uppercase leading-none mt-0.5">Foul</span>
            </button>
          </div>
        )}
      </div>

      {/* Score + stat buttons: on-court always; bench when expanded (tap card to toggle) */}
      {(isOnCourt || isExpanded) && !isFouledOut && (
        <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-slate-200">
          <div className="grid grid-cols-3 gap-2">
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
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onStat(player.id, "REBOUND")}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 rounded-xl font-black text-[10px] transition-all shadow-sm"
            >
              REB
            </button>
            <button
              onClick={() => onStat(player.id, "ASSIST")}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 rounded-xl font-black text-[10px] transition-all shadow-sm"
            >
              AST
            </button>
            <button
              onClick={() => onStat(player.id, "STEAL")}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 rounded-xl font-black text-[10px] transition-all shadow-sm"
            >
              STL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
