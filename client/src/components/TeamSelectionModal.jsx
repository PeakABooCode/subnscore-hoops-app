import React from "react";
import { X, Users } from "lucide-react";

export default function TeamSelectionModal({
  isOpen,
  onClose,
  teams,
  onSelect,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 w-full max-w-md relative flex flex-col max-h-[80vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={24} />
        </button>
        <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <Users className="text-blue-600" /> Select Team
        </h2>

        {teams.length === 0 ? (
          <div className="text-center py-10 text-slate-400 font-bold italic">
            No teams found. Type your team name to start fresh.
          </div>
        ) : (
          <div className="overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {teams.map((t, idx) => (
              <button
                key={idx}
                onClick={() => onSelect(t)}
                className="w-full text-left p-4 rounded-xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="font-black text-slate-800 uppercase group-hover:text-blue-700 truncate">
                  {t.name}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  <span className="truncate">
                    {t.league || "General League"}
                  </span>
                  <span>•</span>
                  <span>Season {t.season || "N/A"}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
