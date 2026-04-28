import React, { useState, useEffect } from "react";
import { X, Keyboard, Save } from "lucide-react";

const keyDisplayMap = {
  'Space': 'Spacebar',
  'KeyR': 'R',
  'KeyF': 'F',
  // Add more mappings for better display if needed
};

export default function KeyboardSettingsModal({
  isOpen,
  onClose,
  keybindings,
  setKeybindings,
  showNotification,
}) {
  const [editingKey, setEditingKey] = useState(null); // 'toggleGameClock', 'resetShotClock24', etc.
  const [tempKeybindings, setTempKeybindings] = useState(keybindings);

  useEffect(() => {
    setTempKeybindings(keybindings); // Sync internal state with props when modal opens
  }, [keybindings, isOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (editingKey) {
        event.preventDefault(); // Prevent default browser action
        const newKey = event.code;

        // Check for conflicts
        const conflict = Object.entries(tempKeybindings).find(
          ([action, currentKey]) =>
            action !== editingKey && currentKey === newKey,
        );

        if (conflict) {
          showNotification(`Key "${keyDisplayMap[newKey] || newKey}" is already assigned to "${conflict[0]}".`);
          setEditingKey(null); // Stop editing
          return;
        }

        setTempKeybindings((prev) => ({
          ...prev,
          [editingKey]: newKey,
        }));
        setEditingKey(null); // Stop editing after key is pressed
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, editingKey, tempKeybindings, showNotification]);

  const handleSave = () => {
    setKeybindings(tempKeybindings);
    showNotification("Keybindings saved!");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10002] p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md space-y-6 animate-in fade-in zoom-in">
        <div className="flex justify-between items-center border-b pb-4 border-slate-200">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <Keyboard size={28} className="text-blue-600" /> Keyboard Shortcuts
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {Object.entries(tempKeybindings).map(([action, key]) => (
            <div key={action} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-700 capitalize">
                {action.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <button
                onClick={() => setEditingKey(action)}
                className={`px-4 py-2 rounded-lg font-black text-sm transition-all ${
                  editingKey === action
                    ? "bg-amber-500 text-slate-900 animate-pulse"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {editingKey === action ? "Press a key..." : (keyDisplayMap[key] || key)}
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-[0.98]"
          >
            <Save size={20} /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}