import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Activity, LogOut, History as HistoryIcon } from "lucide-react";

// --- Imports ---
import AuthView from "./components/AuthView";
import SetupView from "./components/SetupView";
import LiveView from "./components/LiveView";
import StatsView from "./components/StatsView";
import HistoryView from "./components/HistoryView";
import { useTimer } from "./hooks/useTimer";
import { QUARTER_SECONDS } from "./utils/helpers";

axios.defaults.withCredentials = true;

export default function App() {
  const { clock, setClock, isRunning, setIsRunning } = useTimer();

  // --- Global App State ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState(() => {
    return localStorage.getItem("subnscore_view") || "AUTH";
  }); // AUTH, SETUP, LIVE, STATS, HISTORY
  const [notification, setNotification] = useState(null);
  const [actionHistory, setActionHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_actionHistory");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [pendingSwapId, setPendingSwapId] = useState(null);

  // State to hold a loaded historical game
  const [historyData, setHistoryData] = useState(null);

  // --- Auth State ---
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // --- Game State (LocalStorage) ---
  const [teamMeta, setTeamMeta] = useState(() => {
    try {
      const savedMeta = localStorage.getItem("subnscore_teamMeta");
      return savedMeta
        ? JSON.parse(savedMeta)
        : { teamName: "", opponent: "", league: "", season: "" };
    } catch {
      return { teamName: "", opponent: "", league: "", season: "" };
    }
  });

  const [roster, setRoster] = useState(() => {
    try {
      const savedRoster = localStorage.getItem("subnscore_roster");
      const parsed = JSON.parse(savedRoster);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [playerStats, setPlayerStats] = useState(() => {
    try {
      const savedStats = localStorage.getItem("subnscore_playerStats");
      return JSON.parse(savedStats) || {};
    } catch {
      return {};
    }
  });

  const [newPlayer, setNewPlayer] = useState({ name: "", jersey: "" });
  const [quarter, setQuarter] = useState(() => {
    const saved = localStorage.getItem("subnscore_quarter");
    return saved ? JSON.parse(saved) : 1;
  });

  const [court, setCourt] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_court");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [stints, setStints] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_stints");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [teamFouls, setTeamFouls] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_teamFouls");
      return saved ? JSON.parse(saved) : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    } catch {
      return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    }
  });

  const [timeouts, setTimeouts] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_timeouts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [setupAttempted, setSetupAttempted] = useState(false);

  // Auto-Savers
  useEffect(() => {
    localStorage.setItem("subnscore_teamMeta", JSON.stringify(teamMeta));
  }, [teamMeta]);
  useEffect(() => {
    localStorage.setItem("subnscore_roster", JSON.stringify(roster));
  }, [roster]);
  useEffect(() => {
    localStorage.setItem("subnscore_playerStats", JSON.stringify(playerStats));
  }, [playerStats]);
  useEffect(() => {
    localStorage.setItem("subnscore_view", view);
  }, [view]);
  useEffect(() => {
    localStorage.setItem(
      "subnscore_actionHistory",
      JSON.stringify(actionHistory),
    );
  }, [actionHistory]);
  useEffect(() => {
    localStorage.setItem("subnscore_quarter", JSON.stringify(quarter));
  }, [quarter]);
  useEffect(() => {
    localStorage.setItem("subnscore_court", JSON.stringify(court));
  }, [court]);
  useEffect(() => {
    localStorage.setItem("subnscore_stints", JSON.stringify(stints));
  }, [stints]);
  useEffect(() => {
    localStorage.setItem("subnscore_teamFouls", JSON.stringify(teamFouls));
  }, [teamFouls]);
  useEffect(() => {
    localStorage.setItem("subnscore_timeouts", JSON.stringify(timeouts));
  }, [timeouts]);

  // --- Clock & Timer Persistence Logic ---
  const isLoaded = useRef(false);

  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_clock", JSON.stringify(clock));
  }, [clock]);

  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_isRunning", JSON.stringify(isRunning));
  }, [isRunning]);

  // Session Check
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await axios.get("/api/auth/me");
        setUser(res.data.user);
        // Restore the view from localStorage if we are already logged in
        const savedView = localStorage.getItem("subnscore_view");
        if (savedView && savedView !== "AUTH") {
          setView(savedView);
        } else {
          setView("SETUP");
        }
      } catch (err) {
        setUser(null);
        setView("AUTH");
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkSession();

    // 1. Restore clock and timer state from localStorage on mount
    const savedClock = localStorage.getItem("subnscore_clock");
    const savedRunning = localStorage.getItem("subnscore_isRunning");

    if (savedClock) setClock(JSON.parse(savedClock));
    if (savedRunning) setIsRunning(JSON.parse(savedRunning));

    // 2. Delay marking as loaded slightly to allow states to settle
    setTimeout(() => {
      isLoaded.current = true;
    }, 100);
  }, []);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // --- Auth Handlers ---
  const handleLocalAuth = async (e) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      if (authMode === "login") {
        const res = await axios.post("/api/auth/login", {
          email: authForm.email,
          password: authForm.password,
        });
        setUser(res.data.user);
        setView("SETUP");
        showNotification("Welcome back, Coach!");
      } else {
        const res = await axios.post("/api/auth/register", authForm);
        setUser(res.data.user);
        setView("SETUP");
        showNotification("Account created successfully!");
      }
    } catch (err) {
      console.error("Full Auth Error Response:", err.response);
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Authentication failed.";
      showNotification(errorMsg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout");
      localStorage.removeItem("subnscore_teamMeta");
      localStorage.removeItem("subnscore_roster");
      localStorage.removeItem("subnscore_playerStats");
      localStorage.removeItem("subnscore_view");
      localStorage.removeItem("subnscore_actionHistory");
      localStorage.removeItem("subnscore_quarter");
      localStorage.removeItem("subnscore_court");
      localStorage.removeItem("subnscore_stints");
      localStorage.removeItem("subnscore_teamFouls");
      localStorage.removeItem("subnscore_timeouts");
      localStorage.removeItem("subnscore_clock");
      localStorage.removeItem("subnscore_isRunning");

      setUser(null);
      setView("AUTH");
      // Complete Refresh on Logout
      resetGame(true);
      showNotification("Logged out successfully. Session cleared.");
    } catch (err) {
      showNotification("Error logging out.");
    }
  };

  // --- Game Setup Handlers ---
  const handleAddPlayer = (e) => {
    e.preventDefault();
    if (!newPlayer.name || !newPlayer.jersey) return;
    const id = Date.now().toString();
    setRoster([...roster, { ...newPlayer, id }]);
    setPlayerStats({
      ...playerStats,
      [id]: { score: 0, fouls: 0, turnovers: 0 },
    });
    setNewPlayer({ name: "", jersey: "" });
  };

  const handleEditPlayer = (id, newName) => {
    setRoster(roster.map((p) => (p.id === id ? { ...p, name: newName } : p)));
  };

  const startGame = () => {
    setSetupAttempted(true);
    if (!teamMeta.teamName || !teamMeta.opponent)
      return showNotification("Check team info!");
    if (roster.length < 5) return showNotification("Need 5 players.");

    const starters = roster.slice(0, 5).map((p) => p.id);
    setCourt(starters);
    setStints(
      starters.map((id) => ({
        id: Math.random().toString(),
        playerId: id,
        quarter: 1,
        clockIn: QUARTER_SECONDS,
        clockOut: null,
      })),
    );
    setHistoryData(null);
    setView("LIVE");
  };

  const resetGame = (force = false) => {
    if (
      !force &&
      !window.confirm(
        "Start new game? This clears everything including textboxes.",
      )
    )
      return;

    // 1. Wipe Team & Roster (The "Textboxes")
    setTeamMeta({
      teamName: "",
      opponent: "",
      league: "",
      season: "",
    });
    setRoster([]);
    setSetupAttempted(false);

    // 2. Wipe Game Stats & Logic
    setPlayerStats({});
    setCourt([]);
    setStints([]);
    setQuarter(1);
    setClock(QUARTER_SECONDS);
    setIsRunning(false);
    setActionHistory([]);
    setHistoryData(null);
    setTeamFouls({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    setTimeouts([]);
    setPendingSwapId(null);

    localStorage.removeItem("subnscore_actionHistory");
    localStorage.removeItem("subnscore_playerStats");
    localStorage.removeItem("subnscore_view");
    localStorage.removeItem("subnscore_quarter");
    localStorage.removeItem("subnscore_court");
    localStorage.removeItem("subnscore_stints");
    localStorage.removeItem("subnscore_teamFouls");
    localStorage.removeItem("subnscore_timeouts");
    localStorage.removeItem("subnscore_clock");
    localStorage.removeItem("subnscore_isRunning");

    // 3. Go back to Setup View
    setView("SETUP");
  };

  // --- Live Action Handlers ---
  const handleSwap = (playerId) => {
    if (isRunning) return showNotification("Pause clock to sub!");
    if (!pendingSwapId) {
      setPendingSwapId(playerId);
      return;
    }
    if (pendingSwapId === playerId) {
      setPendingSwapId(null);
      return;
    }

    const firstOn = court.includes(pendingSwapId);
    const secondOn = court.includes(playerId);

    if (firstOn === secondOn) {
      setPendingSwapId(playerId);
      return;
    }

    const pOut = firstOn ? pendingSwapId : playerId;
    const pIn = firstOn ? playerId : pendingSwapId;

    setStints((prev) =>
      prev.map((s) =>
        s.playerId === pOut && s.clockOut === null
          ? { ...s, clockOut: clock }
          : s,
      ),
    );
    setStints((prev) => [
      ...prev,
      { playerId: pIn, quarter, clockIn: clock, clockOut: null },
    ]);
    setCourt((prev) => [...prev.filter((id) => id !== pOut), pIn]);
    setActionHistory((prev) => [
      ...prev,
      { type: "SUB_IN", playerId: pIn, clock, quarter },
      { type: "SUB_OUT", playerId: pOut, clock, quarter },
    ]);

    setPendingSwapId(null);
    showNotification("Subbed!");
  };

  const addStat = (playerId, type, amount) => {
    setPlayerStats((prev) => {
      const currentPlayerStats = prev[playerId] || {
        score: 0,
        fouls: 0,
        turnovers: 0,
      };
      return {
        ...prev,
        [playerId]: {
          ...currentPlayerStats,
          [type]: (currentPlayerStats[type] || 0) + amount,
        },
      };
    });

    if (type === "fouls") {
      setTeamFouls((prev) => ({
        ...prev,
        [quarter]: (prev[quarter] || 0) + 1,
      }));
      setIsRunning(false);
    }
    setActionHistory((prev) => [
      ...prev,
      { playerId, type, amount, quarter, clock },
    ]);
  };

  const undoLastAction = () => {
    if (actionHistory.length === 0) return;
    const historyCopy = [...actionHistory];
    const lastAction = historyCopy.pop();

    setPlayerStats((prev) => ({
      ...prev,
      [lastAction.playerId]: {
        ...prev[lastAction.playerId],
        [lastAction.type]: Math.max(
          0,
          prev[lastAction.playerId][lastAction.type] - lastAction.amount,
        ),
      },
    }));

    if (lastAction.type === "fouls") {
      setTeamFouls((prev) => ({
        ...prev,
        [lastAction.quarter]: Math.max(0, prev[lastAction.quarter] - 1),
      }));
    }
    setActionHistory(historyCopy);
    showNotification("Undo successful.");
  };

  const advanceQuarter = () => {
    const pName =
      quarter > 4 ? `Overtime ${quarter - 4}` : `Quarter ${quarter}`;
    if (!window.confirm(`End ${pName}?`)) return;

    const updatedStints = stints.map((s) =>
      s.clockOut === null ? { ...s, clockOut: clock } : s,
    );
    const nextQ = quarter + 1;

    setStints([
      ...updatedStints,
      ...court.map((id) => ({
        id: Math.random().toString(),
        playerId: id,
        quarter: nextQ,
        clockIn: QUARTER_SECONDS,
        clockOut: null,
      })),
    ]);

    setQuarter(nextQ);
    setClock(QUARTER_SECONDS);
    setIsRunning(false);
  };

  // --- Backend Integration Handlers ---
  const handleSaveGame = async () => {
    if (user?.email === "demo@subnscore.com")
      return showNotification("Demo Mode: Cannot save.");

    const teamScore = Object.values(playerStats).reduce((acc, curr) => {
      if (!curr) return acc;
      return acc + (curr.score || 0);
    }, 0);

    const oppScore = window.prompt(
      `Enter final score for ${teamMeta.opponent}:`,
      "0",
    );
    if (oppScore === null) return;

    try {
      // Final Minutes and Seconds Calculation for the DB columns
      const finalRosterWithMins = roster.map((player) => {
        let totalSeconds = 0;
        stints
          .filter((s) => s.playerId === player.id)
          .forEach((s) => {
            const out =
              s.clockOut !== null
                ? s.clockOut
                : s.quarter === quarter
                  ? clock
                  : 0;
            totalSeconds += s.clockIn - out;
          });

        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const formattedMins = `${mins}:${secs.toString().padStart(2, "0")}`;

        return {
          ...player,
          calculatedMins: formattedMins,
          rawSeconds: totalSeconds,
        };
      });

      const payload = {
        teamMeta,
        roster: finalRosterWithMins,
        playerStats,
        actionHistory,
        timeouts,
        finalScoreUs: teamScore,
        finalScoreThem: parseInt(oppScore) || 0,
      };

      await axios.post("/api/games/save", payload);
      showNotification("Game saved to cloud!");

      // Pass 'true' to force reset everything (including textboxes) without a second prompt
      resetGame(true);
    } catch (err) {
      showNotification("Save failed.");
    }
  };

  const loadGameFromHistory = async (gameId) => {
    try {
      const res = await axios.get(`/api/games/${gameId}`);
      const { game, stats, logs } = res.data;

      const historicalRoster = stats.map((s) => ({
        id: s.player_id,
        name: s.name,
        jersey: s.jersey_number,
      }));

      const historicalStats = {};
      stats.forEach((s) => {
        historicalStats[s.player_id] = {
          score: s.points,
          fouls: s.fouls,
          turnovers: s.turnovers,
          minutes: s.minutes,
        };
      });

      const historicalActions = logs.map((l) => ({
        playerId: l.player_id,
        type: l.action_type,
        amount: l.amount,
        quarter: l.quarter,
        clock: l.time_remaining,
      }));

      setHistoryData({
        meta: { ...game, teamName: game.team_name || teamMeta.teamName },
        roster: historicalRoster,
        stats: historicalStats,
        actions: historicalActions,
        quarter: Math.max(...logs.map((l) => l.quarter), 4),
      });
      setView("STATS");
    } catch (err) {
      showNotification("Error loading game.");
    }
  };

  // Calculate accumulated time for each player for real-time display
  const playerTimes = roster.reduce((acc, player) => {
    let totalSeconds = 0;
    stints
      .filter((s) => s.playerId === player.id)
      .forEach((s) => {
        // If stint is active (clockOut is null), calculate up to current clock if in current quarter
        const out =
          s.clockOut !== null
            ? s.clockOut
            : s.quarter === quarter
              ? clock
              : s.clockIn; // Should not happen with advanceQuarter logic
        totalSeconds += s.clockIn - out;
      });
    acc[player.id] = totalSeconds;
    return acc;
  }, {});

  if (isAuthLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-bold">
        Initializing Courtside...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col relative">
      {notification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl border border-slate-700 animate-bounce">
          {notification}
        </div>
      )}

      {user && (
        <nav className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 h-16 flex items-center justify-between gap-2">
            <div className="font-bold text-lg flex items-center gap-2">
              <Activity className="text-amber-400" />
              <span className="hidden min-[400px]:block uppercase tracking-tighter">
                SubNScore
              </span>
            </div>
            <div className="flex bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => {
                  setView("SETUP");
                  setHistoryData(null);
                }}
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all ${view === "SETUP" ? "bg-white text-slate-900 shadow" : "text-slate-400 hover:text-white"}`}
              >
                Setup
              </button>
              <button
                onClick={() => {
                  setView("LIVE");
                  setHistoryData(null);
                }}
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all ${view === "LIVE" ? "bg-white text-slate-900 shadow" : "text-slate-400 hover:text-white"}`}
              >
                Live
              </button>
              <button
                onClick={() => setView("STATS")}
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all ${view === "STATS" ? "bg-white text-slate-900 shadow" : "text-slate-400 hover:text-white"}`}
              >
                Report
              </button>
              <button
                onClick={() => setView("HISTORY")}
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all ${view === "HISTORY" ? "bg-white text-slate-900 shadow" : "text-slate-400 hover:text-white"}`}
              >
                History
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </nav>
      )}

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {!user && (
          <AuthView
            authMode={authMode}
            setAuthMode={setAuthMode}
            authForm={authForm}
            setAuthForm={setAuthForm}
            handleLocalAuth={handleLocalAuth}
            handleDemoLogin={() =>
              setUser({ name: "Demo", email: "demo@subnscore.com" })
            }
          />
        )}

        {user && view === "HISTORY" && (
          <HistoryView onViewGame={loadGameFromHistory} />
        )}

        {user && view === "SETUP" && (
          <SetupView
            user={user}
            teamMeta={teamMeta}
            setTeamMeta={setTeamMeta}
            roster={roster}
            newPlayer={newPlayer}
            setNewPlayer={setNewPlayer}
            handleAddPlayer={handleAddPlayer}
            handleRemovePlayer={(id) =>
              setRoster(roster.filter((p) => p.id !== id))
            }
            handleEditPlayer={handleEditPlayer}
            startGame={startGame}
            setupAttempted={setupAttempted}
            resetGame={resetGame}
          />
        )}

        {user && view === "LIVE" && (
          <LiveView
            court={court}
            roster={roster}
            playerStats={playerStats}
            clock={clock}
            isRunning={isRunning}
            setIsRunning={setIsRunning}
            quarter={quarter}
            advanceQuarter={advanceQuarter}
            addStat={addStat}
            teamFouls={teamFouls}
            timeouts={timeouts}
            addTimeout={() => {
              setTimeouts([...timeouts, { quarter, clock }]);
              setIsRunning(false);
            }}
            undoLastAction={undoLastAction}
            teamMeta={teamMeta}
            handleSwap={handleSwap}
            pendingSwapId={pendingSwapId}
            playerTimes={playerTimes}
          />
        )}

        {user && view === "STATS" && (
          <StatsView
            roster={historyData ? historyData.roster : roster}
            playerStats={historyData ? historyData.stats : playerStats}
            stints={historyData ? [] : stints}
            clock={historyData ? 0 : clock}
            teamMeta={historyData ? historyData.meta : teamMeta}
            quarter={historyData ? historyData.quarter : quarter}
            actionHistory={historyData ? historyData.actions : actionHistory}
            resetGame={() => (historyData ? setView("HISTORY") : resetGame())}
            handleSaveGame={handleSaveGame}
            isHistory={!!historyData}
          />
        )}
      </main>
    </div>
  );
}
