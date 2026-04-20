import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Play,
  Pause,
  FastForward,
  UserPlus,
  Activity,
  Users,
  Settings,
  Clock,
  LogOut,
  Mail,
  Lock,
  Globe,
  ShieldAlert,
} from "lucide-react";

// --- Axios Configuration ---
axios.defaults.withCredentials = true;

// --- Constants & Helpers ---
const QUARTER_MINUTES = 10;
const QUARTER_SECONDS = QUARTER_MINUTES * 60;

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function App() {
  // --- Global App State ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState("AUTH"); // AUTH, SETUP, LIVE, STATS
  const [notification, setNotification] = useState(null);
  const [actionHistory, setActionHistory] = useState([]); // Tracks the last actions for the Undo button

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
      // If parsed is null, force it to the default object
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
      // Force it to be an array. If corrupted, return empty array []
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [playerStats, setPlayerStats] = useState(() => {
    try {
      const savedStats = localStorage.getItem("subnscore_playerStats");
      const parsed = savedStats ? JSON.parse(savedStats) : null;
      // If parsed is null, force it to an empty object {}
      return parsed || {};
    } catch {
      return {};
    }
  });

  // RESTORED: These are the variables that accidentally got deleted!
  const [newPlayer, setNewPlayer] = useState({ name: "", jersey: "" });
  const [clock, setClock] = useState(QUARTER_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [quarter, setQuarter] = useState(1);
  const [court, setCourt] = useState([]);
  const [stints, setStints] = useState([]);

  // EXISTING VARIABLES
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

  // --- Clock Logic ---
  useEffect(() => {
    let interval;
    if (isRunning && clock > 0) {
      interval = setInterval(() => setClock((c) => c - 1), 1000);
    } else if (clock === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, clock]);

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

  const handleDemoLogin = () => {
    setUser({ name: "Guest Coach", email: "demo@subnscore.com" });
    setView("SETUP");
    showNotification("Demo Mode Active: Stats won't be saved to DB.");
  };

  // --- Game Logic Handlers ---
  const handleAddPlayer = (e) => {
    e.preventDefault();
    if (!newPlayer.name || !newPlayer.jersey) return;

    // CHECK FOR DUPLICATE JERSEY
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
    // Also clean up their stats so we don't have stray data
    const newStats = { ...playerStats };
    delete newStats[id];
    setPlayerStats(newStats);
  };
  const startGame = () => {
    setSetupAttempted(true); // Trigger the red asterisks if fields are empty

    // 1. Check for Team Names
    if (!teamMeta.teamName.trim() || !teamMeta.opponent.trim()) {
      showNotification("Please enter both Team Name and Opponent.");
      return;
    }

    // 2. Check for Roster Size
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
    setCourt(court.filter((id) => id !== playerId));
    setStints(
      stints.map((s) =>
        s.playerId === playerId && s.clockOut === null
          ? { ...s, clockOut: clock }
          : s,
      ),
    );
  };

  const subIn = (playerId) => {
    if (court.length >= 5) return showNotification("Court is full!");
    setCourt([...court, playerId]);
    setStints([
      ...stints,
      {
        id: Math.random().toString(),
        playerId,
        quarter,
        clockIn: clock,
        clockOut: null,
      },
    ]);
  };

  const advanceQuarter = () => {
    // Safety check: prevent accidental quarter skips
    const confirmEnd = window.confirm(
      `Are you sure you want to end Quarter ${quarter}?`,
    );
    if (!confirmEnd) return;

    const updatedStints = stints.map((s) =>
      s.clockOut === null ? { ...s, clockOut: clock } : s,
    );
    const nextQ = quarter + 1;

    // Logic for ending game at Q4 or proceeding to Q5 (Overtime)
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

    // NEW: Save this exact action to our history stack
    setActionHistory((prev) => [...prev, { playerId, type, amount, quarter }]);
  };

  // NEW: The Undo Function
  const undoLastAction = () => {
    if (actionHistory.length === 0) return; // Nothing to undo

    const historyCopy = [...actionHistory];
    const lastAction = historyCopy.pop(); // Grab the most recent action and remove it from history

    // Reverse the player stat
    setPlayerStats((prev) => ({
      ...prev,
      [lastAction.playerId]: {
        ...prev[lastAction.playerId],
        // Subtract the amount, but don't let it go below 0
        [lastAction.type]: Math.max(
          0,
          prev[lastAction.playerId][lastAction.type] - lastAction.amount,
        ),
      },
    }));

    // If it was a foul, reverse the team foul count too
    if (lastAction.type === "fouls") {
      setTeamFouls((prev) => ({
        ...prev,
        [lastAction.quarter]: Math.max(0, (prev[lastAction.quarter] || 0) - 1),
      }));
    }

    setActionHistory(historyCopy); // Update the history array
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
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="font-bold text-lg flex items-center gap-2">
              <Activity className="text-amber-400" /> SubNScore
            </div>
            <div className="flex bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setView("SETUP")}
                className={`px-3 py-1.5 rounded-md text-sm ${view === "SETUP" ? "bg-white text-slate-900" : "text-slate-300"}`}
              >
                Setup
              </button>
              <button
                onClick={() => setView("LIVE")}
                className={`px-3 py-1.5 rounded-md text-sm ${view === "LIVE" ? "bg-white text-slate-900" : "text-slate-300"}`}
              >
                Live
              </button>
              <button
                onClick={() => setView("STATS")}
                className={`px-3 py-1.5 rounded-md text-sm ${view === "STATS" ? "bg-white text-slate-900" : "text-slate-300"}`}
              >
                Report
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400"
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
            startGame={startGame}
            setupAttempted={setupAttempted}
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
            undoLastAction={undoLastAction}
            actionHistory={actionHistory}
            teamMeta={teamMeta}
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
          />
        )}
      </main>
    </div>
  );
}

