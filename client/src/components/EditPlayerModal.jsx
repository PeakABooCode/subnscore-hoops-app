import React, { useState, useEffect } from "react";
import { X, User, Hash } from "lucide-react";

export default function EditPlayerModal({ player, isOpen, onClose, onSave }) {
  const [editedName, setEditedName] = useState("");
  const [editedJersey, setEditedJersey] = useState("");

  useEffect(() => {
    if (player) {
      setEditedName(player.name);
      setEditedJersey(player.jersey);
    }
  }, [player]);

  const capitalizeWords = (str) => {
    return str
      .split(" ")
      .map((word) =>
        word.length > 0
          ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          : "",
      )
      .join(" ");
  };

  const handleSave = () => {
    const finalName = editedName.trim()
      ? capitalizeWords(editedName.replace(/[^a-zA-Z\s]/g, ""))
      : player.name;
    const finalJersey = editedJersey.trim()
      ? editedJersey.replace(/[^0-9]/g, "")
      : player.jersey;

    onSave(player.id, { name: finalName, jersey: finalJersey });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={24} />
        </button>
        <h2 className="text-2xl font-black text-slate-800 mb-6">Edit Player</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">
              Player Name
            </label>
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-slate-700"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">
              Jersey Number
            </label>
            <div className="relative">
              <Hash
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                inputMode="numeric"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-slate-700"
                value={editedJersey}
                onChange={(e) => {
                  const numbersOnly = e.target.value.replace(/[^0-9]/g, "");
                  setEditedJersey(numbersOnly);
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
