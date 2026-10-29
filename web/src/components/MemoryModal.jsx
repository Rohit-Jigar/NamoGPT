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
      <div className="bg-[#13100E] border border-[#241E1A] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#241E1A] flex items-center justify-between bg-[#13100E]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6E0F0]/10 border border-[#E6E0F0]/20 flex items-center justify-center">
              <Brain className="w-4 h-4 text-[#E6E0F0]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#FAF9F8]">Long-Term Memory</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#E6E0F0]/15 text-[#E6E0F0] border border-[#E6E0F0]/25">
                  {memories.length} Stored
                </span>
              </div>
              <p className="text-xs text-[#BDB8B3]">
                NamoGPT remembers your preferences and style across conversations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#241E1A] transition-colors"
            aria-label="Close Memory Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Add New Memory Card */}
          <div className="p-4 rounded-xl bg-[#1A1613] border border-[#2D2621] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#E5E4E2] flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-[#E6E0F0]" /> Add Custom Memory
              </span>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="bg-[#241E1A] border border-[#2D2621] rounded-lg text-xs text-[#E5E4E2] px-2.5 py-1 outline-none focus:border-[#6F4E37] transition-colors"
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
                className="flex-1 bg-[#241E1A] border border-[#2D2621] rounded-xl px-3.5 py-2 text-xs text-[#FAF9F8] placeholder-[#736B63] outline-none focus:border-[#6F4E37] transition-colors"
              />
              <button
                onClick={handleAdd}
                disabled={!newContent.trim()}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                  newContent.trim()
                    ? 'bg-[#6F4E37] hover:bg-[#8C6549] text-[#FAF9F8] shadow-md shadow-black/30'
                    : 'bg-[#241E1A] text-[#8C827A] cursor-not-allowed'
                }`}
              >
                {justAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{justAdded ? 'Added' : 'Save'}</span>
              </button>
            </div>
          </div>

          {/* Stored Memories List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#BDB8B3] font-medium">
              <span>Saved Preferences ({memories.length})</span>
              {memories.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-[#8C827A] hover:text-rose-400 transition-colors text-[11px]"
                >
                  Clear All
                </button>
              )}
            </div>

            {memories.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[#1A1613] border border-[#2D2621]">
                <Brain className="w-8 h-8 text-[#8C827A] mx-auto mb-2" />
                <p className="text-xs text-[#BDB8B3]">No memories stored yet.</p>
                <p className="text-[11px] text-[#8C827A] mt-1">
                  Tell NamoGPT "Remember that I like..." in chat or add memories above.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start justify-between p-3 rounded-xl bg-[#1A1613] hover:bg-[#201B17] border border-[#2D2621] transition-colors group"
                  >
                    <div className="space-y-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#241E1A] text-[#E6E0F0] border border-[#E6E0F0]/20">
                          {m.category || 'preference'}
                        </span>
                        <span className="text-[10px] text-[#8C827A]">
                          {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'Active'}
                        </span>
                      </div>
                      <p className="text-xs text-[#FAF9F8] leading-relaxed">{m.content}</p>
                    </div>

                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-1.5 text-[#8C827A] hover:text-rose-400 rounded-lg hover:bg-[#241E1A] transition-colors shrink-0 opacity-80 group-hover:opacity-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
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
          <div className="p-3.5 rounded-xl bg-[#1A1613] border border-[#6F4E37]/30 flex items-start gap-2.5 text-xs text-[#E6E0F0]">
            <Shield className="w-4 h-4 text-[#E6E0F0] shrink-0 mt-0.5" />
            <div className="text-[11px] text-[#BDB8B3] leading-relaxed">
              Memories are stored locally in your browser storage and encrypted when logged in. They are dynamically matched and injected only when relevant to your prompt.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#241E1A] flex items-center justify-end bg-[#13100E]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#241E1A] hover:bg-[#2D2621] text-xs font-semibold text-[#FAF9F8] border border-[#2D2621] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
