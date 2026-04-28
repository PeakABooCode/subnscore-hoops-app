import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { Activity, LogOut, History as HistoryIcon, Lock } from "lucide-react";

// --- Imports ---
import AuthView from "./components/auth/AuthView";
import SetupView from "./components/coaching/SetupView";
import LiveView from "./components/coaching/LiveView";
import CommitteeDashboardView from "./components/committee/CommitteeDashboardView";
import CommitteeLiveView from "./components/committee/CommitteeLiveView";
import CommitteeScoreboardView from "./components/committee/CommitteeScoreboardView.jsx";
import ModuleSelectionView from "./components/dashboard/ModuleSelectionView";
import StatsView from "./components/coaching/StatsView";
import ConfirmationModal from "./components/common/ConfirmationModal";
import InputModal from "./components/common/InputModal";
import HistoryView from "./components/coaching/HistoryView";
import { useTimer } from "./hooks/useTimer";
import {
  DEFAULT_COMMITTEE_KEYBINDINGS,
  QUARTER_SECONDS,
  hydrateActions,
  dehydrateActions,
  formatTime,
} from "./utils/helpers";

axios.defaults.withCredentials = true;

export default function App() {
  // --- Independent Timers for Coaching and Committee ---
  const coachingTimer = useTimer();
  const committeeTimer = useTimer();

  const {
    clock: coachingClock,
    setClock: setCoachingClock,
    isRunning: isCoachingRunning,
    setIsRunning: setIsCoachingRunning,
  } = coachingTimer;

  const {
    clock: committeeClock,
    setClock: setCommitteeClock,
    isRunning: isCommitteeRunning,
    setIsRunning: setIsCommitteeRunning,
  } = committeeTimer;

  // --- Global App State ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem("subnscore_view");
    return saved && saved !== "AUTH" ? saved : "DASHBOARD";
  }); // AUTH, DASHBOARD, SETUP, LIVE, STATS, HISTORY

  // --- STANDALONE SCOREBOARD CHECK ---
  const urlParams = new URLSearchParams(window.location.search);
  const isScoreboardView = urlParams.get("view") === "scoreboard";

  const [selectedModule, setSelectedModule] = useState(null);
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

  // Explicit snapshots of lineups at the start/end of each quarter
  const [lineupsByQuarter, setLineupsByQuarter] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_lineups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [gameMode, setGameMode] = useState(() => {
    return localStorage.getItem("subnscore_gameMode") || "FULL"; // FULL, HALF, OPEN
  });

  const [pasarelleTriggered, setPasarelleTriggered] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_pasarelleTriggered");
      return saved ? JSON.parse(saved) : { 1: false, 2: false, 3: false };
    } catch {
      return { 1: false, 2: false, 3: false };
    }
  });

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
  const [committeeGameData, setCommitteeGameData] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_committeeGameData");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [teamMeta, setTeamMeta] = useState(() => {
    try {
      const savedMeta = localStorage.getItem("subnscore_teamMeta");
      return savedMeta
        ? { ...JSON.parse(savedMeta), division: JSON.parse(savedMeta).division || "" } // Ensure division is present
        : { teamName: "", opponent: "", league: "", season: "", division: "" };
    } catch {
      return { teamName: "", opponent: "", league: "", season: "", division: "" };
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

  const [committeePossessionArrow, setCommitteePossessionArrow] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_committeePossessionArrow");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [committeeTimeouts, setCommitteeTimeouts] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_committeeTimeouts");
      return saved ? JSON.parse(saved) : { A: [], B: [] };
    } catch {
      return { A: [], B: [] };
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
  const [coachingQuarter, setCoachingQuarter] = useState(() => {
    const saved = localStorage.getItem("subnscore_coachingQuarter");
    return saved ? JSON.parse(saved) : 1;
  });
  const [committeeQuarter, setCommitteeQuarter] = useState(() => {
    const saved = localStorage.getItem("subnscore_committeeQuarter");
    return saved ? JSON.parse(saved) : 1;
  });

  const [teamFouls, setTeamFouls] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_teamFouls");
      return saved ? JSON.parse(saved) : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    } catch {
      return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    }
  });

  const [committeeKeybindings, setCommitteeKeybindings] = useState(() => {
    try {
      const saved = localStorage.getItem("subnscore_committeeKeybindings");
      return saved ? JSON.parse(saved) : DEFAULT_COMMITTEE_KEYBINDINGS;
    } catch {
      return DEFAULT_COMMITTEE_KEYBINDINGS;
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
    if (user && (view === "SETUP" || view === "COMMITTEE_DASHBOARD")) {
      const fetchTeams = async () => {
        try {
          const res = await axios.get("/api/coaching/teams");
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
  const [isDiscardScoresheetConfirmOpen, setIsDiscardScoresheetConfirmOpen] =
    useState(false);
  const [resetTargetView, setResetTargetView] = useState("SETUP");
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
    localStorage.setItem("subnscore_court", JSON.stringify(court));
  }, [court]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem(
      "subnscore_coachingQuarter",
      JSON.stringify(coachingQuarter),
    );
  }, [coachingQuarter]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem(
      "subnscore_committeeQuarter",
      JSON.stringify(committeeQuarter),
    );
  }, [committeeQuarter]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem(
      "subnscore_committeeKeybindings",
      JSON.stringify(committeeKeybindings),
    );
  }, [committeeKeybindings]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_stints", JSON.stringify(stints));
  }, [stints]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_gameMode", gameMode);
  }, [gameMode]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_teamFouls", JSON.stringify(teamFouls));
  }, [teamFouls]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem(
      "subnscore_pasarelleTriggered",
      JSON.stringify(pasarelleTriggered),
    );
  }, [pasarelleTriggered]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_timeouts", JSON.stringify(timeouts));
  }, [timeouts]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_lineups", JSON.stringify(lineupsByQuarter));
  }, [lineupsByQuarter]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_committeeGameData", JSON.stringify(committeeGameData));
  }, [committeeGameData]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_committeePossessionArrow", JSON.stringify(committeePossessionArrow));
  }, [committeePossessionArrow]);
  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem("subnscore_committeeTimeouts", JSON.stringify(committeeTimeouts));
  }, [committeeTimeouts]);
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
    localStorage.setItem(
      "subnscore_coachingClock",
      JSON.stringify(coachingClock),
    );
  }, [coachingClock]);

  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem(
      "subnscore_coachingIsRunning",
      JSON.stringify(isCoachingRunning),
    );
  }, [isCoachingRunning]);

  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem(
      "subnscore_committeeClock",
      JSON.stringify(committeeClock),
    );
  }, [committeeClock]);

  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem(
      "subnscore_committeeIsRunning",
      JSON.stringify(isCommitteeRunning),
    );
  }, [isCommitteeRunning]);

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
          if (selectedModule === "COACHING") {
            setView("SETUP");
          } else {
            setView("DASHBOARD");
          }
        }
      } catch (err) {
        setUser(null);
        if (err.response?.status === 401) {
          // If not authenticated, do NOT set view to AUTH directly.
          // The view should remain DASHBOARD, and AUTH will be triggered
          // only if they select COACHING.
          // setView("AUTH"); // Removed this line
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
    const savedCoachingClock = localStorage.getItem("subnscore_coachingClock");
    const savedCoachingRunning = localStorage.getItem(
      "subnscore_coachingIsRunning",
    );
    const savedCommitteeClock = localStorage.getItem(
      "subnscore_committeeClock",
    );
    const savedCommitteeRunning = localStorage.getItem(
      "subnscore_committeeIsRunning",
    );
    const savedCommitteePossessionArrow = localStorage.getItem(
      "subnscore_committeePossessionArrow",
    );
    const savedCommitteeTimeouts = localStorage.getItem(
      "subnscore_committeeTimeouts",
    );


    const savedCoachingQuarter = localStorage.getItem("subnscore_coachingQuarter");
    const savedCommitteeQuarter = localStorage.getItem("subnscore_committeeQuarter");

    if (savedCoachingClock) setCoachingClock(JSON.parse(savedCoachingClock));
    if (savedCoachingQuarter) setCoachingQuarter(JSON.parse(savedCoachingQuarter));
    if (savedCommitteeQuarter) setCommitteeQuarter(JSON.parse(savedCommitteeQuarter));
    const savedCommitteeKeybindings = localStorage.getItem("subnscore_committeeKeybindings");
    if (savedCoachingRunning)
      setIsCoachingRunning(JSON.parse(savedCoachingRunning));
    if (savedCommitteeClock) setCommitteeClock(JSON.parse(savedCommitteeClock));
    if (savedCommitteeRunning)
      setIsCommitteeRunning(JSON.parse(savedCommitteeRunning));
    if (savedCommitteePossessionArrow) setCommitteePossessionArrow(JSON.parse(savedCommitteePossessionArrow));
    if (savedCommitteeTimeouts) setCommitteeTimeouts(JSON.parse(savedCommitteeTimeouts));
    if (savedCoachingQuarter) setCoachingQuarter(JSON.parse(savedCoachingQuarter));
    if (savedCommitteeQuarter) setCommitteeQuarter(JSON.parse(savedCommitteeQuarter));
    if (savedCommitteeKeybindings) setCommitteeKeybindings(JSON.parse(savedCommitteeKeybindings));

    // 2. Delay marking as loaded slightly to allow states to settle
    setTimeout(() => {
      isLoaded.current = true;
    }, 100);
  }, []);

  // --- Pasarelle Rule Automation Logic ---
  useEffect(() => {
    // Only check if clock is running and hits exactly 5:00 (300 seconds)
    if (!isCoachingRunning || coachingClock !== 300 || !coachingQuarter) return;

    const isPasarelleActive =
      (gameMode === "FULL" && coachingQuarter <= 3) ||
      (gameMode === "HALF" && coachingQuarter <= 2);

    if (isPasarelleActive && !pasarelleTriggered[coachingQuarter]) {
      setIsCoachingRunning(false);
      setPasarelleTriggered((prev) => ({ ...prev, [coachingQuarter]: true }));
      showNotification("PASARELLE BREAK: Mandatory Substitutions Required");
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    }
  }, [coachingClock, isCoachingRunning, coachingQuarter, gameMode, pasarelleTriggered]);

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
          role: selectedModule === "COMMITTEE" ? "COMMITTEE" : "COACH",
        });
        setUser(res.data.user);
        if (selectedModule === "COACHING") {
          setView("SETUP");
        } else if (selectedModule === "COMMITTEE") {
          setCommitteeQuarter(1); // Reset committee quarter on login
          setView("COMMITTEE_DASHBOARD");
        }
        showNotification(`Welcome back, ${res.data.user.name}!`);
      } else {
        const res = await axios.post("/api/auth/register", {
          ...authForm,
          role: selectedModule === "COMMITTEE" ? "COMMITTEE" : "COACH",
        });
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
      localStorage.removeItem("subnscore_coachingClock");
      localStorage.removeItem("subnscore_coachingIsRunning");
      localStorage.removeItem("subnscore_coachingQuarter");
      localStorage.removeItem("subnscore_committeeKeybindings");
      localStorage.removeItem("subnscore_committeeClock");
      localStorage.removeItem("subnscore_committeeIsRunning");
      localStorage.removeItem("subnscore_committeePossessionArrow");
      localStorage.removeItem("subnscore_committeeTimeouts");
    localStorage.removeItem("subnscore_committeePossessionArrow");
    localStorage.removeItem("subnscore_committeeTimeouts");
      localStorage.removeItem("subnscore_committeeGameData");
      localStorage.removeItem("subnscore_historyData");
      localStorage.removeItem("subnscore_pasarelleTriggered");

      setUser(null);
      setSelectedModule(null);
      // Complete Refresh and return to Dashboard
      resetGame(true, true, "DASHBOARD");

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
      // Send current roster with their frontend IDs and existing dbIds for Upsert logic
      const rosterToSave = roster.map((p) => ({
        id: p.id, // Frontend's temporary ID
        dbId: p.dbId, // Database ID if already exists
        name: p.name.trim(),
        jersey: p.jersey.toString().trim(),
      }));

      const res = await axios.post("/api/coaching/teams/roster", {
        teamName: teamMeta.teamName,
        roster: rosterToSave,
        league: teamMeta.league,
        season: teamMeta.season,
      });

      if (!res.data?.roster || !Array.isArray(res.data.roster)) {
        throw new Error("Invalid response from server");
      }

      // Update the local roster state with the new/updated players from the backend.
      const savedRoster = res.data.roster.map((p) => ({
        id: p.id,
        dbId: p.id,
        name: (p.name || "").trim(),
        jersey: (p.jersey || p.jersey_number || "").toString().trim(),
      }));

      // RECONCILIATION: If a game is in progress, we must map old temp IDs to new DB UUIDs
      // to prevent losing current stats, stints, or court placement.
      const idMap = {}; // oldId -> newUuid
      savedRoster.forEach((newP) => {
        const matchingOld = roster.find(
          (oldP) =>
            oldP.name.trim().toLowerCase() === newP.name.toLowerCase() &&
            oldP.jersey.toString().trim() === newP.jersey,
        );
        if (matchingOld) idMap[matchingOld.id] = newP.id;
      });

      // Update all dependent states with new IDs
      setPlayerStats((prev) => {
        const next = {};
        Object.keys(prev).forEach((oldId) => {
          const newId = idMap[oldId] || oldId;
          next[newId] = prev[oldId];
        });
        return next;
      });

      setCourt((prev) => prev.map((oldId) => idMap[oldId] || oldId));

      setStints((prev) =>
        prev.map((stint) => ({
          ...stint,
          playerId: idMap[stint.playerId] || stint.playerId,
        })),
      );

      setActionHistory((prev) =>
        prev.map((action) => ({
          ...action,
          playerId: action.playerId
            ? idMap[action.playerId] || action.playerId
            : action.playerId,
        })),
      );

      setPendingSwapIds((prev) => prev.map((oldId) => idMap[oldId] || oldId));

      // Defensive unique-ification: Ensure no duplicate IDs enter the state
      const uniqueSavedRoster = [];
      const seenIds = new Set();
      savedRoster.forEach((p) => {
        if (!seenIds.has(p.id)) {
          uniqueSavedRoster.push(p);
          seenIds.add(p.id);
        }
      });

      setRoster(uniqueSavedRoster);

      showNotification("Permanent roster saved!");
    } catch (err) {
      console.error("Save Roster Error:", err);
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
        `/api/coaching/teams/roster/${encodeURIComponent(teamMeta.teamName)}`,
      );

      if (!res.data || !Array.isArray(res.data)) {
        return showNotification("Invalid data received from server.");
      }

      if (!res.data || !Array.isArray(res.data) || res.data.length === 0)
        return showNotification("No saved roster found.");

      // 1. Map players from DB to stable IDs and normalize their data and normalize their data and normalize their data and normalize their data and normalize their data and normalize their data
      const loadedFromDB = res.data
        .filter((p) => p && typeof p === "object")
        .map((p) => ({
          ...p,
          id: p.id, // Database UUID serves as the stable identifier
          dbId: p.id,
          name: (p.name || "").trim(),
          jersey: (p.jersey || p.jersey_number || "").toString().trim(),
        }));

      // Create lookup maps for DB players
      const dbPlayersById = new Map(loadedFromDB.map((p) => [p.id, p]));
      const dbPlayersByNameJersey = new Map(
        loadedFromDB.map((p) => [`${p.name.toLowerCase()}-${p.jersey}`, p]),
      );

      const finalRoster = [];
      const processedDbIds = new Set(); // To track which DB players have been added to finalRoster
      const oldIdToNewIdMap = {}; // Map old local IDs to new reconciled IDs

      // First, iterate through the current local roster to handle existing players and local edits
      roster.forEach((localP) => {
        if (!localP) return;

        let reconciledPlayer = null;

        // Attempt 1: Match by dbId (if the local player still has one)
        if (localP.dbId && dbPlayersById.has(localP.dbId)) {
          reconciledPlayer = dbPlayersById.get(localP.dbId);
        } else {
          // Attempt 2: If dbId is null (locally edited) or not found, try to match by current name+jersey
          const identityKey = `${localP.name.toLowerCase()}-${localP.jersey}`;
          if (dbPlayersByNameJersey.has(identityKey)) {
            reconciledPlayer = dbPlayersByNameJersey.get(identityKey);
          }
        }

        if (reconciledPlayer) {
          // If a match is found, use the DB version, ensuring its ID is the DB ID
          finalRoster.push({
            ...reconciledPlayer,
            id: reconciledPlayer.id,
            dbId: reconciledPlayer.id,
          });
          processedDbIds.add(reconciledPlayer.id);
          oldIdToNewIdMap[localP.id] = reconciledPlayer.id; // Map old local ID to new DB ID
        } else {
          // If no match in DB, it's either a truly new local player (temp-ID) or a player
          // that was in the DB but has since been deleted from the DB (unlikely). Keep it as is.
          finalRoster.push({ ...localP, dbId: localP.dbId || null });
          oldIdToNewIdMap[localP.id] = localP.id; // Keep old ID if no reconciliation
        }
      });

      // Add any players from the DB that were not in the local roster (newly added to DB by another client, or if local roster was empty)
      loadedFromDB.forEach((dbP) => {
        if (!processedDbIds.has(dbP.id)) {
          finalRoster.push(dbP);
        }
      });

      // Ensure uniqueness by ID in the final roster before setting state
      const uniqueFinalRoster = [];
      const seenIds = new Set();
      finalRoster.forEach((p) => {
        if (!seenIds.has(p.id)) {
          uniqueFinalRoster.push(p);
          seenIds.add(p.id);
        }
      });

      const combinedPlayerIds = new Set(uniqueFinalRoster.map((p) => p.id));

      // 3. Intelligent Data Reconciliation
      setPlayerStats((prevStats) => {
        const nextStats = {};
        // Map Identity (Name-Jersey) -> ID for local reconciliation fallback
        // This map is now less critical as oldIdToNewIdMap handles direct ID mapping

        uniqueFinalRoster.forEach((p) => {
          if (!p) return;
          // Try to find stats for the old local ID that mapped to this new ID
          const oldLocalId = Object.keys(oldIdToNewIdMap).find(
            (key) => oldIdToNewIdMap[key] === p.id,
          );
          if (oldLocalId && prevStats[oldLocalId]) {
            nextStats[p.id] = prevStats[oldLocalId];
          } else {
            nextStats[p.id] = { score: 0, fouls: 0, turnovers: 0 };
          }
        });
        return nextStats;
      });

      // Helper to map old IDs to new UUIDs across stints and history
      const updateIdInDependentState = (item) => {
        const newId = oldIdToNewIdMap[item.playerId || item.id];
        if (newId) {
          return { ...item, playerId: newId, id: newId };
        }
        return item; // If no mapping, keep original ID
      };

      setStints((prev) =>
        prev // Use the oldIdToNewIdMap for direct ID translation
          .map(updateIdInDependentState)
          .filter((s) => combinedPlayerIds.has(s.playerId)),
      );
      setActionHistory((prev) =>
        prev // Use the oldIdToNewIdMap for direct ID translation
          .map(updateIdInDependentState)
          .filter((a) => !a.playerId || combinedPlayerIds.has(a.playerId)),
      );

      setRoster(uniqueFinalRoster);

      // Sync active court to ensure IDs transition to UUIDs and filter out orphaned players
      setCourt((prev) =>
        prev
          .map((oldId) => oldIdToNewIdMap[oldId] || oldId)
          .filter((id) => uniqueFinalRoster.some((p) => p.id === id)),
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

    // Assign a temporary frontend ID. dbId will be null until saved to cloud.
    const id = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setRoster([...roster, { ...newPlayer, id, dbId: null }]);
    setPlayerStats({
      ...playerStats,
      [id]: { score: 0, fouls: 0, turnovers: 0 },
    });
    setNewPlayer({ name: "", jersey: "" });
  };

  const handleEditPlayer = (id, updates) => {
    // Check for jersey duplicates if the jersey is being updated
    if (updates.jersey) {
      const isDuplicate = roster.some(
        (p) =>
          p.id !== id &&
          p.jersey.toString().trim() === updates.jersey.toString().trim(),
      );
      if (isDuplicate) {
        return showNotification(`Jersey #${updates.jersey} is already in use.`);
      }
    }

    setRoster(
      roster.map((p) =>
        p.id === id
          ? { ...p, ...updates, dbId: null } // Mark as unsynced if edited
          : p,
      ),
    );
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
          quarter: coachingQuarter,
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

  const resetGame = (
    force = false,
    skipConfirm = false,
    nextView = "SETUP",
  ) => {
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
    setCommitteePossessionArrow(null); // Clear committee possession
    setCommitteeTimeouts({ A: [], B: [] }); // Clear committee timeouts
    setStints([]);
    setCoachingQuarter(1); // Reset coaching quarter
    setCommitteeQuarter(1); // Reset committee quarter
    setCoachingClock(QUARTER_SECONDS);
    setIsCoachingRunning(false);
    setActionHistory([]);
    setHistoryData(null);
    setTeamFouls({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    setTimeouts([]);
    setPendingSwapIds([]);
    setPasarelleTriggered({ 1: false, 2: false, 3: false });

    localStorage.removeItem("subnscore_actionHistory");
    localStorage.removeItem("subnscore_playerStats");
    localStorage.removeItem("subnscore_view");
    localStorage.removeItem("subnscore_quarter");
    localStorage.removeItem("subnscore_court");
    localStorage.removeItem("subnscore_stints");
    localStorage.removeItem("subnscore_teamFouls");
    localStorage.removeItem("subnscore_timeouts");
    localStorage.removeItem("subnscore_coachingClock");
    localStorage.removeItem("subnscore_coachingIsRunning");
    localStorage.removeItem("subnscore_coachingQuarter");
    localStorage.removeItem("subnscore_committeeKeybindings");
    localStorage.removeItem("subnscore_committeeClock");
    localStorage.removeItem("subnscore_committeeIsRunning");
    localStorage.removeItem("subnscore_historyData");
    localStorage.removeItem("subnscore_pasarelleTriggered");

    // 3. Go back to Setup View
    setView(nextView);
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
      const isOnCourt = court.includes(playerId);
      const currentOnCourt = pendingSwapIds.filter((id) => court.includes(id));
      const currentOnBench = pendingSwapIds.filter((id) => !court.includes(id));

      if (isOnCourt && currentOnCourt.length >= 5) {
        showNotification("Already selected 5 players from the court.");
        return;
      }
      if (!isOnCourt && currentOnBench.length >= 5) {
        showNotification("Already selected 5 players from the bench.");
        return;
      }
      nextSelected = [...pendingSwapIds, playerId];
    }

    const onCourtSelected = nextSelected.filter((id) => court.includes(id));
    const onBenchSelected = nextSelected.filter((id) => !court.includes(id));

    // TRANSACTION LOGIC:
    // A. Standard balanced swap (1 for 1, 2 for 2, etc.)
    const isBalancedSwap =
      onCourtSelected.length > 0 &&
      onCourtSelected.length === onBenchSelected.length;
    // B. Initial/Quarterly lineup selection (Court is empty, picking 5 from bench)
    const isInitialLineup = court.length === 0 && onBenchSelected.length === 5;

    if (isInitialLineup) {
      const newStints = [...stints];
      const newCourt = []; // Start with an empty court for this scenario
      const newActions = [...actionHistory];

      onBenchSelected.forEach((pIn) => {
        newStints.push({
          id: Math.random().toString(),
          playerId: pIn,
          quarter: coachingQuarter,
          clockIn: clock,
          clockOut: null,
        });
        newCourt.push(pIn);
        newActions.push({ type: "SUB_IN", playerId: pIn, clock, quarter });
      });

      // Capture snapshot if this is the first lineup of the quarter
      setLineupsByQuarter((prev) => ({ // This is for coaching lineups
        ...prev,
        [coachingQuarter]: onBenchSelected,
      }));

      setStints(newStints);
      setCourt(newCourt);
      setActionHistory(newActions);
      setPendingSwapIds([]);
      showNotification(
        `Subbed ${onBenchSelected.length} players onto the court!`,
      );
    } else if (isBalancedSwap) {
      const newStints = [...stints];
      const newCourt = [...court];
      const newActions = [...actionHistory];

      onCourtSelected.forEach((pOut, index) => {
        const pIn = onBenchSelected[index];
        // 1. Close stint for player going out
        newStints.forEach((s, i) => {
          if (s.playerId === pOut && s.clockOut === null) {
            newStints[i] = { ...s, clockOut: coachingClock };
          }
        });

        // 2. Open stint for player coming in
        newStints.push({
          id: Math.random().toString(),
          playerId: pIn,
          quarter,
          clockIn: coachingClock,
          clockOut: null,
        });

        // 3. Update court
        const outIdx = newCourt.indexOf(pOut);
        if (outIdx > -1) newCourt[outIdx] = pIn;

        // 4. Record history
        newActions.push(
          { type: "SUB_IN", playerId: pIn, clock: coachingClock, quarter },
          { type: "SUB_OUT", playerId: pOut, clock: coachingClock, quarter },
        );
      });
      setStints(newStints);
      setCourt(newCourt);
      setActionHistory(newActions);
      setPendingSwapIds([]);
      showNotification(`Subbed ${onCourtSelected.length} players!`); // This will be 0 for initial lineup
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
      const currentFouls = teamFouls[quarter] || 0;
      const nextFouls = currentFouls + amount;

      if (nextFouls === 4) {
        showNotification("Team at 4 fouls - WARNING: Next foul is Penalty!");
      } else if (nextFouls >= 5 && currentFouls < 5) {
        showNotification("TEAM IN PENALTY!");
      }

      setTeamFouls((prev) => ({
        ...prev,
        [coachingQuarter]: nextFouls,
      }));
      setIsCoachingRunning(false);
    }
    setActionHistory((prev) => [
      ...prev,
      { playerId, type, amount, quarter: coachingQuarter, clock: coachingClock },
    ]);
  };

  const addOpponentScore = (amount) => {
    setActionHistory((prev) => [
      ...prev,
      { type: "opp_score", amount, quarter: coachingQuarter, clock: coachingClock },
    ]);
  };

  const undoLastAction = () => {
    if (actionHistory.length === 0) return;
    const historyCopy = [...actionHistory];
    const lastAction = historyCopy.pop();

    if (lastAction.type === "TIMEOUT") {
      setTimeouts((prev) => prev.slice(0, -1));
    } else if (lastAction.type === "opp_score") {
      // No additional state to revert
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
          [lastAction.quarter]: Math.max( // lastAction.quarter is correct here
            0,
            (prev[lastAction.quarter] || 0) - 1,
          ),
        }));
      }
    }
    setActionHistory(historyCopy);
    showNotification("Undo successful.");
  };

  const deleteAction = (index) => {
    const action = actionHistory[index];
    if (!action) return;

    // 1. Revert player stats (Points, Fouls, Turnovers)
    if (
      action.playerId &&
      (action.type === "score" ||
        action.type === "fouls" ||
        action.type === "turnovers")
    ) {
      setPlayerStats((prev) => {
        const pStats = prev[action.playerId];
        if (!pStats) return prev;
        return {
          ...prev,
          [action.playerId]: {
            ...pStats,
            [action.type]: Math.max(
              0,
              (pStats[action.type] || 0) - (action.amount || 0),
            ),
          },
        };
      });

      // 2. Revert team fouls specifically
      if (action.type === "fouls") {
        setTeamFouls((prev) => ({
          ...prev,
          [action.quarter]: Math.max(0, (prev[action.quarter] || 0) - 1), // action.quarter is correct here
        }));
      }
    }

    // 3. Handle Timeout Reversion
    if (action.type === "TIMEOUT") {
      setTimeouts((prev) =>
        prev.filter(
          (t) => !(t.quarter === action.quarter && t.clock === action.clock),
        ),
      );
    }

    // Handle Opponent Score Reversion
    if (action.type === "opp_score") {
      // Removal from history is handled by default logic below
    }

    // 4. Remove from action history array
    const newHistory = [...actionHistory];
    newHistory.splice(index, 1);
    setActionHistory(newHistory);
    showNotification("Action removed from history.");
  };

  const advanceQuarter = (skipConfirm = false) => {
    const pName =
      coachingQuarter > 4 ? `Overtime ${coachingQuarter - 4}` : `Quarter ${coachingQuarter}`;
    // When called via onClick, 'skipConfirm' is the Event object.
    // Strictly check for 'true' to ensure the modal is triggered.
    if (skipConfirm !== true) return setIsAdvanceQuarterConfirmOpen(true);

    // ✅ SAVE CURRENT LINEUP SNAPSHOT BEFORE CLEARING
    setLineupsByQuarter((prev) => ({
      ...prev,
      [coachingQuarter]: [...court],
    }));

    // 1. Close current stints and record SUB_OUT actions for the logs
    const currentCourtPlayers = [...court];
    const updatedStints = stints.map((s) =>
      s.clockOut === null ? { ...s, clockOut: coachingClock } : s,
    );

    const closingActions = currentCourtPlayers.map((pId) => ({
      type: "SUB_OUT",
      playerId: pId,
      clock: coachingClock,
      quarter: coachingQuarter,
    }));

    const nextQ = coachingQuarter + 1;

    setStints(updatedStints); // No "next quarter" stints yet - court is empty
    setCourt([]); // CLEAR THE COURT PERMANENTLY ON ADVANCE
    setPendingSwapIds([]);
    setActionHistory((prev) => [...prev, ...closingActions]);

    setCoachingQuarter(nextQ);
    setCoachingClock(QUARTER_SECONDS);
    setIsCoachingRunning(false);
  };

  // --- Backend Integration Handlers --- //
  const handleSaveGame = async () => {
    if (user?.email === "demo@subnscore.com")
      return showNotification("Demo Mode: Cannot save.");

    const teamScore = Object.values(playerStats).reduce((acc, curr) => {
      if (!curr) return acc;
      return acc + (curr.score || 0);
    }, 0);

    // Automatically calculate final opponent score from the recorded logs
    const oppScore = actionHistory
      .filter((a) => a.type === "opp_score")
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);

    // Ensure the final quarter's lineup is snapshotted before payload creation
    const finalLineups = {
      ...lineupsByQuarter,
      [coachingQuarter]: [...court],
    };

    try {
      // Final Minutes and Seconds Calculation for the DB columns
      const finalRosterWithMins = roster.map((player) => {
        let totalSeconds = 0;
        stints
          .filter((s) => s.playerId === player.id)
          .forEach((s) => {
            const out = s.clockOut !== null ? s.clockOut : coachingClock;
            totalSeconds += s.clockIn - out;
          });

        return {
          ...player,
          name: (player.name || "").trim(),
          jersey: (player.jersey || "").toString().trim(),
          calculatedMins: formatTime(totalSeconds),
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
              const out = s.clockOut !== null ? s.clockOut : coachingClock;
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
        teamMeta: {
          ...teamMeta,
          game_mode: gameMode,
        },
        roster: finalRosterWithMins,
        calculatedQuarterStats,
        playerStats,
        actionHistory,
        timeouts,
        finalScoreUs: teamScore,
        finalScoreThem: oppScore,
        finalClock: coachingClock,
        quarter: coachingQuarter,
        lineupsByQuarter: finalLineups, // Send to backend
      };

      const res = await axios.post("/api/coaching/games/save", payload);
      showNotification("Game saved to cloud!");

      // Pass 'true' to force reset everything (including textboxes) without a second prompt
      resetGame(true);
    } catch (err) {
      console.error("Save Error:", err);
      const msg =
        err.response?.status === 429
          ? "Slow down, Coach! Too many save attempts. Try again in a minute."
          : "Save failed. Please check your connection.";
      showNotification(msg);
    }
  };

  const loadGameFromHistory = async (gameId) => {
    try {
      const res = await axios.get(`/api/coaching/games/${gameId}`);
      const {
        game,
        stats,
        logs,
        quarterStats,
        substitutionLogs,
        lineupsByQuarter: savedLineups,
      } = res.data;

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
      const historicalLineups = savedLineups || {};

      // RECONSTRUCT STINTS from substitution logs
      const reconstructedStints = [];
      const rawSubs = substitutionLogs || [];
      const hQuarterStats = quarterStats || [];

      // Loop through each quarter to build stints
      for (let q = 1; q <= (game.quarter || 4); q++) {
        const qLogs = rawSubs.filter((l) => l.quarter === q);

        // IMPROVEMENT: Find players by checking stats OR actions OR direct sub logs
        const statsPlayers = hQuarterStats
          .filter((qs) => qs.quarter === q)
          .map((qs) => qs.player_id || qs.playerId);
        const logPlayers = historicalActions
          .filter((a) => a.quarter === q && a.playerId)
          .map((a) => a.playerId);
        const subPlayers = qLogs.map((l) => l.player_id || l.playerId);

        const playersInQ = Array.from(
          new Set([...statsPlayers, ...logPlayers, ...subPlayers]),
        );

        playersInQ.forEach((pId) => {
          const pLogs = qLogs
            .filter((l) => (l.player_id || l.playerId) === pId)
            .sort((a, b) => b.time_remaining - a.time_remaining); // Chronological start to end

          let lastIn = null;

          // If they played but no IN log at 10:00, or first log is OUT, they started the quarter
          if (
            pLogs.length === 0 ||
            pLogs[0].action_type !== "IN" ||
            Number(pLogs[0].time_remaining) < QUARTER_SECONDS
          ) {
            lastIn = QUARTER_SECONDS;
          }

          pLogs.forEach((log) => {
            const time = Number(log.time_remaining);
            if (log.action_type === "IN") {
              lastIn = time;
            } else if (log.action_type === "OUT") {
              reconstructedStints.push({
                id: `hist-${q}-${pId}-${time}`,
                playerId: pId,
                quarter: q,
                clockIn: lastIn !== null ? lastIn : QUARTER_SECONDS,
                clockOut: time,
              });
              lastIn = null;
            }
          });

          // If still marked as IN, they played to the end of the quarter
          if (lastIn !== null) {
            // Use the actual seconds_played from the DB to find the exact exit time
            const qStat = hQuarterStats.find(
              (qs) =>
                (qs.player_id === pId || qs.playerId === pId) &&
                Number(qs.quarter) === q,
            );

            const totalSecsInQ = qStat
              ? Number(qStat.seconds_played || qStat.secondsPlayed || 0)
              : 0;

            // Account for any mid-quarter subs already processed
            const accounted = reconstructedStints
              .filter((s) => s.playerId === pId && s.quarter === q)
              .reduce(
                (sum, s) => sum + (Number(s.clockIn) - Number(s.clockOut)),
                0,
              );

            const remainingToPlay = Math.max(0, totalSecsInQ - accounted);
            const effectiveOut = Math.max(0, lastIn - remainingToPlay);

            reconstructedStints.push({
              id: `hist-${q}-${pId}-end`,
              playerId: pId,
              quarter: q,
              clockIn: lastIn,
              clockOut: effectiveOut,
              isHistory: true,
            });
          }
        });
      }

      // CRITICAL: Filter out zero-duration stints to prevent court bloating (e.g. 10 players on court)
      const filteredStints = reconstructedStints.filter(
        (s) => Number(s.clockIn) > Number(s.clockOut),
      );

      setHistoryData({
        meta: { ...game, teamName: game.team_name || teamMeta.teamName },
        roster: historicalRoster,
        stats: historicalStats,
        actions: historicalActions,
        stints: filteredStints,
        quarterStats: hQuarterStats,
        quarter: game.quarter || 1,
        lineupsByQuarter: historicalLineups,
      });
      setView("STATS");
    } catch (err) {
      console.error("Load Game Error:", err);
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
                : s.quarter === coachingQuarter
                ? coachingClock
                : 0;
          totalSeconds += s.clockIn - out;
        });
      acc[player.id] = totalSeconds;
      return acc;
    }, {});
  }, [roster, stints, coachingQuarter, coachingClock]);

  // If in standalone scoreboard mode, override everything
  if (isScoreboardView) {
    return <CommitteeScoreboardView />;
  }

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
        <div className="fixed top-4 left-0 right-0 flex justify-center z-[10001] pointer-events-none px-4">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl border border-slate-700 animate-bounce pointer-events-auto flex items-center gap-3">
            <Activity size={18} className="text-amber-400" />
            <span className="font-black uppercase tracking-widest text-xs md:text-sm">
              {notification}
            </span>
          </div>
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
            {/* Only show coaching navigation if the user is a Coach and not on the selection dashboards */}
            {view !== "DASHBOARD" &&
              view !== "COMMITTEE_DASHBOARD" &&
              user?.role === "COACH" && (
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
              )}
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
        {!user && view === "AUTH" && (
          <AuthView
            authMode={authMode}
            setAuthMode={setAuthMode}
            authForm={authForm}
            setAuthForm={setAuthForm}
            handleLocalAuth={handleLocalAuth}
            handleForgotPassword={handleForgotPassword}
            handleResetPassword={handleResetPassword}
            showNotification={showNotification}
            selectedModule={selectedModule}
            handleDemoLogin={() =>
              setUser({ name: "Demo", email: "demo@subnscore.com" })
            }
            // Pass selectedModule to AuthView for dynamic styling/text
            selectedModule={selectedModule}
            // Allow AuthView to navigate back to dashboard if needed
            onBackToDashboard={() => setView("DASHBOARD")}
          />
        )}

        {view === "DASHBOARD" && (
          <ModuleSelectionView
            onSelectModule={(module) => {
              setSelectedModule(module);
              if (module === "COACHING") {
                if (user) setView("SETUP");
                else setView("AUTH");
              } else if (module === "COMMITTEE") {
                // If user is already logged in, check role before redirecting
                if (user && user.role !== "COMMITTEE") {
                  showNotification("Access Denied: Not a Committee Member.");
                }
                if (user) setView("COMMITTEE_DASHBOARD");
                else setView("AUTH");
              }
            }}
          />
        )}

        {user && view === "COMMITTEE_DASHBOARD" && (
          <CommitteeDashboardView
            user={user}
            showNotification={showNotification}
            availableTeams={availableTeams}
            onGameStart={(data) => {
              // Force reset all committee session-specific states for a fresh start
              setCommitteeQuarter(1);
              setCommitteeClock(QUARTER_SECONDS);
              setIsCommitteeRunning(false);
              setCommitteePossessionArrow(null);
              setCommitteeTimeouts({ A: [], B: [] });
              setCommitteeGameData(data);
              setView("COMMITTEE_LIVE");
            }}
          />
        )}

        {user && view === "COMMITTEE_LIVE" && committeeGameData && (
          <CommitteeLiveView
            key={committeeGameData.gameId} // Force component to start fresh when game changes
            initialData={committeeGameData}
            showNotification={showNotification}
            onBack={() => setIsDiscardScoresheetConfirmOpen(true)}
            clock={committeeClock}
            setClock={setCommitteeClock}
            isRunning={isCommitteeRunning}
            setIsRunning={setIsCommitteeRunning}
            quarter={committeeQuarter}
            setQuarter={setCommitteeQuarter}
            committeeKeybindings={committeeKeybindings}
            possessionArrow={committeePossessionArrow}
            setPossessionArrow={setCommitteePossessionArrow}
            timeouts={committeeTimeouts}
            setTimeouts={setCommitteeTimeouts}
            setCommitteeKeybindings={setCommitteeKeybindings}
            onGameSaved={() => {
              setCommitteeGameData(null);
              setCommitteeQuarter(1);
              setCommitteeClock(QUARTER_SECONDS);
              setIsCommitteeRunning(false);
              setCommitteePossessionArrow(null);
              setCommitteeTimeouts({ A: [], B: [] });
              setView("COMMITTEE_DASHBOARD");
            }}
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
            gameMode={gameMode}
            setGameMode={setGameMode}
          />
        )}

        {user && view === "LIVE" && (
          <LiveView
            court={court}
            roster={roster}
            playerStats={playerStats}
            clock={coachingClock}
            isRunning={isCoachingRunning}
            setIsRunning={setIsCoachingRunning}
            quarter={coachingQuarter}
            advanceQuarter={advanceQuarter}
            addStat={addStat}
            teamFouls={teamFouls}
            timeouts={timeouts}
            addTimeout={() => {
              setTimeouts([...timeouts, { quarter, clock: coachingClock }]);
              setIsCoachingRunning(false);
              setActionHistory((prev) => [
                ...prev,
                { type: "TIMEOUT", quarter, clock: coachingClock },
              ]);
            }}
            undoLastAction={undoLastAction}
            teamMeta={teamMeta}
            handleSwap={handleSwap}
            pendingSwapIds={pendingSwapIds}
            playerTimes={playerTimes}
            addOpponentScore={addOpponentScore}
            actionHistory={actionHistory}
            showNotification={showNotification}
          />
        )}

        {user && view === "STATS" && (
          <StatsView
            roster={historyData ? historyData.roster : roster}
            playerStats={historyData ? historyData.stats : playerStats}
            stints={historyData ? historyData.stints : stints}
            clock={
              historyData ? historyData.meta.final_clock || 0 : coachingClock
            }
            teamMeta={historyData ? historyData.meta : teamMeta}
            quarter={historyData ? historyData.quarter : coachingQuarter}
            actionHistory={historyData ? historyData.actions : actionHistory}
            court={historyData ? [] : court}
            resetGame={() => {
              if (historyData) {
                setView("HISTORY");
                setHistoryData(null);
              } else {
                resetGame();
              }
            }}
            triggerSaveGame={handleSaveGame}
            deleteAction={deleteAction}
            isHistory={!!historyData}
            historyQuarterStats={historyData?.quarterStats}
            gameMode={
              historyData ? historyData.meta.game_mode || "FULL" : gameMode
            }
            lineupsByQuarter={ // This is for coaching lineups
              historyData ? historyData.lineupsByQuarter : lineupsByQuarter
            }
          />
        )}

        {/* Confirmation Modal for Reset Game */}
        <ConfirmationModal
          isOpen={isResetGameConfirmOpen}
          onClose={() => setIsResetGameConfirmOpen(false)}
          onConfirm={() => {
            resetGame(true, true, resetTargetView); // Force reset, skip further confirmation
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
          title={`End ${coachingQuarter > 4 ? `Overtime ${coachingQuarter - 4}` : `Quarter ${coachingQuarter}`}?`}
          message={`Are you sure you want to end ${coachingQuarter > 4 ? `Overtime ${coachingQuarter - 4}` : `Quarter ${coachingQuarter}`} and advance to the next period?`}
          confirmText="Advance Quarter"
          confirmButtonClass="bg-blue-600 hover:bg-blue-700"
        />

        {/* Confirmation Modal for Discard Scoresheet */}
        <ConfirmationModal
          isOpen={isDiscardScoresheetConfirmOpen}
          onClose={() => setIsDiscardScoresheetConfirmOpen(false)}
          onConfirm={() => {
            // Clear active game and reset all session states
            setCommitteeGameData(null);
            setCommitteeQuarter(1);
            setCommitteeClock(QUARTER_SECONDS);
            setIsCommitteeRunning(false);
            setCommitteePossessionArrow(null);
            setCommitteeTimeouts({ A: [], B: [] });
            setView("COMMITTEE_DASHBOARD");
            setIsDiscardScoresheetConfirmOpen(false);
            showNotification("Scoresheet discarded.");
          }}
          title="Discard Scoresheet?"
          message="Are you sure you want to discard this official scoresheet? All progress for this specific game will be lost."
          confirmText="Discard Scoresheet"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
        />
      </main>
    </div>
  );
}
