import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Users,
  Plus,
  Trash2,
  Trophy,
  Calendar,
  PlayCircle,
  ClipboardCheck,
  Search,
  History,
  ChevronRight,
  List,
} from "lucide-react";
import TeamSelectionModal from "../common/TeamSelectionModal";
import OfficialGameDetailsModal from "./OfficialGameDetailsModal";

export default function CommitteeDashboardView({
  user,
  showNotification,
  availableTeams,
  onGameStart,
}) {
  const [activeTab, setActiveTab] = useState("setup"); // 'setup' or 'history'
  const [league, setLeague] = useState("");
  const [season, setSeason] = useState("");
  const [division, setDivision] = useState("");
  const [setupAttempted, setSetupAttempted] = useState(false);

  const [historyGames, setHistoryGames] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [selectedGameDetails, setSelectedGameDetails] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Separate state for Team A and Team B
  const [teamA, setTeamA] = useState({ name: "", roster: [] });
  const [teamB, setTeamB] = useState({ name: "", roster: [] });

  // Input state for adding players
  const [newPlayerA, setNewPlayerA] = useState({ name: "", jersey: "" });
  const [newPlayerB, setNewPlayerB] = useState({ name: "", jersey: "" });

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

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
        err.response?.data?.error || "Failed to load game details."
      );
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (!window.confirm("Are you sure you want to delete this official record?")) return;
    try {
      await axios.delete(`/api/committee/games/${gameId}`);
      showNotification("Game deleted.");
      fetchHistory();
    } catch (err) {
      showNotification("Failed to delete game.");
    }
  };

  const handleSelectTeam = async (side, team) => {
    try {
      const res = await axios.get(
        `/api/coaching/teams/roster/${encodeURIComponent(team.name)}`,
      );
      // Map DB players to local state format
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
      if (!division && team.division) setDivision(team.division); // Populate division
      showNotification(`Loaded roster for ${team.name}`);
    } catch (err) {
      showNotification("Failed to load team roster.");
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
        teamAName: teamA.name,
        teamBName: teamB.name,
        teamARoster: teamA.roster,
        teamBRoster: teamB.roster,
        teamAPlayerMap: res.data.teamAPlayerMap,
        teamBPlayerMap: res.data.teamBPlayerMap,
      });
    } catch (err) {
      console.error("Initialization error:", err);
      showNotification(err.response?.data?.error || "Failed to start game.");
    }
  };

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
          onClick={() => setActiveTab("setup")}
          className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${
            activeTab === "setup"
              ? "bg-white text-slate-900 shadow-lg"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Game Setup
        </button>
        <button
          onClick={() => setActiveTab("history")}
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

            {isLoadingHistory ? (
              <div className="py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">
                Loading Records...
              </div>
            ) : historyGames.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-slate-300 font-black uppercase tracking-widest italic">
                  No official games saved yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historyGames.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => handleViewDetails(game.id)}
                    className="bg-slate-50 p-5 rounded-2xl border border-slate-100 hover:border-amber-200 transition-all group cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase tracking-widest">
                          {new Date(game.game_date).toLocaleDateString()}
                        </span>
                        <h4 className="text-xs font-black text-slate-400 uppercase mt-1">
                          {game.league} • {game.division}
                        </h4>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGame(game.id);
                        }}
                        className="text-slate-300 hover:text-red-500 transition-colors"
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
                      <div className="text-slate-200 font-black text-xl">VS</div>
                      <div className="flex-1 text-center">
                        <p className="text-[10px] font-black uppercase text-slate-500 truncate">
                          {game.team_b_display}
                        </p>
                        <p className="text-3xl font-black text-slate-900">
                          {game.final_score_b}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase">
                        {game.status === 'COMPLETED' ? 'Final Result' : 'In Progress'}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
              League Name {setupAttempted && !league && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                className={`w-full pl-12 pr-4 py-3 bg-slate-50 border rounded-xl outline-none text-sm font-bold transition-all ${
                  setupAttempted && !league
                    ? "border-red-500 bg-red-50 ring-4 ring-red-100"
                    : "border-slate-200 focus:ring-4 focus:ring-slate-100"
                }`}
                placeholder="e.g. NBA"
                value={league}
                onChange={(e) => setLeague(e.target.value)}
              />
            </div>
          </div>
              <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
              Division {setupAttempted && !division && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                className={`w-full pl-12 pr-4 py-3 bg-slate-50 border rounded-xl outline-none text-sm font-bold transition-all ${
                  setupAttempted && !division
                    ? "border-red-500 bg-red-50 ring-4 ring-red-100"
                    : "border-slate-200 focus:ring-4 focus:ring-slate-100"
                }`}
                placeholder="e.g. U17 / Seniors"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
              Season/Phase {setupAttempted && !season && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                className={`w-full pl-12 pr-4 py-3 bg-slate-50 border rounded-xl outline-none text-sm font-bold transition-all ${
                  setupAttempted && !season
                    ? "border-red-500 bg-red-50 ring-4 ring-red-100"
                    : "border-slate-200 focus:ring-4 focus:ring-slate-100"
                }`}
               placeholder="e.g. 1, 2, 3, 4, etc."
                value={season}
                onChange={(e) => setSeason(e.target.value)}
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
          availableTeams={availableTeams}
          onSelectTeam={(team) => handleSelectTeam("A", team)}
          setupAttempted={setupAttempted}
          userRole={user.role} // Pass user role to TeamEntrySection
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
          availableTeams={availableTeams}
          onSelectTeam={(team) => handleSelectTeam("B", team)}
          userRole={user.role} // Pass user role to TeamEntrySection
          setupAttempted={setupAttempted}
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
}) {
  const accentBorder = color === "blue" ? "border-blue-500" : "border-red-500";
  const iconColor = color === "blue" ? "text-blue-500" : "text-red-500";
  const jerseyColor =
    color === "blue"
      ? "bg-blue-50 text-blue-600 border-blue-100"
      : "bg-red-50 text-red-600 border-red-100";

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = (availableTeams || []).filter(
    (t) =>
      t.name.toLowerCase().includes(teamData.name.toLowerCase()) &&
      t.name.toLowerCase() !== teamData.name.toLowerCase(),
  );

  return (
    <div
      className={`bg-white rounded-3xl shadow-sm border-t-8 ${accentBorder} p-8 space-y-6`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
          <Users size={24} className={iconColor} />
          Team {side} Configuration
        </h3>
        <span className="text-[10px] font-black bg-slate-100 px-3 py-1 rounded-full text-slate-500"> {/* Removed availableTeams prop */}
          {teamData.roster.length} PLAYERS
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
          Team Name {setupAttempted && !teamData.name && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <input
            className={`w-full px-5 py-3 bg-slate-50 border rounded-xl outline-none font-bold pr-10 transition-all ${
              setupAttempted && !teamData.name
                ? "border-red-500 bg-red-50 ring-4 ring-red-100"
                : "border-slate-200 focus:ring-4 focus:ring-slate-100"
            }`}
            placeholder={`Enter Team ${side} Name`}
            value={teamData.name}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onChange={(e) => {
              const val = e.target.value;
              setTeamData({
                ...teamData,
                name: val,
                id: null, // Clear team ID if name is changed manually
              });
              // Auto-load if name matches exactly
              const match = availableTeams.find(t => t.name.toLowerCase() === val.toLowerCase());
              if (match) onSelectTeam(match);
            }}
          />
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
            size={18}
          />

          {showSuggestions && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1">
              {suggestions.length > 0 &&
                suggestions.map((team, idx) => (
                  <button
                    key={idx}
                    onMouseDown={() => {
                      onSelectTeam(team);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0"
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
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsTeamModalOpen(true);
                }}
                className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-center gap-2 text-blue-600 font-bold border-t border-slate-100"
              >
                <List size={16} /> Browse All Teams
              </button>
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
          <input
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-400"
            placeholder="Player Name"
            value={newPlayer.name}
            onChange={(e) =>
              setNewPlayer({ ...newPlayer, name: e.target.value })
            }
          />
          <div className="flex gap-2">
            <input
              className="w-24 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-400"
              placeholder="#"
              value={newPlayer.jersey}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, jersey: e.target.value })
              }
            />
            <button
              onClick={onAdd}
              className="flex-1 sm:flex-none p-2.5 rounded-xl bg-slate-900 text-white hover:bg-black transition-colors shadow-md flex items-center justify-center"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
        {teamData.roster.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-slate-50 rounded-2xl">
            <p className="text-xs text-slate-300 font-black uppercase tracking-widest italic">
              Roster Empty
            </p>
          </div>
        ) : (
          teamData.roster.map((p) => (
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
              <button
                onClick={() => onRemove(p.id)}
                className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
