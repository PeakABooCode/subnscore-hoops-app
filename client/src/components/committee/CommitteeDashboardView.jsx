import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import {
  Users,
  Plus,
  Trash2,
  Trophy,
  Calendar,
  PlayCircle,
  ClipboardCheck,
  History,
  ChevronRight,
  List,
  Edit2,
  Search,
  Clock,
} from "lucide-react";
import TeamSelectionModal from "../common/TeamSelectionModal";
import OfficialGameDetailsModal from "./OfficialGameDetailsModal";
import ConfirmationModal from "../common/ConfirmationModal";
import MetadataSelectionModal from "../common/MetadataSelectionModal"; // New import
import { capitalizeWords } from "../../utils/helpers";

export default function CommitteeDashboardView({
  user,
  showNotification,
  availableTeams,
  onGameStart,
  defaultTab = "setup",
  onTabChange,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab); // 'setup' or 'history'
  const [league, setLeague] = useState("");
  const [season, setSeason] = useState("");
  const [division, setDivision] = useState("");
  const [setupAttempted, setSetupAttempted] = useState(false);
  const [quarterDuration, setQuarterDuration] = useState("10"); // Default 10 minutes

  const [searchLeague, setSearchLeague] = useState("");
  const [searchSeason, setSearchSeason] = useState("");
  const [searchDivision, setSearchDivision] = useState("");
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo] = useState("");

  const [historyGames, setHistoryGames] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDeleteGameConfirmOpen, setIsDeleteGameConfirmOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);

  const [selectedGameDetails, setSelectedGameDetails] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Separate state for Team A and Team B
  const [teamA, setTeamA] = useState({ name: "", roster: [] });
  const [teamB, setTeamB] = useState({ name: "", roster: [] });

  // Input state for adding players
  const [newPlayerA, setNewPlayerA] = useState({ name: "", jersey: "" });
  const [newPlayerB, setNewPlayerB] = useState({ name: "", jersey: "" });

  // --- Suggestion States ---
  const [showLeagueSuggestions, setShowLeagueSuggestions] = useState(false);
  const [showDivisionSuggestions, setShowDivisionSuggestions] = useState(false);
  const [showSeasonSuggestions, setShowSeasonSuggestions] = useState(false);

  // --- "Browse All" Modal States ---
  const [isLeagueModalOpen, setIsLeagueModalOpen] = useState(false);
  const [isDivisionModalOpen, setIsDivisionModalOpen] = useState(false);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);

  // Derive unique lists from availableTeams for suggestions
  const uniqueLeagues = useMemo(
    () => [...new Set(availableTeams.map((t) => t.league).filter(Boolean))],
    [availableTeams],
  );
  const uniqueDivisions = useMemo(
    () => [...new Set(availableTeams.map((t) => t.division).filter(Boolean))],
    [availableTeams],
  );
  // uniqueSeasons is scoped to whatever league/division is currently selected
  // so the season field only shows seasons relevant to the active context
  const uniqueSeasons = useMemo(
    () => [
      ...new Set(
        availableTeams
          .filter((t) => {
            const matchLeague = !league || t.league === league;
            const matchDivision = !division || t.division === division;
            return matchLeague && matchDivision;
          })
          .map((t) => t.season)
          .filter(Boolean)
          .map((s) => s.toString()),
      ),
    ],
    [availableTeams, league, division],
  );

  // Filtered suggestions — only show items matching what the user has typed
  const filteredLeagues = useMemo(
    () =>
      league
        ? uniqueLeagues.filter(
            (l) =>
              l.toLowerCase().includes(league.toLowerCase()) && l !== league,
          )
        : [],
    [uniqueLeagues, league],
  );
  const filteredDivisions = useMemo(
    () =>
      division
        ? uniqueDivisions.filter(
            (d) =>
              d.toLowerCase().includes(division.toLowerCase()) &&
              d !== division,
          )
        : [],
    [uniqueDivisions, division],
  );
  const filteredSeasons = useMemo(
    () =>
      season
        ? uniqueSeasons.filter(
            (s) =>
              s.toLowerCase().includes(season.toLowerCase()) && s !== season,
          )
        : [],
    [uniqueSeasons, season],
  );

  // Filter teams based on selected tournament metadata to enforce consistency
  const filteredTeams = useMemo(() => {
    // If no metadata is selected, we hide all teams to ensure the user picks a category first
    if (!league && !division && !season) return [];

    return availableTeams.filter((t) => {
      // A team matches if it aligns with all currently filled metadata fields
      const matchLeague = !league || t.league === league;
      const matchDivision = !division || t.division === division;
      const matchSeason = !season || t.season?.toString() === season;
      return matchLeague && matchDivision && matchSeason;
    });
  }, [availableTeams, league, division, season]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await axios.get("/api/committee/games");
      setHistoryGames(res.data);
    } catch (err) {
      showNotification("Failed to load history.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleViewDetails = async (gameId) => {
    try {
      const res = await axios.get(`/api/committee/games/${gameId}`);
      setSelectedGameDetails(res.data);
      setIsDetailsModalOpen(true);
    } catch (err) {
      showNotification(
        err.response?.data?.error || "Failed to load game details.",
      );
    }
  };

  const handleDeleteGame = async (gameId) => {
    try {
      await axios.delete(`/api/committee/games/${gameId}`);
      showNotification("Game deleted.");
      fetchHistory(); // refresh list after delete
    } catch (err) {
      showNotification("Failed to delete game.");
    }
  };

  const handleSelectTeam = async (side, team) => {
    try {
      const res = await axios.get(
        `/api/coaching/teams/roster/${encodeURIComponent(team.name)}`,
      );
      const roster = res.data.map((p) => ({
        id: p.id,
        name: p.name,
        jersey: p.jersey.toString(),
      }));

      if (side === "A") {
        setTeamA({ name: team.name, roster });
      } else {
        setTeamB({ name: team.name, roster });
      }
      if (!league && team.league) setLeague(team.league);
      if (!season && team.season) setSeason(team.season);
      if (!division && team.division) setDivision(team.division);
      showNotification(`Loaded roster for ${team.name}`);
    } catch (err) {
      showNotification("Failed to load team roster.");
    }
  };

  // New handler for selecting metadata (league, division, season)
  const handleMetadataSelect = (type, value) => {
    let filteredBySelection = availableTeams;

    if (type === "league") {
      setLeague(value);
      filteredBySelection = availableTeams.filter((t) => t.league === value);
      setShowLeagueSuggestions(false);
    } else if (type === "division") {
      setDivision(value);
      filteredBySelection = availableTeams.filter((t) => t.division === value);
      setShowDivisionSuggestions(false);
    } else if (type === "season") {
      setSeason(value);
      filteredBySelection = availableTeams.filter(
        (t) => t.season.toString() === value,
      );
      setShowSeasonSuggestions(false);
    }

    // Auto-populate other fields if unambiguous
    const uniqueDivisionsForSelection = [
      ...new Set(filteredBySelection.map((t) => t.division).filter(Boolean)),
    ];
    if (uniqueDivisionsForSelection.length === 1 && type !== "division") {
      setDivision(uniqueDivisionsForSelection[0]);
    }

    const uniqueSeasonsForSelection = [
      ...new Set(
        filteredBySelection
          .map((t) => t.season)
          .filter(Boolean)
          .map((s) => s.toString()),
      ),
    ];
    if (uniqueSeasonsForSelection.length === 1 && type !== "season") {
      setSeason(uniqueSeasonsForSelection[0]);
    }

    const uniqueLeaguesForSelection = [
      ...new Set(filteredBySelection.map((t) => t.league).filter(Boolean)),
    ];
    if (uniqueLeaguesForSelection.length === 1 && type !== "league") {
      setLeague(uniqueLeaguesForSelection[0]);
    }
  };

  const handleAddPlayer = (side) => {
    const isA = side === "A";
    const input = isA ? newPlayerA : newPlayerB;
    const currentRoster = isA ? teamA.roster : teamB.roster;

    if (!input.name || !input.jersey) return;

    // Check for duplicate jersey within the same team
    if (currentRoster.some((p) => p.jersey === input.jersey)) {
      showNotification(`Jersey #${input.jersey} is already in Team ${side}`);
      return;
    }

    const player = {
      name: input.name.trim(),
      jersey: input.jersey.trim(),
      id: Date.now() + Math.random(), // Temporary ID for UI list
    };

    if (isA) {
      setTeamA({ ...teamA, roster: [...teamA.roster, player] });
      setNewPlayerA({ name: "", jersey: "" });
    } else {
      setTeamB({ ...teamB, roster: [...teamB.roster, player] });
      setNewPlayerB({ name: "", jersey: "" });
    }
  };

  const handleRemovePlayer = (side, id) => {
    if (side === "A") {
      setTeamA({ ...teamA, roster: teamA.roster.filter((p) => p.id !== id) });
    } else {
      setTeamB({ ...teamB, roster: teamB.roster.filter((p) => p.id !== id) });
    }
  };

  const initializeGame = async () => {
    setSetupAttempted(true);
    if (!league || !season || !division || !teamA.name || !teamB.name) {
      return showNotification("Missing tournament or team details.");
    }
    if (teamA.roster.length < 5 || teamB.roster.length < 5) {
      return showNotification("Both teams must have at least 5 players.");
    }

    try {
      const payload = {
        teamAName: teamA.name,
        teamBName: teamB.name,
        teamARoster: teamA.roster,
        teamBRoster: teamB.roster,
        league,
        season,
        division,
      };

      const res = await axios.post("/api/committee/games/init", payload);
      showNotification("Official Scoresheet Ready!");

      // Call the transition prop with the data needed for the Live View
      onGameStart({
        gameId: res.data.gameId,
        teamAId: res.data.teamAId,
        teamBId: res.data.teamBId,
        teamAName: teamA.name,
        teamBName: teamB.name,
        teamARoster: teamA.roster,
        teamBRoster: teamB.roster,
        teamAPlayerMap: res.data.teamAPlayerMap,
        teamBPlayerMap: res.data.teamBPlayerMap,
        quarterDuration: parseInt(quarterDuration, 10) || 10,
      });
    } catch (err) {
      console.error("Initialization error:", err);
      showNotification(err.response?.data?.error || "Failed to start game.");
    }
  };

  // Apply History Filters
  const filteredHistoryGames = useMemo(() => {
    return historyGames.filter((game) => {
      const matchLeague =
        !searchLeague ||
        game.league?.toLowerCase().includes(searchLeague.toLowerCase());
      const matchSeason =
        !searchSeason ||
        game.season
          ?.toString()
          .toLowerCase()
          .includes(searchSeason.toLowerCase());
      const matchDivision =
        !searchDivision ||
        game.division?.toLowerCase().includes(searchDivision.toLowerCase());

      let matchDate = true;
      if (searchDateFrom || searchDateTo) {
        const gameDate = new Date(game.game_date).getTime();
        const fromTime = searchDateFrom
          ? new Date(searchDateFrom).getTime()
          : 0;
        const toTime = searchDateTo
          ? new Date(searchDateTo).getTime() + 86400000
          : Infinity; // Include end of day
        matchDate = gameDate >= fromTime && gameDate <= toTime;
      }

      return matchLeague && matchSeason && matchDivision && matchDate;
    });
  }, [
    historyGames,
    searchLeague,
    searchSeason,
    searchDivision,
    searchDateFrom,
    searchDateTo,
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* League Info Header */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border-b-4 border-amber-500 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-2 rounded-xl">
            <ClipboardCheck size={28} className="text-slate-900" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter leading-tight">
              Official Game Setup
            </h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
              Committee Scoring Module
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-slate-200 p-1 rounded-2xl w-full max-w-sm mx-auto shadow-inner">
        <button
          onClick={() => handleTabChange("setup")}
          className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${
            activeTab === "setup"
              ? "bg-white text-slate-900 shadow-lg"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Game Setup
        </button>
        <button
          onClick={() => handleTabChange("history")}
          className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${
            activeTab === "history"
              ? "bg-white text-slate-900 shadow-lg"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Game History
        </button>
      </div>

      {activeTab === "history" ? (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3 mb-6">
              <History className="text-amber-500" size={24} />
              Official Records
            </h2>

            {/* History Filters */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  placeholder="League..."
                  value={searchLeague}
                  onChange={(e) => setSearchLeague(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-amber-400"
                />
              </div>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  placeholder="Division..."
                  value={searchDivision}
                  onChange={(e) => setSearchDivision(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-amber-400"
                />
              </div>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  placeholder="Season..."
                  value={searchSeason}
                  onChange={(e) => setSearchSeason(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-amber-400"
                />
              </div>
              <input
                type="date"
                value={searchDateFrom}
                onChange={(e) => setSearchDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-amber-400 text-slate-500"
                title="From Date"
              />
              <input
                type="date"
                value={searchDateTo}
                onChange={(e) => setSearchDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-amber-400 text-slate-500"
                title="To Date"
              />
            </div>

            {isLoadingHistory ? (
              <div className="py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">
                Loading Records...
              </div>
            ) : filteredHistoryGames.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-slate-300 font-black uppercase tracking-widest italic">
                  No records match your search.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredHistoryGames.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => handleViewDetails(game.id)}
                    className="bg-slate-50 p-5 rounded-2xl border border-slate-100 hover:border-amber-300 hover:bg-white transition-all group cursor-pointer shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase tracking-widest">
                          {new Date(game.game_date).toLocaleDateString()}
                        </span>
                        <h4 className="text-xs font-black text-slate-500 uppercase mt-1">
                          {game.league} • {game.division}
                        </h4>
                      </div>

                      {/* ✅ FIXED DELETE BUTTON */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // 🔥 prevents opening report
                          setGameToDelete(game.id);
                          setIsDeleteGameConfirmOpen(true);
                        }}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-center">
                        <p className="text-[10px] font-black uppercase text-slate-500 truncate">
                          {game.team_a_display}
                        </p>
                        <p className="text-3xl font-black text-slate-900">
                          {game.final_score_a}
                        </p>
                      </div>

                      <div className="text-slate-300 font-black text-xl">
                        VS
                      </div>

                      <div className="flex-1 text-center">
                        <p className="text-[10px] font-black uppercase text-slate-500 truncate">
                          {game.team_b_display}
                        </p>
                        <p className="text-3xl font-black text-slate-900">
                          {game.final_score_b}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase">
                        {game.status === "COMPLETED"
                          ? "Final Result"
                          : "In Progress"}
                      </span>
                      <div className="flex items-center gap-1 text-amber-600 font-black text-[10px] uppercase">
                        Season {game.season} <ChevronRight size={12} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Tournament Details Section */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3 mb-6">
              <Trophy className="text-amber-500" size={24} />
              Tournament Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {/* League Name Input with Suggestions */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                  League Name{" "}
                  {setupAttempted && !league && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <div className="relative">
                  <Trophy
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    className={`w-full pl-12 pr-12 py-3 bg-slate-50 border rounded-xl outline-none text-sm font-bold transition-all ${
                      setupAttempted && !league
                        ? "border-red-500 bg-red-50 ring-4 ring-red-100"
                        : "border-slate-200 focus:ring-4 focus:ring-slate-100"
                    }`}
                    placeholder="e.g. NBA"
                    value={league}
                    onChange={(e) => setLeague(e.target.value)}
                    onFocus={() => setShowLeagueSuggestions(true)}
                    onBlur={() =>
                      setTimeout(() => setShowLeagueSuggestions(false), 150)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setIsLeagueModalOpen(true)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                    title="Browse Leagues"
                  >
                    <List size={16} />
                  </button>
                  {showLeagueSuggestions && filteredLeagues.length > 0 && (
                    <div className="absolute z-30 w-full top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                      {filteredLeagues.map((l, idx) => (
                        <button
                          key={idx}
                          onMouseDown={() => handleMetadataSelect("league", l)}
                          className="w-full text-left px-4 py-2.5 hover:bg-amber-50 flex items-center justify-between border-b border-slate-50 last:border-0 font-bold text-slate-700 text-sm transition-colors"
                        >
                          {l}
                          <ChevronRight size={14} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Division Input with Suggestions */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                  Division{" "}
                  {setupAttempted && !division && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <div className="relative">
                  <Users
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    className={`w-full pl-12 pr-12 py-3 bg-slate-50 border rounded-xl outline-none text-sm font-bold transition-all ${
                      setupAttempted && !division
                        ? "border-red-500 bg-red-50 ring-4 ring-red-100"
                        : "border-slate-200 focus:ring-4 focus:ring-slate-100"
                    }`}
                    placeholder="e.g. U17 / Seniors"
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    onFocus={() => setShowDivisionSuggestions(true)}
                    onBlur={() =>
                      setTimeout(() => setShowDivisionSuggestions(false), 150)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setIsDivisionModalOpen(true)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                    title="Browse Divisions"
                  >
                    <List size={16} />
                  </button>
                  {showDivisionSuggestions && filteredDivisions.length > 0 && (
                    <div className="absolute z-30 w-full top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                      {filteredDivisions.map((d, idx) => (
                        <button
                          key={idx}
                          onMouseDown={() =>
                            handleMetadataSelect("division", d)
                          }
                          className="w-full text-left px-4 py-2.5 hover:bg-amber-50 flex items-center justify-between border-b border-slate-50 last:border-0 font-bold text-slate-700 text-sm transition-colors"
                        >
                          {d}
                          <ChevronRight size={14} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Season/Phase Input with Suggestions */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                  Season/Phase{" "}
                  {setupAttempted && !season && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <div className="relative">
                  <Calendar
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    className={`w-full pl-12 pr-12 py-3 bg-slate-50 border rounded-xl outline-none text-sm font-bold transition-all ${
                      setupAttempted && !season
                        ? "border-red-500 bg-red-50 ring-4 ring-red-100"
                        : "border-slate-200 focus:ring-4 focus:ring-slate-100"
                    }`}
                    placeholder="e.g. 1, 2, 3, 4, etc."
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    onFocus={() => setShowSeasonSuggestions(true)}
                    onBlur={() =>
                      setTimeout(() => setShowSeasonSuggestions(false), 150)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setIsSeasonModalOpen(true)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                    title="Browse Seasons"
                  >
                    <List size={16} />
                  </button>
                  {showSeasonSuggestions && filteredSeasons.length > 0 && (
                    <div className="absolute z-30 w-full top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                      {filteredSeasons.map((s, idx) => (
                        <button
                          key={idx}
                          onMouseDown={() => handleMetadataSelect("season", s)}
                          className="w-full text-left px-4 py-2.5 hover:bg-amber-50 flex items-center justify-between border-b border-slate-50 last:border-0 font-bold text-slate-700 text-sm transition-colors"
                        >
                          Season {s}
                          <ChevronRight size={14} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quarter Duration Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                  Quarter Mins
                </label>
                <div className="relative">
                  <Clock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="number"
                    min="1"
                    max="20"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold transition-all focus:ring-4 focus:ring-slate-100"
                    value={quarterDuration}
                    onChange={(e) => setQuarterDuration(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Team Entry */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TeamEntrySection
              side="A"
              color="blue"
              teamData={teamA}
              setTeamData={setTeamA}
              newPlayer={newPlayerA}
              setNewPlayer={setNewPlayerA}
              onAdd={() => handleAddPlayer("A")}
              onRemove={(id) => handleRemovePlayer("A", id)}
              availableTeams={filteredTeams}
              onSelectTeam={(team) => handleSelectTeam("A", team)}
              setupAttempted={setupAttempted}
              userRole={user.role}
              showNotification={showNotification}
            />
            <TeamEntrySection
              side="B"
              color="red"
              teamData={teamB}
              setTeamData={setTeamB}
              newPlayer={newPlayerB}
              setNewPlayer={setNewPlayerB}
              onAdd={() => handleAddPlayer("B")}
              onRemove={(id) => handleRemovePlayer("B", id)}
              availableTeams={filteredTeams}
              onSelectTeam={(team) => handleSelectTeam("B", team)}
              userRole={user.role}
              setupAttempted={setupAttempted}
              showNotification={showNotification}
            />
          </div>

          {/* Start Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={initializeGame}
              className="w-full max-w-md bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
            >
              <PlayCircle size={24} />
              Initialize Scoresheet
            </button>
          </div>
        </>
      )}

      {/* Detail Modal */}
      <OfficialGameDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        data={selectedGameDetails}
      />

      {/* Confirmation Modal for Delete Game */}
      <ConfirmationModal
        isOpen={isDeleteGameConfirmOpen}
        onClose={() => {
          setIsDeleteGameConfirmOpen(false);
          setGameToDelete(null);
        }}
        onConfirm={() => {
          handleDeleteGame(gameToDelete); // ✅ correct ID
          setIsDeleteGameConfirmOpen(false);
          setGameToDelete(null);
        }}
        title="Delete Official Game?"
        message="Are you sure you want to delete this official game record? This action cannot be undone."
        confirmText="Delete Game"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      {/* Metadata Selection Modals */}
      <MetadataSelectionModal
        isOpen={isLeagueModalOpen}
        onClose={() => setIsLeagueModalOpen(false)}
        title="Select League"
        data={uniqueLeagues}
        onSelect={(value) => handleMetadataSelect("league", value)}
      />
      <MetadataSelectionModal
        isOpen={isDivisionModalOpen}
        onClose={() => setIsDivisionModalOpen(false)}
        title="Select Division"
        data={uniqueDivisions}
        onSelect={(value) => handleMetadataSelect("division", value)}
      />
      <MetadataSelectionModal
        isOpen={isSeasonModalOpen}
        onClose={() => setIsSeasonModalOpen(false)}
        title="Select Season/Phase"
        data={uniqueSeasons}
        onSelect={(value) => handleMetadataSelect("season", value)}
      />
    </div>
  );
}

function TeamEntrySection({
  side,
  color,
  teamData,
  setTeamData,
  newPlayer,
  setNewPlayer,
  onAdd,
  onRemove,
  availableTeams,
  onSelectTeam,
  setupAttempted,
  userRole,
  showNotification,
}) {
  const accentBorder = color === "blue" ? "border-blue-500" : "border-red-500";
  const iconColor = color === "blue" ? "text-blue-500" : "text-red-500";
  const jerseyColor =
    color === "blue"
      ? "bg-blue-50 text-blue-600 border-blue-100"
      : "bg-red-50 text-red-600 border-red-100";

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = teamData.name
    ? (availableTeams || []).filter(
        (t) =>
          t.name.toLowerCase().includes(teamData.name.toLowerCase()) &&
          t.name.toLowerCase() !== teamData.name.toLowerCase(),
      )
    : [];

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editJersey, setEditJersey] = useState("");
  const jerseyInputRef = useRef(null);

  return (
    <div
      className={`bg-white rounded-3xl shadow-sm border-t-8 ${accentBorder} p-8 space-y-6`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
          <Users size={24} className={iconColor} />
          Team {side} Configuration
        </h3>
        <span className="text-[10px] font-black bg-slate-100 px-3 py-1 rounded-full text-slate-500">
          {" "}
          {/* Removed availableTeams prop */}
          {teamData.roster.length} PLAYERS
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
          Team Name{" "}
          {setupAttempted && !teamData.name && (
            <span className="text-red-500">*</span>
          )}
        </label>
        <div className="relative">
          <input
            className={`w-full px-5 py-3 bg-slate-50 border rounded-xl outline-none font-bold pr-12 transition-all ${
              setupAttempted && !teamData.name
                ? "border-red-500 bg-red-50 ring-4 ring-red-100"
                : "border-slate-200 focus:ring-4 focus:ring-slate-100"
            }`}
            placeholder={`Enter Team ${side} Name`}
            value={teamData.name}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onChange={(e) => {
              const val = e.target.value;
              setTeamData({ ...teamData, name: val, id: null });
              const match = availableTeams.find(
                (t) => t.name.toLowerCase() === val.toLowerCase(),
              );
              if (match) onSelectTeam(match);
            }}
          />
          <button
            type="button"
            onClick={() => setIsTeamModalOpen(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
            title="Browse Teams"
          >
            <List size={16} />
          </button>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 w-full top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
              {suggestions.map((team, idx) => (
                <button
                  key={idx}
                  onMouseDown={() => {
                    onSelectTeam(team);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-amber-50 flex items-center justify-between border-b border-slate-50 last:border-0 transition-colors"
                >
                  <div>
                    <p className="font-bold text-slate-800">
                      {team.name}
                      {team.official_id && (
                        <span className="ml-2 text-[8px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">
                          Official
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 font-black uppercase">
                      {team.league} • {team.division} • Season {team.season}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <TeamSelectionModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        teams={availableTeams}
        onSelect={(team) => {
          onSelectTeam(team);
          setIsTeamModalOpen(false);
        }}
        userRole={userRole}
      />

      <div className="border-t border-slate-100 pt-4">
        <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-3">
          Add to Roster
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            <input
              ref={jerseyInputRef}
              className="w-20 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-400 text-center"
              placeholder="#"
              value={newPlayer.jersey}
              onChange={(e) => {
                const numbersOnly = e.target.value.replace(/[^0-9]/g, "");
                setNewPlayer({ ...newPlayer, jersey: numbersOnly });
              }}
            />
          </div>
          <input
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-400"
            placeholder="Player Name"
            value={newPlayer.name}
            onChange={(e) => {
              const val = e.target.value.replace(/[^a-zA-Z0-9\s]/g, "");
              setNewPlayer({ ...newPlayer, name: capitalizeWords(val) });
            }}
          />
          <button
            onClick={(e) => {
              e.preventDefault();
              onAdd();
              setTimeout(() => jerseyInputRef.current?.focus(), 10);
            }}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-black transition-colors shadow-md flex items-center justify-center font-black uppercase text-xs tracking-widest"
          >
            <Plus size={16} className="mr-1" /> Add
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {teamData.roster.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-slate-50 rounded-2xl">
            <p className="text-xs text-slate-300 font-black uppercase tracking-widest italic">
              Roster Empty
            </p>
          </div>
        ) : (
          teamData.roster.map((p) => {
            if (editingId === p.id) {
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-blue-200 group transition-all"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={editJersey}
                      onChange={(e) => setEditJersey(e.target.value)}
                      className="w-12 p-1.5 border rounded-xl text-sm text-center font-bold outline-none focus:border-blue-400"
                      placeholder="#"
                    />
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 p-1.5 border rounded-xl text-sm font-bold outline-none focus:border-blue-400"
                      placeholder="Name"
                    />
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => {
                        if (
                          teamData.roster.some(
                            (rp) =>
                              rp.id !== p.id &&
                              rp.jersey.toString() === editJersey.toString(),
                          )
                        ) {
                          showNotification("Jersey already in use");
                          return;
                        }
                        if (!editName || !editJersey) return;
                        const updated = teamData.roster.map((rp) =>
                          rp.id === p.id
                            ? { ...rp, name: editName, jersey: editJersey }
                            : rp,
                        );
                        setTeamData({ ...teamData, roster: updated });
                        setEditingId(null);
                      }}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="bg-slate-300 hover:bg-slate-400 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={p.id}
                className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 group transition-all hover:border-slate-200"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border-2 ${jerseyColor}`}
                  >
                    {p.jersey}
                  </span>
                  <span className="font-bold text-slate-700 uppercase tracking-tight">
                    {p.name}
                  </span>
                </div>
                <div className="flex gap-1 items-center">
                  <button
                    onClick={() => {
                      setEditingId(p.id);
                      setEditName(p.name);
                      setEditJersey(p.jersey);
                    }}
                    className="text-slate-300 hover:text-blue-500 p-2 rounded-lg hover:bg-blue-50 transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onRemove(p.id)}
                    className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