// --- VIEW COMPONENTS (Defined OUTSIDE App to prevent focus loss) ---

function AuthView({
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  handleLocalAuth,
  handleDemoLogin,
}) {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <h1 className="text-2xl font-bold text-center mb-6">
          {authMode === "login" ? "Coach Login" : "Register Coach"}
        </h1>
        <form onSubmit={handleLocalAuth} className="space-y-4">
          {authMode === "register" && (
            <input
              required
              className="w-full p-2 border rounded"
              placeholder="Full Name"
              value={authForm.name}
              onChange={(e) =>
                setAuthForm({ ...authForm, name: e.target.value })
              }
            />
          )}
          <input
            type="email"
            required
            className="w-full p-2 border rounded"
            placeholder="Email"
            value={authForm.email}
            onChange={(e) =>
              setAuthForm({ ...authForm, email: e.target.value })
            }
          />
          <input
            type="password"
            required
            className="w-full p-2 border rounded"
            placeholder="Password"
            value={authForm.password}
            onChange={(e) =>
              setAuthForm({ ...authForm, password: e.target.value })
            }
          />
          <button
            type="submit"
            className="w-full bg-slate-900 text-white py-2 rounded font-bold"
          >
            {authMode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* DEMO BUTTON */}
        <button
          onClick={handleDemoLogin}
          className="w-full mt-4 bg-emerald-600 text-white py-2 rounded font-bold hover:bg-emerald-700 transition-colors"
        >
          Try Demo (No Login Required)
        </button>

        <button
          onClick={() =>
            (window.location.href = "http://localhost:5000/api/auth/google")
          }
          className="w-full mt-4 flex items-center justify-center gap-2 border py-2 rounded font-bold hover:bg-slate-50"
        >
          <Globe size={18} className="text-red-500" /> Google Login
        </button>
        <p className="mt-4 text-center text-sm">
          <button
            onClick={() =>
              setAuthMode(authMode === "login" ? "register" : "login")
            }
            className="text-blue-600 font-bold"
          >
            {authMode === "login"
              ? "Need an account? Register"
              : "Have an account? Login"}
          </button>
        </p>
      </div>
    </div>
  );
}

