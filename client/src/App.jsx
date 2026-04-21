import React, { useState, useEffect } from "react";
import axios from "axios";
import { Activity, LogOut } from "lucide-react"; // Only keeping the icons actually used here

// --- Imports from the new refactored folders ---
import AuthView from "./components/AuthView";
import SetupView from "./components/SetupView";
import LiveView from "./components/LiveView";
import StatsView from "./components/StatsView";
import { useTimer } from "./hooks/useTimer";
import { QUARTER_SECONDS } from "./utils/helpers";

// --- Axios Configuration ---
axios.defaults.withCredentials = true;

export default function App() {
  // --- Custom Hooks ---
  // We grab the timer logic from your new hook
  const { clock, setClock, isRunning, setIsRunning } = useTimer();

  // --- Global App State ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState("AUTH"); // AUTH, SETUP, LIVE, STATS
  const [notification, setNotification] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const [pendingSwapId, setPendingSwapId] = useState(null);

  // --- Auth State ---
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // --- Game State (With LocalStorage Safety Net) ---
  const [teamMeta, setTeamMeta] = useState(() => {
    try {
      const savedMeta = localStorage.getItem("subnscore_teamMeta");
      const parsed = savedMeta ? JSON.parse(savedMeta) : null;
      return (
        parsed || {
          teamName: "",
          opponent: "",
          league: "",
          season: "Fall 2026",
        }
      );
    } catch {
      return { teamName: "", opponent: "", league: "", season: "Fall 2026" };
    }
  });

  const [roster, setRoster] = useState(() => {
    try {
      const savedRoster = localStorage.getItem("subnscore_roster");
      const parsed = savedRoster ? JSON.parse(savedRoster) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [playerStats, setPlayerStats] = useState(() => {
    try {
      const savedStats = localStorage.getItem("subnscore_playerStats");
      const parsed = savedStats ? JSON.parse(savedStats) : null;
      return parsed || {};
    } catch {
      return {};
    }
  });

  // Game tracking variables
  const [newPlayer, setNewPlayer] = useState({ name: "", jersey: "" });
  const [quarter, setQuarter] = useState(1);
  const [court, setCourt] = useState([]);
  const [stints, setStints] = useState([]);
  const [teamFouls, setTeamFouls] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [timeouts, setTimeouts] = useState([]);
  const [setupAttempted, setSetupAttempted] = useState(false);

  // --- LocalStorage Auto-Savers ---
  useEffect(() => {
    localStorage.setItem("subnscore_teamMeta", JSON.stringify(teamMeta));
  }, [teamMeta]);

  useEffect(() => {
    localStorage.setItem("subnscore_roster", JSON.stringify(roster));
  }, [roster]);

  useEffect(() => {
    localStorage.setItem("subnscore_playerStats", JSON.stringify(playerStats));
  }, [playerStats]);

  // --- Session Check ---
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await axios.get("/api/auth/me");
        setUser(res.data.user);
        setView("SETUP");
      } catch (err) {
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkSession();
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
      const errorMsg = err.response?.data?.message || "Authentication failed.";
      showNotification(errorMsg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout");
      setUser(null);
      setView("AUTH");
      setRoster([]);
      showNotification("Logged out.");
    } catch (err) {
      showNotification("Error logging out.");
    }
  };

  const resetGame = () => {
    // 1. Ask for confirmation so they don't click it accidentally!
    if (
      !window.confirm(
        "Are you sure you want to start a new game? All current stats will be cleared.",
      )
    )
      return;

    // 2. Wipe the browser's memory
    localStorage.removeItem("subnscore_teamMeta");
    localStorage.removeItem("subnscore_roster");
    localStorage.removeItem("subnscore_playerStats");

    // 3. Reset all React State back to default
    setTeamMeta({
      teamName: "",
      opponent: "",
      league: "",
      season: "Fall 2026",
    });
    setRoster([]);
    setPlayerStats({});
    setCourt([]);
    setStints([]);
    setQuarter(1);
    setClock(QUARTER_SECONDS);
    setIsRunning(false);
    setTeamFouls({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    setTimeouts([]);
    setActionHistory([]);
    setSetupAttempted(false);

    // 4. Send them back to the Setup screen
    setView("SETUP");
    showNotification("New game started. Data cleared!");
  };

  const handleDemoLogin = () => {
    setUser({ name: "Guest Coach", email: "demo@subnscore.com" });
    setView("SETUP");
    showNotification("Demo Mode Active: Stats won't be saved to DB.");
  };

  // --- Game Logic Handlers ---
  const handleAddPlayer = (e) => {
    e.preventDefault();
    if (!newPlayer.name || !newPlayer.jersey) return;

    const isDuplicate = roster.some((p) => p.jersey === newPlayer.jersey);
    if (isDuplicate) {
      showNotification(`Jersey #${newPlayer.jersey} is already taken!`);
      return;
    }

    const id = Date.now().toString();
    setRoster([...roster, { ...newPlayer, id }]);
    setPlayerStats({ ...playerStats, [id]: { score: 0, fouls: 0 } });
    setNewPlayer({ name: "", jersey: "" });
  };

  const handleRemovePlayer = (id) => {
    setRoster(roster.filter((p) => p.id !== id));
    const newStats = { ...playerStats };
    delete newStats[id];
    setPlayerStats(newStats);
  };

  const handleEditPlayer = (id, newName) => {
    setRoster(roster.map((p) => (p.id === id ? { ...p, name: newName } : p)));
  };

  const startGame = () => {
    setSetupAttempted(true);

    if (!teamMeta.teamName.trim() || !teamMeta.opponent.trim()) {
      showNotification("Please enter both Team Name and Opponent.");
      return;
    }

    if (roster.length < 5) {
      showNotification("Add at least 5 players.");
      return;
    }
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
    setView("LIVE");
  };

  const subOut = (playerId) => {
    // RULE: Substitutions only allowed when clock is stopped
    if (isRunning) {
      alert("Clock must be PAUSED to make substitutions (Dead Ball Rule).");
      return;
    }

    setStints((prev) =>
      prev.map((s) =>
        s.playerId === playerId && s.clockOut === null
          ? { ...s, clockOut: clock }
          : s,
      ),
    );
    setCourt((prev) => prev.filter((id) => id !== playerId));
    setActionHistory((prev) => [
      ...prev,
      { type: "SUB_OUT", playerId, clock, quarter },
    ]);
  };

  const subIn = (playerId) => {
    // RULE: Substitutions only allowed when clock is stopped
    if (isRunning) {
      alert("Clock must be PAUSED to make substitutions (Dead Ball Rule).");
      return;
    }

    if (court.length >= 5) {
      alert("Only 5 players allowed on court.");
      return;
    }

    setStints((prev) => [
      ...prev,
      { playerId, quarter, clockIn: clock, clockOut: null },
    ]);
    setCourt((prev) => [...prev, playerId]);
    setActionHistory((prev) => [
      ...prev,
      { type: "SUB_IN", playerId, clock, quarter },
    ]);
  };

  const handleSwap = (playerId) => {
    // 1. Rule Check: Clock must be stopped
    if (isRunning) {
      showNotification("Pause the clock to make substitutions!", "error");
      return;
    }

    // 2. If nothing is selected yet, select this player
    if (!pendingSwapId) {
      setPendingSwapId(playerId);
      return;
    }

    // 3. If clicking the same person, deselect them
    if (pendingSwapId === playerId) {
      setPendingSwapId(null);
      return;
    }

    const firstIsOnCourt = court.includes(pendingSwapId);
    const secondIsOnCourt = court.includes(playerId);

    // 4. Case: Both are on the Bench or Both are on Court
    // Instead of swapping, just switch the selection to the new player
    if (firstIsOnCourt === secondIsOnCourt) {
      setPendingSwapId(playerId);
      return;
    }

    // 5. Case: One is Court, One is Bench -> PERFORM THE SWAP
    const playerOut = firstIsOnCourt ? pendingSwapId : playerId;
    const playerIn = firstIsOnCourt ? playerId : pendingSwapId;

    // Update Stints (Out)
    setStints((prev) =>
      prev.map((s) =>
        s.playerId === playerOut && s.clockOut === null
          ? { ...s, clockOut: clock }
          : s,
      ),
    );

    // Update Stints (In)
    setStints((prev) => [
      ...prev,
      { playerId: playerIn, quarter, clockIn: clock, clockOut: null },
    ]);

    // Update Court array
    setCourt((prev) => [...prev.filter((id) => id !== playerOut), playerIn]);

    // Cleanup
    setPendingSwapId(null);
    showNotification("Substitution successful!");
  };

  const addTimeout = () => {
    // RULE: Timeouts are almost always called when the clock is stopped
    // or during a dead ball. We will enforce a pause here too.
    if (isRunning) {
      alert("Pause the clock to record a Timeout.");
      return;
    }
    setTimeouts([...timeouts, { quarter, time: clock }]);
  };

  const advanceQuarter = () => {
    // Dynamically format the period name for the pop-up
    const periodName =
      quarter > 4 ? `Overtime ${quarter - 4}` : `Quarter ${quarter}`;

    const confirmEnd = window.confirm(
      `Are you sure you want to end ${periodName}?`,
    );
    if (!confirmEnd) return;

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
    showNotification(`Quarter ${nextQ} started.`);
  };

  const addStat = (playerId, type, amount) => {
    setPlayerStats((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [type]: (prev[playerId][type] || 0) + amount,
      },
    }));

    if (type === "fouls") {
      setTeamFouls((prev) => ({
        ...prev,
        [quarter]: (prev[quarter] || 0) + 1,
      }));
      setIsRunning(false);
      showNotification("Foul called: Clock stopped.");
    }

    setActionHistory((prev) => [...prev, { playerId, type, amount, quarter }]);
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
        [lastAction.quarter]: Math.max(0, (prev[lastAction.quarter] || 0) - 1),
      }));
    }

    setActionHistory(historyCopy);
    showNotification("Last action undone.");
  };

  if (isAuthLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading SubNScore...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col relative">
      {notification && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg">
          {notification}
        </div>
      )}

      {user && (
        <nav className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 h-16 flex items-center justify-between gap-2">
            {/* LOGO: Hide text on tiny screens, show on small+ */}
            {/* LOGO: Always show icon, show text on most screens */}
            <div className="font-bold text-lg flex items-center gap-2 flex-shrink-0">
              <Activity className="text-amber-400" />
              {/* Changed 'hidden sm:block' to 'hidden min-[360px]:block' */}
              <span className="hidden min-[360px]:block">SubNScore</span>
            </div>

            {/* TABS: Use smaller padding on mobile */}
            <div className="flex bg-slate-800 rounded-lg p-1 min-w-0">
              <button
                onClick={() => setView("SETUP")}
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm transition-colors ${view === "SETUP" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}
              >
                Setup
              </button>
              <button
                onClick={() => setView("LIVE")}
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm transition-colors ${view === "LIVE" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}
              >
                Live
              </button>
              <button
                onClick={() => setView("STATS")}
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm transition-colors ${view === "STATS" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}
              >
                Report
              </button>
            </div>

            {/* LOGOUT: Stays right */}
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 p-1 flex-shrink-0"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </nav>
      )}

      <main className="flex-1 p-4 md:p-8">
        {!user && (
          <AuthView
            authMode={authMode}
            setAuthMode={setAuthMode}
            authForm={authForm}
            setAuthForm={setAuthForm}
            handleLocalAuth={handleLocalAuth}
            handleDemoLogin={handleDemoLogin}
          />
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
            handleRemovePlayer={handleRemovePlayer}
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
            subOut={subOut}
            subIn={subIn}
            addStat={addStat}
            teamFouls={teamFouls}
            setTimeouts={setTimeouts}
            timeouts={timeouts}
            addTimeout={addTimeout}
            undoLastAction={undoLastAction}
            actionHistory={actionHistory}
            teamMeta={teamMeta}
            handleSwap={handleSwap}
            pendingSwapId={pendingSwapId}
          />
        )}
        {user && view === "STATS" && (
          <StatsView
            roster={roster}
            playerStats={playerStats}
            stints={stints}
            clock={clock}
            teamMeta={teamMeta}
            quarter={quarter}
            resetGame={resetGame}
            actionHistory={actionHistory}
          />
        )}
      </main>
    </div>
  );
}
