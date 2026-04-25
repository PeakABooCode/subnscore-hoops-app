import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { Activity, LogOut, History as HistoryIcon, Lock } from "lucide-react";

// --- Imports ---
import AuthView from "./components/AuthView";
import SetupView from "./components/SetupView";
import LiveView from "./components/LiveView";
import StatsView from "./components/StatsView";
import ConfirmationModal from "./components/ConfirmationModal";
import InputModal from "./components/InputModal";
import HistoryView from "./components/HistoryView";
import { useTimer } from "./hooks/useTimer";
import {
  QUARTER_SECONDS,
  hydrateActions,
  dehydrateActions,
} from "./utils/helpers";

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
  const [pendingSwapIds, setPendingSwapIds] = useState([]);

  // State to hold a loaded historical game
  const [historyData, setHistoryData] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_historyData");
      if (!saved) return null;
      const data = JSON.parse(saved);
      // Map keys back to original names (Hydration)
      if (data.actions) {
        data.actions = hydrateActions(data.actions);
      }
      return data;
    } catch {
      return null;
    }
  });

  // --- Auth State ---
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
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
  const [availableTeams, setAvailableTeams] = useState([]);

  // Fetch coach's existing teams for lookup/auto-fill in SetupView
  useEffect(() => {
    if (user && view === "SETUP") {
      const fetchTeams = async () => {
        try {
          const res = await axios.get("/api/teams");
          // Sort by updated_at descending to put recently used teams first
          const sorted = [...res.data].sort(
            (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
          );
          setAvailableTeams(sorted);
        } catch (err) {
          console.error("Error fetching available teams:", err);
        }
      };
      fetchTeams();
    }
  }, [user, view]);

  // --- Modal States ---
  const [isResetGameConfirmOpen, setIsResetGameConfirmOpen] = useState(false);
  const [isAdvanceQuarterConfirmOpen, setIsAdvanceQuarterConfirmOpen] =
    useState(false);
  const [isOpponentScoreInputOpen, setIsOpponentScoreInputOpen] =
    useState(false);
  const [opponentScoreInput, setOpponentScoreInput] = useState("0");
  const [saveGameCallback, setSaveGameCallback] = useState(null);

  // Derived state to determine if a game session is already active
  const gameInProgress =
    stints.length > 0 ||
    actionHistory.length > 0 ||
    Object.keys(playerStats).some((id) => {
      const s = playerStats[id];
      // If any player has recorded stats, the game is in progress
      return s && (s.score > 0 || s.fouls > 0 || s.turnovers > 0);
    });

  // Auto-Savers
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_teamMeta", JSON.stringify(teamMeta));
  }, [teamMeta]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_roster", JSON.stringify(roster));
  }, [roster]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_playerStats", JSON.stringify(playerStats));
  }, [playerStats]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_view", view);
  }, [view]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem(
      "subnscore_actionHistory",
      JSON.stringify(actionHistory),
    );
  }, [actionHistory]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_quarter", JSON.stringify(quarter));
  }, [quarter]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_court", JSON.stringify(court));
  }, [court]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_stints", JSON.stringify(stints));
  }, [stints]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_teamFouls", JSON.stringify(teamFouls));
  }, [teamFouls]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_timeouts", JSON.stringify(timeouts));
  }, [timeouts]);
  useEffect(() => {
    if (!isLoaded.current) return;
    if (historyData) {
      // Map keys to short names to save space (Dehydration)
      const optimizedData = {
        ...historyData,
        actions: dehydrateActions(historyData.actions),
      };
      localStorage.setItem(
        "subnscore_historyData",
        JSON.stringify(optimizedData),
      );
    } else {
      localStorage.removeItem("subnscore_historyData");
    }
  }, [historyData]);

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
        if (err.response?.status === 401) {
          setView("AUTH");
        }
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkSession();

    // Detect password reset token in URL on load
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("token")) {
      setAuthMode("resetPassword");
      setView("AUTH");
    }

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
      // Validation: Check if passwords match during registration
      if (
        authMode === "register" &&
        authForm.password !== authForm.confirmPassword
      ) {
        showNotification("Passwords do not match!");
        return;
      }

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
        setAuthMode("login");
        showNotification(
          "Account created! Please sign in with your credentials.",
        );
      }
    } catch (err) {
      console.error("Full Auth Error Response:", err.response);

      // Check if response is HTML (server crash) or JSON (validation error)
      let errorMsg = "Authentication failed.";
      if (err.response?.data && typeof err.response.data === "object") {
        errorMsg =
          err.response.data.error || err.response.data.message || errorMsg;
      } else if (err.response?.status === 500) {
        errorMsg = "Server crash detected. Please check server logs.";
      }

      showNotification(errorMsg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      const res = await axios.post("/api/auth/forgot-password", {
        email: authForm.email,
      });
      showNotification(res.data.message);
      setAuthForm({ ...authForm, email: "" }); // Clear email field
      setAuthMode("login"); // Go back to login view
    } catch (err) {
      console.error("Forgot Password Error:", err.response);
      const errorMsg =
        err.response?.data?.error || "Failed to send reset link.";
      showNotification(errorMsg);
      console.error("Mailgun/SMTP Error:", err.response?.data || err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");

      if (!token) {
        showNotification("Missing password reset token.");
        return;
      }
      if (authForm.password !== authForm.confirmPassword) {
        showNotification("Passwords do not match!");
        return;
      }

      const res = await axios.post("/api/auth/reset-password", {
        token,
        newPassword: authForm.password,
        confirmPassword: authForm.confirmPassword,
      });
      showNotification(res.data.message);

      // Clear the URL token and form
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthForm({ email: "", password: "", confirmPassword: "", name: "" });
      setAuthMode("login"); // Go back to login view
    } catch (err) {
      console.error("Reset Password Error:", err.response);
      const errorMsg = err.response?.data?.error || "Failed to reset password.";
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
      localStorage.removeItem("subnscore_historyData");

      setUser(null);
      setView("AUTH");
      // Complete Refresh on Logout
      resetGame(true);
      //Logged out and session cleared
      showNotification("Logged out successfully.");
    } catch (err) {
      showNotification("Error logging out.");
    }
  };

  const handleSaveRoster = async () => {
    if (!teamMeta.teamName) return showNotification("Enter team name first!");
    if (roster.length === 0)
      return showNotification("Add players to save roster!");

    try {
      // Final de-duplication and cleaning before saving to database
      const uniqueRoster = [];
      const seen = new Set();

      roster.forEach((p) => {
        const key = `${p.jersey.toString().trim()}-${p.name.trim().toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueRoster.push({
            name: p.name.trim(),
            jersey: p.jersey.toString().trim(),
          });
        }
      });

      await axios.post("/api/teams/roster", {
        teamName: teamMeta.teamName,
        roster: uniqueRoster,
      });
      showNotification("Permanent roster saved!");
    } catch (err) {
      console.error("Save Roster Error:", err.response);
      if (err.response?.status === 401) {
        setView("AUTH");
        showNotification("Session expired. Please log in.");
      } else {
        showNotification("Failed to save roster to cloud.");
      }
    }
  };

  const handleLoadRoster = async () => {
    if (!teamMeta.teamName)
      return showNotification("Enter team name to search!");

    try {
      const res = await axios.get(
        `/api/teams/roster/${encodeURIComponent(teamMeta.teamName)}`,
      );
      if (!res.data || !Array.isArray(res.data) || res.data.length === 0)
        return showNotification("No saved roster found.");

      // 1. Map players from DB to stable IDs
      const loadedFromDB = res.data
        .filter((p) => p && typeof p === "object")
        .map((p) => ({
          ...p,
          id: p.id ? p.id.toString() : Date.now().toString() + Math.random(),
          name: (p.name || "").trim(),
          jersey: (p.jersey || p.jersey_number || "").toString().trim(),
        }));

      // 2. PRESERVE MANUAL PLAYERS: Identify players currently in roster but missing from DB
      const manualAdditions = roster.filter(
        (currentP) =>
          currentP &&
          !loadedFromDB.some(
            (dbP) =>
              dbP.name.toLowerCase() === currentP.name.trim().toLowerCase() &&
              dbP.jersey === currentP.jersey.toString().trim(),
          ),
      );

      const combinedRoster = [...loadedFromDB, ...manualAdditions];
      const loadedPlayerIds = new Set(combinedRoster.map((p) => p.id));

      // 3. Intelligent Data Reconciliation
      setPlayerStats((prevStats) => {
        const nextStats = {};
        // Map old roster to help reconciliation by identity
        const oldRosterMap = roster.reduce((acc, p) => {
          if (!p || !p.id) return acc;
          return {
            ...acc,
            [p.id]: `${p.jersey.toString().trim()}-${p.name.trim().toLowerCase()}`,
          };
        }, {});

        combinedRoster.forEach((p) => {
          if (!p) return;
          const key = `${p.jersey}-${p.name.toLowerCase()}`;
          // Find if this player existed (by ID or by Identity)
          const prevId = Object.keys(prevStats).find(
            (id) => id === p.id || oldRosterMap[id] === key,
          );

          if (prevId && prevStats[prevId]) {
            nextStats[p.id] = prevStats[prevId];
          } else {
            nextStats[p.id] = { score: 0, fouls: 0, turnovers: 0 };
          }
        });
        return nextStats;
      });

      // Update stints and action history to use new IDs if they matched by identity
      // This is crucial for Quarter Data and Timeline reports
      setStints((prevStints) => {
        return prevStints
          .map((s) => {
            const oldP = roster.find((r) => r.id === s.playerId);
            if (!oldP) return s;
            const newP = combinedRoster.find(
              (r) =>
                r.name.toLowerCase() === oldP.name.trim().toLowerCase() &&
                r.jersey === oldP.jersey.toString().trim(),
            );
            return newP ? { ...s, playerId: newP.id } : s;
          })
          .filter((s) => loadedPlayerIds.has(s.playerId));
      });

      setActionHistory((prevActions) => {
        return prevActions
          .map((a) => {
            if (!a.playerId) return a;
            const oldP = roster.find((r) => r.id === a.playerId);
            if (!oldP) return a;
            const newP = combinedRoster.find(
              (r) =>
                r.name.toLowerCase() === oldP.name.trim().toLowerCase() &&
                r.jersey === oldP.jersey.toString().trim(),
            );
            return newP ? { ...a, playerId: newP.id } : a;
          })
          .filter((a) => !a.playerId || loadedPlayerIds.has(a.playerId));
      });

      setRoster(combinedRoster);

      // Sync court to ensure no "ghost" IDs exist
      setCourt((prev) =>
        prev
          .filter((id) => {
            const oldP = roster.find((r) => r.id === id);
            return (
              oldP &&
              combinedRoster.some(
                (r) =>
                  r.name.toLowerCase() === oldP.name.trim().toLowerCase() &&
                  r.jersey === oldP.jersey.toString().trim(),
              )
            );
          })
          .map((id) => {
            const oldP = roster.find((r) => r.id === id);
            return combinedRoster.find(
              (r) =>
                r.name.toLowerCase() === oldP.name.trim().toLowerCase() &&
                r.jersey === oldP.jersey.toString().trim(),
            )?.id;
          }),
      );

      setView("SETUP");
      showNotification(`Loaded ${loadedFromDB.length} players!`);
    } catch (err) {
      console.error("Load Roster Error:", err);
      showNotification("Error loading roster.");
    }
  };

  // --- Game Setup Handlers ---
  const handleAddPlayer = (e) => {
    e.preventDefault();
    if (!newPlayer.name || !newPlayer.jersey) return;

    const jerseyExists = roster.some(
      (p) => p.jersey.toString().trim() === newPlayer.jersey.toString().trim(),
    );
    if (jerseyExists) {
      return showNotification(
        `Jersey #${newPlayer.jersey} is already assigned.`,
      );
    }

    const id = Date.now().toString();
    setRoster([...roster, { ...newPlayer, id }]);
    setPlayerStats({
      ...playerStats,
      [id]: { score: 0, fouls: 0, turnovers: 0 },
    });
    setNewPlayer({ name: "", jersey: "" });
  };

  const handleEditPlayer = (id, updates) => {
    setRoster(roster.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const startGame = () => {
    setSetupAttempted(true);
    if (!teamMeta.teamName || !teamMeta.opponent)
      return showNotification("Check team info!");
    if (roster.length < 5) return showNotification("Need 5 players.");

    // If a game is already in progress, just switch to LIVE view (Resume Mode)
    if (gameInProgress) {
      setHistoryData(null);
      setView("LIVE");
      return;
    }

    // NEW GAME INITIALIZATION
    try {
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
    } catch (err) {
      console.error("Game Start Initialization Error:", err);
    }

    setHistoryData(null);
    setView("LIVE");
  };

  const resetGame = (force = false, skipConfirm = false) => {
    // When called via onClick, 'force' is the Event object.
    // We check strictly for 'true' to distinguish programmatic calls from UI events.
    if (force !== true && skipConfirm !== true) {
      setIsResetGameConfirmOpen(true);
      return;
    }

    // 1. Wipe Team & Roster (The "Textboxes")
    setTeamMeta({
      teamName: user?.teamName || "", // Pre-fill with user's default team name if available
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
    setPendingSwapIds([]);

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
    localStorage.removeItem("subnscore_historyData");

    // 3. Go back to Setup View
    setView("SETUP");
  };

  // --- Live Action Handlers --- //
  const handleSwap = (playerId) => {
    if (isRunning) return showNotification("Pause clock to sub!");

    const isAlreadySelected = pendingSwapIds.includes(playerId);
    let nextSelected;

    // Logic for multi-player swap selection
    if (isAlreadySelected) {
      nextSelected = pendingSwapIds.filter((id) => id !== playerId);
    } else {
      nextSelected = [...pendingSwapIds, playerId];
    }

    const onCourtSelected = nextSelected.filter((id) => court.includes(id));
    const onBenchSelected = nextSelected.filter((id) => !court.includes(id));

    // If we have a balanced selection (e.g., 1 for 1, 5 for 5)
    if (
      onCourtSelected.length === onBenchSelected.length &&
      onCourtSelected.length > 0
    ) {
      const newStints = [...stints];
      const newCourt = [...court];
      const newActions = [...actionHistory];

      onCourtSelected.forEach((pOut, index) => {
        const pIn = onBenchSelected[index];

        // 1. Close stint for player going out
        newStints.forEach((s, i) => {
          if (s.playerId === pOut && s.clockOut === null) {
            newStints[i] = { ...s, clockOut: clock };
          }
        });

        // 2. Open stint for player coming in
        newStints.push({
          id: Math.random().toString(),
          playerId: pIn,
          quarter,
          clockIn: clock,
          clockOut: null,
        });

        // 3. Update court
        const outIdx = newCourt.indexOf(pOut);
        if (outIdx > -1) newCourt[outIdx] = pIn;

        // 4. Record history
        newActions.push(
          { type: "SUB_IN", playerId: pIn, clock, quarter },
          { type: "SUB_OUT", playerId: pOut, clock, quarter },
        );
      });

      setStints(newStints);
      setCourt(newCourt);
      setActionHistory(newActions);
      setPendingSwapIds([]);
      showNotification(`Subbed ${onCourtSelected.length} players!`);
    } else {
      setPendingSwapIds(nextSelected);
    }
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

    if (lastAction.type === "TIMEOUT") {
      setTimeouts((prev) => prev.slice(0, -1));
    } else if (lastAction.playerId) {
      setPlayerStats((prev) => ({
        ...prev,
        [lastAction.playerId]: {
          ...prev[lastAction.playerId],
          [lastAction.type]: Math.max(
            0,
            (prev[lastAction.playerId][lastAction.type] || 0) -
              (lastAction.amount || 0),
          ),
        },
      }));

      if (lastAction.type === "fouls") {
        setTeamFouls((prev) => ({
          ...prev,
          [lastAction.quarter]: Math.max(
            0,
            (prev[lastAction.quarter] || 0) - 1,
          ),
        }));
      }
    }
    setActionHistory(historyCopy);
    showNotification("Undo successful.");
  };

  const advanceQuarter = (skipConfirm = false) => {
    const pName =
      quarter > 4 ? `Overtime ${quarter - 4}` : `Quarter ${quarter}`;
    // When called via onClick, 'skipConfirm' is the Event object.
    // Strictly check for 'true' to ensure the modal is triggered.
    if (skipConfirm !== true) return setIsAdvanceQuarterConfirmOpen(true);

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

  // --- Backend Integration Handlers --- //
  const handleSaveGame = async (oppScoreValue) => {
    if (user?.email === "demo@subnscore.com")
      return showNotification("Demo Mode: Cannot save.");

    const teamScore = Object.values(playerStats).reduce((acc, curr) => {
      if (!curr) return acc;
      return acc + (curr.score || 0);
    }, 0);

    // If oppScoreValue is not provided, open the input modal
    if (oppScoreValue === undefined) {
      setSaveGameCallback(() => (score) => handleSaveGame(score));
      setIsOpponentScoreInputOpen(true);
      return;
    }

    const oppScore = parseInt(oppScoreValue) || 0;

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
                  : 0; // Fallback: Played to the end of the quarter
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

      // Calculate detailed stats for EVERY quarter to be saved
      const calculatedQuarterStats = [];
      for (let q = 1; q <= quarter; q++) {
        roster.forEach((p) => {
          let qSecs = 0;
          stints
            .filter((s) => s.playerId === p.id && s.quarter === q)
            .forEach((s) => {
              const out =
                s.clockOut !== null
                  ? s.clockOut
                  : s.quarter === quarter
                    ? clock
                    : 0;
              qSecs += s.clockIn - out;
            });

          const qPts = actionHistory
            .filter(
              (a) =>
                a.playerId === p.id && a.quarter === q && a.type === "score",
            )
            .reduce((sum, a) => sum + a.amount, 0);
          const qFls = actionHistory
            .filter(
              (a) =>
                a.playerId === p.id && a.quarter === q && a.type === "fouls",
            )
            .reduce((sum, a) => sum + a.amount, 0);
          const qTOs = actionHistory
            .filter(
              (a) =>
                a.playerId === p.id &&
                a.quarter === q &&
                a.type === "turnovers",
            )
            .reduce((sum, a) => sum + a.amount, 0);

          if (qSecs > 0 || qPts > 0 || qFls > 0 || qTOs > 0) {
            calculatedQuarterStats.push({
              playerId: p.id,
              quarter: q,
              points: qPts,
              fouls: qFls,
              turnovers: qTOs,
              secondsPlayed: qSecs,
            });
          }
        });
      }

      const payload = {
        teamMeta,
        roster: finalRosterWithMins,
        calculatedQuarterStats,
        playerStats,
        actionHistory,
        timeouts,
        finalScoreUs: teamScore,
        finalScoreThem: oppScore,
      };

      await axios.post("/api/games/save", payload);
      showNotification("Game saved to cloud!");

      // Pass 'true' to force reset everything (including textboxes) without a second prompt
      resetGame(true);
    } catch (err) {
      console.error("Save Error:", err.response);
      const msg =
        err.response?.status === 429
          ? "Slow down, Coach! Too many save attempts. Try again in a minute."
          : "Save failed. Please check your connection.";
      showNotification(msg);
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
        clock: Number(l.time_remaining),
      }));

      setHistoryData({
        meta: { ...game, teamName: game.team_name || teamMeta.teamName },
        roster: historicalRoster,
        stats: historicalStats,
        actions: historicalActions,
        quarterStats: res.data.quarterStats || [],
        quarter: Math.max(...logs.map((l) => l.quarter), 4),
      });
      setView("STATS");
    } catch (err) {
      showNotification("Error loading game.");
    }
  };

  // Calculate accumulated time for each player for real-time display
  const playerTimes = useMemo(() => {
    return roster.reduce((acc, player) => {
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
      acc[player.id] = totalSeconds;
      return acc;
    }, {});
  }, [roster, stints, quarter, clock]);

  if (isAuthLoading)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative mb-6">
          {/* Bouncing Basketball */}
          <div className="w-16 h-16 bg-amber-500 rounded-full border-4 border-slate-900 shadow-xl animate-bounce flex items-center justify-center overflow-hidden">
            <Activity className="text-white opacity-40" size={32} />
            {/* Subtle seam lines for the ball effect */}
            <div className="absolute w-full h-0.5 bg-slate-900/10 rotate-45"></div>
            <div className="absolute w-full h-0.5 bg-slate-900/10 -rotate-45"></div>
          </div>
          {/* Ground Shadow */}
          <div className="w-12 h-1.5 bg-slate-200 rounded-[100%] mx-auto blur-sm animate-pulse"></div>
        </div>
        <div className="text-slate-900 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
          Initializing Courtside
        </div>
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
                disabled={!gameInProgress}
                onClick={() => {
                  setView("LIVE");
                  setHistoryData(null);
                }}
                title={
                  !gameInProgress ? "Start a game to enable Live view" : ""
                }
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all flex items-center gap-1 ${
                  view === "LIVE"
                    ? "bg-white text-slate-900 shadow"
                    : !gameInProgress
                      ? "text-slate-600 cursor-not-allowed opacity-50"
                      : "text-slate-400 hover:text-white"
                }`}
              >
                {!gameInProgress && <Lock size={12} />}
                Live
              </button>
              <button
                disabled={!gameInProgress && !historyData}
                onClick={() => setView("STATS")}
                title={
                  !gameInProgress && !historyData
                    ? "Start a game or load history to enable Report view"
                    : ""
                }
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all flex items-center gap-1 ${
                  view === "STATS"
                    ? "bg-white text-slate-900 shadow"
                    : !gameInProgress && !historyData
                      ? "text-slate-600 cursor-not-allowed opacity-50"
                      : "text-slate-400 hover:text-white"
                }`}
              >
                {!gameInProgress && !historyData && <Lock size={12} />}
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
            handleForgotPassword={handleForgotPassword}
            handleResetPassword={handleResetPassword}
            showNotification={showNotification}
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
            gameInProgress={gameInProgress}
            resetGame={resetGame}
            handleSaveRoster={handleSaveRoster}
            handleLoadRoster={handleLoadRoster}
            availableTeams={availableTeams}
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
              setActionHistory((prev) => [
                ...prev,
                { type: "TIMEOUT", quarter, clock },
              ]);
            }}
            undoLastAction={undoLastAction}
            teamMeta={teamMeta}
            handleSwap={handleSwap}
            pendingSwapIds={pendingSwapIds}
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
            resetGame={() => {
              if (historyData) {
                setView("HISTORY");
                setHistoryData(null);
              } else {
                resetGame();
              }
            }}
            triggerSaveGame={handleSaveGame}
            isHistory={!!historyData}
            historyQuarterStats={historyData?.quarterStats}
          />
        )}

        {/* Confirmation Modal for Reset Game */}
        <ConfirmationModal
          isOpen={isResetGameConfirmOpen}
          onClose={() => setIsResetGameConfirmOpen(false)}
          onConfirm={() => {
            resetGame(true, true); // Force reset, skip further confirmation
            setIsResetGameConfirmOpen(false);
          }}
          title="Confirm New Game"
          message="Are you sure you want to start a new game? This will clear all current game data, stats, and textboxes."
          confirmText="Start New Game"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
        />

        {/* Confirmation Modal for Advance Quarter */}
        <ConfirmationModal
          isOpen={isAdvanceQuarterConfirmOpen}
          onClose={() => setIsAdvanceQuarterConfirmOpen(false)}
          onConfirm={() => {
            advanceQuarter(true); // Skip further confirmation
            setIsAdvanceQuarterConfirmOpen(false);
          }}
          title={`End ${quarter > 4 ? `Overtime ${quarter - 4}` : `Quarter ${quarter}`}?`}
          message={`Are you sure you want to end ${quarter > 4 ? `Overtime ${quarter - 4}` : `Quarter ${quarter}`} and advance to the next period?`}
          confirmText="Advance Quarter"
          confirmButtonClass="bg-blue-600 hover:bg-blue-700"
        />

        {/* Input Modal for Opponent Score */}
        <InputModal
          isOpen={isOpponentScoreInputOpen}
          onClose={() => setIsOpponentScoreInputOpen(false)}
          onSave={saveGameCallback}
          title={`Enter Final Score for ${teamMeta.opponent}`}
          message="Please enter the opponent's final score to save the game."
          initialValue={opponentScoreInput}
          inputType="number"
        />
      </main>
    </div>
  );
}