function SetupView({
  user,
  teamMeta,
  setTeamMeta,
  roster,
  newPlayer,
  setNewPlayer,
  handleAddPlayer,
  handleRemovePlayer,
  startGame,
  setupAttempted,
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* SECTION 1: TEAM INFORMATION */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
          <Settings className="text-blue-600" size={20} /> Game Setup
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TEAM NAME INPUT */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              Your Team Name
              {setupAttempted && !teamMeta.teamName.trim() && (
                <span className="text-red-500 animate-pulse font-bold">*</span>
              )}
            </label>
            <input
              className={`border p-2.5 rounded-lg outline-none transition-all duration-200 ${
                setupAttempted && !teamMeta.teamName.trim()
                  ? "border-red-500 bg-red-50 ring-1 ring-red-200"
                  : "focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              }`}
              placeholder="e.g. Lakers"
              value={teamMeta.teamName}
              onChange={(e) =>
                setTeamMeta({ ...teamMeta, teamName: e.target.value })
              }
            />
          </div>

          {/* OPPONENT NAME INPUT */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              Opponent Name
              {setupAttempted && !teamMeta.opponent.trim() && (
                <span className="text-red-500 animate-pulse font-bold">*</span>
              )}
            </label>
            <input
              className={`border p-2.5 rounded-lg outline-none transition-all duration-200 ${
                setupAttempted && !teamMeta.opponent.trim()
                  ? "border-red-500 bg-red-50 ring-1 ring-red-200"
                  : "focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              }`}
              placeholder="e.g. Bulls"
              value={teamMeta.opponent}
              onChange={(e) =>
                setTeamMeta({ ...teamMeta, opponent: e.target.value })
              }
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: ROSTER MANAGEMENT */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
          <UserPlus className="text-blue-600" size={20} /> Build Roster
          <span className="text-sm font-normal text-slate-500 ml-auto">
            ({roster.length} Players)
          </span>
        </h2>

        <form onSubmit={handleAddPlayer} className="flex gap-2">
          <input
            required
            className="border p-2.5 rounded-lg flex-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            placeholder="Player Name"
            value={newPlayer.name}
            onChange={(e) =>
              setNewPlayer({ ...newPlayer, name: e.target.value })
            }
          />
          <input
            required
            className="border p-2.5 rounded-lg w-24 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            placeholder="Jersey #"
            value={newPlayer.jersey}
            onChange={(e) =>
              setNewPlayer({ ...newPlayer, jersey: e.target.value })
            }
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Add
          </button>
        </form>

        {/* LIST OF ADDED PLAYERS */}
        <div className="mt-6 flex flex-wrap gap-2">
          {roster.length === 0 ? (
            <p className="text-slate-400 italic text-sm">
              No players added yet. Minimum 5 required.
            </p>
          ) : (
            roster.map((p) => (
              <div
                key={p.id}
                className="bg-slate-100 pl-3 pr-1 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 border border-slate-200 group hover:border-slate-300 transition-all shadow-sm"
              >
                <span className="text-blue-700">#{p.jersey}</span>
                <span className="text-slate-700">{p.name}</span>
                <button
                  onClick={() => handleRemovePlayer(p.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-500 hover:text-white transition-colors"
                  title="Remove Player"
                >
                  &times;
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* START GAME BUTTON */}
      <button
        onClick={startGame}
        className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <Play fill="currentColor" size={20} /> Start Game Tracking
      </button>

      <p className="text-center text-slate-400 text-xs">
        Logged in as {user.email}
      </p>
    </div>
  );
}

function LiveView({
  court,
  roster,
  playerStats,
  clock,
  isRunning,
  setIsRunning,
  quarter,
  advanceQuarter,
  subOut,
  subIn,
  addStat,
  teamFouls,
  setTimeouts,
  timeouts,
  undoLastAction,
  actionHistory,
  teamMeta, // <-- Make sure this is caught here
}) {
  // NEW: Calculate total team score from all individual player stats
  const teamTotalScore = Object.values(playerStats).reduce(
    (acc, curr) => acc + (curr.score || 0),
    0,
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ========================================= */}
      {/* 1. NEW SCOREBOARD HEADER                  */}
      {/* ========================================= */}
      <div className="bg-slate-900 rounded-xl p-4 flex justify-between items-center text-white shadow-lg border-b-4 border-amber-500">
        <div className="text-center flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {teamMeta?.teamName || "HOME"}
          </p>
          <p className="text-4xl font-black">{teamTotalScore}</p>
        </div>
        <div className="px-6 text-xl font-bold text-amber-500 italic">VS</div>
        <div className="text-center flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {teamMeta?.opponent || "AWAY"}
          </p>
          <p className="text-4xl font-black text-slate-500">--</p>
        </div>
      </div>

      {/* ========================================= */}
      {/* 2. MAIN GAME INTERFACE (3-COL GRID)       */}
      {/* ========================================= */}
      <div className="flex flex-col md:grid md:grid-cols-3 gap-6">
        {/* LEFT & MIDDLE: COURT AND BENCH */}
        <div className="md:col-span-2 space-y-6">
          {/* ON COURT PLAYERS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-3 text-white font-bold flex justify-between items-center">
              <span>ON COURT</span>
              <span className="text-xs font-normal opacity-70">
                Click stats to record
              </span>
            </div>
            <div className="p-4 space-y-3">
              {court.map((id) => {
                const p = roster.find((r) => r.id === id);
                const stats = playerStats[id] || { score: 0, fouls: 0 };

                return (
                  <div
                    key={id}
                    className="flex items-center justify-between p-3 bg-slate-50 border rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">
                        #{p.jersey} {p.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        Pts: {stats.score} | Fls: {stats.fouls}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* SCORING BUTTONS */}
                      <div className="flex bg-white rounded shadow-sm border p-1 gap-1">
                        <button
                          onClick={() => addStat(id, "score", 1)}
                          className="w-8 h-8 flex items-center justify-center bg-amber-50 text-amber-700 rounded font-bold text-xs hover:bg-amber-100"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => addStat(id, "score", 2)}
                          className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-700 rounded font-bold text-xs hover:bg-blue-100"
                        >
                          +2
                        </button>
                        <button
                          onClick={() => addStat(id, "score", 3)}
                          className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-700 rounded font-bold text-xs hover:bg-emerald-100"
                        >
                          +3
                        </button>
                      </div>

                      {/* FOUL BUTTON */}
                      <button
                        onClick={() => addStat(id, "fouls", 1)}
                        className="w-10 h-10 bg-red-50 text-red-600 border border-red-100 rounded flex flex-col items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                      >
                        <span className="text-[10px] font-bold leading-none">
                          FOUL
                        </span>
                        <span className="font-bold">{stats.fouls}</span>
                      </button>

                      {/* SUB OUT BUTTON */}
                      <button
                        onClick={() => subOut(id)}
                        className="ml-2 px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-black text-slate-600 transition-colors"
                      >
                        OUT
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BENCH PLAYERS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 p-3 text-slate-600 font-bold text-sm uppercase tracking-wide">
              Bench (Click to sub in)
            </div>
            <div className="p-4 flex flex-wrap gap-3">
              {roster
                .filter((r) => !court.includes(r.id))
                .map((p) => {
                  const stats = playerStats[p.id] || { score: 0, fouls: 0 };
                  return (
                    <button
                      key={p.id}
                      onClick={() => subIn(p.id)}
                      className="bg-white border-2 border-slate-100 px-4 py-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm flex flex-col items-start min-w-[120px]"
                    >
                      <span className="font-bold text-slate-700">
                        #{p.jersey} {p.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                        Pts: {stats.score} | Fls: {stats.fouls}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: CLOCK AND TEAM STATS */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl p-6 text-center text-white shadow-xl border-b-4 border-blue-600">
            <div className="text-xs font-bold opacity-50 uppercase tracking-widest">
              Quarter {quarter}
            </div>

            {/* The clock text formatting assumes you still have `formatTime` defined in App.jsx */}
            <div className="text-6xl font-mono font-bold my-4 tabular-nums">
              {Math.floor(clock / 60)
                .toString()
                .padStart(2, "0")}
              :{(clock % 60).toString().padStart(2, "0")}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`flex-1 py-3 rounded-xl font-black text-lg shadow-inner transition-all ${isRunning ? "bg-amber-500 text-slate-900" : "bg-emerald-500 text-white"}`}
              >
                {isRunning ? "PAUSE CLOCK" : "START CLOCK"}
              </button>

              <button
                onClick={advanceQuarter}
                className="bg-slate-700 hover:bg-slate-600 px-4 rounded-xl transition-colors"
              >
                ⏩
              </button>
            </div>
          </div>

          {/* TEAM STATS BOX */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-slate-500 uppercase text-xs tracking-wider">
                Team Fouls (Q{quarter})
              </span>
              <span
                className={`text-2xl font-black ${teamFouls[quarter] >= 5 ? "text-red-600 animate-pulse" : "text-slate-800"}`}
              >
                {teamFouls[quarter] || 0}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() =>
                  setTimeouts([...timeouts, { quarter, time: clock }])
                }
                className="w-full border-2 border-slate-100 py-3 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                Use Timeout (
                {timeouts.filter((t) => t.quarter === quarter).length})
              </button>

              {/* UNDO BUTTON */}
              <button
                onClick={undoLastAction}
                disabled={actionHistory.length === 0}
                className={`w-full py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${actionHistory.length === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-100" : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"}`}
              >
                ↺ Undo Last Action
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsView({ roster, playerStats, stints, clock, teamMeta, quarter }) {
  const calculateMins = (pId) => {
    let total = 0;
    stints
      .filter((s) => s.playerId === pId)
      .forEach((s) => {
        const out =
          s.clockOut !== null ? s.clockOut : s.quarter === quarter ? clock : 0;
        total += s.clockIn - out;
      });
    return formatTime(total);
  };
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow border overflow-hidden">
      <div className="bg-slate-900 p-4 text-white font-bold">
        {teamMeta.teamName || "Team"} Final Report
      </div>
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="p-4">Player</th>
            <th className="p-4 text-center">PTS</th>
            <th className="p-4 text-center">FLS</th>
            <th className="p-4 text-center">Total Min</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {roster.map((p) => (
            <tr key={p.id}>
              <td className="p-4">
                #{p.jersey} {p.name}
              </td>
              <td className="p-4 text-center font-bold">
                {playerStats[p.id].score}
              </td>
              <td className="p-4 text-center text-red-600">
                {playerStats[p.id].fouls}
              </td>
              <td className="p-4 text-center font-mono">
                {calculateMins(p.id)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
