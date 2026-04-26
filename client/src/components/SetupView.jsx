import React, { useRef, useState } from "react";
import {
  Settings,
  UserPlus,
  Play,
  Pencil,
  Activity,
  Calendar,
  CloudDownload,
  Save,
  List,
  ShieldCheck,
  Zap,
} from "lucide-react";
import EditPlayerModal from "./EditPlayerModal";
import { capitalizeWords } from "../utils/helpers";
import TeamSelectionModal from "./TeamSelectionModal";

export default function SetupView({
  user,
  teamMeta,
  setTeamMeta,
  roster,
  newPlayer,
  setNewPlayer,
  handleAddPlayer,
  handleRemovePlayer,
  handleEditPlayer,
  startGame,
  setupAttempted,
  resetGame,
  handleSaveRoster,
  gameInProgress, // New prop
  handleLoadRoster,
  availableTeams = [],
  gameMode, // Passed from App.jsx
  setGameMode, // Passed from App.jsx
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState(null);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  const onEditClick = (p) => {
    setPlayerToEdit(p);
    setIsEditModalOpen(true);
  };

  const handleModalSave = (id, updates) => {
    handleEditPlayer(id, updates);
    setIsEditModalOpen(false);
  };

  const handleTeamSelect = (team) => {
    setTeamMeta({
      ...teamMeta,
      teamName: team.name,
      league: team.league || "",
      season: team.season || "",
    });
    setIsTeamModalOpen(false);
  };

  const nameInputRef = useRef(null);

  const onAddPlayerSubmit = (e) => {
    handleAddPlayer(e);
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* SECTION 1: TEAM & TOURNAMENT INFORMATION */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
          <Settings className="text-blue-600" size={20} /> Game Setup
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TEAM NAME INPUT */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
              Your Team Name
              {setupAttempted && !teamMeta.teamName.trim() && (
                <span className="text-red-500 animate-pulse">*</span>
              )}
            </label>
            <div className="relative">
              <input
                className={`w-full border p-2.5 pr-10 rounded-lg outline-none transition-all duration-200 ${
                  setupAttempted && !teamMeta.teamName.trim()
                    ? "border-red-500 bg-red-50 ring-1 ring-red-200"
                    : "focus:border-blue-500 focus:ring-2 focus:ring-blue-100 border-slate-200"
                }`}
                placeholder="e.g. Lakers"
                value={teamMeta.teamName}
                onChange={(e) => {
                  const val = capitalizeWords(e.target.value);
                  const matchedTeam = availableTeams.find(
                    (t) => t.name.toLowerCase() === val.toLowerCase(),
                  );

                  if (matchedTeam) {
                    setTeamMeta({
                      ...teamMeta,
                      teamName: val,
                      league: matchedTeam.league || teamMeta.league,
                      season: matchedTeam.season || teamMeta.season,
                    });
                  } else {
                    setTeamMeta({
                      ...teamMeta,
                      teamName: val,
                    });
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setIsTeamModalOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-1"
                title="Select from existing teams"
              >
                <List size={20} />
              </button>
            </div>
          </div>

          {/* OPPONENT NAME INPUT */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
              Opponent Name
              {setupAttempted && !teamMeta.opponent.trim() && (
                <span className="text-red-500 animate-pulse">*</span>
              )}
            </label>
            <input
              className={`border p-2.5 rounded-lg outline-none transition-all duration-200 ${
                setupAttempted && !teamMeta.opponent.trim()
                  ? "border-red-500 bg-red-50 ring-1 ring-red-200"
                  : "focus:border-blue-500 focus:ring-2 focus:ring-blue-100 border-slate-200"
              }`}
              placeholder="e.g. Bulls"
              value={teamMeta.opponent}
              onChange={(e) =>
                setTeamMeta({
                  ...teamMeta,
                  opponent: capitalizeWords(e.target.value),
                })
              }
            />
          </div>

          {/* LEAGUE / TOURNAMENT INPUT */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
              <Activity size={12} className="inline mr-1" /> League / Tournament
              {setupAttempted && !teamMeta.league.trim() && (
                <span className="text-red-500 animate-pulse">*</span>
              )}
            </label>
            <input
              className={`border p-2.5 rounded-lg outline-none transition-all duration-200 ${
                setupAttempted && !teamMeta.league.trim()
                  ? "border-red-500 bg-red-50 ring-1 ring-red-200"
                  : "focus:border-blue-500 focus:ring-2 focus:ring-blue-100 border-slate-200"
              }`}
              placeholder="e.g. PBAQ"
              value={teamMeta.league}
              onChange={(e) =>
                setTeamMeta({
                  ...teamMeta,
                  league: e.target.value,
                })
              }
            />
          </div>

          {/* SEASON INPUT */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
              <Calendar size={12} className="inline mr-1" /> Season
              {setupAttempted && !teamMeta.season.trim() && (
                <span className="text-red-500 animate-pulse">*</span>
              )}
            </label>
            <input
              className={`border p-2.5 rounded-lg outline-none transition-all duration-200 ${
                setupAttempted && !teamMeta.season.trim()
                  ? "border-red-500 bg-red-50 ring-1 ring-red-200"
                  : "focus:border-blue-500 focus:ring-2 focus:ring-blue-100 border-slate-200"
              }`}
              placeholder="e.g. 1, 2, 3, 4, etc."
              value={teamMeta.season}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "");
                setTeamMeta({
                  ...teamMeta,
                  season: val,
                });
              }}
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: RULE CONFIGURATION */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
          <ShieldCheck className="text-blue-600" size={20} /> Rule Configuration
        </h2>

        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Select Game Format:
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => setGameMode("FULL")}
              className={`p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                gameMode === "FULL"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="min-w-0">
                <div
                  className={`font-black uppercase text-sm ${gameMode === "FULL" ? "text-blue-700" : "text-slate-700"}`}
                >
                  Full Pasarelle
                </div>
                <div className="text-[10px] text-slate-500 font-bold">
                  Auto-pause at 5:00 for Q1, Q2, and Q3.
                </div>
              </div>
              {gameMode === "FULL" && (
                <Zap size={20} className="text-blue-500 fill-blue-500" />
              )}
            </button>

            <button
              onClick={() => setGameMode("HALF")}
              className={`p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                gameMode === "HALF"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="min-w-0">
                <div
                  className={`font-black uppercase text-sm ${gameMode === "HALF" ? "text-blue-700" : "text-slate-700"}`}
                >
                  Half Pasarelle
                </div>
                <div className="text-[10px] text-slate-500 font-bold">
                  Auto-pause at 5:00 for Q1 and Q2 only.
                </div>
              </div>
              {gameMode === "HALF" && (
                <Zap size={20} className="text-blue-500 fill-blue-500" />
              )}
            </button>

            <button
              onClick={() => setGameMode("OPEN")}
              className={`p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                gameMode === "OPEN"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="min-w-0">
                <div
                  className={`font-black uppercase text-sm ${gameMode === "OPEN" ? "text-blue-700" : "text-slate-700"}`}
                >
                  Standard / Open
                </div>
                <div className="text-[10px] text-slate-500 font-bold">
                  No automatic pauses. Quarters run full duration.
                </div>
              </div>
              {gameMode === "OPEN" && (
                <Zap size={20} className="text-blue-500 fill-blue-500" />
              )}
            </button>
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

        <form
          onSubmit={onAddPlayerSubmit}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            required
            ref={nameInputRef}
            className="border border-slate-200 p-2.5 rounded-lg flex-1 min-w-0 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            placeholder="Player Name"
            value={newPlayer.name}
            onChange={(e) => {
              const lettersOnly = e.target.value.replace(/[^a-zA-Z\s]/g, "");
              setNewPlayer({
                ...newPlayer,
                name: capitalizeWords(lettersOnly),
              });
            }}
          />
          <input
            required
            inputMode="numeric"
            className="border border-slate-200 p-2.5 rounded-lg sm:w-28 min-w-0 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            placeholder="Jersey #"
            value={newPlayer.jersey}
            onChange={(e) => {
              const numbersOnly = e.target.value.replace(/[^0-9]/g, "");
              setNewPlayer({ ...newPlayer, jersey: numbersOnly });
            }}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
          >
            Add Player
          </button>
        </form>

        {/* CLOUD SYNC TOOLS */}
        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
          <button
            onClick={handleLoadRoster}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black uppercase transition-all"
          >
            <CloudDownload size={14} /> Load Saved Roster
          </button>
          <button
            onClick={handleSaveRoster}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-black uppercase transition-all"
          >
            <Save size={14} /> Save as Permanent
          </button>
        </div>

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
                <span className="text-slate-700 truncate max-w-[100px] sm:max-w-[150px]">
                  {p.name}
                </span>

                <button
                  type="button"
                  onClick={() => onEditClick(p)}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors ml-1"
                  title="Edit Player Name"
                >
                  <Pencil size={12} />
                </button>

                <button
                  type="button"
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
        <Play fill="currentColor" size={20} />{" "}
        {gameInProgress ? "Resume Game" : "Start Game Tracking"}
      </button>

      <EditPlayerModal
        player={playerToEdit}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleModalSave}
      />

      <TeamSelectionModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        teams={availableTeams}
        onSelect={handleTeamSelect}
      />

      {/* Reset Data Button */}
      <div className="flex justify-center mt-4">
        <button
          onClick={resetGame}
          className="text-red-500 hover:text-red-700 text-sm font-bold underline transition-colors"
        >
          Clear all saved data and start fresh
        </button>
      </div>

      <p className="text-center text-slate-400 text-xs">
        Logged in as {user?.email || "Guest Coach"}
      </p>
    </div>
  );
}
