import React, { useState, useEffect } from 'react';
import {
  Brain,
  Plus,
  Trash2,
  X,
  Sparkles,
  Check,
  Shield,
  Layers,
  Info
} from 'lucide-react';
import {
  getMemories,
  addMemory,
  removeMemory,
  clearMemories
} from '../services/memory';

export default function MemoryModal({ isOpen, onClose }) {
  const [memories, setMemories] = useState([]);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('preference');
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMemories(getMemories());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleAdd() {
    if (!newContent.trim()) return;
    const added = addMemory(newContent.trim(), newCategory);
    if (added) {
      setMemories(getMemories());
      setNewContent('');
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    }
  }

  function handleDelete(id) {
    const updated = removeMemory(id);
    setMemories(updated);
  }

  function handleClearAll() {
    if (window.confirm('Are you sure you want to delete all long-term memories? This cannot be undone.')) {
      clearMemories();
      setMemories([]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] border border-zinc-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-[#181818]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Brain className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Long-Term Memory</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {memories.length} Stored
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                NamoGPT remembers your preferences and style across conversations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Add New Memory Card */}
          <div className="p-4 rounded-xl bg-[#141414] border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-purple-400" /> Add Custom Memory
              </span>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="bg-[#1f1f1f] border border-zinc-700 rounded-lg text-xs text-zinc-300 px-2 py-1 outline-none"
              >
                <option value="preference">Preference</option>
                <option value="style">Coding / Writing Style</option>
                <option value="project">Project / Domain Context</option>
                <option value="personal">Personal Fact</option>
              </select>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. Always write code in TypeScript with functional components..."
                className="flex-1 bg-[#1c1c1c] border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={handleAdd}
                disabled={!newContent.trim()}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                  newContent.trim()
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                {justAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{justAdded ? 'Added' : 'Save'}</span>
              </button>
            </div>
          </div>

          {/* Stored Memories List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span>Saved Preferences ({memories.length})</span>
              {memories.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-zinc-500 hover:text-rose-400 transition-colors text-[11px]"
                >
                  Clear All
                </button>
              )}
            </div>

            {memories.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[#141414] border border-zinc-800/80">
                <Brain className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">No memories stored yet.</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Tell NamoGPT "Remember that I like..." in chat or add memories above.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start justify-between p-3 rounded-xl bg-[#141414] hover:bg-[#181818] border border-zinc-800/80 transition-colors group"
                  >
                    <div className="space-y-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-purple-300 border border-purple-500/20">
                          {m.category || 'preference'}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'Active'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed">{m.content}</p>
                    </div>

                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors shrink-0 opacity-80 group-hover:opacity-100"
                      title="Delete memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy Note */}
          <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 flex items-start gap-2.5 text-xs text-purple-200">
            <Shield className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-zinc-400 leading-relaxed">
              Memories are stored locally in your browser storage and encrypted when logged in. They are dynamically matched and injected only when relevant to your prompt.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-end bg-[#181818]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
