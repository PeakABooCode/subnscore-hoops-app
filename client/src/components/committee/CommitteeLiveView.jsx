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
  X,
  Monitor,
  Play,
  Pause,
  RotateCcw,
  Settings,
  BellRing,
  UserPlus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ClipboardPaste,
  Edit2,
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
  const [isLogOpen, setIsLogOpen] = useState(false); // Bottom collapsing log state

  const [isAdvanceQuarterConfirmOpen, setIsAdvanceQuarterConfirmOpen] =
    useState(false);
  const [isSaveGameConfirmOpen, setIsSaveGameConfirmOpen] = useState(false);
  const [shotClock, setShotClock] = useState(24);
  const [shotClockPulse, setShotClockPulse] = useState(false);
  const [isShotClockPaused, setIsShotClockPaused] = useState(false);
  const [selectedPlayerA, setSelectedPlayerA] = useState(null); // tapped jersey in Team A grid
  const [selectedPlayerB, setSelectedPlayerB] = useState(null); // tapped jersey in Team B grid

  // --- Late Arrivals State ---
  const [latePlayersA, setLatePlayersA] = useState([]);
  const [latePlayersB, setLatePlayersB] = useState([]);

  // Local copies of rosters so name/jersey edits don't mutate the prop
  const [localRosterA, setLocalRosterA] = useState(initialData.teamARoster);
  const [localRosterB, setLocalRosterB] = useState(initialData.teamBRoster);

  // State refs to use inside the keyboard listener
  const stateRef = useRef({ selectedPlayerA, selectedPlayerB });
  useEffect(() => {
    stateRef.current = { selectedPlayerA, selectedPlayerB };
  });

  const handlersRef = useRef({
    handleScore: null,
    handleStat: null,
    handleFoul: null,
    triggerShotClockPulse: null,
    playHorn: null,
    toggleShotClock: null,
  });
  useEffect(() => {
    handlersRef.current = {
      handleScore,
      handleStat,
      handleFoul,
      triggerShotClockPulse,
      playHorn,
      toggleShotClock: () => setIsShotClockPaused((prev) => !prev),
    };
  });

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
      ...localRosterA,
      ...latePlayersA,
      ...localRosterB,
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
    if (isRunning && !isShotClockPaused) {
      interval = setInterval(() => {
        setShotClock((prev) => {
          if (prev <= 0) return 0;
          const next = prev - 0.1;
          return next <= 0 ? 0 : Number(next.toFixed(1));
        });
      }, 100); // Tick every 100ms
    }
    return () => clearInterval(interval);
  }, [isRunning, isShotClockPaused]);

  const triggerShotClockPulse = (value) => {
    setShotClock(value);
    setShotClockPulse(true);
    setIsShotClockPaused(!isRunning); // Resume if game clock is running, stay paused if stopped
    setTimeout(() => setShotClockPulse(false), 400);
  };

  // Auto-pause shot clock when game clock stops
  useEffect(() => {
    if (!isRunning) {
      setIsShotClockPaused(true);
    }
  }, [isRunning]);

  // Helper for tooltips
  const formatKey = (code) => {
    if (!code) return "";
    if (code === "Space") return "Spacebar";
    return code.replace("Key", "").replace("Digit", "");
  };

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ignore shortcut keys if the user is typing in an input field (like late players)
      const activeTag = event.target.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") {
        return;
      }

      const {
        toggleGameClock,
        toggleShotClock,
        resetShotClock24,
        resetShotClock14,
        soundHorn,
        addPoint1,
        addPoint2,
        addPoint3,
        addFoul,
        addRebound,
        addAssist,
        addSteal,
      } = committeeKeybindings;

      if (
        [
          toggleGameClock,
          toggleShotClock,
          resetShotClock24,
          resetShotClock14,
          soundHorn,
          addPoint1,
          addPoint2,
          addPoint3,
          addFoul,
          addRebound,
          addAssist,
          addSteal,
        ].includes(event.code)
      ) {
        event.preventDefault();
      }

      const { selectedPlayerA: spA, selectedPlayerB: spB } = stateRef.current;
      const {
        handleScore: hScore,
        handleStat: hStat,
        handleFoul: hFoul,
        triggerShotClockPulse: tShotClock,
        playHorn: pHorn,
        toggleShotClock: tShotClockPause,
      } = handlersRef.current;

      switch (event.code) {
        case toggleGameClock:
          setIsRunning((prev) => {
            if (!prev) setIsShotClockPaused(false); // Unpause shot clock when starting
            return !prev;
          });
          break;
        case toggleShotClock:
          tShotClockPause();
          break;
        case resetShotClock24: // 'R' key for Reset 24s
          tShotClock(24);
          break;
        case resetShotClock14: // 'F' key for Reset 14s
          tShotClock(14);
          break;
        case soundHorn: // 'H' key for manual Horn
          pHorn();
          break;
        case addPoint1:
          if (spA) hScore("A", spA, 1);
          if (spB) hScore("B", spB, 1);
          break;
        case addPoint2:
          if (spA) hScore("A", spA, 2);
          if (spB) hScore("B", spB, 2);
          break;
        case addPoint3:
          if (spA) hScore("A", spA, 3);
          if (spB) hScore("B", spB, 3);
          break;
        case addFoul:
          if (spA) hFoul("A", spA);
          if (spB) hFoul("B", spB);
          break;
        case addRebound:
          if (spA) hStat("A", spA, "REBOUND");
          if (spB) hStat("B", spB, "REBOUND");
          break;
        case addAssist:
          if (spA) hStat("A", spA, "ASSIST");
          if (spB) hStat("B", spB, "ASSIST");
          break;
        case addSteal:
          if (spA) hStat("A", spA, "STEAL");
          if (spB) hStat("B", spB, "STEAL");
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
      ...localRosterA,
      ...latePlayersA,
      ...localRosterB,
      ...latePlayersB,
    ].find((p) => p.id === id);
  };

  const handleEditPlayer = async (playerId, newName, newJersey) => {
    // Resolve the DB UUID from the player maps (undefined for late arrivals not yet saved)
    const dbPlayerId =
      (teamAPlayerMap || {})[playerId] || (teamBPlayerMap || {})[playerId];

    // Persist to official_players when we have a DB ID (initial roster players).
    // Late arrivals have no DB ID yet — their record is created on game save.
    if (dbPlayerId) {
      try {
        await axios.patch(`/api/committee/players/${dbPlayerId}`, {
          name: newName,
          jersey: newJersey,
        });
      } catch (err) {
        showNotification(
          err.response?.data?.error || "Failed to update player.",
        );
        return; // Don't update local state if DB rejected the change
      }
    }

    const update = (roster) =>
      roster.map((p) =>
        p.id === playerId ? { ...p, name: newName, jersey: newJersey } : p,
      );
    if (localRosterA.some((p) => p.id === playerId))
      setLocalRosterA(update);
    else if (latePlayersA.some((p) => p.id === playerId))
      setLatePlayersA(update);
    else if (localRosterB.some((p) => p.id === playerId))
      setLocalRosterB(update);
    else
      setLatePlayersB(update);

    showNotification(`Updated to #${newJersey} ${newName}`);
  };

  const handleAddLatePlayer = (teamSide, player) => {
    const id = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newP = { ...player, id, dbId: null };
    if (teamSide === "A") setLatePlayersA((prev) => [...prev, newP]);
    else setLatePlayersB((prev) => [...prev, newP]);
    addLog({
      type: "SUB_IN",
      team: teamSide,
      playerId: id,
      dbPlayerId: null,
      playerName: newP.name,
      jersey: newP.jersey,
      quarter,
      clock,
    });
    showNotification(`Added late player ${newP.name} to Team ${teamSide}.`);
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
    showNotification(
      `+${amount} PTS added to #${player.jersey} ${player.name}`,
    );

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
    setSelectedPlayerA(null);
    setSelectedPlayerB(null);
  };

  const handleStat = (team, playerId, type) => {
    const player = findPlayer(playerId);
    showNotification(`${type} added to #${player.jersey} ${player.name}`);

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
    setSelectedPlayerA(null);
    setSelectedPlayerB(null);
  };

  const handleFoul = (team, playerId) => {
    const player = findPlayer(playerId);
    const currentFls = playerStats[playerId]?.fouls || 0;

    let msg = `FOUL added to #${player.jersey} ${player.name}`;
    if (currentFls + 1 >= 5) msg += ` (FOULED OUT!)`;
    if (teamFouls[team] + 1 === 5) msg += ` (TEAM PENALTY!)`;

    showNotification(msg);

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
    setSelectedPlayerA(null);
    setSelectedPlayerB(null);
  };

  const handleTimeout = (team) => {
    const fibaTO = getTeamFibaTO(team);
    if (!fibaTO.canCallTimeout) {
      const teamName =
        team === "A" ? initialData.teamAName : initialData.teamBName;
      const reason = fibaTO.isLastTwoMin
        ? "last 2-min cap reached"
        : `${fibaTO.periodLabel} limit reached`;
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
        showNotification(
          err.response?.data?.error || "Failed to save official game.",
        );
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
    setIsRunning(true);
    setIsShotClockPaused(false); // Start shot clock together with game clock on tip-off
    addLog({
      type: "GAME_START",
      winner,
      arrow: arrowPointsTo,
      quarter: 1,
      clock: quarterSeconds,
    });
    showNotification(
      `Tip-off won by ${winner === "A" ? initialData.teamAName : initialData.teamBName} — clock started`,
    );
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

    let msg = "Last action undone.";
    if (lastAction.type === "SCORE") {
      msg = `Undid: +${lastAction.amount} PTS for #${lastAction.jersey} ${lastAction.playerName}`;
    } else if (lastAction.type === "FOUL") {
      msg = `Undid: FOUL on #${lastAction.jersey} ${lastAction.playerName}`;
    } else if (
      lastAction.type === "REBOUND" ||
      lastAction.type === "ASSIST" ||
      lastAction.type === "STEAL"
    ) {
      msg = `Undid: ${lastAction.type} for #${lastAction.jersey} ${lastAction.playerName}`;
    } else if (lastAction.type === "TIMEOUT") {
      msg = `Undid: TIMEOUT for Team ${lastAction.team === "A" ? initialData.teamAName : initialData.teamBName}`;
    } else if (lastAction.type === "SCORE_ADJUST") {
      msg = `Undid: SCORE ADJUST (${lastAction.amount}) for Team ${lastAction.team === "A" ? initialData.teamAName : initialData.teamBName}`;
    } else if (lastAction.type === "SUB_IN") {
      msg = `Undid: SUB IN for #${lastAction.jersey} ${lastAction.playerName}`;
    } else if (lastAction.type === "SUB_OUT") {
      msg = `Undid: SUB OUT for #${lastAction.jersey} ${lastAction.playerName}`;
    } else if (lastAction.type === "GAME_START") {
      msg = `Undid: TIP-OFF WON by ${lastAction.winner === "A" ? initialData.teamAName : initialData.teamBName}`;
    } else if (lastAction.type === "ARROW_FLIP") {
      msg = `Undid: POSSESSION FLIP`;
    }

    showNotification(msg);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] overflow-hidden bg-slate-50 text-slate-900">
      {/* ── MAIN 5-COLUMN LAYOUT ── */}
      <div className="flex-1 grid grid-cols-[140px_minmax(0,1fr)_280px_minmax(0,1fr)_140px] lg:grid-cols-[160px_minmax(0,1fr)_320px_minmax(0,1fr)_160px] gap-2 lg:gap-3 min-h-0 overflow-hidden">
        {/* COLUMN 1: Team A Info */}
        <TeamInfoColumn
          teamSide="A"
          name={initialData.teamAName}
          score={scores.A}
          fouls={teamFouls.A}
          fibaTO={getTeamFibaTO("A")}
          possessionArrow={possessionArrow}
          onScoreAdjust={(amt) => handleManualScoreAdjustment("A", amt)}
          onInitialJumpBall={() => setInitialJumpBall("A")}
          onTimeout={() => handleTimeout("A")}
          color="blue"
        />

        {/* COLUMN 2: Team A Player Grid */}
        <TeamJerseyGrid
          name={initialData.teamAName}
          players={[...localRosterA, ...latePlayersA]}
          playerStats={playerStats}
          selectedPlayerId={selectedPlayerA}
          onSelectPlayer={(id) => {
            setSelectedPlayerA((prev) => (prev === id ? null : id));
            if (selectedPlayerA !== id) setIsLogOpen(false);
          }}
          onScore={(pId, amt) => handleScore("A", pId, amt)}
          onFoul={(pId) => handleFoul("A", pId)}
          onStat={(pId, type) => handleStat("A", pId, type)}
          onAddLatePlayer={(p) => handleAddLatePlayer("A", p)}
          onEditPlayer={handleEditPlayer}
          color="blue"
          showNotification={showNotification}
        />

        {/* COLUMN 3: Controls column (DARK THEME) */}
        <div className="flex flex-col gap-3 bg-slate-950 rounded-3xl p-3 border border-slate-800 min-h-0 overflow-y-auto custom-scrollbar shadow-sm">
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {/* Period & Top Utilities */}
            <div className="flex flex-col items-center bg-slate-900 p-2 rounded-xl border border-slate-800 shadow-sm w-full mb-1 gap-2">
              <span className="bg-amber-500 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest whitespace-nowrap shrink-0 shadow-sm w-full text-center">
                {periodName}
              </span>
              <div className="flex justify-center gap-1.5 overflow-x-auto no-scrollbar w-full">
                <button
                  onClick={openExternalScoreboard}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors flex items-center justify-center active:scale-95 shrink-0"
                  title="Open Scoreboard Window"
                >
                  <Monitor size={16} />
                </button>
                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors flex items-center justify-center active:scale-95 shrink-0"
                  title="Keyboard Shortcuts Settings"
                >
                  <Settings size={16} />
                </button>
                <button
                  onClick={() => setIsAdvanceQuarterConfirmOpen(true)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors flex items-center justify-center active:scale-95 shrink-0"
                  title="Next Period"
                >
                  <ClipboardPaste size={16} />
                </button>
                <button
                  onClick={onBack}
                  className="p-2 bg-red-900/40 hover:bg-red-800/60 border border-red-800/50 rounded-lg text-red-400 transition-colors flex items-center justify-center active:scale-95 shrink-0"
                  title="Discard Scoresheet"
                >
                  <Trash2 size={16} />{" "}
                </button>
                <button
                  onClick={() => setIsSaveGameConfirmOpen(true)}
                  className="p-2 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-800/50 rounded-lg text-emerald-400 transition-colors flex items-center justify-center active:scale-95 shrink-0"
                  title="Finish & Save"
                >
                  <Save size={18} />
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

            {/* Clocks Section */}
            <div className="flex flex-col items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 w-full gap-2 shadow-sm">
              <div className="flex flex-row justify-between items-center w-full gap-4">
                <div className="flex flex-col items-center w-1/2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Game Clock
                    </span>
                    {!isRunning && (
                      <span className="text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded leading-none animate-pulse uppercase tracking-widest">
                        Paused
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setIsRunning(false);
                      setIsEditClockOpen(true);
                    }}
                    className={`text-4xl lg:text-5xl font-mono font-black tabular-nums transition-colors cursor-pointer ${!isRunning ? "text-amber-600/80 animate-pulse" : "text-amber-500 hover:text-amber-400"}`}
                    title={`Tap to edit clock\nStart/Stop Clock: ${formatKey(committeeKeybindings.toggleGameClock)}`}
                  >
                    {formatTime(clock)}
                  </button>
                </div>
                <div className="w-px h-16 bg-slate-300 my-1"></div>
                <div
                  className="flex flex-col items-center w-1/2 cursor-help"
                  title={`Pause/Resume SC: ${formatKey(committeeKeybindings.toggleShotClock)}\nReset 24s: ${formatKey(committeeKeybindings.resetShotClock24)}\nReset 14s: ${formatKey(committeeKeybindings.resetShotClock14)}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Shot Clock
                    </span>
                    {isShotClockPaused && (
                      <span className="text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded leading-none animate-pulse uppercase tracking-widest">
                        Paused
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-4xl lg:text-5xl font-mono font-black tabular-nums transition-all duration-300 ${
                      shotClockPulse
                        ? "scale-110 text-amber-400 drop-shadow-md"
                        : isShotClockPaused
                          ? "text-amber-600/80 animate-pulse"
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

              <div className="flex flex-col gap-2 w-full mt-4">
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => {
                      const next = !isRunning;
                      setIsRunning(next);
                      if (next) setIsShotClockPaused(false);
                    }}
                    className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-1 lg:gap-2 transition-all shadow-md active:scale-95 ${
                      isRunning
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-emerald-500 hover:bg-emerald-600 text-white"
                    }`}
                  >
                    {isRunning ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                    {isRunning ? "Stop Clock" : "Start Clock"}
                  </button>
                  <button
                    onClick={() => setIsShotClockPaused(!isShotClockPaused)}
                    className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-1 lg:gap-2 transition-all shadow-md active:scale-95 ${
                      isShotClockPaused
                        ? "bg-amber-500 hover:bg-amber-600 text-slate-900"
                        : "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
                    }`}
                  >
                    {isShotClockPaused ? (
                      <Play size={16} fill="currentColor" />
                    ) : (
                      <Pause size={16} fill="currentColor" />
                    )}
                    {isShotClockPaused ? "Resume SC" : "Pause SC"}
                  </button>
                </div>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => triggerShotClockPulse(24)}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-800 border-2 border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 rounded-xl py-3 transition-all shadow-sm active:scale-95"
                  >
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Reset
                    </span>
                    <span className="text-xl font-mono font-black text-amber-500 leading-none">
                      24
                    </span>
                  </button>
                  <button
                    onClick={() => triggerShotClockPulse(14)}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-800 border-2 border-slate-700 hover:border-red-500/50 hover:bg-slate-700 rounded-xl py-3 transition-all shadow-sm active:scale-95"
                  >
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Reset
                    </span>
                    <span className="text-xl font-mono font-black text-red-400 leading-none">
                      14
                    </span>
                  </button>
                </div>
              </div>

              <button
                disabled={true}
                className="w-full opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 mt-2 border border-slate-700 shadow-inner"
              >
                <BellRing size={16} />
                Horn (Disabled)
              </button>
            </div>

            {/* Possession Arrow */}
            <div className="flex flex-col items-center bg-slate-900 p-4 rounded-xl border border-slate-800 w-full gap-3 mt-auto shadow-sm">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Possession Arrow
              </span>
              <div className="flex items-center justify-center gap-8 w-full">
                <div
                  className={`transition-all duration-500 ${possessionArrow === "A" ? "text-amber-500 scale-125" : "text-slate-700"}`}
                >
                  <ArrowLeft
                    size={32}
                    strokeWidth={possessionArrow === "A" ? 4 : 2}
                  />
                </div>
                <button
                  onClick={handleJumpBall}
                  className="bg-slate-800 hover:bg-slate-700 p-3 rounded-full border border-slate-700 transition-all active:scale-95 shadow-sm text-slate-400 hover:text-white"
                >
                  <RotateCcw size={20} />
                </button>
                <div
                  className={`transition-all duration-500 ${possessionArrow === "B" ? "text-amber-500 scale-125" : "text-slate-700"}`}
                >
                  <ArrowRight
                    size={32}
                    strokeWidth={possessionArrow === "B" ? 4 : 2}
                  />
                </div>
              </div>
            </div>

            {/* Undo Button */}
            <button
              onClick={undoLastAction}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              <Undo2 size={16} /> Undo Last Action
            </button>
          </div>
        </div>

        {/* COLUMN 4: Team B Player Grid */}
        <TeamJerseyGrid
          name={initialData.teamBName}
          players={[...localRosterB, ...latePlayersB]}
          playerStats={playerStats}
          selectedPlayerId={selectedPlayerB}
          onSelectPlayer={(id) => {
            setSelectedPlayerB((prev) => (prev === id ? null : id));
            if (selectedPlayerB !== id) setIsLogOpen(false);
          }}
          onScore={(pId, amt) => handleScore("B", pId, amt)}
          onFoul={(pId) => handleFoul("B", pId)}
          onStat={(pId, type) => handleStat("B", pId, type)}
          onAddLatePlayer={(p) => handleAddLatePlayer("B", p)}
          onEditPlayer={handleEditPlayer}
          color="red"
          showNotification={showNotification}
        />

        {/* COLUMN 5: Team B Info */}
        <TeamInfoColumn
          teamSide="B"
          name={initialData.teamBName}
          score={scores.B}
          fouls={teamFouls.B}
          fibaTO={getTeamFibaTO("B")}
          possessionArrow={possessionArrow}
          onScoreAdjust={(amt) => handleManualScoreAdjustment("B", amt)}
          onInitialJumpBall={() => setInitialJumpBall("B")}
          onTimeout={() => handleTimeout("B")}
          color="red"
        />
      </div>

      {/* ── BOTTOM COLLAPSIBLE GAME LOG ── */}
      <div className="bg-white border-t border-slate-200 shrink-0 z-40 transition-all duration-300 flex flex-col shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
        <div
          onClick={() => {
            if (!isLogOpen) {
              setSelectedPlayerA(null);
              setSelectedPlayerB(null);
            }
            setIsLogOpen(!isLogOpen);
          }}
          className="flex items-center justify-between p-3 lg:p-4 cursor-pointer hover:bg-slate-50 select-none transition-colors"
        >
          <div className="flex items-center gap-2 px-2">
            <History size={16} className="text-blue-600" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-800">
              Game Log {logs.length > 0 && `(${logs.length} Events)`}
            </span>
          </div>
          <div className="flex items-center gap-4 px-2">
            <div className="text-slate-400">
              {isLogOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </div>
          </div>
        </div>

        {isLogOpen && (
          <div className="h-48 overflow-y-auto px-4 pb-4 pt-1 flex flex-col gap-2 custom-scrollbar bg-white">
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
                const isSub = log.type === "SUB_IN" || log.type === "SUB_OUT";
                const isStat =
                  log.type === "REBOUND" ||
                  log.type === "ASSIST" ||
                  log.type === "STEAL";

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-white transition-all hover:bg-slate-50"
                  >
                    {/* LEFT SIDE: Quarter, Jersey, Player, Team */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 shadow-sm shrink-0">
                          {log.quarter > 4
                            ? `OT${log.quarter - 4}`
                            : `Q${log.quarter}`}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase leading-tight truncate ${log.team === "A" || log.winner === "A" ? "text-blue-600" : log.team === "B" || log.winner === "B" ? "text-red-600" : "text-slate-700"}`}
                        >
                          {log.type === "TIMEOUT" || log.type === "SCORE_ADJUST"
                            ? `TEAM ${log.team === "A" ? initialData.teamAName : initialData.teamBName}`
                            : log.type === "GAME_START"
                              ? `TIP-OFF: ${log.winner === "A" ? initialData.teamAName : initialData.teamBName}`
                              : log.type === "ARROW_FLIP"
                                ? `POSS: ${log.team === "A" ? initialData.teamAName : initialData.teamBName}`
                                : log.type === "PERIOD_END"
                                  ? "PERIOD END"
                                  : `#${log.jersey} ${log.playerName}`}
                        </span>
                      </div>
                      {log.type !== "TIMEOUT" &&
                        log.type !== "SCORE_ADJUST" &&
                        log.type !== "GAME_START" &&
                        log.type !== "ARROW_FLIP" &&
                        log.type !== "PERIOD_END" && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 ml-[32px] truncate">
                            {log.team === "A"
                              ? initialData.teamAName
                              : initialData.teamBName}
                          </span>
                        )}
                    </div>

                    {/* RIGHT SIDE: Time, Action */}
                    <div className="flex flex-col items-end shrink-0 pl-2">
                      <span className="text-[10px] font-black text-slate-400 tabular-nums leading-tight">
                        {formatTime(log.clock)}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase tracking-tighter mt-0.5 ${isScore ? "text-emerald-600" : isFoul ? "text-red-600" : isTimeout ? "text-amber-600" : isSub ? "text-indigo-600" : isStat ? "text-cyan-600" : "text-slate-500"}`}
                      >
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
                                        ? ""
                                        : log.type === "ARROW_FLIP"
                                          ? "HELD BALL"
                                          : log.type === "SCORE_ADJUST"
                                            ? `${log.amount > 0 ? "+" : ""}${log.amount} ADJUST`
                                            : log.type === "SUB_IN"
                                              ? "IN"
                                              : log.type === "SUB_OUT"
                                                ? "OUT"
                                                : log.type}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
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

// ── TEAM INFO COLUMN ────────────────────────────────────────────────────────
function TeamInfoColumn({
  teamSide,
  name,
  score,
  fouls,
  fibaTO,
  possessionArrow,
  onScoreAdjust,
  onInitialJumpBall,
  onTimeout,
  color,
}) {
  const isBlue = color === "blue";
  const borderClass = isBlue
    ? "border-t-blue-500 border-slate-200"
    : "border-t-red-500 border-slate-200";
  const textClass = isBlue ? "text-blue-600" : "text-red-600";
  const btnHover = isBlue
    ? "hover:bg-blue-600 hover:text-white"
    : "hover:bg-red-600 hover:text-white";

  const [scorePulse, setScorePulse] = useState(false);
  useEffect(() => {
    setScorePulse(true);
    const timer = setTimeout(() => setScorePulse(false), 300);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div
      className={`flex flex-col items-center p-3 rounded-2xl border border-t-8 ${borderClass} bg-white min-h-0 overflow-y-auto custom-scrollbar h-full shadow-sm`}
    >
      <h2
        className={`text-sm lg:text-lg font-black uppercase text-center mb-2 tracking-tighter ${textClass} leading-tight w-full truncate`}
      >
        {name}
      </h2>

      <div
        className={`text-6xl lg:text-7xl font-black tabular-nums mb-3 mt-2 tracking-tighter transition-all duration-300 ${scorePulse ? `scale-110 ${isBlue ? "text-blue-500" : "text-red-500"}` : "text-slate-900"}`}
      >
        {score}
      </div>

      <div className="flex gap-2 w-full mb-6">
        <button
          onClick={() => onScoreAdjust(-1)}
          className={`flex-1 py-2 bg-white border border-slate-200 rounded-xl font-black text-slate-700 ${btnHover} transition-all shadow-sm active:scale-95`}
        >
          -1
        </button>
        <button
          onClick={() => onScoreAdjust(1)}
          className={`flex-1 py-2 bg-white border border-slate-200 rounded-xl font-black text-slate-700 ${btnHover} transition-all shadow-sm active:scale-95`}
        >
          +1
        </button>
      </div>

      {possessionArrow === null && (
        <button
          onClick={onInitialJumpBall}
          className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 text-xs font-black py-3 rounded-xl mb-6 animate-pulse uppercase tracking-widest shadow-sm active:scale-95 transition-all"
        >
          Won Tip-Off
        </button>
      )}

      <div className="w-full flex flex-col items-center bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200 shadow-sm">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
          Team Fouls
        </span>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((f) => (
            <div
              key={f}
              className={`w-4 h-4 rounded-full border-2 ${fouls >= f ? "bg-red-500 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-white border-slate-300"}`}
            />
          ))}
        </div>
      </div>

      <div className="w-full flex flex-col items-center bg-slate-50 p-4 rounded-xl border border-slate-200 mt-auto shadow-sm">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
          Timeouts
        </span>
        <div className="flex gap-1.5 mb-4">
          {Array.from({ length: fibaTO.limit }).map((_, i) => (
            <div
              key={i}
              className={`w-8 h-2 rounded-full ${i < fibaTO.remaining ? "bg-amber-400 shadow-[0_0_5px_rgba(245,158,11,0.4)]" : "bg-white border border-slate-300"}`}
            />
          ))}
        </div>
        <button
          onClick={onTimeout}
          className={`w-full py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 ${btnHover} transition-all shadow-sm active:scale-95`}
        >
          Call Timeout
        </button>
        {fibaTO.isLastTwoMin && (
          <span className="text-[9px] text-red-500 mt-2 font-black uppercase tracking-widest bg-red-50 px-2 py-1 rounded-md border border-red-100">
            L2M CAP
          </span>
        )}
      </div>
    </div>
  );
}

// ── JERSEY GRID ─────────────────────────────────────────────────────────────
// Pseudo-code: show all players as a compact grid of jersey number buttons,
//              sorted by jersey number. Tapping a jersey opens the action panel
//              at the bottom for stat entry. One player can be open at a time.
// ELI5: Like a scorebook — find the number, tap it, record the stat. Two taps max.
function TeamJerseyGrid({
  name,
  players,
  playerStats,
  selectedPlayerId,
  onSelectPlayer,
  onScore,
  onFoul,
  onStat,
  onAddLatePlayer,
  onEditPlayer,
  color,
  showNotification,
}) {
  const themeColor = color === "blue" ? "blue" : "red";
  const borderClass =
    themeColor === "blue"
      ? "border-t-blue-500 border-slate-200"
      : "border-t-red-500 border-slate-200";
  const [isAddingLate, setIsAddingLate] = useState(false);
  const [lateName, setLateName] = useState("");
  const [lateJersey, setLateJersey] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editJersey, setEditJersey] = useState("");

  // Reset edit mode whenever the selected player changes
  useEffect(() => {
    setIsEditing(false);
  }, [selectedPlayerId]);

  const sorted = useMemo(
    () =>
      [...players].sort(
        (a, b) => (parseInt(a.jersey, 10) || 0) - (parseInt(b.jersey, 10) || 0),
      ),
    [players],
  );

  const selectedPlayer = sorted.find((p) => p.id === selectedPlayerId) || null;
  const selStats = selectedPlayer
    ? playerStats[selectedPlayer.id] || {
        points: 0,
        fouls: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
      }
    : null;

  return (
    <div
      className={`flex flex-col min-h-0 bg-white rounded-2xl overflow-hidden border border-t-8 ${borderClass} shadow-sm`}
    >
      {/* Team header */}
      <div
        className={`px-4 py-3 border-b border-slate-200 shrink-0 bg-white flex justify-center`}
      >
        <h3
          className={`text-xs md:text-sm font-black uppercase tracking-widest text-${themeColor}-600 truncate max-w-full`}
        >
          {name}
        </h3>
      </div>

      {/* Jersey grid — fills height when nothing selected; scrollable (hidden bar) when a player is selected */}
      <div className={`p-2 min-h-0 ${selectedPlayerId ? "overflow-y-auto no-scrollbar" : "flex-1 flex flex-col"}`}>
        <div className={`grid grid-cols-3 gap-1.5 ${selectedPlayerId ? "" : "flex-1 min-h-0"}`}>
          {sorted.map((p) => {
            const ps = playerStats[p.id] || { points: 0, fouls: 0 };
            const fouledOut = ps.fouls >= 5;
            const isSelected = selectedPlayerId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelectPlayer(p.id)}
                disabled={false}
                className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all border-2 font-black min-h-[52px] ${selectedPlayerId ? "" : "h-full"}
                  ${
                    isSelected
                      ? `bg-${themeColor}-600 border-${themeColor}-500 text-white scale-105 shadow-md`
                      : fouledOut
                        ? "bg-slate-50 border-slate-100 text-slate-300"
                        : `bg-white border-slate-200 text-slate-700 hover:border-${themeColor}-300 hover:bg-${themeColor}-50 active:scale-95 shadow-sm`
                  }`}
              >
                <span
                  className={`text-2xl lg:text-3xl leading-none ${fouledOut ? "line-through opacity-40" : ""}`}
                >
                  {p.jersey}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Late player — anchored below grid, never inside scrollable area */}
      <div className="shrink-0 px-2 pb-2">
        {isAddingLate ? (
          <div className="flex gap-1 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
            <input
              value={lateJersey}
              onChange={(e) => setLateJersey(e.target.value)}
              placeholder="#"
              className="w-8 bg-white text-slate-800 border border-slate-200 rounded-lg p-1 text-[10px] text-center font-bold outline-none focus:border-amber-500"
            />
            <input
              value={lateName}
              onChange={(e) => setLateName(e.target.value)}
              placeholder="Player Name"
              className="flex-1 min-w-0 bg-white text-slate-800 border border-slate-200 rounded-lg p-1 text-[10px] font-bold outline-none focus:border-amber-500"
            />
            <button
              onClick={() => {
                if (!lateName || !lateJersey) return;
                if (
                  players.some(
                    (p) => p.jersey.toString() === lateJersey.toString(),
                  )
                ) {
                  showNotification("Jersey already exists.");
                  return;
                }
                onAddLatePlayer({ name: lateName, jersey: lateJersey });
                setIsAddingLate(false);
                setLateName("");
                setLateJersey("");
              }}
              className={`bg-${themeColor}-100 text-${themeColor}-700 hover:bg-${themeColor}-600 hover:text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-colors`}
            >
              Add
            </button>
            <button
              onClick={() => setIsAddingLate(false)}
              className="text-slate-400 hover:text-slate-600 px-1 font-black transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingLate(true)}
            className="w-full py-1.5 border border-dashed border-slate-300 rounded-xl text-[9px] font-black text-slate-500 hover:text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 uppercase tracking-widest shadow-sm"
          >
            <UserPlus size={12} /> Late Player
          </button>
        )}
      </div>

      {/* Action panel — appears when a jersey is selected */}
      {selectedPlayer && (
        <div
          className={`shrink-0 bg-white border-t-2 border-${themeColor}-200 p-3 lg:p-4 space-y-3 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]`}
        >
          {/* Player identity + edit + close */}
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={editJersey}
                onChange={(e) => setEditJersey(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-12 p-1.5 border border-slate-200 rounded-lg text-sm text-center font-black outline-none focus:border-amber-400 bg-slate-50"
                placeholder="#"
              />
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 min-w-0 p-1.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-400 bg-slate-50"
                placeholder="Player Name"
              />
              <button
                onClick={() => {
                  if (!editName.trim() || !editJersey.trim()) return;
                  const duplicate = players.some(
                    (p) => p.id !== selectedPlayer.id &&
                      p.jersey.toString() === editJersey.toString(),
                  );
                  if (duplicate) {
                    showNotification(`Jersey #${editJersey} already in use`);
                    return;
                  }
                  onEditPlayer(selectedPlayer.id, editName.trim(), editJersey.trim());
                  setIsEditing(false);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors shrink-0"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-all shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-${themeColor}-400 font-black text-xl leading-none shrink-0`}>
                  #{selectedPlayer.jersey}
                </span>
                <div className="min-w-0">
                  <p className="text-slate-800 font-black text-sm leading-none truncate">
                    {selectedPlayer.name}
                  </p>
                  <p className="text-slate-400 text-[8px] font-bold mt-0.5">
                    {selStats.points} PTS · {selStats.fouls}/5 FLS ·{" "}
                    {selStats.rebounds} REB · {selStats.assists} AST ·{" "}
                    {selStats.steals} STL
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  onClick={() => {
                    setEditName(selectedPlayer.name);
                    setEditJersey(selectedPlayer.jersey.toString());
                    setIsEditing(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                  title="Edit player"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => onSelectPlayer(selectedPlayer.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {selStats.fouls >= 5 ? (
            <p className="text-red-400 font-black text-center text-xs py-1.5 bg-red-950/40 rounded-xl border border-red-900/40">
              FOULED OUT
            </p>
          ) : (
            <>
              {/* Score buttons */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((pts) => (
                  <button
                    key={pts}
                    onClick={() => onScore(selectedPlayer.id, pts)}
                    className={`bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200 hover:bg-${themeColor}-600 hover:text-white py-3 lg:py-4 rounded-xl font-black text-xl transition-all active:scale-95 shadow-sm`}
                  >
                    +{pts}
                  </button>
                ))}
              </div>
              {/* Stat buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => onFoul(selectedPlayer.id)}
                  className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-600 hover:text-white py-2.5 rounded-xl font-black text-[9px] lg:text-[10px] transition-all active:scale-95 flex flex-col items-center gap-0.5 shadow-sm"
                >
                  <ShieldAlert size={13} />
                  Foul
                </button>
                <button
                  onClick={() => onStat(selectedPlayer.id, "REBOUND")}
                  className="bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-600 hover:text-white py-2.5 rounded-xl font-black text-[9px] lg:text-[10px] transition-all active:scale-95 shadow-sm"
                >
                  REB
                </button>
                <button
                  onClick={() => onStat(selectedPlayer.id, "ASSIST")}
                  className="bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-600 hover:text-white py-2.5 rounded-xl font-black text-[9px] lg:text-[10px] transition-all active:scale-95 shadow-sm"
                >
                  AST
                </button>
                <button
                  onClick={() => onStat(selectedPlayer.id, "STEAL")}
                  className="bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-600 hover:text-white py-2.5 rounded-xl font-black text-[9px] lg:text-[10px] transition-all active:scale-95 shadow-sm"
                >
                  STL
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
